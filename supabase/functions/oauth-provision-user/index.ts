import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { buildCorsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import {
  type VerifiedAccessToken,
  verifyAccessToken as verifyOAuthAccessToken,
} from "../_shared/verifyAccessToken.ts";

type EnvGetter = (key: string) => string | undefined;

interface AuthUser {
  id?: string;
  email?: string | null;
  email_confirmed_at?: string | null;
  raw_user_meta_data?: Record<string, unknown> | null;
  user_metadata?: Record<string, unknown> | null;
}

interface PublicUserRow {
  id?: string;
  email?: string | null;
  tenant_id?: string | null;
  full_name?: string | null;
  name?: string | null;
}

interface CompanyProfileRow {
  company_name?: string | null;
  feature_flags?: Record<string, unknown> | null;
}

interface SubscriptionRow {
  plan?: string | null;
  tier?: string | null;
  end_date?: string | null;
  deleted_at?: string | null;
  created_at?: string | null;
}

interface TenantRow {
  id?: string;
}

interface UserExternalLinkRow {
  user_id?: string;
  provider?: string;
  external_id?: string;
}

interface ProvisionRequestBody {
  email: string;
  full_name: string;
  company_name: string | null;
  source: string;
  external_id: string | null;
}

interface ProvisioningResponseBody {
  crm_user_id: string;
  email: string;
  full_name: string;
  is_new: boolean;
  tenant_id: string | null;
  subscription: {
    plan: string;
    status: "active" | "trialing" | "past_due" | "canceled" | "unpaid" | "none";
    expires_at: string | null;
  };
}

interface AuditContext {
  clientId: string;
  email: string;
  source: string;
  externalId: string | null;
}

interface SupabaseQueryChain {
  eq: (column: string, value: unknown) => SupabaseQueryChain;
  order: (column: string, value: unknown) => SupabaseQueryChain;
  limit: (value: unknown) => SupabaseQueryChain;
  maybeSingle: <T = unknown>() => Promise<{
    data: T | null;
    error: { message: string } | null;
  }>;
  single: <T = unknown>() => Promise<{
    data: T | null;
    error: { message: string } | null;
  }>;
}

interface SupabaseMutationChain extends SupabaseQueryChain {
  select: (columns?: string) => SupabaseMutationChain;
}

interface OAuthSupabaseClient {
  auth: {
    admin?: {
      listUsers: (params?: { page?: number; perPage?: number }) => Promise<{
        data: { users: AuthUser[] } | null;
        error: { message: string } | null;
      }>;
      createUser: (attributes: Record<string, unknown>) => Promise<{
        data: { user: AuthUser | null };
        error: { message: string } | null;
      }>;
    };
  };
  from: (table: string) => {
    select: (columns?: string) => unknown;
    insert: (payload: unknown) => unknown;
    update: (payload: unknown) => unknown;
    upsert: (payload: unknown, options?: unknown) => unknown;
  };
  rpc: (
    name: string,
    payload?: unknown,
  ) => Promise<{
    data: unknown;
    error: { message: string } | null;
  }>;
}

type CreateOAuthSupabaseClient = (
  supabaseUrl: string,
  supabaseKey: string,
) => OAuthSupabaseClient;

export interface OAuthProvisionUserDependencies {
  createClient: CreateOAuthSupabaseClient;
  envGet: EnvGetter;
  now: () => Date;
  verifyAccessToken: (token: string) => Promise<VerifiedAccessToken>;
  generatePassword: () => string;
}

const PROVISION_USER_CORS_OPTIONS = {
  allowOrigin: "*",
  allowMethods: "POST, OPTIONS",
};

const EXTERNAL_PROVIDER = "cms";
const CLIENT_RATE_LIMIT_PER_MINUTE = 100;
const EMAIL_RATE_LIMIT_PER_MINUTE = 5;
const USER_LOOKUP_PAGE_SIZE = 200;
const DEFAULT_COMPANY_FEATURE_FLAGS = {
  crm_enabled: true,
  analytics_v1: true,
  scheduling_v1: true,
  social_posting_v1: true,
  auto_send_campaigns: true,
  smart_timing_enabled: true,
  sms_setup_completed: true,
  sms_compliance_configured: true,
  analytics_dashboard_v1: true,
};

const defaultDependencies: OAuthProvisionUserDependencies = {
  createClient: (supabaseUrl, supabaseKey) =>
    createSupabaseClient(
      supabaseUrl,
      supabaseKey,
    ) as unknown as OAuthSupabaseClient,
  envGet: (key) => Deno.env.get(key),
  now: () => new Date(),
  verifyAccessToken: (token) =>
    verifyOAuthAccessToken(token, {
      createClient: (supabaseUrl, supabaseKey) =>
        createSupabaseClient(
          supabaseUrl,
          supabaseKey,
        ) as unknown as OAuthSupabaseClient,
      envGet: (key) => Deno.env.get(key),
    }),
  generatePassword: () => generateSecureRandomPassword(),
};

function getRequiredEnv(key: string, envGet: EnvGetter): string {
  const value = envGet(key)?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

function normalizeString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseScopes(scope: string): string[] {
  return scope
    .split(/\s+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function parseBearerToken(authorizationHeader: string | null): string | null {
  if (!authorizationHeader?.trim()) {
    return null;
  }

  const [scheme, token] = authorizationHeader.trim().split(/\s+/, 2);
  if (scheme.toLowerCase() !== "bearer" || !token?.trim()) {
    return null;
  }

  return token.trim();
}

function isJsonContentType(contentType: string): boolean {
  const [mediaType] = contentType.toLowerCase().split(";");
  return mediaType === "application/json" || mediaType.endsWith("+json");
}

async function parseProvisionBody(
  req: Request,
): Promise<Record<string, unknown> | null> {
  const contentType = req.headers.get("Content-Type") ?? "";
  if (!isJsonContentType(contentType)) {
    return null;
  }

  try {
    const parsed = await req.json();
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function startOfMinute(now: Date): Date {
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      now.getUTCHours(),
      now.getUTCMinutes(),
      0,
      0,
    ),
  );
}

function secondsUntilNextMinute(now: Date): string {
  const windowEnd = startOfMinute(now).getTime() + 60_000;
  return String(Math.max(1, Math.ceil((windowEnd - now.getTime()) / 1000)));
}

function getUserMetadata(
  authUser: AuthUser | null,
): Record<string, unknown> | null {
  return authUser?.user_metadata ?? authUser?.raw_user_meta_data ?? null;
}

function getStringValue(
  record: Record<string, unknown> | null | undefined,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function normalizeExpiresAt(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate.toISOString();
}

function deriveSubscriptionStatus(
  subscription: SubscriptionRow | null,
  now: Date,
): "active" | "trialing" | "past_due" | "canceled" | "unpaid" | "none" {
  if (!subscription) {
    return "none";
  }

  const effectivePlan = subscription.tier || subscription.plan || "";
  if (effectivePlan === "past_due") {
    return "past_due";
  }
  if (effectivePlan === "unpaid") {
    return "unpaid";
  }
  if (subscription.deleted_at || effectivePlan === "canceled") {
    return "canceled";
  }

  const expiresAt = subscription.end_date
    ? new Date(subscription.end_date)
    : null;
  if (
    expiresAt &&
    !Number.isNaN(expiresAt.getTime()) &&
    expiresAt.getTime() <= now.getTime()
  ) {
    return "canceled";
  }

  if (effectivePlan === "free_trial") {
    return "trialing";
  }

  return "active";
}

function dateStringUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function buildTenantName(body: ProvisionRequestBody): string {
  return (
    body.company_name ||
    body.full_name ||
    body.email.split("@")[0] ||
    "Organization"
  );
}

function buildTenantSlug(email: string, userId: string): string {
  const base = slugify(email || userId) || "organization";
  return `${base}-${userId.slice(0, 8)}`;
}

function randomIndex(max: number): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] % max;
}

export function generateSecureRandomPassword(length = 72): string {
  const lowercase = "abcdefghijkmnopqrstuvwxyz";
  const uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const symbols = "!@#$%^&*()-_=+[]{}:,.?";
  const allCharacters = `${lowercase}${uppercase}${digits}${symbols}`;

  const passwordCharacters = [
    lowercase[randomIndex(lowercase.length)],
    uppercase[randomIndex(uppercase.length)],
    digits[randomIndex(digits.length)],
    symbols[randomIndex(symbols.length)],
  ];

  while (passwordCharacters.length < Math.max(length, 64)) {
    passwordCharacters.push(allCharacters[randomIndex(allCharacters.length)]);
  }

  for (let index = passwordCharacters.length - 1; index > 0; index -= 1) {
    const swapIndex = randomIndex(index + 1);
    [passwordCharacters[index], passwordCharacters[swapIndex]] = [
      passwordCharacters[swapIndex],
      passwordCharacters[index],
    ];
  }

  return passwordCharacters.join("");
}

async function maybeSingle<T>(query: unknown): Promise<{
  data: T | null;
  error: { message: string } | null;
}> {
  return await (query as SupabaseQueryChain).maybeSingle<T>();
}

async function executeQuery<T>(query: unknown): Promise<{
  data: T | null;
  error: { message: string } | null;
}> {
  return await (query as Promise<{
    data: T | null;
    error: { message: string } | null;
  }>);
}

function jsonResponse(
  req: Request,
  status: number,
  body: Record<string, unknown>,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...buildCorsHeaders(req, PROVISION_USER_CORS_OPTIONS),
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      Pragma: "no-cache",
      ...extraHeaders,
    },
  });
}

function methodNotAllowedResponse(req: Request): Response {
  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: {
      ...buildCorsHeaders(req, PROVISION_USER_CORS_OPTIONS),
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      Pragma: "no-cache",
      Allow: "POST, OPTIONS",
    },
  });
}

function unauthorizedResponse(req: Request): Response {
  return jsonResponse(
    req,
    401,
    { error: "unauthorized" },
    {
      "WWW-Authenticate": "Bearer",
    },
  );
}

function forbiddenResponse(req: Request, error: string): Response {
  return jsonResponse(req, 403, { error });
}

function badRequestResponse(req: Request, error: string): Response {
  return jsonResponse(req, 400, { error });
}

function provisioningFailedResponse(req: Request): Response {
  return jsonResponse(req, 500, { error: "provisioning_failed" });
}

function rateLimitResponse(req: Request, retryAfter: string): Response {
  return jsonResponse(
    req,
    429,
    { error: "rate_limit_exceeded" },
    { "Retry-After": retryAfter },
  );
}

async function loadPublicUser(
  supabase: OAuthSupabaseClient,
  userId: string,
): Promise<{ data: PublicUserRow | null; error: { message: string } | null }> {
  const query = supabase
    .from("users")
    .select("id, email, tenant_id, full_name, name") as SupabaseQueryChain;
  return await maybeSingle<PublicUserRow>(query.eq("id", userId));
}

async function loadCompanyProfile(
  supabase: OAuthSupabaseClient,
  userId: string,
): Promise<{
  data: CompanyProfileRow | null;
  error: { message: string } | null;
}> {
  const query = supabase
    .from("company_profiles")
    .select("company_name, feature_flags") as SupabaseQueryChain;
  return await maybeSingle<CompanyProfileRow>(query.eq("user_id", userId));
}

async function loadLatestSubscription(
  supabase: OAuthSupabaseClient,
  userId: string,
): Promise<{
  data: SubscriptionRow | null;
  error: { message: string } | null;
}> {
  const query = supabase
    .from("subscriptions")
    .select(
      "plan, tier, end_date, deleted_at, created_at",
    ) as SupabaseQueryChain;
  const { data, error } = await executeQuery<SubscriptionRow[]>(
    query
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1),
  );

  return {
    data: Array.isArray(data) ? (data[0] ?? null) : null,
    error,
  };
}

async function createTenant(
  supabase: OAuthSupabaseClient,
  body: ProvisionRequestBody,
  userId: string,
): Promise<string> {
  const query = (
    supabase.from("tenants").insert({
      name: buildTenantName(body),
      slug: buildTenantSlug(body.email, userId),
      is_active: true,
    }) as SupabaseMutationChain
  ).select("id");
  const { data, error } = await maybeSingle<TenantRow>(query);
  if (error || !data?.id) {
    throw new Error(error?.message ?? "Failed to create tenant.");
  }

  return data.id;
}

async function ensurePublicUser(
  supabase: OAuthSupabaseClient,
  authUser: AuthUser,
  body: ProvisionRequestBody,
): Promise<PublicUserRow> {
  if (!authUser.id) {
    throw new Error("Auth user id is required.");
  }

  const { data: existingPublicUser, error: publicUserError } =
    await loadPublicUser(supabase, authUser.id);
  if (publicUserError) {
    throw new Error(publicUserError.message);
  }

  let tenantId = existingPublicUser?.tenant_id ?? null;
  if (!tenantId) {
    tenantId = await createTenant(supabase, body, authUser.id);
  }

  if (!existingPublicUser) {
    const { error } = await executeQuery(
      supabase.from("users").upsert(
        {
          id: authUser.id,
          email: authUser.email ?? body.email,
          name: body.full_name,
          full_name: body.full_name,
          role: "admin",
          tenant_id: tenantId,
          created_by_user_id: authUser.id,
        },
        { onConflict: "id" },
      ),
    );
    if (error) {
      throw new Error(error.message);
    }
  } else {
    const updatePayload: Record<string, unknown> = {};
    if (!existingPublicUser.tenant_id) {
      updatePayload.tenant_id = tenantId;
    }
    if (!existingPublicUser.full_name) {
      updatePayload.full_name = body.full_name;
    }
    if (!existingPublicUser.name) {
      updatePayload.name = body.full_name;
    }

    if (Object.keys(updatePayload).length > 0) {
      const { error } = await executeQuery(
        (supabase.from("users").update(updatePayload) as SupabaseQueryChain).eq(
          "id",
          authUser.id,
        ),
      );
      if (error) {
        throw new Error(error.message);
      }
    }
  }

  const { data: reloadedPublicUser, error: reloadError } = await loadPublicUser(
    supabase,
    authUser.id,
  );
  if (reloadError || !reloadedPublicUser) {
    throw new Error(
      reloadError?.message ?? "Failed to load provisioned public user.",
    );
  }

  return reloadedPublicUser;
}

async function ensureCompanyProfile(
  supabase: OAuthSupabaseClient,
  authUser: AuthUser,
  body: ProvisionRequestBody,
): Promise<CompanyProfileRow | null> {
  if (!authUser.id) {
    throw new Error("Auth user id is required.");
  }

  const { data: existingCompanyProfile, error: companyProfileError } =
    await loadCompanyProfile(supabase, authUser.id);
  if (companyProfileError) {
    throw new Error(companyProfileError.message);
  }

  if (!existingCompanyProfile) {
    const { error } = await executeQuery(
      supabase.from("company_profiles").upsert(
        {
          user_id: authUser.id,
          company_name: body.company_name,
          feature_flags: DEFAULT_COMPANY_FEATURE_FLAGS,
        },
        { onConflict: "user_id" },
      ),
    );
    if (error) {
      throw new Error(error.message);
    }
  } else if (!existingCompanyProfile.company_name && body.company_name) {
    const { error } = await executeQuery(
      (
        supabase.from("company_profiles").update({
          company_name: body.company_name,
        }) as SupabaseQueryChain
      ).eq("user_id", authUser.id),
    );
    if (error) {
      throw new Error(error.message);
    }
  }

  const { data: reloadedCompanyProfile, error: reloadError } =
    await loadCompanyProfile(supabase, authUser.id);
  if (reloadError) {
    throw new Error(reloadError.message);
  }

  return reloadedCompanyProfile;
}

async function ensureSubscription(
  supabase: OAuthSupabaseClient,
  authUser: AuthUser,
  now: Date,
): Promise<SubscriptionRow | null> {
  if (!authUser.id) {
    throw new Error("Auth user id is required.");
  }

  const { data: existingSubscription, error: subscriptionError } =
    await loadLatestSubscription(supabase, authUser.id);
  if (subscriptionError) {
    throw new Error(subscriptionError.message);
  }

  if (existingSubscription) {
    return existingSubscription;
  }

  const { error } = await executeQuery(
    supabase.from("subscriptions").insert({
      user_id: authUser.id,
      plan: "free_trial",
      start_date: dateStringUtc(now),
      end_date: dateStringUtc(addUtcDays(now, 7)),
    }),
  );
  if (error) {
    throw new Error(error.message);
  }

  const { data: reloadedSubscription, error: reloadError } =
    await loadLatestSubscription(supabase, authUser.id);
  if (reloadError) {
    throw new Error(reloadError.message);
  }

  return reloadedSubscription;
}

async function ensureExternalLink(
  supabase: OAuthSupabaseClient,
  userId: string,
  externalId: string | null,
): Promise<void> {
  if (!externalId) {
    return;
  }

  const providerExternalIdQuery = supabase
    .from("user_external_links")
    .select("user_id, provider, external_id") as SupabaseQueryChain;
  const { data: linkedByExternalId, error: linkedByExternalIdError } =
    await maybeSingle<UserExternalLinkRow>(
      providerExternalIdQuery
        .eq("provider", EXTERNAL_PROVIDER)
        .eq("external_id", externalId),
    );
  if (linkedByExternalIdError) {
    throw new Error(linkedByExternalIdError.message);
  }
  if (linkedByExternalId?.user_id && linkedByExternalId.user_id !== userId) {
    throw new Error("External identity already linked to another CRM user.");
  }

  const userProviderQuery = supabase
    .from("user_external_links")
    .select("user_id, provider, external_id") as SupabaseQueryChain;
  const { data: linkedByUser, error: linkedByUserError } =
    await maybeSingle<UserExternalLinkRow>(
      userProviderQuery.eq("user_id", userId).eq("provider", EXTERNAL_PROVIDER),
    );
  if (linkedByUserError) {
    throw new Error(linkedByUserError.message);
  }
  if (linkedByUser?.external_id === externalId) {
    return;
  }

  const { error } = await executeQuery(
    supabase.from("user_external_links").upsert(
      {
        user_id: userId,
        provider: EXTERNAL_PROVIDER,
        external_id: externalId,
      },
      { onConflict: "user_id,provider" },
    ),
  );
  if (error) {
    throw new Error(error.message);
  }
}

async function incrementRateLimit(
  supabase: OAuthSupabaseClient,
  scope: "client" | "email",
  identifier: string,
  now: Date,
): Promise<{ count: number; retryAfter: string }> {
  const retryAfter = secondsUntilNextMinute(now);
  const { data, error } = await supabase.rpc(
    "upsert_oauth_provisioning_rate_limit",
    {
      p_scope: scope,
      p_identifier: identifier,
      p_window_start: startOfMinute(now).toISOString(),
    },
  );
  if (error) {
    throw new Error(error.message);
  }

  return {
    count: typeof data === "number" ? data : 0,
    retryAfter,
  };
}

async function findAuthUserByEmail(
  supabase: OAuthSupabaseClient,
  email: string,
): Promise<AuthUser | null> {
  if (!supabase.auth.admin?.listUsers) {
    throw new Error("Supabase admin listUsers API is unavailable.");
  }

  const normalizedEmail = email.toLowerCase();
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: USER_LOOKUP_PAGE_SIZE,
    });
    if (error) {
      throw new Error(error.message);
    }

    const users = Array.isArray(data?.users) ? data.users : [];
    const existingUser = users.find(
      (user) => user.email?.toLowerCase() === normalizedEmail,
    );
    if (existingUser) {
      return existingUser;
    }

    if (users.length < USER_LOOKUP_PAGE_SIZE) {
      return null;
    }

    page += 1;
  }
}

function isDuplicateUserError(message: string | null | undefined): boolean {
  const normalized = (message ?? "").toLowerCase();
  return (
    normalized.includes("already been registered") ||
    normalized.includes("user already registered") ||
    normalized.includes("duplicate key")
  );
}

async function createAuthUser(
  supabase: OAuthSupabaseClient,
  body: ProvisionRequestBody,
  deps: OAuthProvisionUserDependencies,
): Promise<AuthUser> {
  if (!supabase.auth.admin?.createUser) {
    throw new Error("Supabase admin createUser API is unavailable.");
  }

  const provisionedAt = deps.now().toISOString();
  const { data, error } = await supabase.auth.admin.createUser({
    email: body.email,
    email_confirm: true,
    user_metadata: {
      full_name: body.full_name,
      company_name: body.company_name ?? "",
      provisioned_by: "cms",
      provisioned_at: provisionedAt,
      provisioning_source: body.source,
    },
    password: deps.generatePassword(),
  });

  if (error || !data.user?.id) {
    throw new Error(error?.message ?? "Failed to create auth user.");
  }

  return data.user;
}

function buildProvisioningResponse(params: {
  authUser: AuthUser;
  publicUser: PublicUserRow;
  companyProfile: CompanyProfileRow | null;
  subscription: SubscriptionRow | null;
  body: ProvisionRequestBody;
  isNew: boolean;
  now: Date;
}): ProvisioningResponseBody {
  const metadata = getUserMetadata(params.authUser);
  const fullName =
    params.publicUser.full_name ||
    params.publicUser.name ||
    getStringValue(metadata, ["full_name", "name"]) ||
    params.companyProfile?.company_name ||
    params.body.full_name;

  const effectivePlan =
    params.subscription?.tier || params.subscription?.plan || "none";

  return {
    crm_user_id: params.authUser.id ?? "",
    email: params.authUser.email ?? params.body.email,
    full_name: fullName,
    is_new: params.isNew,
    tenant_id: params.publicUser.tenant_id ?? null,
    subscription: {
      plan: effectivePlan,
      status: deriveSubscriptionStatus(params.subscription, params.now),
      expires_at: normalizeExpiresAt(params.subscription?.end_date),
    },
  };
}

async function safeAuditLog(
  supabase: OAuthSupabaseClient,
  params: {
    context: AuditContext;
    result: "created" | "existing" | "error" | "rate_limited" | "rejected";
    crmUserId?: string | null;
    actionDetails?: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await executeQuery(
    supabase.from("oauth_provisioning_audit_logs").insert({
      client_id: params.context.clientId,
      email: params.context.email,
      source: params.context.source,
      result: params.result,
      crm_user_id: params.crmUserId ?? null,
      action_details: {
        external_id: params.context.externalId,
        ...params.actionDetails,
      },
    }),
  );

  if (error) {
    console.error(
      "[oauth-provision-user] Failed to write audit log",
      error.message,
    );
  }
}

function getAuditContext(
  verifiedToken: VerifiedAccessToken,
  rawBody: Record<string, unknown> | null,
): AuditContext {
  return {
    clientId: verifiedToken.client_id,
    email: normalizeString(rawBody?.email) ?? "unknown",
    source: normalizeString(rawBody?.source) ?? "unknown",
    externalId: normalizeString(rawBody?.external_id),
  };
}

export async function handleOAuthProvisionUser(
  req: Request,
  deps: OAuthProvisionUserDependencies = defaultDependencies,
): Promise<Response> {
  const corsResponse = handleCorsPreflight(req, PROVISION_USER_CORS_OPTIONS);
  if (corsResponse) {
    return corsResponse;
  }

  if (req.method !== "POST") {
    return methodNotAllowedResponse(req);
  }

  const accessToken = parseBearerToken(req.headers.get("Authorization"));
  if (!accessToken) {
    return unauthorizedResponse(req);
  }

  let verifiedToken: VerifiedAccessToken;
  try {
    verifiedToken = await deps.verifyAccessToken(accessToken);
  } catch {
    return unauthorizedResponse(req);
  }

  const rawBody = await parseProvisionBody(req);
  const auditContext = getAuditContext(verifiedToken, rawBody);

  let supabase: OAuthSupabaseClient;
  try {
    supabase = deps.createClient(
      getRequiredEnv("SUPABASE_URL", deps.envGet),
      getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY", deps.envGet),
    );
  } catch (error) {
    console.error(
      "[oauth-provision-user] Failed to initialize Supabase client",
      error,
    );
    return provisioningFailedResponse(req);
  }

  const scopes = parseScopes(verifiedToken.scope);
  if (!scopes.includes("user:provision")) {
    await safeAuditLog(supabase, {
      context: auditContext,
      result: "rejected",
      actionDetails: { error: "insufficient_scope" },
    });
    return forbiddenResponse(req, "insufficient_scope");
  }
  if (
    verifiedToken.grant_type !== "client_credentials" ||
    verifiedToken.sub !== verifiedToken.client_id
  ) {
    await safeAuditLog(supabase, {
      context: auditContext,
      result: "rejected",
      actionDetails: { error: "invalid_grant_type" },
    });
    return forbiddenResponse(req, "invalid_grant_type");
  }

  if (!rawBody) {
    await safeAuditLog(supabase, {
      context: auditContext,
      result: "rejected",
      actionDetails: { error: "invalid_request" },
    });
    return badRequestResponse(req, "invalid_request");
  }

  const email = normalizeString(rawBody.email)?.toLowerCase() ?? null;
  const fullName = normalizeString(rawBody.full_name);
  const companyName = normalizeString(rawBody.company_name);
  const source = normalizeString(rawBody.source);
  const externalId = normalizeString(rawBody.external_id);
  const now = deps.now();

  try {
    const { count: clientCount, retryAfter: clientRetryAfter } =
      await incrementRateLimit(
        supabase,
        "client",
        verifiedToken.client_id,
        now,
      );
    if (clientCount > CLIENT_RATE_LIMIT_PER_MINUTE) {
      await safeAuditLog(supabase, {
        context: {
          ...auditContext,
          email: email ?? auditContext.email,
          source: source ?? auditContext.source,
        },
        result: "rate_limited",
        actionDetails: {
          error: "rate_limit_exceeded",
          limit_scope: "client",
          retry_after: clientRetryAfter,
        },
      });
      return rateLimitResponse(req, clientRetryAfter);
    }

    if (email) {
      const { count: emailCount, retryAfter: emailRetryAfter } =
        await incrementRateLimit(supabase, "email", email, now);
      if (emailCount > EMAIL_RATE_LIMIT_PER_MINUTE) {
        await safeAuditLog(supabase, {
          context: {
            ...auditContext,
            email,
            source: source ?? auditContext.source,
          },
          result: "rate_limited",
          actionDetails: {
            error: "rate_limit_exceeded",
            limit_scope: "email",
            retry_after: emailRetryAfter,
          },
        });
        return rateLimitResponse(req, emailRetryAfter);
      }
    }

    if (!email || !fullName || !source) {
      await safeAuditLog(supabase, {
        context: {
          ...auditContext,
          email: email ?? auditContext.email,
          source: source ?? auditContext.source,
        },
        result: "rejected",
        actionDetails: { error: "invalid_request" },
      });
      return badRequestResponse(req, "invalid_request");
    }
    if (!isValidEmail(email)) {
      await safeAuditLog(supabase, {
        context: { ...auditContext, email, source },
        result: "rejected",
        actionDetails: { error: "invalid_email" },
      });
      return badRequestResponse(req, "invalid_email");
    }

    const provisionBody: ProvisionRequestBody = {
      email,
      full_name: fullName,
      company_name: companyName,
      source,
      external_id: externalId,
    };

    let authUser = await findAuthUserByEmail(supabase, email);
    let isNew = false;

    if (!authUser) {
      try {
        authUser = await createAuthUser(supabase, provisionBody, deps);
        isNew = true;
      } catch (error) {
        if (
          isDuplicateUserError(
            error instanceof Error ? error.message : String(error),
          )
        ) {
          authUser = await findAuthUserByEmail(supabase, email);
        }
        if (!authUser) {
          await safeAuditLog(supabase, {
            context: { ...auditContext, email, source },
            result: "error",
            actionDetails: {
              error: "provisioning_failed",
              message: error instanceof Error ? error.message : String(error),
            },
          });
          return provisioningFailedResponse(req);
        }
      }
    }

    if (!authUser?.id) {
      await safeAuditLog(supabase, {
        context: { ...auditContext, email, source },
        result: "error",
        actionDetails: {
          error: "provisioning_failed",
          message: "Resolved auth user is missing an id.",
        },
      });
      return provisioningFailedResponse(req);
    }

    const publicUser = await ensurePublicUser(
      supabase,
      authUser,
      provisionBody,
    );
    const companyProfile = await ensureCompanyProfile(
      supabase,
      authUser,
      provisionBody,
    );
    const subscription = await ensureSubscription(supabase, authUser, now);
    await ensureExternalLink(supabase, authUser.id, externalId);

    const responseBody = buildProvisioningResponse({
      authUser,
      publicUser,
      companyProfile,
      subscription,
      body: provisionBody,
      isNew,
      now,
    });

    await safeAuditLog(supabase, {
      context: { ...auditContext, email, source, externalId },
      result: isNew ? "created" : "existing",
      crmUserId: authUser.id,
      actionDetails: {
        tenant_id: responseBody.tenant_id,
        subscription: responseBody.subscription,
      },
    });

    return jsonResponse(
      req,
      200,
      responseBody as unknown as Record<string, unknown>,
    );
  } catch (error) {
    console.error("[oauth-provision-user] Provisioning failed", error);
    await safeAuditLog(supabase, {
      context: {
        ...auditContext,
        email: email ?? auditContext.email,
        source: source ?? auditContext.source,
      },
      result: "error",
      actionDetails: {
        error: "provisioning_failed",
        message: error instanceof Error ? error.message : String(error),
      },
    });
    return provisioningFailedResponse(req);
  }
}

if (import.meta.main) {
  Deno.serve((req) => handleOAuthProvisionUser(req));
}
