import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const email = readFileSync("supabase/functions/_shared/bloom-support/email.ts", "utf8");
const readiness = readFileSync("supabase/functions/_shared/bloom-support/readiness.ts", "utf8");
const configure = readFileSync("scripts/bloom-support/configure-email.mjs", "utf8");
const constants = readFileSync("src/lib/bloomSupport/constants.ts", "utf8");

describe("Bloom Support public email identity", () => {
  it("keeps the verified sending domain but uses the root alias for replies", () => {
    expect(email).toContain('env("BLOOM_SUPPORT_INBOX")');
    expect(email).toContain('env("BLOOM_SUPPORT_PUBLIC_INBOX") ?? "bloom@bloomsuite.app"');
    expect(email).toContain("reply_to: cfg.publicAddress");
    expect(configure).toContain("{ name: 'BLOOM_SUPPORT_INBOX', value: 'bloom@support.bloomsuite.app' }");
    expect(configure).toContain("{ name: 'BLOOM_SUPPORT_PUBLIC_INBOX', value: 'bloom@bloomsuite.app' }");
  });

  it("publishes one memorable support address and reports both identities in readiness", () => {
    expect(constants).toContain('SUPPORT_EMAIL = "bloom@bloomsuite.app"');
    expect(readiness).toContain("mail.sendingAddress");
    expect(readiness).toContain("mail.publicAddress");
  });
});
