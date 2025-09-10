import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Get user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Invalid authentication');
    }

    // Get user's tenant
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      throw new Error('User not found');
    }

    const body = await req.json();
    const { connection_id } = body;

    console.log('Linking POS customers to CRM:', { connection_id });

    // Get all POS customers for this connection that aren't linked yet
    const { data: posCustomers, error: posError } = await supabase
      .from('pos_customers')
      .select(`
        id,
        email,
        first_name,
        last_name,
        phone,
        tags,
        raw_data
      `)
      .eq('tenant_id', userData.tenant_id)
      .eq('connection_id', connection_id)
      .not('id', 'in', `(
        SELECT pos_customer_id FROM crm_customer_links 
        WHERE tenant_id = '${userData.tenant_id}'
      )`);

    if (posError) {
      throw new Error(`Failed to fetch POS customers: ${posError.message}`);
    }

    let linked = 0;
    let created = 0;
    const errors: string[] = [];

    for (const posCustomer of posCustomers || []) {
      try {
        // Try to find existing CRM customer by email
        const { data: existingCrm, error: crmError } = await supabase
          .from('crm_customers')
          .select('id')
          .eq('tenant_id', userData.tenant_id)
          .eq('email', posCustomer.email)
          .maybeSingle();

        if (crmError && crmError.code !== 'PGRST116') { // PGRST116 = no rows found
          throw new Error(`CRM lookup error: ${crmError.message}`);
        }

        let crmCustomerId: string;

        if (existingCrm) {
          // Link to existing CRM customer
          crmCustomerId = existingCrm.id;
          linked++;
        } else {
          // Create new CRM customer
          const { data: newCrm, error: createError } = await supabase
            .from('crm_customers')
            .insert({
              tenant_id: userData.tenant_id,
              user_id: user.id,
              email: posCustomer.email,
              first_name: posCustomer.first_name,
              last_name: posCustomer.last_name,
              phone: posCustomer.phone,
              tags: posCustomer.tags || [],
              pos_source: 'pos_sync',
              custom_fields: {
                pos_raw_data: posCustomer.raw_data
              }
            })
            .select('id')
            .single();

          if (createError) {
            throw new Error(`Failed to create CRM customer: ${createError.message}`);
          }

          crmCustomerId = newCrm.id;
          created++;
        }

        // Create the link
        const { error: linkError } = await supabase
          .from('crm_customer_links')
          .insert({
            tenant_id: userData.tenant_id,
            crm_customer_id: crmCustomerId,
            pos_customer_id: posCustomer.id,
            link_method: 'email',
            confidence_score: 1.0
          });

        if (linkError) {
          throw new Error(`Failed to create link: ${linkError.message}`);
        }

      } catch (customerError) {
        console.error('Error linking customer:', customerError);
        errors.push(`${posCustomer.email}: ${customerError instanceof Error ? customerError.message : 'Unknown error'}`);
      }
    }

    console.log('Customer linking completed:', { linked, created, errors: errors.length });

    return new Response(JSON.stringify({
      success: errors.length === 0,
      linked,
      created,
      total_processed: (posCustomers || []).length,
      errors: errors
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error linking POS customers:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    );
  }
});