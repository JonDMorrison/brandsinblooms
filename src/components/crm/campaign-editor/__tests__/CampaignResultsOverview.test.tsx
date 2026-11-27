import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CampaignResultsOverview } from "../CampaignResultsOverview";
import { resolveCampaignStats, type CampaignStats } from "@/lib/crm/campaignStats";
import { normalizeEmailCampaignReportingSnapshot } from "@/hooks/analytics/useCampaignDerivedMetrics";

const stats: CampaignStats = { recipients: 1803, sent: 1803, delivered: 1703, opens: 237, clicks: 179, deliveryRate: (1703 / 1803) * 100, openRate: 13.9, clickRate: 10.5, estimated: false };
const props = {name:"Bonus webinar",subject:"Free webinar",completedAt:"Oct 30",stats,bounced:43,failed:2,cloning:false,onReport:vi.fn(),onRecipients:vi.fn(),onDuplicate:vi.fn(),onRetry:vi.fn()};

// get_email_campaign_reporting_snapshot for Northfield "Mother's Day Hanging
// Baskets" (c0f48125), read-only from production 2026-11-27. crm_campaigns
// holds messages_sent 7,100 and total_sent 1,973; the snapshot says 1,973.
const motherDaySnapshot = {
  metrics: {
    rates: { click: 8.01, bounce: 0, delivery: 100, complaint: 0, click_to_open: 19.24, open_adjusted: 41.61, open_reported: 41.61 },
    scores: { reach: 100, interaction: 41.61 },
    totals: { sent: 1973, opens: 821, clicks: 158, failed: 0, bounces: 0, pending: 0, skipped: 0, delivered: 1973, complaints: 0, recipients: 1973, sent_events: 1973, total_opens: 821, unconfirmed: 0, hard_bounces: 0, total_clicks: 158, unsubscribes: 0, opens_non_mpp: 821, unique_engaged: 821, successful_reach: 1973, observed_recipients: 1973, total_opens_non_mpp: 821 },
    estimated: true,
    computed_at: "2026-11-27T18:14:33.744554+00:00",
    diagnostics: { source: "crm_campaigns_rollup", estimated: true, partial_send: false, delivery_complete: true, missing_send_ledger: true, unconfirmed_delivery: 0 },
  },
  timeline: [],
  failure_reasons: [],
  sent_at: "2026-11-16T11:17:00.15478+00:00",
  latest_event_at: null,
};

afterEach(cleanup);
describe("CampaignResultsOverview", () => {
  it("separates sends, confirmed delivery, and list issues without an alarming global error", () => {
    render(<CampaignResultsOverview {...props} />);
    expect(screen.getByText("1,803 emails sent.")).toBeVisible();
    expect(screen.getByText("1,703")).toBeVisible();
    expect(screen.getByText("94.5% of sent emails")).toBeVisible();
    expect(screen.getByText(/2 emails could not be sent/)).toHaveTextContent("43 sent emails bounced");
    expect(screen.queryByText("Campaign Sent with Errors")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:"Review retry options"}));
    expect(props.onRetry).toHaveBeenCalledOnce();
  });
  it("keeps missing reporting data unknown instead of displaying zero or assuming delivery", () => {
    render(<CampaignResultsOverview {...props} stats={null} />);
    expect(screen.getAllByText("—")).toHaveLength(4);
    expect(screen.getAllByText("Updating as results arrive")).toHaveLength(3);
    expect(screen.queryByText(/emails sent\./)).not.toBeInTheDocument();
  });
  it("avoids a success claim when no emails were sent and links the full report", () => {
    render(<CampaignResultsOverview {...props} stats={{ ...stats, sent: 0, delivered: 0, deliveryRate: 0 }} />);
    expect(screen.queryByText("Your campaign is out in the world.")).not.toBeInTheDocument();
    expect(screen.getByText("0.0% of sent emails")).toBeVisible();
    fireEvent.click(screen.getByRole("button",{name:"Explore full report"}));
    expect(props.onReport).toHaveBeenCalledOnce();
  });
  it("shows the same sent, delivered, opens and clicks as the list, report and dashboard for one campaign", () => {
    // Campaigns list (useEmailCampaignStats) resolves the raw RPC result.
    const list = resolveCampaignStats(motherDaySnapshot);
    // Report, dashboard cards and Reports > Overview (useCampaignDeliveryMetrics)
    // and the sent view (useCampaignDerivedMetrics) read the normalized snapshot.
    const normalized = normalizeEmailCampaignReportingSnapshot(motherDaySnapshot);
    const shared = resolveCampaignStats(normalized?.metrics);
    expect(shared).toEqual(list);
    expect(normalized?.metrics.totals.sent).toBe(list?.sent);
    expect(normalized?.metrics.totals.delivered).toBe(list?.delivered);

    render(<CampaignResultsOverview {...props} bounced={0} failed={0} stats={shared} />);
    expect(screen.getByText("1,973 emails sent.")).toBeVisible();
    expect(screen.queryByText(/7,100/)).not.toBeInTheDocument();
    expect(screen.getAllByText("1,973")).toHaveLength(2);
    expect(screen.getByText("100.0% of sent emails")).toBeVisible();
    expect(screen.getByText("821")).toBeVisible();
    expect(screen.getByText("158")).toBeVisible();
    expect(screen.getByText("41.6% reported open rate")).toBeVisible();
    expect(screen.getByText("8.0% click-through rate")).toBeVisible();
    expect(screen.getByTestId("campaign-results-estimated")).toBeVisible();
  });
});
