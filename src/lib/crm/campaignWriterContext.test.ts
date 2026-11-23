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
