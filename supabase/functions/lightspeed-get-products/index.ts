import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { decryptToken } from "../_shared/crypto/tokens.ts";

type ProductEndpointMode = "v2-after" | "v3-since-version";

function parseXSeriesPayload(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return {
      isValid: false,
      items: [] as any[],
      versionMax: null as number | null,
    };
  }

  const record = payload as Record<string, unknown>;
  const items = Array.isArray(record.data) ? record.data : [];
  const version =
    record.version && typeof record.version === "object"
      ? (record.version as Record<string, unknown>)
      : null;
  const versionMax =
    typeof version?.max === "number"
      ? version.max
      : typeof version?.max === "string"
        ? Number.parseInt(version.max, 10)
        : null;

  return {
    isValid: Array.isArray(record.data),
    items,
    versionMax: Number.isFinite(versionMax as number) ? versionMax : null,
  };
}

function buildProductsUrl(domainPrefix: string, mode: ProductEndpointMode) {
  return mode === "v2-after"
    ? `https://${domainPrefix}.retail.lightspeed.app/api/2.0/products`
    : `https://${domainPrefix}.retail.lightspeed.app/api/3.0/products`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const { data: userData } = await supabaseClient
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) {
      throw new Error("No tenant found");
    }

    const { data: connection } = await supabaseClient
      .from("lightspeed_connections")
      .select("*")
      .eq("tenant_id", userData.tenant_id)
      .single();

    if (!connection) {
      throw new Error("No Lightspeed connection found");
    }

    let accessToken: string;
    let tokenMode: "encrypted" | "legacy_plaintext" = "encrypted";
    try {
      accessToken = await decryptToken(connection.encrypted_access_token);
    } catch {
      accessToken = connection.encrypted_access_token;
      tokenMode = "legacy_plaintext";
    }

    let endpointMode: ProductEndpointMode = "v2-after";
    let response = await fetch(
      buildProductsUrl(connection.domain_prefix, endpointMode),
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    if (!response.ok && (response.status === 400 || response.status === 404)) {
      endpointMode = "v3-since-version";
      response = await fetch(
        buildProductsUrl(connection.domain_prefix, endpointMode),
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
    }

    if (!response.ok) {
      throw new Error(
        `Failed to fetch products: ${response.status} ${response.statusText}`,
      );
    }

    const payload = await response.json();
    const parsed = parseXSeriesPayload(payload);
    if (!parsed.isValid) {
      throw new Error(
        "Products endpoint returned a non X-Series payload shape",
      );
    }

    const products = parsed.items.slice(0, 10).map((product: any) => ({
      id: product.id,
      name: product.name || product.description || "Unnamed Product",
      sku: product.sku || product.customSku || product.manufacturerSku || "N/A",
      price:
        product.retail_price ||
        product.price ||
        product.prices?.[0]?.amount ||
        0,
      description: product.description || product.longDescription || "",
      inventory: product.inventory_count || product.available_inventory || 0,
    }));

    console.log("Fetched products:", products.length);

    return new Response(
      JSON.stringify({
        success: true,
        products,
        count: products.length,
        endpointMode,
        tokenMode,
        currentCursor: connection.last_product_version_cursor ?? null,
        versionMax: parsed.versionMax,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Get products error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
