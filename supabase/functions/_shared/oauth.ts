import {
  decodeProtectedHeader,
  importJWK,
  importPKCS8,
  type JWK,
  type JWTPayload,
  jwtVerify,
  SignJWT,
} from "npm:jose@6.2.2";

const OAUTH_PRIVATE_KEY_ENV = "OAUTH_JWT_PRIVATE_KEY";
const OAUTH_SIGNING_ALGORITHM = "RS256";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function base64UrlEncode(bytes: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64(base64Value: string): Uint8Array {
  const normalized = base64Value.replace(/\s+/g, "");
  const decoded = atob(normalized);
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

function normalizePem(privateKeyValue: string): string {
  const trimmedValue = privateKeyValue.trim();
  if (trimmedValue.includes("BEGIN PRIVATE KEY")) {
    return trimmedValue;
  }

  const decodedValue = decoder.decode(decodeBase64(trimmedValue)).trim();
  if (!decodedValue.includes("BEGIN PRIVATE KEY")) {
    throw new Error(
      `${OAUTH_PRIVATE_KEY_ENV} must be a PKCS#8 PEM string or a base64-encoded PKCS#8 PEM string.`,
    );
  }

  return decodedValue;
}

function assertNonEmptyToken(token: string, tokenType: string): void {
  if (!token || !token.trim()) {
    throw new Error(`${tokenType} cannot be empty.`);
  }
}

function normalizeUri(value: string): string | null {
  try {
    return new URL(value).toString();
  } catch {
    return null;
  }
}

export function generateAuthorizationCode(): string {
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(48)));
}

export function generateRefreshToken(): string {
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(64)));
}

export async function hashToken(token: string): Promise<string> {
  assertNonEmptyToken(token, "Token");
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(token));
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function verifyPKCE(
  codeVerifier: string,
  codeChallenge: string,
  method: string,
): Promise<boolean> {
  if (!codeVerifier || !codeChallenge) {
    return false;
  }

  const normalizedMethod = method.trim().toUpperCase();
  if (normalizedMethod === "PLAIN") {
    return codeVerifier === codeChallenge;
  }

  if (normalizedMethod !== "S256") {
    return false;
  }

  const digest = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(codeVerifier),
  );

  return base64UrlEncode(new Uint8Array(digest)) === codeChallenge;
}

export function validateRedirectUri(
  requestUri: string,
  registeredUris: string[],
): boolean {
  const normalizedRequestUri = normalizeUri(requestUri);
  if (!normalizedRequestUri) {
    return false;
  }

  return registeredUris.some((registeredUri) => {
    const normalizedRegisteredUri = normalizeUri(registeredUri);
    return normalizedRegisteredUri === normalizedRequestUri;
  });
}

export function validateScopes(
  requestedScopes: string[],
  allowedScopes: string[],
): boolean {
  const allowedScopeSet = new Set(
    allowedScopes.map((scope) => scope.trim()).filter(Boolean),
  );

  return requestedScopes
    .map((scope) => scope.trim())
    .filter(Boolean)
    .every((scope) => allowedScopeSet.has(scope));
}

export async function parsePrivateKey(
  privateKeyValue: string | null | undefined = Deno.env.get(
    OAUTH_PRIVATE_KEY_ENV,
  ),
): Promise<CryptoKey> {
  if (!privateKeyValue) {
    throw new Error(
      `${OAUTH_PRIVATE_KEY_ENV} is not configured. Add it to the Supabase project secrets before issuing OAuth tokens.`,
    );
  }

  const pem = normalizePem(privateKeyValue);
  return await importPKCS8(pem, OAUTH_SIGNING_ALGORITHM);
}

export async function signJWT(
  payload: JWTPayload,
  privateKey: CryptoKey,
  kid: string,
): Promise<string> {
  const signer = new SignJWT(payload).setProtectedHeader({
    alg: OAUTH_SIGNING_ALGORITHM,
    kid,
    typ: "JWT",
  });

  if (payload.iat === undefined) {
    signer.setIssuedAt();
  }

  return await signer.sign(privateKey);
}

export function getJWTKid(token: string): string {
  const { kid } = decodeProtectedHeader(token);
  if (!kid) {
    throw new Error("JWT is missing a key id.");
  }

  return kid;
}

export async function verifyJWT(
  token: string,
  publicJwk: JWK,
  options: { issuer?: string; audience?: string | string[] } = {},
): Promise<JWTPayload> {
  const key = await importJWK(
    publicJwk,
    publicJwk.alg ?? OAUTH_SIGNING_ALGORITHM,
  );
  const { payload } = await jwtVerify(token, key, {
    ...options,
    algorithms: [OAUTH_SIGNING_ALGORITHM],
  });

  return payload;
}
