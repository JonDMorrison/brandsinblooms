import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AutomationRule {
  id: string;
  name: string;
  trigger_type: string;
  trigger_conditions: any;
  workflow_steps: any[];
  tenant_id: string;
}

interface Customer {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  created_at: string;
  last_purchase_date: string;
  tenant_id: string;
}

interface WorkflowStep {
  id: string;
  type: 'email' | 'sms';
  delay: number;
  subject?: string;
  content: string;
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Starting automation runner...');

    // Get all active automations
    const { data: automations, error: automationsError } = await supabase
      .from('crm_automations')
      .select('*')
      .eq('is_active', true)
      .in('trigger_type', ['welcome', 'segment_joined', 'purchase_delay']);

    if (automationsError) {
      throw automationsError;
    }

    console.log(`Found ${automations?.length || 0} active automations`);

    let totalProcessed = 0;
    let totalSent = 0;
    let errors: string[] = [];

    for (const automation of automations || []) {
      try {
        console.log(`Processing automation: ${automation.name} (${automation.trigger_type})`);
        
        const { processed, sent, stepErrors } = await processAutomation(automation);
        totalProcessed += processed;
        totalSent += sent;
        errors.push(...stepErrors);
        
        console.log(`Automation ${automation.name}: ${processed} customers processed, ${sent} messages sent`);
      } catch (error) {
        console.error(`Error processing automation ${automation.name}:`, error);
        errors.push(`Automation ${automation.name}: ${error.message}`);
      }
    }

    console.log(`✅ Automation runner complete. Total: ${totalProcessed} processed, ${totalSent} sent`);

    return new Response(JSON.stringify({
      success: true,
      automations_processed: automations?.length || 0,
      customers_processed: totalProcessed,
      messages_sent: totalSent,
      errors: errors
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (error) {
    console.error('Error in automation runner:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
};

async function processAutomation(automation: AutomationRule) {
  const qualifyingCustomers = await getQualifyingCustomers(automation);
  console.log(`Found ${qualifyingCustomers.length} qualifying customers for ${automation.name}`);
  
  let processed = 0;
  let sent = 0;
  let stepErrors: string[] = [];

  for (const customer of qualifyingCustomers) {
    try {
      const steps = await getCustomerSteps(automation, customer);
      
      for (const { step, stepIndex } of steps) {
        try {
          // Check if this step was already sent
          const { data: existingLog } = await supabase
            .from('crm_automation_logs')
            .select('id')
            .eq('automation_id', automation.id)
            .eq('customer_id', customer.id)
            .eq('step_index', stepIndex)
            .eq('status', 'sent')
            .single();

          if (existingLog) {
            console.log(`Step ${stepIndex} already sent to customer ${customer.email}`);
            continue;
          }

          // Create log entry
          const { data: logEntry, error: logError } = await supabase
            .from('crm_automation_logs')
            .insert({
              automation_id: automation.id,
              customer_id: customer.id,
              step_index: stepIndex,
              message_type: step.type,
              status: 'queued'
            })
            .select()
            .single();

          if (logError) {
            throw logError;
          }

          // Send the message
          if (step.type === 'email') {
            await sendAutomationEmail(customer, step, automation);
          } else if (step.type === 'sms') {
            await sendAutomationSms(customer, step, automation);
          }

          // Update log to sent
          await supabase
            .from('crm_automation_logs')
            .update({ 
              status: 'sent', 
              sent_at: new Date().toISOString() 
            })
            .eq('id', logEntry.id);

          sent++;
          console.log(`✅ Sent ${step.type} step ${stepIndex} to ${customer.email}`);

        } catch (error) {
          console.error(`Error sending step ${stepIndex} to ${customer.email}:`, error);
          stepErrors.push(`Step ${stepIndex} to ${customer.email}: ${error.message}`);
          
          // Update log to failed
          await supabase
            .from('crm_automation_logs')
            .update({ 
              status: 'failed', 
              error_message: error.message 
            })
            .eq('automation_id', automation.id)
            .eq('customer_id', customer.id)
            .eq('step_index', stepIndex);
        }
      }
      processed++;
    } catch (error) {
      console.error(`Error processing customer ${customer.email}:`, error);
      stepErrors.push(`Customer ${customer.email}: ${error.message}`);
    }
  }

  return { processed, sent, stepErrors };
}

async function getQualifyingCustomers(automation: AutomationRule): Promise<Customer[]> {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  let query = supabase
    .from('crm_customers')
    .select('*')
    .eq('tenant_id', automation.tenant_id);

  switch (automation.trigger_type) {
    case 'welcome':
      // Customers who joined yesterday (1 day ago)
      query = query
        .gte('created_at', yesterday.toISOString().split('T')[0])
        .lt('created_at', today.toISOString().split('T')[0]);
      break;

    case 'segment_joined':
      // For now, get all customers in the target segment
      // In a real implementation, you'd track when customers joined segments
      if (automation.trigger_conditions?.segment_id) {
        query = query.eq('segment_id', automation.trigger_conditions.segment_id);
      }
      break;

    case 'purchase_delay':
      // Customers whose last purchase was X days ago
      const delayDays = automation.trigger_conditions?.delay_days || 7;
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() - delayDays);
      
      query = query
        .gte('last_purchase_date', targetDate.toISOString().split('T')[0])
        .lt('last_purchase_date', new Date(targetDate.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
      break;

    default:
      return [];
  }

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching qualifying customers:', error);
    return [];
  }

  return data || [];
}

async function getCustomerSteps(automation: AutomationRule, customer: Customer) {
  const steps: { step: WorkflowStep; stepIndex: number }[] = [];
  const customerDate = new Date(customer.created_at);
  const today = new Date();
  const daysSinceCreated = Math.floor((today.getTime() - customerDate.getTime()) / (1000 * 60 * 60 * 24));

  if (!automation.workflow_steps || !Array.isArray(automation.workflow_steps)) {
    return steps;
  }

  automation.workflow_steps.forEach((step: WorkflowStep, index: number) => {
    // Check if enough time has passed for this step
    if (daysSinceCreated >= step.delay) {
      steps.push({ step, stepIndex: index });
    }
  });

  return steps;
}

async function sendAutomationEmail(customer: Customer, step: WorkflowStep, automation: AutomationRule) {
  // Create a temporary email campaign for this automation step
  const { data: campaign, error: campaignError } = await supabase
    .from('crm_campaigns')
    .insert({
      tenant_id: automation.tenant_id,
      name: `${automation.name} - Step ${step.id}`,
      subject_line: step.subject || `Message from ${automation.name}`,
      content: personalizeContent(step.content, customer),
      status: 'sent'
    })
    .select()
    .single();

  if (campaignError) {
    throw campaignError;
  }

  // Call the existing email sending function
  const response = await supabase.functions.invoke('send-email-campaign', {
    body: {
      campaignId: campaign.id,
      customerEmails: [customer.email]
    }
  });

  if (response.error) {
    throw new Error(`Email send failed: ${response.error.message}`);
  }
}

async function sendAutomationSms(customer: Customer, step: WorkflowStep, automation: AutomationRule) {
  // Create a temporary SMS campaign for this automation step
  const { data: campaign, error: campaignError } = await supabase
    .from('crm_sms_campaigns')
    .insert({
      tenant_id: automation.tenant_id,
      name: `${automation.name} - Step ${step.id}`,
      message: personalizeContent(step.content, customer),
      status: 'sent'
    })
    .select()
    .single();

  if (campaignError) {
    throw campaignError;
  }

  // Call the existing SMS sending function
  const response = await supabase.functions.invoke('send-sms-campaign', {
    body: {
      campaignId: campaign.id,
      customerIds: [customer.id]
    }
  });

  if (response.error) {
    throw new Error(`SMS send failed: ${response.error.message}`);
  }
}

function personalizeContent(content: string, customer: Customer): string {
  return content
    .replace(/\{first_name\}/g, customer.first_name || 'there')
    .replace(/\{last_name\}/g, customer.last_name || '')
    .replace(/\{email\}/g, customer.email || '')
    .replace(/\{name\}/g, `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'there');
}

serve(handler);