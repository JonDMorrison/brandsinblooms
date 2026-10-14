import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import {
  createTenantLinkCode,
  secureLinkCodeEqual,
  verifyTenantLinkCode,
} from "../../supabase/functions/_shared/pwaTenantLinkCode.ts";

const secret = "local-test-only-long-private-bridge-secret-do-not-deploy";
const site = "93000000-0000-4000-8000-000000000003";
const now = Date.UTC(2026, 9, 14, 20, 12);
const bucket = Math.floor(now / 600_000);

function nodeCode(value: string, point: number): string {
  // Independent reimplementation of BloomSites' node:crypto signer.
  return createHmac("sha256", secret)
    .update(`storefront-link-v1:${value.toLowerCase()}:${point}`)
    .digest("hex").slice(0, 24).toUpperCase();
}

describe("CMS and CRM storefront ownership challenge compatibility", () => {
  it("uses the same 96-bit HMAC code in Node and WebCrypto", async () => {
    const expected = nodeCode(site, bucket);
    expect(expected).toHaveLength(24);
    expect(await createTenantLinkCode(secret, site, bucket)).toBe(expected);
  });

  it("accepts the current and previous ten-minute bucket only", async () => {
    expect(await verifyTenantLinkCode(secret, site, nodeCode(site, bucket), now)).toBe(true);
    expect(await verifyTenantLinkCode(secret, site, nodeCode(site, bucket - 1), now)).toBe(true);
    expect(await verifyTenantLinkCode(secret, site, nodeCode(site, bucket - 2), now)).toBe(false);
    expect(await verifyTenantLinkCode(secret, site, nodeCode(site, bucket + 1), now)).toBe(false);
  });

  it("rejects another store and obviously invalid codes", async () => {
    expect(await verifyTenantLinkCode(secret, site, nodeCode(
      "93000000-0000-4000-8000-000000000004", bucket), now)).toBe(false);
    expect(secureLinkCodeEqual("000000000000", nodeCode(site, bucket))).toBe(false);
    expect(secureLinkCodeEqual("x".repeat(24), nodeCode(site, bucket))).toBe(false);
  });
});
