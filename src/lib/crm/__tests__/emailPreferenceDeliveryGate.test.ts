import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("email preference delivery release gate", () => {
  it("renders opaque preference links instead of forgeable identity tokens", () => {
    const renderer = source("supabase/functions/_shared/emailRenderer.ts");
    const links = source("supabase/functions/_shared/emailPreferenceLinks.ts");

    expect(renderer).toContain("resolveEmailPreferenceLinks");
    expect(renderer).not.toContain("btoa(`${customer.email}:${tenantId}`)");
    expect(renderer).not.toContain('"manage-preferences"');
    expect(links).toContain('purpose", "manage_preferences"');
    expect(links).toContain("crypto.randomUUID()");
  });

  it("adds RFC 8058 headers to bulk and transactional sends", () => {
    const queue = source(
      "supabase/functions/process-email-send-queue/index.ts",
    );
    const transactional = source(
      "supabase/functions/send-transactional-email/index.ts",
    );

    for (const implementation of [queue, transactional]) {
      expect(implementation).toContain('"List-Unsubscribe"');
      expect(implementation).toContain('"List-Unsubscribe-Post"');
      expect(implementation).toContain("List-Unsubscribe=One-Click");
    }
  });

  it("uses an atomic token-backed unsubscribe RPC", () => {
    const handler = source("supabase/functions/handle-unsubscribe/index.ts");
    const migration = source(
      "supabase/migrations/20260903073000_secure_email_unsubscribe.sql",
    );

    expect(handler).toContain("unsubscribe_customer_by_preference_token");
    expect(migration).toContain("FOR UPDATE");
    expect(migration).toContain("crm_email_consent_events");
    expect(migration).toContain("suppression_list");
  });

  it("keeps legacy delivered links working without issuing new ones", () => {
    const handler = source("supabase/functions/handle-unsubscribe/index.ts");
    const renderer = source("supabase/functions/_shared/emailRenderer.ts");

    expect(handler).toContain("Legacy compatibility");
    expect(renderer).not.toContain("email}:${tenantId}");
  });
});
