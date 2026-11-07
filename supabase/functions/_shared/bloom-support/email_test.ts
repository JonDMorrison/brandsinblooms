import { assertEquals } from "@std/assert";
import { retryableLedgerFailure, retryableProviderStatus, safeSuppressionReason, supportEmailHeaders } from "./email.ts";

Deno.test("suppressed email reports the real controlled cause", () => {
  assertEquals(safeSuppressionReason("recipient bounced or complained"), "recipient bounced or complained");
  assertEquals(safeSuppressionReason("ticket under human control"), "ticket under human control");
  assertEquals(safeSuppressionReason("client_email_enabled is off"), "client_email_enabled is off");
  assertEquals(
    safeSuppressionReason("recipient or CC not in BLOOM_SUPPORT_EMAIL_ALLOWLIST"),
    "recipient or CC not in BLOOM_SUPPORT_EMAIL_ALLOWLIST",
  );
  assertEquals(safeSuppressionReason("resend 500: secret upstream detail"), "delivery suppressed");
});

Deno.test("automatic replies are marked while human-authored replies are not", () => {
  const automatic = supportEmailHeaders({
    messageId: "<automatic@support.bloomsuite.app>",
    threadRoot: "<ticket@support.bloomsuite.app>",
  });
  assertEquals(automatic["Auto-Submitted"], "auto-replied");
  assertEquals(automatic["In-Reply-To"], "<ticket@support.bloomsuite.app>");

  const human = supportEmailHeaders({
    messageId: "<human@support.bloomsuite.app>",
    humanAuthored: true,
    inReplyTo: "<client@example.test>",
  });
  assertEquals(human["Auto-Submitted"], undefined);
  assertEquals(human["In-Reply-To"], "<client@example.test>");
  assertEquals(human.References, "<client@example.test>");
});

Deno.test("only ambiguous, rate-limited, and server failures retry", () => {
  assertEquals(retryableProviderStatus(429), true);
  assertEquals(retryableProviderStatus(500), true);
  assertEquals(retryableProviderStatus(503), true);
  for (const status of [400, 401, 403, 404, 409, 422]) {
    assertEquals(retryableProviderStatus(status), false);
  }

  assertEquals(retryableLedgerFailure("uncertain", "outcome unknown"), true);
  assertEquals(retryableLedgerFailure("not_configured", "missing key"), true);
  assertEquals(retryableLedgerFailure("failed", "retryable resend 429: limited"), true);
  assertEquals(retryableLedgerFailure("failed", "resend 503: unavailable"), true);
  assertEquals(retryableLedgerFailure("failed", "terminal resend 422: invalid"), false);
  assertEquals(retryableLedgerFailure("failed", "arbitrary old failure"), false);
  assertEquals(retryableLedgerFailure("suppressed", "recipient bounced"), false);
});
