import { createClient as createSupabaseClient } from "@supabase/supabase-js";
// @deno-types="npm:@types/bcryptjs@2.4.6"
import bcrypt from "bcryptjs";

import { buildCorsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { hashToken } from "../_shared/oauth.ts";

type EnvGetter = (key: string) => string | undefined;
type RequestBody = Record<string, string>;

interface OAuthClientRow {
  client_id: string;
  client_secret_hash: string;
  is_active: boolean;
}

interface RefreshTokenRow {
  client_id: string;
  family_id: string;
}

interface OAuthSupabaseClient {
  from: (table: string) => {
    select: (columns?: string) => unknown;
    update: (payload: unknown) => unknown;
  };
}

interface SupabaseQueryChain {
  eq: (column: string, value: unknown) => SupabaseQueryChain;
  is: (column: string, value: unknown) => SupabaseQueryChain;
  maybeSingle: <T = unknown>() => Promise<{
    data: T | null;
    error: { message: string } | null;
  }>;
}

type CreateOAuthSupabaseClient = (
  supabaseUrl: string,
  supabaseKey: string,
) => OAuthSupabaseClient;

export interface OAuthRevokeDependencies {
  createClient: CreateOAuthSupabaseClient;
  envGet: EnvGetter;
  hashToken: typeof hashToken;
  now: () => Date;
  verifyClientSecret: (
    clientSecret: string,
    clientSecretHash: string,
  ) => boolean;
}

const REVOKE_CORS_OPTIONS = {
  allowOrigin: "*",
  allowMethods: "POST, OPTIONS",
};

const defaultDependencies: OAuthRevokeDependencies = {
  createClient: (supabaseUrl, supabaseKey) =>
    createSupabaseClient(
      supabaseUrl,
      supabaseKey,
    ) as unknown as OAuthSupabaseClient,
  envGet: (key) => Deno.env.get(key),
  hashToken,
  now: () => new Date(),
  verifyClientSecret: (clientSecret, clientSecretHash) =>
    bcrypt.compareSync(clientSecret, clientSecretHash),
};

function getRequiredEnv(key: string, envGet: EnvGetter): string {
  const value = envGet(key)?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

function isJsonContentType(contentType: string): boolean {
  const [mediaType] = contentType.toLowerCase().split(";");
  return mediaType === "application/json" || mediaType.endsWith("+json");
}

function isFormContentType(contentType: string): boolean {
  const [mediaType] = contentType.toLowerCase().split(";");
  return mediaType === "application/x-www-form-urlencoded";
}

async function parseRevocationBody(req: Request): Promise<RequestBody> {
  const contentType = req.headers.get("Content-Type") ?? "";
  if (isJsonContentType(contentType)) {
    try {
      const parsed = await req.json();
      if (
        typeof parsed !== "object" ||
        parsed === null ||
        Array.isArray(parsed)
      ) {
        return {};
      }

      const body: RequestBody = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === "string") {
          body[key] = value;
        }
      }
      return body;
    } catch {
      return {};
    }
  }

  if (isFormContentType(contentType)) {
    try {
      const params = new URLSearchParams(await req.text());
      const body: RequestBody = {};
      for (const [key, value] of params.entries()) {
        body[key] = value;
      }
      return body;
    } catch {
      return {};
    }
  }

  return {};
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

async function maybeSingle<T>(query: unknown): Promise<{
  data: T | null;
  error: { message: string } | null;
}> {
  return await (query as SupabaseQueryChain).maybeSingle<T>();
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

function invalidClientResponse(req: Request): Response {
  return new Response(JSON.stringify({ error: "invalid_client" }), {
    status: 401,
    headers: {
      ...buildCorsHeaders(req, REVOKE_CORS_OPTIONS),
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      Pragma: "no-cache",
      "WWW-Authenticate": 'Basic realm="oauth-revoke"',
    },
  });
}

function revokeOkResponse(req: Request): Response {
  return new Response(null, {
    status: 200,
    headers: {
      ...buildCorsHeaders(req, REVOKE_CORS_OPTIONS),
      "Cache-Control": "no-store",
      Pragma: "no-cache",
    },
  });
}

function methodNotAllowedResponse(req: Request): Response {
  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: {
      ...buildCorsHeaders(req, REVOKE_CORS_OPTIONS),
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      Pragma: "no-cache",
      Allow: "POST, OPTIONS",
    },
  });
}

async function authenticateClient(
  req: Request,
  body: RequestBody,
  supabase: OAuthSupabaseClient,
  deps: OAuthRevokeDependencies,
): Promise<
  { ok: true; client: OAuthClientRow } | { ok: false; response: Response }
> {
  const basicCredentials = parseBasicClientCredentials(
    req.headers.get("Authorization"),
  );
  if (basicCredentials.present && !basicCredentials.valid) {
    return { ok: false, response: invalidClientResponse(req) };
  }

  if (basicCredentials.present && body.client_secret?.trim()) {
    return { ok: false, response: invalidClientResponse(req) };
  }

  const clientId =
    basicCredentials.present && basicCredentials.valid
      ? basicCredentials.clientId
      : body.client_id?.trim();
  const clientSecret =
    basicCredentials.present && basicCredentials.valid
      ? basicCredentials.clientSecret
      : body.client_secret?.trim();

  if (
    basicCredentials.present &&
    basicCredentials.valid &&
    body.client_id?.trim() &&
    body.client_id.trim() !== basicCredentials.clientId
  ) {
    return { ok: false, response: invalidClientResponse(req) };
  }

  if (!clientId || !clientSecret) {
    return { ok: false, response: invalidClientResponse(req) };
  }

  const { data, error } = await maybeSingle<OAuthClientRow>(
    (
      supabase
        .from("oauth_clients")
        .select(
          "client_id, client_secret_hash, is_active",
        ) as SupabaseQueryChain
    ).eq("client_id", clientId),
  );

  if (error) {
    console.error("[oauth-revoke] Client lookup failed", error.message);
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: "server_error" }), {
        status: 500,
        headers: {
          ...buildCorsHeaders(req, REVOKE_CORS_OPTIONS),
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          Pragma: "no-cache",
        },
      }),
    };
  }

  if (!data || data.is_active === false || !data.client_secret_hash) {
    return { ok: false, response: invalidClientResponse(req) };
  }

  if (!deps.verifyClientSecret(clientSecret, data.client_secret_hash)) {
    return { ok: false, response: invalidClientResponse(req) };
  }

  return { ok: true, client: data };
}

export async function handleOAuthRevoke(
  req: Request,
  deps: OAuthRevokeDependencies = defaultDependencies,
): Promise<Response> {
  const corsResponse = handleCorsPreflight(req, REVOKE_CORS_OPTIONS);
  if (corsResponse) {
    return corsResponse;
  }

  if (req.method !== "POST") {
    return methodNotAllowedResponse(req);
  }

  try {
    const body = await parseRevocationBody(req);
    const supabase = deps.createClient(
      getRequiredEnv("SUPABASE_URL", deps.envGet),
      getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY", deps.envGet),
    );
    const clientAuth = await authenticateClient(req, body, supabase, deps);
    if (!clientAuth.ok) {
      return clientAuth.response;
    }

    const tokenTypeHint = body.token_type_hint?.trim();
    if (tokenTypeHint === "access_token") {
      return revokeOkResponse(req);
    }

    const token = body.token?.trim();
    if (!token) {
      return revokeOkResponse(req);
    }

    const { data: refreshToken, error } = await maybeSingle<RefreshTokenRow>(
      (
        supabase
          .from("oauth_refresh_tokens")
          .select("client_id, family_id") as SupabaseQueryChain
      ).eq("token_hash", await deps.hashToken(token)),
    );
    if (error) {
      console.error(
        "[oauth-revoke] Refresh token lookup failed",
        error.message,
      );
      return new Response(JSON.stringify({ error: "server_error" }), {
        status: 500,
        headers: {
          ...buildCorsHeaders(req, REVOKE_CORS_OPTIONS),
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          Pragma: "no-cache",
        },
      });
    }

    if (
      !refreshToken ||
      refreshToken.client_id !== clientAuth.client.client_id
    ) {
      return revokeOkResponse(req);
    }

    const { error: revokeError } = await executeQuery(
      (
        supabase
          .from("oauth_refresh_tokens")
          .update({
            revoked_at: deps.now().toISOString(),
          }) as SupabaseQueryChain
      )
        .eq("family_id", refreshToken.family_id)
        .is("revoked_at", null),
    );
    if (revokeError) {
      console.error(
        "[oauth-revoke] Failed to revoke token family",
        revokeError.message,
      );
      return new Response(JSON.stringify({ error: "server_error" }), {
        status: 500,
        headers: {
          ...buildCorsHeaders(req, REVOKE_CORS_OPTIONS),
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          Pragma: "no-cache",
        },
      });
    }

    return revokeOkResponse(req);
  } catch (error) {
    console.error("[oauth-revoke] Revocation failed", error);
    return new Response(JSON.stringify({ error: "server_error" }), {
      status: 500,
      headers: {
        ...buildCorsHeaders(req, REVOKE_CORS_OPTIONS),
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        Pragma: "no-cache",
      },
    });
  }
}

if (import.meta.main) {
  Deno.serve((req) => handleOAuthRevoke(req));
}
