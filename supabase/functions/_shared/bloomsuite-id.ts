/**
 * BloomSuite ID server-to-server calls (central login). The CRM and BloomSuite ID share one secret
 * (BLOOMSUITE_APP_SECRET here, APP_SECRET_CRM on BloomSuite ID). A call carries X-BloomSuite-App,
 * X-BloomSuite-Timestamp (Unix seconds) and X-BloomSuite-Signature: "v1=" + hex HMAC-SHA256(secret,
 * timestamp + "." + raw body). Same contract as the POS (bloomtill `_shared/bloomsuite.ts`).
 */
export const BLOOMSUITE_APP_ID = "crm";
export const BLOOMSUITE_PROVIDER = "custom:bloomsuite";

const encoder = new TextEncoder();

function appSecret(): string {
  const value = Deno.env.get("BLOOMSUITE_APP_SECRET") ?? "";
  if (encoder.encode(value).byteLength < 32) {
    throw new Error("BloomSuite signing secret unavailable");
  }
  return value;
}

async function hmacHex(key: string, message: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** Headers for a signed call from the CRM to BloomSuite ID. */
export async function bloomsuiteSignedHeaders(body: string, now = Date.now()): Promise<Record<string, string>> {
  const timestamp = String(Math.floor(now / 1000));
  return {
    "Content-Type": "application/json",
    "X-BloomSuite-App": BLOOMSUITE_APP_ID,
    "X-BloomSuite-Timestamp": timestamp,
    "X-BloomSuite-Signature": `v1=${await hmacHex(appSecret(), `${timestamp}.${body}`)}`,
  };
}

/** True only for a call signed with the shared secret, for this app, within 300 seconds. */
export async function verifyBloomsuiteRequest(headers: Headers, body: string, now = Date.now()): Promise<boolean> {
  const timestamp = headers.get("X-BloomSuite-Timestamp") ?? "";
  const signature = headers.get("X-BloomSuite-Signature") ?? "";
  if (
    headers.get("X-BloomSuite-App") !== BLOOMSUITE_APP_ID ||
    !/^\d{10}$/.test(timestamp) ||
    Math.abs(now / 1000 - Number(timestamp)) > 300 ||
    !/^v1=[0-9a-f]{64}$/.test(signature)
  ) {
    return false;
  }
  let expected: string;
  try {
    expected = `v1=${await hmacHex(appSecret(), `${timestamp}.${body}`)}`;
  } catch {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

/**
 * The request body as text, read only up to maxBytes; null when it is larger (or says it is), so an
 * oversized body is never buffered.
 */
export async function readCappedBody(req: Request, maxBytes: number): Promise<string | null> {
  const declared = Number(req.headers.get("Content-Length") ?? "");
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    all.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(all);
}

/** A short, human device label from a user agent ("Chrome on Windows"), at most 120 characters. */
export function deviceLabel(userAgent: string): string {
  const ua = userAgent || "";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Firefox\//.test(ua)
    ? "Firefox"
    : /Chrome\//.test(ua)
    ? "Chrome"
    : /Safari\//.test(ua)
    ? "Safari"
    : "Browser";
  const os = /iPad/.test(ua)
    ? "iPad"
    : /iPhone/.test(ua)
    ? "iPhone"
    : /Android/.test(ua)
    ? "Android"
    : /Windows/.test(ua)
    ? "Windows"
    : /Mac OS X|Macintosh/.test(ua)
    ? "macOS"
    : /CrOS/.test(ua)
    ? "ChromeOS"
    : /Linux/.test(ua)
    ? "Linux"
    : "unknown device";
  return `${browser} on ${os}`.slice(0, 120);
}
