// OAuth 2.1 (authorization code + PKCE S256, dynamic client registration) so
// each person connects ChatGPT (or any MCP client) as themselves. The
// authorization step happens in BloomSuite: the person signs in normally and
// approves; only staff can approve. Access tokens are 1-hour Bloom API keys;
// refresh tokens rotate on every use.
import { authenticate, BloomError, env, rpc, str } from "./runtime.ts";
import { randomToken, sha256Hex } from "./crypto.ts";

export const apiBase = () => `${env("SUPABASE_URL")}/functions/v1/bloom-support-api`;
export const mcpBase = () => `${env("SUPABASE_URL")}/functions/v1/bloom-support-mcp`;
const consentUrl = () => `${env("BLOOM_SUPPORT_PUBLIC_URL") ?? "https://bloomsuite.app"}/bloom-support/connect`;

export function authorizationServerMetadata() {
  const b = apiBase();
  return {
    issuer: `${b}/oauth`,
    authorization_endpoint: `${b}/oauth/authorize`,
    token_endpoint: `${b}/oauth/token`,
    registration_endpoint: `${b}/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: ["read", "write"],
  };
}

export function protectedResourceMetadata() {
  return { resource: mcpBase(), authorization_servers: [`${apiBase()}/oauth`], scopes_supported: ["read", "write"], bearer_methods_supported: ["header"], resource_name: "Bloom Support" };
}

export async function register(body: Record<string, unknown>, ip: string) {
  const ok = await rpc<boolean>("consume_usage", { bucket: `oauth-register:${new Date().toISOString().slice(0, 13)}`, subject: await sha256Hex(ip), limit: 20 });
  if (!ok) throw new BloomError(429, "rate_limited", "Too many registrations");
  const redirects = Array.isArray(body.redirect_uris) ? body.redirect_uris.filter((u): u is string => typeof u === "string") : [];
  const name = str(body.client_name, 120) ?? "MCP client";
  const clientId = await rpc<string>("oauth_register_client", { client_name: name, redirect_uris: redirects });
  return { client_id: clientId, client_name: name, redirect_uris: redirects, token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"], response_types: ["code"] };
}

interface Client { client_id: string; client_name: string; redirect_uris: string[] }

/** Validates the request and sends the browser to BloomSuite to sign in and approve. */
export async function authorize(url: URL): Promise<Response> {
  const p = url.searchParams;
  const client = await rpc<Client | null>("oauth_client", { client_id: p.get("client_id") ?? "" });
  const redirect = p.get("redirect_uri") ?? "";
  if (!client || !client.redirect_uris.includes(redirect)) throw new BloomError(400, "invalid_request", "Unknown client or redirect_uri");
  if (p.get("response_type") !== "code" || p.get("code_challenge_method") !== "S256" || !p.get("code_challenge")) {
    const back = new URL(redirect);
    back.searchParams.set("error", "invalid_request");
    if (p.get("state")) back.searchParams.set("state", p.get("state")!);
    return Response.redirect(back.toString(), 302);
  }
  const next = new URL(consentUrl());
  for (const k of ["client_id", "redirect_uri", "code_challenge", "state", "scope"]) if (p.get(k)) next.searchParams.set(k, p.get(k)!);
  next.searchParams.set("client_name", client.client_name);
  return Response.redirect(next.toString(), 302);
}

/** Called by the BloomSuite approval page with the person's own session. */
export async function approve(req: Request, body: Record<string, unknown>) {
  const caller = await authenticate(req);
  if (caller.via !== "crm_session") throw new BloomError(403, "forbidden", "Approve from a signed-in BloomSuite session");
  const scope = body.scope === "read" ? "read" : "write";
  const code = `bsc_${randomToken(32)}`;
  await rpc("oauth_issue_code", {
    actor: caller.principalId, client_id: str(body.client_id, 100), redirect_uri: str(body.redirect_uri, 2000),
    code_challenge: str(body.code_challenge, 200), scope, code_hash: await sha256Hex(code),
  });
  const back = new URL(String(body.redirect_uri));
  back.searchParams.set("code", code);
  if (typeof body.state === "string") back.searchParams.set("state", body.state);
  return { redirect_to: back.toString() };
}

async function s256(verifier: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  return btoa(String.fromCharCode(...digest)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function issue(principal: string, client: string, scope: string, oldRefreshHash: string | null) {
  const access = `bsk_${randomToken(32)}`;
  const refresh = `bsr_${randomToken(32)}`;
  await rpc("oauth_issue_tokens", {
    principal_id: principal, client_id: client, scope, access_hash: await sha256Hex(access), access_prefix: access.slice(0, 10),
    refresh_hash: await sha256Hex(refresh), old_refresh_hash: oldRefreshHash,
  });
  return { access_token: access, token_type: "Bearer", expires_in: 3600, refresh_token: refresh, scope };
}

export async function token(req: Request): Promise<Response> {
  const type = req.headers.get("content-type") ?? "";
  const raw = await req.text();
  const fail = (error: string, description: string, status = 400) =>
    new Response(JSON.stringify({ error, error_description: description }), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  let f: Record<string, string>;
  try {
    const parsed: unknown = type.includes("application/json") ? JSON.parse(raw || "{}") : Object.fromEntries(new URLSearchParams(raw));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return fail("invalid_request", "Malformed token request");
    f = Object.fromEntries(Object.entries(parsed).map(([k, v]) => [k, typeof v === "string" ? v : ""]));
  } catch {
    return fail("invalid_request", "Malformed token request");
  }
  try {
    if (f.grant_type === "authorization_code") {
      const row = await rpc<{ principal_id: string; code_challenge: string; scope: string } | null>("oauth_consume_code", {
        code_hash: await sha256Hex(f.code ?? ""), client_id: f.client_id ?? "", redirect_uri: f.redirect_uri ?? "",
      });
      if (!row) return fail("invalid_grant", "Code is invalid, expired or already used");
      if (!f.code_verifier || (await s256(f.code_verifier)) !== row.code_challenge) return fail("invalid_grant", "PKCE verification failed");
      return new Response(JSON.stringify(await issue(row.principal_id, f.client_id, row.scope, null)), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
    }
    if (f.grant_type === "refresh_token") {
      const hash = await sha256Hex(f.refresh_token ?? "");
      const row = await rpc<{ principal_id: string; client_id: string; scope: string } | null>("oauth_refresh_lookup", { refresh_hash: hash });
      if (!row || (f.client_id && f.client_id !== row.client_id)) return fail("invalid_grant", "Refresh token is invalid or revoked");
      return new Response(JSON.stringify(await issue(row.principal_id, row.client_id, row.scope, hash)), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
    }
    return fail("unsupported_grant_type", "Use authorization_code or refresh_token");
  } catch (e) {
    return fail("invalid_grant", e instanceof Error ? e.message : "token error");
  }
}
