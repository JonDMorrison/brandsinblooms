// Web Crypto helpers (Deno and Node 20+ compatible, no globals beyond crypto).

const enc = new TextEncoder();

export function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(input: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", enc.encode(input)));
}

export async function hmacSha256(secret: string | Uint8Array, message: string): Promise<Uint8Array> {
  const keyBytes = typeof secret === "string" ? enc.encode(secret) : secret;
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(message)));
}

export function timingSafeEqual(a: string, b: string): boolean {
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

export function randomToken(bytes = 24): string {
  const b = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function b64encode(b: Uint8Array): string {
  return btoa(String.fromCharCode(...b));
}

/**
 * Product intake signature: hex HMAC-SHA256 over `${timestamp}.${body}` with a
 * per-product secret. Rejects timestamps more than 5 minutes off.
 */
export async function signIntake(secret: string, timestamp: number, body: string): Promise<string> {
  return toHex((await hmacSha256(secret, `${timestamp}.${body}`)).buffer as ArrayBuffer);
}

export async function verifyIntakeSignature(secret: string, timestampHeader: string | null, signature: string | null, body: string, now = Date.now()): Promise<boolean> {
  if (!secret || !timestampHeader || !signature) return false;
  const ts = Number(timestampHeader);
  if (!Number.isFinite(ts) || Math.abs(now / 1000 - ts) > 300) return false;
  const expected = await signIntake(secret, ts, body);
  return timingSafeEqual(expected, signature.replace(/^sha256=/, ""));
}

/**
 * Svix (Resend webhooks) verification: base64 HMAC over `${id}.${timestamp}.${body}`
 * using the whsec_ secret; header holds space-separated `v1,<sig>` entries.
 */
export async function verifySvix(secret: string, id: string | null, timestamp: string | null, signatureHeader: string | null, body: string, now = Date.now()): Promise<boolean> {
  if (!secret || !id || !timestamp || !signatureHeader) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(now / 1000 - ts) > 300) return false;
  const key = b64decode(secret.replace(/^whsec_/, ""));
  const expected = b64encode(await hmacSha256(key, `${id}.${timestamp}.${body}`));
  return signatureHeader.split(" ").some((part) => {
    const [version, sig] = part.split(",");
    return version === "v1" && !!sig && timingSafeEqual(sig, expected);
  });
}

/** GitHub webhook X-Hub-Signature-256 verification. */
export async function verifyGithubSignature(secret: string, signatureHeader: string | null, body: string): Promise<boolean> {
  if (!secret || !signatureHeader?.startsWith("sha256=")) return false;
  const expected = toHex((await hmacSha256(secret, body)).buffer as ArrayBuffer);
  return timingSafeEqual(expected, signatureHeader.slice(7));
}
