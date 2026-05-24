import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
// FIX: [P14] - Use proper decryptToken
import { decryptToken, encryptToken } from "../_shared/crypto/tokens.ts";
import { recalculateLightspeedCustomerSpend } from "../_shared/lightspeed/recalculateCustomerSpend.ts";
import { upsertLightspeedCustomerProfile } from "../_shared/lightspeed/upsertCustomerProfile.ts";
import { getAdaptiveCooldown as getAdaptiveCooldownMs } from "../_shared/syncThrottling.ts";

console.log("[LS-SYNC-CUSTOMERS] Edge function starting");

interface LightspeedCustomer {
  id?: string | number | null;
  customerID?: string | number | null;
  contact_id?: string | number | null;
  firstName?: string;
  first_name?: string | null;
  lastName?: string;
  last_name?: string | null;
  email?: string;
  phone?: string | null;
  customer_code?: string | null;
  Contact?: {
    Phones?: {
      ContactPhone?: Array<{ number?: string }>;
      Phone?: Array<{ number?: string }>;
    };
  };
  CustomerType?: { customerTypeID?: string };
  creditAccountID?: string;
  loyaltyBalance?: string | number | null;
  loyalty_balance?: string | number | null;
  num_visits?: string | number | null;
  numVisits?: string | number | null;
  purchaseCount?: string | number | null;
  total_spend?: string | number | null;
  totalSpend?: string | number | null;
  first_purchase_date?: string | null;
  firstVisit?: string | null;
  last_purchase_date?: string | null;
  lastVisit?: string | null;
  customerTypeID?: string | null;
}

function normalizeEmail(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim().toLowerCase()
    : null;
}

function toNullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function getCustomerPhone(customer: LightspeedCustomer) {
  return (
    customer.phone ??
    customer.Contact?.Phones?.ContactPhone?.[0]?.number ??
    customer.Contact?.Phones?.Phone?.[0]?.number ??
    null
  );
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

  return parseVersionCursor(connection?.last_customer_version_cursor);
}

function mapLightspeedCustomerRow(
  tenantId: string,
  customer: LightspeedCustomer,
) {
  const providerRow: Record<string, unknown> = {
    tenant_id: tenantId,
    lightspeed_customer_id: String(customer.id ?? customer.customerID),
    email: normalizeEmail(customer.email),
    phone: getCustomerPhone(customer),
    first_name: customer.first_name ?? customer.firstName ?? null,
    last_name: customer.last_name ?? customer.lastName ?? null,
    customer_group_id:
      customer.customer_code ??
      customer.customerTypeID ??
      customer.CustomerType?.customerTypeID ??
      null,
    loyalty_balance:
      customer.loyalty_balance !== undefined &&
      customer.loyalty_balance !== null
        ? toNullableNumber(customer.loyalty_balance)
        : customer.loyaltyBalance !== undefined &&
            customer.loyaltyBalance !== null
          ? toNullableNumber(customer.loyaltyBalance)
          : customer.creditAccountID
            ? 0
            : null,
    raw_data: customer,
    synced_at: new Date().toISOString(),
  };

  const contactId = customer.contact_id ? String(customer.contact_id) : null;
  if (contactId) {
    providerRow.contact_id = contactId;
  }

  return providerRow;
}

function buildCrmCustomerUpsert(
  row: ReturnType<typeof mapLightspeedCustomerRow>,
) {
  if (!row.email) {
    return null;
  }

  const crmRow: Record<string, unknown> = {
    tenant_id: row.tenant_id,
    email: row.email,
    pos_source: "lightspeed",
    external_id: row.lightspeed_customer_id,
    updated_at: new Date().toISOString(),
  };

  if (row.first_name) {
    crmRow.first_name = row.first_name;
  }

  if (row.last_name) {
    crmRow.last_name = row.last_name;
  }

  if (row.phone) {
    crmRow.phone = row.phone;
  }

  return crmRow;
}

function toFiniteNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function getResumePage(job: any) {
  if (
    typeof job?.current_page === "number" &&
    Number.isFinite(job.current_page) &&
    job.current_page >= 0
  ) {
    return job.current_page;
  }

  const parsedCursor = job?.current_cursor
    ? Number.parseInt(job.current_cursor, 10)
    : Number.NaN;
  if (
    !Number.isFinite(parsedCursor) ||
    parsedCursor < 0 ||
    parsedCursor >= 1000
  ) {
    return 0;
  }

  return parsedCursor;
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
      "[LS-SYNC-CUSTOMERS] Failed to write queue progress:",
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[LS-SYNC-CUSTOMERS] Processing sync request");

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
    console.log("[LS-SYNC-CUSTOMERS] Tenant ID:", tenantId);

    // Get connection
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
    const { data: existingLockJob } = await supabaseClient
      .from("pos_sync_jobs")
      .select("id, status")
      .eq("connection_id", connection.id)
      .eq("sync_type", "customers")
      .in("status", ["pending", "in_progress"])
      .maybeSingle();

    if (existingLockJob) {
      console.log(
        "[LS-SYNC-CUSTOMERS] Sync already in progress, returning existing job",
      );
      return new Response(
        JSON.stringify({
          success: true,
          jobId: existingLockJob.id,
          message: "Sync already in progress",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log("[LS-SYNC-CUSTOMERS] Fetching customers from Lightspeed...");
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
          "[LS-SYNC-CUSTOMERS] Failed to load sync job state:",
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
    let currentCursor = getResumeCursor(syncJob, connection);
    let finalVersionCursor = currentCursor;

    while (true) {
      const customersUrl =
        currentCursor > 0
          ? `https://${connection.domain_prefix}.retail.lightspeed.app/api/2.0/customers?after=${currentCursor}`
          : `https://${connection.domain_prefix}.retail.lightspeed.app/api/2.0/customers`;

      await writeJobProgress(supabaseAdmin, jobId, {
        status: "in_progress",
        current_page: page,
        current_cursor: String(currentCursor),
        fetched_rows: totalFetched,
        inserted_rows: totalInserted,
        skipped_rows: totalSkipped,
        failed_rows: totalFailed,
        progress_message: `Fetching customers — page ${page + 1} · ${totalFetched.toLocaleString()} retrieved so far`,
      });

      const response = await fetch(customersUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          accept: "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          "[LS-SYNC-CUSTOMERS] API error:",
          response.status,
          errorText,
        );
        return new Response(
          JSON.stringify({
            error: `Lightspeed customers sync failed with HTTP ${response.status}`,
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
            "[LS-SYNC-CUSTOMERS] Failed to re-encrypt access token:",
            reEncryptError,
          );
        } else {
          reEncrypted = true;
        }
      }

      const data = await response.json();
      const customers = Array.isArray(data?.data)
        ? (data.data as LightspeedCustomer[])
        : [];
      totalFetched += customers.length;

      if (customers.length === 0) {
        finalVersionCursor = currentCursor;
        await writeJobProgress(supabaseAdmin, jobId, {
          status: "completed",
          current_page: page,
          current_cursor: String(currentCursor),
          fetched_rows: totalFetched,
          inserted_rows: totalInserted,
          skipped_rows: totalSkipped,
          failed_rows: totalFailed,
          progress_message: `Complete — ${totalInserted.toLocaleString()} customers imported`,
        });
        break;
      }

      console.log(
        `[LS-SYNC-CUSTOMERS] Fetched page ${page + 1}, batch: ${customers.length}, total fetched: ${totalFetched}`,
      );

      let syncedCount = 0;
      let pageFailed = 0;
      const pageProviderRows: Array<
        ReturnType<typeof mapLightspeedCustomerRow>
      > = [];

      for (const customer of customers) {
        const providerRow = mapLightspeedCustomerRow(tenantId, customer);

        try {
          await upsertLightspeedCustomerProfile(
            supabaseClient,
            providerRow as {
              tenant_id: string;
              lightspeed_customer_id: string;
              [key: string]: unknown;
            },
          );
        } catch (upsertError) {
          console.error("[LS-SYNC-CUSTOMERS] Upsert error:", upsertError);
          pageFailed++;
          continue;
        }

        pageProviderRows.push(providerRow);

        syncedCount++;
      }

      const crmRowsByEmail = new Map<string, Record<string, unknown>>();
      for (const providerRow of pageProviderRows) {
        const crmRow = buildCrmCustomerUpsert(providerRow);
        if (crmRow && typeof crmRow.email === "string") {
          crmRowsByEmail.set(crmRow.email, crmRow);
        }
      }

      if (crmRowsByEmail.size > 0) {
        const crmRows = Array.from(crmRowsByEmail.values());
        const { error: crmUpsertError } = await supabaseAdmin
          .from("crm_customers")
          .upsert(crmRows, {
            onConflict: "tenant_id,email",
          });

        if (crmUpsertError) {
          throw crmUpsertError;
        }

        const { data: crmContacts, error: crmContactsError } =
          await supabaseAdmin
            .from("crm_customers")
            .select("id,email")
            .eq("tenant_id", tenantId)
            .in("email", Array.from(crmRowsByEmail.keys()));

        if (crmContactsError) {
          throw crmContactsError;
        }

        const crmIdByEmail = new Map<string, string>();
        for (const crmContact of crmContacts || []) {
          if (crmContact.email) {
            crmIdByEmail.set(crmContact.email, crmContact.id);
          }
        }

        for (const providerRow of pageProviderRows) {
          if (!providerRow.email) {
            continue;
          }

          const contactId = crmIdByEmail.get(providerRow.email as string);
          if (!contactId) {
            continue;
          }

          const { error: linkError } = await supabaseAdmin
            .from("lightspeed_customers")
            .update({ contact_id: contactId })
            .eq("tenant_id", tenantId)
            .eq("lightspeed_customer_id", providerRow.lightspeed_customer_id);

          if (linkError) {
            throw linkError;
          }
        }
      }

      const pageSkipped = Math.max(
        0,
        customers.length - syncedCount - pageFailed,
      );
      totalInserted += syncedCount;
      totalSkipped += pageSkipped;
      totalFailed += pageFailed;
      const nextVersion = parseVersionCursor(data?.version?.max);
      const hasMore =
        customers.length > 0 &&
        nextVersion > 0 &&
        nextVersion !== currentCursor;
      const nextPage = page + 1;

      await writeJobProgress(supabaseAdmin, jobId, {
        status: hasMore ? "in_progress" : "completed",
        current_page: nextPage,
        current_cursor: String(hasMore ? nextVersion : currentCursor),
        fetched_rows: totalFetched,
        inserted_rows: totalInserted,
        skipped_rows: totalSkipped,
        failed_rows: totalFailed,
        progress_message: !hasMore
          ? `Complete — ${totalInserted.toLocaleString()} customers imported`
          : `Fetched customers — page ${page + 1} complete · ${totalFetched.toLocaleString()} retrieved so far`,
      });

      if (!hasMore) {
        finalVersionCursor = currentCursor;
        break;
      }

      currentCursor = nextVersion;
      finalVersionCursor = nextVersion;
      page = nextPage;
      await sleep(getAdaptiveCooldownMs(totalFetched));
    }

    // Update connection stats. Counter reflects the total row count of synced
    // Lightspeed customers for this tenant — not just rows touched by the
    // current run — so subsequent incremental syncs that fetch zero new rows
    // don't reset the displayed total to 0.
    const { count: totalCustomerRowCount } = await supabaseAdmin
      .from("lightspeed_customers")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId);

    await supabaseClient
      .from("lightspeed_connections")
      .update({
        last_customer_sync: new Date().toISOString(),
        customers_synced: totalCustomerRowCount ?? totalInserted,
        last_customer_version_cursor: String(finalVersionCursor),
      })
      .eq("tenant_id", tenantId);

    console.log("[LS-SYNC-CUSTOMERS] Running spend recalculation...");
    const spendResult = await recalculateLightspeedCustomerSpend(
      supabaseAdmin,
      {
        tenantId,
        connectionId: connection.id,
      },
    );
    console.log(
      `[LS-SYNC-CUSTOMERS] Spend recalculation: ${spendResult.updated} updated, ${spendResult.skipped} unchanged, ${spendResult.errors} errors`,
    );

    const normalizedSummary = await supabaseAdmin
      .from("crm_customers")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("pos_source", "lightspeed");

    const crmCustomersNormalized = normalizedSummary.count ?? 0;

    console.log(
      `[LS-SYNC-CUSTOMERS] Sync complete: ${totalInserted} customers, ${crmCustomersNormalized} CRM customers normalized`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        customersSync: totalInserted,
        crmCustomersNormalized,
        currentCursor: String(finalVersionCursor),
        message: `Synced ${totalInserted} customers, normalized ${crmCustomersNormalized} CRM customers`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: any) {
    console.error("[LS-SYNC-CUSTOMERS] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
