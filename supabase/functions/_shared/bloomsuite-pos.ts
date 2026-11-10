export type PosBridgeBinding = {
  keyId: string;
  posTenantId: string;
  crmTenantId: string;
  posConnectionId: string;
  secret: string;
};

export type PosBridgeDeps = {
  binding(key: string): Promise<PosBridgeBinding | null>;
  apply(key: string, envelope: unknown): Promise<unknown>;
  now?: () => number;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

const safeEqual = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

export async function signBloomSuitePos(secret: string, timestamp: string, body: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return hex(new Uint8Array(await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(timestamp + "." + body),
  )));
}

export function bloomSuitePosReceiver(deps: PosBridgeDeps) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
    const keyId = request.headers.get("x-bloom-key-id") ?? "";
    if (!keyId || keyId.length > 100) return json({ error: "Unknown connection" }, 401);

    let binding: PosBridgeBinding | null;
    try { binding = await deps.binding(keyId); }
    catch { return json({ error: "Connection temporarily unavailable" }, 503); }
    if (!binding || binding.keyId !== keyId || binding.secret.length < 32) {
      return json({ error: "Unknown connection" }, 401);
    }

    const timestamp = request.headers.get("x-bloom-timestamp") ?? "";
    if (!/^\d{10,13}$/.test(timestamp)) return json({ error: "Invalid signature" }, 401);
    const epoch = Number(timestamp);
    const now = Math.floor((deps.now?.() ?? Date.now()) / 1000);
    if (!Number.isSafeInteger(epoch) || Math.abs(now - epoch) > 300) {
      return json({ error: "Invalid signature" }, 401);
    }

    const reader = request.body?.getReader();
    if (!reader) return json({ error: "Body required" }, 400);
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        bytes += part.value.length;
        if (bytes > 65536) {
          await reader.cancel();
          return json({ error: "Event too large" }, 413);
        }
        chunks.push(part.value);
      }
    } finally {
      reader.releaseLock();
    }

    const raw = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) { raw.set(chunk, offset); offset += chunk.length; }
    let body: string;
    try { body = new TextDecoder("utf-8", { fatal: true }).decode(raw); }
    catch { return json({ error: "Invalid body" }, 400); }

    const expected = await signBloomSuitePos(binding.secret, timestamp, body);
    const supplied = (request.headers.get("x-bloom-signature") ?? "").toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(supplied) || !safeEqual(expected, supplied)) {
      return json({ error: "Invalid signature" }, 401);
    }

    let envelope: unknown;
    try { envelope = JSON.parse(body); }
    catch { return json({ error: "Invalid event" }, 400); }

    try {
      const result = await deps.apply(keyId, envelope);
      return json(result);
    } catch {
      return json({ error: "Event conflicts or mapping needs review" }, 409);
    }
  };
}
