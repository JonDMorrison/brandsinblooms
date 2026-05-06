import { handleCorsPreflight } from "../_shared/cors.ts";
import {
  buildDiscoveryDocument,
  buildPublicJsonResponse,
  internalServerErrorResponse,
  methodNotAllowedResponse,
} from "../_shared/oauthMetadata.ts";

export interface OAuthDiscoveryDependencies {
  envGet: (key: string) => string | undefined;
}

const defaultDependencies: OAuthDiscoveryDependencies = {
  envGet: (key) => Deno.env.get(key),
};

export async function handleOAuthDiscovery(
  req: Request,
  deps: OAuthDiscoveryDependencies = defaultDependencies,
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
    return buildPublicJsonResponse(req, buildDiscoveryDocument(deps.envGet));
  } catch (error) {
    console.error(
      "[oauth-discovery] Failed to build discovery document",
      error,
    );
    return internalServerErrorResponse(req);
  }
}

if (import.meta.main) {
  Deno.serve((req) => handleOAuthDiscovery(req));
}
