// Bloom Support — Edge runtime: database gateway, caller authentication, HTTP helpers.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
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
}

export const SERVICE_IDENTITIES = ["intake", "operations", "automation", "investigation", "release"] as const;
export type ServiceIdentity = typeof SERVICE_IDENTITIES[number];

/**
 * Resolves the Bloom principal for a request:
 * - `Authorization: Bearer bsk_…`  → hashed API key (ChatGPT/MCP users, service identities)
 * - `Authorization: Bearer <CRM JWT>` → BloomSuite CRM session; tenant derived server-side
 */
export async function authenticate(req: Request): Promise<Caller> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new BloomError(401, "unauthenticated", "Sign in or provide an API key");
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

/** Principal id of a service identity, looked up from its configured key. */
export async function servicePrincipal(identity: ServiceIdentity): Promise<Caller> {
  const key = env(`BLOOM_SERVICE_KEY_${identity.toUpperCase()}`);
  if (!key) throw new BloomError(503, "not_configured", `BLOOM_SERVICE_KEY_${identity.toUpperCase()} is not set`);
  const c = await authenticateApiKey(key);
  return { ...c, via: "service" };
}

export interface ProductIdentity {
  product: "cms" | "pos";
  external_user_id: string;
  email?: string | null;
  name?: string | null;
  external_account_id?: string | null;
  account_name?: string | null;
}

/**
 * Signed product intake: the BloomSites or POS server authenticated the person
 * and derived their site/tenant, then signs the request body with its own
 * per-product secret. Bloom trusts the identity only when the signature checks.
 */
export async function authenticateProduct(req: Request, rawBody: string): Promise<{ product: "cms" | "pos"; payload: Record<string, unknown> }> {
  const product = req.headers.get("x-bloom-product");
  if (product !== "cms" && product !== "pos") throw new BloomError(401, "unauthenticated", "Unknown product");
  const secret = env(`BLOOM_INTAKE_SECRET_${product.toUpperCase()}`);
  if (!secret) throw new BloomError(503, "not_configured", `BLOOM_INTAKE_SECRET_${product.toUpperCase()} is not set`);
  const ok = await verifyIntakeSignature(secret, req.headers.get("x-bloom-timestamp"), req.headers.get("x-bloom-signature"), rawBody);
  if (!ok) throw new BloomError(401, "unauthenticated", "Invalid product signature");
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    throw new BloomError(400, "invalid", "Body must be JSON");
  }
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
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
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

export async function readJson(req: Request, limit = 1_000_000): Promise<Record<string, unknown>> {
  const text = await req.text();
  if (text.length > limit) throw new BloomError(413, "too_large", "Request too large");
  if (!text) return {};
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
