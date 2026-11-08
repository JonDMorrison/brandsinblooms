// Bloom Support — Edge runtime: database gateway, caller authentication, HTTP helpers.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { sha256Hex, verifyIntakeSignature } from "./crypto.ts";

export const env = (k: string): string | undefined => {
  const v = Deno.env.get(k);
  return v && v.trim() !== "" ? v.trim() : undefined;
};

let admin: SupabaseClient | null = null;
/** Server-only client. Never returned to a caller; used to reach the allow-listed gateway. */
export function db(): SupabaseClient {
  if (!admin) {
    const url = env("SUPABASE_URL");
    const key = env("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) throw new BloomError(500, "not_configured", "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing");
    admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return admin;
}

export class BloomError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

/** Maps Postgres error codes raised by bloom_support functions to HTTP. */
function mapDbError(e: { code?: string; message?: string }): BloomError {
  const msg = e.message ?? "database error";
  switch (e.code) {
    case "42501": return new BloomError(403, "forbidden", msg);
    case "P0002": return new BloomError(404, "not_found", msg);
    case "22023": case "22P02": return new BloomError(400, "invalid", msg);
    case "40001": case "23505": return new BloomError(409, "conflict", msg);
    case "54000": return new BloomError(429, "rate_limited", msg);
    case "28000": return new BloomError(401, "unauthenticated", msg);
    default: return new BloomError(500, "db_error", msg);
  }
}

export async function rpc<T = unknown>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await db().rpc("bloom_support_rpc", { p_fn: fn, p: args });
  if (error) throw mapDbError(error);
  return data as T;
}

/** Exactly-once continuation of a signed CMS/POS support request by number. */
export async function productClientAction<T = unknown>(args: {
  actor: string;
  product: "cms" | "pos";
  account: string;
  ticketNumber: number;
  action: "still_needs_help" | "confirm_resolved";
  message: string;
  idempotencyKey: string;
  fingerprint: string;
}): Promise<T> {
  const { data, error } = await db().rpc("bloom_support_product_client_action", {
    p_actor: args.actor,
    p_product: args.product,
    p_account: args.account,
    p_ticket_number: args.ticketNumber,
    p_action: args.action,
    p_message: args.message,
    p_idempotency_key: args.idempotencyKey,
    p_fingerprint: args.fingerprint,
  });
  if (error) throw mapDbError(error);
  return data as T;
}

export interface McpMutationContext {
  /** Opaque SHA-256 key for one authenticated MCP mutation request. */
  requestKey: string;
  /** Tool and argument hash are persisted beside the key to detect misuse. */
  tool: string;
  argumentsHash: string;
}

/**
 * Runs an MCP mutation and its idempotency receipt in one database transaction.
 * Non-MCP callers keep using the ordinary allow-listed gateway.
 */
export async function mutationRpc<T = unknown>(
  caller: Caller,
  fn: string,
  args: Record<string, unknown>,
): Promise<T> {
  if (!caller.mcpMutation) return await rpc<T>(fn, args);
  const { data, error } = await db().rpc("bloom_support_mcp_mutation", {
    p_actor: caller.principalId,
    p_fn: fn,
    p: args,
    p_request_key: caller.mcpMutation.requestKey,
    p_tool: caller.mcpMutation.tool,
    p_arguments_hash: caller.mcpMutation.argumentsHash,
  });
  if (error) throw mapDbError(error);
  return data as T;
}

export async function claimMcpOperation<T = unknown>(
  caller: Caller,
  operationId: string,
  action: "execute" | "undo",
): Promise<T> {
  if (!caller.mcpMutation) {
    if (action === "execute") return await rpc<T>("claim_operation", { actor: caller.principalId, operation_id: operationId });
    const { data, error } = await db().rpc("bloom_support_claim_operation_undo", { p_actor: caller.principalId, p_operation: operationId });
    if (error) throw mapDbError(error);
    return data as T;
  }
  const { data, error } = await db().rpc("bloom_support_mcp_claim_operation", {
    p_actor: caller.principalId,
    p_operation: operationId,
    p_action: action,
    p_request_key: caller.mcpMutation.requestKey,
    p_tool: caller.mcpMutation.tool,
    p_arguments_hash: caller.mcpMutation.argumentsHash,
  });
  if (error) throw mapDbError(error);
  return data as T;
}

export async function completeMcpOperation(
  caller: Caller,
  operationId: string,
  result: Record<string, unknown>,
): Promise<void> {
  if (!caller.mcpMutation) return;
  const { error } = await db().rpc("bloom_support_mcp_complete_operation", {
    p_actor: caller.principalId,
    p_operation: operationId,
    p_request_key: caller.mcpMutation.requestKey,
    p_tool: caller.mcpMutation.tool,
    p_arguments_hash: caller.mcpMutation.argumentsHash,
    p_result: result,
  });
  if (error) throw mapDbError(error);
}

export async function failOperationUndo<T = unknown>(actor: string, operationId: string, errorMessage: string): Promise<T> {
  const { data, error } = await db().rpc("bloom_support_fail_operation_undo", {
    p_actor: actor,
    p_operation: operationId,
    p_error: errorMessage,
  });
  if (error) throw mapDbError(error);
  return data as T;
}

export async function markOperationReconciliation<T = unknown>(
  actor: string,
  operationId: string,
  action: "execute" | "undo",
): Promise<T> {
  const { data, error } = await db().rpc("bloom_support_mark_operation_reconciliation", {
    p_actor: actor,
    p_operation: operationId,
    p_action: action,
  });
  if (error) throw mapDbError(error);
  return data as T;
}

export async function openMcpSession(actor: string, session: string): Promise<void> {
  const { error } = await db().rpc("bloom_support_mcp_open_session", { p_actor: actor, p_session: session });
  if (error) throw mapDbError(error);
}

export async function touchMcpSession(actor: string, session: string): Promise<boolean> {
  const { data, error } = await db().rpc("bloom_support_mcp_touch_session", { p_actor: actor, p_session: session });
  if (error) throw mapDbError(error);
  return data === true;
}

export async function closeMcpSession(actor: string, session: string): Promise<void> {
  const { error } = await db().rpc("bloom_support_mcp_close_session", { p_actor: actor, p_session: session });
  if (error) throw mapDbError(error);
}

/** A service-role-only public function that authorizes p_actor itself (not routed through the gateway). */
export async function directRpc<T = unknown>(fn: "bloom_chat_spend_overview" | "bloom_chat_spend_set_cap" | "bloom_support_claim_feature_shipment_email" | "bloom_support_client_suite_read" | "bloom_support_confirm_attachment" | "bloom_support_consume_email_usage" | "bloom_support_deliver_feature_shipment" | "bloom_support_digest_report" | "bloom_support_enqueue_engineering_recoveries" | "bloom_support_mark_feature_shipment_in_product_only" | "bloom_support_slack_feature_summary", args: Record<string, unknown>): Promise<T> {
  const { data, error } = await db().rpc(fn, args);
  if (error) throw mapDbError(error);
  return data as T;
}

// ---------------------------------------------------------------------------
// Callers
// ---------------------------------------------------------------------------
export interface Caller {
  principalId: string;
  role: string;
  via: "crm_session" | "api_key" | "product_intake" | "service" | "public";
  name?: string | null;
  /** API-key scope narrowing (empty = full principal authority). */
  scopes: string[];
  /** Present only while an authenticated MCP write tool is running. */
  mcpMutation?: McpMutationContext;
}

export const SERVICE_IDENTITIES = ["intake", "operations", "automation", "investigation", "release"] as const;
export type ServiceIdentity = typeof SERVICE_IDENTITIES[number];

/**
 * Resolves the Bloom principal for a request:
 * - `Authorization: Bearer bsk_…`  → hashed API key (ChatGPT/MCP users, service identities)
 * - `Authorization: Bearer <CRM JWT>` → BloomSuite CRM session; tenant derived server-side
 */
export function authenticate(req: Request): Promise<Caller> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token) return Promise.reject(new BloomError(401, "unauthenticated", "Sign in or provide an API key"));
  if (token.startsWith("bsk_")) return authenticateApiKey(token);
  return authenticateCrmSession(token);
}

export async function authenticateApiKey(token: string): Promise<Caller> {
  const found = await rpc<null | { principal_id: string; role: string; scopes: string[]; name: string }>("authenticate_api_key", { hash: await sha256Hex(token) });
  if (!found) throw new BloomError(401, "unauthenticated", "API key is invalid, expired or revoked");
  return { principalId: found.principal_id, role: found.role, via: "api_key", name: found.name, scopes: found.scopes ?? [] };
}

async function authenticateCrmSession(jwt: string): Promise<Caller> {
  const { data, error } = await db().auth.getUser(jwt);
  if (error || !data?.user) throw new BloomError(401, "unauthenticated", "Session expired — sign in again");
  const user = data.user;
  // Tenant is derived from the CRM's own users table, never from the request.
  const { data: profile } = await db().from("users").select("tenant_id, full_name").eq("id", user.id).maybeSingle();
  let tenantName: string | null = null;
  if (profile?.tenant_id) {
    const { data: t } = await db().from("tenants").select("name").eq("id", profile.tenant_id).maybeSingle();
    tenantName = t?.name ?? null;
  }
  const principalId = await rpc<string>("resolve_crm_user", {
    auth_user_id: user.id,
    email: user.email,
    name: profile?.full_name ?? user.user_metadata?.full_name ?? user.email,
    tenant_id: profile?.tenant_id ?? null,
    tenant_name: tenantName,
  });
  // Platform admins on the CRM allowlist are bootstrapped as Bloom platform administrators once.
  const who = await rpc<{ role: string; name: string }>("whoami", { actor: principalId });
  if (who.role === "client") {
    const { data: isAdmin } = await db().rpc("is_master_admin", { _user_id: user.id });
    if (isAdmin === true) {
      await db().rpc("bloom_support_bootstrap_admin", { p_principal: principalId }).then(() => undefined, () => undefined);
      const again = await rpc<{ role: string }>("whoami", { actor: principalId });
      return { principalId, role: again.role, via: "crm_session", name: who.name, scopes: [] };
    }
  }
  return { principalId, role: who.role, via: "crm_session", name: who.name, scopes: [] };
}

/** Service identities use dedicated keys configured as secrets (one per scope). */
export async function authenticateService(req: Request, identity: ServiceIdentity): Promise<Caller> {
  const caller = await authenticate(req);
  if (caller.role !== "service") throw new BloomError(403, "forbidden", `Requires the ${identity} service identity`);
  return caller;
}

/**
 * Bloom's own service identity for server code running inside these Edge
 * Functions. Resolved in the database (one principal per scope, created on
 * first use); no shared administrator credential and no key to configure.
 * External callers (e.g. the GitHub repair workflow) use an API key for the
 * same identity instead.
 */
const serviceCache = new Map<ServiceIdentity, Caller>();
export async function servicePrincipal(identity: ServiceIdentity): Promise<Caller> {
  const cached = serviceCache.get(identity);
  if (cached) return cached;
  const id = await rpc<string>("ensure_service_principal", { scope: identity });
  const caller: Caller = { principalId: id, role: "service", via: "service", name: `Bloom ${identity}`, scopes: [] };
  serviceCache.set(identity, caller);
  return caller;
}

export interface ProductIdentity {
  product: "cms" | "pos";
  external_user_id: string;
  email?: string | null;
  name?: string | null;
  external_account_id?: string | null;
  account_name?: string | null;
}

/** Reject obviously unauthenticated product traffic before buffering its body. */
export function preflightProductAuthentication(
  req: Request,
): { product: "cms" | "pos"; secret: string } {
  const product = req.headers.get("x-bloom-product");
  if (product !== "cms" && product !== "pos") {
    throw new BloomError(401, "unauthenticated", "Unknown product");
  }
  const secret = env(`BLOOM_INTAKE_SECRET_${product.toUpperCase()}`);
  if (!secret) {
    throw new BloomError(
      503,
      "not_configured",
      `BLOOM_INTAKE_SECRET_${product.toUpperCase()} is not set`,
    );
  }
  const timestamp = req.headers.get("x-bloom-timestamp");
  const signature = req.headers.get("x-bloom-signature") ?? "";
  const seconds = Number(timestamp);
  if (
    !timestamp ||
    !Number.isFinite(seconds) ||
    Math.abs(Date.now() / 1000 - seconds) > 300 ||
    !/^(?:sha256=)?[0-9a-f]{64}$/i.test(signature)
  ) {
    throw new BloomError(401, "unauthenticated", "Invalid product signature");
  }
  return { product, secret };
}

/**
 * Signed product intake: the BloomSites or POS server authenticated the person
 * and derived their site/tenant, then signs the request body with its own
 * per-product secret. Bloom trusts the identity only when the signature checks.
 */
export async function authenticateProduct(req: Request, rawBody: string): Promise<{ product: "cms" | "pos"; payload: Record<string, unknown> }> {
  const { product, secret } = preflightProductAuthentication(req);
  const ok = await verifyIntakeSignature(secret, req.headers.get("x-bloom-timestamp"), req.headers.get("x-bloom-signature"), rawBody);
  if (!ok) throw new BloomError(401, "unauthenticated", "Invalid product signature");
  const payload = parseJsonObject(rawBody);
  return { product, payload };
}

export async function principalForProductUser(identity: ProductIdentity): Promise<{ principal_id: string; account_id: string | null }> {
  if (!identity?.external_user_id) throw new BloomError(400, "invalid", "identity.external_user_id required");
  return await rpc("resolve_product_user", { ...identity });
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------
const ALLOWED_ORIGINS = (env("BLOOM_SUPPORT_ALLOWED_ORIGINS") ??
  "https://bloomsuite.app,https://www.bloomsuite.app,http://localhost:5173,http://localhost:3000").split(",").map((s) => s.trim());

export function cors(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allow = ALLOWED_ORIGINS.includes(origin) || /^https:\/\/[a-z0-9-]+\.(bloomsuite\.app|vercel\.app|brandsinblooms\.com)$/.test(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-bloom-product, x-bloom-timestamp, x-bloom-signature, mcp-session-id, mcp-protocol-version",
    "Access-Control-Expose-Headers": "Mcp-Session-Id",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    Vary: "Origin",
  };
}

export function json(req: Request, body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors(req), ...extra } });
}

export function errorResponse(req: Request, e: unknown): Response {
  if (e instanceof BloomError) return json(req, { error: e.code, message: e.message }, e.status);
  console.error("bloom-support unhandled", e);
  return json(req, { error: "internal", message: "Unexpected error" }, 500);
}

async function readBoundedBytes(
  body: ReadableStream<Uint8Array> | null,
  declared: string | null,
  limitBytes: number,
  tooLargeMessage: string,
): Promise<Uint8Array> {
  if (declared && /^\d+$/.test(declared) && Number(declared) > limitBytes) {
    throw new BloomError(413, "too_large", tooLargeMessage);
  }
  if (!body) return new Uint8Array();

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limitBytes) {
      await reader.cancel().catch(() => undefined);
      throw new BloomError(413, "too_large", tooLargeMessage);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

async function readBoundedText(
  body: ReadableStream<Uint8Array> | null,
  declared: string | null,
  limitBytes: number,
): Promise<string> {
  const bytes = await readBoundedBytes(
    body,
    declared,
    limitBytes,
    "Request too large",
  );
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new BloomError(400, "invalid", "Body must be valid UTF-8");
  }
}

/** Read a request body with a real UTF-8 byte ceiling, including chunked bodies. */
export async function readBodyText(req: Request, limitBytes = 1_000_000): Promise<string> {
  return await readBoundedText(
    req.body,
    req.headers.get("content-length"),
    limitBytes,
  );
}

/** Apply the same allocation bound to an upstream response body. */
export async function readResponseText(
  response: Response,
  limitBytes = 1_000_000,
): Promise<string> {
  return await readBoundedText(
    response.body,
    response.headers.get("content-length"),
    limitBytes,
  );
}

/** Read an upstream response without trusting Content-Length or buffering past the cap. */
export async function readResponseBytes(
  response: Response,
  limitBytes: number,
): Promise<Uint8Array> {
  return await readBoundedBytes(
    response.body,
    response.headers.get("content-length"),
    limitBytes,
    "Upstream response too large",
  );
}

export async function readJson(req: Request, limitBytes = 1_000_000): Promise<Record<string, unknown>> {
  const text = await readBodyText(req, limitBytes);
  if (!text) return {};
  return parseJsonObject(text);
}

export function parseJsonObject(text: string): Record<string, unknown> {
  try {
    const v = JSON.parse(text);
    if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error();
    return v;
  } catch {
    throw new BloomError(400, "invalid", "Body must be a JSON object");
  }
}

export function str(v: unknown, max = 20000): string | undefined {
  return typeof v === "string" ? v.slice(0, max) : undefined;
}

export function requireString(v: unknown, name: string, max = 20000): string {
  const s = str(v, max);
  if (!s || !s.trim()) throw new BloomError(400, "invalid", `${name} is required`);
  return s;
}

export function uuid(v: unknown, name: string): string {
  if (typeof v !== "string" || !/^[0-9a-f-]{36}$/i.test(v)) throw new BloomError(400, "invalid", `${name} must be a UUID`);
  return v;
}

export function scopeAllows(caller: Caller, needed: string): boolean {
  return caller.scopes.length === 0 || caller.scopes.includes(needed) || caller.scopes.includes("*");
}
