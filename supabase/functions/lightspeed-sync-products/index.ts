import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
// FIX: [P5] - Decrypt access token before using as Bearer token
import { decryptToken, encryptToken } from "../_shared/crypto/tokens.ts";
import { getAdaptiveCooldown as getAdaptiveCooldownMs } from "../_shared/syncThrottling.ts";

console.log("[LS-SYNC-PRODUCTS] Edge function starting");

type ProductEndpointMode = "v2-after" | "v3-since-version";

interface LightspeedXSeriesProduct {
  id?: string | number | null;
  product_id?: string | number | null;
  name?: string | null;
  description?: string | null;
  sku?: string | null;
  retail_price?: string | number | null;
  price?: string | number | null;
  inventory_count?: string | number | null;
  available_inventory?: string | number | null;
  category_name?: string | null;
  category?: { name?: string | null } | null;
  tags?: Array<string | { name?: string | null }> | null;
  version?: number | null;
  [key: string]: unknown;
}

function toFiniteNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toNullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function toNullableInteger(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseVersionCursor(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.trunc(value);
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  }

  return 0;
}

function getResumeCursor(job: any, connection: any) {
  const jobCursor = parseVersionCursor(job?.current_cursor);
  if (jobCursor > 0) {
    return jobCursor;
  }

  return parseVersionCursor(connection?.last_product_version_cursor);
}

function getResumePage(job: any) {
  return typeof job?.current_page === "number" &&
    Number.isFinite(job.current_page) &&
    job.current_page >= 0
    ? job.current_page
    : 0;
}

function toStringId(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  return String(value);
}

function extractProductId(product: LightspeedXSeriesProduct) {
  return toStringId(
    product.id ?? product.product_id ?? (product as any).itemID,
  );
}

function extractTags(product: LightspeedXSeriesProduct) {
  const tags = new Set<string>();

  if (
    typeof product.category_name === "string" &&
    product.category_name.trim().length > 0
  ) {
    tags.add(product.category_name.trim());
  }

  if (
    typeof product.category?.name === "string" &&
    product.category.name.trim().length > 0
  ) {
    tags.add(product.category.name.trim());
  }

  if (Array.isArray(product.tags)) {
    for (const tag of product.tags) {
      const value = typeof tag === "string" ? tag : tag?.name;
      if (typeof value === "string" && value.trim().length > 0) {
        tags.add(value.trim());
      }
    }
  }

  const legacyTags = (product as any).Tags?.tag;
  if (Array.isArray(legacyTags)) {
    for (const tag of legacyTags) {
      const value = typeof tag === "string" ? tag : tag?.name;
      if (typeof value === "string" && value.trim().length > 0) {
        tags.add(value.trim());
      }
    }
  } else if (legacyTags) {
    const value =
      typeof legacyTags === "string" ? legacyTags : legacyTags?.name;
    if (typeof value === "string" && value.trim().length > 0) {
      tags.add(value.trim());
    }
  }

  return Array.from(tags);
}

function extractPrice(product: LightspeedXSeriesProduct) {
  return (
    toNullableNumber(
      product.retail_price ??
        product.price ??
        (product as any).default_price ??
        (product as any).Prices?.ItemPrice?.[0]?.amount ??
        (product as any).defaultCost,
    ) ?? 0
  );
}

function extractInventoryCount(product: LightspeedXSeriesProduct) {
  return (
    toNullableInteger(
      product.inventory_count ??
        product.available_inventory ??
        (product as any).stock_on_hand ??
        (product as any).ItemShops?.ItemShop?.[0]?.qoh,
    ) ?? 0
  );
}

function extractCategory(product: LightspeedXSeriesProduct) {
  return (
    product.category_name ??
    product.category?.name ??
    (product as any).Category?.name ??
    null
  );
}

function buildCatalogProductRow(
  tenantId: string,
  productId: string,
  product: LightspeedXSeriesProduct,
  syncedAt: string,
) {
  return {
    tenant_id: tenantId,
    external_id: productId,
    source: "lightspeed",
    name:
      product.name ??
      product.description ??
      (product as any).description ??
      "Unnamed Product",
    sku:
      product.sku ??
      (product as any).customSku ??
      (product as any).manufacturerSku ??
      null,
    description:
      product.description ?? (product as any).longDescription ?? null,
    price: extractPrice(product),
    currency: "USD",
    inventory_count: extractInventoryCount(product),
    category: extractCategory(product),
    tags: extractTags(product),
    external_data: product,
    last_synced_at: syncedAt,
    status: "active",
    is_visible: true,
    updated_at: syncedAt,
  };
}

function buildProductUrl(
  domainPrefix: string,
  afterVersion: number,
  mode: ProductEndpointMode,
) {
  const baseUrl =
    mode === "v2-after"
      ? `https://${domainPrefix}.retail.lightspeed.app/api/2.0/products`
      : `https://${domainPrefix}.retail.lightspeed.app/api/3.0/products`;

  if (afterVersion === 0) {
    return baseUrl;
  }

  const param = mode === "v2-after" ? "after" : "since_version";
  return `${baseUrl}?${param}=${afterVersion}`;
}

async function sleep(ms: number) {
  if (ms <= 0) {
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function writeJobProgress(
  supabaseAdmin: any,
  jobId: string | null,
  updates: Record<string, unknown>,
) {
  if (!jobId) {
    return;
  }

  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("pos_sync_jobs_v2")
    .update({
      ...updates,
      updated_at: now,
      last_progress_at: updates.last_progress_at ?? now,
    })
    .eq("id", jobId);

  if (error) {
    console.error(
      "[LS-SYNC-PRODUCTS] Failed to write queue progress:",
      error.message,
    );
  }
}

async function getLightspeedAccessToken(connection: {
  id: string;
  encrypted_access_token: string;
}) {
  try {
    return {
      accessToken: await decryptToken(connection.encrypted_access_token),
      needsReEncryption: false,
    };
  } catch {
    console.warn(
      `[LS] Token for connection ${connection.id} appears unencrypted. Re-encryption required.`,
    );
    return {
      accessToken: connection.encrypted_access_token,
      needsReEncryption: true,
    };
  }
}

async function fetchProductsPage(
  domainPrefix: string,
  accessToken: string,
  afterVersion: number,
  mode: ProductEndpointMode,
) {
  return await fetch(buildProductUrl(domainPrefix, afterVersion, mode), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      accept: "application/json",
    },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[LS-SYNC-PRODUCTS] Processing sync request");

    const requestBody = await req.json().catch(() => ({}));
    const jobId =
      typeof requestBody?.job_id === "string" ? requestBody.job_id : null;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: userData } = await supabaseClient
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) {
      return new Response(JSON.stringify({ error: "No tenant found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tenantId = userData.tenant_id;

    const { data: connection, error: connError } = await supabaseClient
      .from("lightspeed_connections")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("status", "connected")
      .single();

    if (connError || !connection) {
      return new Response(
        JSON.stringify({ error: "No active Lightspeed connection" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { accessToken, needsReEncryption } =
      await getLightspeedAccessToken(connection);
    let reEncrypted = false;

    let syncJob: any = null;
    if (jobId) {
      const { data: jobData, error: jobError } = await supabaseAdmin
        .from("pos_sync_jobs_v2")
        .select(
          "current_page,current_cursor,fetched_rows,inserted_rows,skipped_rows,failed_rows,total_pages_est",
        )
        .eq("id", jobId)
        .single();

      if (jobError) {
        console.error(
          "[LS-SYNC-PRODUCTS] Failed to load sync job state:",
          jobError.message,
        );
      } else {
        syncJob = jobData;
      }
    }

    let totalFetched = toFiniteNumber(syncJob?.fetched_rows, 0);
    let totalInserted = toFiniteNumber(syncJob?.inserted_rows, 0);
    let totalSkipped = toFiniteNumber(syncJob?.skipped_rows, 0);
    let totalFailed = toFiniteNumber(syncJob?.failed_rows, 0);
    let page = getResumePage(syncJob);
    let afterVersion = getResumeCursor(syncJob, connection);
    let finalVersionCursor = afterVersion;
    let endpointMode: ProductEndpointMode = "v2-after";

    while (true) {
      await writeJobProgress(supabaseAdmin, jobId, {
        status: "in_progress",
        current_page: page,
        current_cursor: String(afterVersion),
        fetched_rows: totalFetched,
        inserted_rows: totalInserted,
        skipped_rows: totalSkipped,
        failed_rows: totalFailed,
        progress_message: `Fetching products — page ${page + 1} · ${totalFetched.toLocaleString()} retrieved`,
      });

      let response = await fetchProductsPage(
        connection.domain_prefix,
        accessToken,
        afterVersion,
        endpointMode,
      );
      if (
        !response.ok &&
        endpointMode === "v2-after" &&
        (response.status === 400 || response.status === 404)
      ) {
        endpointMode = "v3-since-version";
        response = await fetchProductsPage(
          connection.domain_prefix,
          accessToken,
          afterVersion,
          endpointMode,
        );
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          "[LS-SYNC-PRODUCTS] API error:",
          response.status,
          errorText,
        );
        return new Response(
          JSON.stringify({
            error: `Lightspeed products sync failed with HTTP ${response.status}`,
          }),
          {
            status: 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      if (needsReEncryption && !reEncrypted) {
        const reEncryptedToken = await encryptToken(accessToken);
        const { error: reEncryptError } = await supabaseAdmin
          .from("lightspeed_connections")
          .update({ encrypted_access_token: reEncryptedToken })
          .eq("id", connection.id);

        if (reEncryptError) {
          console.error(
            "[LS-SYNC-PRODUCTS] Failed to re-encrypt access token:",
            reEncryptError,
          );
        } else {
          reEncrypted = true;
        }
      }

      const data = await response.json();
      const products = Array.isArray(data?.data)
        ? (data.data as LightspeedXSeriesProduct[])
        : [];

      if (products.length === 0) {
        await writeJobProgress(supabaseAdmin, jobId, {
          status: "completed",
          current_page: page,
          current_cursor: String(afterVersion),
          fetched_rows: totalFetched,
          inserted_rows: totalInserted,
          skipped_rows: totalSkipped,
          failed_rows: totalFailed,
          progress_message: `Complete — ${totalInserted.toLocaleString()} products imported`,
        });
        break;
      }

      totalFetched += products.length;

      let syncedCount = 0;
      let pageFailed = 0;

      for (const product of products) {
        const productId = extractProductId(product);
        if (!productId) {
          pageFailed += 1;
          continue;
        }

        const syncedAt = new Date().toISOString();
        const providerRow = {
          tenant_id: tenantId,
          lightspeed_product_id: productId,
          name:
            product.name ??
            product.description ??
            (product as any).description ??
            "Unnamed Product",
          sku:
            product.sku ??
            (product as any).customSku ??
            (product as any).manufacturerSku ??
            null,
          description:
            product.description ?? (product as any).longDescription ?? null,
          price: extractPrice(product),
          inventory_count: extractInventoryCount(product),
          category: extractCategory(product),
          tags: extractTags(product),
          raw_data: product,
          synced_at: syncedAt,
        };

        const { error: upsertError } = await supabaseClient
          .from("lightspeed_products")
          .upsert(providerRow, {
            onConflict: "tenant_id,lightspeed_product_id",
          });

        if (upsertError) {
          console.error(
            "[LS-SYNC-PRODUCTS] Upsert error:",
            upsertError.message,
          );
          pageFailed += 1;
          continue;
        }

        const { error: catalogUpsertError } = await supabaseClient
          .from("products")
          .upsert(
            buildCatalogProductRow(tenantId, productId, product, syncedAt),
            {
              onConflict: "tenant_id,external_id",
            },
          );

        if (catalogUpsertError) {
          console.error(
            "[LS-SYNC-PRODUCTS] Catalog upsert error:",
            catalogUpsertError.message,
          );
          pageFailed += 1;
          continue;
        }

        syncedCount += 1;
      }

      const pageSkipped = Math.max(
        0,
        products.length - syncedCount - pageFailed,
      );
      totalInserted += syncedCount;
      totalSkipped += pageSkipped;
      totalFailed += pageFailed;

      const nextVersion = parseVersionCursor(data?.version?.max);
      if (nextVersion === 0 || nextVersion === afterVersion) {
        finalVersionCursor = afterVersion;
        await writeJobProgress(supabaseAdmin, jobId, {
          status: "completed",
          current_page: page,
          current_cursor: String(afterVersion),
          fetched_rows: totalFetched,
          inserted_rows: totalInserted,
          skipped_rows: totalSkipped,
          failed_rows: totalFailed,
          progress_message: `Complete — ${totalInserted.toLocaleString()} products imported`,
        });
        break;
      }

      afterVersion = nextVersion;
      finalVersionCursor = nextVersion;
      page += 1;

      await writeJobProgress(supabaseAdmin, jobId, {
        status: "in_progress",
        current_page: page,
        current_cursor: String(afterVersion),
        fetched_rows: totalFetched,
        inserted_rows: totalInserted,
        skipped_rows: totalSkipped,
        failed_rows: totalFailed,
        progress_message: `Fetched products — page ${page} complete · ${totalFetched.toLocaleString()} retrieved`,
      });

      await sleep(getAdaptiveCooldownMs(totalFetched));
    }

    await supabaseClient
      .from("lightspeed_connections")
      .update({
        last_product_sync: new Date().toISOString(),
        products_synced: totalInserted,
        last_product_version_cursor: String(finalVersionCursor),
      })
      .eq("tenant_id", tenantId);

    console.log(
      `[LS-SYNC-PRODUCTS] Sync complete: ${totalInserted} products via ${endpointMode}`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        productsSynced: totalInserted,
        currentCursor: String(finalVersionCursor),
        endpointMode,
        message: `Synced ${totalInserted} products`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("[LS-SYNC-PRODUCTS] Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
