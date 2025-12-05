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
    // Get today's month and day
    const today = new Date();
    const todayMonth = today.getMonth() + 1; // 1-indexed
    const todayDay = today.getDate();
    
    console.log(`📅 Checking birthdays for: ${todayMonth}/${todayDay}`);

    // Get all customers with birthdays - we'll filter by month/day
    const { data: customers, error: customersError } = await supabase
      .from('crm_customers')
      .select('id, tenant_id, email, first_name, last_name, phone, custom_fields')
      .not('custom_fields', 'is', null);

    if (customersError) {
      console.error('❌ Failed to fetch customers:', customersError);
      throw customersError;
    }

    console.log(`👥 Found ${customers?.length || 0} customers with custom_fields`);

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
    let errorCount = 0;

    // Fire birthday automation triggers for each customer
    for (const customer of birthdayCustomers) {
      try {
        console.log(`🎉 Processing birthday for: ${customer.email} (tenant: ${customer.tenant_id})`);
        
        // Find active birthday automations for this tenant
        const { data: automations, error: automationsError } = await supabase
          .from('crm_automations')
          .select('*')
          .eq('tenant_id', customer.tenant_id)
          .eq('trigger_type', 'birthday')
          .eq('is_active', true);

        if (automationsError) {
          console.error(`❌ Failed to fetch automations for tenant ${customer.tenant_id}:`, automationsError);
          errorCount++;
          continue;
        }

        if (!automations || automations.length === 0) {
          console.log(`ℹ️ No active birthday automations for tenant ${customer.tenant_id}`);
          continue;
        }

        console.log(`📋 Found ${automations.length} active birthday automation(s) for tenant ${customer.tenant_id}`);

        // Process each automation
        for (const automation of automations) {
          const workflowSteps = automation.workflow_steps || [];
          
          if (workflowSteps.length === 0) {
            console.log(`⚠️ Automation ${automation.id} has no workflow steps, skipping`);
            continue;
          }

          // Enqueue messages for each step
          for (let i = 0; i < workflowSteps.length; i++) {
            const step = workflowSteps[i];
            const delayMinutes = step.delayMin || 0;
            
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

            // Determine recipient and message type
            const messageType = step.channel || step.type || 'email';
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
                customer_id: customer.id,
                message_type: messageType,
                recipient: recipient,
                content: personalizedContent,
                subject: personalizedSubject,
                status: 'pending',
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
      total_customers_with_custom_fields: customers?.length || 0,
      birthday_customers_found: birthdayCustomers.length,
      messages_triggered: triggeredCount,
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
