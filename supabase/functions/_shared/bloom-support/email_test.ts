import { assertEquals } from "@std/assert";
import { safeSuppressionReason } from "./email.ts";

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
