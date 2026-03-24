import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { decryptToken, encryptToken } from '../_shared/crypto/tokens.ts';
import { getAdaptiveCooldown as getAdaptiveCooldownMs } from '../_shared/syncThrottling.ts';

console.log('[LS-SYNC-SALES] Edge function starting');

const LIGHTSPEED_PAGE_SIZE = 100;

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

function parseCompleted(value: unknown) {
  return value === true || value === 'true' || value === '1' || value === 1;
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
    console.error('[LS-SYNC-SALES] Failed to write queue progress:', error.message);
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
    console.log('[LS-SYNC-SALES] Processing sync request');

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

    console.log('[LS-SYNC-SALES] Fetching sales from Lightspeed...');
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
        console.error('[LS-SYNC-SALES] Failed to load sync job state:', jobError.message);
      } else {
        syncJob = jobData;
      }
    }

    // Get sales from last 90 days for initial sync, or since last sync
    const lastSync = connection.last_sales_sync;
    const sinceDate = lastSync
      ? new Date(lastSync).toISOString().split('T')[0]
      : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    let totalFetched = toFiniteNumber(syncJob?.fetched_rows, 0);
    let totalInserted = toFiniteNumber(syncJob?.inserted_rows, 0);
    let totalSkipped = toFiniteNumber(syncJob?.skipped_rows, 0);
    let totalFailed = toFiniteNumber(syncJob?.failed_rows, 0);
    let page = getResumePage(syncJob);
    let hasMore = true;
    let firstPurchases = 0;

    while (hasMore) {
      const offset = page * LIGHTSPEED_PAGE_SIZE;
      const salesUrl = `https://${connection.domain_prefix}.retail.lightspeed.app/api/2.0/Sale.json?completeTime=>,${sinceDate}&limit=${LIGHTSPEED_PAGE_SIZE}&offset=${offset}&load_relations=["SaleLines","Customer"]`;

      await writeJobProgress(supabaseAdmin, jobId, {
        status: 'in_progress',
        current_page: page,
        current_cursor: String(page),
        fetched_rows: totalFetched,
        inserted_rows: totalInserted,
        skipped_rows: totalSkipped,
        failed_rows: totalFailed,
        progress_message: `Fetching sales — page ${page + 1} · ${totalFetched.toLocaleString()} retrieved${page === 0 ? ` (since ${new Date(sinceDate).toLocaleDateString()})` : ''}`,
      });

      const response = await fetch(salesUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        console.error('[LS-SYNC-SALES] API error:', response.status);
        break;
      }

      if (needsReEncryption && !reEncrypted) {
        const reEncryptedToken = await encryptToken(accessToken);
        const { error: reEncryptError } = await supabaseAdmin
          .from('lightspeed_connections')
          .update({ encrypted_access_token: reEncryptedToken })
          .eq('id', connection.id);

        if (reEncryptError) {
          console.error('[LS-SYNC-SALES] Failed to re-encrypt access token:', reEncryptError);
        } else {
          reEncrypted = true;
        }
      }

      const data = await response.json();
      const sales = Array.isArray(data.Sale) ? data.Sale : [data.Sale].filter(Boolean);
      totalFetched += sales.length;

      if (sales.length === 0) {
        hasMore = false;
        await writeJobProgress(supabaseAdmin, jobId, {
          status: 'completed',
          current_page: page,
          current_cursor: String(page),
          fetched_rows: totalFetched,
          inserted_rows: totalInserted,
          skipped_rows: totalSkipped,
          failed_rows: totalFailed,
          progress_message: `Complete — ${totalInserted.toLocaleString()} sales imported`,
        });
        break;
      }

      console.log(`[LS-SYNC-SALES] Fetched page ${page + 1}, batch: ${sales.length}, total fetched: ${totalFetched}`);

      let syncedCount = 0;
      let pageFailed = 0;
      const affectedCustomerIds = new Set<string>();

      for (const sale of sales) {
      // Extract line items
      const lineItems = Array.isArray(sale.SaleLines?.SaleLine)
        ? sale.SaleLines.SaleLine
        : sale.SaleLines?.SaleLine ? [sale.SaleLines.SaleLine] : [];

      // Get linked contact if exists
      let contactId = null;
      if (sale.customerID) {
        const { data: lsCustomer } = await supabaseClient
          .from('lightspeed_customers')
          .select('contact_id')
          .eq('tenant_id', tenantId)
          .eq('lightspeed_customer_id', sale.customerID)
          .single();

        contactId = lsCustomer?.contact_id || null;
      }

      // Upsert sale
      const { error: upsertError } = await supabaseClient
        .from('lightspeed_sales')
        .upsert({
          tenant_id: tenantId,
          lightspeed_sale_id: sale.saleID,
          lightspeed_customer_id: sale.customerID || null,
          contact_id: contactId,
          sale_date: sale.completeTime || sale.createTime,
          total_amount: parseFloat(sale.calcTotal || sale.total || 0),
          status: parseCompleted(sale.completed) ? 'completed' : 'open',
          line_items: lineItems,
          payment_method: sale.SalePayments?.SalePayment?.[0]?.PaymentType?.name || sale.SalePayments?.SalePayment?.[0]?.paymentType?.name || null,
          note: sale.note || null,
          raw_data: sale,
          synced_at: new Date().toISOString(),
        }, {
          onConflict: 'tenant_id,lightspeed_sale_id'
        });

      if (upsertError) {
        console.error('[LS-SYNC-SALES] Upsert error:', upsertError);
        pageFailed++;
        continue;
      }

      if (sale.customerID && parseCompleted(sale.completed)) {
        affectedCustomerIds.add(String(sale.customerID));
      }

      syncedCount++;
    }

      for (const customerId of affectedCustomerIds) {
        const { data: customerSales } = await supabaseClient
          .from('lightspeed_sales')
          .select('total_amount, sale_date')
          .eq('tenant_id', tenantId)
          .eq('lightspeed_customer_id', customerId)
          .in('status', ['completed', 'CLOSED'])
          .order('sale_date', { ascending: true });

        if (customerSales) {
          const totalSpend = customerSales.reduce((sum, s) => sum + parseFloat(s.total_amount || 0), 0);
          const purchaseCount = customerSales.length;
          const firstPurchaseDate = customerSales[0]?.sale_date;
          const lastPurchaseDate = customerSales[customerSales.length - 1]?.sale_date;

          await supabaseClient
            .from('lightspeed_customers')
            .update({
              total_spend: totalSpend,
              purchase_count: purchaseCount,
              first_purchase_date: firstPurchaseDate,
              last_purchase_date: lastPurchaseDate,
            })
            .eq('tenant_id', tenantId)
            .eq('lightspeed_customer_id', customerId);

          // Track first purchases for trigger
          if (purchaseCount === 1) {
            firstPurchases++;
          }
        }
      }

      const pageSkipped = Math.max(0, sales.length - syncedCount - pageFailed);
      totalInserted += syncedCount;
      totalSkipped += pageSkipped;
      totalFailed += pageFailed;
      page++;

      await writeJobProgress(supabaseAdmin, jobId, {
        status: sales.length < LIGHTSPEED_PAGE_SIZE ? 'completed' : 'in_progress',
        current_page: page,
        current_cursor: String(page),
        fetched_rows: totalFetched,
        inserted_rows: totalInserted,
        skipped_rows: totalSkipped,
        failed_rows: totalFailed,
        progress_message:
          sales.length < LIGHTSPEED_PAGE_SIZE
            ? `Complete — ${totalInserted.toLocaleString()} sales imported`
            : `Fetched sales — page ${page} complete · ${totalFetched.toLocaleString()} retrieved so far`,
      });

      if (sales.length < LIGHTSPEED_PAGE_SIZE) {
        hasMore = false;
      } else {
        await sleep(getAdaptiveCooldownMs(totalFetched));
      }
    }

    // Update connection stats
    await supabaseClient
      .from('lightspeed_connections')
      .update({
        last_sales_sync: new Date().toISOString(),
        sales_synced: totalInserted,
      })
      .eq('tenant_id', tenantId);

    console.log(`[LS-SYNC-SALES] Sync complete: ${totalInserted} sales, ${firstPurchases} first purchases`);

    return new Response(
      JSON.stringify({
        success: true,
        salesSynced: totalInserted,
        firstPurchases: firstPurchases,
        message: `Synced ${totalInserted} sales`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[LS-SYNC-SALES] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
