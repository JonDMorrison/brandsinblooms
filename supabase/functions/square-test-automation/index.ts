import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.10';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Secured test function - requires authentication and tenant membership
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // AUTHENTICATION REQUIRED
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user's auth token
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify user identity
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's tenant
    const { data: userData, error: userError } = await supabaseUser
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (userError || !userData?.tenant_id) {
      return new Response(
        JSON.stringify({ error: 'User not associated with a tenant' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userTenantId = userData.tenant_id;

    // Check if user is master admin (can access any tenant)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: isMasterAdmin } = await supabaseAdmin
      .from('app_admin_emails')
      .select('email')
      .eq('email', user.email)
      .maybeSingle();

    const body = await req.json().catch(() => ({}));
    const customerId = body.customer_id;
    const requestedTenantId = body.tenant_id;

    // Determine effective tenant - master admins can specify any tenant
    const effectiveTenantId = isMasterAdmin && requestedTenantId ? requestedTenantId : userTenantId;

    // If not master admin, ensure they can only test their own tenant
    if (!isMasterAdmin && requestedTenantId && requestedTenantId !== userTenantId) {
      return new Response(
        JSON.stringify({ error: 'Access denied: You can only test your own tenant' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!customerId) {
      return new Response(
        JSON.stringify({ error: 'customer_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get customer - must belong to the effective tenant
    const { data: customer, error: custError } = await supabaseAdmin
      .from('crm_customers')
      .select('*')
      .eq('id', customerId)
      .eq('tenant_id', effectiveTenantId)
      .single();

    if (custError || !customer) {
      return new Response(
        JSON.stringify({ error: `Customer not found or not in your tenant: ${custError?.message || 'Not found'}` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🧪 [TEST] User ${user.email} testing automation for customer: ${customer.email}`);
    console.log(`🧪 [TEST] Tenant: ${effectiveTenantId}, Master Admin: ${!!isMasterAdmin}`);

    // Update customer's last_purchase_date to NOW
    const currentDate = new Date().toISOString().split('T')[0];
    const { error: updateError } = await supabaseAdmin
      .from('crm_customers')
      .update({
        last_purchase_date: currentDate,
        updated_at: new Date().toISOString()
      })
      .eq('id', customer.id);

    if (updateError) {
      console.error('Failed to update customer:', updateError);
      throw new Error(`Failed to update customer: ${updateError.message}`);
    }

    console.log(`✅ [TEST] Updated last_purchase_date to ${currentDate}`);

    // Get active automations for payment.completed trigger
    const { data: automations } = await supabaseAdmin
      .from('crm_automations')
      .select('*')
      .eq('tenant_id', effectiveTenantId)
      .eq('is_active', true)
      .eq('trigger_type', 'payment.completed');

    if (!automations?.length) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No active automations for payment.completed',
          customer_id: customer.id,
          customer_email: customer.email,
          last_purchase_date: currentDate
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 [TEST] Found ${automations.length} active payment.completed automations`);

    const results = [];
    const eventData = {
      order_amount: 25.00,
      order_id: `test-${Date.now()}`,
      merchant_id: 'test',
      products: ['Test Product'],
      test_mode: true
    };

    for (const automation of automations) {
      // Check for existing active run
      const { data: existingRun } = await supabaseAdmin
        .from('automation_runs')
        .select('id, status')
        .eq('automation_id', automation.id)
        .eq('customer_id', customer.id)
        .in('status', ['active', 'paused'])
        .limit(1)
        .maybeSingle();

      if (existingRun) {
        console.log(`⏭️ [TEST] Skipping ${automation.name} - already has active run`);
        results.push({
          automation_id: automation.id,
          automation_name: automation.name,
          skipped: true,
          reason: 'already_has_active_run',
          existing_run_id: existingRun.id
        });
        continue;
      }

      // Parse workflow steps
      const steps = Array.isArray(automation.workflow_steps) 
        ? automation.workflow_steps 
        : [];
      
      const messageSteps = steps.filter((s: any) => s.type === 'email' || s.type === 'sms');

      // Create automation run
      const { data: run, error: runError } = await supabaseAdmin
        .from('automation_runs')
        .insert({
          automation_id: automation.id,
          customer_id: customer.id,
          tenant_id: effectiveTenantId,
          status: 'active',
          current_step_index: 0,
          total_steps: messageSteps.length,
          trigger_data: {
            trigger_type: automation.trigger_type,
            triggered_at: new Date().toISOString(),
            customer_email: customer.email,
            test_mode: true
          },
          metadata: {
            automation_name: automation.name,
            test_triggered: true,
            triggered_by: user.email
          }
        })
        .select('id')
        .single();

      if (runError) {
        console.error(`❌ [TEST] Failed to create run for ${automation.name}:`, runError);
        results.push({
          automation_id: automation.id,
          automation_name: automation.name,
          error: runError.message
        });
        continue;
      }

      console.log(`✅ [TEST] Created automation_run: ${run.id}`);

      // Create outbox entry for the first message step
      const firstMessageStep = messageSteps[0];
      
      if (firstMessageStep) {
        const recipient = firstMessageStep.type === 'sms' ? customer.phone : customer.email;
        const scheduledAt = new Date();
        
        // Parse delay if present
        if (firstMessageStep.delayValue && firstMessageStep.delayUnit) {
          const delayMinutes = firstMessageStep.delayValue * 
            (firstMessageStep.delayUnit === 'days' ? 1440 : 
             firstMessageStep.delayUnit === 'hours' ? 60 : 1);
          scheduledAt.setMinutes(scheduledAt.getMinutes() + delayMinutes);
        }

        const { data: outbox, error: outboxError } = await supabaseAdmin
          .from('crm_outbox')
          .insert({
            tenant_id: effectiveTenantId,
            automation_id: automation.id,
            automation_run_id: run.id,
            customer_id: customer.id,
            message_type: firstMessageStep.type,
            recipient,
            subject: firstMessageStep.subject || `Message from ${automation.name}`,
            content: firstMessageStep.content || firstMessageStep.text || 'Test message content',
            step_index: 0,
            template_data: {
              automation_name: automation.name,
              customer_data: {
                first_name: customer.first_name,
                last_name: customer.last_name,
                email: customer.email
              },
              event_data: eventData,
              test_mode: true
            },
            scheduled_at: scheduledAt.toISOString(),
            status: 'queued',  // Standardized: always use queued
            priority: 50 // High priority for test
          })
          .select('id')
          .single();
          
        console.log(`📬 [TEST-OUTBOX] Insert attempt for ${customer.email}, error:`, outboxError || 'none');

        if (outboxError) {
          console.error(`❌ [TEST] Failed to create outbox entry:`, outboxError);
          results.push({
            automation_id: automation.id,
            automation_name: automation.name,
            automation_run_id: run.id,
            error: `Outbox creation failed: ${outboxError.message}`
          });
        } else {
          console.log(`✅ [TEST] Created crm_outbox entry: ${outbox.id}`);
          results.push({
            automation_id: automation.id,
            automation_name: automation.name,
            automation_run_id: run.id,
            outbox_id: outbox.id,
            message_type: firstMessageStep.type,
            recipient,
            scheduled_at: scheduledAt.toISOString()
          });
        }
      } else {
        results.push({
          automation_id: automation.id,
          automation_name: automation.name,
          automation_run_id: run.id,
          warning: 'No message steps found in automation'
        });
      }

      // Create automation event
      await supabaseAdmin.from('automation_events').insert({
        automation_id: automation.id,
        customer_id: customer.id,
        event_type: 'triggered',
        metadata: {
          trigger_type: 'payment.completed',
          event_data: eventData,
          test_mode: true,
          triggered_by: user.email
        }
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        tested_by: user.email,
        tenant_id: effectiveTenantId,
        customer_id: customer.id,
        customer_email: customer.email,
        last_purchase_date: currentDate,
        automations_triggered: results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[TEST-AUTOMATION] Error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
