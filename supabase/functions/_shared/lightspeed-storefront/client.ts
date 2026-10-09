/**
 * Read-only Lightspeed Retail X-Series transport. OAuth and sync both use the
 * same bounded HTTP implementation; bearer tokens never enter URLs or errors.
 *
 * The legacy API 2.0 product codec is deliberately pinned. Do not substitute
 * the new 2026-10 family/member endpoints without a separate tested decoder.
 */
import {
  asSourceRecord, LightspeedShapeError, sourceId, versionCursor,
  type SourceRecord,
} from "./normalize.ts";

export const LIGHTSPEED_READ_SCOPES = [
  "products:read", "inventory:read", "outlets:read", "retailer:read",
] as const;
export const LIGHTSPEED_AUTHORIZATION_ORIGIN = "https://secure.retail.lightspeed.app";
const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 20_000;
const PREFIX = /^[a-z0-9](?:[a-z0-9-]{1,48})[a-z0-9]$/;
export type LightspeedResource = "products" | "inventory" | "outlets";
export type LightspeedErrorCode =
  | "unauthorized" | "insufficient_scope" | "rate_limited" | "upstream_unavailable"
  | "request_failed" | "invalid_response" | "response_too_large" | "request_timeout";

export class LightspeedApiError extends Error {
  constructor(
    readonly code: LightspeedErrorCode,
    readonly status: number | null = null,
    readonly retryAfterMs: number | null = null,
  ) {
    // Never append an upstream response: it can contain credentials or customer data.
    super(`Lightspeed request could not be completed (${code}).`);
    this.name = "LightspeedApiError";
  }
}

export function normalizeStorePrefix(value: unknown): string {
  if (typeof value !== "string") throw new LightspeedShapeError("store_prefix");
  const prefix = value.trim().toLowerCase();
  if (!PREFIX.test(prefix)) throw new LightspeedShapeError("store_prefix");
  return prefix;
}

export function lightspeedStoreOrigin(prefix: string): string {
  return `https://${normalizeStorePrefix(prefix)}.retail.lightspeed.app`;
}

export function parseRetryAfter(value: string | null, now = Date.now()): number | null {
  if (!value) return null;
  const seconds = /^\d+$/.test(value.trim()) ? Number(value.trim()) : null;
  const milliseconds = seconds === null ? Date.parse(value) - now : seconds * 1_000;
  return Number.isFinite(milliseconds) && milliseconds >= 0
    ? Math.min(milliseconds, 24 * 60 * 60 * 1_000) : null;
}

/** Bounds even chunked responses; content-length alone is not a size limit. */
export async function readLightspeedJson(response: Response): Promise<unknown> {
  const length = Number(response.headers.get("content-length"));
  if (Number.isFinite(length) && length > MAX_RESPONSE_BYTES) {
    await response.body?.cancel();
    throw new LightspeedApiError("response_too_large");
  }
  if (!response.headers.get("content-type")?.toLowerCase().includes("json")) {
    await response.body?.cancel();
    throw new LightspeedApiError("invalid_response");
  }
  if (!response.body) throw new LightspeedApiError("invalid_response");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      total += chunk.value.byteLength;
      if (total > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new LightspeedApiError("response_too_large");
      }
      chunks.push(chunk.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { throw new LightspeedApiError("invalid_response"); }
}

function responseError(response: Response): LightspeedApiError {
  if (response.status === 401) return new LightspeedApiError("unauthorized", 401);
  if (response.status === 403) return new LightspeedApiError("insufficient_scope", 403);
  if (response.status === 429) return new LightspeedApiError("rate_limited", 429,
    parseRetryAfter(response.headers.get("retry-after")) ?? 60_000);
  if (response.status >= 500) return new LightspeedApiError("upstream_unavailable", response.status, 30_000);
  return new LightspeedApiError("request_failed", response.status);
}

/** No retries here: the durable worker owns retry budgets and refresh leases. */
export async function lightspeedRequest(
  fetcher: typeof fetch,
  url: URL,
  init: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(url, { ...init, redirect: "error", cache: "no-store", signal: controller.signal });
    if (!response.ok) {
      const failure = responseError(response);
      await response.body?.cancel();
      throw failure;
    }
    return await readLightspeedJson(response);
  } catch (error) {
    if (error instanceof LightspeedApiError) throw error;
    throw new LightspeedApiError(controller.signal.aborted ? "request_timeout" : "request_failed");
  } finally { clearTimeout(timeout); }
}

export interface LightspeedSourcePage {
  records: SourceRecord[];
  nextCursor: string | null;
  complete: boolean;
}

/** Shared decoder for direct vendor reads and the credential-free CRM bridge. */
export function parseLightspeedSourcePage(value: unknown, after: string | null): LightspeedSourcePage {
  const cursor = versionCursor(after);
  const envelope = asSourceRecord(value);
  if (!envelope || !Array.isArray(envelope.data)) throw new LightspeedShapeError("page");
  if (envelope.data.length > 5_000) throw new LightspeedShapeError("page_size");
  const records = envelope.data.map(asSourceRecord);
  if (records.some(r => !r)) throw new LightspeedShapeError("page_record");
  // A short page is not proof that the catalogue ended; only an empty page is.
  if (records.length === 0) return { records: [], nextCursor: cursor, complete: true };
  const version = asSourceRecord(envelope.version);
  const next = versionCursor(version?.max);
  if (next === null || BigInt(next) <= BigInt(cursor ?? "0")) {
    throw new LightspeedShapeError("non_advancing_cursor");
  }
  return { records: records as SourceRecord[], nextCursor: next, complete: false };
}

export class LightspeedReadClient {
  readonly origin: string;
  constructor(
    prefix: string,
    private readonly accessToken: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {
    this.origin = lightspeedStoreOrigin(prefix);
    if (!accessToken || /[\r\n]/.test(accessToken)) throw new LightspeedShapeError("access_token");
  }

  private async get(path: string, query?: Record<string, string>): Promise<unknown> {
    const url = new URL(path, this.origin);
    if (url.origin !== this.origin) throw new LightspeedShapeError("request_origin");
    for (const [key, value] of Object.entries(query ?? {})) url.searchParams.set(key, value);
    return lightspeedRequest(this.fetcher, url, {
      method: "GET", headers: { Accept: "application/json", Authorization: `Bearer ${this.accessToken}` },
    });
  }

  async retailer(): Promise<SourceRecord> {
    const envelope = asSourceRecord(await this.get("/api/2.0/retailer"));
    const data = asSourceRecord(envelope?.data);
    if (!data || !sourceId(data.id)) throw new LightspeedShapeError("retailer");
    return data;
  }

  async page(resource: LightspeedResource, after: string | null): Promise<LightspeedSourcePage> {
    // Runtime allow-list, not merely a TypeScript assertion.
    if (!["products", "inventory", "outlets"].includes(resource)) {
      throw new LightspeedShapeError("resource");
    }
    const cursor = versionCursor(after);
    const query: Record<string, string> = { page_size: "200" };
    if (cursor !== null) query.after = cursor;
    return parseLightspeedSourcePage(await this.get(`/api/2.0/${resource}`, query), cursor);
  }
}

export interface LightspeedTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  domainPrefix: string;
  scopes: string[];
}

export function buildLightspeedAuthorizationUrl(input: {
  clientId: string; redirectUri: string; state: string;
}): string {
  const callback = new URL(input.redirectUri);
  if (callback.protocol !== "https:" || callback.username || callback.password ||
      callback.hash || callback.search || !input.clientId || !/^[A-Za-z0-9_-]{32,128}$/.test(input.state)) {
    throw new LightspeedShapeError("oauth_configuration");
  }
  const url = new URL("/connect", LIGHTSPEED_AUTHORIZATION_ORIGIN);
  url.search = new URLSearchParams({ response_type: "code", client_id: input.clientId,
    redirect_uri: callback.toString(), scope: LIGHTSPEED_READ_SCOPES.join(" "), state: input.state }).toString();
  return url.toString();
}

/** Exchanges are not retried: authorization codes and rotating refresh tokens are single-use. */
export async function exchangeLightspeedToken(input: {
  prefix: string; clientId: string; clientSecret: string; redirectUri: string;
  grant: { kind: "authorization_code"; code: string } | { kind: "refresh_token"; token: string };
  fetcher?: typeof fetch; now?: number;
}): Promise<LightspeedTokenResponse> {
  const prefix = normalizeStorePrefix(input.prefix);
  const now = input.now ?? Date.now();
  if (!input.clientId || !input.clientSecret || !Number.isFinite(now)) {
    throw new LightspeedShapeError("oauth_configuration");
  }
  const payload = new URLSearchParams({ grant_type: input.grant.kind,
    client_id: input.clientId, client_secret: input.clientSecret });
  if (input.grant.kind === "authorization_code") {
    payload.set("code", input.grant.code); payload.set("redirect_uri", input.redirectUri);
  } else { payload.set("refresh_token", input.grant.token); }
  const raw = asSourceRecord(await lightspeedRequest(input.fetcher ?? fetch,
    new URL("/api/1.0/token", lightspeedStoreOrigin(prefix)), {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: payload.toString(),
    }));
  const tokenPrefix = raw?.domain_prefix == null ? prefix : normalizeStorePrefix(raw.domain_prefix);
  const token = typeof raw?.access_token === "string" ? raw.access_token : "";
  const refresh = typeof raw?.refresh_token === "string" ? raw.refresh_token : "";
  const expires = typeof raw?.expires === "number" ? raw.expires * 1_000
    : typeof raw?.expires_in === "number" ? now + raw.expires_in * 1_000 : NaN;
  const scopes = typeof raw?.scope === "string" ? raw.scope.split(/\s+/).filter(Boolean) : [];
  if (!token || !refresh || /[\r\n]/.test(token + refresh) || tokenPrefix !== prefix ||
      !Number.isFinite(expires) || expires <= now || expires > now + 370 * 24 * 60 * 60 * 1_000 ||
      (raw?.token_type != null && String(raw.token_type).toLowerCase() !== "bearer")) {
    throw new LightspeedShapeError("oauth_token_response");
  }
  return { accessToken: token, refreshToken: refresh, domainPrefix: prefix,
    scopes, expiresAt: new Date(expires).toISOString() };
}
