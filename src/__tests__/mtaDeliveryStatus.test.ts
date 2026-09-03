import { describe, expect, it } from "vitest";
import {
  extractMtaDeliveryRows,
  normalizeMtaDelivery,
  normalizeMtaStatus,
} from "../../supabase/functions/_shared/mtaDeliveryStatus";

describe("Mobile Text Alerts delivery normalization", () => {
  it("normalizes documented delivery rows without retaining message content", () => {
    expect(normalizeMtaDelivery({
      messageId: 12345,
      externalId: "customer-7",
      status: "Undeliverable",
      date: "2026-09-03T12:00:00Z",
      carrier: "Example Carrier",
      to: "+15555550123",
      message: "private message body",
    })).toEqual({
      providerMessageId: "12345",
      externalId: "customer-7",
      status: "undeliverable",
      occurredAt: "2026-09-03T12:00:00.000Z",
      carrier: "Example Carrier",
      destination: "+15555550123",
    });
  });

  it("rejects rows without a provider message ID or status", () => {
    expect(normalizeMtaDelivery({ status: "delivered" })).toBeNull();
    expect(normalizeMtaDelivery({ messageId: "42" })).toBeNull();
  });

  it("normalizes provider status spelling and extracts only data.rows", () => {
    expect(normalizeMtaStatus("  Not-Delivered  ")).toBe("not_delivered");
    const rows = [{ messageId: 1, status: "sent" }];
    expect(extractMtaDeliveryRows({ data: { rows } })).toBe(rows);
    expect(extractMtaDeliveryRows({ rows })).toEqual([]);
  });
});
