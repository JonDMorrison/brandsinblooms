import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Minimal test function to insert into crm_outbox and verify fix
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json().catch(() => ({}));
    const tenantId = body.tenant_id || '13b62ff0-4dc0-4451-a851-bb142a25ea62';
    const customerId = body.customer_id || 'a32785c9-f9b9-4767-b912-dcb820eebe52';
    const email = body.email || 'tlwslw66@gmail.com';

    console.log('📬 Testing crm_outbox insert...');

    // Insert test message with 'pending' status
    const { data: outbox, error: outboxError } = await supabase
      .from('crm_outbox')
      .insert({
        tenant_id: tenantId,
        customer_id: customerId,
        message_type: 'email',
        recipient: email,
        content: 'Test message to verify crm_outbox insert works after constraint fix. This is a proof test.',
        subject: 'Test Email - Proof of Outbox Insert',
        status: 'queued',  // Standardized: always use queued
        scheduled_at: new Date().toISOString(),
        priority: 10,
        template_data: { test: true, inserted_at: new Date().toISOString() }
      })
      .select('id, tenant_id, customer_id, message_type, status, scheduled_at, created_at')
      .single();

    if (outboxError) {
      console.error('❌ Outbox insert failed:', {
        code: outboxError.code,
        message: outboxError.message,
        details: outboxError.details,
        hint: outboxError.hint
      });
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: outboxError.message,
          code: outboxError.code,
          details: outboxError.details
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Outbox insert succeeded:', outbox);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'crm_outbox insert succeeded',
        outbox_entry: outbox
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Exception:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
