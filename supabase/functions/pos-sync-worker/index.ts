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

async function updateJobProgress(
  supabase: any,
  jobId: string,
  updates: Record<string, unknown>,
) {
  const now = new Date().toISOString();
  const payload = {
    ...updates,
    updated_at: now,
    last_progress_at: updates.last_progress_at ?? now,
  };

  const { error } = await supabase
    .from("pos_sync_jobs_v2")
    .update(payload)
    .eq("id", jobId);

  if (error) {
    console.error(
      `[POS-SYNC-WORKER] Failed to update progress for job ${jobId}:`,
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
  return {
    tenant_id: connection.tenant_id,
    lightspeed_customer_id: String(customer.id ?? customer.customerID),
    contact_id: customer.contact_id ? String(customer.contact_id) : null,
    email:
      customer.email ??
      customer.Contact?.Emails?.ContactEmail?.[0]?.address ??
      null,
    phone:
      customer.phone ??
      customer.Contact?.Phones?.ContactPhone?.[0]?.number ??
      customer.Contact?.Phones?.Phone?.[0]?.number ??
      null,
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
    purchase_count: toInteger(
      customer.num_visits ?? customer.numVisits ?? customer.purchaseCount,
      0,
    ),
    total_spend:
      customer.total_spend !== undefined && customer.total_spend !== null
        ? Number.parseFloat(String(customer.total_spend))
        : customer.totalSpend !== undefined && customer.totalSpend !== null
          ? Number.parseFloat(String(customer.totalSpend))
          : null,
    first_purchase_date:
      customer.first_purchase_date ?? customer.firstVisit ?? null,
    last_purchase_date:
      customer.last_purchase_date ?? customer.lastVisit ?? null,
    raw_data: customer,
    synced_at: new Date().toISOString(),
  };
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
      typeof sale.status === "string" && sale.status.trim().length > 0
        ? sale.status.trim().toLowerCase()
        : parseLightspeedCompletedFlag(sale.completed)
          ? "completed"
          : "open",
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

function mapLightspeedProduct(product: any, connection: any) {
  const rawTags = Array.isArray(product.tags)
    ? product.tags
    : product.Tags?.tag
      ? (Array.isArray(product.Tags.tag)
          ? product.Tags.tag
          : [product.Tags.tag]
        ).map((tag: any) => tag?.name ?? tag)
      : [];

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
    price:
      product.retail_price !== undefined && product.retail_price !== null
        ? Number.parseFloat(String(product.retail_price))
        : product.price !== undefined && product.price !== null
          ? Number.parseFloat(String(product.price))
          : product.Prices?.ItemPrice?.[0]?.amount !== undefined &&
              product.Prices?.ItemPrice?.[0]?.amount !== null
            ? Number.parseFloat(String(product.Prices.ItemPrice[0].amount))
            : null,
    inventory_count:
      product.inventory_count !== undefined && product.inventory_count !== null
        ? Number.parseInt(String(product.inventory_count), 10)
        : product.available_inventory !== undefined &&
            product.available_inventory !== null
          ? Number.parseInt(String(product.available_inventory), 10)
          : product.ItemShops?.ItemShop?.[0]?.qoh !== undefined &&
              product.ItemShops?.ItemShop?.[0]?.qoh !== null
            ? Number.parseInt(String(product.ItemShops.ItemShop[0].qoh), 10)
            : 0,
    category:
      product.category_name ??
      product.category?.name ??
      product.Category?.name ??
      null,
    tags: rawTags,
    raw_data: product,
    synced_at: new Date().toISOString(),
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

      if (row.email || row.phone) {
        const filters = [];
        if (row.email) filters.push(`email.eq.${row.email}`);
        if (row.phone) filters.push(`phone.eq.${row.phone}`);

        const { data: existingContact, error: existingContactError } =
          filters.length > 0
            ? await supabase
                .from("crm_customers")
                .select("id")
                .eq("tenant_id", connection.tenant_id)
                .or(filters.join(","))
                .maybeSingle()
            : { data: null, error: null };

        if (existingContactError) {
          failedRows += 1;
          console.error(
            "[POS-SYNC-WORKER] Failed to look up CRM customer for Lightspeed customer:",
            existingContactError.message,
          );
          continue;
        }

        let contactId = existingContact?.id ?? row.contact_id ?? null;

        if (!contactId) {
          const { data: newContact, error: createError } = await supabase
            .from("crm_customers")
            .insert({
              tenant_id: connection.tenant_id,
              email: row.email,
              phone: row.phone,
              first_name: row.first_name,
              last_name: row.last_name,
              source: "lightspeed",
            })
            .select("id")
            .single();

          if (createError) {
            failedRows += 1;
            console.error(
              "[POS-SYNC-WORKER] Failed to create CRM customer for Lightspeed customer:",
              createError.message,
            );
            continue;
          }

          contactId = newContact?.id ?? null;
        }

        if (contactId) {
          const { error: linkError } = await supabase
            .from("lightspeed_customers")
            .update({ contact_id: contactId })
            .eq("tenant_id", connection.tenant_id)
            .eq("lightspeed_customer_id", row.lightspeed_customer_id);

          if (linkError) {
            failedRows += 1;
            console.error(
              "[POS-SYNC-WORKER] Failed to link Lightspeed customer to CRM customer:",
              linkError.message,
            );
            continue;
          }
        }
      }

      insertedRows += 1;
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
        mappedSale.status === "completed"
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
      .in("status", ["completed", "CLOSED"])
      .order("sale_date", { ascending: true });

    if (customerSalesError) {
      console.error(
        "[POS-SYNC-WORKER] Failed to load customer sales totals:",
        customerSalesError.message,
      );
      continue;
    }

    if (!customerSales || customerSales.length === 0) {
      continue;
    }

    const totalSpend = customerSales.reduce(
      (sum: number, customerSale: any) =>
        sum + Number.parseFloat(String(customerSale.total_amount ?? 0)),
      0,
    );

    const { error: updateCustomerError } = await supabase
      .from("lightspeed_customers")
      .update({
        total_spend: totalSpend,
        purchase_count: customerSales.length,
        first_purchase_date: customerSales[0]?.sale_date ?? null,
        last_purchase_date:
          customerSales[customerSales.length - 1]?.sale_date ?? null,
      })
      .eq("tenant_id", connection.tenant_id)
      .eq("lightspeed_customer_id", customerId);

    if (updateCustomerError) {
      console.error(
        "[POS-SYNC-WORKER] Failed to update Lightspeed customer aggregates:",
        updateCustomerError.message,
      );
    }
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

  let response = await fetch(
    currentCursor > 0
      ? `${getLightspeedSyncBaseUrl(connection, "2.0")}/products?after=${currentCursor}`
      : `${getLightspeedSyncBaseUrl(connection, "2.0")}/products`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (!response.ok && (response.status === 400 || response.status === 404)) {
    response = await fetch(
      currentCursor > 0
        ? `${getLightspeedSyncBaseUrl(connection, "3.0")}/products?since_version=${currentCursor}`
        : `${getLightspeedSyncBaseUrl(connection, "3.0")}/products`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
  }

  if (!response.ok) {
    return await handleApiError(
      supabase,
      job,
      response,
      "products",
      currentPage,
      totalPagesEst,
      { currentCursor: String(currentCursor) },
    );
  }

  await ensureTokenReEncrypted();

  const data = await response.json();
  const products = Array.isArray(data?.data) ? data.data : [];
  const fetchedRows = products.length;
  let insertedRows = 0;
  let failedRows = 0;

  for (const product of products) {
    try {
      const mappedProduct = mapLightspeedProduct(product, connection);
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
      ? `Complete — ${totalInserted.toLocaleString()} products imported`
      : `Fetched products — page ${currentPage + 1} complete · ${totalFetched.toLocaleString()} retrieved so far`,
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
      ? `Complete — ${totalInserted.toLocaleString()} products imported`
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

// Get connection based on provider
async function getConnection(
  supabase: any,
  tenantId: string,
  provider: string,
) {
  const tableMap: Record<string, string> = {
    square: "square_connections",
    clover: "clover_connections",
    lightspeed: "lightspeed_connections",
    shopify: "shopify_connections",
  };

  const table = tableMap[provider];
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
      } else if (body.job_id) {
        await supabase.rpc("fail_pos_sync_job", {
          p_job_id: body.job_id,
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
