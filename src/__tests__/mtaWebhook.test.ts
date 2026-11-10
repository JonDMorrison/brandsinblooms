import { describe, expect, it } from "vitest";
import {
  classifyMtaReplyKeyword,
  deriveMtaWebhookSecret,
  normalizeMtaInboundReply,
  signMtaWebhookBody,
  verifyMtaWebhookSignature,
} from "../../supabase/functions/_shared/mtaWebhook";

describe("Mobile Text Alerts webhook security and parsing", () => {
  it("verifies HMAC-SHA256 over the exact raw bytes", async () => {
    const body = new TextEncoder().encode("The quick brown fox jumps over the lazy dog");
    const signature = await signMtaWebhookBody(body, "key");
    expect(signature).toBe("f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8");
    await expect(verifyMtaWebhookSignature(body, signature, "key")).resolves.toBe(true);
    await expect(verifyMtaWebhookSignature(new TextEncoder().encode("tampered"), signature, "key")).resolves.toBe(false);
    await expect(verifyMtaWebhookSignature(body, null, "key")).resolves.toBe(false);
  });

  it("derives a deterministic isolated 128-character registration secret", async () => {
    const first = await deriveMtaWebhookSecret("provider-api-key");
    const second = await deriveMtaWebhookSecret("provider-api-key");
    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{128}$/);
    expect(first).not.toContain("provider-api-key");
  });

  it("normalizes documented v3 reply payloads", () => {
    expect(normalizeMtaInboundReply({
      fromNumber: "+15555550123",
      toNumber: "+15555550999",
      replyId: "reply-1",
      externalId: "outbound-1",
      message: " STOP ",
      timestamp: "2026-09-03T12:30:00Z",
    })).toEqual({
      providerReplyId: "reply-1",
      fromNumber: "+15555550123",
      toNumber: "+15555550999",
      externalId: "outbound-1",
      message: "STOP",
      mediaUrl: null,
      occurredAt: "2026-09-03T12:30:00.000Z",
      keyword: "stop",
    });
  });

  it("supports the documented envelope used in signature examples", () => {
    expect(normalizeMtaInboundReply({
      event: "message-reply",
      data: {
        fromNumber: "+15555550123",
        replyId: "reply-2",
        message: "Can you help?",
        timestamp: "2026-09-03T12:30:00Z",
      },
    })?.keyword).toBe("reply");
  });

  it("classifies compliance keywords only when the entire message matches", () => {
    expect(classifyMtaReplyKeyword("unsubscribe")).toBe("stop");
    expect(classifyMtaReplyKeyword("UNSTOP")).toBe("start");
    expect(classifyMtaReplyKeyword("help")).toBe("help");
    expect(classifyMtaReplyKeyword("Please stop watering reminders next week")).toBe("reply");
  });
});
