import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.10';
import { renderMergeTags, convertLegacyTags, createMergeTagDataFromCustomer, GLOBAL_FALLBACKS } from "../_shared/mergeTagEngine.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AutomationTriggerEvent {
  trigger_type: string;
  tenant_id: string;
  customer_id: string;
  data: Record<string, any>;
}

interface WorkflowStep {
  type: 'email' | 'sms';
  delayMin: number;
  subject?: string;
  text: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🤖 Automation Executor starting...');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Query active automations with compiled workflow_steps
    const { data: activeAutomations, error: automationsError } = await supabase
      .from('crm_automations')
      .select(`
        id,
        tenant_id,
        trigger_type,
        trigger_conditions,
        workflow_steps,
        name,
        version,
        compiled_at
      `)
      .eq('is_active', true);

    if (automationsError) {
      console.error('❌ Failed to fetch active automations:', automationsError);
      throw automationsError;
    }

    console.log(`📋 Found ${activeAutomations?.length || 0} active automations`);

    let totalProcessed = 0;
    let totalEnqueued = 0;

    // 2. Process each automation
    for (const automation of activeAutomations || []) {
      console.log(`🔄 Processing automation: ${automation.name} (${automation.trigger_type})`);
      
      try {
        // Check provider readiness before processing
        const providerCheck = await checkProviderReadiness(supabase, automation);
        if (!providerCheck.canProcess) {
          console.log(`⚠️ Skipping automation ${automation.name}: ${providerCheck.reason}`);
          continue;
        }

        const { processed, enqueued } = await processAutomation(supabase, automation);
        totalProcessed += processed;
        totalEnqueued += enqueued;
      } catch (error) {
        console.error(`❌ Error processing automation ${automation.id}:`, error);
      }
    }

    console.log(`✅ Automation execution complete. Processed: ${totalProcessed}, Enqueued: ${totalEnqueued}`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: totalProcessed,
        enqueued: totalEnqueued,
        timestamp: new Date().toISOString()
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );

  } catch (error) {
    console.error('💥 Automation executor error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

async function checkProviderReadiness(supabase: any, automation: any): Promise<{ canProcess: boolean; reason?: string }> {
  const workflowSteps: WorkflowStep[] = automation.workflow_steps || [];
  const hasEmailSteps = workflowSteps.some(step => step.type === 'email');
  const hasSMSSteps = workflowSteps.some(step => step.type === 'sms');

  // Check company profile for tenant
  const { data: companyProfile, error: profileError } = await supabase
    .from('company_profiles')
    .select('dns_records_verified, feature_flags')
    .eq('tenant_id', automation.tenant_id)
    .single();

  if (profileError && profileError.code !== 'PGRST116') {
    console.error(`❌ Error fetching company profile for tenant ${automation.tenant_id}:`, profileError);
  }

  // Check Email provider (Resend) readiness
  if (hasEmailSteps) {
    const emailReady = companyProfile?.dns_records_verified === true;
    if (!emailReady) {
      return { canProcess: false, reason: 'Email domain not verified' };
    }
  }

  // Check SMS provider (Twilio) readiness
  if (hasSMSSteps) {
    const { data: smsConfig } = await supabase
      .from('company_profiles')
      .select('twilio_account_sid, twilio_auth_token')
      .eq('tenant_id', automation.tenant_id)
      .single();
    
    const smsReady = smsConfig?.twilio_account_sid && smsConfig?.twilio_auth_token;
    if (!smsReady) {
      return { canProcess: false, reason: 'SMS (Twilio) not configured' };
    }
  }

  // Check POS cart events for abandoned_cart trigger
  if (automation.trigger_type === 'abandoned_cart') {
    const posCartEnabled = companyProfile?.feature_flags?.['pos']?.['cart']?.['enabled'] === true;
    if (!posCartEnabled) {
      return { canProcess: false, reason: 'POS cart events not enabled' };
    }
  }

  return { canProcess: true };
}

async function processAutomation(supabase: any, automation: any) {
  let processed = 0;
  let enqueued = 0;

  try {
    // Get workflow steps
    const workflowSteps: WorkflowStep[] = automation.workflow_steps || [];
    if (workflowSteps.length === 0) {
      console.log(`⚠️ No workflow steps defined for automation ${automation.id}`);
      return { processed: 0, enqueued: 0 };
    }

    // Get eligible customers based on trigger type
    const eligibleCustomers = await getEligibleCustomers(supabase, automation);
    console.log(`👥 Found ${eligibleCustomers.length} eligible customers for ${automation.trigger_type}`);

    for (const customer of eligibleCustomers) {
      try {
        // Check if this customer already has an active automation run
        const { data: existingRun } = await supabase
          .from('automation_runs')
          .select('id, status')
          .eq('automation_id', automation.id)
          .eq('customer_id', customer.id)
          .in('status', ['active', 'paused'])
          .limit(1)
          .maybeSingle();

        if (existingRun) {
          console.log(`⏭️ Skipping customer ${customer.email} - already has active run`);
          continue;
        }

        // Create new automation run
        const runId = await createAutomationRun(supabase, automation, customer, workflowSteps.length);
        if (!runId) {
          console.error(`❌ Failed to create automation run for customer ${customer.id}`);
          continue;
        }

        // Schedule the first step
        const firstStep = workflowSteps[0];
        const scheduledAt = calculateScheduledTime(firstStep.delayMin, automation, customer);

        await enqueueMessage(supabase, automation, customer, firstStep, 0, runId, scheduledAt);
        
        // Update run with next scheduled time
        await supabase
          .from('automation_runs')
          .update({ next_step_scheduled_at: scheduledAt.toISOString() })
          .eq('id', runId);

        enqueued++;
        processed++;
        
      } catch (customerError) {
        console.error(`❌ Error processing customer ${customer.id}:`, customerError);
      }
    }

  } catch (error) {
    console.error(`❌ Error in processAutomation for ${automation.id}:`, error);
  }

  return { processed, enqueued };
}

async function createAutomationRun(
  supabase: any,
  automation: any,
  customer: any,
  totalSteps: number
): Promise<string | null> {
  const { data: run, error } = await supabase
    .from('automation_runs')
    .insert({
      automation_id: automation.id,
      customer_id: customer.id,
      tenant_id: automation.tenant_id,
      status: 'active',
      current_step_index: 0,
      total_steps: totalSteps,
      trigger_data: {
        trigger_type: automation.trigger_type,
        triggered_at: new Date().toISOString(),
        customer_email: customer.email,
      },
      metadata: {
        automation_name: automation.name,
        automation_version: automation.version,
      },
    })
    .select('id')
    .single();

  if (error) {
    // Handle unique constraint violation (customer already in automation)
    if (error.code === '23505') {
      console.log(`⏭️ Customer ${customer.id} already has a run for automation ${automation.id}`);
      return null;
    }
    console.error('❌ Failed to create automation run:', error);
    return null;
  }

  console.log(`📝 Created automation run ${run.id} for customer ${customer.email}`);
  return run.id;
}

function calculateScheduledTime(delayMin: number, automation: any, customer: any): Date {
  const baseTime = new Date();
  
  // Handle special trigger types with different base times
  if (automation.trigger_type === 'birthday' && customer.custom_fields?.date_of_birth) {
    const birthday = new Date(customer.custom_fields.date_of_birth);
    const currentYear = new Date().getFullYear();
    const thisYearBirthday = new Date(currentYear, birthday.getMonth(), birthday.getDate());
    
    // If birthday has passed this year, schedule for next year
    if (thisYearBirthday < new Date()) {
      thisYearBirthday.setFullYear(currentYear + 1);
    }
    
    return new Date(thisYearBirthday.getTime() + delayMin * 60 * 1000);
  }

  // Default: schedule relative to now
  return new Date(baseTime.getTime() + delayMin * 60 * 1000);
}

async function getEligibleCustomers(supabase: any, automation: any) {
  const { trigger_type, tenant_id } = automation;
  
  let query = supabase
    .from('crm_customers')
    .select('*')
    .eq('tenant_id', tenant_id);

  // Apply trigger-specific filters using canonical trigger IDs
  switch (trigger_type) {
    case 'loyalty_join':
    case 'loyalty.signup':
      // Customers who joined loyalty program in last 24 hours
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      query = query.gte('created_at', oneDayAgo);
      break;
      
    case 'first_purchase':
    case 'order.completed':
      // Customers with recent first/order purchase
      const purchaseWindow = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      query = query.gte('last_purchase_date', purchaseWindow.split('T')[0]);
      break;
      
    case 'repeat_purchase_90d':
      // Customers who haven't purchased in 90 days
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      query = query.lt('last_purchase_date', ninetyDaysAgo);
      break;
      
    case 'birthday':
    case 'purchase.anniversary':
      // Customers with birthday/anniversary today
      const today = new Date().toISOString().split('T')[0];
      query = query.like('custom_fields->date_of_birth', `%${today.slice(5)}%`);
      break;
      
    case 'abandoned_cart':
      // Customers with abandoned carts
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      query = query.gte('last_cart_abandoned_at', twoHoursAgo);
      break;
      
    case 'review_request':
      // Customers with purchase 5 days ago
      const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      query = query.eq('last_purchase_date', fiveDaysAgo);
      break;

    case 'contact.created':
      // New contacts created in last 24 hours
      const contactOneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      query = query.gte('created_at', contactOneDayAgo);
      break;

    case 'contact.updated':
      // Contacts updated in last 24 hours
      const updateOneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      query = query.gte('updated_at', updateOneDayAgo);
      break;
      
    default:
      console.log(`⚠️ Trigger type ${trigger_type} not implemented yet`);
      return [];
  }

  const { data: customers, error } = await query;
  
  if (error) {
    console.error(`❌ Error fetching customers for ${trigger_type}:`, error);
    return [];
  }
  
  return customers || [];
}

async function enqueueMessage(
  supabase: any,
  automation: any,
  customer: any,
  step: WorkflowStep,
  stepIndex: number,
  runId: string,
  scheduledAt: Date
) {
  const recipient = step.type === 'sms' ? customer.phone : customer.email;
  
  if (!recipient) {
    console.log(`⚠️ No ${step.type} recipient for customer ${customer.email}`);
    return;
  }

  // Personalize message content
  const personalizedContent = personalizeMessage(step.text, customer, automation);
  const personalizedSubject = step.subject ? personalizeMessage(step.subject, customer, automation) : undefined;

  // Insert into outbox with automation_run_id
  const { error: outboxError } = await supabase
    .from('crm_outbox')
    .insert({
      tenant_id: automation.tenant_id,
      automation_id: automation.id,
      automation_run_id: runId,
      customer_id: customer.id,
      message_type: step.type,
      recipient,
      content: personalizedContent,
      subject: personalizedSubject,
      step_index: stepIndex,
      template_data: {
        automation_name: automation.name,
        step_index: stepIndex,
        customer_data: customer,
        step_type: step.type,
        trigger_type: automation.trigger_type
      },
      scheduled_at: scheduledAt.toISOString(),
      status: 'pending',
      priority: 100,
    });

  if (outboxError) {
    console.error(`❌ Failed to enqueue message:`, outboxError);
    throw outboxError;
  }

  // Log the automation step
  await supabase
    .from('crm_automation_logs')
    .insert({
      automation_id: automation.id,
      customer_id: customer.id,
      step_index: stepIndex,
      message_type: step.type,
      status: 'queued',
      scheduled_at: scheduledAt.toISOString(),
      created_at: new Date().toISOString()
    });

  console.log(`✅ Enqueued ${step.type} for ${customer.email} (step ${stepIndex + 1}, scheduled: ${scheduledAt.toISOString()})`);
}

function personalizeMessage(template: string, customer: any, automation: any): string {
  // Convert legacy tags first
  let normalized = convertLegacyTags(template);
  
  // Create merge tag data from customer
  const mergeTagData = createMergeTagDataFromCustomer(customer, {
    company_name: 'Your Garden Center'
  });
  
  // Add automation-specific placeholders to system
  mergeTagData.system = {
    ...mergeTagData.system,
    unsubscribe_url: '#',
    preferences_url: '#',
    current_year: new Date().getFullYear().toString(),
    current_date: new Date().toLocaleDateString()
  };
  
  // Add custom automation data
  mergeTagData.custom = {
    ...mergeTagData.custom,
    points: String(customer.loyalty_points || 0),
    offer: '20% off your next purchase',
    expiry_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(),
    discount_code: 'WELCOME10',
    shop_url: 'https://example.com/shop',
    cart_url: `https://example.com/cart?restore=${customer.id}`,
    review_url: 'https://example.com/review',
    workshop_link: 'https://example.com/workshops'
  };
  
  // Render with unified engine
  return renderMergeTags(normalized, mergeTagData);
}

serve(handler);
