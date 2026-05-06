import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { importJWK, jwtVerify, type JWK } from "jose";

import { getJWTKid } from "./oauth.ts";

type EnvGetter = (key: string) => string | undefined;

interface OAuthSigningKeyRow {
  kid: string;
  alg: string;
  public_key_jwk: unknown;
  is_active?: boolean;
}

interface SupabaseQueryChain {
  eq: (column: string, value: unknown) => SupabaseQueryChain;
  maybeSingle: <T = unknown>() => Promise<{
    data: T | null;
    error: { message: string } | null;
  }>;
}

interface OAuthSupabaseClient {
  from: (table: string) => {
    select: (columns?: string) => unknown;
  };
}

type CreateOAuthSupabaseClient = (
  supabaseUrl: string,
  supabaseKey: string,
) => OAuthSupabaseClient;

export interface VerifiedAccessToken {
  sub: string;
  scope: string;
  client_id: string;
  grant_type?: string;
  exp: number;
  iat: number;
  iss: string;
  aud: string;
}

export interface VerifyAccessTokenDependencies {
  createClient: CreateOAuthSupabaseClient;
  envGet: EnvGetter;
}

const cachedSigningKeys = new Map<string, CryptoKey>();

const defaultDependencies: VerifyAccessTokenDependencies = {
  createClient: (supabaseUrl, supabaseKey) =>
    createSupabaseClient(
      supabaseUrl,
      supabaseKey,
    ) as unknown as OAuthSupabaseClient,
  envGet: (key) => Deno.env.get(key),
};

function getRequiredEnv(key: string, envGet: EnvGetter): string {
  const value = envGet(key)?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getRequiredString(
  record: Record<string, unknown>,
  key: string,
): string {
  const value = record[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Access token is missing the ${key} claim.`);
  }

  return value;
}

function getRequiredNumber(
  record: Record<string, unknown>,
  key: string,
): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Access token is missing the ${key} claim.`);
  }

  return value;
}

function normalizeJwk(row: OAuthSigningKeyRow): JWK {
  if (!isRecord(row.public_key_jwk)) {
    throw new Error(`Signing key ${row.kid} is missing a public JWK.`);
  }

  return {
    ...row.public_key_jwk,
    kid:
      typeof row.public_key_jwk.kid === "string"
        ? row.public_key_jwk.kid
        : row.kid,
    alg:
      typeof row.public_key_jwk.alg === "string"
        ? row.public_key_jwk.alg
        : row.alg,
  } as JWK;
}

async function fetchSigningKey(
  kid: string,
  deps: VerifyAccessTokenDependencies,
): Promise<JWK> {
  const supabase = deps.createClient(
    getRequiredEnv("SUPABASE_URL", deps.envGet),
    getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY", deps.envGet),
  );
  const { data, error } = await (
    supabase
      .from("oauth_signing_keys")
      .select("kid, alg, public_key_jwk, is_active") as SupabaseQueryChain
  )
    .eq("kid", kid)
    .eq("is_active", true)
    .maybeSingle<OAuthSigningKeyRow>();

  if (error) {
    throw new Error(`Signing key lookup failed: ${error.message}`);
  }
  if (!data) {
    throw new Error(`No active signing key found for kid ${kid}.`);
  }

  return normalizeJwk(data);
}

async function getVerificationKey(
  kid: string,
  deps: VerifyAccessTokenDependencies,
): Promise<CryptoKey> {
  const cachedKey = cachedSigningKeys.get(kid);
  if (cachedKey) {
    return cachedKey;
  }

  const jwk = await fetchSigningKey(kid, deps);
  const importedKey = await importJWK(jwk, jwk.alg ?? "RS256");
  if (!(importedKey instanceof CryptoKey)) {
    throw new Error(
      `Signing key ${kid} is not an asymmetric verification key.`,
    );
  }

  const cryptoKey = importedKey;
  cachedSigningKeys.set(kid, cryptoKey);
  return cryptoKey;
}

/**
 * Verifies an OAuth access token JWT.
 * Used by UserInfo and any future protected API endpoints.
 *
 * Returns the decoded payload if valid, throws if invalid.
 */
export async function verifyAccessToken(
  token: string,
  deps: VerifyAccessTokenDependencies = defaultDependencies,
): Promise<VerifiedAccessToken> {
  if (!token.trim()) {
    throw new Error("Access token is required.");
  }

  const kid = getJWTKid(token);
  const verificationKey = await getVerificationKey(kid, deps);
  const issuer = getRequiredEnv("OAUTH_ISSUER", deps.envGet);
  const { payload } = await jwtVerify(token, verificationKey, {
    issuer,
    algorithms: ["RS256"],
  });

  if (!isRecord(payload)) {
    throw new Error("Access token payload is invalid.");
  }

  const aud = payload.aud;
  if (typeof aud !== "string") {
    throw new Error("Access token is missing the aud claim.");
  }

  return {
    sub: getRequiredString(payload, "sub"),
    scope: getRequiredString(payload, "scope"),
    client_id: getRequiredString(payload, "client_id"),
    grant_type:
      typeof payload.grant_type === "string" ? payload.grant_type : undefined,
    exp: getRequiredNumber(payload, "exp"),
    iat: getRequiredNumber(payload, "iat"),
    iss: getRequiredString(payload, "iss"),
    aud,
  };
}
