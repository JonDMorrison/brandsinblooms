import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { buildCorsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import {
  buildSubscriptionSnapshot,
  getEffectivePlan,
  type PlanDefinitionShape,
  type SubscriptionRecordShape,
} from "../_shared/subscriptionSnapshot.ts";
import {
  type VerifiedAccessToken,
  verifyAccessToken as verifyOAuthAccessToken,
} from "../_shared/verifyAccessToken.ts";

type EnvGetter = (key: string) => string | undefined;

interface PublicUserRow {
  id?: string;
  tenant_id?: string | null;
}

interface OAuthSupabaseClient {
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

export interface OAuthSubscriptionStatusDependencies {
  createClient: CreateOAuthSupabaseClient;
  envGet: EnvGetter;
  now: () => Date;
  verifyAccessToken: (token: string) => Promise<VerifiedAccessToken>;
}

const SUBSCRIPTION_STATUS_CORS_OPTIONS = {
  allowOrigin: "*",
  allowMethods: "GET, OPTIONS",
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const defaultDependencies: OAuthSubscriptionStatusDependencies = {
  createClient: (supabaseUrl, supabaseKey) =>
    createSupabaseClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    }) as unknown as OAuthSupabaseClient,
  envGet: (key) => Deno.env.get(key),
  now: () => new Date(),
  verifyAccessToken: (token) =>
    verifyOAuthAccessToken(token, {
      createClient: (supabaseUrl, supabaseKey) =>
        createSupabaseClient(supabaseUrl, supabaseKey, {
          auth: { persistSession: false },
        }) as unknown as OAuthSupabaseClient,
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

function parseScopes(scope: string): string[] {
  return scope
    .split(/\s+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

async function maybeSingle<T>(query: unknown): Promise<{
  data: T | null;
  error: { message: string } | null;
}> {
  return await (query as SupabaseQueryChain).maybeSingle<T>();
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

function jsonResponse(
  req: Request,
  status: number,
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...buildCorsHeaders(req, SUBSCRIPTION_STATUS_CORS_OPTIONS),
      "Content-Type": "application/json",
      ...headers,
    },
  });
}

function oauthErrorResponse(
  req: Request,
  status: number,
  body: Record<string, string>,
  authenticateHeader?: string,
): Response {
  return jsonResponse(
    req,
    status,
    body,
    authenticateHeader ? { "WWW-Authenticate": authenticateHeader } : {},
  );
}

function methodNotAllowedResponse(req: Request): Response {
  return jsonResponse(
    req,
    405,
    { error: "Method not allowed" },
    { Allow: "GET, OPTIONS" },
  );
}

function hasSubscriptionScope(token: VerifiedAccessToken): boolean {
  const scopes = parseScopes(token.scope);
  return (
    scopes.includes("subscription:read") || scopes.includes("subscription")
  );
}

function resolveTargetUserId(
  req: Request,
  token: VerifiedAccessToken,
): { userId: string | null; error: Response | null } {
  if (token.grant_type === "client_credentials") {
    const userId = new URL(req.url).searchParams.get("user_id")?.trim() ?? "";

    if (!userId) {
      return {
        userId: null,
        error: oauthErrorResponse(req, 400, {
          error: "invalid_request",
          error_description:
            "client_credentials tokens must include a user_id query parameter.",
        }),
      };
    }

    if (!UUID_PATTERN.test(userId)) {
      return {
        userId: null,
        error: oauthErrorResponse(req, 400, {
          error: "invalid_request",
          error_description: "user_id must be a valid UUID.",
        }),
      };
    }

    return { userId, error: null };
  }

  return {
    userId: token.sub,
    error: null,
  };
}

export async function handleOAuthSubscriptionStatus(
  req: Request,
  deps: OAuthSubscriptionStatusDependencies = defaultDependencies,
): Promise<Response> {
  const corsResponse = handleCorsPreflight(
    req,
    SUBSCRIPTION_STATUS_CORS_OPTIONS,
  );
  if (corsResponse) {
    return corsResponse;
  }

  if (req.method !== "GET") {
    return methodNotAllowedResponse(req);
  }

  const accessToken = parseBearerToken(req.headers.get("Authorization"));
  if (!accessToken) {
    return oauthErrorResponse(
      req,
      401,
      {
        error: "invalid_token",
        error_description: "A Bearer access token is required.",
      },
      buildAuthenticateHeader({ error: "invalid_token" }),
    );
  }

  let verifiedToken: VerifiedAccessToken;
  try {
    verifiedToken = await deps.verifyAccessToken(accessToken);
  } catch (error) {
    return oauthErrorResponse(
      req,
      401,
      {
        error: "invalid_token",
        error_description:
          error instanceof Error ? error.message : "Access token is invalid.",
      },
      buildAuthenticateHeader({ error: "invalid_token" }),
    );
  }

  if (!hasSubscriptionScope(verifiedToken)) {
    return oauthErrorResponse(
      req,
      403,
      {
        error: "insufficient_scope",
        error_description:
          "The access token must include subscription:read or subscription scope.",
      },
      buildAuthenticateHeader({
        error: "insufficient_scope",
        scope: "subscription:read subscription",
      }),
    );
  }

  const resolvedTarget = resolveTargetUserId(req, verifiedToken);
  if (resolvedTarget.error) {
    return resolvedTarget.error;
  }

  const supabaseUrl = getRequiredEnv("SUPABASE_URL", deps.envGet);
  const serviceRoleKey = getRequiredEnv(
    "SUPABASE_SERVICE_ROLE_KEY",
    deps.envGet,
  );
  const supabaseClient = deps.createClient(supabaseUrl, serviceRoleKey);

  const userQuery = supabaseClient
    .from("users")
    .select("id, tenant_id") as SupabaseQueryChain;
  const userResult = await maybeSingle<PublicUserRow>(
    userQuery.eq("id", resolvedTarget.userId),
  );

  if (userResult.error) {
    throw new Error(`Failed to load user: ${userResult.error.message}`);
  }

  if (!userResult.data?.id) {
    return jsonResponse(req, 404, {
      error: "not_found",
      error_description: "User not found.",
    });
  }

  const subscriptionQuery = supabaseClient
    .from("subscriptions")
    .select(
      "plan, tier, status, billing_interval, current_period_start, current_period_end, cancel_at_period_end, trial_end, start_date, end_date, deleted_at, max_connections",
    ) as SupabaseQueryChain;
  const subscriptionResult = await maybeSingle<SubscriptionRecordShape>(
    subscriptionQuery
      .eq("user_id", resolvedTarget.userId)
      .order("created_at", { ascending: false })
      .limit(1),
  );

  if (subscriptionResult.error) {
    throw new Error(
      `Failed to load subscription: ${subscriptionResult.error.message}`,
    );
  }

  const effectivePlan = getEffectivePlan(subscriptionResult.data);
  let planDefinition: PlanDefinitionShape | null = null;

  if (effectivePlan) {
    const planDefinitionQuery = supabaseClient
      .from("plan_definitions")
      .select("max_products") as SupabaseQueryChain;
    const planDefinitionResult = await maybeSingle<PlanDefinitionShape>(
      planDefinitionQuery.eq("plan", effectivePlan),
    );

    if (planDefinitionResult.error) {
      throw new Error(
        `Failed to load plan definition: ${planDefinitionResult.error.message}`,
      );
    }

    planDefinition = planDefinitionResult.data;
  }

  const snapshot = buildSubscriptionSnapshot(
    subscriptionResult.data,
    planDefinition,
    deps.now(),
  );

  return jsonResponse(req, 200, {
    user_id: resolvedTarget.userId,
    tenant_id: userResult.data.tenant_id ?? null,
    subscription: snapshot,
  });
}

Deno.serve((req) => handleOAuthSubscriptionStatus(req));
