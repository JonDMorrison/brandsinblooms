import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.10';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, traceparent, tracestate, x-square-signature',
};

interface SquareWebhookPayload {
  merchant_id: string;
  type: string;
  event_id: string;
  created_at: string;
  data: {
    type: string;
    id: string;
    object: Record<string, any>;
  };
}

interface WorkflowStep {
  type: 'email' | 'sms';
  delayMin: number;
  subject?: string;
  text: string;
}

// Verify Square webhook signature using HMAC-SHA256
async function verifySquareSignature(body: string, signature: string | null, notificationUrl: string): Promise<boolean> {
  const webhookSecret = Deno.env.get('SQUARE_WEBHOOK_SIGNATURE_KEY');
  
  if (!webhookSecret) {
    console.log('⚠️ SQUARE_WEBHOOK_SIGNATURE_KEY not configured, skipping signature verification');
    return true;
  }
  
  if (!signature) {
    console.error('❌ No signature provided in webhook request');
    return false;
  }
  
  try {
    // Square signature is: base64(HMAC-SHA256(notificationUrl + body))
    const stringToSign = notificationUrl + body;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(webhookSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(stringToSign));
    const computedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
    
    const isValid = signature === computedSignature;
    if (!isValid) {
      console.error('❌ Signature mismatch. Expected:', computedSignature, 'Received:', signature);
    }
    return isValid;
  } catch (error) {
    console.error('❌ Error verifying signature:', error);
    return false;
  }
}

// Find tenant from merchant_id
async function findTenantByMerchantId(supabase: any, merchantId: string) {
  const { data: connection, error } = await supabase
    .from('square_connections')
    .select('tenant_id, user_id, merchant_id')
    .eq('merchant_id', merchantId)
    .eq('status', 'connected')
    .single();
  
  if (error) {
    console.error('❌ Error finding tenant for merchant:', merchantId, error);
    return null;
  }
  
  return connection;
}

// Process payment.completed event
async function processPaymentCompleted(supabase: any, tenantId: string, userId: string, payment: any, merchantId: string) {
  console.log('💳 Processing payment.completed event for merchant:', merchantId);
  
  const paymentData = payment.payment || payment;
  const customerId = paymentData.customer_id;
  const amountMoney = paymentData.amount_money || {};
  const amountCents = amountMoney.amount || 0;
  const amount = amountCents / 100;
  const currency = amountMoney.currency || 'USD';
  const receiptEmail = paymentData.receipt_email || paymentData.buyer_email_address;
  const receiptPhone = paymentData.buyer_phone_number;
  
  console.log('📦 Payment details:', { customerId, amount, currency, receiptEmail, receiptPhone });
  
  // 1. Upsert order to pos_orders
  const { data: posConnection } = await supabase
    .from('square_connections')
    .select('id')
    .eq('merchant_id', merchantId)
    .single();
  
  if (posConnection) {
    const { error: orderError } = await supabase
      .from('pos_orders')
      .upsert({
        tenant_id: tenantId,
        pos_connection_id: posConnection.id,
        external_id: paymentData.id,
        order_number: paymentData.receipt_number || paymentData.id,
        total_amount: amount,
        currency: currency,
        customer_external_id: customerId,
        order_date: paymentData.created_at || new Date().toISOString(),
        status: paymentData.status || 'COMPLETED',
        raw_data: paymentData
      }, { onConflict: 'external_id,pos_connection_id' });
    
    if (orderError) {
      console.error('❌ Error upserting order:', orderError);
    } else {
      console.log('✅ Order upserted successfully');
    }
  }
  
  // 2. Find or create customer in crm_customers
  let customer = null;
  let isFirstPurchase = false;
  
  if (receiptEmail) {
    const { data: existingCustomer } = await supabase
      .from('crm_customers')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('email', receiptEmail)
      .single();
    
    isFirstPurchase = !existingCustomer?.first_purchase_date;
    const currentDate = new Date().toISOString().split('T')[0];
    
    const { data: upsertedCustomer, error: customerError } = await supabase
      .from('crm_customers')
      .upsert({
        tenant_id: tenantId,
        user_id: userId,
        email: receiptEmail,
        phone: receiptPhone || existingCustomer?.phone,
        first_purchase_date: isFirstPurchase ? currentDate : existingCustomer?.first_purchase_date,
        last_purchase_date: currentDate,
        total_spent: (existingCustomer?.total_spent || 0) + amount,
        lifetime_value: (existingCustomer?.lifetime_value || 0) + amount,
        pos_source: 'square'
      }, { onConflict: 'tenant_id,email' })
      .select()
      .single();
    
    if (customerError) {
      console.error('❌ Error upserting customer:', customerError);
    } else {
      customer = upsertedCustomer;
      console.log('✅ Customer upserted:', customer.email, 'First purchase:', isFirstPurchase);
    }
  }
  
  // 3. Fire automation triggers
  if (customer) {
    const triggerTypes = ['order.completed'];
    
    if (isFirstPurchase) {
      triggerTypes.push('first_purchase');
      console.log('🎉 First purchase detected, adding first_purchase trigger');
    }
    
    await fireAutomationTriggers(supabase, tenantId, customer.id, triggerTypes, {
      order_amount: amount,
      order_id: paymentData.id,
      merchant_id: merchantId
    });
  }
  
  return { success: true, isFirstPurchase, customerId: customer?.id };
}

// Process customer.created event
async function processCustomerCreated(supabase: any, tenantId: string, userId: string, customerData: any) {
  console.log('👤 Processing customer.created event');
  
  const customer = customerData.customer || customerData;
  const email = customer.email_address;
  const phone = customer.phone_number;
  const firstName = customer.given_name;
  const lastName = customer.family_name;
  
  if (!email) {
    console.log('⚠️ No email in customer data, skipping');
    return { success: false, reason: 'no_email' };
  }
  
  const { error } = await supabase
    .from('crm_customers')
    .upsert({
      tenant_id: tenantId,
      user_id: userId,
      email: email,
      phone: phone,
      first_name: firstName,
      last_name: lastName,
      pos_source: 'square'
    }, { onConflict: 'tenant_id,email' });
  
  if (error) {
    console.error('❌ Error creating customer:', error);
    return { success: false, error };
  }
  
  console.log('✅ Customer created:', email);
  return { success: true };
}

// Process customer.updated event
async function processCustomerUpdated(supabase: any, tenantId: string, userId: string, customerData: any) {
  console.log('👤 Processing customer.updated event');
  
  const customer = customerData.customer || customerData;
  const email = customer.email_address;
  const phone = customer.phone_number;
  const firstName = customer.given_name;
  const lastName = customer.family_name;
  
  if (!email) {
    console.log('⚠️ No email in customer data, skipping');
    return { success: false, reason: 'no_email' };
  }
  
  const { error } = await supabase
    .from('crm_customers')
    .update({
      phone: phone,
      first_name: firstName,
      last_name: lastName,
      updated_at: new Date().toISOString()
    })
    .eq('tenant_id', tenantId)
    .eq('email', email);
  
  if (error) {
    console.error('❌ Error updating customer:', error);
    return { success: false, error };
  }
  
  console.log('✅ Customer updated:', email);
  return { success: true };
}

// Fire automation triggers
async function fireAutomationTriggers(
  supabase: any, 
  tenantId: string, 
  customerId: string, 
  triggerTypes: string[],
  eventData: Record<string, any>
) {
  console.log('🔥 Firing automation triggers:', triggerTypes, 'for customer:', customerId);
  
  // Find active automations matching triggers
  const { data: automations, error: automationsError } = await supabase
    .from('crm_automations')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .in('trigger_type', triggerTypes);
  
  if (automationsError) {
    console.error('❌ Error fetching automations:', automationsError);
    return;
  }
  
  if (!automations || automations.length === 0) {
    console.log('ℹ️ No active automations found for triggers:', triggerTypes);
    return;
  }
  
  console.log(`📋 Found ${automations.length} active automations for triggers`);
  
  // Get customer data
  const { data: customer } = await supabase
    .from('crm_customers')
    .select('*')
    .eq('id', customerId)
    .single();
  
  if (!customer) {
    console.error('❌ Customer not found:', customerId);
    return;
  }
  
  for (const automation of automations) {
    try {
      console.log(`🤖 Processing automation: ${automation.name} (${automation.trigger_type})`);
      
      // Check if customer already has queued messages for this automation
      const { data: existingLogs } = await supabase
        .from('crm_automation_logs')
        .select('id')
        .eq('automation_id', automation.id)
        .eq('customer_id', customerId)
        .eq('status', 'queued')
        .limit(1);
      
      if (existingLogs && existingLogs.length > 0) {
        console.log(`⏭️ Skipping automation ${automation.name} - customer already has queued messages`);
        continue;
      }
      
      // Schedule workflow steps
      const workflowSteps: WorkflowStep[] = automation.workflow_steps || [];
      if (workflowSteps.length === 0) {
        console.log(`⚠️ No workflow steps for automation: ${automation.name}`);
        continue;
      }
      
      const baseTime = new Date();
      
      for (let i = 0; i < workflowSteps.length; i++) {
        const step = workflowSteps[i];
        const delayMs = step.delayMin * 60 * 1000;
        const scheduledAt = new Date(baseTime.getTime() + delayMs);
        
        const recipient = step.type === 'sms' ? customer.phone : customer.email;
        
        if (!recipient) {
          console.log(`⚠️ No ${step.type} recipient for customer ${customer.email}`);
          continue;
        }
        
        // Personalize message
        const personalizedContent = personalizeMessage(step.text, customer, eventData);
        const personalizedSubject = step.subject ? personalizeMessage(step.subject, customer, eventData) : undefined;
        
        // Insert into outbox
        const { error: outboxError } = await supabase
          .from('crm_outbox')
          .insert({
            tenant_id: tenantId,
            automation_id: automation.id,
            customer_id: customerId,
            message_type: step.type,
            recipient,
            content: personalizedContent,
            subject: personalizedSubject,
            template_data: {
              automation_name: automation.name,
              step_index: i,
              customer_data: customer,
              event_data: eventData,
              trigger_type: automation.trigger_type
            },
            scheduled_at: scheduledAt.toISOString()
          });
        
        if (outboxError) {
          console.error('❌ Failed to enqueue message:', outboxError);
          continue;
        }
        
        // Log the automation step
        await supabase
          .from('crm_automation_logs')
          .insert({
            automation_id: automation.id,
            customer_id: customerId,
            step_index: i,
            message_type: step.type,
            status: 'queued',
            scheduled_at: scheduledAt.toISOString()
          });
        
        console.log(`✅ Enqueued ${step.type} message for ${customer.email} (step ${i + 1}, scheduled: ${scheduledAt.toISOString()})`);
      }
      
      // Log automation event
      await supabase
        .from('automation_events')
        .insert({
          automation_id: automation.id,
          customer_id: customerId,
          event_type: 'triggered',
          metadata: {
            trigger_types: triggerTypes,
            event_data: eventData,
            steps_scheduled: workflowSteps.length
          }
        });
      
    } catch (error) {
      console.error(`❌ Error processing automation ${automation.id}:`, error);
    }
  }
}

// Personalize message with customer data
function personalizeMessage(template: string, customer: any, eventData: Record<string, any>): string {
  let personalized = template;
  
  const replacements: Record<string, string> = {
    '{{first_name}}': customer.first_name || 'there',
    '{{last_name}}': customer.last_name || '',
    '{{email}}': customer.email || '',
    '{{order_amount}}': eventData.order_amount ? `$${eventData.order_amount.toFixed(2)}` : '',
    '{{order_id}}': eventData.order_id || '',
  };
  
  for (const [placeholder, value] of Object.entries(replacements)) {
    personalized = personalized.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
  }
  
  return personalized;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('📨 Square webhook received');
  
  try {
    const body = await req.text();
    const signature = req.headers.get('x-square-hmacsha256-signature');
    const notificationUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/square-webhook-handler`;
    
    // Verify signature
    const isValid = await verifySquareSignature(body, signature, notificationUrl);
    if (!isValid) {
      console.error('❌ Invalid webhook signature');
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
    
    const payload: SquareWebhookPayload = JSON.parse(body);
    console.log('📦 Webhook payload:', JSON.stringify({
      merchant_id: payload.merchant_id,
      type: payload.type,
      event_id: payload.event_id
    }));
    
    // Create Supabase client with service role
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // Find tenant by merchant_id
    const connection = await findTenantByMerchantId(supabase, payload.merchant_id);
    if (!connection) {
      console.error('❌ No connected tenant found for merchant:', payload.merchant_id);
      return new Response(
        JSON.stringify({ error: 'Merchant not connected', merchant_id: payload.merchant_id }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
    
    console.log('✅ Found tenant:', connection.tenant_id, 'for merchant:', payload.merchant_id);
    
    // Route event to appropriate handler
    let result = { success: false, message: 'Unknown event type' };
    
    switch (payload.type) {
      case 'payment.completed':
        result = await processPaymentCompleted(
          supabase, 
          connection.tenant_id, 
          connection.user_id, 
          payload.data.object,
          payload.merchant_id
        );
        break;
        
      case 'customer.created':
        result = await processCustomerCreated(
          supabase, 
          connection.tenant_id, 
          connection.user_id, 
          payload.data.object
        );
        break;
        
      case 'customer.updated':
        result = await processCustomerUpdated(
          supabase, 
          connection.tenant_id, 
          connection.user_id, 
          payload.data.object
        );
        break;
        
      default:
        console.log('ℹ️ Unhandled event type:', payload.type);
        result = { success: true, message: `Event type ${payload.type} not handled` };
    }
    
    console.log('✅ Webhook processing complete:', result);
    
    return new Response(
      JSON.stringify({ success: true, result }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
    
  } catch (error) {
    console.error('💥 Webhook handler error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
};

serve(handler);
