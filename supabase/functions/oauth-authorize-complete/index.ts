import { createClient as createSupabaseClient } from "npm:@supabase/supabase-js@2";
import type { JWK, JWTPayload } from "npm:jose@6.2.2";

import { buildCorsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import {
  generateAuthorizationCode,
  getJWTKid,
  hashToken,
  verifyJWT,
} from "../_shared/oauth.ts";
import {
  normalizePublicJwk,
  type OAuthSigningKeyRow,
} from "../_shared/oauthMetadata.ts";

type EnvGetter = (key: string) => string | undefined;

interface AuthorizedUser {
  id?: string;
}

interface OAuthSupabaseClient {
  auth: {
    getUser: (token?: string) => Promise<{
      data: { user: AuthorizedUser | null };
      error: { message: string } | null;
    }>;
  };
  from: (table: string) => {
    select: (columns?: string) => {
      eq: (
        column: string,
        value: unknown,
      ) => {
        eq: (
          column: string,
          value: unknown,
        ) => {
          maybeSingle: () => Promise<{
            data: unknown;
            error: { message: string } | null;
          }>;
        };
      };
    };
    insert: (payload: unknown) => Promise<{
      data: unknown;
      error: { message: string } | null;
    }>;
  };
}

type CreateOAuthSupabaseClient = (
  supabaseUrl: string,
  supabaseKey: string,
) => OAuthSupabaseClient;

interface AuthorizeRequestClaims extends JWTPayload {
  request_type?: unknown;
  client_id?: unknown;
  redirect_uri?: unknown;
  scope?: unknown;
  state?: unknown;
  code_challenge?: unknown;
  code_challenge_method?: unknown;
}

export interface OAuthAuthorizeCompleteDependencies {
  createClient: CreateOAuthSupabaseClient;
  envGet: EnvGetter;
  generateAuthorizationCode: typeof generateAuthorizationCode;
  getJwtKid: typeof getJWTKid;
  hashToken: typeof hashToken;
  now: () => Date;
  normalizePublicJwk: typeof normalizePublicJwk;
  verifyJwt: typeof verifyJWT;
}

const REQUEST_JWT_AUDIENCE = "oauth-authorize-complete";
const DEFAULT_AUTHORIZATION_CODE_TTL_SECONDS = 600;

const defaultDependencies: OAuthAuthorizeCompleteDependencies = {
  createClient: (supabaseUrl, supabaseKey) =>
    createSupabaseClient(
      supabaseUrl,
      supabaseKey,
    ) as unknown as OAuthSupabaseClient,
  envGet: (key) => Deno.env.get(key),
  generateAuthorizationCode,
  getJwtKid: getJWTKid,
  hashToken,
  now: () => new Date(),
  normalizePublicJwk,
  verifyJwt: verifyJWT,
};

function getRequiredEnv(key: string, envGet: EnvGetter): string {
  const value = envGet(key)?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

function isServerConfigurationError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message.startsWith("Missing required environment variable:") ||
      error.message.includes("OAUTH_AUTHORIZATION_CODE_TTL"))
  );
}

function jsonResponse(req: Request, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...buildCorsHeaders(req, {
        allowOrigin: "*",
        allowMethods: "POST, OPTIONS",
      }),
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

async function readJsonBody(
  req: Request,
): Promise<Record<string, unknown> | null> {
  try {
    const parsed = await req.json();
    return typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function readRequiredString(
  value: unknown,
  fieldName: string,
): { value: string | null; error: string | null } {
  if (typeof value !== "string" || value.trim().length === 0) {
    return { value: null, error: `${fieldName} is required.` };
  }

  return { value: value.trim(), error: null };
}

function parseAuthorizationCodeTtl(envGet: EnvGetter): number {
  const rawValue = envGet("OAUTH_AUTHORIZATION_CODE_TTL")?.trim();
  if (!rawValue) {
    return DEFAULT_AUTHORIZATION_CODE_TTL_SECONDS;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("OAUTH_AUTHORIZATION_CODE_TTL must be a positive integer.");
  }

  return parsed;
}

function validateAuthorizeRequestClaims(payload: AuthorizeRequestClaims):
  | {
      valid: true;
      claims: {
        clientId: string;
        redirectUri: string;
        scope: string;
        state: string | null;
        codeChallenge: string;
        codeChallengeMethod: "S256";
      };
    }
  | { valid: false; error: string } {
  if (payload.request_type !== "oauth_authorize_request") {
    return { valid: false, error: "Unsupported authorization request type." };
  }

  const clientId = readRequiredString(payload.client_id, "client_id");
  const redirectUri = readRequiredString(payload.redirect_uri, "redirect_uri");
  const scope = readRequiredString(payload.scope, "scope");
  const codeChallenge = readRequiredString(
    payload.code_challenge,
    "code_challenge",
  );

  const firstError = [clientId, redirectUri, scope, codeChallenge].find(
    (item) => item.error,
  );
  if (firstError?.error) {
    return { valid: false, error: firstError.error };
  }

  if (
    !clientId.value ||
    !redirectUri.value ||
    !scope.value ||
    !codeChallenge.value
  ) {
    return { valid: false, error: "Authorization request is missing fields." };
  }

  if (payload.code_challenge_method !== "S256") {
    return { valid: false, error: "code_challenge_method must be S256." };
  }

  const state =
    typeof payload.state === "string" && payload.state.length > 0
      ? payload.state
      : null;

  return {
    valid: true,
    claims: {
      clientId: clientId.value,
      redirectUri: redirectUri.value,
      scope: scope.value,
      state,
      codeChallenge: codeChallenge.value,
      codeChallengeMethod: "S256",
    },
  };
}

async function fetchActiveSigningKey(
  kid: string,
  supabase: OAuthSupabaseClient,
): Promise<{ row: OAuthSigningKeyRow | null; error: string | null }> {
  const { data, error } = await supabase
    .from("oauth_signing_keys")
    .select("kid, kty, alg, public_key_jwk")
    .eq("kid", kid)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    return { row: null, error: error.message };
  }

  return { row: data as OAuthSigningKeyRow | null, error: null };
}

function buildRedirectUrl(
  redirectUri: string,
  code: string,
  state: string | null,
): string {
  const url = new URL(redirectUri);
  url.searchParams.set("code", code);
  if (state) {
    url.searchParams.set("state", state);
  }

  return url.toString();
}

export async function handleOAuthAuthorizeComplete(
  req: Request,
  deps: OAuthAuthorizeCompleteDependencies = defaultDependencies,
): Promise<Response> {
  const corsResponse = handleCorsPreflight(req, {
    allowOrigin: "*",
    allowMethods: "POST, OPTIONS",
  });
  if (corsResponse) {
    return corsResponse;
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: {
        ...buildCorsHeaders(req, {
          allowOrigin: "*",
          allowMethods: "POST, OPTIONS",
        }),
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        Allow: "POST, OPTIONS",
      },
    });
  }

  try {
    const body = await readJsonBody(req);
    if (!body) {
      return jsonResponse(req, 400, { error: "invalid_request" });
    }

    const requestJwt = readRequiredString(body.request_jwt, "request_jwt");
    const accessToken = readRequiredString(body.access_token, "access_token");
    if (requestJwt.error || accessToken.error) {
      return jsonResponse(req, 400, { error: "invalid_request" });
    }

    const supabase = deps.createClient(
      getRequiredEnv("SUPABASE_URL", deps.envGet),
      getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY", deps.envGet),
    );

    if (!requestJwt.value || !accessToken.value) {
      return jsonResponse(req, 400, { error: "invalid_request" });
    }

    const kid = deps.getJwtKid(requestJwt.value);
    const { row: signingKeyRow, error: signingKeyError } =
      await fetchActiveSigningKey(kid, supabase);
    if (signingKeyError) {
      console.error(
        "[oauth-authorize-complete] Signing key lookup failed",
        signingKeyError,
      );
      return jsonResponse(req, 500, { error: "server_error" });
    }
    if (!signingKeyRow) {
      return jsonResponse(req, 401, { error: "invalid_request" });
    }

    const publicJwk = deps.normalizePublicJwk(signingKeyRow) as JWK;
    const payload = (await deps.verifyJwt(requestJwt.value, publicJwk, {
      issuer: getRequiredEnv("OAUTH_ISSUER", deps.envGet),
      audience: REQUEST_JWT_AUDIENCE,
    })) as AuthorizeRequestClaims;

    const validation = validateAuthorizeRequestClaims(payload);
    if (!validation.valid) {
      return jsonResponse(req, 400, { error: "invalid_request" });
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(accessToken.value);

    if (authError || !user?.id) {
      return jsonResponse(req, 401, { error: "invalid_token" });
    }

    const plaintextCode = deps.generateAuthorizationCode();
    const codeHash = await deps.hashToken(plaintextCode);
    const ttlSeconds = parseAuthorizationCodeTtl(deps.envGet);
    const expiresAt = new Date(
      deps.now().getTime() + ttlSeconds * 1000,
    ).toISOString();

    const { error: insertError } = await supabase
      .from("oauth_authorization_codes")
      .insert({
        code: codeHash,
        client_id: validation.claims.clientId,
        user_id: user.id,
        redirect_uri: validation.claims.redirectUri,
        scope: validation.claims.scope,
        code_challenge: validation.claims.codeChallenge,
        code_challenge_method: validation.claims.codeChallengeMethod,
        expires_at: expiresAt,
      });

    if (insertError) {
      console.error(
        "[oauth-authorize-complete] Authorization code insert failed",
        insertError.message,
      );
      return jsonResponse(req, 500, { error: "server_error" });
    }

    return jsonResponse(req, 200, {
      redirectUrl: buildRedirectUrl(
        validation.claims.redirectUri,
        plaintextCode,
        validation.claims.state,
      ),
    });
  } catch (error) {
    console.error(
      "[oauth-authorize-complete] Authorization completion failed",
      error,
    );
    if (isServerConfigurationError(error)) {
      return jsonResponse(req, 500, { error: "server_error" });
    }

    return jsonResponse(req, 401, { error: "invalid_request" });
  }
}

if (import.meta.main) {
  Deno.serve((req) => handleOAuthAuthorizeComplete(req));
}
