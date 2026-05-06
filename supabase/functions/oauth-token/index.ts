import { createClient as createSupabaseClient } from "@supabase/supabase-js";
// @deno-types="npm:@types/bcryptjs@2.4.6"
import bcrypt from "bcryptjs";
import type { JWTPayload } from "jose";

import { buildCorsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import {
  generateRefreshToken,
  hashToken,
  parsePrivateKey,
  signJWT,
  validateScopes,
  verifyPKCE,
} from "../_shared/oauth.ts";

type EnvGetter = (key: string) => string | undefined;

type OAuthErrorCode =
  | "invalid_request"
  | "invalid_client"
  | "invalid_grant"
  | "unauthorized_client"
  | "unsupported_grant_type"
  | "invalid_scope"
  | "server_error";

type TokenBody = Record<string, string>;

interface OAuthClientRow {
  client_id: string;
  client_secret_hash: string;
  allowed_scopes: string[];
  grant_types: string[];
  is_active: boolean;
  is_first_party?: boolean;
}

interface AuthorizationCodeRow {
  id: string;
  client_id: string;
  user_id: string;
  redirect_uri: string;
  scope: string;
  code_challenge: string;
  code_challenge_method: string;
  expires_at: string;
  consumed_at: string | null;
}

interface RefreshTokenRow {
  id: string;
  token_hash: string;
  client_id: string;
  user_id: string;
  scope: string;
  family_id: string;
  expires_at: string;
  revoked_at: string | null;
}

interface AuthUser {
  id?: string;
  email?: string | null;
  email_confirmed_at?: string | null;
  last_sign_in_at?: string | null;
  raw_user_meta_data?: Record<string, unknown> | null;
  user_metadata?: Record<string, unknown> | null;
}

interface PublicUserProfile {
  tenant_id?: string | null;
  full_name?: string | null;
  name?: string | null;
  email?: string | null;
  last_sign_in_at?: string | null;
}

interface CompanyProfile {
  company_name?: string | null;
  feature_flags?: Record<string, unknown> | null;
}

interface SubscriptionRow {
  plan?: string | null;
  tier?: string | null;
  end_date?: string | null;
  billing_interval?: string | null;
}

interface UserTokenContext {
  authUser: AuthUser | null;
  publicUser: PublicUserProfile | null;
  companyProfile: CompanyProfile | null;
  subscription: SubscriptionRow | null;
}

interface OAuthSupabaseClient {
  auth: {
    admin?: {
      getUserById: (userId: string) => Promise<{
        data: { user: AuthUser | null };
        error: { message: string } | null;
      }>;
    };
  };
  from: (table: string) => {
    select: (columns?: string) => unknown;
    insert: (payload: unknown) => unknown;
    update: (payload: unknown) => unknown;
  };
}

interface SupabaseQueryChain {
  eq: (column: string, value: unknown) => SupabaseQueryChain;
  is: (column: string, value: unknown) => SupabaseQueryChain;
  select: (columns?: string) => SupabaseQueryChain;
  order: (column: string, value: unknown) => SupabaseQueryChain;
  limit: (value: unknown) => SupabaseQueryChain;
  maybeSingle: <T = unknown>() => Promise<{
    data: T | null;
    error: { message: string } | null;
  }>;
}

type CreateOAuthSupabaseClient = (
  supabaseUrl: string,
  supabaseKey: string,
) => OAuthSupabaseClient;

export interface OAuthTokenDependencies {
  createClient: CreateOAuthSupabaseClient;
  envGet: EnvGetter;
  generateRefreshToken: typeof generateRefreshToken;
  hashToken: typeof hashToken;
  now: () => Date;
  parsePrivateKey: typeof parsePrivateKey;
  randomUUID: () => string;
  signJwt: typeof signJWT;
  validateScopes: typeof validateScopes;
  verifyClientSecret: (
    clientSecret: string,
    clientSecretHash: string,
  ) => boolean;
  verifyPkce: typeof verifyPKCE;
}

const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 900;
const DEFAULT_REFRESH_TOKEN_TTL_SECONDS = 2_592_000;
const TOKEN_CORS_OPTIONS = {
  allowOrigin: "*",
  allowMethods: "POST, OPTIONS",
};

const defaultDependencies: OAuthTokenDependencies = {
  createClient: (supabaseUrl, supabaseKey) =>
    createSupabaseClient(
      supabaseUrl,
      supabaseKey,
    ) as unknown as OAuthSupabaseClient,
  envGet: (key) => Deno.env.get(key),
  generateRefreshToken,
  hashToken,
  now: () => new Date(),
  parsePrivateKey,
  randomUUID: () => crypto.randomUUID(),
  signJwt: signJWT,
  validateScopes,
  verifyClientSecret: (clientSecret, clientSecretHash) =>
    bcrypt.compareSync(clientSecret, clientSecretHash),
  verifyPkce: verifyPKCE,
};

function getRequiredEnv(key: string, envGet: EnvGetter): string {
  const value = envGet(key)?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

function parsePositiveIntegerEnv(
  envGet: EnvGetter,
  key: string,
  fallback: number,
): number {
  const rawValue = envGet(key)?.trim();
  if (!rawValue) {
    return fallback;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${key} must be a positive integer.`);
  }

  return parsed;
}

function isServerConfigurationError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message.startsWith("Missing required environment variable:") ||
      error.message.includes("OAUTH_ACCESS_TOKEN_TTL") ||
      error.message.includes("OAUTH_REFRESH_TOKEN_TTL"))
  );
}

function oauthErrorResponse(
  req: Request,
  status: number,
  error: OAuthErrorCode,
  errorDescription?: string,
): Response {
  const body: { error: OAuthErrorCode; error_description?: string } = { error };
  if (errorDescription) {
    body.error_description = errorDescription;
  }

  const headers: Record<string, string> = {
    ...buildCorsHeaders(req, TOKEN_CORS_OPTIONS),
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    Pragma: "no-cache",
  };

  if (error === "invalid_client") {
    headers["WWW-Authenticate"] = 'Basic realm="oauth-token"';
  }

  return new Response(JSON.stringify(body), { status, headers });
}

function tokenJsonResponse(
  req: Request,
  body: Record<string, unknown>,
): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      ...buildCorsHeaders(req, TOKEN_CORS_OPTIONS),
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      Pragma: "no-cache",
    },
  });
}

function methodNotAllowedResponse(req: Request): Response {
  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: {
      ...buildCorsHeaders(req, TOKEN_CORS_OPTIONS),
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      Pragma: "no-cache",
      Allow: "POST, OPTIONS",
    },
  });
}

function parseScopes(scope: string | null | undefined): string[] {
  return (scope ?? "")
    .split(/\s+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function scopeString(scopes: string[]): string {
  return Array.from(new Set(scopes)).join(" ");
}

function hasGrant(client: OAuthClientRow, grantType: string): boolean {
  return (
    Array.isArray(client.grant_types) && client.grant_types.includes(grantType)
  );
}

function getRequiredBodyParam(body: TokenBody, key: string): string | null {
  const value = body[key]?.trim();
  return value ? value : null;
}

function isJsonContentType(contentType: string): boolean {
  const [mediaType] = contentType.toLowerCase().split(";");
  return mediaType === "application/json" || mediaType.endsWith("+json");
}

function isFormContentType(contentType: string): boolean {
  const [mediaType] = contentType.toLowerCase().split(";");
  return mediaType === "application/x-www-form-urlencoded";
}

async function parseTokenBody(req: Request): Promise<TokenBody | null> {
  const contentType = req.headers.get("Content-Type") ?? "";
  if (isJsonContentType(contentType)) {
    try {
      const parsed = await req.json();
      if (
        typeof parsed !== "object" ||
        parsed === null ||
        Array.isArray(parsed)
      ) {
        return null;
      }

      const body: TokenBody = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value !== "string") {
          return null;
        }
        body[key] = value;
      }
      return body;
    } catch {
      return null;
    }
  }

  if (isFormContentType(contentType)) {
    try {
      const params = new URLSearchParams(await req.text());
      const body: TokenBody = {};
      for (const [key, value] of params.entries()) {
        body[key] = value;
      }
      return body;
    } catch {
      return null;
    }
  }

  return null;
}

function decodeBasicValue(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return value;
  }
}

function parseBasicClientCredentials(
  authorizationHeader: string | null,
):
  | { present: false }
  | { present: true; valid: true; clientId: string; clientSecret: string }
  | { present: true; valid: false } {
  if (!authorizationHeader?.trim()) {
    return { present: false };
  }

  const [scheme, encodedCredentials] = authorizationHeader
    .trim()
    .split(/\s+/, 2);
  if (scheme.toLowerCase() !== "basic" || !encodedCredentials) {
    return { present: true, valid: false };
  }

  try {
    const decoded = new TextDecoder().decode(
      Uint8Array.from(atob(encodedCredentials), (char) => char.charCodeAt(0)),
    );
    const delimiterIndex = decoded.indexOf(":");
    if (delimiterIndex < 0) {
      return { present: true, valid: false };
    }

    const clientId = decodeBasicValue(decoded.slice(0, delimiterIndex));
    const clientSecret = decodeBasicValue(decoded.slice(delimiterIndex + 1));
    if (!clientId || !clientSecret) {
      return { present: true, valid: false };
    }

    return { present: true, valid: true, clientId, clientSecret };
  } catch {
    return { present: true, valid: false };
  }
}

async function authenticateClient(
  req: Request,
  body: TokenBody,
  supabase: OAuthSupabaseClient,
  deps: OAuthTokenDependencies,
): Promise<
  { ok: true; client: OAuthClientRow } | { ok: false; response: Response }
> {
  const basicCredentials = parseBasicClientCredentials(
    req.headers.get("Authorization"),
  );
  if (basicCredentials.present && !basicCredentials.valid) {
    return {
      ok: false,
      response: oauthErrorResponse(req, 401, "invalid_client"),
    };
  }

  if (basicCredentials.present && body.client_secret?.trim()) {
    return {
      ok: false,
      response: oauthErrorResponse(
        req,
        400,
        "invalid_request",
        "Use only one client authentication method.",
      ),
    };
  }

  const clientId =
    basicCredentials.present && basicCredentials.valid
      ? basicCredentials.clientId
      : getRequiredBodyParam(body, "client_id");
  const clientSecret =
    basicCredentials.present && basicCredentials.valid
      ? basicCredentials.clientSecret
      : getRequiredBodyParam(body, "client_secret");

  if (
    basicCredentials.present &&
    basicCredentials.valid &&
    body.client_id?.trim() &&
    body.client_id.trim() !== basicCredentials.clientId
  ) {
    return {
      ok: false,
      response: oauthErrorResponse(req, 401, "invalid_client"),
    };
  }

  if (!clientId || !clientSecret) {
    return {
      ok: false,
      response: oauthErrorResponse(req, 401, "invalid_client"),
    };
  }

  const { data, error } = await maybeSingle<OAuthClientRow>(
    (
      supabase
        .from("oauth_clients")
        .select(
          "client_id, client_secret_hash, allowed_scopes, grant_types, is_active, is_first_party",
        ) as SupabaseQueryChain
    ).eq("client_id", clientId),
  );

  if (error) {
    console.error("[oauth-token] Client lookup failed", error.message);
    return {
      ok: false,
      response: oauthErrorResponse(req, 500, "server_error"),
    };
  }

  const client = data;
  if (!client || client.is_active === false || !client.client_secret_hash) {
    return {
      ok: false,
      response: oauthErrorResponse(req, 401, "invalid_client"),
    };
  }

  if (!deps.verifyClientSecret(clientSecret, client.client_secret_hash)) {
    return {
      ok: false,
      response: oauthErrorResponse(req, 401, "invalid_client"),
    };
  }

  return { ok: true, client };
}

async function maybeSingle<T>(query: unknown): Promise<{
  data: T | null;
  error: { message: string } | null;
}> {
  const result = await (query as SupabaseQueryChain).maybeSingle<T>();
  return result;
}

async function executeQuery(query: unknown): Promise<{
  data: unknown;
  error: { message: string } | null;
}> {
  return await (query as Promise<{
    data: unknown;
    error: { message: string } | null;
  }>);
}

async function fetchAuthorizationCode(
  supabase: OAuthSupabaseClient,
  codeHash: string,
): Promise<{
  data: AuthorizationCodeRow | null;
  error: { message: string } | null;
}> {
  return await maybeSingle<AuthorizationCodeRow>(
    (
      supabase
        .from("oauth_authorization_codes")
        .select(
          "id, client_id, user_id, redirect_uri, scope, code_challenge, code_challenge_method, expires_at, consumed_at",
        ) as SupabaseQueryChain
    ).eq("code", codeHash),
  );
}

async function consumeAuthorizationCode(
  supabase: OAuthSupabaseClient,
  codeId: string,
  consumedAt: string,
): Promise<{ consumed: boolean; error: { message: string } | null }> {
  const query = supabase
    .from("oauth_authorization_codes")
    .update({ consumed_at: consumedAt }) as SupabaseQueryChain;
  const { data, error } = await maybeSingle<{ id: string }>(
    query.eq("id", codeId).is("consumed_at", null).select("id"),
  );

  return { consumed: Boolean(data), error };
}

async function fetchRefreshToken(
  supabase: OAuthSupabaseClient,
  tokenHash: string,
): Promise<{
  data: RefreshTokenRow | null;
  error: { message: string } | null;
}> {
  return await maybeSingle<RefreshTokenRow>(
    (
      supabase
        .from("oauth_refresh_tokens")
        .select(
          "id, token_hash, client_id, user_id, scope, family_id, expires_at, revoked_at",
        ) as SupabaseQueryChain
    ).eq("token_hash", tokenHash),
  );
}

async function revokeRefreshTokenFamily(
  supabase: OAuthSupabaseClient,
  familyId: string,
  revokedAt: string,
): Promise<{ error: { message: string } | null }> {
  const query = supabase
    .from("oauth_refresh_tokens")
    .update({ revoked_at: revokedAt }) as SupabaseQueryChain;
  const { error } = await executeQuery(
    query.eq("family_id", familyId).is("revoked_at", null),
  );

  return { error };
}

async function revokeRefreshToken(
  supabase: OAuthSupabaseClient,
  refreshTokenId: string,
  revokedAt: string,
): Promise<{ revoked: boolean; error: { message: string } | null }> {
  const query = supabase
    .from("oauth_refresh_tokens")
    .update({ revoked_at: revokedAt }) as SupabaseQueryChain;
  const { data, error } = await maybeSingle<{ id: string }>(
    query.eq("id", refreshTokenId).is("revoked_at", null).select("id"),
  );

  return { revoked: Boolean(data), error };
}

async function insertRefreshToken(
  supabase: OAuthSupabaseClient,
  payload: Record<string, unknown>,
): Promise<{ error: { message: string } | null }> {
  const { error } = await executeQuery(
    supabase.from("oauth_refresh_tokens").insert(payload),
  );

  return { error };
}

async function fetchUserContext(
  supabase: OAuthSupabaseClient,
  userId: string,
): Promise<{ context: UserTokenContext; error: { message: string } | null }> {
  const context: UserTokenContext = {
    authUser: null,
    publicUser: null,
    companyProfile: null,
    subscription: null,
  };

  if (supabase.auth.admin?.getUserById) {
    const { data, error } = await supabase.auth.admin.getUserById(userId);
    if (error) {
      return { context, error };
    }
    context.authUser = data.user;
  }

  const publicUserQuery = supabase
    .from("users")
    .select(
      "tenant_id, full_name, name, email, last_sign_in_at",
    ) as SupabaseQueryChain;
  const { data: publicUser, error: publicUserError } =
    await maybeSingle<PublicUserProfile>(publicUserQuery.eq("id", userId));
  if (publicUserError) {
    return { context, error: publicUserError };
  }
  context.publicUser = publicUser;

  const companyProfileQuery = supabase
    .from("company_profiles")
    .select("company_name, feature_flags") as SupabaseQueryChain;
  const { data: companyProfile, error: companyProfileError } =
    await maybeSingle<CompanyProfile>(
      companyProfileQuery.eq("user_id", userId),
    );
  if (companyProfileError) {
    return { context, error: companyProfileError };
  }
  context.companyProfile = companyProfile;

  const subscriptionQuery = supabase
    .from("subscriptions")
    .select(
      "plan, tier, end_date, billing_interval, created_at",
    ) as SupabaseQueryChain;
  const { data: subscriptionRows, error: subscriptionError } =
    await executeQuery(
      subscriptionQuery
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1),
    );
  if (subscriptionError) {
    return { context, error: subscriptionError };
  }
  context.subscription = Array.isArray(subscriptionRows)
    ? ((subscriptionRows[0] as SubscriptionRow | undefined) ?? null)
    : null;

  return { context, error: null };
}

function getStringMetadataValue(
  metadata: Record<string, unknown> | null | undefined,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = metadata?.[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function getUserMetadata(
  authUser: AuthUser | null,
): Record<string, unknown> | null {
  return authUser?.user_metadata ?? authUser?.raw_user_meta_data ?? null;
}

function deriveSubscriptionClaims(
  subscription: SubscriptionRow | null,
  now: Date,
): Record<string, string> {
  if (!subscription) {
    return {
      subscription_plan: "none",
      subscription_status: "none",
    };
  }

  const plan = subscription.tier || subscription.plan || "unknown";
  const expiresAt = subscription.end_date ?? undefined;
  const expiresTime = expiresAt ? new Date(expiresAt).getTime() : Number.NaN;
  const isExpired =
    plan === "expired" ||
    (Number.isFinite(expiresTime) && expiresTime < now.getTime());
  const status = isExpired
    ? "expired"
    : plan === "free_trial"
      ? "trialing"
      : "active";
  const claims: Record<string, string> = {
    subscription_plan: plan,
    subscription_status: status,
  };
  if (expiresAt) {
    claims.subscription_expires_at = expiresAt;
  }
  if (subscription.billing_interval) {
    claims.subscription_billing_interval = subscription.billing_interval;
  }

  return claims;
}

function buildUserClaims(
  scopes: string[],
  userContext: UserTokenContext,
  now: Date,
): Record<string, unknown> {
  const claims: Record<string, unknown> = {};
  const authUser = userContext.authUser;
  const publicUser = userContext.publicUser;
  const companyProfile = userContext.companyProfile;
  const metadata = getUserMetadata(authUser);

  if (publicUser?.tenant_id) {
    claims.tenant_id = publicUser.tenant_id;
  }

  if (scopes.includes("email")) {
    const email = authUser?.email ?? publicUser?.email;
    if (email) {
      claims.email = email;
      claims.email_verified = Boolean(authUser?.email_confirmed_at);
    }
  }

  if (scopes.includes("profile")) {
    const name =
      publicUser?.full_name ||
      publicUser?.name ||
      getStringMetadataValue(metadata, ["full_name", "name"]) ||
      companyProfile?.company_name;
    const picture =
      getStringMetadataValue(metadata, ["avatar_url", "picture"]) ||
      (typeof companyProfile?.feature_flags?.company_logo_url === "string"
        ? companyProfile.feature_flags.company_logo_url
        : null);

    if (name) {
      claims.name = name;
    }
    if (picture) {
      claims.picture = picture;
    }
    if (companyProfile?.company_name) {
      claims.company_name = companyProfile.company_name;
    }
  }

  if (scopes.includes("subscription")) {
    Object.assign(
      claims,
      deriveSubscriptionClaims(userContext.subscription, now),
    );
  }

  return claims;
}

async function signAccessToken(params: {
  client: OAuthClientRow;
  deps: OAuthTokenDependencies;
  envGet: EnvGetter;
  expiresIn: number;
  grantType: string;
  now: Date;
  subject: string;
  scope: string;
  audience: string;
  additionalClaims?: Record<string, unknown>;
}): Promise<string> {
  const issuedAt = Math.floor(params.now.getTime() / 1000);
  const privateKey = await params.deps.parsePrivateKey();
  const kid = getRequiredEnv("OAUTH_JWT_KEY_ID", params.envGet);
  const issuer = getRequiredEnv("OAUTH_ISSUER", params.envGet);

  return await params.deps.signJwt(
    {
      iss: issuer,
      sub: params.subject,
      aud: params.audience,
      exp: issuedAt + params.expiresIn,
      iat: issuedAt,
      scope: params.scope,
      client_id: params.client.client_id,
      grant_type: params.grantType,
      ...params.additionalClaims,
    } satisfies JWTPayload,
    privateKey,
    kid,
  );
}

async function signIdToken(params: {
  client: OAuthClientRow;
  deps: OAuthTokenDependencies;
  envGet: EnvGetter;
  expiresIn: number;
  now: Date;
  subject: string;
  authTime?: number;
  additionalClaims?: Record<string, unknown>;
}): Promise<string> {
  const issuedAt = Math.floor(params.now.getTime() / 1000);
  const privateKey = await params.deps.parsePrivateKey();
  const kid = getRequiredEnv("OAUTH_JWT_KEY_ID", params.envGet);
  const issuer = getRequiredEnv("OAUTH_ISSUER", params.envGet);

  return await params.deps.signJwt(
    {
      iss: issuer,
      sub: params.subject,
      aud: params.client.client_id,
      exp: issuedAt + params.expiresIn,
      iat: issuedAt,
      auth_time: params.authTime ?? issuedAt,
      ...params.additionalClaims,
    } satisfies JWTPayload,
    privateKey,
    kid,
  );
}

async function issueUserTokenResponse(params: {
  req: Request;
  supabase: OAuthSupabaseClient;
  deps: OAuthTokenDependencies;
  client: OAuthClientRow;
  userId: string;
  scopes: string[];
  grantType: string;
  refreshTokenFamilyId?: string;
  refreshTokenParentId?: string;
}): Promise<Response> {
  const accessTokenTtl = parsePositiveIntegerEnv(
    params.deps.envGet,
    "OAUTH_ACCESS_TOKEN_TTL",
    DEFAULT_ACCESS_TOKEN_TTL_SECONDS,
  );
  const refreshTokenTtl = parsePositiveIntegerEnv(
    params.deps.envGet,
    "OAUTH_REFRESH_TOKEN_TTL",
    DEFAULT_REFRESH_TOKEN_TTL_SECONDS,
  );
  const now = params.deps.now();
  const scope = scopeString(params.scopes);
  const { context, error } = await fetchUserContext(
    params.supabase,
    params.userId,
  );
  if (error) {
    console.error("[oauth-token] User claim lookup failed", error.message);
    return oauthErrorResponse(params.req, 500, "server_error");
  }

  const userClaims = buildUserClaims(params.scopes, context, now);
  const accessToken = await signAccessToken({
    client: params.client,
    deps: params.deps,
    envGet: params.deps.envGet,
    expiresIn: accessTokenTtl,
    grantType: params.grantType,
    now,
    subject: params.userId,
    scope,
    audience: params.client.client_id,
    additionalClaims: userClaims,
  });

  const responseBody: Record<string, unknown> = {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: accessTokenTtl,
    scope,
  };

  if (params.scopes.includes("openid")) {
    const authTimeValue =
      context.authUser?.last_sign_in_at || context.publicUser?.last_sign_in_at;
    const authTime = authTimeValue
      ? Math.floor(new Date(authTimeValue).getTime() / 1000)
      : undefined;
    responseBody.id_token = await signIdToken({
      client: params.client,
      deps: params.deps,
      envGet: params.deps.envGet,
      expiresIn: accessTokenTtl,
      now,
      subject: params.userId,
      authTime: Number.isFinite(authTime) ? authTime : undefined,
      additionalClaims: userClaims,
    });
  }

  const plaintextRefreshToken = params.deps.generateRefreshToken();
  const refreshTokenHash = await params.deps.hashToken(plaintextRefreshToken);
  const expiresAt = new Date(
    now.getTime() + refreshTokenTtl * 1000,
  ).toISOString();
  const insertPayload = {
    token_hash: refreshTokenHash,
    client_id: params.client.client_id,
    user_id: params.userId,
    scope,
    family_id: params.refreshTokenFamilyId ?? params.deps.randomUUID(),
    parent_token_id: params.refreshTokenParentId ?? null,
    expires_at: expiresAt,
  };
  const { error: insertError } = await insertRefreshToken(
    params.supabase,
    insertPayload,
  );
  if (insertError) {
    console.error(
      "[oauth-token] Refresh token insert failed",
      insertError.message,
    );
    return oauthErrorResponse(params.req, 500, "server_error");
  }

  responseBody.refresh_token = plaintextRefreshToken;
  return tokenJsonResponse(params.req, responseBody);
}

async function handleAuthorizationCodeGrant(params: {
  req: Request;
  body: TokenBody;
  supabase: OAuthSupabaseClient;
  deps: OAuthTokenDependencies;
  client: OAuthClientRow;
}): Promise<Response> {
  if (!hasGrant(params.client, "authorization_code")) {
    return oauthErrorResponse(params.req, 400, "unauthorized_client");
  }

  const code = getRequiredBodyParam(params.body, "code");
  const redirectUri = getRequiredBodyParam(params.body, "redirect_uri");
  const codeVerifier = getRequiredBodyParam(params.body, "code_verifier");
  if (!code || !redirectUri || !codeVerifier) {
    return oauthErrorResponse(params.req, 400, "invalid_request");
  }

  const { data: authorizationCode, error } = await fetchAuthorizationCode(
    params.supabase,
    await params.deps.hashToken(code),
  );
  if (error) {
    console.error(
      "[oauth-token] Authorization code lookup failed",
      error.message,
    );
    return oauthErrorResponse(params.req, 500, "server_error");
  }

  const now = params.deps.now();
  if (
    !authorizationCode ||
    authorizationCode.client_id !== params.client.client_id ||
    authorizationCode.redirect_uri !== redirectUri ||
    authorizationCode.consumed_at ||
    new Date(authorizationCode.expires_at).getTime() <= now.getTime()
  ) {
    return oauthErrorResponse(params.req, 400, "invalid_grant");
  }

  const pkceValid = await params.deps.verifyPkce(
    codeVerifier,
    authorizationCode.code_challenge,
    authorizationCode.code_challenge_method,
  );
  if (!pkceValid) {
    return oauthErrorResponse(params.req, 400, "invalid_grant");
  }

  const consumedAt = now.toISOString();
  const { consumed, error: consumeError } = await consumeAuthorizationCode(
    params.supabase,
    authorizationCode.id,
    consumedAt,
  );
  if (consumeError) {
    console.error(
      "[oauth-token] Authorization code consume failed",
      consumeError.message,
    );
    return oauthErrorResponse(params.req, 500, "server_error");
  }
  if (!consumed) {
    return oauthErrorResponse(params.req, 400, "invalid_grant");
  }

  return await issueUserTokenResponse({
    req: params.req,
    supabase: params.supabase,
    deps: params.deps,
    client: params.client,
    userId: authorizationCode.user_id,
    scopes: parseScopes(authorizationCode.scope),
    grantType: "authorization_code",
  });
}

async function handleRefreshTokenGrant(params: {
  req: Request;
  body: TokenBody;
  supabase: OAuthSupabaseClient;
  deps: OAuthTokenDependencies;
  client: OAuthClientRow;
}): Promise<Response> {
  if (!hasGrant(params.client, "refresh_token")) {
    return oauthErrorResponse(params.req, 400, "unauthorized_client");
  }

  const refreshToken = getRequiredBodyParam(params.body, "refresh_token");
  if (!refreshToken) {
    return oauthErrorResponse(params.req, 400, "invalid_request");
  }

  const { data: storedToken, error } = await fetchRefreshToken(
    params.supabase,
    await params.deps.hashToken(refreshToken),
  );
  if (error) {
    console.error("[oauth-token] Refresh token lookup failed", error.message);
    return oauthErrorResponse(params.req, 500, "server_error");
  }

  const now = params.deps.now();
  if (!storedToken || storedToken.client_id !== params.client.client_id) {
    return oauthErrorResponse(params.req, 400, "invalid_grant");
  }

  if (storedToken.revoked_at) {
    const { error: revokeFamilyError } = await revokeRefreshTokenFamily(
      params.supabase,
      storedToken.family_id,
      now.toISOString(),
    );
    if (revokeFamilyError) {
      console.error(
        "[oauth-token] Refresh token family revocation failed",
        revokeFamilyError.message,
      );
      return oauthErrorResponse(params.req, 500, "server_error");
    }
    return oauthErrorResponse(params.req, 400, "invalid_grant");
  }

  if (new Date(storedToken.expires_at).getTime() <= now.getTime()) {
    return oauthErrorResponse(params.req, 400, "invalid_grant");
  }

  const existingScopes = parseScopes(storedToken.scope);
  const requestedScope = getRequiredBodyParam(params.body, "scope");
  const scopes = requestedScope ? parseScopes(requestedScope) : existingScopes;
  if (
    scopes.length === 0 ||
    !params.deps.validateScopes(scopes, existingScopes) ||
    !params.deps.validateScopes(scopes, params.client.allowed_scopes ?? [])
  ) {
    return oauthErrorResponse(params.req, 400, "invalid_scope");
  }

  const { revoked, error: revokeError } = await revokeRefreshToken(
    params.supabase,
    storedToken.id,
    now.toISOString(),
  );
  if (revokeError) {
    console.error(
      "[oauth-token] Refresh token revoke failed",
      revokeError.message,
    );
    return oauthErrorResponse(params.req, 500, "server_error");
  }
  if (!revoked) {
    const { error: revokeFamilyError } = await revokeRefreshTokenFamily(
      params.supabase,
      storedToken.family_id,
      now.toISOString(),
    );
    if (revokeFamilyError) {
      console.error(
        "[oauth-token] Refresh token family revocation failed",
        revokeFamilyError.message,
      );
      return oauthErrorResponse(params.req, 500, "server_error");
    }
    return oauthErrorResponse(params.req, 400, "invalid_grant");
  }

  return await issueUserTokenResponse({
    req: params.req,
    supabase: params.supabase,
    deps: params.deps,
    client: params.client,
    userId: storedToken.user_id,
    scopes,
    grantType: "refresh_token",
    refreshTokenFamilyId: storedToken.family_id,
    refreshTokenParentId: storedToken.id,
  });
}

async function handleClientCredentialsGrant(params: {
  req: Request;
  body: TokenBody;
  deps: OAuthTokenDependencies;
  client: OAuthClientRow;
}): Promise<Response> {
  if (!hasGrant(params.client, "client_credentials")) {
    return oauthErrorResponse(params.req, 400, "unauthorized_client");
  }

  const requestedScopes = parseScopes(params.body.scope);
  const scopes = requestedScopes.length > 0 ? requestedScopes : [];
  if (!params.deps.validateScopes(scopes, params.client.allowed_scopes ?? [])) {
    return oauthErrorResponse(params.req, 400, "invalid_scope");
  }

  const accessTokenTtl = parsePositiveIntegerEnv(
    params.deps.envGet,
    "OAUTH_ACCESS_TOKEN_TTL",
    DEFAULT_ACCESS_TOKEN_TTL_SECONDS,
  );
  const now = params.deps.now();
  const issuer = getRequiredEnv("OAUTH_ISSUER", params.deps.envGet);
  const scope = scopeString(scopes);
  const accessToken = await signAccessToken({
    client: params.client,
    deps: params.deps,
    envGet: params.deps.envGet,
    expiresIn: accessTokenTtl,
    grantType: "client_credentials",
    now,
    subject: params.client.client_id,
    audience: issuer,
    scope,
  });

  return tokenJsonResponse(params.req, {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: accessTokenTtl,
    scope,
  });
}

export async function handleOAuthToken(
  req: Request,
  deps: OAuthTokenDependencies = defaultDependencies,
): Promise<Response> {
  const corsResponse = handleCorsPreflight(req, TOKEN_CORS_OPTIONS);
  if (corsResponse) {
    return corsResponse;
  }

  if (req.method !== "POST") {
    return methodNotAllowedResponse(req);
  }

  try {
    const body = await parseTokenBody(req);
    if (!body) {
      return oauthErrorResponse(req, 400, "invalid_request");
    }

    const grantType = getRequiredBodyParam(body, "grant_type");
    if (!grantType) {
      return oauthErrorResponse(req, 400, "invalid_request");
    }

    const supabase = deps.createClient(
      getRequiredEnv("SUPABASE_URL", deps.envGet),
      getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY", deps.envGet),
    );
    const clientAuth = await authenticateClient(req, body, supabase, deps);
    if (!clientAuth.ok) {
      return clientAuth.response;
    }

    switch (grantType) {
      case "authorization_code":
        return await handleAuthorizationCodeGrant({
          req,
          body,
          supabase,
          deps,
          client: clientAuth.client,
        });
      case "refresh_token":
        return await handleRefreshTokenGrant({
          req,
          body,
          supabase,
          deps,
          client: clientAuth.client,
        });
      case "client_credentials":
        return await handleClientCredentialsGrant({
          req,
          body,
          deps,
          client: clientAuth.client,
        });
      default:
        return oauthErrorResponse(req, 400, "unsupported_grant_type");
    }
  } catch (error) {
    console.error("[oauth-token] Token request failed", error);
    if (isServerConfigurationError(error)) {
      return oauthErrorResponse(req, 500, "server_error");
    }
    return oauthErrorResponse(req, 400, "invalid_request");
  }
}

if (import.meta.main) {
  Deno.serve((req) => handleOAuthToken(req));
}
