import { describe, expect, it, vi } from 'vitest';
import {
  buildCampaignOrigin,
  getCampaignOriginKind,
  normalizeCampaignOrigin,
} from './campaignOrigin';
import { mapCampaignCatalogItem } from './campaignEditor';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
import { resolveStudioDraftId } from './studioEntry';
describe('draft creation', () => { it('does not need a subject before editor entry', async () => { expect(await resolveStudioDraftId(null, async () => 'draft-id')).toBe('draft-id'); }); });

describe("campaign origin", () => {
  it("builds kind-only and referenced origins", () => {
    expect(buildCampaignOrigin("blank")).toBe("blank");
    expect(buildCampaignOrigin("duplicate", "6c1f2d1e-0000-4000-8000-000000000001")).toBe(
      "duplicate:6c1f2d1e-0000-4000-8000-000000000001",
    );
    expect(buildCampaignOrigin("weekly_theme", "master:12")).toBe("weekly_theme:master:12");
  });

  it("sanitizes references to what the database check accepts", () => {
    const origin = buildCampaignOrigin("starter_template", "spring sale / 2026!");
    expect(origin).toBe("starter_template:spring-sale---2026-");
    expect(normalizeCampaignOrigin(origin)).toBe(origin);
  });

  it("rejects malformed values instead of failing an insert", () => {
    expect(normalizeCampaignOrigin("made_up:1")).toBeNull();
    expect(normalizeCampaignOrigin("blank:has space")).toBeNull();
    expect(normalizeCampaignOrigin(42)).toBeNull();
    expect(getCampaignOriginKind("review:abc")).toBe("review");
    expect(getCampaignOriginKind(null)).toBeNull();
  });
});




describe("SMS draft on email campaigns", () => {
  it("does not read rendered email HTML into the SMS field", async () => {
    const { __testing } = await import("./campaignEditor");
    expect(__testing.extractSmsMessage({ content: "<!DOCTYPE html><html></html>", metadata: {} } as never)).toBe("");
    expect(__testing.extractSmsMessage({ content: "Hi there", metadata: { campaignType: "sms" } } as never)).toBe("Hi there");
    expect(__testing.extractSmsMessage({ content: "<p>x</p>", metadata: { smsMessage: "Text" } } as never)).toBe("Text");
    expect(typeof mapCampaignCatalogItem).toBe("function");
  });
});

import { deriveCampaignDisplayName, isUnsetCampaignName } from './campaignDisplayName';

describe('campaign display name (#8)', () => {
  it('treats empty and legacy placeholder names as unset', () => {
    expect(isUnsetCampaignName('')).toBe(true);
    expect(isUnsetCampaignName('  Untitled Campaign ')).toBe(true);
    expect(isUnsetCampaignName('Campaign 3fa85f64')).toBe(true);
    expect(isUnsetCampaignName('Spring sale')).toBe(false);
  });
  it('uses a real name as-is', () => {
    expect(deriveCampaignDisplayName({ name: 'Spring sale', subjectLine: 'Ignored' })).toBe('Spring sale');
  });
  it('falls back to the subject line, then the first headline, then Draft, <date>', () => {
    expect(deriveCampaignDisplayName({ name: 'Untitled Campaign', subjectLine: '<b>20% off</b> perennials' })).toBe('20% off perennials');
    expect(deriveCampaignDisplayName({
      name: '', subjectLine: '',
      blocks: [{ type: 'newsletter-header', headline: '', visible: true }, { type: 'email-safe-hero', headline: 'Fresh evergreens' }, { type: 'footer', headline: 'x' }],
    })).toBe('Fresh evergreens');
    expect(deriveCampaignDisplayName({ name: '', subjectLine: '', blocks: [], date: '2026-11-23T12:00:00Z' })).toMatch(/^Draft, Nov 2[23], 2026$/);
  });
  it('never uses the header store name as a title; Studio says Untitled draft (qa2 #10)', () => {
    const blank = [{ type: 'newsletter-header', headline: 'Northfield Garden Center' }, { type: 'plain-text', headline: '' }];
    expect(deriveCampaignDisplayName({ name: '', subjectLine: '', blocks: blank, date: '2026-11-24T12:00:00Z' })).toMatch(/^Draft, Nov 2[45], 2026$/);
    expect(deriveCampaignDisplayName({ name: '', subjectLine: '', blocks: blank, emptyLabel: 'Untitled draft' })).toBe('Untitled draft');
    expect(deriveCampaignDisplayName({ name: '', subjectLine: '', firstHeadline: 'Celebrating Garden Successes' })).toBe('Celebrating Garden Successes');
    expect(deriveCampaignDisplayName({ name: '', subjectLine: 'Year-End Garden Review', emptyLabel: 'Untitled draft' })).toBe('Year-End Garden Review');
  });
});

import { findIdentityMismatches } from './identityConsistency';

describe('identity consistency (#15)', () => {
  it('stays quiet when every identity names the same business', () => {
    expect(findIdentityMismatches({
      senderName: 'Northfield Garden Center',
      senderEmail: 'news@northfieldgardens.ca',
      footerBusinessName: 'Northfield Garden Center',
      websiteName: 'Northfield Gardens',
      websiteUrl: 'https://northfieldgardens.ca/products/fern',
    })).toEqual([]);
  });
  it('warns for each pair that disagrees, as text only', () => {
    const warnings = findIdentityMismatches({
      senderName: 'Greenfield Garden Centre',
      senderEmail: 'news@northfieldgardens.ca',
      footerBusinessName: 'Northfield Garden Center',
    });
    expect(warnings.length).toBe(2);
    expect(warnings.join(' ')).toMatch(/sender name .*Greenfield.*doesn’t match the sender email domain/);
    expect(warnings.join(' ')).toMatch(/sender name .*doesn’t match the footer business name/);
  });
  it('ignores free-mail sender domains and missing values', () => {
    expect(findIdentityMismatches({ senderName: 'Northfield', senderEmail: 'owner@gmail.com', footerBusinessName: '' })).toEqual([]);
  });
});

import { resolveDraftSenderDefaults, type SenderDomain } from './draftSenderDefaults';

describe('new draft sender prefill (qa2 #2)', () => {
  const northfield: SenderDomain = {
    id: 'e80290a9-7f39-4564-8c8a-91798764dbdf',
    domain: 'northfieldgardens.ca',
    status: 'active',
    default_from_email: null,
    default_from_name: null,
    default_reply_to: null,
    created_at: '2026-11-22T12:05:58Z',
  };

  it('uses the tenant default sender first', () => {
    const sender = resolveDraftSenderDefaults({
      tenantDefaultDomainId: northfield.id,
      domains: [{ ...northfield, default_from_email: 'news@northfieldgardens.ca', default_from_name: 'Northfield News' }],
      companyName: 'Northfield Garden Center',
      companyEmail: 'mail@northfieldgardens.ca',
      tenantName: 'Northfield',
    });
    expect(sender).toMatchObject({ senderName: 'Northfield News', senderEmail: 'news@northfieldgardens.ca', replyTo: 'news@northfieldgardens.ca', source: 'tenant_default' });
  });

  it('falls back to the company name and email when that domain is verified (Northfield today)', () => {
    const sender = resolveDraftSenderDefaults({
      tenantDefaultDomainId: null,
      domains: [northfield],
      companyName: 'Northfield Garden Center',
      companyEmail: 'mail@northfieldgardens.ca',
      tenantName: 'Northfield',
    });
    expect(sender).toEqual({
      senderName: 'Northfield Garden Center',
      senderEmail: 'mail@northfieldgardens.ca',
      replyTo: 'mail@northfieldgardens.ca',
      fromEmailDomainId: northfield.id,
      source: 'company_profile',
    });
  });

  it('does not use a company email on an unverified domain', () => {
    const sender = resolveDraftSenderDefaults({
      tenantDefaultDomainId: null,
      domains: [{ ...northfield, status: 'pending_dns' }],
      companyName: 'Northfield Garden Center',
      companyEmail: 'mail@northfieldgardens.ca',
      tenantName: null,
    });
    expect(sender.senderEmail).toBe('');
    expect(sender.source).toBe('none');
  });

  it('uses the verified domain address when the company email is elsewhere', () => {
    const sender = resolveDraftSenderDefaults({
      tenantDefaultDomainId: null,
      domains: [northfield],
      companyName: 'Northfield Garden Center',
      companyEmail: 'owner@gmail.com',
      tenantName: null,
    });
    expect(sender).toMatchObject({ senderEmail: 'mail@northfieldgardens.ca', senderName: 'Northfield Garden Center', source: 'verified_domain' });
  });
});
