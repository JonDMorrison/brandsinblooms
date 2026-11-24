import { describe, expect, it } from "vitest";
import { compareShownDates, normalizeChannelFilter, normalizeFilter } from "../CRMCampaignsPage";
import type { CampaignCatalogItem } from "@/lib/crm/campaignEditor";

describe("Mike at Arts campaign catalog preferences", () => {
  it("defaults to drafts without a URL status", () => {
    expect(normalizeFilter(null)).toBe("draft");
    expect(normalizeFilter("unrecognized")).toBe("draft");
  });

  it("allows explicitly selecting all campaigns, including sent", () => {
    expect(normalizeFilter("all")).toBe("all");
    expect(normalizeFilter("sent")).toBe("sent");
    expect(normalizeFilter("scheduled")).toBe("scheduled");
  });

  it("does not apply a campaign type filter unless selected", () => {
    expect(normalizeChannelFilter(null)).toBe("all");
    expect(normalizeChannelFilter("bad")).toBe("all");
    expect(normalizeChannelFilter("email")).toBe("email");
    // Newsletter and Email are one type; old links still work.
    expect(normalizeChannelFilter("newsletter")).toBe("email");
    expect(normalizeChannelFilter("sms")).toBe("sms");
  });
});

describe("Date column sort (qa4 #4)", () => {
  // Northfield's Sent tab: updated_at is the seed date, while the shown
  // date is sent_at. The column must follow the shown date.
  const row = (id: string, status: string, dates: Partial<CampaignCatalogItem>) =>
    ({ id, status, updatedAt: "2026-04-13T18:58:48Z", createdAt: "2026-04-13T18:58:48Z", sentAt: null, scheduledAt: null, ...dates }) as CampaignCatalogItem;
  const sent = [
    row("patio", "sent", { sentAt: "2026-10-22T16:51:14Z", updatedAt: "2026-05-04T18:58:48Z" }),
    row("mothers-day", "sent", { sentAt: "2026-11-13T16:51:14Z", updatedAt: "2026-04-13T18:58:48Z" }),
    row("perennial", "sent", { sentAt: "2026-11-02T16:51:14Z", updatedAt: "2026-05-02T18:58:48Z" }),
  ];

  it("sorts the Sent tab by sent date, newest first by default", () => {
    expect([...sent].sort((a, b) => compareShownDates(a, b, "desc")).map((c) => c.id))
      .toEqual(["mothers-day", "perennial", "patio"]);
    expect([...sent].sort((a, b) => compareShownDates(a, b, "asc")).map((c) => c.id))
      .toEqual(["patio", "perennial", "mothers-day"]);
  });

  it("sorts the Scheduled tab by scheduled date and keeps undated rows last", () => {
    const scheduled = [
      row("later", "scheduled", { scheduledAt: "2026-12-20T15:00:00Z", updatedAt: "2026-11-01T00:00:00Z" }),
      row("sooner", "scheduled", { scheduledAt: "2026-12-01T15:00:00Z", updatedAt: "2026-11-20T00:00:00Z" }),
      row("undated", "scheduled", { updatedAt: "2026-11-24T00:00:00Z" }),
    ];
    expect([...scheduled].sort((a, b) => compareShownDates(a, b, "asc")).map((c) => c.id))
      .toEqual(["sooner", "later", "undated"]);
    expect([...scheduled].sort((a, b) => compareShownDates(a, b, "desc")).map((c) => c.id))
      .toEqual(["later", "sooner", "undated"]);
  });
});
