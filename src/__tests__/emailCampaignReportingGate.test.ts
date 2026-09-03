import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizeEmailCampaignReportingSnapshot } from "@/hooks/analytics/useCampaignDerivedMetrics";

const migration = readFileSync(
  "supabase/migrations/20260903160000_email_reporting_unconfirmed_delivery.sql",
  "utf8",
);
const report = readFileSync("src/pages/crm/CRMCampaignReport.tsx", "utf8");
const engagement = readFileSync(
  "src/components/crm/campaigns/CampaignEngagementMetrics.tsx",
  "utf8",
);
const metricsHook = readFileSync(
  "src/hooks/analytics/useCampaignDerivedMetrics.ts",
  "utf8",
);

describe("email campaign reporting release gate", () => {
  it("aggregates uncapped message and event ledgers behind tenant authorization", () => {
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION public.get_email_campaign_reporting_snapshot",
    );
    expect(migration).toContain("FROM public.email_messages AS message");
    expect(migration).toContain("FROM public.email_tracking_events AS event");
    expect(migration).toContain("app_user.tenant_id = v_tenant_id");
    expect(migration).toContain("SECURITY DEFINER");
    expect(migration).toContain("SET search_path = ''");
    expect(migration).toContain("FROM PUBLIC, anon");
  });

  it("uses the server snapshot instead of capped browser event rows", () => {
    expect(report).toContain(
      'supabase.rpc("get_email_campaign_reporting_snapshot"',
    );
    expect(metricsHook).toContain(
      'supabase.rpc("get_email_campaign_reporting_snapshot"',
    );
    expect(report).not.toContain('.from("email_tracking_events")');
    expect(metricsHook).not.toContain('.from("email_tracking_events")');
    expect(report).not.toContain('["Failed", "0"]');
  });

  it("reports terminal failures, pending delivery, and machine-adjusted engagement", () => {
    expect(migration).toContain("'failed', totals.failed");
    expect(migration).toContain("'pending', totals.pending");
    expect(migration).toContain("'unconfirmed', totals.unconfirmed");
    expect(migration).toContain(
      "totals.pending = 0 AND totals.unconfirmed = 0",
    );
    expect(migration).toContain("'partial_send'");
    expect(migration).toContain("'delivery_complete'");
    expect(migration).toContain("event.is_mpp_guess");
    expect(migration).toContain("opened_non_mpp OR clicked");
    expect(report).toContain("Campaign delivery is not complete");
    expect(report).toContain("Campaign delivery is not fully confirmed");
    expect(report).toContain("Top failures:");
    expect(report).toContain("metrics.totals.failed.toString()");
    expect(report).toContain("adjustedUniqueOpens");
    expect(report).toContain("adjustedTotalOpens");
    expect(engagement).toContain("Clicks are more reliable");
    expect(engagement.indexOf('key: "clicked"')).toBeLessThan(
      engagement.indexOf('key: "opened"'),
    );
  });

  it("normalizes totals above the PostgREST row cap without losing diagnostics", () => {
    const snapshot = normalizeEmailCampaignReportingSnapshot({
      metrics: {
        totals: {
          recipients: "19013",
          sent: "19013",
          delivered: "16409",
          successful_reach: "16409",
          opens: "4000",
          total_opens: "26738",
          opens_non_mpp: "3500",
          total_opens_non_mpp: "21000",
          clicks: "3295",
          total_clicks: "6296",
          unique_engaged: "5200",
          bounces: "414",
          hard_bounces: "7",
          complaints: "5",
          unsubscribes: "21",
          failed: "12",
          skipped: "3",
          pending: "4",
          unconfirmed: "2161",
        },
        diagnostics: {
          partial_send: true,
          delivery_complete: false,
          source: "email_messages+email_tracking_events_uncapped",
        },
        computed_at: "2026-09-03T00:00:00Z",
      },
      timeline: [{ hour: "0", opens: "1500", clicks: "1200" }],
      failure_reasons: [{ reason: "Mailbox rejected", count: "12" }],
      sent_at: "2026-09-02T12:00:00Z",
      latest_event_at: "2026-09-03T12:00:00Z",
    });

    expect(snapshot?.metrics.totals.total_opens).toBe(26738);
    expect(snapshot?.metrics.totals.total_clicks).toBe(6296);
    expect(snapshot?.metrics.totals.failed).toBe(12);
    expect(snapshot?.metrics.totals.pending).toBe(4);
    expect(snapshot?.metrics.totals.unconfirmed).toBe(2161);
    expect(snapshot?.metrics.diagnostics.partial_send).toBe(true);
    expect(snapshot?.timeline).toEqual([
      { hour: 0, opens: 1500, clicks: 1200 },
    ]);
    expect(snapshot?.failureReasons).toEqual([
      { reason: "Mailbox rejected", count: 12 },
    ]);
  });
});
