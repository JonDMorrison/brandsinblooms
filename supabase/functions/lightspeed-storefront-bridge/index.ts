/**
 * Credential-owning Lightspeed storefront authority.
 *
 * This endpoint is deliberately separate from the existing CRM login and read
 * synchronization flows. The storefront presents either a short-lived,
 * site-minted authorization state or signed proof from an already bound site.
 * No retailer access or refresh token is returned to BloomSites.
 *
 * No database or provider errors, request bodies, codes, or credentials are logged.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { encryptToken, decryptToken } from "../_shared/crypto/tokens.ts";
import { createLightspeedAuthority } from "../_shared/lightspeed-storefront/authority.ts";
import { RpcLightspeedAuthorityRepository } from "../_shared/lightspeed-storefront/authority-store.ts";

function makeHandler() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return null;
  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const repository = new RpcLightspeedAuthorityRepository(async (name, args) => {
    const result = await supabase.rpc(name, args);
    return { data: result.data, error: result.error };
  });
  return createLightspeedAuthority({
    repository,
    encryption: { encrypt: encryptToken, decrypt: decryptToken },
    credentials: () => ({
      clientId: Deno.env.get("LIGHTSPEED_CLIENT_ID_PROD") ??
        Deno.env.get("LIGHTSPEED_CLIENT_ID") ?? "",
      clientSecret: Deno.env.get("LIGHTSPEED_CLIENT_SECRET_PROD") ??
        Deno.env.get("LIGHTSPEED_CLIENT_SECRET") ?? "",
    }),
  });
}

const handler = makeHandler();
Deno.serve((request) => handler
  ? handler(request)
  : Response.json({ ok: false, error: "platform_setup_required" }, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    }));
