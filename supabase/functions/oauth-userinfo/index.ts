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

interface PublicUserProfile {
  full_name?: string | null;
  name?: string | null;
}

interface CompanyProfile {
  company_name?: string | null;
  feature_flags?: Record<string, unknown> | null;
}

interface SubscriptionRow {
  plan?: string | null;
  tier?: string | null;
  end_date?: string | null;
  deleted_at?: string | null;
  max_connections?: number | null;
}

interface PlanDefinitionRow {
  max_products?: number | null;
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
  };
}

interface SupabaseQueryChain {
  eq: (column: string, value: unknown) => SupabaseQueryChain;
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

export interface OAuthUserinfoDependencies {
  createClient: CreateOAuthSupabaseClient;
  envGet: EnvGetter;
  now: () => Date;
  verifyAccessToken: (token: string) => Promise<VerifiedAccessToken>;
}

const USERINFO_CORS_OPTIONS = {
  allowOrigin: "*",
  allowMethods: "GET, POST, OPTIONS",
};

const defaultDependencies: OAuthUserinfoDependencies = {
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
};

function getRequiredEnv(key: string, envGet: EnvGetter): string {
  const value = envGet(key)?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
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

function buildAuthenticateHeader(params?: Record<string, string>): string {
  if (!params || Object.keys(params).length === 0) {
    return "Bearer";
  }

  const values = Object.entries(params).map(
    ([key, value]) => `${key}="${value.replace(/"/g, '\\"')}"`,
  );
  return `Bearer ${values.join(", ")}`;
}

function oauthBearerErrorResponse(
  req: Request,
  status: number,
  body: Record<string, string>,
  authenticateHeader: string,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...buildCorsHeaders(req, USERINFO_CORS_OPTIONS),
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      Pragma: "no-cache",
      "WWW-Authenticate": authenticateHeader,
    },
  });
}

function userinfoJsonResponse(
  req: Request,
  body: Record<string, unknown>,
): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      ...buildCorsHeaders(req, USERINFO_CORS_OPTIONS),
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
      ...buildCorsHeaders(req, USERINFO_CORS_OPTIONS),
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      Pragma: "no-cache",
      Allow: "GET, POST, OPTIONS",
    },
  });
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
    return effectivePlan === "free_trial" ? "canceled" : "canceled";
  }

  if (effectivePlan === "free_trial") {
    return "trialing";
  }

  return "active";
}

export async function handleOAuthUserinfo(
  req: Request,
  deps: OAuthUserinfoDependencies = defaultDependencies,
): Promise<Response> {
  const corsResponse = handleCorsPreflight(req, USERINFO_CORS_OPTIONS);
  if (corsResponse) {
    return corsResponse;
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return methodNotAllowedResponse(req);
  }

  const accessToken = parseBearerToken(req.headers.get("Authorization"));
  if (!accessToken) {
    return oauthBearerErrorResponse(
      req,
      401,
      { error: "invalid_token" },
      buildAuthenticateHeader(),
    );
  }

  let verifiedToken: VerifiedAccessToken;
  try {
    verifiedToken = await deps.verifyAccessToken(accessToken);
  } catch (_error) {
    return oauthBearerErrorResponse(
      req,
      401,
      { error: "invalid_token" },
      buildAuthenticateHeader({ error: "invalid_token" }),
    );
  }

  const scopes = parseScopes(verifiedToken.scope);
  if (
    verifiedToken.grant_type === "client_credentials" ||
    !scopes.includes("openid")
  ) {
    return oauthBearerErrorResponse(
      req,
      403,
      { error: "insufficient_scope" },
      buildAuthenticateHeader({ error: "insufficient_scope", scope: "openid" }),
    );
  }

  try {
    const supabase = deps.createClient(
      getRequiredEnv("SUPABASE_URL", deps.envGet),
      getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY", deps.envGet),
    );
    const now = deps.now();

    const authResult = await supabase.auth.admin?.getUserById(
      verifiedToken.sub,
    );
    if (authResult?.error) {
      console.error(
        "[oauth-userinfo] Failed to load auth user",
        authResult.error.message,
      );
      return new Response(JSON.stringify({ error: "server_error" }), {
        status: 500,
        headers: {
          ...buildCorsHeaders(req, USERINFO_CORS_OPTIONS),
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          Pragma: "no-cache",
        },
      });
    }

    const authUser = authResult?.data.user ?? null;
    if (!authUser?.id) {
      return oauthBearerErrorResponse(
        req,
        401,
        { error: "invalid_token" },
        buildAuthenticateHeader({ error: "invalid_token" }),
      );
    }

    const publicUserQuery = supabase
      .from("users")
      .select("full_name, name") as SupabaseQueryChain;
    const { data: publicUser, error: publicUserError } =
      await maybeSingle<PublicUserProfile>(
        publicUserQuery.eq("id", verifiedToken.sub),
      );
    if (publicUserError) {
      console.error(
        "[oauth-userinfo] Failed to load public user",
        publicUserError.message,
      );
      return new Response(JSON.stringify({ error: "server_error" }), {
        status: 500,
        headers: {
          ...buildCorsHeaders(req, USERINFO_CORS_OPTIONS),
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          Pragma: "no-cache",
        },
      });
    }

    const companyProfileQuery = supabase
      .from("company_profiles")
      .select("company_name, feature_flags") as SupabaseQueryChain;
    const { data: companyProfile, error: companyProfileError } =
      await maybeSingle<CompanyProfile>(
        companyProfileQuery.eq("user_id", verifiedToken.sub),
      );
    if (companyProfileError) {
      console.error(
        "[oauth-userinfo] Failed to load company profile",
        companyProfileError.message,
      );
      return new Response(JSON.stringify({ error: "server_error" }), {
        status: 500,
        headers: {
          ...buildCorsHeaders(req, USERINFO_CORS_OPTIONS),
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          Pragma: "no-cache",
        },
      });
    }

    const subscriptionQuery = supabase
      .from("subscriptions")
      .select(
        "plan, tier, end_date, deleted_at, max_connections, created_at",
      ) as SupabaseQueryChain;
    const { data: subscriptionRows, error: subscriptionError } =
      await executeQuery<SubscriptionRow[]>(
        subscriptionQuery
          .eq("user_id", verifiedToken.sub)
          .order("created_at", { ascending: false })
          .limit(1),
      );
    if (subscriptionError) {
      console.error(
        "[oauth-userinfo] Failed to load subscription",
        subscriptionError.message,
      );
      return new Response(JSON.stringify({ error: "server_error" }), {
        status: 500,
        headers: {
          ...buildCorsHeaders(req, USERINFO_CORS_OPTIONS),
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          Pragma: "no-cache",
        },
      });
    }

    const subscription = Array.isArray(subscriptionRows)
      ? (subscriptionRows[0] ?? null)
      : null;
    const effectivePlan = subscription?.tier || subscription?.plan || null;

    let planDefinition: PlanDefinitionRow | null = null;
    if (effectivePlan) {
      const planDefinitionQuery = supabase
        .from("plan_definitions")
        .select("max_products") as SupabaseQueryChain;
      const { data, error } = await maybeSingle<PlanDefinitionRow>(
        planDefinitionQuery.eq("plan", effectivePlan),
      );
      if (error) {
        console.error(
          "[oauth-userinfo] Failed to load plan definition",
          error.message,
        );
        return new Response(JSON.stringify({ error: "server_error" }), {
          status: 500,
          headers: {
            ...buildCorsHeaders(req, USERINFO_CORS_OPTIONS),
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
            Pragma: "no-cache",
          },
        });
      }
      planDefinition = data;
    }

    const metadata = getUserMetadata(authUser);
    const body: Record<string, unknown> = {
      sub: verifiedToken.sub,
    };

    if (scopes.includes("profile")) {
      body.name =
        getStringValue(metadata, ["full_name", "name"]) ||
        publicUser?.full_name ||
        publicUser?.name ||
        companyProfile?.company_name ||
        null;
      body.picture =
        typeof companyProfile?.feature_flags?.company_logo_url === "string"
          ? companyProfile.feature_flags.company_logo_url
          : getStringValue(metadata, ["avatar_url", "picture"]);
      body.company_name = companyProfile?.company_name ?? null;
    }

    if (scopes.includes("email")) {
      body.email = authUser.email ?? null;
      body.email_verified = Boolean(authUser.email_confirmed_at);
    }

    if (scopes.includes("subscription")) {
      body.subscription_plan = effectivePlan ?? "none";
      body.subscription_status = deriveSubscriptionStatus(subscription, now);
      body.subscription_expires_at = normalizeExpiresAt(subscription?.end_date);
      body.subscription_features = {
        max_sites: subscription?.max_connections ?? 0,
        max_products: planDefinition?.max_products ?? 0,
      };
    }

    return userinfoJsonResponse(req, body);
  } catch (error) {
    console.error("[oauth-userinfo] Failed to build userinfo response", error);
    return new Response(JSON.stringify({ error: "server_error" }), {
      status: 500,
      headers: {
        ...buildCorsHeaders(req, USERINFO_CORS_OPTIONS),
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        Pragma: "no-cache",
      },
    });
  }
}

if (import.meta.main) {
  Deno.serve((req) => handleOAuthUserinfo(req));
}
