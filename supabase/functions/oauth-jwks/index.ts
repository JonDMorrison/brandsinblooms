import { createClient } from "npm:@supabase/supabase-js@2";

import { handleCorsPreflight } from "../_shared/cors.ts";
import {
  buildPublicJsonResponse,
  internalServerErrorResponse,
  methodNotAllowedResponse,
  normalizePublicJwk,
  type OAuthSigningKeyRow,
} from "../_shared/oauthMetadata.ts";

export interface OAuthJwksDependencies {
  createClient: typeof createClient;
  envGet: (key: string) => string | undefined;
}

const defaultDependencies: OAuthJwksDependencies = {
  createClient,
  envGet: (key) => Deno.env.get(key),
};

export async function handleOAuthJwks(
  req: Request,
  deps: OAuthJwksDependencies = defaultDependencies,
): Promise<Response> {
  const corsResponse = handleCorsPreflight(req, {
    allowOrigin: "*",
    allowMethods: "GET, OPTIONS",
  });
  if (corsResponse) {
    return corsResponse;
  }

  if (req.method !== "GET") {
    return methodNotAllowedResponse(req);
  }

  try {
    const supabaseUrl = deps.envGet("SUPABASE_URL")?.trim();
    const serviceRoleKey = deps.envGet("SUPABASE_SERVICE_ROLE_KEY")?.trim();

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing Supabase credentials for JWKS lookup.");
    }

    const supabase = deps.createClient(supabaseUrl, serviceRoleKey);
    const { data, error } = await supabase
      .from("oauth_signing_keys")
      .select("kid, kty, alg, public_key_jwk, created_at")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    const keys = ((data ?? []) as OAuthSigningKeyRow[]).map(normalizePublicJwk);
    return buildPublicJsonResponse(req, { keys });
  } catch (error) {
    console.error("[oauth-jwks] Failed to fetch JWKS", error);
    return internalServerErrorResponse(req);
  }
}

if (import.meta.main) {
  Deno.serve((req) => handleOAuthJwks(req));
}
