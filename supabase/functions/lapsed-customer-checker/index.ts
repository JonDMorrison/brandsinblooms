import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { renderMergeTags, convertLegacyTags, createMergeTagDataFromCustomer } from "../_shared/mergeTagEngine.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, traceparent, tracestate',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('⏰ Lapsed Customer Checker started at:', new Date().toISOString());

  try {
    // ==========================================
    // STEP 1: CHECK IF ANY AUTOMATION EXISTS FIRST (Automation-First Pattern)
    // ==========================================
    const { data: activeAutomations, error: automationsError } = await supabase
      .from('crm_automations')
      .select('id, tenant_id, name, workflow_steps, persona_targeting')
      .eq('trigger_type', 'repeat_purchase_90d')
      .eq('is_active', true);

    if (automationsError) {
      console.error('❌ Failed to fetch automations:', automationsError);
      throw automationsError;
    }

    if (!activeAutomations || activeAutomations.length === 0) {
      console.log('ℹ️ No active lapsed customer (90-day) automations configured. Exiting early.');
      return new Response(JSON.stringify({
        success: true,
        message: 'No active repeat_purchase_90d automations configured',
        customers_processed: 0
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`📋 Found ${activeAutomations.length} active lapsed customer automation(s)`);

    // Get unique tenant IDs that have this automation
    const tenantIds = [...new Set(activeAutomations.map(a => a.tenant_id).filter(Boolean))];
    console.log(`🏢 Tenants with lapsed automations: ${tenantIds.length}`);

    // ==========================================
    // STEP 2: QUERY LAPSED CUSTOMERS (90+ DAYS)
    // ==========================================
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const { data: lapsedCustomers, error: customersError } = await supabase
      .from('crm_customers')
      .select('id, tenant_id, email, first_name, last_name, phone, last_purchase_date, lifetime_value, email_opt_in, sms_opt_in, tags, persona_id')
      .in('tenant_id', tenantIds)
      .lt('last_purchase_date', ninetyDaysAgo.toISOString())
      .not('last_purchase_date', 'is', null);

    if (customersError) {
      console.error('❌ Failed to fetch lapsed customers:', customersError);
      throw customersError;
    }

    console.log(`👥 Found ${lapsedCustomers?.length || 0} lapsed customers across ${tenantIds.length} tenants`);

    // ==========================================
    // STEP 3: PROCESS WITH COOLDOWN CHECK
    // ==========================================
    const COOLDOWN_DAYS = 30;
    const cooldownDate = new Date();
    cooldownDate.setDate(cooldownDate.getDate() - COOLDOWN_DAYS);

    let triggeredCount = 0;
    let skippedCooldownCount = 0;
    let skippedOptOutCount = 0;
    let skippedTargetingCount = 0;
    let errorCount = 0;

    for (const customer of lapsedCustomers || []) {
      try {
        // Check if customer was already triggered recently (cooldown)
        const { data: recentTriggers } = await supabase
          .from('automation_events')
          .select('id')
          .eq('customer_id', customer.id)
          .eq('event_type', 'triggered')
          .gte('created_at', cooldownDate.toISOString())
          .limit(1);

        // Also check if metadata contains the trigger type
        const { data: recentLapsedTriggers } = await supabase
          .from('automation_events')
          .select('id, metadata')
          .eq('customer_id', customer.id)
          .eq('event_type', 'triggered')
          .gte('created_at', cooldownDate.toISOString());

        const hasRecentLapsedTrigger = (recentLapsedTriggers || []).some(
          (t: any) => t.metadata?.trigger_type === 'repeat_purchase_90d'
        );

        if (hasRecentLapsedTrigger) {
          console.log(`⏭️ Skipping ${customer.email} - triggered within last ${COOLDOWN_DAYS} days`);
          skippedCooldownCount++;
          continue;
        }

        // Find automation for this tenant
        const tenantAutomation = activeAutomations.find(a => a.tenant_id === customer.tenant_id);
        if (!tenantAutomation) continue;

        // Check persona targeting
        const personaTargeting = tenantAutomation.persona_targeting || {};
        if (!checkPersonaTargeting(customer, personaTargeting)) {
          console.log(`⏭️ Skipping ${customer.email} - does not match persona targeting`);
          skippedTargetingCount++;
          continue;
        }

        const daysSincePurchase = Math.floor(
          (Date.now() - new Date(customer.last_purchase_date).getTime()) / (1000 * 60 * 60 * 24)
        );

        console.log(`📅 Processing lapsed customer: ${customer.email} (${daysSincePurchase} days since last purchase)`);

        // Process workflow steps and enqueue messages
        const workflowSteps = tenantAutomation.workflow_steps || [];
        
        for (let i = 0; i < workflowSteps.length; i++) {
          const step = workflowSteps[i];
          const delayMinutes = step.delayMin || 0;
          const messageType = step.channel || step.type || 'email';

          // Check opt-in consent
          if (messageType === 'email' && customer.email_opt_in === false) {
            console.log(`⏭️ Skipping email for ${customer.email} - not opted in`);
            skippedOptOutCount++;
            continue;
          }
          if (messageType === 'sms' && customer.sms_opt_in !== true) {
            console.log(`⏭️ Skipping SMS for ${customer.email} - not opted in`);
            skippedOptOutCount++;
            continue;
          }
          
          const scheduledAt = new Date();
          scheduledAt.setMinutes(scheduledAt.getMinutes() + delayMinutes);

          // Personalize content
          const rawContent = step.text || step.body || step.content || '';
          const normalizedContent = convertLegacyTags(rawContent);
          const mergeTagData = createMergeTagDataFromCustomer(customer as unknown as Record<string, unknown>, {
            days_since_purchase: daysSincePurchase.toString()
          });
          const personalizedContent = renderMergeTags(normalizedContent, mergeTagData);

          let personalizedSubject = null;
          if (step.subject) {
            const normalizedSubject = convertLegacyTags(step.subject);
            personalizedSubject = renderMergeTags(normalizedSubject, mergeTagData);
          }

          const recipient = messageType === 'sms' ? customer.phone : customer.email;

          if (!recipient) {
            console.log(`⚠️ No ${messageType} recipient for customer ${customer.email}, skipping step ${i}`);
            continue;
          }

          // Insert into outbox
          const { error: outboxError } = await supabase
            .from('crm_outbox')
            .insert({
              tenant_id: customer.tenant_id,
              automation_id: tenantAutomation.id,
              customer_id: customer.id,
              message_type: messageType,
              recipient: recipient,
              content: personalizedContent,
              subject: personalizedSubject,
              status: 'queued',  // Standardized: always use queued
              scheduled_at: scheduledAt.toISOString(),
              template_data: {
                automation_name: tenantAutomation.name,
                step_index: i,
                trigger_type: 'repeat_purchase_90d',
                days_since_purchase: daysSincePurchase
              }
            });

          if (outboxError) {
            console.error(`❌ Failed to enqueue message for ${customer.email} step ${i}:`, outboxError);
            errorCount++;
          } else {
            console.log(`✅ Enqueued ${messageType} message for ${recipient}, scheduled at ${scheduledAt.toISOString()}`);
            triggeredCount++;
          }
        }

        // Log automation event
        await supabase
          .from('automation_events')
          .insert({
            automation_id: tenantAutomation.id,
            customer_id: customer.id,
            event_type: 'triggered',
            metadata: {
              trigger_type: 'repeat_purchase_90d',
              days_lapsed: daysSincePurchase,
              triggered_at: new Date().toISOString()
            }
          });

      } catch (err) {
        console.error(`❌ Error processing ${customer.email}:`, err);
        errorCount++;
      }
    }

    const summary = {
      success: true,
      tenants_with_automations: tenantIds.length,
      total_lapsed_customers: lapsedCustomers?.length || 0,
      messages_triggered: triggeredCount,
      skipped_cooldown: skippedCooldownCount,
      skipped_opt_out: skippedOptOutCount,
      skipped_targeting: skippedTargetingCount,
      errors: errorCount,
      timestamp: new Date().toISOString()
    };

    console.log('⏰ Lapsed Customer Checker completed:', JSON.stringify(summary));

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Lapsed Customer Checker failed:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Helper function to check persona targeting
function checkPersonaTargeting(customer: any, personaTargeting: any): boolean {
  // If no targeting specified, all customers match
  if (!personaTargeting || Object.keys(personaTargeting).length === 0) {
    return true;
  }

  // Check persona_ids
  if (personaTargeting.persona_ids && personaTargeting.persona_ids.length > 0) {
    if (!customer.persona_id || !personaTargeting.persona_ids.includes(customer.persona_id)) {
      return false;
    }
  }

  // Check required_tags
  if (personaTargeting.required_tags && personaTargeting.required_tags.length > 0) {
    const customerTags = customer.tags || [];
    const hasAllTags = personaTargeting.required_tags.every((tag: string) => customerTags.includes(tag));
    if (!hasAllTags) {
      return false;
    }
  }

  // Check min_lifetime_value
  if (personaTargeting.min_lifetime_value !== undefined && personaTargeting.min_lifetime_value !== null) {
    const customerLTV = customer.lifetime_value || 0;
    if (customerLTV < personaTargeting.min_lifetime_value) {
      return false;
    }
  }

  return true;
}
