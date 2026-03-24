import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { decryptToken, encryptToken } from '../_shared/crypto/tokens.ts';
import { getAdaptiveCooldown as getAdaptiveCooldownMs } from '../_shared/syncThrottling.ts';

console.log('[LS-SYNC-PRODUCTS] Edge function starting');

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
    console.error('[LS-SYNC-PRODUCTS] Failed to write queue progress:', error.message);
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
    console.log('[LS-SYNC-PRODUCTS] Processing sync request');

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

    console.log('[LS-SYNC-PRODUCTS] Fetching products from Lightspeed...');
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
        console.error('[LS-SYNC-PRODUCTS] Failed to load sync job state:', jobError.message);
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
      const productsUrl = `https://${connection.domain_prefix}.retail.lightspeed.app/api/3.0/Item.json?limit=${LIGHTSPEED_PAGE_SIZE}&offset=${offset}`;

      await writeJobProgress(supabaseAdmin, jobId, {
        status: 'in_progress',
        current_page: page,
        current_cursor: String(page),
        fetched_rows: totalFetched,
        inserted_rows: totalInserted,
        skipped_rows: totalSkipped,
        failed_rows: totalFailed,
        progress_message: `Fetching products — page ${page + 1} · ${totalFetched.toLocaleString()} retrieved`,
      });

      const response = await fetch(productsUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        console.error('[LS-SYNC-PRODUCTS] API error:', response.status);
        break;
      }

      if (needsReEncryption && !reEncrypted) {
        const reEncryptedToken = await encryptToken(accessToken);
        const { error: reEncryptError } = await supabaseAdmin
          .from('lightspeed_connections')
          .update({ encrypted_access_token: reEncryptedToken })
          .eq('id', connection.id);

        if (reEncryptError) {
          console.error('[LS-SYNC-PRODUCTS] Failed to re-encrypt access token:', reEncryptError);
        } else {
          reEncrypted = true;
        }
              totalFetched += products.length;
      }

      const data = await response.json();
                await writeJobProgress(supabaseAdmin, jobId, {
                  status: 'completed',
                  current_page: page,
                  current_cursor: String(page),
                  fetched_rows: totalFetched,
                  inserted_rows: totalInserted,
                  skipped_rows: totalSkipped,
                  failed_rows: totalFailed,
                  progress_message: `Complete — ${totalInserted.toLocaleString()} products imported`,
                });
                break;
      } else {
        allProducts = allProducts.concat(products);
              console.log(`[LS-SYNC-PRODUCTS] Fetched page ${page + 1}, batch: ${products.length}, total fetched: ${totalFetched}`);

              let syncedCount = 0;
              let pageFailed = 0;

              for (const product of products) {

    let syncedCount = 0;

    for (const product of allProducts) {
      // Extract tags from category or custom fields
      const tags = [];
      if (product.Category?.name) {
        tags.push(product.Category.name);
      }
      if (product.Tags?.tag) {
        const productTags = Array.isArray(product.Tags.tag) ? product.Tags.tag : [product.Tags.tag];
        tags.push(...productTags.map((t: any) => t.name || t));
      }

      const { error: upsertError } = await supabaseClient
        .from('lightspeed_products')
        .upsert({
          tenant_id: tenantId,
          lightspeed_product_id: product.itemID,
          name: product.description || 'Unnamed Product',
          sku: product.customSku || product.manufacturerSku || null,
          description: product.longDescription || product.description || null,
          price: parseFloat(product.Prices?.ItemPrice?.[0]?.amount || product.defaultCost || 0),
          inventory_count: parseInt(product.ItemShops?.ItemShop?.[0]?.qoh || 0),
          category: product.Category?.name || null,
          tags: tags,
          raw_data: product,
          synced_at: new Date().toISOString(),
        }, {
          onConflict: 'tenant_id,lightspeed_product_id'
        });

      if (upsertError) {
        console.error('[LS-SYNC-PRODUCTS] Upsert error:', upsertError);
        pageFailed++;
        continue;
      }

      syncedCount++;
    }

      const pageSkipped = Math.max(0, products.length - syncedCount - pageFailed);
      totalInserted += syncedCount;
      totalSkipped += pageSkipped;
      totalFailed += pageFailed;
      page++;

      await writeJobProgress(supabaseAdmin, jobId, {
        status: products.length < LIGHTSPEED_PAGE_SIZE ? 'completed' : 'in_progress',
        current_page: page,
        current_cursor: String(page),
        fetched_rows: totalFetched,
        inserted_rows: totalInserted,
        skipped_rows: totalSkipped,
        failed_rows: totalFailed,
        progress_message:
          products.length < LIGHTSPEED_PAGE_SIZE
            ? `Complete — ${totalInserted.toLocaleString()} products imported`
            : `Fetched products — page ${page} complete · ${totalFetched.toLocaleString()} retrieved so far`,
      });

      if (products.length < LIGHTSPEED_PAGE_SIZE) {
        hasMore = false;
      } else {
        await sleep(getAdaptiveCooldownMs(totalFetched));
      }
    }

    // Update connection stats
    await supabaseClient
      .from('lightspeed_connections')
      .update({
        last_product_sync: new Date().toISOString(),
        products_synced: totalInserted,
      })
      .eq('tenant_id', tenantId);

    console.log(`[LS-SYNC-PRODUCTS] Sync complete: ${totalInserted} products`);

    return new Response(
      JSON.stringify({
        success: true,
        productsSynced: totalInserted,
        message: `Synced ${totalInserted} products`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[LS-SYNC-PRODUCTS] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
