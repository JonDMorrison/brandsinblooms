import {
  buildIntegrationDetailModel,
  truncateIntegrationError,
} from "@/components/integrations/integrationDetailModel";
import { getIntegrationSeed } from "@/components/integrations/integrationsHubConfig";

describe("integration detail model helpers", () => {
  it("truncates long provider errors for one-line display", () => {
    const truncated = truncateIntegrationError(
      "Webhook delivery failed because the upstream provider responded with a timeout and the retry queue is now waiting for the next delivery window.",
      60,
    );

    expect(truncated).not.toBeNull();
    expect(truncated?.isTruncated).toBe(true);
    expect(truncated?.shortMessage.endsWith("…")).toBe(true);
  });

  it("builds a connected model with webhook attention and disconnect eligibility", () => {
    const seed = getIntegrationSeed("square");
    expect(seed).not.toBeNull();

    const item = {
      ...seed!,
      status: "connected" as const,
      metaLabel: "Main Street Flowers",
    };

    const model = buildIntegrationDetailModel({
      item,
      status: "connected",
      contextLabel: item.metaLabel,
      connectedAt: "2026-03-20T10:00:00.000Z",
      lastSyncAt: "2026-03-22T10:00:00.000Z",
      lastActivityAt: "2026-03-22T12:00:00.000Z",
      lastWebhookReceivedAt: "2026-03-22T11:00:00.000Z",
      hasWebhookMonitoring: true,
      webhooksSubscribed: false,
      webhookRetryCount: 2,
      webhookNextRetryAt: "2026-03-22T12:30:00.000Z",
      lastError: "Webhook token expired while BloomSuite was acknowledging the provider event.",
      syncSummary: "Customers 42 • Products 12 • Sales 105",
      serviceStateLabel: "connected",
      canDisconnect: true,
    });

    expect(model.statusLabel).toBe("Connected");
    expect(model.canDisconnect).toBe(true);
    expect(model.timeline[0]?.label).toBe("Connected");
    expect(model.webhookRows.some((row) => row.label === "Last error")).toBe(true);
    expect(model.syncRows.find((row) => row.label === "Records")?.value).toContain("Customers 42");
  });

  it("builds a coming-soon model with a roadmap placeholder timeline", () => {
    const seed = getIntegrationSeed("shopify");
    expect(seed).not.toBeNull();

    const model = buildIntegrationDetailModel({
      item: {
        ...seed!,
        status: "coming-soon",
      },
      status: "coming-soon",
    });

    expect(model.statusLabel).toBe("Upcoming");
    expect(model.timeline[0]?.label).toBe("Planned for a future release");
    expect(model.canDisconnect).toBe(false);
  });
});