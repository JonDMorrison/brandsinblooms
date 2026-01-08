import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.10';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-square-signature',
};

interface SquareWebhookPayload {
  merchant_id: string;
  type: string;
  event_id: string;
  created_at: string;
  data: { type: string; id: string; object: Record<string, any>; };
}

interface WorkflowStep {
  type: 'email' | 'sms';
  delayMin: number;
  subject?: string;
  text: string;
}

async function verifySquareSignature(body: string, signature: string | null, notificationUrl: string): Promise<boolean> {
  const webhookSecret = Deno.env.get('SQUARE_WEBHOOK_SIGNATURE_KEY');
  if (!webhookSecret) return true;
  if (!signature) return false;
  try {
    const stringToSign = notificationUrl + body;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', encoder.encode(webhookSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(stringToSign));
    return signature === btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
  } catch { return false; }
}

async function findTenantByMerchantId(supabase: any, merchantId: string) {
  const { data } = await supabase.from('square_connections').select('tenant_id, user_id, merchant_id, environment, encrypted_access_token').eq('merchant_id', merchantId).eq('status', 'connected').single();
  return data;
}

async function fetchSquareOrder(orderId: string, accessToken: string, environment: string): Promise<any | null> {
  const baseUrl = environment === 'sandbox' ? `https://connect.squareupsandbox.com/v2/orders/${orderId}` : `https://connect.squareup.com/v2/orders/${orderId}`;
  try {
    const response = await fetch(baseUrl, { headers: { 'Authorization': `Bearer ${accessToken}`, 'Square-Version': '2024-01-18' } });
    const data = await response.json();
    return response.ok ? data.order : null;
  } catch { return null; }
}

async function fetchSquareCustomerGroups(accessToken: string, environment: string): Promise<Map<string, string>> {
  const groupMap = new Map<string, string>();
  const baseUrl = environment === 'sandbox' ? 'https://connect.squareupsandbox.com/v2/customers/groups' : 'https://connect.squareup.com/v2/customers/groups';
  try {
    const response = await fetch(baseUrl, { headers: { 'Authorization': `Bearer ${accessToken}`, 'Square-Version': '2024-01-18' } });
    const data = await response.json();
    if (response.ok && data.groups) data.groups.forEach((g: any) => groupMap.set(g.id, g.name));
  } catch {}
  return groupMap;
}

function extractProductNames(order: any): string[] {
  return (order?.line_items || []).map((item: any) => item.name || item.variation_name).filter(Boolean);
}

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
  for (const [k, v] of Object.entries(replacements)) result = result.replace(new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), v);
  return result;
}

async function fireAutomationTriggers(supabase: any, tenantId: string, customerId: string, triggerTypes: string[], eventData: Record<string, any>) {
  const { data: automations } = await supabase.from('crm_automations').select('*').eq('tenant_id', tenantId).eq('is_active', true).in('trigger_type', triggerTypes);
  if (!automations?.length) return;
  const { data: customer } = await supabase.from('crm_customers').select('*').eq('id', customerId).single();
  if (!customer) return;

  for (const automation of automations) {
    if (!checkPersonaTargeting(customer, automation.persona_targeting)) continue;
    const { data: existingLogs } = await supabase.from('crm_automation_logs').select('id').eq('automation_id', automation.id).eq('customer_id', customerId).eq('status', 'queued').limit(1);
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
        tenant_id: tenantId, automation_id: automation.id, customer_id: customerId,
        message_type: messageType, recipient, content: personalizeMessage(step.text, customer, eventData),
        subject: step.subject ? personalizeMessage(step.subject, customer, eventData) : undefined,
        template_data: { automation_name: automation.name, step_index: i, customer_data: customer, event_data: eventData, trigger_type: automation.trigger_type },
        scheduled_at: scheduledAt.toISOString()
      });
      await supabase.from('crm_automation_logs').insert({ automation_id: automation.id, customer_id: customerId, step_index: i, message_type: messageType, status: 'queued', scheduled_at: scheduledAt.toISOString() });
      enqueued++;
    }
    await supabase.from('automation_events').insert({ automation_id: automation.id, customer_id: customerId, event_type: 'triggered', metadata: { trigger_types: triggerTypes, event_data: eventData, steps_scheduled: enqueued, steps_skipped: skipped } });
  }
}

async function processPaymentCompleted(supabase: any, tenantId: string, userId: string, payment: any, merchantId: string, connection: any) {
  const paymentData = payment.payment || payment;
  const amount = (paymentData.amount_money?.amount || 0) / 100;
  const receiptEmail = paymentData.receipt_email || paymentData.buyer_email_address;
  const receiptPhone = paymentData.buyer_phone_number;
  const squareCustomerId = paymentData.customer_id;
  let productNames: string[] = [], orderData: any = null;

  if (paymentData.order_id && connection?.encrypted_access_token) {
    try {
      const { decryptToken } = await import('../_shared/crypto/tokens.ts');
      orderData = await fetchSquareOrder(paymentData.order_id, await decryptToken(connection.encrypted_access_token), connection.environment || 'production');
      productNames = extractProductNames(orderData);
    } catch {}
  }

  const { data: posConn } = await supabase.from('square_connections').select('id').eq('merchant_id', merchantId).single();
  if (posConn) {
    await supabase.from('pos_orders').upsert({
      tenant_id: tenantId, pos_connection_id: posConn.id, external_id: paymentData.id,
      order_number: paymentData.receipt_number || paymentData.id, total_amount: amount,
      currency: paymentData.amount_money?.currency || 'USD', customer_external_id: squareCustomerId,
      external_customer_id: squareCustomerId,
      order_date: paymentData.created_at || new Date().toISOString(), status: paymentData.status || 'COMPLETED',
      items: orderData?.line_items?.map((li: any) => ({ name: li.name || li.variation_name, quantity: li.quantity, catalog_object_id: li.catalog_object_id })) || [],
      raw_data: { payment: paymentData, order: orderData }
    }, { onConflict: 'external_id,pos_connection_id' });
  }

  let customer = null, isFirstPurchase = false;
  let matchedBy: 'email' | 'square_customer_id' | null = null;
  const currentDate = new Date().toISOString().split('T')[0];
  
  // Try to match by email first
  if (receiptEmail) {
    const { data: existing } = await supabase.from('crm_customers').select('*').eq('tenant_id', tenantId).eq('email', receiptEmail).single();
    if (existing) {
      customer = existing;
      matchedBy = 'email';
      isFirstPurchase = !existing.first_purchase_date;
      const mergedTags = [...new Set([...(existing.product_tags || []), ...productNames])];
      const { data: upserted } = await supabase.from('crm_customers').upsert({
        tenant_id: tenantId, user_id: userId, email: receiptEmail, phone: receiptPhone || existing.phone,
        first_purchase_date: isFirstPurchase ? currentDate : existing.first_purchase_date, last_purchase_date: currentDate,
        total_spent: (existing.total_spent || 0) + amount, lifetime_value: (existing.lifetime_value || 0) + amount,
        product_tags: mergedTags.length > 0 ? mergedTags : null, pos_source: 'square',
        square_customer_id: squareCustomerId || existing.square_customer_id
      }, { onConflict: 'tenant_id,email' }).select().single();
      customer = upserted;
      console.log(`[WEBHOOK] Matched customer by email: ${receiptEmail}`);
    }
  }
  
  // Fallback: match by square_customer_id if no email match
  if (!customer && squareCustomerId) {
    const { data: existingBySquareId } = await supabase.from('crm_customers').select('*').eq('tenant_id', tenantId).eq('square_customer_id', squareCustomerId).single();
    if (existingBySquareId) {
      customer = existingBySquareId;
      matchedBy = 'square_customer_id';
      isFirstPurchase = !existingBySquareId.first_purchase_date;
      const mergedTags = [...new Set([...(existingBySquareId.product_tags || []), ...productNames])];
      
      await supabase.from('crm_customers').update({
        first_purchase_date: isFirstPurchase ? currentDate : existingBySquareId.first_purchase_date,
        last_purchase_date: currentDate,
        total_spent: (existingBySquareId.total_spent || 0) + amount,
        lifetime_value: (existingBySquareId.lifetime_value || 0) + amount,
        product_tags: mergedTags.length > 0 ? mergedTags : null,
        phone: receiptPhone || existingBySquareId.phone,
        updated_at: new Date().toISOString()
      }).eq('id', existingBySquareId.id);
      
      // Refresh customer data
      const { data: refreshed } = await supabase.from('crm_customers').select('*').eq('id', existingBySquareId.id).single();
      customer = refreshed;
      console.log(`[WEBHOOK] Matched customer by square_customer_id: ${squareCustomerId}`);
    }
  }

  if (customer) {
    const triggers = ['order.completed', 'review_request'];
    if (isFirstPurchase) triggers.push('first_purchase');
    console.log(`[WEBHOOK] Firing triggers for customer ${customer.id} (matched_by=${matchedBy}): ${triggers.join(', ')}`);
    await fireAutomationTriggers(supabase, tenantId, customer.id, triggers, { order_amount: amount, order_id: paymentData.id, merchant_id: merchantId, products: productNames });
  } else {
    console.log(`[WEBHOOK] No customer match found - email: ${receiptEmail}, square_id: ${squareCustomerId}`);
  }
  
  return { success: true, isFirstPurchase, customerId: customer?.id, matchedBy };
}

async function processCustomerCreated(supabase: any, tenantId: string, userId: string, customerData: any, connection: any) {
  const customer = customerData.customer || customerData;
  const email = customer.email_address;
  if (!email) return { success: false, reason: 'no_email' };
  const emailOptIn = customer.preferences?.email_unsubscribed === true ? false : customer.preferences?.email_unsubscribed === false ? true : null;
  let tags: string[] = [];
  if (customer.group_ids?.length > 0 && connection?.encrypted_access_token) {
    try {
      const { decryptToken } = await import('../_shared/crypto/tokens.ts');
      const groupMap = await fetchSquareCustomerGroups(await decryptToken(connection.encrypted_access_token), connection.environment || 'production');
      tags = customer.group_ids.map((id: string) => groupMap.get(id)).filter(Boolean);
    } catch {}
  }
  await supabase.from('crm_customers').upsert({
    tenant_id: tenantId, user_id: userId, email, phone: customer.phone_number, first_name: customer.given_name, last_name: customer.family_name,
    pos_source: 'square', email_opt_in: emailOptIn, tags: tags.length > 0 ? tags : null,
    square_customer_id: customer.id, square_group_ids: customer.group_ids?.length > 0 ? customer.group_ids : null, square_last_synced_at: new Date().toISOString()
  }, { onConflict: 'tenant_id,email' });
  return { success: true };
}

async function processCustomerUpdated(supabase: any, tenantId: string, userId: string, customerData: any, connection: any) {
  const customer = customerData.customer || customerData;
  const email = customer.email_address;
  if (!email) return { success: false, reason: 'no_email' };
  const emailOptIn = customer.preferences?.email_unsubscribed === true ? false : customer.preferences?.email_unsubscribed === false ? true : null;
  const { data: existing } = await supabase.from('crm_customers').select('tags').eq('tenant_id', tenantId).eq('email', email).single();
  let newTags: string[] = [];
  if (customer.group_ids?.length > 0 && connection?.encrypted_access_token) {
    try {
      const { decryptToken } = await import('../_shared/crypto/tokens.ts');
      const groupMap = await fetchSquareCustomerGroups(await decryptToken(connection.encrypted_access_token), connection.environment || 'production');
      newTags = customer.group_ids.map((id: string) => groupMap.get(id)).filter(Boolean);
    } catch {}
  }
  await supabase.from('crm_customers').update({
    phone: customer.phone_number, first_name: customer.given_name, last_name: customer.family_name,
    email_opt_in: emailOptIn !== null ? emailOptIn : undefined, tags: [...new Set([...(existing?.tags || []), ...newTags])],
    square_group_ids: customer.group_ids?.length > 0 ? customer.group_ids : null, square_last_synced_at: new Date().toISOString(), updated_at: new Date().toISOString()
  }).eq('tenant_id', tenantId).eq('email', email);
  return { success: true };
}

async function processLoyaltyAccountCreated(supabase: any, tenantId: string, userId: string, loyaltyData: any, merchantId: string) {
  const loyaltyAccount = loyaltyData.loyalty_account || loyaltyData;
  const squareCustomerId = loyaltyAccount.customer_id;
  if (!squareCustomerId) return { success: false, error: 'No customer ID' };

  const { data: connection } = await supabase.from('square_connections').select('encrypted_access_token, environment').eq('merchant_id', merchantId).eq('status', 'connected').single();
  if (!connection?.encrypted_access_token) return { success: false, error: 'No connection' };

  const { decryptToken } = await import('../_shared/crypto/tokens.ts');
  const accessToken = await decryptToken(connection.encrypted_access_token);
  const baseUrl = connection.environment === 'sandbox' ? `https://connect.squareupsandbox.com/v2/customers/${squareCustomerId}` : `https://connect.squareup.com/v2/customers/${squareCustomerId}`;
  const response = await fetch(baseUrl, { headers: { 'Authorization': `Bearer ${accessToken}`, 'Square-Version': '2024-01-18' } });
  const data = await response.json();
  if (!response.ok || !data.customer) return { success: false, error: 'Customer not found' };
  const squareCustomer = data.customer;
  const email = squareCustomer.email_address, phone = squareCustomer.phone_number;
  if (!email && !phone) return { success: false, error: 'No contact info' };

  const { data: existing } = email ? await supabase.from('crm_customers').select('*').eq('tenant_id', tenantId).eq('email', email).single() : await supabase.from('crm_customers').select('*').eq('tenant_id', tenantId).eq('phone', phone).single();
  let customer;
  if (existing) {
    const updatedTags = existing.tags?.includes('Loyalty Member') ? existing.tags : [...(existing.tags || []), 'Loyalty Member'];
    const { data } = await supabase.from('crm_customers').update({ tags: updatedTags, updated_at: new Date().toISOString() }).eq('id', existing.id).select().single();
    customer = data;
  } else {
    const { data } = await supabase.from('crm_customers').insert({ tenant_id: tenantId, user_id: userId, email, phone, first_name: squareCustomer.given_name, last_name: squareCustomer.family_name, tags: ['Loyalty Member'], pos_source: 'square', square_customer_id: squareCustomerId }).select().single();
    customer = data;
  }
  if (customer) await fireAutomationTriggers(supabase, tenantId, customer.id, ['loyalty_join'], { loyalty_account_id: loyaltyAccount.id, merchant_id: merchantId });
  return { success: true, customerId: customer?.id };
}

async function processFulfillmentUpdated(supabase: any, tenantId: string, userId: string, fulfillmentData: any, merchantId: string) {
  const fulfillment = fulfillmentData.fulfillment || fulfillmentData;
  const { order_id: orderId, state, type } = fulfillment;
  await supabase.from('pos_orders').update({ fulfillment_state: state, fulfillment_type: type, updated_at: new Date().toISOString() }).eq('external_id', orderId).eq('tenant_id', tenantId);
  const { data: order } = await supabase.from('pos_orders').select('customer_external_id').eq('external_id', orderId).eq('tenant_id', tenantId).single();
  if (!order?.customer_external_id) return { success: true };
  const { data: customer } = await supabase.from('crm_customers').select('id').eq('tenant_id', tenantId).eq('square_customer_id', order.customer_external_id).single();
  if (!customer) return { success: true };
  const triggers: string[] = [];
  if (state === 'PREPARED' && type === 'PICKUP') triggers.push('order.ready_for_pickup');
  else if (state === 'COMPLETED' && type === 'SHIPMENT') triggers.push('order.shipped');
  if (triggers.length) await fireAutomationTriggers(supabase, tenantId, customer.id, triggers, { order_id: orderId, fulfillment_type: type, fulfillment_state: state, merchant_id: merchantId });
  return { success: true, triggersFiret: triggers };
}

async function processRefundCreated(supabase: any, tenantId: string, userId: string, refundData: any, merchantId: string) {
  const refund = refundData.refund || refundData;
  const refundAmount = (refund.amount_money?.amount || 0) / 100;
  const { data: order } = await supabase.from('pos_orders').select('id, customer_external_id').eq('external_id', refund.payment_id).eq('tenant_id', tenantId).single();
  if (!order) return { success: false, error: 'Order not found' };
  await supabase.from('pos_orders').update({ status: 'REFUNDED', refund_amount: refundAmount, refund_reason: refund.reason || 'Not specified', refunded_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', order.id);
  if (order.customer_external_id) {
    const { data: customer } = await supabase.from('crm_customers').select('id, lifetime_value, total_spent').eq('tenant_id', tenantId).eq('square_customer_id', order.customer_external_id).single();
    if (customer) {
      await supabase.from('crm_customers').update({ lifetime_value: Math.max(0, (customer.lifetime_value || 0) - refundAmount), total_spent: Math.max(0, (customer.total_spent || 0) - refundAmount), updated_at: new Date().toISOString() }).eq('id', customer.id);
      await fireAutomationTriggers(supabase, tenantId, customer.id, ['refund.created'], { refund_amount: refundAmount, refund_reason: refund.reason, original_order_id: refund.payment_id, merchant_id: merchantId });
    }
  }
  return { success: true, refundAmount };
}

async function syncProductToDatabase(supabase: any, tenantId: string, userId: string, item: any): Promise<boolean> {
  const itemData = item.item_data || {};
  try {
    const { data: product, error } = await supabase.from('products').upsert({
      tenant_id: tenantId, created_by_user_id: userId, external_id: item.id, name: itemData.name || 'Unnamed Product',
      description: itemData.description || null, category: itemData.category?.name || null, source: 'square',
      status: item.is_deleted ? 'archived' : 'active', sku: itemData.variations?.[0]?.item_variation_data?.sku || null,
      price: itemData.variations?.[0]?.item_variation_data?.price_money?.amount ? itemData.variations[0].item_variation_data.price_money.amount / 100 : 0,
      currency: itemData.variations?.[0]?.item_variation_data?.price_money?.currency || 'USD',
      external_data: item, last_synced_at: new Date().toISOString(), updated_at: new Date().toISOString()
    }, { onConflict: 'tenant_id,external_id' }).select().single();
    if (error) return false;
    if (itemData.variations?.length) {
      for (const v of itemData.variations) {
        const vd = v.item_variation_data || {};
        await supabase.from('product_variations').upsert({
          product_id: product.id, external_id: v.id, name: vd.name || 'Default', sku: vd.sku || null,
          price: vd.price_money?.amount ? vd.price_money.amount / 100 : 0, currency: vd.price_money?.currency || 'USD',
          attributes: vd.item_option_values || null, updated_at: new Date().toISOString()
        }, { onConflict: 'product_id,external_id' });
      }
    }
    if (itemData.image_ids?.length) await supabase.from('products').update({ has_images: true }).eq('id', product.id);
    return true;
  } catch { return false; }
}

async function processCatalogVersionUpdated(supabase: any, tenantId: string, userId: string, catalogData: any, merchantId: string) {
  // THROTTLE: Only enqueue catalog sync if no pending/in_progress job exists
  // Square sends catalog.version.updated on ANY change (price, inventory, etc.) which floods the system
  
  // Check for existing pending/in_progress products sync job
  const { data: existingJob } = await supabase
    .from('pos_sync_jobs_v2')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('provider', 'square')
    .eq('sync_type', 'products')
    .in('status', ['pending', 'in_progress'])
    .single();

  if (existingJob) {
    console.log(`⏭️ Catalog sync skipped - existing job in progress: ${existingJob.id}`);
    return { success: true, skipped: true, reason: 'job_in_progress', existingJobId: existingJob.id };
  }

  // Also check last sync time as additional throttle
  const CATALOG_SYNC_THROTTLE_MINUTES = 15;
  const { data: connection } = await supabase.from('square_connections')
    .select('id, last_product_sync')
    .eq('merchant_id', merchantId)
    .eq('status', 'connected')
    .single();
  
  if (!connection) return { success: false, reason: 'no_connection' };
  
  if (connection.last_product_sync) {
    const lastSync = new Date(connection.last_product_sync);
    const minutesSinceLastSync = (Date.now() - lastSync.getTime()) / (1000 * 60);
    if (minutesSinceLastSync < CATALOG_SYNC_THROTTLE_MINUTES) {
      console.log(`⏭️ Catalog sync throttled - last sync ${Math.round(minutesSinceLastSync)}min ago`);
      return { success: true, skipped: true, reason: 'throttled', minutesSinceLastSync: Math.round(minutesSinceLastSync) };
    }
  }

  try {
    console.log('🔄 Enqueuing catalog sync job (passed throttle check)');
    
    // Enqueue products sync job
    const { data: jobId, error: enqueueError } = await supabase.rpc('enqueue_pos_sync_job', {
      p_tenant_id: tenantId,
      p_provider: 'square',
      p_sync_type: 'products',
      p_estimated_rows: 5000,
      p_triggered_by: 'webhook_catalog_update',
    });

    if (enqueueError) {
      console.error('❌ Failed to enqueue catalog sync:', enqueueError.message);
      return { success: false, error: enqueueError.message };
    }

    console.log(`✅ Catalog sync job enqueued: ${jobId}`);

    // Kick off the worker
    EdgeRuntime.waitUntil(
      supabase.functions.invoke('pos-sync-worker', { body: { provider: 'square' } })
    );

    return { success: true, jobEnqueued: jobId };
  } catch (e: any) { 
    return { success: false, error: e.message }; 
  }
}

async function processInventoryCountUpdated(supabase: any, tenantId: string, inventoryData: any) {
  const counts = inventoryData?.inventory_counts || [];
  let updated = 0;
  for (const count of counts) {
    const quantity = parseInt(count.quantity || '0', 10);
    const inStock = count.state === 'IN_STOCK' ? quantity : 0;
    const { data: product } = await supabase.from('products').select('id').eq('tenant_id', tenantId).eq('external_id', count.catalog_object_id).single();
    if (product) { await supabase.from('products').update({ inventory_count: inStock, track_inventory: true, updated_at: new Date().toISOString() }).eq('id', product.id); updated++; }
    const { data: variation } = await supabase.from('product_variations').select('id').eq('external_id', count.catalog_object_id).single();
    if (variation) { await supabase.from('product_variations').update({ inventory_count: inStock, track_inventory: true, updated_at: new Date().toISOString() }).eq('id', variation.id); updated++; }
  }
  return { success: true, updatedCount: updated };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  console.log('📨 Square webhook received');
  try {
    const body = await req.text();
    const signature = req.headers.get('x-square-hmacsha256-signature');
    const notificationUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/square-webhook-handler`;
    if (!await verifySquareSignature(body, signature, notificationUrl)) return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

    const payload: SquareWebhookPayload = JSON.parse(body);
    console.log('📦 Event:', payload.type, 'Merchant:', payload.merchant_id);
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const connection = await findTenantByMerchantId(supabase, payload.merchant_id);
    if (!connection) return new Response(JSON.stringify({ error: 'Merchant not connected' }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

    let result: any = { success: true, message: `Event ${payload.type} not handled` };
    switch (payload.type) {
      case 'payment.completed': result = await processPaymentCompleted(supabase, connection.tenant_id, connection.user_id, payload.data.object, payload.merchant_id, connection); break;
      case 'customer.created': result = await processCustomerCreated(supabase, connection.tenant_id, connection.user_id, payload.data.object, connection); break;
      case 'customer.updated': result = await processCustomerUpdated(supabase, connection.tenant_id, connection.user_id, payload.data.object, connection); break;
      case 'loyalty.account.created': case 'loyalty.program.enrollment.created': result = await processLoyaltyAccountCreated(supabase, connection.tenant_id, connection.user_id, payload.data.object, payload.merchant_id); break;
      case 'order.fulfillment.updated': result = await processFulfillmentUpdated(supabase, connection.tenant_id, connection.user_id, payload.data.object, payload.merchant_id); break;
      case 'refund.created': result = await processRefundCreated(supabase, connection.tenant_id, connection.user_id, payload.data.object, payload.merchant_id); break;
      case 'catalog.version.updated': result = await processCatalogVersionUpdated(supabase, connection.tenant_id, connection.user_id, payload.data.object, payload.merchant_id); break;
      case 'inventory.count.updated': result = await processInventoryCountUpdated(supabase, connection.tenant_id, payload.data.object); break;
    }
    console.log('✅ Result:', JSON.stringify(result));
    return new Response(JSON.stringify({ success: true, result }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (error: any) {
    console.error('💥 Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
};

serve(handler);
