import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.10';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simulates a Square payment.completed webhook event for testing automations
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const customerId = body.customer_id;
    const tenantId = body.tenant_id;

    if (!customerId) {
      throw new Error('customer_id is required');
    }

    // Use service role for all operations (admin-only test function)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get customer
    const { data: customer, error: custError } = await supabaseAdmin
      .from('crm_customers')
      .select('*, tenant_id')
      .eq('id', customerId)
      .single();

    if (custError || !customer) {
      throw new Error(`Customer not found: ${custError?.message}`);
    }
    
    const effectiveTenantId = tenantId || customer.tenant_id;

    if (custError || !customer) {
      throw new Error(`Customer not found: ${custError?.message}`);
    }

    console.log(`🧪 [TEST] Simulating order.completed for customer: ${customer.email}`);

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

    // Now fire automation triggers just like the webhook handler does
    const triggerTypes = ['order.completed'];
    const eventData = {
      order_amount: 25.00,
      order_id: `test-${Date.now()}`,
      merchant_id: 'test',
      products: ['Test Product'],
      test_mode: true
    };

    // Get active automations for this trigger
    const { data: automations } = await supabaseAdmin
      .from('crm_automations')
      .select('*')
      .eq('tenant_id', effectiveTenantId)
      .eq('is_active', true)
      .in('trigger_type', triggerTypes);

    if (!automations?.length) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No active automations for order.completed',
          customer_id: customer.id,
          customer_email: customer.email
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 [TEST] Found ${automations.length} active automations`);

    const results = [];
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
        console.log(`⏭️ [TEST] Skipping automation ${automation.name} - already has active run`);
        results.push({
          automation_id: automation.id,
          automation_name: automation.name,
          skipped: true,
          reason: 'already_has_active_run',
          existing_run_id: existingRun.id
        });
        continue;
      }

      // Create automation run
      const { data: run, error: runError } = await supabaseAdmin
        .from('automation_runs')
        .insert({
          automation_id: automation.id,
          customer_id: customer.id,
          tenant_id: effectiveTenantId,
          status: 'active',
          current_step_index: 0,
          total_steps: (automation.workflow_steps || []).length,
          trigger_data: {
            trigger_type: automation.trigger_type,
            triggered_at: new Date().toISOString(),
            customer_email: customer.email,
            test_mode: true
          },
          metadata: {
            automation_name: automation.name,
            test_triggered: true
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

      // Create outbox entry for the first step
      const steps = automation.workflow_steps || [];
      const firstMessageStep = steps.find((s: any) => s.type === 'email' || s.type === 'sms');
      
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
            subject: firstMessageStep.subject || `Test from ${automation.name}`,
            content: firstMessageStep.content || firstMessageStep.text || 'Test message content',
            template_data: {
              automation_name: automation.name,
              step_index: 0,
              customer_data: {
                first_name: customer.first_name,
                email: customer.email
              },
              event_data: eventData,
              test_mode: true
            },
            scheduled_at: scheduledAt.toISOString(),
            status: 'pending'
          })
          .select('id')
          .single();

        if (outboxError) {
          console.error(`❌ [TEST] Failed to create outbox entry:`, outboxError);
        } else {
          console.log(`✅ [TEST] Created crm_outbox entry: ${outbox.id}`);
        }

        results.push({
          automation_id: automation.id,
          automation_name: automation.name,
          automation_run_id: run.id,
          outbox_id: outbox?.id,
          message_type: firstMessageStep.type,
          recipient,
          scheduled_at: scheduledAt.toISOString()
        });
      } else {
        results.push({
          automation_id: automation.id,
          automation_name: automation.name,
          automation_run_id: run.id,
          no_message_step: true
        });
      }

      // Also create automation_events entry
      await supabaseAdmin.from('automation_events').insert({
        automation_id: automation.id,
        customer_id: customer.id,
        event_type: 'triggered',
        metadata: {
          trigger_types: triggerTypes,
          event_data: eventData,
          test_mode: true
        }
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
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
