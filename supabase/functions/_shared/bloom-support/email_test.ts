import { assertEquals } from "@std/assert";
import { safeSuppressionReason, supportEmailHeaders } from "./email.ts";

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
