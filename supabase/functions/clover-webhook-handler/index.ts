/**
 * clover-webhook-handler
 * 
 * Handles incoming Clover webhook events for real-time automations.
 * Ported from square-webhook-handler with Clover-specific adaptations.
 * 
 * CONFIGURABLE ELEMENTS (finalize after Clover meeting):
 * - Signature algorithm (currently HMAC-SHA256 stub)
 * - Event type names in CLOVER_EVENT_MAP
 * - Loyalty event handling
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.10';
import { logSignatureOK, logSignatureFailed } from '../_shared/webhooks/types.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-clover-signature, x-clover-hmac-sha256',
};

// ============================================
// CONFIGURABLE: Event type mapping
// Update after confirming with Clover
// ============================================
const CLOVER_EVENT_MAP: Record<string, string> = {
  // Clover event type -> internal handler type
  'ORDER_PAID': 'payment.completed',
  'ORDER_CREATED': 'order.created',
  'PAYMENT_PROCESSED': 'payment.completed',
  'CUSTOMER_CREATED': 'customer.created',
  'CUSTOMER_UPDATED': 'customer.updated',
  'REFUND': 'refund.created',
  'REFUND_CREATED': 'refund.created',
  'INVENTORY_UPDATED': 'inventory.updated',
  // Loyalty events - TBD with Clover
  'LOYALTY_JOIN': 'loyalty.join',
};

interface CloverWebhookPayload {
  // Standard Clover webhook fields (configurable)
  eventId?: string;
  event_id?: string;
  merchantId?: string;
  merchant_id?: string;
  type: string;
  eventType?: string;
  timestamp?: string;
  created_at?: string;
  data?: Record<string, any>;
  object?: Record<string, any>;
}

interface WorkflowStep {
  type: 'email' | 'sms';
  delayMin: number;
  subject?: string;
  text: string;
}

// ============================================
// SIGNATURE VERIFICATION STUB
// TODO: Implement Clover's actual algorithm after meeting
// ============================================
async function verifyCloverSignature(body: string, signature: string | null): Promise<boolean> {
  const webhookSecret = Deno.env.get('CLOVER_WEBHOOK_SECRET');
  
  if (!webhookSecret) {
    console.log('[CLOVER-WEBHOOK] No CLOVER_WEBHOOK_SECRET configured - skipping verification (dev mode)');
    return true; // Allow in development until secret is provided
  }
  
  if (!signature) {
    console.log('[CLOVER-WEBHOOK] No signature header provided');
    logSignatureFailed('clover', 'No signature header');
    return false;
  }
  
  try {
    // STUB: HMAC-SHA256 verification (common pattern, verify with Clover)
    // TODO: Confirm actual algorithm and header name with Clover
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(webhookSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
    const expectedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
    
    const isValid = signature === expectedSignature;
    
    if (!isValid) {
      console.log('[CLOVER-WEBHOOK] Signature mismatch');
      logSignatureFailed('clover', 'Signature mismatch');
    }
    
    return isValid;
  } catch (e: any) {
    console.error('[CLOVER-WEBHOOK] Signature verification error:', e.message);
    logSignatureFailed('clover', e.message);
    return false;
  }
}

async function findTenantByMerchantId(supabase: any, merchantId: string) {
  const { data } = await supabase
    .from('clover_connections')
    .select('id, tenant_id, user_id, merchant_id, environment, encrypted_access_token, region')
    .eq('merchant_id', merchantId)
    .eq('status', 'connected')
    .single();
  return data;
}

async function updateLastWebhookReceived(supabase: any, connectionId: string) {
  await supabase
    .from('clover_connections')
    .update({ 
      last_webhook_received_at: new Date().toISOString(),
      webhook_last_error: null,
      webhooks_subscribed: true,
    })
    .eq('id', connectionId);
}

function getCloverApiBase(region: string = 'NA', environment: string = 'production'): string {
  // Clover regional endpoints
  const endpoints: Record<string, Record<string, string>> = {
    NA: { production: 'https://api.clover.com', sandbox: 'https://sandbox.dev.clover.com' },
    EU: { production: 'https://api.eu.clover.com', sandbox: 'https://sandbox.dev.clover.com' },
    LA: { production: 'https://api.la.clover.com', sandbox: 'https://sandbox.dev.clover.com' },
  };
  return endpoints[region]?.[environment] || endpoints.NA.production;
}

// ============================================
// HELPER FUNCTIONS (ported from Square)
// ============================================

function checkPersonaTargeting(customer: any, personaTargeting: any): boolean {
  if (!personaTargeting || Object.keys(personaTargeting).length === 0) return true;
  if (personaTargeting.persona_ids?.length > 0 && (!customer.persona_id || !personaTargeting.persona_ids.includes(customer.persona_id))) return false;
  if (personaTargeting.required_tags?.length > 0 && !personaTargeting.required_tags.every((tag: string) => (customer.tags || []).includes(tag))) return false;
  if (personaTargeting.min_lifetime_value != null && (customer.lifetime_value || 0) < personaTargeting.min_lifetime_value) return false;
  return true;
}

function personalizeMessage(template: string, customer: any, eventData: Record<string, any>): string {
  const replacements: Record<string, string> = {
    '{{first_name}}': customer.first_name || 'there',
    '{{last_name}}': customer.last_name || '',
    '{{email}}': customer.email || '',
    '{{order_amount}}': eventData.order_amount ? `$${eventData.order_amount.toFixed(2)}` : '',
    '{{order_id}}': eventData.order_id || '',
    '{{refund_amount}}': eventData.refund_amount ? `$${eventData.refund_amount.toFixed(2)}` : '',
    '{{refund_reason}}': eventData.refund_reason || '',
  };
  let result = template;
  for (const [k, v] of Object.entries(replacements)) {
    result = result.replace(new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), v);
  }
  return result;
}

// ============================================
// AUTOMATION TRIGGER SYSTEM (identical to Square)
// ============================================

async function fireAutomationTriggers(
  supabase: any, 
  tenantId: string, 
  customerId: string, 
  triggerTypes: string[], 
  eventData: Record<string, any>
) {
  console.log(`[CLOVER-WEBHOOK] Firing automation triggers: ${triggerTypes.join(', ')} for customer ${customerId}`);
  
  const { data: automations } = await supabase
    .from('crm_automations')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .in('trigger_type', triggerTypes);
    
  if (!automations?.length) {
    console.log('[CLOVER-WEBHOOK] No matching automations found');
    return;
  }
  
  const { data: customer } = await supabase
    .from('crm_customers')
    .select('*')
    .eq('id', customerId)
    .single();
    
  if (!customer) {
    console.log('[CLOVER-WEBHOOK] Customer not found');
    return;
  }

  for (const automation of automations) {
    if (!checkPersonaTargeting(customer, automation.persona_targeting)) continue;
    
    const { data: existingLogs } = await supabase
      .from('crm_automation_logs')
      .select('id')
      .eq('automation_id', automation.id)
      .eq('customer_id', customerId)
      .eq('status', 'queued')
      .limit(1);
      
    if (existingLogs?.length) continue;
    
    const workflowSteps: WorkflowStep[] = automation.workflow_steps || [];
    if (!workflowSteps.length) continue;
    
    const baseTime = new Date();
    let enqueued = 0, skipped = 0;
    
    for (let i = 0; i < workflowSteps.length; i++) {
      const step = workflowSteps[i];
      const scheduledAt = new Date(baseTime.getTime() + step.delayMin * 60 * 1000);
      const messageType = step.type || 'email';
      
      if (messageType === 'email' && customer.email_opt_in === false) { skipped++; continue; }
      if (messageType === 'sms' && customer.sms_opt_in !== true) { skipped++; continue; }
      
      const recipient = messageType === 'sms' ? customer.phone : customer.email;
      if (!recipient) { skipped++; continue; }
      
      await supabase.from('crm_outbox').insert({
        tenant_id: tenantId,
        automation_id: automation.id,
        customer_id: customerId,
        message_type: messageType,
        recipient,
        content: personalizeMessage(step.text, customer, eventData),
        subject: step.subject ? personalizeMessage(step.subject, customer, eventData) : undefined,
        template_data: {
          automation_name: automation.name,
          step_index: i,
          customer_data: customer,
          event_data: eventData,
          trigger_type: automation.trigger_type,
          pos_source: 'clover',
        },
        scheduled_at: scheduledAt.toISOString(),
        status: 'queued'
      });
      
      await supabase.from('crm_automation_logs').insert({
        automation_id: automation.id,
        customer_id: customerId,
        step_index: i,
        message_type: messageType,
        status: 'queued',
        scheduled_at: scheduledAt.toISOString()
      });
      
      enqueued++;
    }
    
    await supabase.from('automation_events').insert({
      automation_id: automation.id,
      customer_id: customerId,
      event_type: 'triggered',
      metadata: {
        trigger_types: triggerTypes,
        event_data: eventData,
        steps_scheduled: enqueued,
        steps_skipped: skipped,
        pos_source: 'clover',
      }
    });
    
    console.log(`[CLOVER-WEBHOOK] Automation ${automation.name}: ${enqueued} steps enqueued, ${skipped} skipped`);
  }
}

// ============================================
// EVENT HANDLERS (adapted from Square)
// ============================================

async function processPaymentCompleted(
  supabase: any, 
  tenantId: string, 
  userId: string, 
  paymentData: any, 
  merchantId: string, 
  connection: any
) {
  console.log('[CLOVER-WEBHOOK] Processing payment completed');
  
  // Extract payment details (Clover format - adjust after meeting)
  const amount = (paymentData.amount || paymentData.total || 0) / 100;
  const orderId = paymentData.order?.id || paymentData.orderId || paymentData.id;
  const cloverCustomerId = paymentData.customer?.id || paymentData.customerId;
  
  // Try to get customer email/phone from Clover
  let customerEmail = paymentData.customer?.emailAddresses?.[0]?.emailAddress;
  let customerPhone = paymentData.customer?.phoneNumbers?.[0]?.phoneNumber;
  
  // Upsert to pos_orders
  const { data: posConn } = await supabase
    .from('clover_connections')
    .select('id')
    .eq('merchant_id', merchantId)
    .single();
    
  if (posConn) {
    await supabase.from('pos_orders').upsert({
      tenant_id: tenantId,
      pos_connection_id: posConn.id,
      external_id: orderId,
      order_number: paymentData.order?.number || orderId,
      total_amount: amount,
      currency: paymentData.currency || 'USD',
      customer_external_id: cloverCustomerId,
      external_customer_id: cloverCustomerId,
      order_date: paymentData.createdTime ? new Date(paymentData.createdTime).toISOString() : new Date().toISOString(),
      status: paymentData.result || 'SUCCESS',
      items: paymentData.lineItems?.map((li: any) => ({
        name: li.name,
        quantity: li.unitQty || 1,
        catalog_object_id: li.item?.id,
      })) || [],
      raw_data: paymentData,
    }, { onConflict: 'external_id,pos_connection_id' });
  }

  // Find or create customer
  let customer = null;
  let isFirstPurchase = false;
  const currentDate = new Date().toISOString().split('T')[0];
  
  // Try to match by email first
  if (customerEmail) {
    const { data: existing } = await supabase
      .from('crm_customers')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('email', customerEmail)
      .single();
      
    if (existing) {
      customer = existing;
      isFirstPurchase = !existing.first_purchase_date;
      
      const { data: upserted } = await supabase.from('crm_customers').upsert({
        tenant_id: tenantId,
        user_id: userId,
        email: customerEmail,
        phone: customerPhone || existing.phone,
        first_purchase_date: isFirstPurchase ? currentDate : existing.first_purchase_date,
        last_purchase_date: currentDate,
        total_spent: (existing.total_spent || 0) + amount,
        lifetime_value: (existing.lifetime_value || 0) + amount,
        pos_source: 'clover',
        clover_customer_id: cloverCustomerId || existing.clover_customer_id,
      }, { onConflict: 'tenant_id,email' }).select().single();
      
      customer = upserted;
      console.log(`[CLOVER-WEBHOOK] Matched customer by email: ${customerEmail}`);
    }
  }
  
  // Fallback: match by clover_customer_id
  if (!customer && cloverCustomerId) {
    const { data: existingByClover } = await supabase
      .from('crm_customers')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('clover_customer_id', cloverCustomerId)
      .single();
      
    if (existingByClover) {
      customer = existingByClover;
      isFirstPurchase = !existingByClover.first_purchase_date;
      
      await supabase.from('crm_customers').update({
        first_purchase_date: isFirstPurchase ? currentDate : existingByClover.first_purchase_date,
        last_purchase_date: currentDate,
        total_spent: (existingByClover.total_spent || 0) + amount,
        lifetime_value: (existingByClover.lifetime_value || 0) + amount,
        phone: customerPhone || existingByClover.phone,
        updated_at: new Date().toISOString(),
      }).eq('id', existingByClover.id);
      
      const { data: refreshed } = await supabase
        .from('crm_customers')
        .select('*')
        .eq('id', existingByClover.id)
        .single();
        
      customer = refreshed;
      console.log(`[CLOVER-WEBHOOK] Matched customer by clover_customer_id: ${cloverCustomerId}`);
    }
  }

  // Fire automation triggers
  if (customer) {
    const triggers = ['order.completed', 'review_request'];
    if (isFirstPurchase) triggers.push('first_purchase');
    
    console.log(`[CLOVER-WEBHOOK] Firing triggers: ${triggers.join(', ')}`);
    await fireAutomationTriggers(supabase, tenantId, customer.id, triggers, {
      order_amount: amount,
      order_id: orderId,
      merchant_id: merchantId,
      pos_source: 'clover',
    });
  } else {
    console.log(`[CLOVER-WEBHOOK] No customer match found - email: ${customerEmail}, clover_id: ${cloverCustomerId}`);
  }
  
  return { success: true, isFirstPurchase, customerId: customer?.id };
}

async function processCustomerCreated(
  supabase: any, 
  tenantId: string, 
  userId: string, 
  customerData: any
) {
  console.log('[CLOVER-WEBHOOK] Processing customer created');
  
  const email = customerData.emailAddresses?.[0]?.emailAddress || customerData.email;
  if (!email) return { success: false, reason: 'no_email' };
  
  const phone = customerData.phoneNumbers?.[0]?.phoneNumber || customerData.phone;
  
  await supabase.from('crm_customers').upsert({
    tenant_id: tenantId,
    user_id: userId,
    email,
    phone,
    first_name: customerData.firstName || customerData.first_name,
    last_name: customerData.lastName || customerData.last_name,
    pos_source: 'clover',
    clover_customer_id: customerData.id,
    clover_last_synced_at: new Date().toISOString(),
  }, { onConflict: 'tenant_id,email' });
  
  return { success: true };
}

async function processCustomerUpdated(
  supabase: any, 
  tenantId: string, 
  userId: string, 
  customerData: any
) {
  console.log('[CLOVER-WEBHOOK] Processing customer updated');
  
  const email = customerData.emailAddresses?.[0]?.emailAddress || customerData.email;
  if (!email) return { success: false, reason: 'no_email' };
  
  const phone = customerData.phoneNumbers?.[0]?.phoneNumber || customerData.phone;
  
  await supabase.from('crm_customers').update({
    phone,
    first_name: customerData.firstName || customerData.first_name,
    last_name: customerData.lastName || customerData.last_name,
    clover_last_synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('tenant_id', tenantId).eq('email', email);
  
  return { success: true };
}

async function processRefundCreated(
  supabase: any, 
  tenantId: string, 
  userId: string, 
  refundData: any, 
  merchantId: string
) {
  console.log('[CLOVER-WEBHOOK] Processing refund created');
  
  const refundAmount = (refundData.amount || 0) / 100;
  const orderId = refundData.payment?.order?.id || refundData.orderId;
  
  // Update order status
  const { data: order } = await supabase
    .from('pos_orders')
    .select('id, customer_external_id')
    .eq('external_id', orderId)
    .eq('tenant_id', tenantId)
    .single();
    
  if (!order) return { success: false, error: 'Order not found' };
  
  await supabase.from('pos_orders').update({
    status: 'REFUNDED',
    refund_amount: refundAmount,
    refund_reason: refundData.reason || 'Not specified',
    refunded_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', order.id);
  
  // Update customer lifetime value
  if (order.customer_external_id) {
    const { data: customer } = await supabase
      .from('crm_customers')
      .select('id, lifetime_value, total_spent')
      .eq('tenant_id', tenantId)
      .eq('clover_customer_id', order.customer_external_id)
      .single();
      
    if (customer) {
      await supabase.from('crm_customers').update({
        lifetime_value: Math.max(0, (customer.lifetime_value || 0) - refundAmount),
        total_spent: Math.max(0, (customer.total_spent || 0) - refundAmount),
        updated_at: new Date().toISOString(),
      }).eq('id', customer.id);
      
      await fireAutomationTriggers(supabase, tenantId, customer.id, ['refund.created'], {
        refund_amount: refundAmount,
        refund_reason: refundData.reason,
        original_order_id: orderId,
        merchant_id: merchantId,
        pos_source: 'clover',
      });
    }
  }
  
  return { success: true, refundAmount };
}

async function processInventoryUpdated(
  supabase: any, 
  tenantId: string, 
  inventoryData: any
) {
  console.log('[CLOVER-WEBHOOK] Processing inventory updated');
  
  // Clover inventory structure - adjust after meeting
  const itemId = inventoryData.item?.id || inventoryData.itemId;
  const quantity = inventoryData.stockCount || inventoryData.quantity || 0;
  
  if (!itemId) return { success: false, reason: 'no_item_id' };
  
  const { data: product } = await supabase
    .from('products')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('external_id', itemId)
    .single();
    
  if (product) {
    await supabase.from('products').update({
      inventory_count: quantity,
      track_inventory: true,
      updated_at: new Date().toISOString(),
    }).eq('id', product.id);
    
    return { success: true, productId: product.id, quantity };
  }
  
  return { success: false, reason: 'product_not_found' };
}

// ============================================
// CONFIGURABLE: Loyalty event handler stub
// TODO: Implement after confirming Clover loyalty program
// ============================================
async function processLoyaltyJoin(
  supabase: any, 
  tenantId: string, 
  userId: string, 
  loyaltyData: any, 
  merchantId: string
) {
  console.log('[CLOVER-WEBHOOK] Processing loyalty join (stub)');
  
  // TODO: Implement after Clover meeting confirms loyalty event structure
  // This is a placeholder matching Square's loyalty.account.created handler
  
  const cloverCustomerId = loyaltyData.customer?.id || loyaltyData.customerId;
  if (!cloverCustomerId) return { success: false, error: 'No customer ID' };
  
  const { data: customer } = await supabase
    .from('crm_customers')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('clover_customer_id', cloverCustomerId)
    .single();
    
  if (customer) {
    const updatedTags = customer.tags?.includes('Loyalty Member') 
      ? customer.tags 
      : [...(customer.tags || []), 'Loyalty Member'];
      
    await supabase.from('crm_customers').update({
      tags: updatedTags,
      updated_at: new Date().toISOString(),
    }).eq('id', customer.id);
    
    await fireAutomationTriggers(supabase, tenantId, customer.id, ['loyalty_join'], {
      merchant_id: merchantId,
      pos_source: 'clover',
    });
    
    return { success: true, customerId: customer.id };
  }
  
  return { success: false, reason: 'customer_not_found' };
}

// ============================================
// MAIN HANDLER
// ============================================

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  console.log('📨 Clover webhook received');
  
  try {
    const body = await req.text();
    
    // Get signature from header (adjust header name after Clover meeting)
    const signature = req.headers.get('x-clover-signature') || 
                      req.headers.get('x-clover-hmac-sha256') ||
                      req.headers.get('authorization');
    
    // SIGNATURE VERIFICATION
    const signatureValid = await verifyCloverSignature(body, signature);
    
    if (!signatureValid) {
      console.error('❌ SIGNATURE_FAILED - Invalid Clover webhook signature');
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }), 
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const payload: CloverWebhookPayload = JSON.parse(body);
    
    // Normalize payload fields (Clover may use camelCase or snake_case)
    const eventId = payload.eventId || payload.event_id || 'unknown';
    const merchantId = payload.merchantId || payload.merchant_id || '';
    const eventType = payload.type || payload.eventType || 'unknown';
    const eventData = payload.data || payload.object || {};
    
    // Log successful signature verification
    logSignatureOK('clover', eventId, eventType, merchantId);
    console.log('✅ SIGNATURE_OK | event_id:', eventId, '| event_type:', eventType, '| merchant_id:', merchantId);
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '', 
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // Find tenant by merchant ID
    const connection = await findTenantByMerchantId(supabase, merchantId);
    
    if (!connection) {
      console.warn('⚠️ Merchant not connected:', merchantId);
      return new Response(
        JSON.stringify({ error: 'Merchant not connected' }), 
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Update last webhook received timestamp
    await updateLastWebhookReceived(supabase, connection.id);

    // Map Clover event type to internal handler
    const internalType = CLOVER_EVENT_MAP[eventType] || eventType;
    let result: any = { success: true, message: `Event ${eventType} not handled` };
    
    switch (internalType) {
      case 'payment.completed':
        result = await processPaymentCompleted(
          supabase, connection.tenant_id, connection.user_id, 
          eventData, merchantId, connection
        );
        break;
        
      case 'customer.created':
        result = await processCustomerCreated(
          supabase, connection.tenant_id, connection.user_id, eventData
        );
        break;
        
      case 'customer.updated':
        result = await processCustomerUpdated(
          supabase, connection.tenant_id, connection.user_id, eventData
        );
        break;
        
      case 'refund.created':
        result = await processRefundCreated(
          supabase, connection.tenant_id, connection.user_id, 
          eventData, merchantId
        );
        break;
        
      case 'inventory.updated':
        result = await processInventoryCountUpdated(
          supabase, connection.tenant_id, eventData
        );
        break;
        
      case 'loyalty.join':
        result = await processLoyaltyJoin(
          supabase, connection.tenant_id, connection.user_id, 
          eventData, merchantId
        );
        break;
        
      default:
        console.log(`[CLOVER-WEBHOOK] Unhandled event type: ${eventType} (internal: ${internalType})`);
    }
    
    console.log('✅ Result:', JSON.stringify(result));
    return new Response(
      JSON.stringify({ success: true, result }), 
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
    
  } catch (error: any) {
    console.error('💥 Error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }), 
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
};

// Alias for inventory handler
async function processInventoryCountUpdated(supabase: any, tenantId: string, inventoryData: any) {
  return processInventoryUpdated(supabase, tenantId, inventoryData);
}

serve(handler);
