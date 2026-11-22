import { describe, expect, it } from "vitest";
import { reviewCampaignContent } from "./campaignContentReview";
import type { StudioBlock } from "@/types/studioBlocks";
const blocks = (items: object[]) => items as StudioBlock[];
describe("campaign content review", () => {
  it("locates unfinished links and images without flagging valid destinations", () => {
    const issues = reviewCampaignContent(
      blocks([
        { id: "a", type: "hero", buttonText: "Book now", buttonUrl: "#" },
        { id: "b", type: "image", imageUrl: "" },
        {
          id: "c",
          type: "hero",
          buttonText: "Shop",
          buttonUrl: "https://garden.ca/shop",
        },
        { id: "d", type: "hero", buttonText: "Register" },
      ]),
    );
    expect(issues.map((i) => i.blockId)).toEqual(["a", "b", "d"]);
  });
  it("ignores hidden blocks and checks nested product buttons", () => {
    expect(
      reviewCampaignContent(
        blocks([
          { id: "hidden", type: "image", visible: false },
          {
            id: "products",
            type: "product-gallery",
            galleryProducts: [
              { buttonText: "Shop", buttonUrl: "https://example.com" },
            ],
          },
        ]),
      ),
    ).toEqual([
      {
        blockId: "products",
        message: "Block 2: Replace the sample link with your destination.",
      },
    ]);
  });
});

import {vi, beforeEach} from "vitest";
import {refreshConnectedContentBlock, type ConnectedContentItem} from "@/lib/connectedContent";
import {connectedEmailBlocks, refreshConnectedEmailBlocks, replaceConnectedEmailDraft, selectConnectedEmailReviewBlocks} from "./connectedEmailReview";
const emailReviewMocks = vi.hoisted(() => ({invoke: vi.fn(), rpc: vi.fn()}));
vi.mock("@/integrations/supabase/client", () => ({supabase: {functions: {invoke: emailReviewMocks.invoke}, rpc: emailReviewMocks.rpc}}));
const websiteItem: ConnectedContentItem = {id: "item", siteId: "site", type: "page", title: "New title", description: "New description", imageUrl: null, publicUrl: "https://flowers.test/new", ctaLabel: "Read more", updatedAt: "2026-11-22T01:00:00Z"};
const savedBlock = {id: "block", type: "image-text", visible: true, headline: "Old title", body: "Custom old copy", buttonColor: "#123456", layout: "left", connectedContent: {siteId: "site", itemId: "item", type: "page", updatedAt: "2026-11-21T01:00:00Z", publicUrl: "https://flowers.test/old"}} as StudioBlock;
describe("explicit connected email review", () => {
  beforeEach(() => {emailReviewMocks.invoke.mockReset(); emailReviewMocks.rpc.mockReset();});
  it("refreshes source fields only, preserving IDs, style and layout", () => {
    const refreshed = refreshConnectedContentBlock(savedBlock, websiteItem);
    expect(refreshed).toMatchObject({id: "block", buttonColor: "#123456", layout: "left", headline: "New title", body: "New description", buttonUrl: websiteItem.publicUrl});
    expect(refreshed.connectedContent?.updatedAt).toBe(websiteItem.updatedAt);
    expect(savedBlock.headline).toBe("Old title");
  });
  it("rejects a different site/item and unavailable events", () => {
    expect(() => refreshConnectedContentBlock(savedBlock, {...websiteItem, siteId: "foreign"})).toThrow("different item");
    for (const eventStatus of [undefined, "sold_out", "cancelled"] as const) {
      expect(() => refreshConnectedContentBlock({...savedBlock, connectedContent: {...savedBlock.connectedContent!, type: "event"}}, {...websiteItem, type: "event", eventStatus})).toThrow("unavailable");
    }
  });
  it("looks up exact concrete types and preserves unrelated and hidden blocks", async () => {
    for (const [type, plural] of [["page", "pages"], ["product", "products"], ["event", "events"], ["blog", "blogs"], ["fundraiser", "fundraisers"]] as const) {
      emailReviewMocks.invoke.mockResolvedValueOnce({data: {items: [{...websiteItem, type, eventStatus: "available"}], sources: [], errors: []}, error: null});
      const unrelated = {id: "text", type: "plain-text", body: "Keep me"} as StudioBlock;
      const hidden = {...savedBlock, visible: false};
      const result = await refreshConnectedEmailBlocks([{...savedBlock, connectedContent: {...savedBlock.connectedContent!, type}}, unrelated, hidden]);
      expect(emailReviewMocks.invoke).toHaveBeenLastCalledWith("connected-content", {body: {action: "catalog", type: plural, siteId: "site", itemId: "item", limit: 1}});
      expect(result.refreshed[1]).toBe(unrelated);
      expect(result.refreshed[2]).toBe(hidden);
    }
    expect(emailReviewMocks.rpc).not.toHaveBeenCalled();
  });
  it("fails closed on unavailable sources and preserves ticket capacity as a warning", async () => {
    emailReviewMocks.invoke.mockResolvedValueOnce({data: {items: [], errors: [], sources: []}, error: null});
    await expect(refreshConnectedEmailBlocks([savedBlock])).rejects.toThrow("no longer available");
    emailReviewMocks.invoke.mockResolvedValueOnce({data: {items: [websiteItem], errors: [{error: "offline"}], sources: []}, error: null});
    await expect(refreshConnectedEmailBlocks([savedBlock])).rejects.toThrow("could not be checked");
    emailReviewMocks.invoke.mockResolvedValueOnce({data: {items: [{...websiteItem, capacityCheckRequired: true}], errors: [], sources: []}, error: null});
    expect((await refreshConnectedEmailBlocks([savedBlock])).warnings[0]).toContain("confirm ticket availability");
  });
  it("rejects malformed editable blocks and tenant changes before mutation", async () => {
    expect(() => connectedEmailBlocks([{type: "image-text"}])).toThrow("could not be loaded");
    await expect(replaceConnectedEmailDraft("different", {campaign: {tenant_id: "original"}, refreshed: []} as never)).rejects.toThrow("business changed");
    expect(emailReviewMocks.rpc).not.toHaveBeenCalled();
  });
});

import React from "react";
import {cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {afterEach} from "vitest";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {ConnectedEmailReview as EmailReviewPanel} from "@/components/crm/campaign-editor/ConnectedEmailReview";
import * as emailReviewService from "./connectedEmailReview";
const reviewNavigate = vi.hoisted(() => vi.fn());
vi.mock("react-router-dom", () => ({useNavigate: () => reviewNavigate}));
describe("email review confirmation", () => {
  afterEach(() => {cleanup(); vi.restoreAllMocks();});
  function setupReview() {
    const review = {campaign: {id: "campaign", tenant_id: "tenant", updated_at: "2026-11-22", subject_line: "Subject", preheader_text: ""}, original: [savedBlock], refreshed: [refreshConnectedContentBlock(savedBlock, websiteItem)], warnings: [], replacementId: null} as emailReviewService.ConnectedEmailReview;
    const load = vi.spyOn(emailReviewService, "loadConnectedEmailReview").mockResolvedValue(review);
    const replace = vi.spyOn(emailReviewService, "replaceConnectedEmailDraft").mockResolvedValue("replacement");
    render(React.createElement(QueryClientProvider, {client: new QueryClient({defaultOptions: {queries: {retry: false}}})}, React.createElement(EmailReviewPanel, {tenantId: "tenant", campaignId: "campaign", reason: "Source title changed"})));
    return {load, replace};
  }
  it("loads only after review is opened and Cancel writes nothing", async () => {
    const {load, replace} = setupReview();
    expect(load).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", {name: "Review website changes"}));
    await screen.findByTitle("Refreshed draft");
    expect(screen.getByTitle("Saved newsletter")).toHaveAttribute("sandbox", "");
    fireEvent.click(screen.getByRole("button", {name: "Cancel"}));
    expect(replace).not.toHaveBeenCalled();
  });
  it("requires explicit confirmation and opens the returned draft", async () => {
    const {replace} = setupReview();
    fireEvent.click(screen.getByRole("button", {name: "Review website changes"}));
    await screen.findByTitle("Refreshed draft");
    expect(replace).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", {name: "Create reviewed draft"}));
    await waitFor(() => expect(reviewNavigate).toHaveBeenCalledWith("/crm/campaigns/replacement"));
    expect(replace).toHaveBeenCalledTimes(1);
  });
});

describe("email review delivery source precedence", () => {
  it("prefers authoritative block rows to stale metadata and retains wrapper identity", () => {
    const authoritative = {...savedBlock, headline: "Authoritative queued title", connectedContent: {...savedBlock.connectedContent!, updatedAt: "2026-11-22"}};
    const result = selectConnectedEmailReviewBlocks([{id: "database-row", content: authoritative, order: 2}], [savedBlock]);
    expect(result[0]).toMatchObject({id: "database-row", headline: "Authoritative queued title", order: 2, connectedContent: {updatedAt: "2026-11-22"}});
    expect(selectConnectedEmailReviewBlocks([], [savedBlock])[0]).toBe(savedBlock);
  });
});
