// Caller verification for the AI content generators (generate-newsletter,
// generate-structured-newsletter, generate-cohesive-newsletter,
// generate-email-content, generate-content, generate-weekly-themes).
//
// Every request must carry a valid user JWT. The user id comes from that
// verified token only; a userId/user_id in the body or query string is never
// trusted. The tenant is the one named in the body (tenantId / tenant_id) or,
// when none is named, the caller's own users.tenant_id read through RLS.
// Membership is checked with bloom_can_access_tenant under the caller's JWT
// (tenant member, or a master admin whose active tenant it is) before any
// service-key query runs.

export const GENERATOR_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type QueryResult<T> = PromiseLike<{ data: T | null; error: unknown }>;

interface UserRowQuery {
  eq(column: string, value: string): UserRowQuery;
  maybeSingle(): QueryResult<{ tenant_id?: string | null }>;
}

/** Structural so npm:, jsr: and esm.sh Supabase clients are all accepted. */
export interface GeneratorAuthClient {
  auth: {
    getUser(token?: string): PromiseLike<{
      data: { user: { id: string } | null };
      error: unknown;
    }>;
  };
  from(table: string): { select(columns: string): unknown };
  rpc(fn: string, args?: Record<string, unknown>): unknown;
}

/** company_profiles row as the generators read it (select '*'). */
export interface GeneratorCompanyProfile {
  company_name?: string | null;
  company_overview?: string | null;
  [column: string]: unknown;
}

interface ProfileQuery {
  eq(column: string, value: string): ProfileQuery;
  single(): PromiseLike<{ data: GeneratorCompanyProfile | null; error: unknown }>;
  maybeSingle(): PromiseLike<{ data: GeneratorCompanyProfile | null; error: unknown }>;
}

/** The caller's JWT-scoped client, narrowed to the company profile read. */
export interface GeneratorProfileClient {
  from(table: "company_profiles"): { select(columns: string): ProfileQuery };
}

export type GeneratorCreateClient = (
  url: string,
  key: string,
  options?: Record<string, unknown>,
) => unknown;

export interface GeneratorAuthDeps {
  createClient: GeneratorCreateClient;
  envGet: (key: string) => string | undefined;
}

export type GeneratorAuthResult =
  | {
      ok: true;
      userId: string;
      tenantId: string;
      /** Supabase client scoped to the caller's JWT (RLS applies). */
      userClient: unknown;
    }
  | { ok: false; response: Response };

export function bearerToken(req: Request): string | null {
  const header = req.headers.get("Authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match ? match[1] : null;
}

function denied(
  status: number,
  error: string,
  corsHeaders: Record<string, string>,
): { ok: false; response: Response } {
  return {
    ok: false,
    response: new Response(JSON.stringify({ error }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }),
  };
}

function requestedTenantId(body: unknown): string | null | undefined {
  if (!body || typeof body !== "object") return undefined;
  const record = body as Record<string, unknown>;
  const value = record.tenantId ?? record.tenant_id;
  if (value === undefined || value === null || value === "") return undefined;
  return typeof value === "string" && GENERATOR_UUID.test(value) ? value : null;
}

/**
 * Verify the caller's JWT and tenant membership.
 * 401: no token or an invalid token. 400: a malformed tenant id.
 * 403: no tenant, or the caller cannot access the tenant.
 */
export async function authorizeGeneratorRequest(
  req: Request,
  body: unknown,
  deps: GeneratorAuthDeps,
  corsHeaders: Record<string, string>,
): Promise<GeneratorAuthResult> {
  const token = bearerToken(req);
  if (!token) return denied(401, "unauthorized", corsHeaders);

  const url = deps.envGet("SUPABASE_URL");
  const anonKey = deps.envGet("SUPABASE_ANON_KEY");
  if (!url || !anonKey) return denied(500, "auth_not_configured", corsHeaders);

  const userClient = deps.createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  }) as GeneratorAuthClient;

  let userId: string | null = null;
  try {
    const { data, error } = await userClient.auth.getUser(token);
    if (!error && data?.user?.id) userId = data.user.id;
  } catch {
    userId = null;
  }
  if (!userId) return denied(401, "unauthorized", corsHeaders);

  const requested = requestedTenantId(body);
  if (requested === null) return denied(400, "invalid_tenant", corsHeaders);

  let tenantId = requested;
  if (!tenantId) {
    const query = userClient.from("users").select("tenant_id") as UserRowQuery;
    const { data, error } = await query.eq("id", userId).maybeSingle();
    const own = !error && typeof data?.tenant_id === "string" ? data.tenant_id : "";
    if (!GENERATOR_UUID.test(own)) {
      return denied(403, "tenant_membership_required", corsHeaders);
    }
    tenantId = own;
  }

  const access = (await userClient.rpc("bloom_can_access_tenant", {
    p_tenant_id: tenantId,
  })) as { data: unknown; error: unknown };
  if (access?.error || access?.data !== true) {
    return denied(403, "tenant_membership_required", corsHeaders);
  }

  return { ok: true, userId, tenantId, userClient };
}

/**
 * Parse a JSON object body; an empty or invalid body is treated as {}.
 * `T` describes the fields the caller reads (the body is not validated).
 */
export async function readJsonBody<T extends object = Record<string, unknown>>(
  req: Request,
): Promise<T> {
  try {
    const parsed: unknown = await req.json();
    return (parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {}) as T;
  } catch {
    return {} as T;
  }
}
