import { describe, expect, it } from "vitest";
import { percentOf, resolveCampaignCompletedAt, resolveCampaignStats } from "./campaignStats";
import { normalizeEmailCampaignReportingSnapshot } from "@/hooks/analytics/useCampaignDerivedMetrics";

// get_email_campaign_reporting_snapshot output from production, 2026-11-24.
// Northfield "Mother's Day Hanging Baskets" (c0f48125): no send records, so the
// snapshot falls back to the stored crm_campaigns rollup.
const estimatedSnapshot = {
  metrics: {
    rates: { click: 8.01, bounce: 0, delivery: 100, complaint: 0, click_to_open: 19.24, open_adjusted: 41.61, open_reported: 41.61 },
    scores: { reach: 100, interaction: 41.61 },
    totals: { sent: 1973, opens: 821, clicks: 158, failed: 0, bounces: 0, pending: 0, skipped: 0, delivered: 1973, complaints: 0, recipients: 1973, sent_events: 1973, total_opens: 821, unconfirmed: 0, hard_bounces: 0, total_clicks: 158, unsubscribes: 0, opens_non_mpp: 821, unique_engaged: 821, successful_reach: 1973, observed_recipients: 1973, total_opens_non_mpp: 821 },
    estimated: true,
    computed_at: "2026-11-24T16:40:25.495124+00:00",
    diagnostics: { source: "crm_campaigns_rollup", estimated: true, partial_send: false, delivery_complete: true, missing_send_ledger: true, unconfirmed_delivery: 0 },
  },
  timeline: [],
  failure_reasons: [],
  sent_at: "2026-11-13T16:28:52.489352+00:00",
  latest_event_at: null,
};

// A real sent campaign with send records ("Christmas Workshop Teaser").
const recordedSnapshot = {
  metrics: {
    rates: { click: 0.08, bounce: 0.93, delivery: 99.26, complaint: 0, click_to_open: 0.18, open_adjusted: 44.68, open_reported: 44.68 },
    scores: { reach: 99.26, interaction: 44.72 },
    totals: { sent: 2568, opens: 1139, clicks: 2, failed: 0, bounces: 24, pending: 0, skipped: 0, delivered: 2549, complaints: 0, recipients: 2568, sent_events: 2568, total_opens: 1139, unconfirmed: 0, hard_bounces: 0, total_clicks: 7, unsubscribes: 0, opens_non_mpp: 1139, unique_engaged: 1140, successful_reach: 2549, observed_recipients: 2568, total_opens_non_mpp: 1139 },
    estimated: false,
    computed_at: "2026-11-24T16:37:24.65735+00:00",
    diagnostics: { source: "email_messages+email_tracking_events_uncapped", partial_send: false, delivery_complete: true, missing_send_ledger: false, unconfirmed_delivery: 0 },
  },
  timeline: [],
  failure_reasons: [],
  sent_at: "2026-11-17T21:41:49.516+00:00",
  latest_event_at: null,
};

describe("resolveCampaignStats (one rollup for every campaign surface)", () => {
  it("labels the stored-rollup fallback as estimated", () => {
    expect(resolveCampaignStats(estimatedSnapshot)).toEqual({
      recipients: 1973, sent: 1973, delivered: 1973, opens: 821, clicks: 158,
      deliveryRate: 100, openRate: 41.61, clickRate: 8.01, estimated: true,
    });
  });

  it("reads recorded sends as-is", () => {
    const stats = resolveCampaignStats(recordedSnapshot);
    expect(stats).toEqual({
      recipients: 2568, sent: 2568, delivered: 2549, opens: 1139, clicks: 2,
      deliveryRate: expect.any(Number), openRate: 44.68, clickRate: 0.08, estimated: false,
    });
    // The delivery rate is computed from the two counts it is shown with.
    expect(stats?.deliveryRate).toBeCloseTo((2549 / 2568) * 100, 10);
  });

  it.each([
    ["estimated", estimatedSnapshot],
    ["recorded", recordedSnapshot],
  ])("gives the list, report and dashboard the same numbers (%s)", (_label, raw) => {
    // List (useEmailCampaignStats) reads the raw RPC result; the report and
    // the dashboard / Reports > Overview read the normalized snapshot.
    const list = resolveCampaignStats(raw);
    const normalized = normalizeEmailCampaignReportingSnapshot(raw);
    expect(normalized).not.toBeNull();
    const report = resolveCampaignStats(normalized?.metrics);
    expect(report).toEqual(list);
    expect(normalized?.metrics.estimated).toBe(list?.estimated);
  });

  it("computes percentages from the counts and guards a zero denominator", () => {
    expect(percentOf(1973, 1973)).toBe(100);
    expect(percentOf(5, 0)).toBe(0);
    expect(percentOf(5, -1)).toBe(0);
    const empty = resolveCampaignStats({ metrics: { totals: { sent: 0, delivered: 0 } } });
    expect(empty?.deliveryRate).toBe(0);
  });

  it("dates completion by send_completed_at, then sent_at", () => {
    expect(resolveCampaignCompletedAt({ sendCompletedAt: "2026-11-16T11:17:00Z", sentAt: "2026-11-16T11:00:00Z" })).toBe("2026-11-16T11:17:00Z");
    expect(resolveCampaignCompletedAt({ sendCompletedAt: null, sentAt: "2026-11-16T11:17:00Z" })).toBe("2026-11-16T11:17:00Z");
    expect(resolveCampaignCompletedAt({ sendCompletedAt: null, sentAt: null })).toBeNull();
  });

  it("returns null for a value that is not a snapshot", () => {
    expect(resolveCampaignStats(null)).toBeNull();
    expect(resolveCampaignStats({ metrics: {} })).toBeNull();
  });
});
