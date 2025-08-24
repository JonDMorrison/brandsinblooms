import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.10';

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
  // Handle CORS preflight requests
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
      JSON.stringify({ error: error.message }),
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
    // Check for SMS configuration (simplified check for now)
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
    // 3. Detect matching customers based on trigger type
    const eligibleCustomers = await getEligibleCustomers(supabase, automation);
    
    console.log(`👥 Found ${eligibleCustomers.length} eligible customers for ${automation.trigger_type}`);

    for (const customer of eligibleCustomers) {
      try {
        // Check if this customer already has active automation runs for this automation
        const { data: existingLogs } = await supabase
          .from('crm_automation_logs')
          .select('id')
          .eq('automation_id', automation.id)
          .eq('customer_id', customer.id)
          .in('status', ['queued', 'processing'])
          .limit(1);

        if (existingLogs && existingLogs.length > 0) {
          console.log(`⏭️ Skipping customer ${customer.email} - already has queued/processing automation`);
          continue;
        }

        // 4. Schedule all workflow steps for this customer
        const workflowSteps: WorkflowStep[] = automation.workflow_steps || [];
        if (workflowSteps.length === 0) {
          console.log(`⚠️ No workflow steps defined for automation ${automation.id}`);
          continue;
        }

        await scheduleAllSteps(supabase, automation, customer, workflowSteps);
        enqueued += workflowSteps.length;
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

async function scheduleAllSteps(supabase: any, automation: any, customer: any, workflowSteps: WorkflowStep[]) {
  const baseTime = new Date();
  
  // Handle special trigger types with different base times
  if (automation.trigger_type === 'birthday' && customer.custom_fields?.date_of_birth) {
    // For birthday triggers, calculate base time relative to birthday
    const birthday = new Date(customer.custom_fields.date_of_birth);
    const currentYear = new Date().getFullYear();
    const thisYearBirthday = new Date(currentYear, birthday.getMonth(), birthday.getDate());
    
    // If birthday has passed this year, schedule for next year
    if (thisYearBirthday < new Date()) {
      thisYearBirthday.setFullYear(currentYear + 1);
    }
    
    baseTime.setTime(thisYearBirthday.getTime());
  }

  // Schedule each step with cumulative delays
  for (let i = 0; i < workflowSteps.length; i++) {
    const step = workflowSteps[i];
    const delayMs = step.delayMin * 60 * 1000;
    const scheduledAt = new Date(baseTime.getTime() + delayMs);
    
    // For negative delays (before birthday), subtract from base time
    if (step.delayMin < 0) {
      scheduledAt.setTime(baseTime.getTime() + delayMs); // delayMin is negative
    }

    await enqueueMessage(supabase, automation, customer, step, i, scheduledAt);
  }
}

async function getEligibleCustomers(supabase: any, automation: any) {
  const { trigger_type, tenant_id, trigger_conditions } = automation;
  
  let query = supabase
    .from('crm_customers')
    .select('*')
    .eq('tenant_id', tenant_id);

  // Apply trigger-specific filters using canonical trigger IDs
  switch (trigger_type) {
    case 'loyalty_join':
      // Customers who joined loyalty program in last 24 hours
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      query = query.gte('created_at', oneDayAgo);
      break;
      
    case 'first_purchase':
      // Customers with recent first purchase
      query = query.not('first_purchase_date', 'is', null);
      const firstPurchaseWindow = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      query = query.gte('first_purchase_date', firstPurchaseWindow);
      break;
      
    case 'repeat_purchase_90d':
      // Customers who haven't purchased in 90 days
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      query = query.lt('last_purchase_date', ninetyDaysAgo);
      break;
      
    case 'birthday':
      // Customers with birthday today
      const today = new Date().toISOString().split('T')[0];
      query = query.like('custom_fields->date_of_birth', `%${today.slice(5)}%`); // Match MM-DD
      break;
      
    case 'abandoned_cart':
      // Customers with abandoned carts (requires POS events)
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      query = query.gte('last_cart_abandoned_at', twoHoursAgo);
      break;
      
    case 'review_request':
      // Customers with purchase 5 days ago
      const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      query = query.eq('last_purchase_date', fiveDaysAgo);
      break;
      
    case 'plant_care_reminder':
    case 'garden_tips_subscription':
    case 'event_registration':
    case 'new_product_drop':
    case 'holiday_promo':
    case 'custom_webhook':
      // These triggers may require manual triggering or specific event handling
      console.log(`⚠️ Trigger type ${trigger_type} requires manual activation or event data`);
      return [];
      
    default:
      // Unknown trigger type
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

async function enqueueMessage(supabase: any, automation: any, customer: any, step: WorkflowStep, stepIndex: number, scheduledAt: Date) {
  const recipient = step.type === 'sms' ? customer.phone : customer.email;
  
  if (!recipient) {
    console.log(`⚠️ No ${step.type} recipient for customer ${customer.email}`);
    return;
  }

  // Personalize message content
  const personalizedContent = personalizeMessage(step.text, customer, automation);
  const personalizedSubject = step.subject ? personalizeMessage(step.subject, customer, automation) : undefined;

  // Insert into outbox
  const { error: outboxError } = await supabase
    .from('crm_outbox')
    .insert({
      tenant_id: automation.tenant_id,
      automation_id: automation.id,
      customer_id: customer.id,
      message_type: step.type,
      recipient,
      content: personalizedContent,
      subject: personalizedSubject,
      template_data: {
        automation_name: automation.name,
        step_index: stepIndex,
        customer_data: customer,
        step_type: step.type,
        trigger_type: automation.trigger_type
      },
      scheduled_at: scheduledAt.toISOString()
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

  console.log(`✅ Enqueued ${step.type} message for ${customer.email} (step ${stepIndex + 1}, scheduled: ${scheduledAt.toISOString()})`);
}

function personalizeMessage(template: string, customer: any, automation: any): string {
  let personalized = template;
  
  // Replace common placeholders
  const replacements = {
    '{{first_name}}': customer.first_name || 'there',
    '{{last_name}}': customer.last_name || '',
    '{{email}}': customer.email || '',
    '{{business}}': 'our garden center', // Could come from tenant settings
    '{{shop_url}}': 'https://example.com/shop', // Could come from tenant settings
    '{{help_links}}': 'Visit our help center at help.example.com',
    
    // Dynamic content placeholders
    '{{category_tips}}': 'Here are some care tips based on your recent purchase...',
    '{{loyalty_rules}}': 'Earn 1 point for every $1 spent. Redeem 100 points for $5 off.',
    '{{points}}': String(customer.loyalty_points || 0),
    '{{offer}}': '20% off your next purchase',
    '{{expiry_date}}': new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(),
    '{{cart_url}}': `https://example.com/cart?restore=${customer.id}`,
    '{{seasonal_tips}}': 'Fall is perfect for planting perennials and preparing your garden for winter.',
    '{{workshop_link}}': 'https://example.com/workshops',
    
    // Discount codes
    '{{discount_code}}': 'WELCOME10',
    'WELCOME5': 'WELCOME5',
    'COMEHOME10': 'COMEHOME10',
    
    // URLs
    '{{review_url}}': 'https://example.com/review'
  };
  
  for (const [placeholder, value] of Object.entries(replacements)) {
    personalized = personalized.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
  }
  
  return personalized;
}

serve(handler);

async function processAutomation(supabase: any, automation: any) {
  let processed = 0;
  let enqueued = 0;

  try {
    // 3. Detect matching customers based on trigger type
    const eligibleCustomers = await getEligibleCustomers(supabase, automation);
    
    console.log(`👥 Found ${eligibleCustomers.length} eligible customers for ${automation.trigger_type}`);

    for (const customer of eligibleCustomers) {
      try {
        // Check if this customer already has active automation runs for this automation
        const { data: existingLogs } = await supabase
          .from('crm_automation_logs')
          .select('id')
          .eq('automation_id', automation.id)
          .eq('customer_id', customer.id)
          .eq('status', 'queued')
          .limit(1);

        if (existingLogs && existingLogs.length > 0) {
          console.log(`⏭️ Skipping customer ${customer.email} - already has queued automation`);
          continue;
        }

        // 4. Enqueue messages for the first step of workflow
        const workflowSteps = automation.workflow_steps || [];
        if (workflowSteps.length === 0) {
          console.log(`⚠️ No workflow steps defined for automation ${automation.id}`);
          continue;
        }

        const firstStep = workflowSteps[0];
        await enqueueMessage(supabase, automation, customer, firstStep, 0);
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

async function getEligibleCustomers(supabase: any, automation: any) {
  const { trigger_type, tenant_id, trigger_conditions } = automation;
  
  let query = supabase
    .from('crm_customers')
    .select('*')
    .eq('tenant_id', tenant_id);

  // Apply trigger-specific filters
  switch (trigger_type) {
    case 'loyalty_join':
      // Customers who joined loyalty program in last 24 hours
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      query = query.gte('created_at', oneDayAgo);
      break;
      
    case 'first_purchase':
      // Customers with recent first purchase
      query = query.not('first_purchase_date', 'is', null);
      const firstPurchaseWindow = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      query = query.gte('first_purchase_date', firstPurchaseWindow);
      break;
      
    case 'repeat_purchase_90d':
      // Customers who haven't purchased in 90 days
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      query = query.lt('last_purchase_date', ninetyDaysAgo);
      break;
      
    case 'birthday':
      // Customers with birthday today
      const today = new Date().toISOString().split('T')[0];
      query = query.like('custom_fields->date_of_birth', `%${today.slice(5)}%`); // Match MM-DD
      break;
      
    case 'review_request':
      // Customers with purchase 5 days ago
      const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      query = query.eq('last_purchase_date', fiveDaysAgo);
      break;
      
    default:
      // For other triggers, return empty array for now
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

async function enqueueMessage(supabase: any, automation: any, customer: any, step: any, stepIndex: number) {
  const recipient = step.type === 'sms' ? customer.phone : customer.email;
  
  if (!recipient) {
    console.log(`⚠️ No ${step.type} recipient for customer ${customer.email}`);
    return;
  }

  // Personalize message content
  const personalizedContent = personalizeMessage(step.text, customer);
  
  // Calculate scheduled time based on delay
  const scheduledAt = new Date(Date.now() + (step.delayMin || 0) * 60 * 1000);

  // Insert into outbox
  const { error: outboxError } = await supabase
    .from('crm_outbox')
    .insert({
      tenant_id: automation.tenant_id,
      automation_id: automation.id,
      customer_id: customer.id,
      message_type: step.type,
      recipient,
      content: personalizedContent,
      subject: step.subject,
      template_data: {
        automation_name: automation.name,
        step_index: stepIndex,
        customer_data: customer
      },
      scheduled_at: scheduledAt.toISOString()
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
      status: 'queued'
    });

  console.log(`✅ Enqueued ${step.type} message for ${customer.email} (scheduled: ${scheduledAt.toISOString()})`);
}

function personalizeMessage(template: string, customer: any): string {
  let personalized = template;
  
  // Replace common placeholders
  const replacements = {
    '{{first_name}}': customer.first_name || 'there',
    '{{last_name}}': customer.last_name || '',
    '{{email}}': customer.email || '',
    '{{business}}': 'our garden center', // Could come from tenant settings
    '{{shop_url}}': 'https://example.com/shop', // Could come from tenant settings
    '{{discount_code}}': 'WELCOME10', // Could be generated
    '{{review_url}}': 'https://example.com/review' // Could be generated
  };
  
  for (const [placeholder, value] of Object.entries(replacements)) {
    personalized = personalized.replace(new RegExp(placeholder, 'g'), value);
  }
  
  return personalized;
}

serve(handler);