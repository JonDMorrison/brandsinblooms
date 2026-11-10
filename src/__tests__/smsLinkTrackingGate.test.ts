import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  extractTrackableUrls,
  generateTrackingCode,
  prepareSmsContentForDelivery,
  replaceLinksWithTrackingUrls,
} from '../../supabase/functions/_shared/smsLinkWrapper';

const root = process.cwd();

describe('SMS link tracking release gate', () => {
  it('extracts valid HTTP links once and leaves trailing prose punctuation out', () => {
    expect(extractTrackableUrls(
      'Visit https://example.com/sale. Again: https://example.com/sale! Docs https://example.com/help?q=1',
    )).toEqual([
      'https://example.com/sale',
      'https://example.com/help?q=1',
    ]);
  });

  it('uses cryptographically generated 128-bit tracking codes', () => {
    const first = generateTrackingCode();
    const second = generateTrackingCode();
    expect(first).toMatch(/^[a-f0-9]{32}$/);
    expect(second).toMatch(/^[a-f0-9]{32}$/);
    expect(first).not.toBe(second);
  });

  it('rewrites every occurrence using the canonical database mapping', () => {
    expect(replaceLinksWithTrackingUrls(
      'One https://example.com/a and again https://example.com/a.',
      'https://sms.example/r/',
      [{ link_index: 0, original_url: 'https://example.com/a', tracking_code: 'a'.repeat(32) }],
    )).toBe(`One https://sms.example/r/${'a'.repeat(32)} and again https://sms.example/r/${'a'.repeat(32)}.`);
  });

  it('registers message links through the idempotent service RPC before delivery', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{
        link_index: 0,
        original_url: 'https://example.com/sale',
        tracking_code: 'b'.repeat(32),
      }],
      error: null,
    });

    const prepared = await prepareSmsContentForDelivery(
      { rpc },
      'Shop https://example.com/sale',
      'https://sms.example/r',
      { messageId: '00000000-0000-0000-0000-000000000001' },
    );

    expect(rpc).toHaveBeenCalledWith('register_sms_tracking_links', expect.objectContaining({
      p_message_id: '00000000-0000-0000-0000-000000000001',
    }));
    expect(prepared.content).toBe(`Shop https://sms.example/r/${'b'.repeat(32)}`);
  });

  it('fails closed when a URL cannot receive a complete tracking mapping', async () => {
    await expect(prepareSmsContentForDelivery(
      { rpc: vi.fn().mockResolvedValue({ data: [], error: null }) },
      'Shop https://example.com/sale',
      'https://sms.example/r',
      { messageId: '00000000-0000-0000-0000-000000000001' },
    )).rejects.toMatchObject({ code: '54001' });
  });

  it('wires both campaign and automation delivery paths through the shared tracker', () => {
    const worker = fs.readFileSync(path.join(root, 'supabase/functions/sms-queue-worker/index.ts'), 'utf8');
    expect(worker.match(/prepareSmsContentForDelivery\(/g)).toHaveLength(2);
    expect(worker.match(/calculateBillableUnits\(/g)).toHaveLength(2);
  });

  it('keeps the link ledger and mutation RPCs service-only', () => {
    const migration = fs.readFileSync(
      path.join(root, 'supabase/migrations/20260903122529_reliable_sms_link_tracking.sql'),
      'utf8',
    );
    expect(migration).toContain('ALTER TABLE public.sms_link_clicks ENABLE ROW LEVEL SECURITY');
    expect(migration).toContain('REVOKE ALL ON TABLE public.sms_link_clicks FROM PUBLIC, anon, authenticated');
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.record_sms_link_click(text, text) TO service_role');
  });

  it('records clicks atomically without retaining raw IP addresses', () => {
    const redirect = fs.readFileSync(path.join(root, 'supabase/functions/sms-link-redirect/index.ts'), 'utf8');
    expect(redirect).toContain("supabase.rpc('record_sms_link_click'");
    expect(redirect).not.toContain("req.headers.get('x-forwarded-for')");
    expect(redirect).toContain("req.method === 'HEAD'");
  });
});
