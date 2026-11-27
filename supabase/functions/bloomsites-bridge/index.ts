// Read-only BloomSites assets (brand, products, upcoming events) for a CRM
// tenant whose BloomSites site is linked in newsletter_storefront_connections.
// POST { tenantId?, resource: "brand" | "products" | "events", collection?,
// search?, limit? }. The caller's JWT and tenant membership are verified
// before anything is read; BloomSites is only ever read (HTTP GET).
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  authorizeGeneratorRequest,
  readJsonBody,
  type GeneratorAuthDeps,
} from "../_shared/generatorAuth.ts";
import {
  BloomSitesBridgeError,
  openBloomSitesBridge,
  type BridgeServiceClient,
  type BridgeUserClient,
} from "../_shared/bloomsitesBridge.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BridgeRequest {
  tenantId?: string;
  resource?: string;
  collection?: string;
  search?: string;
  limit?: number;
}

export interface BloomSitesBridgeHandlerDeps extends GeneratorAuthDeps {
  fetch?: typeof fetch;
  now?: () => Date;
}

const defaultDeps: BloomSitesBridgeHandlerDeps = {
  createClient: createClient as GeneratorAuthDeps["createClient"],
  envGet: (key) => Deno.env.get(key),
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function handleBloomSitesBridge(
  req: Request,
  deps: BloomSitesBridgeHandlerDeps = defaultDeps,
): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const body = await readJsonBody<BridgeRequest>(req);
  const auth = await authorizeGeneratorRequest(req, body, deps, corsHeaders);
  if (!auth.ok) return auth.response;

  const resource = body.resource;
  if (resource !== "brand" && resource !== "products" && resource !== "events") {
    return json({ error: "invalid_resource" }, 400);
  }

  // The link and the BloomSites config are service_role only; read after
  // the checks above.
  const serviceClient = deps.createClient(
    deps.envGet("SUPABASE_URL")!,
    deps.envGet("SUPABASE_SERVICE_ROLE_KEY")!,
  ) as BridgeServiceClient;

  try {
    const bridge = await openBloomSitesBridge(auth.tenantId, {
      userClient: auth.userClient as BridgeUserClient,
      serviceClient,
      fetch: deps.fetch,
      now: deps.now,
    });
    const options = { collection: body.collection, search: body.search, limit: body.limit };
    const data = resource === "brand"
      ? await bridge.getBrand()
      : resource === "products"
      ? await bridge.getProducts(options)
      : await bridge.getEvents(options);
    return json({ siteId: bridge.siteId, resource, data });
  } catch (error) {
    if (error instanceof BloomSitesBridgeError) return json({ error: error.code }, error.status);
    console.error("bloomsites-bridge failed", error);
    return json({ error: "bloomsites_unavailable" }, 502);
  }
}

if (import.meta.main) {
  Deno.serve((req) => handleBloomSitesBridge(req));
}
