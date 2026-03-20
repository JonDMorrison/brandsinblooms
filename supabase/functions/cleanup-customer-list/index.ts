import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // FIX: [issue #2] - Add JWT authentication and tenant verification
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { tenant_id, cleanup_type, batch_size = 200 } = await req.json();

    // FIX: [issue #2] - Verify user belongs to requested tenant
    const { data: callerData } = await supabaseAdmin.from('users').select('tenant_id').eq('id', user.id).single();
    if (!callerData || callerData.tenant_id !== tenant_id) {
      return new Response(JSON.stringify({ error: 'Tenant access denied' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!tenant_id) {
      return new Response(
        JSON.stringify({ error: 'tenant_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = {
      junk_deleted: 0,
      nameless_deleted: 0,
      phone_dupes_deleted: 0,
      total_deleted: 0,
      errors: [] as string[],
    };

    // Step 1: Delete junk entries by fetching IDs first, then deleting
    if (cleanup_type === 'all' || cleanup_type === 'junk') {
      const junkPatterns = [
        { first_name: 'discover', last_name: 'cardmember' },
        { first_name: 'biolife', last_name: 'donor' },
        { first_name: 'chase', last_name: 'cardholder' },
        { first_name: 'google', last_name: 'storebot' },
        { first_name: 'venmo', last_name: 'user' },
        { first_name: 'paypal', last_name: 'user' },
        { first_name: 'square', last_name: 'customer' },
      ];

      for (const pattern of junkPatterns) {
        // Fetch IDs first
        const { data: toDelete, error: fetchError } = await supabaseAdmin
          .from('crm_customers')
          .select('id')
          .eq('tenant_id', tenant_id)
          .ilike('first_name', pattern.first_name)
          .ilike('last_name', pattern.last_name)
          .limit(1000);

        if (fetchError) {
          results.errors.push(`Junk fetch error (${pattern.first_name}): ${fetchError.message}`);
          continue;
        }

        if (!toDelete || toDelete.length === 0) continue;

        // Delete in small batches
        const ids = toDelete.map(r => r.id);
        for (let i = 0; i < ids.length; i += batch_size) {
          const batch = ids.slice(i, i + batch_size);
          const { error } = await supabaseAdmin
            .from('crm_customers')
            .delete()
            .in('id', batch);

          if (error) {
            results.errors.push(`Junk delete error: ${error.message}`);
          } else {
            results.junk_deleted += batch.length;
          }
        }
      }
    }

    // Step 2: Delete nameless contacts - fetch by criteria, delete by ID
    if (cleanup_type === 'all' || cleanup_type === 'nameless') {
      // Use raw SQL-like approach via RPC or fetch all and filter
      // Fetch records where BOTH first_name and last_name are empty/null
      let totalNamelessDeleted = 0;
      
      for (let iteration = 0; iteration < 100; iteration++) { // Max 100 iterations
        // Fetch a batch of nameless contacts
        const { data: nameless, error: fetchError } = await supabaseAdmin
          .from('crm_customers')
          .select('id, first_name, last_name')
          .eq('tenant_id', tenant_id)
          .limit(500);

        if (fetchError) {
          results.errors.push(`Nameless fetch error: ${fetchError.message}`);
          break;
        }

        if (!nameless || nameless.length === 0) break;

        // Filter for truly nameless (both fields empty)
        const namelessIds = nameless
          .filter(r => 
            (!r.first_name || r.first_name.trim() === '') && 
            (!r.last_name || r.last_name.trim() === '')
          )
          .map(r => r.id);

        if (namelessIds.length === 0) break;

        // Delete in batches
        for (let i = 0; i < namelessIds.length; i += batch_size) {
          const batch = namelessIds.slice(i, i + batch_size);
          const { error } = await supabaseAdmin
            .from('crm_customers')
            .delete()
            .in('id', batch);

          if (error) {
            results.errors.push(`Nameless delete error: ${error.message}`);
          } else {
            totalNamelessDeleted += batch.length;
          }
        }

        // Safety break if we've deleted enough
        if (totalNamelessDeleted >= 15000) break;
      }
      
      results.nameless_deleted = totalNamelessDeleted;
    }

    // Step 3: Delete phone duplicates (keep most recent)
    if (cleanup_type === 'all' || cleanup_type === 'phone_dupes') {
      // Fetch all records with phones in batches
      const allRecords: { id: string; phone: string; updated_at: string }[] = [];
      let offset = 0;
      const fetchBatch = 1000;

      while (true) {
        const { data, error } = await supabaseAdmin
          .from('crm_customers')
          .select('id, phone, updated_at')
          .eq('tenant_id', tenant_id)
          .not('phone', 'is', null)
          .neq('phone', '')
          .order('updated_at', { ascending: false })
          .range(offset, offset + fetchBatch - 1);

        if (error) {
          results.errors.push(`Phone fetch error: ${error.message}`);
          break;
        }

        if (!data || data.length === 0) break;

        allRecords.push(...data);
        offset += fetchBatch;

        // Safety limit
        if (allRecords.length >= 100000) break;
      }

      // Group by normalized phone
      const phoneMap = new Map<string, string[]>();
      
      for (const record of allRecords) {
        const phone = record.phone?.replace(/\D/g, '').slice(-10); // Normalize to last 10 digits
        if (!phone || phone.length < 7) continue;
        
        if (!phoneMap.has(phone)) {
          phoneMap.set(phone, []);
        }
        phoneMap.get(phone)!.push(record.id);
      }

      // Collect IDs to delete (all but the first/most recent per phone)
      const idsToDelete: string[] = [];
      
      for (const [, ids] of phoneMap) {
        if (ids.length > 1) {
          // Skip the first one (most recent due to ordering), delete the rest
          idsToDelete.push(...ids.slice(1));
        }
      }

      // Delete in batches
      for (let i = 0; i < idsToDelete.length; i += batch_size) {
        const batch = idsToDelete.slice(i, i + batch_size);
        
        const { error } = await supabaseAdmin
          .from('crm_customers')
          .delete()
          .in('id', batch);

        if (error) {
          results.errors.push(`Phone dupe delete error: ${error.message}`);
        } else {
          results.phone_dupes_deleted += batch.length;
        }
      }
    }

    results.total_deleted = results.junk_deleted + results.nameless_deleted + results.phone_dupes_deleted;

    // Get final count
    const { count: finalCount } = await supabaseAdmin
      .from('crm_customers')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenant_id);

    return new Response(
      JSON.stringify({
        success: true,
        results,
        final_customer_count: finalCount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Cleanup error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
