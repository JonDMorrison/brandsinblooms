import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.10';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Square Proof Test - Simulates a Square purchase event to test the full pipeline:
 * 1. Updates customer last_purchase_date
 * 2. Fires automation triggers
 * 3. Enqueues crm_outbox messages
 * 4. Process-automation-outbox sends them
 * 5. crm_message_logs stores external_id
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('🧪 [PROOF-TEST] Starting Square purchase simulation');

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json().catch(() => ({}));
    const tenantId = body.tenant_id || '13b62ff0-4dc0-4451-a851-bb142a25ea62';
    const testEmail = body.email || 'smiles4him247@gmail.com';
    const testAmount = body.amount || 25.99;

    console.log(`🧪 [PROOF-TEST] Testing with tenant=${tenantId}, email=${testEmail}, amount=$${testAmount}`);

    // 1. Find or create customer
    const { data: customer, error: customerError } = await supabase
      .from('crm_customers')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('email', testEmail)
      .single();

    if (customerError) {
      console.error('❌ Customer not found:', customerError.message);
      return new Response(
        JSON.stringify({ error: 'Customer not found', details: customerError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ Found customer: ${customer.id} (${customer.first_name || 'N/A'})`);

    // 2. Update last_purchase_date to today
    const today = new Date().toISOString().split('T')[0];
    const isFirstPurchase = !customer.first_purchase_date;

    const { error: updateError } = await supabase
      .from('crm_customers')
      .update({
        first_purchase_date: isFirstPurchase ? today : customer.first_purchase_date,
        last_purchase_date: today,
        total_spent: (customer.total_spent || 0) + testAmount,
        lifetime_value: (customer.lifetime_value || 0) + testAmount,
        pos_source: 'square',
        updated_at: new Date().toISOString(),
      })
      .eq('id', customer.id);

    if (updateError) {
      console.error('❌ Failed to update customer:', updateError);
    } else {
      console.log(`✅ Updated customer last_purchase_date to ${today}`);
    }

    // 3. Get a user_id for this tenant
    const { data: tenantUser } = await supabase
      .from('users')
      .select('id')
      .eq('tenant_id', tenantId)
      .limit(1)
      .single();

    const userId = tenantUser?.id || '00000000-0000-0000-0000-000000000000';

    // 4. Fire automation triggers
    const triggers = ['order.completed', 'review_request'];
    if (isFirstPurchase) triggers.push('first_purchase');

    console.log(`🔥 Firing triggers: ${triggers.join(', ')}`);

    const { data: automations } = await supabase
      .from('crm_automations')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .in('trigger_type', triggers);

    console.log(`📋 Found ${automations?.length || 0} active automations for these triggers`);

    let enqueued = 0;
    for (const automation of automations || []) {
      const workflowSteps = automation.workflow_steps || [];
      const baseTime = new Date();

      for (let i = 0; i < workflowSteps.length; i++) {
        const step = workflowSteps[i];
        if (step.type === 'delay') continue;

        const messageType = step.type || 'email';
        
        // Check opt-in
        if (messageType === 'email' && customer.email_opt_in === false) {
          console.log(`⏭️ Skipping email step - customer opted out`);
          continue;
        }
        if (messageType === 'sms' && customer.sms_opt_in !== true) {
          console.log(`⏭️ Skipping SMS step - customer not opted in`);
          continue;
        }

        const recipient = messageType === 'sms' ? customer.phone : customer.email;
        if (!recipient) {
          console.log(`⏭️ Skipping ${messageType} - no recipient`);
          continue;
        }

        // Calculate delay from previous delay steps
        let totalDelayMin = 0;
        for (let j = 0; j < i; j++) {
          const prevStep = workflowSteps[j];
          if (prevStep.type === 'delay') {
            const delayValue = prevStep.delayValue || 0;
            const delayUnit = prevStep.delayUnit || 'minutes';
            if (delayUnit === 'days') totalDelayMin += delayValue * 24 * 60;
            else if (delayUnit === 'hours') totalDelayMin += delayValue * 60;
            else totalDelayMin += delayValue;
          }
        }

        const scheduledAt = new Date(baseTime.getTime() + totalDelayMin * 60 * 1000);

        // Personalize content
        let content = step.content || step.text || '';
        content = content.replace(/\{\{first_name\}\}/g, customer.first_name || 'there');
        content = content.replace(/\{\{order_amount\}\}/g, `$${testAmount.toFixed(2)}`);

        let subject = step.subject || '';
        subject = subject.replace(/\{\{first_name\}\}/g, customer.first_name || 'there');

        // Enqueue message
        const { error: insertError } = await supabase.from('crm_outbox').insert({
          tenant_id: tenantId,
          automation_id: automation.id,
          customer_id: customer.id,
          message_type: messageType,
          recipient,
          content,
          subject: messageType === 'email' ? subject : null,
          template_data: {
            automation_name: automation.name,
            step_index: i,
            trigger_type: automation.trigger_type,
            proof_test: true,
          },
          scheduled_at: scheduledAt.toISOString(),
          status: 'queued',
        });

        if (insertError) {
          console.error(`❌ Failed to enqueue message:`, insertError);
        } else {
          console.log(`📤 Enqueued ${messageType} to ${recipient} for ${scheduledAt.toISOString()}`);
          enqueued++;
        }
      }
    }

    console.log(`✅ Enqueued ${enqueued} messages`);

    // 5. Get current outbox state
    const { data: outboxRows } = await supabase
      .from('crm_outbox')
      .select('id, message_type, recipient, status, scheduled_at, automation_id')
      .eq('tenant_id', tenantId)
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false })
      .limit(10);

    // 6. Trigger outbox processor for immediate messages only
    const now = new Date();
    const immediateMessages = outboxRows?.filter(
      (r) => r.status === 'queued' && new Date(r.scheduled_at) <= now
    ) || [];

    let processResult = null;
    if (immediateMessages.length > 0) {
      console.log(`🔄 Processing ${immediateMessages.length} immediate message(s)`);

      const { data, error } = await supabase.functions.invoke('process-automation-outbox');
      if (error) {
        console.error('❌ Failed to process outbox:', error);
      } else {
        processResult = data;
        console.log(`✅ Outbox processor result:`, JSON.stringify(data));
      }
    } else {
      console.log(`⏳ No immediate messages - all scheduled for later`);
    }

    // 7. Check message logs for external_ids
    const { data: messageLogs } = await supabase
      .from('crm_message_logs')
      .select('id, message_type, recipient, status, external_id, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(5);

    // 8. Get updated outbox state
    const { data: updatedOutbox } = await supabase
      .from('crm_outbox')
      .select('id, message_type, recipient, status, scheduled_at, sent_at')
      .eq('tenant_id', tenantId)
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false })
      .limit(10);

    return new Response(
      JSON.stringify({
        success: true,
        proof: {
          customer_id: customer.id,
          customer_email: customer.email,
          last_purchase_date_updated: today,
          is_first_purchase: isFirstPurchase,
          triggers_fired: triggers,
          automations_found: automations?.length || 0,
          messages_enqueued: enqueued,
          immediate_messages_count: immediateMessages.length,
          process_result: processResult,
          outbox_state: updatedOutbox,
          message_logs: messageLogs,
        },
        verdict: messageLogs?.some((l) => l.external_id && l.status === 'sent')
          ? '✅ SENDING WORKS - Provider IDs confirmed'
          : enqueued > 0 && immediateMessages.length === 0
          ? '⏳ Messages scheduled for later - check back after delay'
          : '❌ No sent messages with provider IDs yet',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('💥 Proof test error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
