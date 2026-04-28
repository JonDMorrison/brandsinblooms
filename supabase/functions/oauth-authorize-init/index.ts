import { createClient } from "npm:@supabase/supabase-js@2";

import { buildCorsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import {
  parsePrivateKey,
  signJWT,
  validateRedirectUri,
  validateScopes,
} from "../_shared/oauth.ts";

type EnvGetter = (key: string) => string | undefined;

interface OAuthClientRow {
  client_id: string;
  client_name: string;
  redirect_uris: string[];
  allowed_scopes: string[];
  is_active: boolean;
  is_first_party: boolean;
}

export interface OAuthAuthorizeInitDependencies {
  createClient: typeof createClient;
  envGet: EnvGetter;
  parsePrivateKey: typeof parsePrivateKey;
  randomUUID: () => string;
  signJwt: typeof signJWT;
}

const REQUEST_JWT_AUDIENCE = "oauth-authorize-complete";
const REQUEST_JWT_TTL_SECONDS = 300;
const REQUIRED_PARAMS = [
  "response_type",
  "client_id",
  "redirect_uri",
  "scope",
  "state",
  "code_challenge",
  "code_challenge_method",
] as const;
const CODE_CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{43,128}$/;

const defaultDependencies: OAuthAuthorizeInitDependencies = {
  createClient,
  envGet: (key) => Deno.env.get(key),
  parsePrivateKey,
  randomUUID: () => crypto.randomUUID(),
  signJwt: signJWT,
};

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function getRequiredEnv(key: string, envGet: EnvGetter): string {
  const value = envGet(key)?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

function getAppOrigin(envGet: EnvGetter): string {
  const value =
    envGet("APP_ORIGIN") ||
    envGet("APP_BASE_URL") ||
    envGet("SITE_URL") ||
    "https://bloomsuite.app";

  return new URL(trimTrailingSlash(value)).origin;
}

function parseScopes(scope: string): string[] {
  return scope
    .split(/\s+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function buildErrorPage(status: number): Response {
  return new Response(
    `<!doctype html><html><head><title>Authorization request failed</title></head><body><h1>Authorization request failed</h1><p>The OAuth authorization request could not be processed.</p></body></html>`,
    {
      status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  );
}

function redirectWithOAuthError(
  redirectUri: string,
  state: string | null,
  error: string,
  errorDescription: string,
): Response {
  const url = new URL(redirectUri);
  url.searchParams.set("error", error);
  url.searchParams.set("error_description", errorDescription);
  if (state) {
    url.searchParams.set("state", state);
  }

  return Response.redirect(url.toString(), 302);
}

function missingRequiredParams(searchParams: URLSearchParams): string[] {
  return REQUIRED_PARAMS.filter((param) => !searchParams.get(param)?.trim());
}

async function fetchOAuthClient(
  clientId: string,
  deps: OAuthAuthorizeInitDependencies,
): Promise<{ client: OAuthClientRow | null; error: string | null }> {
  const supabase = deps.createClient(
    getRequiredEnv("SUPABASE_URL", deps.envGet),
    getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY", deps.envGet),
  );

  const { data, error } = await supabase
    .from("oauth_clients")
    .select(
      "client_id, client_name, redirect_uris, allowed_scopes, is_active, is_first_party",
    )
    .eq("client_id", clientId)
    .maybeSingle();

  if (error) {
    return { client: null, error: error.message };
  }

  return { client: data as OAuthClientRow | null, error: null };
}

export async function handleOAuthAuthorizeInit(
  req: Request,
  deps: OAuthAuthorizeInitDependencies = defaultDependencies,
): Promise<Response> {
  const corsResponse = handleCorsPreflight(req, {
    allowOrigin: "*",
    allowMethods: "GET, OPTIONS",
  });
  if (corsResponse) {
    return corsResponse;
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: {
        ...buildCorsHeaders(req, {
          allowOrigin: "*",
          allowMethods: "GET, OPTIONS",
        }),
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        Allow: "GET, OPTIONS",
      },
    });
  }

  try {
    const requestUrl = new URL(req.url);
    const clientId = requestUrl.searchParams.get("client_id")?.trim();
    const redirectUri = requestUrl.searchParams.get("redirect_uri")?.trim();

    if (!clientId || !redirectUri) {
      return buildErrorPage(400);
    }

    const { client, error } = await fetchOAuthClient(clientId, deps);
    if (error) {
      console.error("[oauth-authorize-init] Client lookup failed", error);
      return buildErrorPage(500);
    }

    if (!client || client.is_active === false) {
      return buildErrorPage(400);
    }

    if (!validateRedirectUri(redirectUri, client.redirect_uris ?? [])) {
      return buildErrorPage(400);
    }

    const state = requestUrl.searchParams.get("state")?.trim() || null;
    const missingParams = missingRequiredParams(requestUrl.searchParams);
    if (missingParams.length > 0) {
      return redirectWithOAuthError(
        redirectUri,
        state,
        "invalid_request",
        "The authorization request is missing required parameters.",
      );
    }

    const responseType = requestUrl.searchParams.get("response_type")!.trim();
    if (responseType !== "code") {
      return redirectWithOAuthError(
        redirectUri,
        state,
        "unsupported_response_type",
        "Only the authorization code response type is supported.",
      );
    }

    const codeChallengeMethod = requestUrl.searchParams
      .get("code_challenge_method")!
      .trim();
    if (codeChallengeMethod !== "S256") {
      return redirectWithOAuthError(
        redirectUri,
        state,
        "invalid_request",
        "PKCE code_challenge_method must be S256.",
      );
    }

    const codeChallenge = requestUrl.searchParams.get("code_challenge")!.trim();
    if (!CODE_CHALLENGE_PATTERN.test(codeChallenge)) {
      return redirectWithOAuthError(
        redirectUri,
        state,
        "invalid_request",
        "PKCE code_challenge is malformed.",
      );
    }

    const scope = requestUrl.searchParams.get("scope")!.trim();
    const requestedScopes = parseScopes(scope);
    if (
      !requestedScopes.includes("openid") ||
      !validateScopes(requestedScopes, client.allowed_scopes ?? [])
    ) {
      return redirectWithOAuthError(
        redirectUri,
        state,
        "invalid_scope",
        "The requested scope is not allowed for this client.",
      );
    }

    const requestId = deps.randomUUID();
    const issuer = getRequiredEnv("OAUTH_ISSUER", deps.envGet);
    const keyId = getRequiredEnv("OAUTH_JWT_KEY_ID", deps.envGet);
    const privateKey = await deps.parsePrivateKey();
    const now = Math.floor(Date.now() / 1000);
    const requestJwt = await deps.signJwt(
      {
        iss: issuer,
        aud: REQUEST_JWT_AUDIENCE,
        exp: now + REQUEST_JWT_TTL_SECONDS,
        jti: requestId,
        request_type: "oauth_authorize_request",
        client_id: client.client_id,
        client_name: client.client_name,
        redirect_uri: redirectUri,
        scope,
        state,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
        is_first_party: client.is_first_party,
      },
      privateKey,
      keyId,
    );

    const spaAuthorizeUrl = new URL(
      "/oauth/authorize",
      getAppOrigin(deps.envGet),
    );
    spaAuthorizeUrl.searchParams.set("request_jwt", requestJwt);
    spaAuthorizeUrl.searchParams.set("request_id", requestId);

    return Response.redirect(spaAuthorizeUrl.toString(), 302);
  } catch (error) {
    console.error("[oauth-authorize-init] Authorization request failed", error);
    return buildErrorPage(500);
  }
}

if (import.meta.main) {
  Deno.serve((req) => handleOAuthAuthorizeInit(req));
}
