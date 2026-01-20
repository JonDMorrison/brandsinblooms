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

  console.log('🎂 Birthday Automation Checker started at:', new Date().toISOString());

  try {
    // ==========================================
    // STEP 1: CHECK IF ANY AUTOMATION EXISTS FIRST (Automation-First Pattern)
    // ==========================================
    const { data: activeAutomations, error: automationsError } = await supabase
      .from('crm_automations')
      .select('id, tenant_id, name, workflow_steps, persona_targeting')
      .eq('trigger_type', 'birthday')
      .eq('is_active', true);

    if (automationsError) {
      console.error('❌ Failed to fetch automations:', automationsError);
      throw automationsError;
    }

    if (!activeAutomations || activeAutomations.length === 0) {
      console.log('ℹ️ No active birthday automations configured for any tenant. Exiting early.');
      return new Response(JSON.stringify({
        success: true,
        message: 'No active birthday automations configured',
        customers_processed: 0
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`📋 Found ${activeAutomations.length} active birthday automation(s) across tenants`);

    // Get unique tenant IDs that have birthday automations
    const tenantIds = [...new Set(activeAutomations.map(a => a.tenant_id).filter(Boolean))];
    console.log(`🏢 Tenants with birthday automations: ${tenantIds.length}`);

    // ==========================================
    // STEP 2: GET TODAY'S DATE FOR BIRTHDAY MATCHING
    // ==========================================
    const today = new Date();
    const todayMonth = today.getMonth() + 1; // 1-indexed
    const todayDay = today.getDate();
    
    console.log(`📅 Checking birthdays for: ${todayMonth}/${todayDay}`);

    // ==========================================
    // STEP 3: QUERY ONLY CUSTOMERS FROM TENANTS WITH ACTIVE AUTOMATIONS
    // ==========================================
    const { data: customers, error: customersError } = await supabase
      .from('crm_customers')
      .select('id, tenant_id, email, first_name, last_name, phone, custom_fields, email_opt_in, sms_opt_in, tags, persona_id, lifetime_value')
      .in('tenant_id', tenantIds)
      .not('custom_fields', 'is', null);

    if (customersError) {
      console.error('❌ Failed to fetch customers:', customersError);
      throw customersError;
    }

    console.log(`👥 Found ${customers?.length || 0} customers with custom_fields from ${tenantIds.length} tenant(s)`);

    // Filter customers whose birthday matches today
    const birthdayCustomers = (customers || []).filter(customer => {
      const dob = customer.custom_fields?.date_of_birth;
      if (!dob) return false;
      
      try {
        const birthDate = new Date(dob);
        const birthMonth = birthDate.getMonth() + 1;
        const birthDay = birthDate.getDate();
        return birthMonth === todayMonth && birthDay === todayDay;
      } catch {
        return false;
      }
    });

    console.log(`🎂 Found ${birthdayCustomers.length} customers with birthday today`);

    let triggeredCount = 0;
    let skippedOptOutCount = 0;
    let skippedTargetingCount = 0;
    let errorCount = 0;

    // ==========================================
    // STEP 4: PROCESS BIRTHDAY CUSTOMERS WITH CONSENT & TARGETING CHECKS
    // ==========================================
    for (const customer of birthdayCustomers) {
      try {
        console.log(`🎉 Processing birthday for: ${customer.email} (tenant: ${customer.tenant_id})`);
        
        // Find automations for this tenant
        const tenantAutomations = activeAutomations.filter(a => a.tenant_id === customer.tenant_id);

        if (tenantAutomations.length === 0) {
          console.log(`ℹ️ No active birthday automations for tenant ${customer.tenant_id}`);
          continue;
        }

        // Process each automation
        for (const automation of tenantAutomations) {
          const workflowSteps = automation.workflow_steps || [];
          
          if (workflowSteps.length === 0) {
            console.log(`⚠️ Automation ${automation.id} has no workflow steps, skipping`);
            continue;
          }

          // Check persona targeting
          const personaTargeting = automation.persona_targeting || {};
          if (!checkPersonaTargeting(customer, personaTargeting)) {
            console.log(`⏭️ Skipping ${customer.email} - does not match persona targeting for automation ${automation.name}`);
            skippedTargetingCount++;
            continue;
          }

          // Enqueue messages for each step
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

            // Calculate scheduled time
            const scheduledAt = new Date();
            scheduledAt.setMinutes(scheduledAt.getMinutes() + delayMinutes);

            // Personalize content using unified merge tag engine
            const rawContent = step.text || step.body || step.content || '';
            const normalizedContent = convertLegacyTags(rawContent);
            const mergeTagData = createMergeTagDataFromCustomer(customer as unknown as Record<string, unknown>, {});
            const personalizedContent = renderMergeTags(normalizedContent, mergeTagData);
            
            let personalizedSubject = null;
            if (step.subject) {
              const normalizedSubject = convertLegacyTags(step.subject);
              personalizedSubject = renderMergeTags(normalizedSubject, mergeTagData);
            }

            // Determine recipient
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
                automation_id: automation.id,
                automation_node_id: step.id || step.node_id || `step-${i}`,
                customer_id: customer.id,
                message_type: messageType,
                recipient: recipient,
                content: personalizedContent,
                subject: personalizedSubject,
                status: 'queued',  // Standardized: always use queued
                scheduled_at: scheduledAt.toISOString(),
                template_data: {
                  automation_name: automation.name,
                  step_index: i,
                  customer_data: customer,
                  trigger_type: 'birthday'
                }
              });

            if (outboxError) {
              console.error(`❌ Failed to enqueue message for step ${i}:`, outboxError);
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
              automation_id: automation.id,
              customer_id: customer.id,
              event_type: 'triggered',
              metadata: {
                trigger_type: 'birthday',
                triggered_at: new Date().toISOString()
              }
            });
        }
      } catch (err) {
        console.error(`❌ Error processing customer ${customer.email}:`, err);
        errorCount++;
      }
    }

    const summary = {
      success: true,
      checked_date: `${todayMonth}/${todayDay}`,
      tenants_with_automations: tenantIds.length,
      total_customers_checked: customers?.length || 0,
      birthday_customers_found: birthdayCustomers.length,
      messages_triggered: triggeredCount,
      skipped_opt_out: skippedOptOutCount,
      skipped_targeting: skippedTargetingCount,
      errors: errorCount,
      timestamp: new Date().toISOString()
    };

    console.log('🎂 Birthday Automation Checker completed:', JSON.stringify(summary));

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Birthday Automation Checker failed:', error);
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
