import { buildCorsHeaders } from "./cors.ts";

export const OIDC_SCOPES_SUPPORTED = [
  "openid",
  "profile",
  "email",
  "subscription",
  "user:provision",
  "subscription:read",
] as const;

export const OIDC_RESPONSE_TYPES_SUPPORTED = ["code"] as const;

export const OIDC_GRANT_TYPES_SUPPORTED = [
  "authorization_code",
  "refresh_token",
  "client_credentials",
] as const;

export const OIDC_SUBJECT_TYPES_SUPPORTED = ["public"] as const;

export const OIDC_ID_TOKEN_SIGNING_ALGS = ["RS256"] as const;

export const OIDC_TOKEN_ENDPOINT_AUTH_METHODS = [
  "client_secret_post",
  "client_secret_basic",
] as const;

export const OIDC_CODE_CHALLENGE_METHODS = ["S256"] as const;

export const OIDC_CLAIMS_SUPPORTED = [
  "sub",
  "iss",
  "aud",
  "exp",
  "iat",
  "email",
  "email_verified",
  "name",
  "picture",
  "subscription_plan",
  "subscription_status",
  "subscription_expires_at",
] as const;

const PUBLIC_METADATA_CACHE_CONTROL = "public, max-age=3600";
const METHOD_NOT_ALLOWED_CACHE_CONTROL = "no-store";

type EnvGetter = (key: string) => string | undefined;

export interface OAuthSigningKeyRow {
  kid: string;
  kty: string;
  alg: string;
  created_at?: string;
  public_key_jwk: unknown;
}

type JsonResponseOptions = {
  status?: number;
  headers?: Record<string, string>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(
  record: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function getRequiredEnv(key: string, envGet: EnvGetter): string {
  const value = envGet(key)?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

export function getFunctionsBaseUrl(envGet: EnvGetter): string {
  const supabaseUrl = getRequiredEnv("SUPABASE_URL", envGet);
  return `${stripTrailingSlash(supabaseUrl)}/functions/v1`;
}

export function buildDiscoveryDocument(envGet: EnvGetter) {
  const issuer = getRequiredEnv("OAUTH_ISSUER", envGet);
  const functionsBaseUrl = getFunctionsBaseUrl(envGet);

  return {
    issuer,
    authorization_endpoint: `${functionsBaseUrl}/oauth-authorize-init`,
    token_endpoint: `${functionsBaseUrl}/oauth-token`,
    userinfo_endpoint: `${functionsBaseUrl}/oauth-userinfo`,
    revocation_endpoint: `${functionsBaseUrl}/oauth-revoke`,
    jwks_uri: `${functionsBaseUrl}/oauth-jwks`,
    scopes_supported: [...OIDC_SCOPES_SUPPORTED],
    response_types_supported: [...OIDC_RESPONSE_TYPES_SUPPORTED],
    grant_types_supported: [...OIDC_GRANT_TYPES_SUPPORTED],
    subject_types_supported: [...OIDC_SUBJECT_TYPES_SUPPORTED],
    id_token_signing_alg_values_supported: [...OIDC_ID_TOKEN_SIGNING_ALGS],
    token_endpoint_auth_methods_supported: [
      ...OIDC_TOKEN_ENDPOINT_AUTH_METHODS,
    ],
    code_challenge_methods_supported: [...OIDC_CODE_CHALLENGE_METHODS],
    claims_supported: [...OIDC_CLAIMS_SUPPORTED],
  };
}

export function buildPublicJsonResponse(
  req: Request,
  data: unknown,
  options: JsonResponseOptions = {},
): Response {
  const { status = 200, headers: additionalHeaders = {} } = options;

  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...buildCorsHeaders(req, {
        allowOrigin: "*",
        allowMethods: "GET, OPTIONS",
      }),
      "Content-Type": "application/json",
      "Cache-Control": PUBLIC_METADATA_CACHE_CONTROL,
      ...additionalHeaders,
    },
  });
}

export function methodNotAllowedResponse(req: Request): Response {
  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: {
      ...buildCorsHeaders(req, {
        allowOrigin: "*",
        allowMethods: "GET, OPTIONS",
      }),
      "Content-Type": "application/json",
      "Cache-Control": METHOD_NOT_ALLOWED_CACHE_CONTROL,
      Allow: "GET, OPTIONS",
    },
  });
}

export function internalServerErrorResponse(req: Request): Response {
  return new Response(JSON.stringify({ error: "Internal server error" }), {
    status: 500,
    headers: {
      ...buildCorsHeaders(req, {
        allowOrigin: "*",
        allowMethods: "GET, OPTIONS",
      }),
      "Content-Type": "application/json",
      "Cache-Control": METHOD_NOT_ALLOWED_CACHE_CONTROL,
    },
  });
}

export function normalizePublicJwk(row: OAuthSigningKeyRow) {
  if (!isRecord(row.public_key_jwk)) {
    throw new Error(`Signing key ${row.kid} is missing a public JWK object.`);
  }

  const kid = getString(row.public_key_jwk, "kid") ?? row.kid;
  const kty = getString(row.public_key_jwk, "kty") ?? row.kty;
  const alg = getString(row.public_key_jwk, "alg") ?? row.alg;
  const use = getString(row.public_key_jwk, "use") ?? "sig";

  if (kty === "RSA") {
    const n = getString(row.public_key_jwk, "n");
    const e = getString(row.public_key_jwk, "e");

    if (!n || !e) {
      throw new Error(`Signing key ${kid} is missing RSA public components.`);
    }

    return { kty, kid, alg, use, n, e };
  }

  if (kty === "OKP") {
    const crv = getString(row.public_key_jwk, "crv");
    const x = getString(row.public_key_jwk, "x");

    if (!crv || !x) {
      throw new Error(`Signing key ${kid} is missing OKP public components.`);
    }

    return { kty, kid, alg, use, crv, x };
  }

  throw new Error(`Signing key ${kid} has unsupported key type ${kty}.`);
}
