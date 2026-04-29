import { createClient } from "npm:@supabase/supabase-js@2";
import { decryptToken, encryptToken } from "../_shared/crypto/tokens.ts";
import {
  shouldThrottleSync,
  checkCircuitBreaker,
  getNextCircuitOpenUntil,
  getOptimalBatchSize,
  getAdaptiveCooldown as getAdaptiveCooldownMs,
  type CircuitBreakerState,
} from "../_shared/syncThrottling.ts";

declare const EdgeRuntime: {
  waitUntil(promise: Promise<unknown>): void;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Provider-specific sync handlers
interface SyncResult {
  customers: number;
  orders: number;
  products: number;
  rows: number;
  cursor: string | null;
  connectionCursor?: string | null;
  currentPage?: number;
  totalPagesEst?: number | null;
  fetchedRows?: number;
  insertedRows?: number;
  skippedRows?: number;
  failedRows?: number;
  progressMessage?: string;
  providerJobId?: string | null;
  error?: string;
  terminalStatus?: "failed" | "delayed";
}

interface LightspeedInventoryEndpointResult {
  totals: Map<string, number> | null;
  error: string | null;
}

interface LightspeedInventoryFallbackResult {
  totals: Map<string, number>;
  attemptedCount: number;
}

interface LightspeedInventorySyncSummary {
  source: "inventory_endpoint" | "product_detail_fallback";
  productsWithStock: number;
  totalItems: number;
  updatedProducts: number;
}

const LIGHTSPEED_PAGE_SIZE = 100;
const SHOPIFY_PAGE_SIZE = 100;

function toFiniteNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeLightspeedSyncType(syncType: string) {
  if (syncType === "orders") {
    return "sales";
  }

  return syncType;
}

function getSyncDisplayLabel(provider: string, syncType: string) {
  if (provider === "lightspeed") {
    return getLightspeedSyncLabel(syncType);
  }

  return syncType;
}

function parseLightspeedCompletedFlag(value: unknown) {
  return value === true || value === "true" || value === "1" || value === 1;
}

function parseLightspeedVersionCursor(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.trunc(value);
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  }

  return 0;
}

function getLightspeedSyncLabel(syncType: string) {
  const normalized = normalizeLightspeedSyncType(syncType);
  return normalized === "sales" ? "sales" : normalized;
}

function getLightspeedCurrentPage(cursor: string | null) {
  const offset = cursor ? Number.parseInt(cursor, 10) : 0;
  return Number.isFinite(offset)
    ? Math.floor(offset / LIGHTSPEED_PAGE_SIZE) + 1
    : 1;
}

function getLightspeedResumePage(job: any, cursor: string | null) {
  if (
    typeof job?.current_page === "number" &&
    Number.isFinite(job.current_page) &&
    job.current_page >= 0
  ) {
    return job.current_page;
  }

  const parsedCursor = cursor ? Number.parseInt(cursor, 10) : Number.NaN;
  if (
    !Number.isFinite(parsedCursor) ||
    parsedCursor < 0 ||
    parsedCursor >= 1000
  ) {
    return 0;
  }

  return parsedCursor;
}

function getLightspeedConnectionCursor(connection: any, syncType: string) {
  const normalized = normalizeLightspeedSyncType(syncType);

  if (normalized === "customers") {
    return connection.last_customer_version_cursor ?? null;
  }

  if (normalized === "sales") {
    return connection.last_sales_version_cursor ?? null;
  }

  return connection.last_product_version_cursor ?? null;
}

function getLightspeedResumeCursor(
  job: any,
  connection: any,
  syncType: string,
  isDelta: boolean,
) {
  const jobCursor = parseLightspeedVersionCursor(
    job.current_cursor || job.last_sync_cursor,
  );
  if (jobCursor > 0) {
    return jobCursor;
  }

  if (!isDelta) {
    return 0;
  }

  return parseLightspeedVersionCursor(
    getLightspeedConnectionCursor(connection, syncType),
  );
}

function getLightspeedTotalPagesEstimate(job: any) {
  const existingEstimate = toFiniteNumber(job.total_pages_est, 0);
  if (existingEstimate > 0) {
    return existingEstimate;
  }

  const estimatedRows = toFiniteNumber(job.estimated_rows, 0);
  return estimatedRows > 0
    ? Math.max(1, Math.ceil(estimatedRows / LIGHTSPEED_PAGE_SIZE))
    : null;
}

function getLightspeedSyncBaseUrl(connection: any, apiVersion: "2.0" | "3.0") {
  return `https://${connection.domain_prefix}.retail.lightspeed.app/api/${apiVersion}`;
}

function toInteger(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
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

function hasOwnValue(source: Record<string, unknown>, key: string) {
  return (
    Object.prototype.hasOwnProperty.call(source, key) &&
    source[key] !== undefined &&
    source[key] !== null &&
    source[key] !== ""
  );
}

function getFirstPresentValue(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (hasOwnValue(source, key)) {
      return source[key];
    }
  }

  return undefined;
}

function normalizeLightspeedSaleStatus(status: unknown) {
  return typeof status === "string" ? status.trim().toLowerCase() : "";
}

function isCompletedLightspeedSaleStatus(status: unknown) {
  const normalizedStatus = normalizeLightspeedSaleStatus(status);
  return ["completed", "closed", "paid"].includes(normalizedStatus);
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeJobId(jobId: unknown) {
  if (typeof jobId !== "string") {
    return null;
  }

  const trimmedJobId = jobId.trim();
  if (
    trimmedJobId.length === 0 ||
    trimmedJobId.toLowerCase() === "null" ||
    trimmedJobId.toLowerCase() === "undefined"
  ) {
    return null;
  }

  return UUID_PATTERN.test(trimmedJobId) ? trimmedJobId : null;
}

async function updateJobProgress(
  supabase: any,
  jobId: string | null | undefined,
  updates: Record<string, unknown>,
) {
  const normalizedJobId = normalizeJobId(jobId);
  if (!normalizedJobId) {
    console.warn(
      `[POS-SYNC-WORKER] Cannot update progress without a valid job id: ${String(jobId)}`,
    );
    return;
  }

  const now = new Date().toISOString();
  const payload = {
    ...updates,
    updated_at: now,
    last_progress_at: updates.last_progress_at ?? now,
  };

  const { error } = await supabase
    .from("pos_sync_jobs_v2")
    .update(payload)
    .eq("id", normalizedJobId);

  if (error) {
    console.error(
      `[POS-SYNC-WORKER] Failed to update progress for job ${normalizedJobId}:`,
      error.message,
    );
  }
}

async function writeJobProgress(
  supabase: any,
  jobId: string,
  updates: Record<string, unknown>,
) {
  await updateJobProgress(supabase, jobId, updates);
}

async function sleep(ms: number) {
  if (ms <= 0) {
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function applyAdaptiveCooldown(totalFetchedSoFar: number) {
  const cooldownMs = getAdaptiveCooldownMs(totalFetchedSoFar);
  if (cooldownMs > 0) {
    console.log(
      `[POS-SYNC-WORKER] Cooling down for ${cooldownMs}ms after ${totalFetchedSoFar} fetched rows`,
    );
    await sleep(cooldownMs);
  }
}

function queueFollowUpWorkerRun(supabase: any, provider: string | null) {
  EdgeRuntime.waitUntil(
    (async () => {
      try {
        await supabase.functions.invoke("pos-sync-worker", {
          body: provider ? { provider } : {},
        });
      } catch (error) {
        console.error(
          `[POS-SYNC-WORKER] Failed to queue follow-up worker for ${provider ?? "all"}:`,
          error,
        );
      }
    })(),
  );
}

async function decryptTokenSafe(supabase: any, connection: any) {
  try {
    const accessToken = await decryptToken(connection.encrypted_access_token);
    return {
      accessToken,
      ensureTokenReEncrypted: async () => {},
    };
  } catch {
    console.warn(
      `[LS] Token for connection ${connection.id} appears unencrypted. Re-encryption required.`,
    );

    let reEncrypted = false;
    const accessToken = connection.encrypted_access_token;

    return {
      accessToken,
      ensureTokenReEncrypted: async () => {
        if (reEncrypted) {
          return;
        }

        const reEncryptedToken = await encryptToken(accessToken);
        const { error } = await supabase
          .from("lightspeed_connections")
          .update({ encrypted_access_token: reEncryptedToken })
          .eq("id", connection.id);

        if (error) {
          console.error(
            "[POS-SYNC-WORKER] Failed to re-encrypt Lightspeed token:",
            error.message,
          );
          return;
        }

        reEncrypted = true;
      },
    };
  }
}

function mapLightspeedCustomer(customer: any, connection: any) {
  const customerRecord = customer as Record<string, unknown>;
  const mappedCustomer: Record<string, unknown> = {
    tenant_id: connection.tenant_id,
    lightspeed_customer_id: String(customer.id ?? customer.customerID),
    contact_id: customer.contact_id ? String(customer.contact_id) : null,
    email:
      normalizeOptionalString(
        customer.email ?? customer.Contact?.Emails?.ContactEmail?.[0]?.address,
      )?.toLowerCase() ?? null,
    phone:
      normalizeOptionalString(
        customer.phone ??
          customer.Contact?.Phones?.ContactPhone?.[0]?.number ??
          customer.Contact?.Phones?.Phone?.[0]?.number,
      ) ?? null,
    first_name: customer.first_name ?? customer.firstName ?? null,
    last_name: customer.last_name ?? customer.lastName ?? null,
    customer_group_id: customer.customer_code
      ? String(customer.customer_code)
      : customer.customerTypeID
        ? String(customer.customerTypeID)
        : customer.CustomerType?.customerTypeID
          ? String(customer.CustomerType.customerTypeID)
          : null,
    loyalty_balance:
      customer.loyalty_balance !== undefined &&
      customer.loyalty_balance !== null
        ? Number.parseFloat(String(customer.loyalty_balance))
        : customer.loyaltyBalance !== undefined &&
            customer.loyaltyBalance !== null
          ? Number.parseFloat(String(customer.loyaltyBalance))
          : customer.creditAccountID
            ? 0
            : null,
    raw_data: customer,
    synced_at: new Date().toISOString(),
  };

  const purchaseCount = toNullableInteger(
    getFirstPresentValue(customerRecord, [
      "num_visits",
      "numVisits",
      "purchaseCount",
    ]),
  );
  if (typeof purchaseCount === "number" && purchaseCount > 0) {
    mappedCustomer.purchase_count = purchaseCount;
  }

  const totalSpend = toNullableNumber(
    getFirstPresentValue(customerRecord, ["total_spend", "totalSpend"]),
  );
  if (typeof totalSpend === "number" && totalSpend > 0) {
    mappedCustomer.total_spend = totalSpend;
  }

  const firstPurchaseDate = normalizeOptionalString(
    getFirstPresentValue(customerRecord, ["first_purchase_date", "firstVisit"]),
  );
  if (firstPurchaseDate) {
    mappedCustomer.first_purchase_date = firstPurchaseDate;
  }

  const lastPurchaseDate = normalizeOptionalString(
    getFirstPresentValue(customerRecord, ["last_purchase_date", "lastVisit"]),
  );
  if (lastPurchaseDate) {
    mappedCustomer.last_purchase_date = lastPurchaseDate;
  }

  return mappedCustomer;
}

function normalizeOptionalString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function buildLightspeedCrmCustomerPayload(
  row: ReturnType<typeof mapLightspeedCustomer>,
) {
  const payload: Record<string, unknown> = {
    tenant_id: row.tenant_id,
    updated_at: new Date().toISOString(),
    pos_source: "lightspeed",
    external_id: row.lightspeed_customer_id,
  };

  if (row.email) {
    payload.email = row.email;
  }

  if (row.phone) {
    payload.phone = row.phone;
  }

  if (row.first_name) {
    payload.first_name = row.first_name;
  }

  if (row.last_name) {
    payload.last_name = row.last_name;
  }

  if (typeof row.purchase_count === "number" && row.purchase_count > 0) {
    payload.pos_order_count = row.purchase_count;
  }

  if (typeof row.total_spend === "number" && row.total_spend > 0) {
    payload.total_spent = row.total_spend;
    payload.pos_total_spent = row.total_spend;
    payload.lifetime_value = row.total_spend;
  }

  if (row.first_purchase_date) {
    payload.first_purchase_date = row.first_purchase_date;
  }

  if (row.last_purchase_date) {
    payload.last_purchase_date = row.last_purchase_date;
  }

  return payload;
}

type LightspeedProductLookups = {
  productTypesById: Map<string, string>;
  tagNamesById: Map<string, string>;
};

function getLightspeedObjectArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((entry) => entry && typeof entry === "object");
  }

  if (value && typeof value === "object") {
    return [value];
  }

  return [];
}

function getFirstNonEmptyString(...candidates: unknown[]) {
  for (const candidate of candidates) {
    if (typeof candidate === "string") {
      const trimmed = candidate.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }

  return null;
}

function getLightspeedProductVariants(product: any) {
  return getLightspeedObjectArray(
    product.variants ?? product.Variants?.Variant ?? product.variant,
  );
}

function getLightspeedProductInventoryEntries(product: any) {
  return getLightspeedObjectArray(
    product.inventory ?? product.Inventory ?? product.inventory_levels,
  );
}

function extractLightspeedProductPrice(product: any) {
  const primaryVariant = getLightspeedProductVariants(product)[0] as
    | Record<string, unknown>
    | undefined;

  return (
    toNullableNumber(
      product.price_including_tax ??
        product.price ??
        product.retail_price ??
        primaryVariant?.price_including_tax ??
        primaryVariant?.price ??
        primaryVariant?.retail_price ??
        product.default_price ??
        product.defaultPrice ??
        product.Prices?.ItemPrice?.[0]?.amount,
    ) ?? 0
  );
}

function extractLightspeedProductSupplyPrice(product: any) {
  const primaryVariant = getLightspeedProductVariants(product)[0] as
    | Record<string, unknown>
    | undefined;

  return (
    toNullableNumber(
      product.supply_price ??
        product.supplyPrice ??
        primaryVariant?.supply_price ??
        primaryVariant?.supplyPrice ??
        primaryVariant?.supply_price_including_tax ??
        product.supply_price_including_tax ??
        product.defaultCost,
    ) ?? 0
  );
}

function extractLightspeedProductInventoryCount(product: any) {
  const primaryInventory = getLightspeedProductInventoryEntries(product)[0] as
    | Record<string, unknown>
    | undefined;

  return (
    toNullableInteger(
      product.inventory_count ??
        product.available_inventory ??
        product.stock_on_hand ??
        product.qoh ??
        primaryInventory?.count ??
        primaryInventory?.current_amount ??
        primaryInventory?.available ??
        product.ItemShops?.ItemShop?.[0]?.qoh,
    ) ?? 0
  );
}

function hasLightspeedProductInventorySignal(product: any) {
  if (!product || typeof product !== "object") {
    return false;
  }

  if (getLightspeedProductInventoryEntries(product).length > 0) {
    return true;
  }

  const source = product as Record<string, unknown>;
  return [
    "inventory_count",
    "available_inventory",
    "stock_on_hand",
    "qoh",
    "inventory_level",
    "inventoryLevel",
  ].some((key) => hasOwnValue(source, key));
}

function getLightspeedInventoryProductId(entry: any) {
  return getFirstNonEmptyString(
    entry?.product_id,
    entry?.productId,
    entry?.item_id,
    entry?.itemId,
    entry?.product?.id,
    entry?.product?.product_id,
    entry?.Product?.id,
  );
}

function extractLightspeedInventoryLevel(entry: any) {
  return (
    toNullableInteger(
      entry?.inventory_level ??
        entry?.inventoryLevel ??
        entry?.count ??
        entry?.current_amount ??
        entry?.available ??
        entry?.quantity ??
        entry?.qty ??
        entry?.stock_on_hand ??
        entry?.on_hand ??
        entry?.qoh,
    ) ?? 0
  );
}

function sumLightspeedInventoryEntries(
  entries: any[],
  fallbackProductId: string | null = null,
) {
  const totals = new Map<string, number>();

  for (const entry of entries) {
    const productId = getLightspeedInventoryProductId(entry) ?? fallbackProductId;
    if (!productId) {
      continue;
    }

    totals.set(
      productId,
      (totals.get(productId) ?? 0) + extractLightspeedInventoryLevel(entry),
    );
  }

  return totals;
}

function getLightspeedInventoryRows(responseData: any) {
  const inventoryData =
    responseData?.data ?? responseData?.inventory ?? responseData;

  if (Array.isArray(inventoryData)) {
    return inventoryData.filter((entry) => entry && typeof entry === "object");
  }

  const responseKeys =
    responseData && typeof responseData === "object"
      ? Object.keys(responseData)
      : [];

  console.error(
    "[PRODUCT-SYNC] Inventory response is not an array:",
    typeof inventoryData,
  );
  console.error("[PRODUCT-SYNC] Inventory response keys:", responseKeys);
  console.error(
    "[PRODUCT-SYNC] Response preview:",
    JSON.stringify(responseData ?? null).substring(0, 500),
  );

  return null;
}

async function fetchLightspeedInventoryTotalsFromEndpoint(
  connection: any,
  accessToken: string,
  ensureTokenReEncrypted: () => Promise<void>,
): Promise<LightspeedInventoryEndpointResult> {
  const totals = new Map<string, number>();
  let cursor = 0;

  while (true) {
    const url = buildLightspeedReferenceUrl(connection, "2.0", "inventory", cursor);
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      return {
        totals: null,
        error: `HTTP ${response.status}`,
      };
    }

    await ensureTokenReEncrypted();

    const responseData = await response.json().catch((error: any) => {
      console.error(
        `[PRODUCT-SYNC] Inventory response was not valid JSON: ${error?.message ?? error}`,
      );
      return null;
    });

    if (!responseData) {
      return {
        totals: null,
        error: "invalid_json",
      };
    }

    const inventoryRows = getLightspeedInventoryRows(responseData);
    if (!inventoryRows) {
      return {
        totals: null,
        error: "unexpected_response_shape",
      };
    }

    const pageTotals = sumLightspeedInventoryEntries(inventoryRows);
    for (const [productId, totalStock] of pageTotals.entries()) {
      totals.set(productId, (totals.get(productId) ?? 0) + totalStock);
    }

    const nextCursor = parseLightspeedVersionCursor(responseData?.version?.max);
    if (
      inventoryRows.length === 0 ||
      nextCursor === 0 ||
      nextCursor === cursor
    ) {
      break;
    }

    cursor = nextCursor;
  }

  return {
    totals,
    error: null,
  };
}

async function fetchLightspeedInventoryTotalFromProductDetail(
  connection: any,
  accessToken: string,
  ensureTokenReEncrypted: () => Promise<void>,
  productId: string,
) {
  const response = await fetch(
    `${getLightspeedSyncBaseUrl(connection, "2.0")}/products/${productId}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (!response.ok) {
    console.warn(
      `[PRODUCT-SYNC] Product detail inventory fetch failed for ${productId}: HTTP ${response.status}`,
    );
    return null;
  }

  await ensureTokenReEncrypted();

  const responseData = await response.json().catch((error: any) => {
    console.error(
      `[PRODUCT-SYNC] Product detail response was not valid JSON for ${productId}: ${error?.message ?? error}`,
    );
    return null;
  });

  if (!responseData) {
    return null;
  }

  const detailProduct = Array.isArray(responseData?.data)
    ? responseData.data[0]
    : responseData?.data ?? responseData?.product ?? responseData;

  if (!detailProduct || typeof detailProduct !== "object") {
    console.warn(
      `[PRODUCT-SYNC] Product detail inventory response was empty for ${productId}`,
    );
    return null;
  }

  if (!hasLightspeedProductInventorySignal(detailProduct)) {
    return null;
  }

  const inventoryEntries = getLightspeedProductInventoryEntries(detailProduct);
  if (inventoryEntries.length > 0) {
    const totals = sumLightspeedInventoryEntries(inventoryEntries, productId);
    if (totals.has(productId)) {
      return totals.get(productId) ?? 0;
    }
  }

  return extractLightspeedProductInventoryCount(detailProduct);
}

async function fetchLightspeedInventoryTotalsFromProductDetails(
  supabase: any,
  connection: any,
  job: any,
  accessToken: string,
  ensureTokenReEncrypted: () => Promise<void>,
): Promise<LightspeedInventoryFallbackResult | null> {
  const { data: productRows, error } = await supabase
    .from("lightspeed_products")
    .select("lightspeed_product_id, inventory_count, stock_count")
    .eq("tenant_id", connection.tenant_id);

  if (error) {
    console.warn(
      `[PRODUCT-SYNC] Failed to load Lightspeed products for inventory fallback: ${error.message}`,
    );
    return null;
  }

  const productsNeedingInventory = (productRows ?? []).filter((row: any) => {
    const inventoryCount = toNullableInteger(row?.inventory_count);
    const stockCount = toNullableInteger(row?.stock_count);
    return (
      inventoryCount === null ||
      stockCount === null ||
      inventoryCount === 0 ||
      stockCount === 0
    );
  });

  const totals = new Map<string, number>();
  const batchSize = 10;

  for (
    let offset = 0;
    offset < productsNeedingInventory.length;
    offset += batchSize
  ) {
    const batch = productsNeedingInventory.slice(offset, offset + batchSize);
    const batchStart = offset + 1;
    const batchEnd = Math.min(offset + batch.length, productsNeedingInventory.length);

    console.log(
      `[PRODUCT-SYNC] Fetching inventory for product ${batchStart}/${productsNeedingInventory.length}`,
    );

    await writeJobProgress(supabase, job.id, {
      progress_message:
        `Fetching product inventory details — ${batchEnd.toLocaleString()}/${productsNeedingInventory.length.toLocaleString()} checked`,
    });

    const batchResults = await Promise.all(
      batch.map(async (row: any) => {
        const totalStock = await fetchLightspeedInventoryTotalFromProductDetail(
          connection,
          accessToken,
          ensureTokenReEncrypted,
          String(row.lightspeed_product_id),
        );

        return {
          productId: String(row.lightspeed_product_id),
          totalStock,
        };
      }),
    );

    for (const result of batchResults) {
      if (result.totalStock === null) {
        continue;
      }

      totals.set(result.productId, result.totalStock);
    }

    if (batchEnd < productsNeedingInventory.length) {
      await sleep(1000);
    }
  }

  return {
    totals,
    attemptedCount: productsNeedingInventory.length,
  };
}

async function persistLightspeedInventoryTotals(
  supabase: any,
  connection: any,
  totals: Map<string, number>,
) {
  const inventoryEntries = Array.from(totals.entries());
  if (inventoryEntries.length === 0) {
    return 0;
  }

  const timestamp = new Date().toISOString();
  let updatedProducts = 0;
  const batchSize = 50;

  for (
    let offset = 0;
    offset < inventoryEntries.length;
    offset += batchSize
  ) {
    const batch = inventoryEntries.slice(offset, offset + batchSize);
    const batchResults = await Promise.all(
      batch.map(async ([productId, totalStock]) => {
        const inventoryPayload = {
          inventory_count: totalStock,
          stock_count: totalStock,
          synced_at: timestamp,
        };

        const catalogPayload = {
          inventory_count: totalStock,
          stock_count: totalStock,
          last_synced_at: timestamp,
          updated_at: timestamp,
        };

        const [{ error: lightspeedError }, { error: catalogError }] =
          await Promise.all([
            supabase
              .from("lightspeed_products")
              .update(inventoryPayload)
              .eq("tenant_id", connection.tenant_id)
              .eq("lightspeed_product_id", productId),
            supabase
              .from("products")
              .update(catalogPayload)
              .eq("tenant_id", connection.tenant_id)
              .eq("source", "lightspeed")
              .eq("external_id", productId),
          ]);

        if (lightspeedError) {
          console.error(
            `[PRODUCT-SYNC] Failed to update Lightspeed inventory for ${productId}: ${lightspeedError.message}`,
          );
          return false;
        }

        if (catalogError) {
          console.error(
            `[PRODUCT-SYNC] Failed to mirror Lightspeed inventory to products for ${productId}: ${catalogError.message}`,
          );
        }

        return true;
      }),
    );

    updatedProducts += batchResults.filter(Boolean).length;
  }

  return updatedProducts;
}

async function syncLightspeedProductInventory(
  supabase: any,
  connection: any,
  job: any,
  accessToken: string,
  ensureTokenReEncrypted: () => Promise<void>,
  totalItems: number,
): Promise<LightspeedInventorySyncSummary | null> {
  let effectiveTotalItems = totalItems;

  if (effectiveTotalItems <= 0) {
    const { count, error } = await supabase
      .from("lightspeed_products")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", connection.tenant_id);

    if (!error) {
      effectiveTotalItems = count ?? 0;
    }
  }

  await writeJobProgress(supabase, job.id, {
    progress_message:
      `Fetching product inventory counts — ${effectiveTotalItems.toLocaleString()} products imported`,
  });

  const endpointResult = await fetchLightspeedInventoryTotalsFromEndpoint(
    connection,
    accessToken,
    ensureTokenReEncrypted,
  );

  if (endpointResult.totals) {
    const updatedProducts = await persistLightspeedInventoryTotals(
      supabase,
      connection,
      endpointResult.totals,
    );
    const productsWithStock = Array.from(endpointResult.totals.values()).filter(
      (value) => value > 0,
    ).length;

    logLightspeedSyncEvent("inventory_sync", {
      tenant_id: connection.tenant_id,
      source: "inventory_endpoint",
      products_with_stock: productsWithStock,
      total_items: effectiveTotalItems,
      updated_products: updatedProducts,
    });

    return {
      source: "inventory_endpoint",
      productsWithStock,
      totalItems: effectiveTotalItems,
      updatedProducts,
    };
  }

  console.warn(
    `[PRODUCT-SYNC] Inventory endpoint unavailable, falling back to product detail: ${endpointResult.error ?? "unknown_error"}`,
  );

  const fallbackResult = await fetchLightspeedInventoryTotalsFromProductDetails(
    supabase,
    connection,
    job,
    accessToken,
    ensureTokenReEncrypted,
  );

  if (!fallbackResult) {
    console.warn(
      `[PRODUCT-SYNC] Could not fetch inventory data. Tried /api/2.0/inventory (${endpointResult.error ?? "unknown_error"}) and individual product detail. Stock counts will remain at 0.`,
    );
    return null;
  }

  if (fallbackResult.attemptedCount === 0) {
    return null;
  }

  if (fallbackResult.totals.size === 0) {
    console.warn(
      `[PRODUCT-SYNC] Could not fetch inventory data. Tried /api/2.0/inventory (${endpointResult.error ?? "unknown_error"}) and individual product detail. Stock counts will remain at 0.`,
    );
    return null;
  }

  const updatedProducts = await persistLightspeedInventoryTotals(
    supabase,
    connection,
    fallbackResult.totals,
  );
  const productsWithStock = Array.from(fallbackResult.totals.values()).filter(
    (value) => value > 0,
  ).length;

  logLightspeedSyncEvent("inventory_sync", {
    tenant_id: connection.tenant_id,
    source: "product_detail_fallback",
    products_with_stock: productsWithStock,
    total_items: effectiveTotalItems,
    updated_products: updatedProducts,
  });

  return {
    source: "product_detail_fallback",
    productsWithStock,
    totalItems: effectiveTotalItems,
    updatedProducts,
  };
}

function resolveLightspeedProductTypeName(
  product: any,
  lookups: LightspeedProductLookups,
) {
  const productTypeId =
    product.product_type_id ??
    product.productTypeId ??
    product.type_id ??
    product.typeId;
  const resolvedTypeName =
    productTypeId !== undefined && productTypeId !== null
      ? (lookups.productTypesById.get(String(productTypeId)) ?? null)
      : null;

  return getFirstNonEmptyString(
    product.product_type,
    product.productType,
    product.type,
    product.category_name,
    product.category?.name,
    product.Category?.name,
    product.ProductType?.name,
    product.product_type?.name,
    resolvedTypeName,
  );
}

function resolveLightspeedProductBrand(product: any) {
  return getFirstNonEmptyString(
    product.brand_name,
    product.brand,
    product.Brand?.name,
    product.brand?.name,
  );
}

function resolveLightspeedProductTags(
  product: any,
  lookups: LightspeedProductLookups,
) {
  const tags = new Set<string>();

  for (const tag of getLightspeedObjectArray(product.tags)) {
    const tagName = getFirstNonEmptyString(
      (tag as Record<string, unknown>).name,
      (tag as Record<string, unknown>).label,
    );

    if (tagName) {
      tags.add(tagName);
    }
  }

  if (Array.isArray(product.tags)) {
    for (const tag of product.tags) {
      const tagName = getFirstNonEmptyString(tag);
      if (tagName) {
        tags.add(tagName);
      }
    }
  }

  const legacyTags = product.Tags?.tag;
  if (Array.isArray(legacyTags)) {
    for (const tag of legacyTags) {
      const tagName = getFirstNonEmptyString(tag?.name, tag);
      if (tagName) {
        tags.add(tagName);
      }
    }
  } else {
    const tagName = getFirstNonEmptyString(legacyTags?.name, legacyTags);
    if (tagName) {
      tags.add(tagName);
    }
  }

  const tagIds = Array.isArray(product.tag_ids)
    ? product.tag_ids
    : Array.isArray(product.tagIds)
      ? product.tagIds
      : [];

  for (const tagId of tagIds) {
    const resolvedTagName = lookups.tagNamesById.get(String(tagId));
    if (resolvedTagName) {
      tags.add(resolvedTagName);
    }
  }

  return Array.from(tags);
}

function buildLightspeedReferenceUrl(
  connection: any,
  apiVersion: "2.0" | "3.0",
  resource: string,
  cursor = 0,
) {
  const baseUrl = `${getLightspeedSyncBaseUrl(connection, apiVersion)}/${resource}`;
  if (cursor <= 0) {
    return baseUrl;
  }

  const cursorParam = apiVersion === "2.0" ? "after" : "since_version";
  return `${baseUrl}?${cursorParam}=${cursor}`;
}

async function fetchLightspeedReferenceMap(
  connection: any,
  accessToken: string,
  resource: string,
  extractId: (entry: any) => string | null,
  extractName: (entry: any) => string | null,
) {
  const resolvedEntries = new Map<string, string>();
  let cursor = 0;
  let apiVersion: "2.0" | "3.0" = "2.0";

  while (true) {
    let response = await fetch(
      buildLightspeedReferenceUrl(connection, apiVersion, resource, cursor),
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    if (
      !response.ok &&
      apiVersion === "2.0" &&
      (response.status === 400 || response.status === 404)
    ) {
      apiVersion = "3.0";
      response = await fetch(
        buildLightspeedReferenceUrl(connection, apiVersion, resource, cursor),
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
    }

    if (!response.ok) {
      console.warn(
        `[POS-SYNC-WORKER] Failed to fetch Lightspeed ${resource} reference data: ${response.status}`,
      );
      break;
    }

    const data = await response.json().catch(() => null);
    const rows = Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data)
        ? data
        : [];

    for (const row of rows) {
      const id = extractId(row);
      const name = extractName(row);
      if (id && name) {
        resolvedEntries.set(id, name);
      }
    }

    const nextCursor = parseLightspeedVersionCursor(data?.version?.max);
    if (rows.length === 0 || nextCursor === 0 || nextCursor === cursor) {
      break;
    }

    cursor = nextCursor;
  }

  return resolvedEntries;
}

async function fetchLightspeedProductLookups(
  connection: any,
  accessToken: string,
): Promise<LightspeedProductLookups> {
  const [productTypesById, tagNamesById] = await Promise.all([
    fetchLightspeedReferenceMap(
      connection,
      accessToken,
      "product_types",
      (entry) =>
        getFirstNonEmptyString(
          entry?.id,
          entry?.product_type_id,
          entry?.type_id,
        ),
      (entry) => getFirstNonEmptyString(entry?.name, entry?.label),
    ),
    fetchLightspeedReferenceMap(
      connection,
      accessToken,
      "tags",
      (entry) => getFirstNonEmptyString(entry?.id, entry?.tag_id),
      (entry) => getFirstNonEmptyString(entry?.name, entry?.label),
    ),
  ]);

  return { productTypesById, tagNamesById };
}

function logLightspeedProductShape(product: any) {
  const primaryVariant = getLightspeedProductVariants(product)[0] as
    | Record<string, unknown>
    | undefined;
  const primaryInventory = getLightspeedProductInventoryEntries(product)[0] as
    | Record<string, unknown>
    | undefined;

  console.log(
    "[POS-SYNC-WORKER] Lightspeed product sample shape:",
    JSON.stringify({
      productKeys: Object.keys(product ?? {}).sort(),
      variantKeys: primaryVariant ? Object.keys(primaryVariant).sort() : [],
      inventoryKeys: primaryInventory
        ? Object.keys(primaryInventory).sort()
        : [],
    }),
  );
}

type LightspeedSaleProductLookup = {
  name: string | null;
  sku: string | null;
};

function logLightspeedSyncEvent(
  event:
    | "sync_start"
    | "sync_complete"
    | "sync_error"
    | "name_resolution_gap"
    | "inventory_sync",
  payload: Record<string, unknown>,
) {
  const message = JSON.stringify({
    provider: "lightspeed",
    event,
    ...payload,
  });

  if (event === "sync_error") {
    console.error(`[POS-SYNC-WORKER] ${message}`);
    return;
  }

  if (event === "name_resolution_gap") {
    console.warn(`[POS-SYNC-WORKER] ${message}`);
    return;
  }

  console.log(`[POS-SYNC-WORKER] ${message}`);
}

function getLightspeedSaleLineItems(sale: any) {
  const lineItems =
    sale.line_items ?? sale.SaleLines?.SaleLine ?? sale.SaleLines ?? [];

  if (Array.isArray(lineItems)) {
    return lineItems;
  }

  return lineItems ? [lineItems] : [];
}

function getLightspeedSaleLineItemProductId(lineItem: any) {
  return getFirstNonEmptyString(
    lineItem?.product_id,
    lineItem?.productId,
    lineItem?.productID,
    lineItem?.item_id,
    lineItem?.itemId,
  );
}

function getLightspeedSaleLineItemName(lineItem: any) {
  return getFirstNonEmptyString(
    lineItem?.product_name,
    lineItem?.productName,
    lineItem?.name,
    lineItem?.description,
  );
}

async function fetchLightspeedSaleProductLookup(
  supabase: any,
  tenantId: string,
  sales: any[],
) {
  const productIds = new Set<string>();

  for (const sale of sales) {
    for (const lineItem of getLightspeedSaleLineItems(sale)) {
      const productId = getLightspeedSaleLineItemProductId(lineItem);
      if (productId) {
        productIds.add(productId);
      }
    }
  }

  if (productIds.size === 0) {
    return new Map<string, LightspeedSaleProductLookup>();
  }

  const { data, error } = await supabase
    .from("lightspeed_products")
    .select("lightspeed_product_id, name, sku")
    .eq("tenant_id", tenantId)
    .in("lightspeed_product_id", Array.from(productIds));

  if (error) {
    console.warn(
      `[POS-SYNC-WORKER] Unable to build Lightspeed sale product lookup: ${error.message}`,
    );
    return new Map<string, LightspeedSaleProductLookup>();
  }

  return new Map<string, LightspeedSaleProductLookup>(
    (data ?? []).map((row: any) => [
      row.lightspeed_product_id,
      {
        name: row.name ?? null,
        sku: row.sku ?? null,
      },
    ]),
  );
}

function logLightspeedNameResolutionGap(
  sales: any[],
  productLookup: Map<string, LightspeedSaleProductLookup>,
  tenantId: string,
  page: number,
) {
  let totalLineItems = 0;
  let unresolvedLineItems = 0;

  for (const sale of sales) {
    for (const lineItem of getLightspeedSaleLineItems(sale)) {
      totalLineItems += 1;
      const productId = getLightspeedSaleLineItemProductId(lineItem);
      const resolvedName =
        getLightspeedSaleLineItemName(lineItem) ??
        (productId ? (productLookup.get(productId)?.name ?? null) : null);

      if (!resolvedName) {
        unresolvedLineItems += 1;
      }
    }
  }

  if (totalLineItems > 0 && unresolvedLineItems / totalLineItems > 0.1) {
    logLightspeedSyncEvent("name_resolution_gap", {
      entity: "sales",
      tenant_id: tenantId,
      page: page + 1,
      total_line_items: totalLineItems,
      unresolved_line_items: unresolvedLineItems,
    });
  }
}

async function propagateLightspeedSalesRollupToCrm(
  supabase: any,
  tenantId: string,
  lightspeedCustomerId: string,
  purchaseCount: number,
  totalSpend: number,
  firstPurchaseDate: string | null,
  lastPurchaseDate: string | null,
) {
  const crmRollupPayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    pos_source: "lightspeed",
    external_id: lightspeedCustomerId,
    pos_order_count: purchaseCount,
    total_spent: totalSpend,
    pos_total_spent: totalSpend,
    lifetime_value: totalSpend,
    first_purchase_date: firstPurchaseDate,
    last_purchase_date: lastPurchaseDate,
  };

  const { data: updatedCrmRows, error: updateCrmError } = await supabase
    .from("crm_customers")
    .update(crmRollupPayload)
    .eq("tenant_id", tenantId)
    .eq("pos_source", "lightspeed")
    .eq("external_id", lightspeedCustomerId)
    .select("id");

  if (updateCrmError) {
    console.error(
      "[POS-SYNC-WORKER] Failed to propagate Lightspeed sales rollup to CRM:",
      updateCrmError.message,
    );
    return;
  }

  if (!updatedCrmRows || updatedCrmRows.length === 0) {
    console.warn(
      `[POS-SYNC-WORKER] No CRM customer linked to Lightspeed customer ${lightspeedCustomerId}; skipping CRM rollup propagation`,
    );
  }
}

function mapLightspeedSale(sale: any, connection: any) {
  const payment = Array.isArray(sale.payments)
    ? sale.payments[0]
    : (sale.SalePayments?.SalePayment?.[0] ?? null);

  return {
    tenant_id: connection.tenant_id,
    lightspeed_sale_id: String(sale.id ?? sale.sale_id ?? sale.saleID),
    lightspeed_customer_id: sale.customer_id
      ? String(sale.customer_id)
      : sale.customer?.id
        ? String(sale.customer.id)
        : sale.customerID
          ? String(sale.customerID)
          : null,
    contact_id: sale.Customer?.contactID
      ? String(sale.Customer.contactID)
      : null,
    sale_date:
      sale.completed_at ??
      sale.created_at ??
      sale.completeTime ??
      sale.createTime ??
      null,
    total_amount:
      sale.total_price !== undefined && sale.total_price !== null
        ? Number.parseFloat(String(sale.total_price))
        : sale.calcTotal !== undefined && sale.calcTotal !== null
          ? Number.parseFloat(String(sale.calcTotal))
          : Number.parseFloat(String(sale.total ?? 0)),
    status:
      normalizeLightspeedSaleStatus(sale.status) ||
      (parseLightspeedCompletedFlag(sale.completed) ? "completed" : "open"),
    line_items:
      sale.line_items ?? sale.SaleLines?.SaleLine ?? sale.SaleLines ?? [],
    payment_method:
      payment?.payment_type_name ??
      payment?.PaymentType?.name ??
      payment?.paymentType?.name ??
      null,
    note: sale.note ?? null,
    raw_data: sale,
    synced_at: new Date().toISOString(),
  };
}

function mapLightspeedProduct(
  product: any,
  connection: any,
  lookups: LightspeedProductLookups,
) {
  const resolvedProductType = resolveLightspeedProductTypeName(
    product,
    lookups,
  );

  return {
    tenant_id: connection.tenant_id,
    lightspeed_product_id: String(
      product.id ?? product.product_id ?? product.itemID,
    ),
    name: product.name ?? product.description ?? null,
    sku:
      product.sku ??
      product.systemSku ??
      product.customSku ??
      product.manufacturerSku ??
      null,
    description: product.description ?? product.longDescription ?? null,
    price: extractLightspeedProductPrice(product),
    supply_price: extractLightspeedProductSupplyPrice(product),
    inventory_count: extractLightspeedProductInventoryCount(product),
    stock_count: extractLightspeedProductInventoryCount(product),
    category: resolvedProductType,
    product_type: resolvedProductType,
    brand: resolveLightspeedProductBrand(product),
    tags: resolveLightspeedProductTags(product, lookups),
    raw_data: product,
    synced_at: new Date().toISOString(),
  };
}

function mapLightspeedProductToCatalogProduct(
  row: ReturnType<typeof mapLightspeedProduct>,
) {
  return {
    tenant_id: row.tenant_id,
    external_id: row.lightspeed_product_id,
    source: "lightspeed",
    name: row.name ?? "Unnamed Product",
    description: row.description,
    sku: row.sku,
    price: row.price ?? 0,
    cost_price: row.supply_price ?? 0,
    currency: "USD",
    inventory_count: row.inventory_count ?? 0,
    stock_count: row.stock_count ?? row.inventory_count ?? 0,
    category: row.category ?? row.product_type ?? null,
    tags: Array.isArray(row.tags) ? row.tags : [],
    external_data: row.raw_data ?? {},
    last_synced_at: row.synced_at,
    status: "active",
    is_visible: true,
    updated_at: new Date().toISOString(),
  };
}

function buildHandledSyncResult(
  job: any,
  syncType: string,
  currentPage: number,
  totalPagesEst: number | null,
  message: string,
  terminalStatus: "failed" | "delayed",
  currentCursor?: string | null,
): SyncResult {
  return {
    customers: 0,
    orders: 0,
    products: 0,
    rows: 0,
    cursor: currentCursor ?? String(currentPage),
    connectionCursor: currentCursor ?? String(currentPage),
    currentPage,
    totalPagesEst,
    fetchedRows: 0,
    insertedRows: 0,
    skippedRows: 0,
    failedRows: terminalStatus === "failed" ? 1 : 0,
    progressMessage: message,
    error: message,
    terminalStatus,
  };
}

async function handleApiError(
  supabase: any,
  job: any,
  response: Response,
  syncType: string,
  currentPage: number,
  totalPagesEst: number | null,
  options?: {
    providerLabel?: string;
    currentCursor?: string | null;
  },
) {
  const providerLabel = options?.providerLabel ?? "Lightspeed";
  const currentCursor = options?.currentCursor ?? String(currentPage);
  let responseBody: any = null;

  try {
    responseBody = await response.json();
  } catch {
    responseBody = null;
  }

  const upstreamMessage =
    responseBody?.error ??
    responseBody?.message ??
    responseBody?.errors?.[0]?.message ??
    response.statusText ??
    `${providerLabel} API error`;

  if (response.status === 401) {
    const message = "Token invalid or expired. Re-authorize the integration.";
    await supabase.rpc("fail_pos_sync_job", {
      p_job_id: job.id,
      p_error: message,
    });
    await writeJobProgress(supabase, job.id, {
      status: "failed",
      last_error: message,
      progress_message: message,
      failed_rows: toFiniteNumber(job.failed_rows, 0) + 1,
    });
    return buildHandledSyncResult(
      job,
      syncType,
      currentPage,
      totalPagesEst,
      message,
      "failed",
      currentCursor,
    );
  }

  if (response.status === 403) {
    const message = "API access denied. Check webhook/API permissions.";
    await supabase.rpc("fail_pos_sync_job", {
      p_job_id: job.id,
      p_error: message,
    });
    await writeJobProgress(supabase, job.id, {
      status: "failed",
      last_error: message,
      progress_message: message,
      failed_rows: toFiniteNumber(job.failed_rows, 0) + 1,
    });
    return buildHandledSyncResult(
      job,
      syncType,
      currentPage,
      totalPagesEst,
      message,
      "failed",
    );
  }

  if (response.status === 404) {
    const message = "API endpoint not found. Confirm X-Series account type.";
    await supabase.rpc("fail_pos_sync_job", {
      p_job_id: job.id,
      p_error: message,
    });
    await writeJobProgress(supabase, job.id, {
      status: "failed",
      last_error: message,
      progress_message: message,
      failed_rows: toFiniteNumber(job.failed_rows, 0) + 1,
    });
    return buildHandledSyncResult(
      job,
      syncType,
      currentPage,
      totalPagesEst,
      message,
      "failed",
    );
  }

  if (response.status === 429 || response.status >= 500) {
    const retryDelayMs = response.status === 429 ? 60_000 : 120_000;
    const nextRetryAt = new Date(Date.now() + retryDelayMs).toISOString();
    const message =
      response.status === 429
        ? `Rate limited by ${providerLabel} API. Retrying after cooldown. ${upstreamMessage}`
        : `${providerLabel} API unavailable. Retrying after cooldown. ${upstreamMessage}`;

    await writeJobProgress(supabase, job.id, {
      status: "delayed",
      next_retry_at: nextRetryAt,
      last_error: message,
      progress_message: message,
      current_page: currentPage,
      current_cursor: currentCursor,
    });

    return buildHandledSyncResult(
      job,
      syncType,
      currentPage,
      totalPagesEst,
      message,
      "delayed",
      currentCursor,
    );
  }

  const message = `${providerLabel} API error (${response.status}): ${upstreamMessage}`;
  await supabase.rpc("fail_pos_sync_job", {
    p_job_id: job.id,
    p_error: message,
  });
  await writeJobProgress(supabase, job.id, {
    status: "failed",
    last_error: message,
    progress_message: message,
    failed_rows: toFiniteNumber(job.failed_rows, 0) + 1,
  });
  return buildHandledSyncResult(
    job,
    syncType,
    currentPage,
    totalPagesEst,
    message,
    "failed",
  );
}

async function syncLightspeedCustomers(
  supabase: any,
  connection: any,
  job: any,
  accessToken: string,
  ensureTokenReEncrypted: () => Promise<void>,
): Promise<SyncResult> {
  const syncStartedAt = Date.now();
  const currentCursor = getLightspeedResumeCursor(
    job,
    connection,
    "customers",
    Boolean(job.is_delta),
  );
  const currentPage = getLightspeedResumePage(
    job,
    job.current_cursor || job.last_sync_cursor,
  );
  const totalPagesEst = getLightspeedTotalPagesEstimate(job);
  const baseUrl = getLightspeedSyncBaseUrl(connection, "2.0");

  logLightspeedSyncEvent("sync_start", {
    entity: "customers",
    tenant_id: connection.tenant_id,
    page: currentPage + 1,
  });

  await writeJobProgress(supabase, job.id, {
    status: "in_progress",
    started_at: job.started_at ?? new Date().toISOString(),
    current_page: currentPage,
    current_cursor: String(currentCursor),
    total_pages_est: totalPagesEst,
    fetched_rows: toFiniteNumber(job.fetched_rows, 0),
    inserted_rows: toFiniteNumber(job.inserted_rows, 0),
    progress_message: `Fetching customers — page ${currentPage + 1} · ${toFiniteNumber(job.fetched_rows, 0).toLocaleString()} retrieved so far`,
  });

  const response = await fetch(
    currentCursor > 0
      ? `${baseUrl}/customers?after=${currentCursor}`
      : `${baseUrl}/customers`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (!response.ok) {
    logLightspeedSyncEvent("sync_error", {
      entity: "customers",
      tenant_id: connection.tenant_id,
      page: currentPage + 1,
      error: `HTTP ${response.status}`,
    });
    return await handleApiError(
      supabase,
      job,
      response,
      "customers",
      currentPage,
      totalPagesEst,
      { currentCursor: String(currentCursor) },
    );
  }

  await ensureTokenReEncrypted();

  const data = await response.json();
  const customers = Array.isArray(data?.data) ? data.data : [];
  const mappedRows = customers.map((customer: any) =>
    mapLightspeedCustomer(customer, connection),
  );
  const fetchedRows = customers.length;
  let insertedRows = 0;
  let failedRows = 0;

  for (const row of mappedRows) {
    try {
      const { error: upsertError } = await supabase
        .from("lightspeed_customers")
        .upsert(row, { onConflict: "tenant_id,lightspeed_customer_id" });

      if (upsertError) {
        failedRows += 1;
        console.error(
          "[POS-SYNC-WORKER] Failed to upsert Lightspeed customer:",
          upsertError.message,
        );
        continue;
      }

      insertedRows += 1;

      if (row.email || row.phone) {
        const crmPayload = buildLightspeedCrmCustomerPayload(row);
        let crmFailureRecorded = false;
        const recordCrmFailure = () => {
          if (!crmFailureRecorded) {
            failedRows += 1;
            crmFailureRecorded = true;
          }
        };
        const { data: linkedContact, error: linkedContactError } =
          await supabase
            .from("crm_customers")
            .select("id,email,phone")
            .eq("tenant_id", connection.tenant_id)
            .eq("pos_source", "lightspeed")
            .eq("external_id", row.lightspeed_customer_id)
            .maybeSingle();

        if (linkedContactError) {
          recordCrmFailure();
          console.error(
            "[POS-SYNC-WORKER] Failed to look up CRM customer by Lightspeed external_id:",
            linkedContactError.message,
          );
          continue;
        }

        const filters = [];
        if (row.email) filters.push(`email.eq.${row.email}`);
        if (row.phone) filters.push(`phone.eq.${row.phone}`);

        const { data: matchingContacts, error: matchingContactsError } =
          linkedContact
            ? { data: [linkedContact], error: null }
            : filters.length > 0
              ? await supabase
                  .from("crm_customers")
                  .select("id,email,phone")
                  .eq("tenant_id", connection.tenant_id)
                  .or(filters.join(","))
                  .limit(10)
              : { data: [], error: null };

        if (matchingContactsError) {
          recordCrmFailure();
          console.error(
            "[POS-SYNC-WORKER] Failed to look up CRM customer for Lightspeed customer:",
            matchingContactsError.message,
          );
        } else {
          const matchedByEmail = row.email
            ? (matchingContacts ?? []).find(
                (contact: { email?: string | null }) =>
                  contact.email === row.email,
              )
            : null;
          const matchedByPhone =
            !matchedByEmail && row.phone
              ? (matchingContacts ?? []).find(
                  (contact: { phone?: string | null }) =>
                    contact.phone === row.phone,
                )
              : null;

          let contactId =
            linkedContact?.id ??
            matchedByEmail?.id ??
            matchedByPhone?.id ??
            row.contact_id ??
            null;

          if (contactId) {
            const crmUpdatePayload = { ...crmPayload };
            if (!matchedByEmail) {
              delete crmUpdatePayload.email;
            }

            const { error: updateCrmError } = await supabase
              .from("crm_customers")
              .update(crmUpdatePayload)
              .eq("id", contactId);

            if (updateCrmError) {
              recordCrmFailure();
              console.error(
                "[POS-SYNC-WORKER] Failed to update CRM customer for Lightspeed customer:",
                updateCrmError.message,
              );
            }
          } else if (row.email) {
            const { data: newContact, error: createError } = await supabase
              .from("crm_customers")
              .upsert(crmPayload, { onConflict: "tenant_id,email" })
              .select("id")
              .single();

            if (createError) {
              recordCrmFailure();
              console.error(
                "[POS-SYNC-WORKER] Failed to create CRM customer for Lightspeed customer:",
                createError.message,
              );
            } else {
              contactId = newContact?.id ?? null;
            }
          }

          if (contactId) {
            const { error: linkError } = await supabase
              .from("lightspeed_customers")
              .update({ contact_id: contactId })
              .eq("tenant_id", connection.tenant_id)
              .eq("lightspeed_customer_id", row.lightspeed_customer_id);

            if (linkError) {
              recordCrmFailure();
              console.error(
                "[POS-SYNC-WORKER] Failed to link Lightspeed customer to CRM customer:",
                linkError.message,
              );
            }
          }
        }
      }
    } catch (error: any) {
      failedRows += 1;
      console.error(
        "[POS-SYNC-WORKER] Failed to process Lightspeed customer row:",
        error?.message ?? error,
      );
    }
  }

  const skippedRows = Math.max(0, fetchedRows - insertedRows - failedRows);
  const nextVersion = parseLightspeedVersionCursor(data?.version?.max);
  const hasNextPage =
    customers.length > 0 && nextVersion > 0 && nextVersion !== currentCursor;
  const nextPage = fetchedRows === 0 ? currentPage : currentPage + 1;
  const totalFetched = toFiniteNumber(job.fetched_rows, 0) + fetchedRows;
  const totalInserted = toFiniteNumber(job.inserted_rows, 0) + insertedRows;
  const totalSkipped = toFiniteNumber(job.skipped_rows, 0) + skippedRows;
  const totalFailed = toFiniteNumber(job.failed_rows, 0) + failedRows;

  logLightspeedSyncEvent("sync_complete", {
    entity: "customers",
    tenant_id: connection.tenant_id,
    page: currentPage + 1,
    records_synced: insertedRows,
    duration_ms: Date.now() - syncStartedAt,
    has_more: hasNextPage,
  });

  await writeJobProgress(supabase, job.id, {
    status: !hasNextPage ? "completed" : "in_progress",
    current_page: nextPage,
    current_cursor: String(hasNextPage ? nextVersion : currentCursor),
    total_pages_est: totalPagesEst,
    fetched_rows: totalFetched,
    inserted_rows: totalInserted,
    skipped_rows: totalSkipped,
    failed_rows: totalFailed,
    progress_message: !hasNextPage
      ? `Complete — ${totalInserted.toLocaleString()} customers imported`
      : `Fetched customers — page ${currentPage + 1} complete · ${totalFetched.toLocaleString()} retrieved so far`,
  });

  return {
    customers: insertedRows,
    orders: 0,
    products: 0,
    rows: fetchedRows,
    cursor: hasNextPage ? String(nextVersion) : null,
    connectionCursor: String(hasNextPage ? nextVersion : currentCursor),
    currentPage: nextPage,
    totalPagesEst,
    fetchedRows,
    insertedRows,
    skippedRows,
    failedRows,
    progressMessage: !hasNextPage
      ? `Complete — ${totalInserted.toLocaleString()} customers imported`
      : `Queued customers page ${nextPage + 1}`,
  };
}

async function syncLightspeedSales(
  supabase: any,
  connection: any,
  job: any,
  accessToken: string,
  ensureTokenReEncrypted: () => Promise<void>,
): Promise<SyncResult> {
  const syncStartedAt = Date.now();
  const currentCursor = getLightspeedResumeCursor(
    job,
    connection,
    "sales",
    Boolean(job.is_delta),
  );
  const currentPage = getLightspeedResumePage(
    job,
    job.current_cursor || job.last_sync_cursor,
  );
  const totalPagesEst = getLightspeedTotalPagesEstimate(job);
  const baseUrl = getLightspeedSyncBaseUrl(connection, "2.0");

  logLightspeedSyncEvent("sync_start", {
    entity: "sales",
    tenant_id: connection.tenant_id,
    page: currentPage + 1,
  });

  await writeJobProgress(supabase, job.id, {
    status: "in_progress",
    started_at: job.started_at ?? new Date().toISOString(),
    current_page: currentPage,
    current_cursor: String(currentCursor),
    total_pages_est: totalPagesEst,
    fetched_rows: toFiniteNumber(job.fetched_rows, 0),
    inserted_rows: toFiniteNumber(job.inserted_rows, 0),
    progress_message: `Fetching sales — page ${currentPage + 1} · ${toFiniteNumber(job.fetched_rows, 0).toLocaleString()} retrieved`,
  });

  const response = await fetch(
    currentCursor > 0
      ? `${baseUrl}/sales?after=${currentCursor}`
      : `${baseUrl}/sales`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (!response.ok) {
    logLightspeedSyncEvent("sync_error", {
      entity: "sales",
      tenant_id: connection.tenant_id,
      page: currentPage + 1,
      error: `HTTP ${response.status}`,
    });
    return await handleApiError(
      supabase,
      job,
      response,
      "sales",
      currentPage,
      totalPagesEst,
      { currentCursor: String(currentCursor) },
    );
  }

  await ensureTokenReEncrypted();

  const data = await response.json();
  const sales = Array.isArray(data?.data) ? data.data : [];
  const productLookup = await fetchLightspeedSaleProductLookup(
    supabase,
    connection.tenant_id,
    sales,
  );
  logLightspeedNameResolutionGap(
    sales,
    productLookup,
    connection.tenant_id,
    currentPage,
  );
  const fetchedRows = sales.length;
  let insertedRows = 0;
  let failedRows = 0;
  const affectedCustomerIds = new Set<string>();

  for (const sale of sales) {
    try {
      const mappedSale = mapLightspeedSale(sale, connection);

      if (!mappedSale.contact_id && mappedSale.lightspeed_customer_id) {
        const { data: existingCustomer } = await supabase
          .from("lightspeed_customers")
          .select("contact_id")
          .eq("tenant_id", connection.tenant_id)
          .eq("lightspeed_customer_id", mappedSale.lightspeed_customer_id)
          .maybeSingle();

        mappedSale.contact_id = existingCustomer?.contact_id ?? null;
      }

      const { error: upsertError } = await supabase
        .from("lightspeed_sales")
        .upsert(mappedSale, { onConflict: "tenant_id,lightspeed_sale_id" });

      if (upsertError) {
        failedRows += 1;
        console.error(
          "[POS-SYNC-WORKER] Failed to upsert Lightspeed sale:",
          upsertError.message,
        );
        continue;
      }

      if (
        mappedSale.lightspeed_customer_id &&
        isCompletedLightspeedSaleStatus(mappedSale.status)
      ) {
        affectedCustomerIds.add(mappedSale.lightspeed_customer_id);
      }

      insertedRows += 1;
    } catch (error: any) {
      failedRows += 1;
      console.error(
        "[POS-SYNC-WORKER] Failed to process Lightspeed sale row:",
        error?.message ?? error,
      );
    }
  }

  for (const customerId of affectedCustomerIds) {
    const { data: customerSales, error: customerSalesError } = await supabase
      .from("lightspeed_sales")
      .select("total_amount, sale_date, status")
      .eq("tenant_id", connection.tenant_id)
      .eq("lightspeed_customer_id", customerId)
      .order("sale_date", { ascending: true });

    if (customerSalesError) {
      console.error(
        "[POS-SYNC-WORKER] Failed to load customer sales totals:",
        customerSalesError.message,
      );
      continue;
    }

    const completedCustomerSales = (customerSales ?? []).filter(
      (customerSale: any) =>
        isCompletedLightspeedSaleStatus(customerSale.status),
    );

    if (completedCustomerSales.length === 0) {
      continue;
    }

    const totalSpend = completedCustomerSales.reduce(
      (sum: number, customerSale: any) =>
        sum + Number.parseFloat(String(customerSale.total_amount ?? 0)),
      0,
    );
    const purchaseCount = completedCustomerSales.length;
    const firstPurchaseDate = completedCustomerSales[0]?.sale_date ?? null;
    const lastPurchaseDate =
      completedCustomerSales[completedCustomerSales.length - 1]?.sale_date ??
      null;

    const { error: updateCustomerError } = await supabase
      .from("lightspeed_customers")
      .update({
        total_spend: totalSpend,
        purchase_count: purchaseCount,
        first_purchase_date: firstPurchaseDate,
        last_purchase_date: lastPurchaseDate,
      })
      .eq("tenant_id", connection.tenant_id)
      .eq("lightspeed_customer_id", customerId);

    if (updateCustomerError) {
      console.error(
        "[POS-SYNC-WORKER] Failed to update Lightspeed customer aggregates:",
        updateCustomerError.message,
      );
      continue;
    }

    await propagateLightspeedSalesRollupToCrm(
      supabase,
      connection.tenant_id,
      customerId,
      purchaseCount,
      totalSpend,
      firstPurchaseDate,
      lastPurchaseDate,
    );
  }

  const skippedRows = Math.max(0, fetchedRows - insertedRows - failedRows);
  const nextVersion = parseLightspeedVersionCursor(data?.version?.max);
  const hasNextPage =
    sales.length > 0 && nextVersion > 0 && nextVersion !== currentCursor;
  const nextPage = fetchedRows === 0 ? currentPage : currentPage + 1;
  const totalFetched = toFiniteNumber(job.fetched_rows, 0) + fetchedRows;
  const totalInserted = toFiniteNumber(job.inserted_rows, 0) + insertedRows;
  const totalSkipped = toFiniteNumber(job.skipped_rows, 0) + skippedRows;
  const totalFailed = toFiniteNumber(job.failed_rows, 0) + failedRows;

  logLightspeedSyncEvent("sync_complete", {
    entity: "sales",
    tenant_id: connection.tenant_id,
    page: currentPage + 1,
    records_synced: insertedRows,
    duration_ms: Date.now() - syncStartedAt,
    has_more: hasNextPage,
  });

  await writeJobProgress(supabase, job.id, {
    status: !hasNextPage ? "completed" : "in_progress",
    current_page: nextPage,
    current_cursor: String(hasNextPage ? nextVersion : currentCursor),
    total_pages_est: totalPagesEst,
    fetched_rows: totalFetched,
    inserted_rows: totalInserted,
    skipped_rows: totalSkipped,
    failed_rows: totalFailed,
    progress_message: !hasNextPage
      ? `Complete — ${totalInserted.toLocaleString()} sales imported`
      : `Fetched sales — page ${currentPage + 1} complete · ${totalFetched.toLocaleString()} retrieved so far`,
  });

  return {
    customers: 0,
    orders: insertedRows,
    products: 0,
    rows: fetchedRows,
    cursor: hasNextPage ? String(nextVersion) : null,
    connectionCursor: String(hasNextPage ? nextVersion : currentCursor),
    currentPage: nextPage,
    totalPagesEst,
    fetchedRows,
    insertedRows,
    skippedRows,
    failedRows,
    progressMessage: !hasNextPage
      ? `Complete — ${totalInserted.toLocaleString()} sales imported`
      : `Queued sales page ${nextPage + 1}`,
  };
}

async function syncLightspeedProducts(
  supabase: any,
  connection: any,
  job: any,
  accessToken: string,
  ensureTokenReEncrypted: () => Promise<void>,
): Promise<SyncResult> {
  const syncStartedAt = Date.now();
  const currentCursor = getLightspeedResumeCursor(
    job,
    connection,
    "products",
    Boolean(job.is_delta),
  );
  const currentPage = getLightspeedResumePage(
    job,
    job.current_cursor || job.last_sync_cursor,
  );
  const totalPagesEst = getLightspeedTotalPagesEstimate(job);

  logLightspeedSyncEvent("sync_start", {
    entity: "products",
    tenant_id: connection.tenant_id,
    page: currentPage + 1,
  });

  let productApiVersion = "2.0";
  let productUrl =
    currentCursor > 0
      ? `${getLightspeedSyncBaseUrl(connection, "2.0")}/products?after=${currentCursor}`
      : `${getLightspeedSyncBaseUrl(connection, "2.0")}/products`;

  console.log(
    `[POS-SYNC-WORKER] Fetching Lightspeed products from: ${productUrl}`,
  );

  await writeJobProgress(supabase, job.id, {
    status: "in_progress",
    started_at: job.started_at ?? new Date().toISOString(),
    current_page: currentPage,
    current_cursor: String(currentCursor),
    total_pages_est: totalPagesEst,
    fetched_rows: toFiniteNumber(job.fetched_rows, 0),
    inserted_rows: toFiniteNumber(job.inserted_rows, 0),
    progress_message: `Fetching products — page ${currentPage + 1} · ${toFiniteNumber(job.fetched_rows, 0).toLocaleString()} retrieved so far`,
  });

  let response = await fetch(productUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok && (response.status === 400 || response.status === 404)) {
    productApiVersion = "3.0";
    productUrl =
      currentCursor > 0
        ? `${getLightspeedSyncBaseUrl(connection, "3.0")}/products?since_version=${currentCursor}`
        : `${getLightspeedSyncBaseUrl(connection, "3.0")}/products`;
    console.log(
      `[POS-SYNC-WORKER] Retrying Lightspeed products with ${productApiVersion}: ${productUrl}`,
    );
    response = await fetch(productUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }

  const responseText = await response.text();

  console.log(
    `[POS-SYNC-WORKER] Lightspeed products response status: ${response.status} (${productApiVersion})`,
  );
  console.log(
    `[POS-SYNC-WORKER] Lightspeed products response preview: ${responseText.slice(0, 500)}`,
  );

  if (!response.ok) {
    logLightspeedSyncEvent("sync_error", {
      entity: "products",
      tenant_id: connection.tenant_id,
      page: currentPage + 1,
      error: `HTTP ${response.status}`,
    });
    return await handleApiError(
      supabase,
      job,
      new Response(responseText, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      }),
      "products",
      currentPage,
      totalPagesEst,
      { currentCursor: String(currentCursor) },
    );
  }

  await ensureTokenReEncrypted();

  let data: any = {};

  try {
    data = responseText.trim().length > 0 ? JSON.parse(responseText) : {};
  } catch (error: any) {
    const message = `Lightspeed products response was not valid JSON: ${error?.message ?? error}`;
    logLightspeedSyncEvent("sync_error", {
      entity: "products",
      tenant_id: connection.tenant_id,
      page: currentPage + 1,
      error: message,
    });
    await supabase.rpc("fail_pos_sync_job", {
      p_job_id: job.id,
      p_error: message,
    });
    await writeJobProgress(supabase, job.id, {
      status: "failed",
      last_error: message,
      progress_message: message,
      failed_rows: toFiniteNumber(job.failed_rows, 0) + 1,
    });
    return buildHandledSyncResult(
      job,
      "products",
      currentPage,
      totalPagesEst,
      message,
      "failed",
      String(currentCursor),
    );
  }

  const rawProducts = Array.isArray(data)
    ? data
    : (data?.data ?? data?.products ?? []);
  const products = getLightspeedObjectArray(rawProducts);
  const productLookups = await fetchLightspeedProductLookups(
    connection,
    accessToken,
  );
  const fetchedRows = products.length;
  let insertedRows = 0;
  let failedRows = 0;

  console.log(
    `[POS-SYNC-WORKER] Products in response: ${Array.isArray(rawProducts) ? rawProducts.length : fetchedRows}`,
  );

  if (products.length > 0) {
    const firstProduct = products[0] as Record<string, unknown>;
    console.log(
      `[POS-SYNC-WORKER] First Lightspeed product keys: ${Object.keys(firstProduct).sort().join(", ")}`,
    );
    console.log(
      `[POS-SYNC-WORKER] First Lightspeed product price fields: ${JSON.stringify(
        {
          price: firstProduct.price ?? null,
          retail_price: firstProduct.retail_price ?? null,
          price_including_tax: firstProduct.price_including_tax ?? null,
          default_price: firstProduct.default_price ?? null,
        },
      )}`,
    );
  }

  if (currentPage === 0 && products.length > 0) {
    logLightspeedProductShape(products[0]);
  }

  for (const product of products) {
    try {
      const mappedProduct = mapLightspeedProduct(
        product,
        connection,
        productLookups,
      );
      const { error: upsertError } = await supabase
        .from("lightspeed_products")
        .upsert(mappedProduct, {
          onConflict: "tenant_id,lightspeed_product_id",
        });

      if (upsertError) {
        failedRows += 1;
        console.error(
          "[POS-SYNC-WORKER] Failed to upsert Lightspeed product:",
          upsertError.message,
        );
        continue;
      }

      const { error: sharedProductError } = await supabase
        .from("products")
        .upsert(mapLightspeedProductToCatalogProduct(mappedProduct), {
          onConflict: "tenant_id,external_id",
        });

      if (sharedProductError) {
        failedRows += 1;
        console.error(
          "[POS-SYNC-WORKER] Failed to mirror Lightspeed product into products table:",
          sharedProductError.message,
        );
        continue;
      }

      insertedRows += 1;
    } catch (error: any) {
      failedRows += 1;
      console.error(
        "[POS-SYNC-WORKER] Failed to process Lightspeed product row:",
        error?.message ?? error,
      );
    }
  }

  const skippedRows = Math.max(0, fetchedRows - insertedRows - failedRows);
  const nextVersion = parseLightspeedVersionCursor(data?.version?.max);
  const hasNextPage =
    products.length > 0 && nextVersion > 0 && nextVersion !== currentCursor;
  const nextPage = fetchedRows === 0 ? currentPage : currentPage + 1;
  const totalFetched = toFiniteNumber(job.fetched_rows, 0) + fetchedRows;
  const totalInserted = toFiniteNumber(job.inserted_rows, 0) + insertedRows;
  const totalSkipped = toFiniteNumber(job.skipped_rows, 0) + skippedRows;
  const totalFailed = toFiniteNumber(job.failed_rows, 0) + failedRows;
  let inventorySummary: LightspeedInventorySyncSummary | null = null;

  if (!hasNextPage) {
    inventorySummary = await syncLightspeedProductInventory(
      supabase,
      connection,
      job,
      accessToken,
      ensureTokenReEncrypted,
      totalFetched,
    );
  }

  const completionMessage = !hasNextPage
    ? inventorySummary
      ? `Complete — ${totalInserted.toLocaleString()} products imported · inventory synced for ${inventorySummary.productsWithStock.toLocaleString()} products in stock`
      : `Complete — ${totalInserted.toLocaleString()} products imported`
    : `Fetched products — page ${currentPage + 1} complete · ${totalFetched.toLocaleString()} retrieved so far`;

  logLightspeedSyncEvent("sync_complete", {
    entity: "products",
    tenant_id: connection.tenant_id,
    page: currentPage + 1,
    api_version: productApiVersion,
    records_fetched: fetchedRows,
    records_synced: insertedRows,
    failed_rows: failedRows,
    duration_ms: Date.now() - syncStartedAt,
    has_more: hasNextPage,
  });

  await writeJobProgress(supabase, job.id, {
    status: !hasNextPage ? "completed" : "in_progress",
    current_page: nextPage,
    current_cursor: String(hasNextPage ? nextVersion : currentCursor),
    total_pages_est: totalPagesEst,
    fetched_rows: totalFetched,
    inserted_rows: totalInserted,
    skipped_rows: totalSkipped,
    failed_rows: totalFailed,
    progress_message: completionMessage,
  });

  return {
    customers: 0,
    orders: 0,
    products: insertedRows,
    rows: fetchedRows,
    cursor: hasNextPage ? String(nextVersion) : null,
    connectionCursor: String(hasNextPage ? nextVersion : currentCursor),
    currentPage: nextPage,
    totalPagesEst,
    fetchedRows,
    insertedRows,
    skippedRows,
    failedRows,
    progressMessage: !hasNextPage
      ? completionMessage
      : `Queued products page ${nextPage + 1}`,
  };
}

function buildProgressTotals(job: any, result: SyncResult) {
  const rowInsertCount =
    result.insertedRows ?? result.customers + result.orders + result.products;

  return {
    fetchedRows:
      toFiniteNumber(job.fetched_rows, 0) + (result.fetchedRows ?? result.rows),
    insertedRows: toFiniteNumber(job.inserted_rows, 0) + rowInsertCount,
    skippedRows:
      toFiniteNumber(job.skipped_rows, 0) + (result.skippedRows ?? 0),
    failedRows: toFiniteNumber(job.failed_rows, 0) + (result.failedRows ?? 0),
  };
}

function getLightspeedConnectionUpdate(
  syncType: string,
  totalSynced: number,
  timestamp: string,
  versionCursor: string | null,
) {
  const normalized = normalizeLightspeedSyncType(syncType);

  if (normalized === "customers") {
    return {
      last_customer_sync: timestamp,
      customers_synced: totalSynced,
      last_customer_version_cursor: versionCursor,
      last_synced_at: timestamp,
    };
  }

  if (normalized === "sales") {
    return {
      last_sales_sync: timestamp,
      sales_synced: totalSynced,
      last_sales_version_cursor: versionCursor,
      last_synced_at: timestamp,
    };
  }

  return {
    last_product_sync: timestamp,
    products_synced: totalSynced,
    last_product_version_cursor: versionCursor,
    last_synced_at: timestamp,
  };
}

function splitShopifyTags(tags: unknown) {
  if (typeof tags !== "string" || tags.trim().length === 0) {
    return [] as string[];
  }

  return tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function extractNextPageInfo(linkHeader: string | null) {
  if (!linkHeader) {
    return null;
  }

  const match = linkHeader.match(/page_info=([^&>]+)[^>]*>;\s*rel="next"/i);
  return match?.[1] ?? null;
}

function mapShopifyCustomer(customer: any, connection: any) {
  return {
    tenant_id: connection.tenant_id,
    shopify_customer_id: String(customer.id),
    email: customer.email ?? null,
    first_name: customer.first_name ?? null,
    last_name: customer.last_name ?? null,
    phone: customer.phone ?? null,
    total_spent: customer.total_spent
      ? Number.parseFloat(String(customer.total_spent))
      : null,
    orders_count: toInteger(customer.orders_count, 0),
    tags: splitShopifyTags(customer.tags),
    accepts_marketing: customer.accepts_marketing ?? false,
    default_address: customer.default_address ?? null,
    raw_data: customer,
    synced_at: new Date().toISOString(),
  };
}

function mapShopifyCustomerToCRM(customer: any, connection: any) {
  return {
    tenant_id: connection.tenant_id,
    email: customer.email,
    first_name: customer.first_name ?? null,
    last_name: customer.last_name ?? null,
    phone: customer.phone ?? null,
    pos_source: "shopify",
    total_spent: customer.total_spent
      ? Number.parseFloat(String(customer.total_spent))
      : null,
    lifetime_value: customer.total_spent
      ? Number.parseFloat(String(customer.total_spent))
      : null,
    tags: splitShopifyTags(customer.tags),
    updated_at: new Date().toISOString(),
  };
}

function mapShopifyOrder(order: any, connection: any) {
  return {
    tenant_id: connection.tenant_id,
    shopify_order_id: String(order.id),
    shopify_customer_id: order.customer?.id ? String(order.customer.id) : null,
    email: order.email ?? null,
    order_number:
      order.order_number != null ? String(order.order_number) : null,
    order_date: order.created_at ?? null,
    total_price: order.total_price
      ? Number.parseFloat(String(order.total_price))
      : null,
    subtotal_price: order.subtotal_price
      ? Number.parseFloat(String(order.subtotal_price))
      : null,
    total_tax: order.total_tax
      ? Number.parseFloat(String(order.total_tax))
      : null,
    currency: order.currency ?? null,
    financial_status: order.financial_status ?? null,
    fulfillment_status: order.fulfillment_status ?? null,
    line_items: order.line_items ?? [],
    shipping_address: order.shipping_address ?? null,
    discount_codes: order.discount_codes ?? [],
    tags: splitShopifyTags(order.tags),
    note: order.note ?? null,
    raw_data: order,
    synced_at: new Date().toISOString(),
  };
}

function mapShopifyProduct(product: any, connection: any) {
  return {
    tenant_id: connection.tenant_id,
    shopify_product_id: String(product.id),
    title: product.title ?? null,
    vendor: product.vendor ?? null,
    product_type: product.product_type ?? null,
    status: product.status ?? null,
    tags: splitShopifyTags(product.tags),
    variants: product.variants ?? [],
    images: Array.isArray(product.images)
      ? product.images.map((image: any) => ({
          src: image?.src ?? null,
          alt: image?.alt ?? null,
        }))
      : [],
    inventory_quantity: Array.isArray(product.variants)
      ? product.variants.reduce(
          (sum: number, variant: any) =>
            sum + toInteger(variant?.inventory_quantity, 0),
          0,
        )
      : 0,
    raw_data: product,
    synced_at: new Date().toISOString(),
  };
}

function getShopifyConnectionUpdate(
  syncType: string,
  totalSynced: number,
  timestamp: string,
) {
  if (syncType === "customers") {
    return {
      last_customer_sync: timestamp,
      customers_synced: totalSynced,
      last_synced_at: timestamp,
    };
  }

  if (syncType === "orders") {
    return {
      last_sales_sync: timestamp,
      sales_synced: totalSynced,
      last_synced_at: timestamp,
    };
  }

  return {
    last_product_sync: timestamp,
    products_synced: totalSynced,
    last_synced_at: timestamp,
  };
}

const POS_PROVIDER_TABLE_MAP: Record<string, string> = {
  square: "square_connections",
  clover: "clover_connections",
  lightspeed: "lightspeed_connections",
  shopify: "shopify_connections",
};

async function resolveClaimedJobId(
  supabase: any,
  job: any,
  providerFilter: string | null,
) {
  if (!job?.tenant_id || !job?.sync_type) {
    return null;
  }

  const claimedProvider =
    typeof job.provider === "string" && job.provider.trim().length > 0
      ? job.provider.trim()
      : null;
  const effectiveProvider = providerFilter ?? claimedProvider;

  let request = supabase
    .from("pos_sync_jobs_v2")
    .select("id")
    .eq("tenant_id", job.tenant_id)
    .eq("sync_type", job.sync_type)
    .eq("status", "in_progress")
    .order("started_at", { ascending: false })
    .limit(2);

  if (effectiveProvider) {
    request = request.eq("provider", effectiveProvider);
  }

  const { data, error } = await request;

  if (error || !Array.isArray(data) || data.length === 0) {
    return null;
  }

  if (!effectiveProvider && data.length !== 1) {
    return null;
  }

  return normalizeJobId(data[0]?.id ?? null);
}

async function resolveClaimedJobProvider(
  supabase: any,
  job: any,
  providerFilter: string | null,
) {
  if (providerFilter) {
    const providerTable = POS_PROVIDER_TABLE_MAP[providerFilter];
    if (providerTable) {
      const { data, error } = await supabase
        .from(providerTable)
        .select("id")
        .eq("tenant_id", job.tenant_id)
        .eq("status", "connected")
        .limit(1);

      if (!error && Array.isArray(data) && data.length > 0) {
        return providerFilter;
      }
    }
  }

  const matchingProviders = await Promise.all(
    Object.entries(POS_PROVIDER_TABLE_MAP).map(async ([provider, table]) => {
      const { data, error } = await supabase
        .from(table)
        .select("id")
        .eq("tenant_id", job.tenant_id)
        .eq("status", "connected")
        .limit(1);

      if (error || !Array.isArray(data) || data.length === 0) {
        return null;
      }

      return provider;
    }),
  );

  const resolvedProviders = matchingProviders.filter(
    (provider): provider is string => Boolean(provider),
  );

  return resolvedProviders.length === 1 ? resolvedProviders[0] : null;
}

// Get connection based on provider
async function getConnection(
  supabase: any,
  tenantId: string,
  provider: string,
) {
  const table = POS_PROVIDER_TABLE_MAP[provider];
  if (!table) throw new Error(`Unknown provider: ${provider}`);

  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("status", "connected")
    .single();

  if (error || !data) throw new Error(`No active ${provider} connection`);
  return data;
}

async function syncShopifyCustomers(
  supabase: any,
  connection: any,
  job: any,
  accessToken: string,
): Promise<SyncResult> {
  const currentPage = toFiniteNumber(job.current_page, 0);
  const currentCursor =
    typeof job.current_cursor === "string" && job.current_cursor.length > 0
      ? job.current_cursor
      : null;
  const totalPagesEst =
    toFiniteNumber(job.total_pages_est, 0) ||
    Math.max(
      1,
      Math.ceil(toFiniteNumber(job.estimated_rows, 0) / SHOPIFY_PAGE_SIZE),
    );

  await writeJobProgress(supabase, job.id, {
    status: "in_progress",
    started_at: job.started_at ?? new Date().toISOString(),
    current_page: currentPage,
    current_cursor: currentCursor ?? "",
    total_pages_est: totalPagesEst,
    fetched_rows: toFiniteNumber(job.fetched_rows, 0),
    inserted_rows: toFiniteNumber(job.inserted_rows, 0),
    progress_message: `Fetching customers - page ${currentPage + 1} · ${toFiniteNumber(job.fetched_rows, 0).toLocaleString()} retrieved`,
  });

  const url = new URL(
    `https://${connection.shop_domain}/admin/api/2024-01/customers.json`,
  );
  url.searchParams.set("limit", String(SHOPIFY_PAGE_SIZE));
  url.searchParams.set(
    "fields",
    "id,email,first_name,last_name,phone,tags,total_spent,orders_count,accepts_marketing,created_at,updated_at,default_address",
  );
  if (currentCursor) {
    url.searchParams.set("page_info", currentCursor);
  }

  const response = await fetch(url.toString(), {
    headers: { "X-Shopify-Access-Token": accessToken },
  });

  if (!response.ok) {
    return await handleApiError(
      supabase,
      job,
      response,
      "customers",
      currentPage,
      totalPagesEst,
      {
        providerLabel: "Shopify",
        currentCursor: currentCursor ?? "",
      },
    );
  }

  const payload = await response.json();
  const customers = Array.isArray(payload.customers) ? payload.customers : [];
  const fetchedRows = customers.length;
  let insertedRows = 0;
  let failedRows = 0;

  if (customers.length > 0) {
    const shopifyRows = customers.map((customer: any) =>
      mapShopifyCustomer(customer, connection),
    );
    const { error: providerError } = await supabase
      .from("shopify_customers")
      .upsert(shopifyRows, { onConflict: "tenant_id,shopify_customer_id" });

    if (providerError) {
      throw new Error(
        `Failed to upsert Shopify customers: ${providerError.message}`,
      );
    }

    const crmRows = customers
      .filter(
        (customer: any) =>
          typeof customer.email === "string" && customer.email.length > 0,
      )
      .map((customer: any) => mapShopifyCustomerToCRM(customer, connection));

    if (crmRows.length > 0) {
      const { error: crmError } = await supabase
        .from("crm_customers")
        .upsert(crmRows, { onConflict: "tenant_id,email" });

      if (crmError) {
        throw new Error(
          `Failed to upsert Shopify CRM customers: ${crmError.message}`,
        );
      }
    }

    insertedRows = customers.length;
  }

  const skippedRows = Math.max(0, fetchedRows - insertedRows - failedRows);
  const nextCursor = extractNextPageInfo(response.headers.get("Link"));
  const nextPage = currentPage + 1;
  const totalFetched = toFiniteNumber(job.fetched_rows, 0) + fetchedRows;
  const totalInserted = toFiniteNumber(job.inserted_rows, 0) + insertedRows;
  const totalSkipped = toFiniteNumber(job.skipped_rows, 0) + skippedRows;
  const totalFailed = toFiniteNumber(job.failed_rows, 0) + failedRows;
  const isComplete = !nextCursor || customers.length < SHOPIFY_PAGE_SIZE;

  await writeJobProgress(supabase, job.id, {
    status: isComplete ? "completed" : "in_progress",
    current_page: nextPage,
    current_cursor: nextCursor ?? "",
    total_pages_est: totalPagesEst,
    fetched_rows: totalFetched,
    inserted_rows: totalInserted,
    skipped_rows: totalSkipped,
    failed_rows: totalFailed,
    progress_message: isComplete
      ? `Complete - ${totalInserted.toLocaleString()} customers imported`
      : `Fetched customers - page ${currentPage + 1} complete · ${totalFetched.toLocaleString()} retrieved`,
  });

  return {
    customers: insertedRows,
    orders: 0,
    products: 0,
    rows: fetchedRows,
    cursor: isComplete ? null : nextCursor,
    currentPage: nextPage,
    totalPagesEst,
    fetchedRows,
    insertedRows,
    skippedRows,
    failedRows,
    progressMessage: isComplete
      ? `Complete - ${totalInserted.toLocaleString()} customers imported`
      : `Queued customers page ${nextPage + 1}`,
  };
}

async function syncShopifyOrders(
  supabase: any,
  connection: any,
  job: any,
  accessToken: string,
): Promise<SyncResult> {
  const currentPage = toFiniteNumber(job.current_page, 0);
  const currentCursor =
    typeof job.current_cursor === "string" && job.current_cursor.length > 0
      ? job.current_cursor
      : null;
  const totalPagesEst =
    toFiniteNumber(job.total_pages_est, 0) ||
    Math.max(
      1,
      Math.ceil(toFiniteNumber(job.estimated_rows, 0) / SHOPIFY_PAGE_SIZE),
    );
  const sinceDate = connection.last_sales_sync
    ? new Date(connection.last_sales_sync).toISOString()
    : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  await writeJobProgress(supabase, job.id, {
    status: "in_progress",
    started_at: job.started_at ?? new Date().toISOString(),
    current_page: currentPage,
    current_cursor: currentCursor ?? "",
    total_pages_est: totalPagesEst,
    fetched_rows: toFiniteNumber(job.fetched_rows, 0),
    inserted_rows: toFiniteNumber(job.inserted_rows, 0),
    progress_message: `Fetching orders - page ${currentPage + 1} · ${toFiniteNumber(job.fetched_rows, 0).toLocaleString()} retrieved`,
  });

  const url = new URL(
    `https://${connection.shop_domain}/admin/api/2024-01/orders.json`,
  );
  url.searchParams.set("limit", String(SHOPIFY_PAGE_SIZE));
  url.searchParams.set("status", "any");
  url.searchParams.set("created_at_min", sinceDate);
  url.searchParams.set(
    "fields",
    "id,email,order_number,created_at,total_price,subtotal_price,total_tax,currency,financial_status,fulfillment_status,line_items,customer,shipping_address,discount_codes,tags,note,refunds",
  );
  if (currentCursor) {
    url.searchParams.set("page_info", currentCursor);
  }

  const response = await fetch(url.toString(), {
    headers: { "X-Shopify-Access-Token": accessToken },
  });

  if (!response.ok) {
    return await handleApiError(
      supabase,
      job,
      response,
      "orders",
      currentPage,
      totalPagesEst,
      {
        providerLabel: "Shopify",
        currentCursor: currentCursor ?? "",
      },
    );
  }

  const payload = await response.json();
  const orders = Array.isArray(payload.orders) ? payload.orders : [];
  const fetchedRows = orders.length;
  let insertedRows = 0;
  let failedRows = 0;

  if (orders.length > 0) {
    const rows = orders.map((order: any) => mapShopifyOrder(order, connection));
    const { error: upsertError } = await supabase
      .from("shopify_orders")
      .upsert(rows, { onConflict: "tenant_id,shopify_order_id" });

    if (upsertError) {
      throw new Error(
        `Failed to upsert Shopify orders: ${upsertError.message}`,
      );
    }

    insertedRows = orders.length;
  }

  const skippedRows = Math.max(0, fetchedRows - insertedRows - failedRows);
  const nextCursor = extractNextPageInfo(response.headers.get("Link"));
  const nextPage = currentPage + 1;
  const totalFetched = toFiniteNumber(job.fetched_rows, 0) + fetchedRows;
  const totalInserted = toFiniteNumber(job.inserted_rows, 0) + insertedRows;
  const totalSkipped = toFiniteNumber(job.skipped_rows, 0) + skippedRows;
  const totalFailed = toFiniteNumber(job.failed_rows, 0) + failedRows;
  const isComplete = !nextCursor || orders.length < SHOPIFY_PAGE_SIZE;

  await writeJobProgress(supabase, job.id, {
    status: isComplete ? "completed" : "in_progress",
    current_page: nextPage,
    current_cursor: nextCursor ?? "",
    total_pages_est: totalPagesEst,
    fetched_rows: totalFetched,
    inserted_rows: totalInserted,
    skipped_rows: totalSkipped,
    failed_rows: totalFailed,
    progress_message: isComplete
      ? `Complete - ${totalInserted.toLocaleString()} orders imported`
      : `Fetched orders - page ${currentPage + 1} complete · ${totalFetched.toLocaleString()} retrieved`,
  });

  return {
    customers: 0,
    orders: insertedRows,
    products: 0,
    rows: fetchedRows,
    cursor: isComplete ? null : nextCursor,
    currentPage: nextPage,
    totalPagesEst,
    fetchedRows,
    insertedRows,
    skippedRows,
    failedRows,
    progressMessage: isComplete
      ? `Complete - ${totalInserted.toLocaleString()} orders imported`
      : `Queued orders page ${nextPage + 1}`,
  };
}

async function syncShopifyProducts(
  supabase: any,
  connection: any,
  job: any,
  accessToken: string,
): Promise<SyncResult> {
  const currentPage = toFiniteNumber(job.current_page, 0);
  const currentCursor =
    typeof job.current_cursor === "string" && job.current_cursor.length > 0
      ? job.current_cursor
      : null;
  const totalPagesEst =
    toFiniteNumber(job.total_pages_est, 0) ||
    Math.max(
      1,
      Math.ceil(toFiniteNumber(job.estimated_rows, 0) / SHOPIFY_PAGE_SIZE),
    );

  await writeJobProgress(supabase, job.id, {
    status: "in_progress",
    started_at: job.started_at ?? new Date().toISOString(),
    current_page: currentPage,
    current_cursor: currentCursor ?? "",
    total_pages_est: totalPagesEst,
    fetched_rows: toFiniteNumber(job.fetched_rows, 0),
    inserted_rows: toFiniteNumber(job.inserted_rows, 0),
    progress_message: `Fetching products - page ${currentPage + 1} · ${toFiniteNumber(job.fetched_rows, 0).toLocaleString()} retrieved`,
  });

  const url = new URL(
    `https://${connection.shop_domain}/admin/api/2024-01/products.json`,
  );
  url.searchParams.set("limit", String(SHOPIFY_PAGE_SIZE));
  url.searchParams.set(
    "fields",
    "id,title,vendor,product_type,status,tags,variants,images,created_at,updated_at",
  );
  if (currentCursor) {
    url.searchParams.set("page_info", currentCursor);
  }

  const response = await fetch(url.toString(), {
    headers: { "X-Shopify-Access-Token": accessToken },
  });

  if (!response.ok) {
    return await handleApiError(
      supabase,
      job,
      response,
      "products",
      currentPage,
      totalPagesEst,
      {
        providerLabel: "Shopify",
        currentCursor: currentCursor ?? "",
      },
    );
  }

  const payload = await response.json();
  const products = Array.isArray(payload.products) ? payload.products : [];
  const fetchedRows = products.length;
  let insertedRows = 0;
  let failedRows = 0;

  if (products.length > 0) {
    const rows = products.map((product: any) =>
      mapShopifyProduct(product, connection),
    );
    const { error: upsertError } = await supabase
      .from("shopify_products")
      .upsert(rows, { onConflict: "tenant_id,shopify_product_id" });

    if (upsertError) {
      throw new Error(
        `Failed to upsert Shopify products: ${upsertError.message}`,
      );
    }

    insertedRows = products.length;
  }

  const skippedRows = Math.max(0, fetchedRows - insertedRows - failedRows);
  const nextCursor = extractNextPageInfo(response.headers.get("Link"));
  const nextPage = currentPage + 1;
  const totalFetched = toFiniteNumber(job.fetched_rows, 0) + fetchedRows;
  const totalInserted = toFiniteNumber(job.inserted_rows, 0) + insertedRows;
  const totalSkipped = toFiniteNumber(job.skipped_rows, 0) + skippedRows;
  const totalFailed = toFiniteNumber(job.failed_rows, 0) + failedRows;
  const isComplete = !nextCursor || products.length < SHOPIFY_PAGE_SIZE;

  await writeJobProgress(supabase, job.id, {
    status: isComplete ? "completed" : "in_progress",
    current_page: nextPage,
    current_cursor: nextCursor ?? "",
    total_pages_est: totalPagesEst,
    fetched_rows: totalFetched,
    inserted_rows: totalInserted,
    skipped_rows: totalSkipped,
    failed_rows: totalFailed,
    progress_message: isComplete
      ? `Complete - ${totalInserted.toLocaleString()} products imported`
      : `Fetched products - page ${currentPage + 1} complete · ${totalFetched.toLocaleString()} retrieved`,
  });

  return {
    customers: 0,
    orders: 0,
    products: insertedRows,
    rows: fetchedRows,
    cursor: isComplete ? null : nextCursor,
    currentPage: nextPage,
    totalPagesEst,
    fetchedRows,
    insertedRows,
    skippedRows,
    failedRows,
    progressMessage: isComplete
      ? `Complete - ${totalInserted.toLocaleString()} products imported`
      : `Queued products page ${nextPage + 1}`,
  };
}

async function syncShopify(
  supabase: any,
  connection: any,
  syncType: string,
  cursor: string | null,
  isDelta: boolean,
  job: any,
): Promise<SyncResult> {
  const accessToken = await decryptToken(connection.encrypted_access_token);

  const updateConnectionStats = async (syncedCount: number) => {
    const totalSynced =
      syncType === "customers"
        ? toFiniteNumber(job.customers_synced, 0) + syncedCount
        : syncType === "orders"
          ? toFiniteNumber(job.orders_synced, 0) + syncedCount
          : toFiniteNumber(job.products_synced, 0) + syncedCount;

    const { error } = await supabase
      .from("shopify_connections")
      .update(
        getShopifyConnectionUpdate(
          syncType,
          totalSynced,
          new Date().toISOString(),
        ),
      )
      .eq("id", connection.id);

    if (error) {
      console.error(
        "[POS-SYNC-WORKER] Failed to update Shopify connection stats:",
        error.message,
      );
    }
  };

  if (syncType === "customers" || syncType === "full") {
    const result = await syncShopifyCustomers(
      supabase,
      connection,
      job,
      accessToken,
    );
    if (!result.terminalStatus) {
      await updateConnectionStats(result.customers);
    }
    return result;
  }

  if (syncType === "orders") {
    const result = await syncShopifyOrders(
      supabase,
      connection,
      job,
      accessToken,
    );
    if (!result.terminalStatus) {
      await updateConnectionStats(result.orders);
    }
    return result;
  }

  if (syncType === "products") {
    const result = await syncShopifyProducts(
      supabase,
      connection,
      job,
      accessToken,
    );
    if (!result.terminalStatus) {
      await updateConnectionStats(result.products);
    }
    return result;
  }

  throw new Error(`Unsupported Shopify sync type: ${syncType}`);
}

// Square sync implementation
async function syncSquare(
  supabase: any,
  connection: any,
  syncType: string,
  cursor: string | null,
  isDelta: boolean,
): Promise<SyncResult> {
  const accessToken = await decryptToken(connection.encrypted_access_token);
  const baseUrl =
    connection.environment === "sandbox"
      ? "https://connect.squareupsandbox.com/v2"
      : "https://connect.squareup.com/v2";

  const result: SyncResult = {
    customers: 0,
    orders: 0,
    products: 0,
    rows: 0,
    cursor: null,
  };

  if (syncType === "customers" || syncType === "full") {
    const url = new URL(`${baseUrl}/customers`);
    url.searchParams.set("limit", "100");
    if (cursor) url.searchParams.set("cursor", cursor);

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Square-Version": "2024-01-18",
      },
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.errors?.[0]?.detail || "Square API error");
    }

    const data = await response.json();
    const customers = data.customers || [];
    result.cursor = data.cursor || null;
    result.rows = customers.length;

    // Batch upsert with deduplication
    if (customers.length > 0) {
      const deduped = new Map();
      for (const c of customers) {
        const email = (
          c.email_address || `square-${c.id}@noemail.local`
        ).toLowerCase();
        deduped.set(email, c);
      }

      const records = Array.from(deduped.values()).map((c) => ({
        tenant_id: connection.tenant_id,
        email: (
          c.email_address || `square-${c.id}@noemail.local`
        ).toLowerCase(),
        first_name: c.given_name || null,
        last_name: c.family_name || null,
        phone: c.phone_number || null,
        pos_source: "square",
        square_customer_id: c.id,
        square_last_synced_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from("crm_customers")
        .upsert(records, { onConflict: "tenant_id,email" });

      if (!error) result.customers = records.length;
    }
  }

  // Loyalty sync
  if (syncType === "loyalty") {
    console.log("[SQUARE-SYNC] Starting loyalty accounts sync...");

    const response = await fetch(`${baseUrl}/loyalty/accounts/search`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Square-Version": "2024-01-18",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        limit: 100,
        cursor: cursor || undefined,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.errors?.[0]?.detail || "Square Loyalty API error");
    }

    const data = await response.json();
    const loyaltyAccounts = data.loyalty_accounts || [];
    result.cursor = data.cursor || null;
    result.rows = loyaltyAccounts.length;

    console.log(
      `[SQUARE-SYNC] Found ${loyaltyAccounts.length} loyalty accounts`,
    );

    // Process each loyalty account
    for (const account of loyaltyAccounts) {
      // 1. Find the customer by square_customer_id
      const { data: customer } = await supabase
        .from("crm_customers")
        .select("id, tags")
        .eq("tenant_id", connection.tenant_id)
        .eq("square_customer_id", account.customer_id)
        .single();

      if (customer) {
        // 2. Add "Loyalty Member" tag if not present
        const existingTags = customer.tags || [];
        if (!existingTags.includes("Loyalty Member")) {
          await supabase
            .from("crm_customers")
            .update({
              tags: [...existingTags, "Loyalty Member"],
              updated_at: new Date().toISOString(),
            })
            .eq("id", customer.id);
        }

        // 3. Upsert loyalty metrics
        await supabase.from("customer_loyalty_metrics").upsert(
          {
            tenant_id: connection.tenant_id,
            customer_id: customer.id,
            program_name: "Square Loyalty",
            points_balance: account.balance || 0,
            lifetime_points: account.lifetime_points || 0,
            enrolled_at: account.enrolled_at,
            external_loyalty_id: account.id,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "external_loyalty_id" },
        );

        result.customers++;
      }
    }

    console.log(`[SQUARE-SYNC] Processed ${result.customers} loyalty accounts`);
  }

  return result;
}

// Clover sync implementation
async function syncClover(
  supabase: any,
  connection: any,
  syncType: string,
  cursor: string | null,
  isDelta: boolean,
): Promise<SyncResult> {
  const accessToken = await decryptToken(connection.encrypted_access_token);
  const baseUrl =
    connection.environment === "sandbox"
      ? "https://apisandbox.dev.clover.com"
      : connection.region === "eu"
        ? "https://api.eu.clover.com"
        : connection.region === "la"
          ? "https://api.la.clover.com"
          : "https://api.clover.com";

  const result: SyncResult = {
    customers: 0,
    orders: 0,
    products: 0,
    rows: 0,
    cursor: null,
  };
  const offset = cursor ? parseInt(cursor) : 0;

  if (syncType === "customers" || syncType === "full") {
    const url = `${baseUrl}/v3/merchants/${connection.merchant_id}/customers?expand=emailAddresses,phoneNumbers&limit=100&offset=${offset}`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || "Clover API error");
    }

    const data = await response.json();
    const customers = data.elements || [];
    result.rows = customers.length;
    result.cursor = customers.length >= 100 ? String(offset + 100) : null;

    if (customers.length > 0) {
      const deduped = new Map();
      for (const c of customers) {
        const email = c.emailAddresses?.elements?.[0]?.emailAddress;
        if (email) deduped.set(email.toLowerCase(), c);
      }

      const records = Array.from(deduped.values()).map((c) => ({
        tenant_id: connection.tenant_id,
        email: c.emailAddresses.elements[0].emailAddress.toLowerCase(),
        first_name: c.firstName || null,
        last_name: c.lastName || null,
        phone: c.phoneNumbers?.elements?.[0]?.phoneNumber || null,
        pos_source: "clover",
        clover_customer_id: c.id,
        clover_last_synced_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from("crm_customers")
        .upsert(records, { onConflict: "tenant_id,email" });

      if (!error) result.customers = records.length;
    }
  }

  return result;
}

// Lightspeed sync implementation
async function syncLightspeed(
  supabase: any,
  connection: any,
  syncType: string,
  cursor: string | null,
  isDelta: boolean,
  job: any,
): Promise<SyncResult> {
  const normalizedSyncType = normalizeLightspeedSyncType(syncType);
  const { accessToken, ensureTokenReEncrypted } = await decryptTokenSafe(
    supabase,
    connection,
  );

  const updateConnectionStats = async (
    syncedCount: number,
    connectionCursor: string | null | undefined,
  ) => {
    const totalSynced =
      normalizedSyncType === "customers"
        ? toFiniteNumber(job.customers_synced, 0) + syncedCount
        : normalizedSyncType === "sales"
          ? toFiniteNumber(job.orders_synced, 0) + syncedCount
          : toFiniteNumber(job.products_synced, 0) + syncedCount;

    const { error } = await supabase
      .from("lightspeed_connections")
      .update(
        getLightspeedConnectionUpdate(
          syncType,
          totalSynced,
          new Date().toISOString(),
          connectionCursor ?? null,
        ),
      )
      .eq("id", connection.id);

    if (error) {
      console.error(
        "[POS-SYNC-WORKER] Failed to update Lightspeed connection stats:",
        error.message,
      );
    }
  };

  if (normalizedSyncType === "customers" || normalizedSyncType === "full") {
    const result = await syncLightspeedCustomers(
      supabase,
      connection,
      job,
      accessToken,
      ensureTokenReEncrypted,
    );
    if (!result.terminalStatus) {
      await updateConnectionStats(
        result.customers,
        result.connectionCursor ?? result.cursor,
      );
    }
    return result;
  }

  if (normalizedSyncType === "sales") {
    const result = await syncLightspeedSales(
      supabase,
      connection,
      job,
      accessToken,
      ensureTokenReEncrypted,
    );
    if (!result.terminalStatus) {
      await updateConnectionStats(
        result.orders,
        result.connectionCursor ?? result.cursor,
      );
    }
    return result;
  }

  if (normalizedSyncType === "products") {
    const result = await syncLightspeedProducts(
      supabase,
      connection,
      job,
      accessToken,
      ensureTokenReEncrypted,
    );
    if (!result.terminalStatus) {
      await updateConnectionStats(
        result.products,
        result.connectionCursor ?? result.cursor,
      );
    }
    return result;
  }

  throw new Error(`Unsupported Lightspeed sync type: ${syncType}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  let job: any = null;
  let circuitState: CircuitBreakerState = {
    consecutiveFailures: 0,
    lastFailureAt: null,
    circuitOpenUntil: null,
  };

  try {
    // Parse optional provider filter from request
    let providerFilter: string | null = null;
    try {
      const body = await req.json();
      providerFilter = body.provider || null;
    } catch {
      /* no body */
    }

    console.log(
      `[POS-SYNC-WORKER] Starting, provider filter: ${providerFilter || "all"}`,
    );

    // Claim next job using the enum-typed function
    const { data: jobs, error: claimError } = await supabase.rpc(
      "claim_next_pos_sync_job",
      { p_provider: providerFilter },
    );

    // Handle the SETOF return - it returns an array
    job = Array.isArray(jobs) ? jobs[0] : jobs;

    if (claimError) {
      console.error("[POS-SYNC-WORKER] Claim error:", claimError.message);
      return new Response(
        JSON.stringify({ success: false, error: claimError.message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!job) {
      // Could be queue empty OR global concurrency limit reached
      // Check which case for better logging
      const { data: queueStatus } = await supabase.rpc("get_sync_queue_status");
      const isLimitReached = queueStatus?.queue_full === true;
      const reason = isLimitReached ? "global_limit_reached" : "queue_empty";

      console.log(
        `[POS-SYNC-WORKER] No jobs available (${reason}). Status: ${JSON.stringify(queueStatus)}`,
      );

      // If global limit reached and there are pending jobs, schedule a retry
      if (
        isLimitReached &&
        (queueStatus?.pending > 0 || queueStatus?.delayed > 0)
      ) {
        console.log(
          "[POS-SYNC-WORKER] Global limit reached with pending jobs, will retry in 10s",
        );

        EdgeRuntime.waitUntil(
          (async () => {
            await new Promise((resolve) => setTimeout(resolve, 10000)); // 10 second delay
            console.log("[POS-SYNC-WORKER] Retrying after global limit delay");
            await supabase.functions.invoke("pos-sync-worker", {
              body: { provider: providerFilter },
            });
          })(),
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "No jobs available",
          reason,
          queueStatus: queueStatus || null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const normalizedClaimedJobId = normalizeJobId(job.id);
    if (!normalizedClaimedJobId) {
      const recoveredJobId = await resolveClaimedJobId(
        supabase,
        job,
        providerFilter,
      );

      if (!recoveredJobId) {
        console.warn(
          "[POS-SYNC-WORKER] Claimed job without a recoverable id; skipping processing",
          {
            tenant_id: job?.tenant_id ?? null,
            provider: job?.provider ?? providerFilter ?? null,
            sync_type: job?.sync_type ?? null,
            raw_id: job?.id ?? null,
          },
        );

        return new Response(
          JSON.stringify({
            success: false,
            reason: "missing_job_id",
            error:
              "Claimed sync job does not include a valid id and could not be recovered.",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      job.id = recoveredJobId;
      console.warn(
        `[POS-SYNC-WORKER] Recovered missing job id ${recoveredJobId} for claimed ${job.provider ?? providerFilter ?? "unknown"} ${job.sync_type ?? "unknown"} job`,
      );
    } else {
      job.id = normalizedClaimedJobId;
    }

    if (!job.provider) {
      console.warn(
        `[POS-SYNC-WORKER] Claimed job ${job.id} without provider; attempting recovery`,
      );

      const resolvedProvider = await resolveClaimedJobProvider(
        supabase,
        job,
        providerFilter,
      );

      if (!resolvedProvider) {
        const message =
          "Claimed sync job has no provider and no matching active POS connection could be resolved.";

        await supabase.rpc("fail_pos_sync_job", {
          p_job_id: job.id,
          p_error: message,
        });
        await writeJobProgress(supabase, job.id, {
          status: "failed",
          last_error: message,
          progress_message: message,
          updated_at: new Date().toISOString(),
        });

        return new Response(
          JSON.stringify({
            success: false,
            reason: "missing_provider",
            jobId: job.id,
            error: message,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const { error: repairError } = await supabase
        .from("pos_sync_jobs_v2")
        .update({
          provider: resolvedProvider,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      if (repairError) {
        console.error(
          `[POS-SYNC-WORKER] Failed to persist recovered provider for job ${job.id}:`,
          repairError.message,
        );
      }

      job.provider = resolvedProvider;
      console.log(
        `[POS-SYNC-WORKER] Recovered provider ${resolvedProvider} for job ${job.id}`,
      );
    }

    console.log(
      `[POS-SYNC-WORKER] Processing job ${job.id}: ${job.provider} ${job.sync_type}`,
    );

    // Check circuit breaker status for this tenant+provider
    circuitState = {
      consecutiveFailures: job.consecutive_failures || 0,
      lastFailureAt: job.last_failure_at || null,
      circuitOpenUntil: job.circuit_open_until || null,
    };

    const circuitStatus = checkCircuitBreaker(circuitState);
    if (circuitStatus.isOpen) {
      console.log(
        `[POS-SYNC-WORKER] Circuit breaker OPEN for job ${job.id}, reopens at ${circuitStatus.reopenAt}`,
      );
      // Mark job as delayed instead of failed
      await supabase
        .from("pos_sync_jobs_v2")
        .update({
          status: "delayed",
          last_error: `Circuit breaker open until ${circuitStatus.reopenAt?.toISOString()}`,
          progress_message: `Waiting for retry window after repeated failures`,
          last_progress_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      return new Response(
        JSON.stringify({
          success: false,
          reason: "circuit_breaker_open",
          reopenAt: circuitStatus.reopenAt,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Get connection for this provider
    const connection = await getConnection(
      supabase,
      job.tenant_id,
      job.provider,
    );

    // Execute sync based on provider
    let result: SyncResult;
    const cursor = job.current_cursor || job.last_sync_cursor;

    switch (job.provider) {
      case "square":
        result = await syncSquare(
          supabase,
          connection,
          job.sync_type,
          cursor,
          job.is_delta,
        );
        break;
      case "clover":
        result = await syncClover(
          supabase,
          connection,
          job.sync_type,
          cursor,
          job.is_delta,
        );
        break;
      case "lightspeed":
        result = await syncLightspeed(
          supabase,
          connection,
          job.sync_type,
          cursor,
          job.is_delta,
          job,
        );
        break;
      case "shopify":
        result = await syncShopify(
          supabase,
          connection,
          job.sync_type,
          cursor,
          job.is_delta,
          job,
        );
        break;
      default:
        throw new Error(`Unknown provider: ${job.provider}`);
    }

    console.log(`[POS-SYNC-WORKER] Sync result:`, result);

    if (
      result.terminalStatus === "failed" ||
      result.terminalStatus === "delayed"
    ) {
      queueFollowUpWorkerRun(supabase, job.provider);

      return new Response(
        JSON.stringify({
          success: false,
          jobId: job.id,
          provider: job.provider,
          syncType: job.sync_type,
          result,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const progressTotals = buildProgressTotals(job, result);
    const nextProgressMessage =
      result.progressMessage ??
      `${getSyncDisplayLabel(job.provider, job.sync_type)} sync page ${(result.currentPage ?? getLightspeedResumePage(job, cursor)) + 1} processed`;

    // If there's more data, update cursor and re-queue; otherwise complete
    if (result.cursor) {
      // Update job with progress and new cursor
      await supabase
        .from("pos_sync_jobs_v2")
        .update({
          current_cursor: result.cursor,
          customers_synced: job.customers_synced + result.customers,
          orders_synced: job.orders_synced + result.orders,
          products_synced: job.products_synced + result.products,
          processed_rows: job.processed_rows + result.rows,
          current_batch: job.current_batch + 1,
          current_page:
            result.currentPage ?? getLightspeedResumePage(job, result.cursor),
          total_pages_est: result.totalPagesEst ?? job.total_pages_est ?? null,
          fetched_rows: progressTotals.fetchedRows,
          inserted_rows: progressTotals.insertedRows,
          skipped_rows: progressTotals.skippedRows,
          failed_rows: progressTotals.failedRows,
          progress_message: nextProgressMessage,
          provider_job_id: result.providerJobId ?? job.provider_job_id ?? null,
          last_progress_at: new Date().toISOString(),
          status: "pending", // Re-queue for next batch
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      console.log(
        `[POS-SYNC-WORKER] Job ${job.id} re-queued with cursor: ${result.cursor}`,
      );

      // Chain to process next batch with adaptive cooldown
      EdgeRuntime.waitUntil(
        (async () => {
          await applyAdaptiveCooldown(progressTotals.fetchedRows);
          await supabase.functions.invoke("pos-sync-worker", {
            body: { provider: job.provider },
          });
        })(),
      );
    } else {
      // Complete the job and reset circuit breaker on success
      const { error: completeError } = await supabase.rpc(
        "complete_pos_sync_job",
        {
          p_job_id: job.id,
          p_cursor: result.cursor,
          p_customers: job.customers_synced + result.customers,
          p_orders: job.orders_synced + result.orders,
          p_products: job.products_synced + result.products,
          p_rows: job.processed_rows + result.rows,
        },
      );

      if (completeError) {
        console.error(
          "[POS-SYNC-WORKER] Complete error:",
          completeError.message,
        );
      } else {
        await supabase
          .from("pos_sync_jobs_v2")
          .update({
            current_cursor:
              job.provider === "shopify"
                ? null
                : (result.connectionCursor ?? result.cursor),
            current_page:
              result.currentPage ??
              job.current_page ??
              getLightspeedResumePage(job, cursor),
            total_pages_est:
              result.totalPagesEst ?? job.total_pages_est ?? null,
            fetched_rows: progressTotals.fetchedRows,
            inserted_rows: progressTotals.insertedRows,
            skipped_rows: progressTotals.skippedRows,
            failed_rows: progressTotals.failedRows,
            progress_message: `Completed ${getSyncDisplayLabel(job.provider, job.sync_type)} sync`,
            provider_job_id:
              result.providerJobId ?? job.provider_job_id ?? null,
            last_progress_at: new Date().toISOString(),
            last_error: null,
          })
          .eq("id", job.id);

        console.log(`[POS-SYNC-WORKER] Job ${job.id} completed successfully`);

        // Reset circuit breaker on success
        if (circuitStatus.shouldReset || circuitState.consecutiveFailures > 0) {
          await supabase
            .from("pos_sync_jobs_v2")
            .update({
              consecutive_failures: 0,
              circuit_open_until: null,
            })
            .eq("tenant_id", job.tenant_id)
            .eq("provider", job.provider);
          console.log(
            `[POS-SYNC-WORKER] Circuit breaker reset for ${job.tenant_id}:${job.provider}`,
          );
        }

        queueFollowUpWorkerRun(supabase, job.provider);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        jobId: job.id,
        provider: job.provider,
        syncType: job.sync_type,
        result,
        hasMore: !!result.cursor,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("[POS-SYNC-WORKER] Error:", error.message);

    // Update circuit breaker on failure
    try {
      // We need to get job info to update circuit breaker
      const body = await req
        .clone()
        .json()
        .catch(() => ({}));

      // Increment consecutive failures and potentially open circuit
      const newFailures = (circuitState?.consecutiveFailures || 0) + 1;
      const circuitOpenUntil = getNextCircuitOpenUntil(newFailures);

      if (job?.id) {
        await supabase.rpc("fail_pos_sync_job", {
          p_job_id: job.id,
          p_error: error.message,
        });

        await updateJobProgress(supabase, job.id, {
          status: "failed",
          last_error: error.message,
          progress_message: `Failed ${getSyncDisplayLabel(job.provider, job.sync_type)} sync`,
          failed_rows: toFiniteNumber(job.failed_rows, 0) + 1,
        });

        // Update circuit breaker state
        await supabase
          .from("pos_sync_jobs_v2")
          .update({
            consecutive_failures: newFailures,
            last_failure_at: new Date().toISOString(),
            circuit_open_until: circuitOpenUntil,
          })
          .eq("id", job.id);

        if (circuitOpenUntil) {
          console.log(
            `[POS-SYNC-WORKER] Circuit breaker OPENED for job ${job.id}, until ${circuitOpenUntil}`,
          );
        }
      } else {
        const fallbackJobId = normalizeJobId(body.job_id);
        if (!fallbackJobId) {
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }

        await supabase.rpc("fail_pos_sync_job", {
          p_job_id: fallbackJobId,
          p_error: error.message,
        });
      }
    } catch {
      /* ignore */
    }

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
