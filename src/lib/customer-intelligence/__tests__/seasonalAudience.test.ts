import { describe, expect, it } from 'vitest';
import { seasonalAudienceQuestion } from '../seasonalAudience';
import { bloomIntelligenceUrl } from '../intelligenceExperience';

const input = { product: 'Hanging basket', match: 'contains' as const, from: '2025-04-01', to: '2025-06-30', timezone: 'America/Vancouver' };
describe('seasonal audience review', () => {
  it('uses the actual purchase date range, not the customer’s latest purchase date', () => {
    const question = seasonalAudienceQuestion(input);
    expect(question).toContain('"start_date":"2025-04-01"');
    expect(question).toContain('"product_match":"contains"');
    expect(question).not.toContain('last_purchase_date');
    expect(new URLSearchParams(bloomIntelligenceUrl(question, 'explore').split('?')[1]).get('prompt')).toContain('do not send messages');
  });
  it('excludes any later purchase only when explicitly selected', () => {
    expect(seasonalAudienceQuestion(input)).not.toContain('not_purchased');
    expect(seasonalAudienceQuestion({ ...input, excludeFrom: '2026-04-01', excludeTo: '2026-06-30' })).toContain('{"mode":"not_purchased","start_date":"2026-04-01","end_date":"2026-06-30"}');
  });
  it('rejects invalid and overlapping dates', () => {
    for (const changes of [{ from: '2025-02-29' }, { to: '2025-03-01' }, { excludeFrom: '2025-05-01', excludeTo: '2025-08-01' }, { excludeFrom: '2026-01-01' }]) expect(() => seasonalAudienceQuestion({ ...input, ...changes })).toThrow();
  });
  it('keeps literal products escaped and supports exact SKU matching', () => {
    expect(seasonalAudienceQuestion({ ...input, product: '12" Basket', match: 'sku' })).toContain('"product":"12\\" Basket","product_match":"sku"');
  });
});
