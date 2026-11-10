/**
 * Short-lived cross-project tenant ownership proof.
 * The shared secret is stored only in server environments.
 * This module has no Deno runtime side effects and is unit-testable under Node.
 */
const encoder = new TextEncoder();
const TEN_MINUTES_MS = 10 * 60_000;

export async function createTenantLinkCode(
  secret: string, siteId: string, bucket: number,
): Promise<string> {
  if (secret.length < 32 || !/^[0-9a-f-]{36}$/i.test(siteId) ||
      !Number.isSafeInteger(bucket) || bucket < 0) {
    throw Error("Invalid site proof inputs");
  }
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const data = encoder.encode(
    "storefront-link-v1:" + siteId.toLowerCase() + ":" + bucket,
  );
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, data));
  return Array.from(bytes.slice(0, 12), byte => byte.toString(16).padStart(2, "0"))
    .join("").toUpperCase();
}

export function secureLinkCodeEqual(received: string, expected: string): boolean {
  if (!/^[0-9A-F]{24}$/.test(received) || received.length !== expected.length) return false;
  let mismatch = 0;
  for (let index = 0; index < expected.length; index++) {
    mismatch |= received.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return mismatch === 0;
}

export async function verifyTenantLinkCode(
  secret: string, siteId: string, received: string, nowMillis = Date.now(),
): Promise<boolean> {
  const bucket = Math.floor(nowMillis / TEN_MINUTES_MS);
  const candidate = received.toUpperCase();
  const current = await createTenantLinkCode(secret, siteId, bucket);
  const previous = await createTenantLinkCode(secret, siteId, bucket - 1);
  return secureLinkCodeEqual(candidate, current) ||
    secureLinkCodeEqual(candidate, previous);
}
