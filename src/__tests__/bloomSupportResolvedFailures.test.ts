import { describe, expect, it } from "vitest";
import { verifiedHistoricalNotificationFailure } from "@/components/bloomSupport/desk/resolvedFailures";

const failed = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: "744640f3-fd15-4015-91dc-16c31296a38b",
  status: "dead",
  kind: "notify",
  lane: "slack:platform",
  created_at: "2026-11-08T20:00:00.186Z",
  last_error: "Slack did not return a valid message timestamp",
  ...overrides,
});

const received = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: "f29a26e0-4f24-4a57-9abe-5a984fbc3b7d",
  kind: "notify",
  status: "succeeded",
  lane: "slack:platform",
  created_at: "2026-11-09T14:35:02.748Z",
  result: { note: "delivered to tickets (Slack ts: 1794234902.930069)" },
  ...overrides,
});

describe("Bloom Support safe notification clearing", () => {
  it("allows old timestamp failures only after the same route has a newer valid receipt", () => {
    expect(verifiedHistoricalNotificationFailure(failed(), [received()])).toBe(true);
    expect(verifiedHistoricalNotificationFailure(failed(), [received({ lane: "slack:finance" })])).toBe(false);
    expect(verifiedHistoricalNotificationFailure(failed(), [received({ created_at: "2026-11-08T19:00:00Z" })])).toBe(false);
    expect(verifiedHistoricalNotificationFailure(failed(), [received({ result: { note: "sent" } })])).toBe(false);
  });

  it("allows the historical unavailable feature summary when the same feature lane later worked", () => {
    const oldFeature = failed({
      lane: "slack:ask:features:U06VD9ZGA4U",
      created_at: "2026-11-08T04:52:04.956Z",
      last_error: "Feature summary is temporarily unavailable",
    });
    const laterFeature = received({
      lane: "slack:ask:features:U06VD9ZGA4U",
      created_at: "2026-11-08T05:01:29.910Z",
      result: { note: "delivered to features (Slack ts: 1794111241.670089)" },
    });
    expect(verifiedHistoricalNotificationFailure(oldFeature, [laterFeature])).toBe(true);
    expect(verifiedHistoricalNotificationFailure(oldFeature, [received()])).toBe(false);
  });

  it("fails closed for newer incidents, failed or live work, unknown errors and malformed evidence", () => {
    const success = [received({ created_at: "2026-11-09T16:00:00Z" })];
    expect(verifiedHistoricalNotificationFailure(failed({ created_at: "2026-11-09T15:00:00Z" }), success)).toBe(false);
    expect(verifiedHistoricalNotificationFailure(failed({ status: "failed" }), success)).toBe(false);
    expect(verifiedHistoricalNotificationFailure(failed({ kind: "repair" }), success)).toBe(false);
    expect(verifiedHistoricalNotificationFailure(failed({ last_error: "Slack timed out" }), success)).toBe(false);
    expect(verifiedHistoricalNotificationFailure(failed({ created_at: "not-a-date" }), success)).toBe(false);
    expect(verifiedHistoricalNotificationFailure(failed(), [{ ...received(), result: null }])).toBe(false);
    expect(verifiedHistoricalNotificationFailure(failed(), [])).toBe(false);
  });
});
