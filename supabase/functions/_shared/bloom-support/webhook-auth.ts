// Strict Slack/GitHub webhook verification, with no dependence on model output.
const encoder = new TextEncoder();
const hex = (bytes: Uint8Array): string => Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");

async function signHex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  return hex(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(data))));
}
function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}
export async function verifyGithubWebhook(
  raw: string, signature: string | null, secret: string | undefined
): Promise<boolean> {
  if (!secret || secret.length < 20 || !signature || !/^sha256=[a-fA-F0-9]{64}$/.test(signature)) return false;
  const expected = "sha256=" + await signHex(secret, raw);
  return constantTimeEquals(expected, signature.toLowerCase());
}
export async function verifySlackWebhook(
  raw: string, timestamp: string | null, signature: string | null,
  secret: string | undefined, nowSeconds = Math.floor(Date.now() / 1000)
): Promise<boolean> {
  if (!secret || secret.length < 20 || !timestamp || !/^\d{10}$/.test(timestamp) ||
      !signature || !/^v0=[a-fA-F0-9]{64}$/.test(signature)) return false;
  if (Math.abs(nowSeconds - Number(timestamp)) > 300) return false;
  const expected = "v0=" + await signHex(secret, `v0:${timestamp}:${raw}`);
  return constantTimeEquals(expected, signature.toLowerCase());
}
