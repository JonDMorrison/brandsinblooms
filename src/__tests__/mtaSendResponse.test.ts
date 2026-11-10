import { describe, expect, it } from "vitest";
import {
  extractMtaRecipientValidation,
  extractMtaSendAcceptance,
  toMtaRequestId,
} from "../../supabase/functions/_shared/mtaSendResponse";

describe("Mobile Text Alerts send response parsing", () => {
  it("extracts the documented nested send response", () => {
    expect(extractMtaSendAcceptance({
      success: true,
      data: {
        messageId: "98765",
        totalSent: 1,
        totalFailedInternationalRecipients: 0,
        outboundIds: [101],
      },
    })).toEqual({
      messageId: "98765",
      totalSent: 1,
      totalFailedInternationalRecipients: 0,
      outboundIds: ["101"],
    });
  });

  it("never treats undocumented top-level or arbitrary IDs as a provider message ID", () => {
    expect(extractMtaSendAcceptance({ messageId: "wrong", id: "also-wrong" }).messageId).toBeNull();
    expect(extractMtaSendAcceptance({ data: { id: "wrong" } }).messageId).toBeNull();
  });

  it("parses documented recipient validation failures and opt-outs", () => {
    const result = extractMtaRecipientValidation({
      data: {
        validRecipients: [{ number: "+15555550100" }],
        invalidRecipients: [
          { number: "+15555550101", error: "Subscriber is unsubscribed" },
        ],
      },
    });

    expect(result.validRecipients).toHaveLength(1);
    expect(result.invalidRecipients).toEqual([
      { recipient: "+15555550101", error: "Subscriber is unsubscribed" },
    ]);
    expect(result.hasUnsubscribedRecipient).toBe(true);
  });

  it("creates provider-safe deterministic request IDs", () => {
    expect(toMtaRequestId("1b4f-60d2_ABC")).toBe("bloomsuite1b4f60d2ABC");
    expect(() => toMtaRequestId("---")).toThrow("non-empty external ID");
  });
});
