export type MtaReplyKeyword = "stop" | "start" | "help" | "reply";

export type MtaInboundReply = {
  providerReplyId: string;
  fromNumber: string;
  toNumber: string | null;
  externalId: string | null;
  message: string;
  mediaUrl: string | null;
  occurredAt: string;
  keyword: MtaReplyKeyword;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function cleanString(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const cleaned = String(value).trim();
  return cleaned.length > 0 ? cleaned : null;
}

export function unwrapMtaWebhookPayload(payload: unknown): Record<string, unknown> | null {
  const root = asRecord(payload);
  if (!root) return null;
  return asRecord(root.data) ?? root;
}

export function classifyMtaReplyKeyword(message: string): MtaReplyKeyword {
  const value = message.trim().toUpperCase();
  if (["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"].includes(value)) return "stop";
  if (["START", "YES", "UNSTOP", "RESUME"].includes(value)) return "start";
  if (["HELP", "INFO"].includes(value)) return "help";
  return "reply";
}

export function normalizeMtaInboundReply(payload: unknown): MtaInboundReply | null {
  const row = unwrapMtaWebhookPayload(payload);
  if (!row) return null;
  const providerReplyId = cleanString(row.replyId ?? row.messageId);
  const fromNumber = cleanString(row.fromNumber ?? row.originationNumber);
  const message = cleanString(row.message);
  if (!providerReplyId || !fromNumber || !message) return null;

  const rawTimestamp = cleanString(row.timestamp);
  const parsedTimestamp = rawTimestamp ? new Date(rawTimestamp) : new Date();
  const occurredAt = Number.isNaN(parsedTimestamp.getTime())
    ? new Date().toISOString()
    : parsedTimestamp.toISOString();

  return {
    providerReplyId,
    fromNumber,
    toNumber: cleanString(row.toNumber ?? row.destinationNumber),
    externalId: cleanString(row.externalId),
    message,
    mediaUrl: cleanString(row.url),
    occurredAt,
    keyword: classifyMtaReplyKeyword(message),
  };
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function deriveMtaWebhookSecret(apiKey: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-512",
    new TextEncoder().encode(`bloomsuite:mta-webhook:v1:${apiKey}`),
  );
  return bytesToHex(new Uint8Array(digest));
}

export async function signMtaWebhookBody(rawBody: Uint8Array, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, rawBody);
  return bytesToHex(new Uint8Array(signature));
}

export async function verifyMtaWebhookSignature(
  rawBody: Uint8Array,
  receivedSignature: string | null,
  secret: string,
): Promise<boolean> {
  if (!receivedSignature || !/^[0-9a-f]{64}$/.test(receivedSignature)) return false;
  const expected = await signMtaWebhookBody(rawBody, secret);
  let difference = expected.length ^ receivedSignature.length;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= expected.charCodeAt(index) ^ (receivedSignature.charCodeAt(index) || 0);
  }
  return difference === 0;
}
