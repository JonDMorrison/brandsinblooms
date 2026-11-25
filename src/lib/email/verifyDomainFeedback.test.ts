import { describe, expect, it } from "vitest";
import {
  feedbackFromVerifyError,
  feedbackFromVerifyReply,
  readFunctionErrorBody,
} from "./verifyDomainFeedback";

describe("verify domain feedback", () => {
  it("reports success only when every check passes", () => {
    expect(feedbackFromVerifyReply({ ok: true }).verified).toBe(true);
    expect(
      feedbackFromVerifyReply({ ok: false, status: "active", readiness: { status: "ACTION_REQUIRED_AUTHENTICATION" }, provider: { dmarc_verified: false } }),
    ).toMatchObject({ verified: false, tone: "warning", message: expect.stringContaining("DMARC") });
  });

  it("uses the readiness message when DNS is still missing", () => {
    const feedback = feedbackFromVerifyReply({
      ok: false,
      readiness: { status: "ACTION_REQUIRED_DNS_MISSING", message: "DNS records not visible yet.", subMessage: "Please check your DNS configuration." },
    });
    expect(feedback.message).toBe("DNS records not visible yet. Please check your DNS configuration.");
  });

  it("turns a 429 into a polite wait message", () => {
    const feedback = feedbackFromVerifyError(429, { error: "rate_limited", retry_after_seconds: 21 }, "x");
    expect(feedback).toMatchObject({ tone: "info", rateLimited: true, retryAfterSeconds: 21 });
    expect(feedback.message).toContain("21 seconds");
  });

  it("reads the JSON body of a functions error response", async () => {
    const error = { context: new Response(JSON.stringify({ message: "Domain not found" }), { status: 404 }) };
    const { status, body } = await readFunctionErrorBody(error);
    expect(status).toBe(404);
    expect(feedbackFromVerifyError(status, body, "fallback").message).toBe("Domain not found");
  });
});
