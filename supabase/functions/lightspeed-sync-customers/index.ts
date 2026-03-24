import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { decryptToken, encryptToken } from '../_shared/crypto/tokens.ts';
import { getAdaptiveCooldown as getAdaptiveCooldownMs } from '../_shared/syncThrottling.ts';

console.log('[LS-SYNC-CUSTOMERS] Edge function starting');

const LIGHTSPEED_PAGE_SIZE = 100;

interface LightspeedCustomer {
  customerID: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  Contact?: {
    Phones?: { Phone?: Array<{ number?: string }> };
  };
  CustomerType?: { customerTypeID?: string };
  creditAccountID?: string;
  loyaltyBalance?: string | number | null;
  numVisits?: string | number | null;
  purchaseCount?: string | number | null;
  totalSpend?: string | number | null;
  firstVisit?: string | null;
  lastVisit?: string | null;
  customerTypeID?: string | null;
}

function normalizeEmail(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim().toLowerCase()
    : null;
}

function toNullableNumber(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function getCustomerPhone(customer: LightspeedCustomer) {
  return customer.Contact?.Phones?.Phone?.[0]?.number || null;
}

function mapLightspeedCustomerRow(tenantId: string, customer: LightspeedCustomer) {
  const email = normalizeEmail(customer.email);
  const phone = getCustomerPhone(customer);
  const loyaltyBalance = customer.loyaltyBalance !== undefined && customer.loyaltyBalance !== null
    ? toNullableNumber(customer.loyaltyBalance)
    : customer.creditAccountID
      ? 0
      : null;

  return {
    tenant_id: tenantId,
    lightspeed_customer_id: String(customer.customerID),
    email,
    phone,
    first_name: customer.firstName || null,
    last_name: customer.lastName || null,
    customer_group_id: customer.customerTypeID || customer.CustomerType?.customerTypeID || null,
    loyalty_balance: loyaltyBalance,
    purchase_count: toNullableNumber(customer.numVisits ?? customer.purchaseCount),
    total_spend: toNullableNumber(customer.totalSpend),
    first_purchase_date: customer.firstVisit || null,
    last_purchase_date: customer.lastVisit || null,
    raw_data: customer,
    synced_at: new Date().toISOString(),
  };
}

function buildCrmCustomerUpsert(row: ReturnType<typeof mapLightspeedCustomerRow>) {
  if (!row.email) {
    return null;
  }

  const crmRow: Record<string, unknown> = {
    tenant_id: row.tenant_id,
    email: row.email,
    pos_source: 'lightspeed',
    lightspeed_customer_id: row.lightspeed_customer_id,
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

  if (typeof row.purchase_count === 'number') {
    crmRow.pos_order_count = row.purchase_count;
  }

  if (typeof row.total_spend === 'number') {
    crmRow.total_spent = row.total_spend;
    crmRow.pos_total_spent = row.total_spend;
    crmRow.lifetime_value = row.total_spend;
  }

  if (row.first_purchase_date) {
    crmRow.first_purchase_date = row.first_purchase_date;
  }

  if (row.last_purchase_date) {
    crmRow.last_purchase_date = row.last_purchase_date;
  }

  return crmRow;
}

function toFiniteNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function getResumePage(job: any) {
  if (typeof job?.current_page === 'number' && Number.isFinite(job.current_page) && job.current_page >= 0) {
    return job.current_page;
  }

  const parsedCursor = job?.current_cursor ? Number.parseInt(job.current_cursor, 10) : Number.NaN;
  if (!Number.isFinite(parsedCursor) || parsedCursor < 0) {
    return 0;
  }

  if (parsedCursor >= LIGHTSPEED_PAGE_SIZE && parsedCursor % LIGHTSPEED_PAGE_SIZE === 0) {
    return Math.floor(parsedCursor / LIGHTSPEED_PAGE_SIZE);
  }

  return parsedCursor;
}

async function sleep(ms: number) {
  if (ms <= 0) {
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function writeJobProgress(supabaseAdmin: any, jobId: string | null, updates: Record<string, unknown>) {
  if (!jobId) {
    return;
  }

  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from('pos_sync_jobs_v2')
    .update({
      ...updates,
      updated_at: now,
      last_progress_at: updates.last_progress_at ?? now,
    })
    .eq('id', jobId);

  if (error) {
    console.error('[LS-SYNC-CUSTOMERS] Failed to write queue progress:', error.message);
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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[LS-SYNC-CUSTOMERS] Processing sync request');

    const requestBody = await req.json().catch(() => ({}));
    const jobId = typeof requestBody?.job_id === 'string' ? requestBody.job_id : null;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: userData } = await supabaseClient
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (!userData?.tenant_id) {
      return new Response(
        JSON.stringify({ error: 'No tenant found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tenantId = userData.tenant_id;
    console.log('[LS-SYNC-CUSTOMERS] Tenant ID:', tenantId);

    // Get connection
    const { data: connection, error: connError } = await supabaseClient
      .from('lightspeed_connections')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'connected')
      .single();

    if (connError || !connection) {
      return new Response(
        JSON.stringify({ error: 'No active Lightspeed connection' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[LS-SYNC-CUSTOMERS] Fetching customers from Lightspeed...');
  const { accessToken, needsReEncryption } = await getLightspeedAccessToken(connection);
  let reEncrypted = false;

    let syncJob: any = null;
    if (jobId) {
      const { data: jobData, error: jobError } = await supabaseAdmin
        .from('pos_sync_jobs_v2')
        .select('current_page,current_cursor,fetched_rows,inserted_rows,skipped_rows,failed_rows,total_pages_est')
        .eq('id', jobId)
        .single();

      if (jobError) {
        console.error('[LS-SYNC-CUSTOMERS] Failed to load sync job state:', jobError.message);
      } else {
        syncJob = jobData;
      }
    }

    let totalFetched = toFiniteNumber(syncJob?.fetched_rows, 0);
    let totalInserted = toFiniteNumber(syncJob?.inserted_rows, 0);
    let totalSkipped = toFiniteNumber(syncJob?.skipped_rows, 0);
    let totalFailed = toFiniteNumber(syncJob?.failed_rows, 0);
    let page = getResumePage(syncJob);
    let hasMore = true;

    while (hasMore) {
      const offset = page * LIGHTSPEED_PAGE_SIZE;
      const customersUrl = `https://${connection.domain_prefix}.retail.lightspeed.app/api/2.0/Customer.json?limit=${LIGHTSPEED_PAGE_SIZE}&offset=${offset}`;

      await writeJobProgress(supabaseAdmin, jobId, {
        status: 'in_progress',
        current_page: page,
        current_cursor: String(page),
        fetched_rows: totalFetched,
        inserted_rows: totalInserted,
        skipped_rows: totalSkipped,
        failed_rows: totalFailed,
        progress_message: `Fetching customers — page ${page + 1} · ${totalFetched.toLocaleString()} retrieved so far`,
      });

      const response = await fetch(customersUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        console.error('[LS-SYNC-CUSTOMERS] API error:', response.status);
        break;
      }

      if (needsReEncryption && !reEncrypted) {
        const reEncryptedToken = await encryptToken(accessToken);
        const { error: reEncryptError } = await supabaseAdmin
          .from('lightspeed_connections')
          .update({ encrypted_access_token: reEncryptedToken })
          .eq('id', connection.id);

        if (reEncryptError) {
          console.error('[LS-SYNC-CUSTOMERS] Failed to re-encrypt access token:', reEncryptError);
        } else {
          reEncrypted = true;
        }
      }

      const data = await response.json();
      const customers = Array.isArray(data.Customer) ? data.Customer : [data.Customer].filter(Boolean);
      totalFetched += customers.length;

      if (customers.length === 0) {
        hasMore = false;
        await writeJobProgress(supabaseAdmin, jobId, {
          status: 'completed',
          current_page: page,
          current_cursor: String(page),
          fetched_rows: totalFetched,
          inserted_rows: totalInserted,
          skipped_rows: totalSkipped,
          failed_rows: totalFailed,
          progress_message: `Complete — ${totalInserted.toLocaleString()} customers imported`,
        });
        break;
      }

      console.log(`[LS-SYNC-CUSTOMERS] Fetched page ${page + 1}, batch: ${customers.length}, total fetched: ${totalFetched}`);

      let syncedCount = 0;
      let pageFailed = 0;
      const pageProviderRows: Array<ReturnType<typeof mapLightspeedCustomerRow>> = [];

      for (const customer of customers) {
      const providerRow = mapLightspeedCustomerRow(tenantId, customer);

      // Upsert to lightspeed_customers
      const { error: upsertError } = await supabaseClient
        .from('lightspeed_customers')
        .upsert(providerRow, {
          onConflict: 'tenant_id,lightspeed_customer_id'
        });

      if (upsertError) {
        console.error('[LS-SYNC-CUSTOMERS] Upsert error:', upsertError);
        pageFailed++;
        continue;
      }

      pageProviderRows.push(providerRow);

      syncedCount++;
    }

      const crmRowsByEmail = new Map<string, Record<string, unknown>>();
      for (const providerRow of pageProviderRows) {
        const crmRow = buildCrmCustomerUpsert(providerRow);
        if (crmRow && typeof crmRow.email === 'string') {
          crmRowsByEmail.set(crmRow.email, crmRow);
        }
      }

      let normalizedCount = 0;
      let linkedCount = 0;

      if (crmRowsByEmail.size > 0) {
        const crmRows = Array.from(crmRowsByEmail.values());
        const { error: crmUpsertError } = await supabaseAdmin
          .from('crm_customers')
          .upsert(crmRows, {
            onConflict: 'tenant_id,email',
          });

        if (crmUpsertError) {
          throw crmUpsertError;
        }

        normalizedCount = crmRows.length;

        const { data: crmContacts, error: crmContactsError } = await supabaseAdmin
          .from('crm_customers')
          .select('id,email')
          .eq('tenant_id', tenantId)
          .in('email', Array.from(crmRowsByEmail.keys()));

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

          const contactId = crmIdByEmail.get(providerRow.email);
          if (!contactId) {
            continue;
          }

          const { error: linkError } = await supabaseAdmin
            .from('lightspeed_customers')
            .update({ contact_id: contactId })
            .eq('tenant_id', tenantId)
            .eq('lightspeed_customer_id', providerRow.lightspeed_customer_id);

          if (linkError) {
            throw linkError;
          }

          linkedCount++;
        }
      }

      const pageSkipped = Math.max(0, customers.length - syncedCount - pageFailed);
      totalInserted += syncedCount;
      totalSkipped += pageSkipped;
      totalFailed += pageFailed;
      page++;

      await writeJobProgress(supabaseAdmin, jobId, {
        status: customers.length < LIGHTSPEED_PAGE_SIZE ? 'completed' : 'in_progress',
        current_page: page,
        current_cursor: String(page),
        fetched_rows: totalFetched,
        inserted_rows: totalInserted,
        skipped_rows: totalSkipped,
        failed_rows: totalFailed,
        progress_message:
          customers.length < LIGHTSPEED_PAGE_SIZE
            ? `Complete — ${totalInserted.toLocaleString()} customers imported`
            : `Fetched customers — page ${page} complete · ${totalFetched.toLocaleString()} retrieved so far`,
      });

      if (customers.length < LIGHTSPEED_PAGE_SIZE) {
        hasMore = false;
      } else {
        await sleep(getAdaptiveCooldownMs(totalFetched));
      }
    }

    // Update connection stats
    await supabaseClient
      .from('lightspeed_connections')
      .update({
        last_customer_sync: new Date().toISOString(),
        customers_synced: totalInserted,
      })
      .eq('tenant_id', tenantId);

    const normalizedSummary = await supabaseAdmin
      .from('crm_customers')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('pos_source', 'lightspeed');

    const crmCustomersNormalized = normalizedSummary.count ?? 0;

    console.log(`[LS-SYNC-CUSTOMERS] Sync complete: ${totalInserted} customers, ${crmCustomersNormalized} CRM customers normalized`);

    return new Response(
      JSON.stringify({
        success: true,
        customersSync: totalInserted,
        crmCustomersNormalized,
        message: `Synced ${totalInserted} customers, normalized ${crmCustomersNormalized} CRM customers`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[LS-SYNC-CUSTOMERS] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
