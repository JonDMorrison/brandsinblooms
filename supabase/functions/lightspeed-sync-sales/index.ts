import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
// FIX: [P5] - Decrypt access token before using as Bearer token
import { decryptToken, encryptToken } from "../_shared/crypto/tokens.ts";
import { getAdaptiveCooldown as getAdaptiveCooldownMs } from "../_shared/syncThrottling.ts";

console.log("[LS-SYNC-SALES] Edge function starting");

interface LightspeedXSeriesSale {
  id?: string | number | null;
  sale_id?: string | number | null;
  customer_id?: string | number | null;
  customer?: { id?: string | number | null } | null;
  completed_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  total_price?: string | number | null;
  total?: string | number | null;
  status?: string | null;
  note?: string | null;
  line_items?: unknown[] | null;
  payments?: unknown[] | null;
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

  return parseVersionCursor(connection?.last_sales_version_cursor);
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

function extractSaleId(sale: LightspeedXSeriesSale) {
  return toStringId(sale.id ?? sale.sale_id ?? (sale as any).saleID);
}

function extractCustomerId(sale: LightspeedXSeriesSale) {
  return toStringId(
    sale.customer_id ??
      sale.customer?.id ??
      (sale as any).customerID ??
      ((sale as any).Customer as { id?: string | number | null } | undefined)
        ?.id,
  );
}

function extractLineItems(sale: LightspeedXSeriesSale) {
  if (Array.isArray(sale.line_items)) {
    return sale.line_items;
  }

  if (Array.isArray((sale as any).lineItems)) {
    return (sale as any).lineItems;
  }

  if (Array.isArray((sale as any).SaleLines?.SaleLine)) {
    return (sale as any).SaleLines.SaleLine;
  }

  if ((sale as any).SaleLines?.SaleLine) {
    return [(sale as any).SaleLines.SaleLine];
  }

  return [];
}

function extractPayments(sale: LightspeedXSeriesSale) {
  if (Array.isArray(sale.payments)) {
    return sale.payments;
  }

  if (Array.isArray((sale as any).SalePayments?.SalePayment)) {
    return (sale as any).SalePayments.SalePayment;
  }

  if ((sale as any).SalePayments?.SalePayment) {
    return [(sale as any).SalePayments.SalePayment];
  }

  return [];
}

function extractPaymentMethod(sale: LightspeedXSeriesSale) {
  const payment = extractPayments(sale)[0] as Record<string, any> | undefined;
  return (
    payment?.payment_type_name ??
    payment?.paymentType?.name ??
    payment?.PaymentType?.name ??
    null
  );
}

function normalizeSaleStatus(sale: LightspeedXSeriesSale) {
  const rawStatus = typeof sale.status === "string" ? sale.status.trim() : "";
  if (rawStatus.length > 0) {
    return rawStatus.toLowerCase();
  }

  const completedFlag = (sale as any).completed;
  if (
    completedFlag === true ||
    completedFlag === "true" ||
    completedFlag === "1" ||
    completedFlag === 1
  ) {
    return "completed";
  }

  return "open";
}

function isCompletedSale(status: string) {
  return ["completed", "closed", "paid"].includes(status.toLowerCase());
}

async function propagateSalesRollupToCrm(
  supabaseClient: any,
  tenantId: string,
  lightspeedCustomerId: string,
  purchaseCount: number,
  totalSpend: number,
  firstPurchaseDate: string | null,
  lastPurchaseDate: string | null,
) {
  const { data: updatedRows, error } = await supabaseClient
    .from("crm_customers")
    .update({
      updated_at: new Date().toISOString(),
      pos_source: "lightspeed",
      external_id: lightspeedCustomerId,
      pos_order_count: purchaseCount,
      total_spent: totalSpend,
      pos_total_spent: totalSpend,
      lifetime_value: totalSpend,
      first_purchase_date: firstPurchaseDate,
      last_purchase_date: lastPurchaseDate,
    })
    .eq("tenant_id", tenantId)
    .eq("pos_source", "lightspeed")
    .eq("external_id", lightspeedCustomerId)
    .select("id");

  if (error) {
    console.error(
      "[LS-SYNC-SALES] Failed to propagate CRM rollup:",
      error.message,
    );
    return;
  }

  if (!updatedRows || updatedRows.length === 0) {
    console.warn(
      `[LS-SYNC-SALES] No CRM customer linked to Lightspeed customer ${lightspeedCustomerId}; skipping CRM rollup propagation`,
    );
  }
}

function extractSaleDate(sale: LightspeedXSeriesSale) {
  return (
    sale.completed_at ??
    sale.created_at ??
    sale.updated_at ??
    (sale as any).completeTime ??
    (sale as any).createTime ??
    new Date().toISOString()
  );
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
      "[LS-SYNC-SALES] Failed to write queue progress:",
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[LS-SYNC-SALES] Processing sync request");

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

    // FIX: [P24] - Add sync lock to prevent concurrent syncs
    const { data: existingSalesLockJob } = await supabaseClient
      .from("pos_sync_jobs")
      .select("id, status")
      .eq("connection_id", connection.id)
      .eq("sync_type", "sales")
      .in("status", ["pending", "in_progress"])
      .maybeSingle();

    if (existingSalesLockJob) {
      console.log(
        "[LS-SYNC-SALES] Sync already in progress, returning existing job",
      );
      return new Response(
        JSON.stringify({
          success: true,
          jobId: existingSalesLockJob.id,
          message: "Sync already in progress",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // FIX: [P24] - Add sync lock to prevent concurrent syncs
    const { data: existingJob } = await supabaseClient
      .from("pos_sync_jobs")
      .select("id, status")
      .eq("connection_id", connection.id)
      .eq("sync_type", "sales")
      .in("status", ["pending", "in_progress"])
      .single();

    if (existingJob) {
      console.log(
        "[LS-SYNC-SALES] Sync already in progress, returning existing job",
      );
      return new Response(
        JSON.stringify({
          success: true,
          jobId: existingJob.id,
          message: "Sync already in progress",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log("[LS-SYNC-SALES] Fetching sales from Lightspeed...");
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
          "[LS-SYNC-SALES] Failed to load sync job state:",
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
    let firstPurchases = 0;

    while (true) {
      const salesUrl =
        afterVersion === 0
          ? `https://${connection.domain_prefix}.retail.lightspeed.app/api/2.0/sales`
          : `https://${connection.domain_prefix}.retail.lightspeed.app/api/2.0/sales?after=${afterVersion}`;

      await writeJobProgress(supabaseAdmin, jobId, {
        status: "in_progress",
        current_page: page,
        current_cursor: String(afterVersion),
        fetched_rows: totalFetched,
        inserted_rows: totalInserted,
        skipped_rows: totalSkipped,
        failed_rows: totalFailed,
        progress_message: `Fetching sales — page ${page + 1} · ${totalFetched.toLocaleString()} retrieved`,
      });

      const response = await fetch(salesUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          accept: "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[LS-SYNC-SALES] API error:", response.status, errorText);
        return new Response(
          JSON.stringify({
            error: `Lightspeed sales sync failed with HTTP ${response.status}`,
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
            "[LS-SYNC-SALES] Failed to re-encrypt access token:",
            reEncryptError,
          );
        } else {
          reEncrypted = true;
        }
      }

      const data = await response.json();
      const sales = Array.isArray(data?.data)
        ? (data.data as LightspeedXSeriesSale[])
        : [];

      if (sales.length === 0) {
        await writeJobProgress(supabaseAdmin, jobId, {
          status: "completed",
          current_page: page,
          current_cursor: String(afterVersion),
          fetched_rows: totalFetched,
          inserted_rows: totalInserted,
          skipped_rows: totalSkipped,
          failed_rows: totalFailed,
          progress_message: `Complete — ${totalInserted.toLocaleString()} sales imported`,
        });
        break;
      }

      totalFetched += sales.length;

      const pageCustomerIds = Array.from(
        new Set(
          sales
            .map((sale) => extractCustomerId(sale))
            .filter((customerId): customerId is string => Boolean(customerId)),
        ),
      );

      const contactIdByCustomerId = new Map<string, string | null>();
      if (pageCustomerIds.length > 0) {
        const { data: linkedCustomers, error: linkedCustomersError } =
          await supabaseClient
            .from("lightspeed_customers")
            .select("lightspeed_customer_id,contact_id")
            .eq("tenant_id", tenantId)
            .in("lightspeed_customer_id", pageCustomerIds);

        if (linkedCustomersError) {
          throw linkedCustomersError;
        }

        for (const customer of linkedCustomers || []) {
          contactIdByCustomerId.set(
            customer.lightspeed_customer_id,
            customer.contact_id ?? null,
          );
        }
      }

      let syncedCount = 0;
      let pageFailed = 0;
      const affectedCustomerIds = new Set<string>();

      for (const sale of sales) {
        const saleId = extractSaleId(sale);
        if (!saleId) {
          pageFailed += 1;
          continue;
        }

        const customerId = extractCustomerId(sale);
        const status = normalizeSaleStatus(sale);
        const contactId = customerId
          ? (contactIdByCustomerId.get(customerId) ?? null)
          : null;

        const { error: upsertError } = await supabaseClient
          .from("lightspeed_sales")
          .upsert(
            {
              tenant_id: tenantId,
              lightspeed_sale_id: saleId,
              lightspeed_customer_id: customerId,
              contact_id: contactId,
              sale_date: extractSaleDate(sale),
              total_amount:
                toNullableNumber(
                  sale.total_price ?? sale.total ?? (sale as any).calcTotal,
                ) ?? 0,
              status,
              line_items: extractLineItems(sale),
              payment_method: extractPaymentMethod(sale),
              note: sale.note ?? null,
              raw_data: sale,
              synced_at: new Date().toISOString(),
            },
            {
              onConflict: "tenant_id,lightspeed_sale_id",
            },
          );

        if (upsertError) {
          console.error("[LS-SYNC-SALES] Upsert error:", upsertError.message);
          pageFailed += 1;
          continue;
        }

        if (customerId && isCompletedSale(status)) {
          affectedCustomerIds.add(customerId);
        }

        syncedCount += 1;
      }

      for (const customerId of affectedCustomerIds) {
        const { data: customerSales, error: customerSalesError } =
          await supabaseClient
            .from("lightspeed_sales")
            .select("total_amount,sale_date,status")
            .eq("tenant_id", tenantId)
            .eq("lightspeed_customer_id", customerId)
            .in("status", ["completed", "closed", "paid"])
            .order("sale_date", { ascending: true });

        if (customerSalesError) {
          console.error(
            "[LS-SYNC-SALES] Failed to load customer sales:",
            customerSalesError.message,
          );
          continue;
        }

        if (!customerSales || customerSales.length === 0) {
          continue;
        }

        const totalSpend = customerSales.reduce(
          (sum: number, row: { total_amount: unknown }) =>
            sum + (toNullableNumber(row.total_amount) ?? 0),
          0,
        );
        const purchaseCount = customerSales.length;
        const firstPurchaseDate = customerSales[0]?.sale_date ?? null;
        const lastPurchaseDate =
          customerSales[customerSales.length - 1]?.sale_date ?? null;

        const { error: customerUpdateError } = await supabaseClient
          .from("lightspeed_customers")
          .update({
            total_spend: totalSpend,
            purchase_count: purchaseCount,
            first_purchase_date: firstPurchaseDate,
            last_purchase_date: lastPurchaseDate,
          })
          .eq("tenant_id", tenantId)
          .eq("lightspeed_customer_id", customerId);

        if (customerUpdateError) {
          console.error(
            "[LS-SYNC-SALES] Failed to update customer rollups:",
            customerUpdateError.message,
          );
          continue;
        }

        await propagateSalesRollupToCrm(
          supabaseClient,
          tenantId,
          customerId,
          purchaseCount,
          totalSpend,
          firstPurchaseDate,
          lastPurchaseDate,
        );

        if (purchaseCount === 1) {
          firstPurchases += 1;
        }
      }

      const pageSkipped = Math.max(0, sales.length - syncedCount - pageFailed);
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
          progress_message: `Complete — ${totalInserted.toLocaleString()} sales imported`,
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
        progress_message: `Fetched sales — page ${page} complete · ${totalFetched.toLocaleString()} retrieved`,
      });

      await sleep(getAdaptiveCooldownMs(totalFetched));
    }

    await supabaseClient
      .from("lightspeed_connections")
      .update({
        last_sales_sync: new Date().toISOString(),
        sales_synced: totalInserted,
        last_sales_version_cursor: String(finalVersionCursor),
      })
      .eq("tenant_id", tenantId);

    console.log(
      `[LS-SYNC-SALES] Sync complete: ${totalInserted} sales, ${firstPurchases} first purchases`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        salesSynced: totalInserted,
        firstPurchases,
        currentCursor: String(finalVersionCursor),
        message: `Synced ${totalInserted} sales`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("[LS-SYNC-SALES] Error:", error);
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
