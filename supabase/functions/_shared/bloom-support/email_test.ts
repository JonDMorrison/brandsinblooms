import { assertEquals } from "@std/assert";
import { emailConfig, retryableLedgerFailure, retryableProviderStatus, safeSuppressionReason, supportEmailHeaders } from "./email.ts";

Deno.test("dedicated sending identity keeps the public BloomSuite reply address", () => {
  const names = ["RESEND_API_KEY", "BLOOM_SUPPORT_INBOX", "BLOOM_SUPPORT_PUBLIC_INBOX", "BLOOM_SUPPORT_FROM"];
  const original = new Map(names.map((name) => [name, Deno.env.get(name)]));
  try {
    Deno.env.set("RESEND_API_KEY", "re_test");
    Deno.env.set("BLOOM_SUPPORT_INBOX", "bloom@support.bloomsuite.app");
    Deno.env.delete("BLOOM_SUPPORT_PUBLIC_INBOX");
    Deno.env.delete("BLOOM_SUPPORT_FROM");
    const config = emailConfig();
    assertEquals(config.sendingAddress, "bloom@support.bloomsuite.app");
    assertEquals(config.publicAddress, "bloom@bloomsuite.app");
    assertEquals(config.from, "Bloom Support <bloom@support.bloomsuite.app>");
    assertEquals(config.replyDomain, "support.bloomsuite.app");
    assertEquals(config.configured, true);
  } finally {
    for (const [name, value] of original) {
      if (value === undefined) Deno.env.delete(name);
      else Deno.env.set(name, value);
    }
  }
});

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
