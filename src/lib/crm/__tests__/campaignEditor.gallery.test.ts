import { describe, expect, it, vi } from "vitest";

import { normalizeLoadedContentBlocks, persistCampaignDraft, fetchCampaignEditorRecord } from "../campaignEditor";
import type { ContentBlock } from "@/types/emailBuilder";

const mocks = vi.hoisted(() => ({persist: vi.fn(), from: vi.fn()}));
vi.mock("@/lib/crm/campaignDraftPersistence", () => ({persistCampaignRecord: mocks.persist}));
vi.mock("@/integrations/supabase/client", () => ({supabase: {from: mocks.from}}));

describe("normalizeLoadedContentBlocks", () => {
  it("retypes legacy product gallery blocks loaded as image-gallery", () => {
    const blocks: ContentBlock[] = [
      {
        id: "legacy-product-gallery",
        type: "image-gallery",
        source: "manual",
        headline: "Holiday Products",
        galleryItems: [],
      } as ContentBlock,
      {
        id: "image-gallery",
        type: "image-gallery",
        source: "manual",
        headline: "Photo Grid",
        galleryImages: [],
      } as ContentBlock,
    ];

    const result = normalizeLoadedContentBlocks(blocks);

    expect(result[0].type).toBe("product-gallery");
    expect(result[1].type).toBe("image-gallery");
  });
});

describe("website text campaign provenance", () => {
  it("persists SMS text and reloads it without email blocks or recipients", async () => {
    const source = {
      siteId: "site", itemId: "item", type: "event" as const,
      publicUrl: "https://example.org/workshop", updatedAt: "2026-11-22T00:00:00Z",
    };
    const smsMessage = "Winter workshop\nhttps://example.org/workshop";
    const campaign = {
      id: "draft", name: "Promote Winter workshop", status: "draft",
      metadata: {campaignType: "sms", smsMessage, connectedContentSources: [source]},
      content: smsMessage, delivery_method: "sms", persona_ids: [], metrics: {},
    };
    mocks.persist.mockResolvedValueOnce({campaign});
    await persistCampaignDraft({
      campaignType: "sms", status: "draft", name: campaign.name,
      subjectLine: "", preheaderText: "", senderName: "", senderEmail: "",
      contentBlocks: [], smsMessage, sendAt: null, sendImmediately: false,
      includeAllCustomers: false, segments: [], personas: [], connectedContentSources: [source],
    });
    expect(mocks.persist).toHaveBeenLastCalledWith(expect.objectContaining({
      campaignType: "sms", status: "draft", contentBlocks: [], smsMessage,
      sendAt: null, sendImmediately: false, includeAllCustomers: false,
      segmentIds: [], personaIds: [], metadata: {connectedContentSources: [source]},
    }));
    mocks.from.mockImplementation(() => {
      const query = {
        select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({data: campaign, error: null}),
        order: vi.fn().mockResolvedValue({data: [], error: null}),
        then: (resolve: (value: {data: unknown[]; error: null}) => unknown) =>
          Promise.resolve({data: [], error: null}).then(resolve),
      };
      return query;
    });
    const reloaded = await fetchCampaignEditorRecord("draft");
    expect(reloaded.channel).toBe("sms");
    expect(reloaded.smsMessage).toBe(smsMessage);
    expect(reloaded.contentBlocks).toEqual([]);
    expect(reloaded.metadata.connectedContentSources).toEqual([source]);
    expect(reloaded.segments).toEqual([]);
    expect(reloaded.personas).toEqual([]);
  });
});
