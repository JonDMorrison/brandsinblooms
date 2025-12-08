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

interface SquareOrderLineItem {
  name?: string;
  quantity: string;
  catalog_object_id?: string;
  variation_name?: string;
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
    .select('tenant_id, user_id, merchant_id, environment, encrypted_access_token')
    .eq('merchant_id', merchantId)
    .eq('status', 'connected')
    .single();
  
  if (error) {
    console.error('❌ Error finding tenant for merchant:', merchantId, error);
    return null;
  }
  
  return connection;
}

// Fetch order details from Square
async function fetchSquareOrder(orderId: string, accessToken: string, environment: string): Promise<any | null> {
  const baseUrl = environment === 'sandbox'
    ? `https://connect.squareupsandbox.com/v2/orders/${orderId}`
    : `https://connect.squareup.com/v2/orders/${orderId}`;

  try {
    const response = await fetch(baseUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Square-Version': '2024-01-18',
      },
    });

    const data = await response.json();
    if (!response.ok) {
      console.error(`❌ Failed to fetch order ${orderId}:`, data.errors);
      return null;
    }
    return data.order;
  } catch (error) {
    console.error(`❌ Error fetching order ${orderId}:`, error);
    return null;
  }
}

// Fetch customer groups from Square
async function fetchSquareCustomerGroups(accessToken: string, environment: string): Promise<Map<string, string>> {
  const groupMap = new Map<string, string>();
  const baseUrl = environment === 'sandbox'
    ? 'https://connect.squareupsandbox.com/v2/customers/groups'
    : 'https://connect.squareup.com/v2/customers/groups';

  try {
    const response = await fetch(baseUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Square-Version': '2024-01-18',
      },
    });

    const data = await response.json();
    if (response.ok && data.groups) {
      for (const group of data.groups) {
        groupMap.set(group.id, group.name);
      }
    }
  } catch (error) {
    console.error('❌ Error fetching customer groups:', error);
  }

  return groupMap;
}

// Extract product names from order line items
function extractProductNames(order: any): string[] {
  if (!order?.line_items) return [];
  return order.line_items
    .map((item: SquareOrderLineItem) => item.name || item.variation_name)
    .filter((name: string | undefined): name is string => !!name);
}

// Process payment.completed event
async function processPaymentCompleted(supabase: any, tenantId: string, userId: string, payment: any, merchantId: string, connection: any) {
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
  
  // Phase 3: Fetch order details for product tags
  let productNames: string[] = [];
  let orderData: any = null;
  
  if (paymentData.order_id && connection?.encrypted_access_token) {
    try {
      const { decryptToken } = await import('../_shared/crypto/tokens.ts');
      const accessToken = await decryptToken(connection.encrypted_access_token);
      orderData = await fetchSquareOrder(paymentData.order_id, accessToken, connection.environment || 'production');
      productNames = extractProductNames(orderData);
      console.log('📦 Order products:', productNames);
    } catch (error) {
      console.error('❌ Error fetching order details:', error);
    }
  }
  
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
        items: orderData?.line_items?.map((li: SquareOrderLineItem) => ({
          name: li.name || li.variation_name,
          quantity: li.quantity,
          catalog_object_id: li.catalog_object_id
        })) || [],
        raw_data: { payment: paymentData, order: orderData }
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
    
    // Merge product tags
    const existingProductTags = existingCustomer?.product_tags || [];
    const mergedProductTags = [...new Set([...existingProductTags, ...productNames])];
    
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
        product_tags: mergedProductTags.length > 0 ? mergedProductTags : null,
        pos_source: 'square'
      }, { onConflict: 'tenant_id,email' })
      .select()
      .single();
    
    if (customerError) {
      console.error('❌ Error upserting customer:', customerError);
    } else {
      customer = upsertedCustomer;
      console.log('✅ Customer upserted:', customer.email, 'First purchase:', isFirstPurchase, 'Product tags:', mergedProductTags.length);
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
      merchant_id: merchantId,
      products: productNames
    });
  }
  
  return { success: true, isFirstPurchase, customerId: customer?.id, productTagsAdded: productNames.length };
}

// Process customer.created event
async function processCustomerCreated(supabase: any, tenantId: string, userId: string, customerData: any, connection: any) {
  console.log('👤 Processing customer.created event');
  
  const customer = customerData.customer || customerData;
  const email = customer.email_address;
  const phone = customer.phone_number;
  const firstName = customer.given_name;
  const lastName = customer.family_name;
  const groupIds = customer.group_ids || [];
  
  if (!email) {
    console.log('⚠️ No email in customer data, skipping');
    return { success: false, reason: 'no_email' };
  }
  
  // Phase 1: Extract marketing preferences
  const emailOptIn = customer.preferences?.email_unsubscribed === true 
    ? false 
    : customer.preferences?.email_unsubscribed === false 
      ? true 
      : null;
  
  // Phase 2: Fetch group names
  let tags: string[] = [];
  if (groupIds.length > 0 && connection?.encrypted_access_token) {
    try {
      const { decryptToken } = await import('../_shared/crypto/tokens.ts');
      const accessToken = await decryptToken(connection.encrypted_access_token);
      const groupMap = await fetchSquareCustomerGroups(accessToken, connection.environment || 'production');
      tags = groupIds.map((id: string) => groupMap.get(id)).filter((name: string | undefined): name is string => !!name);
    } catch (error) {
      console.error('❌ Error fetching customer groups:', error);
    }
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
      pos_source: 'square',
      email_opt_in: emailOptIn,
      sms_opt_in: null,
      tags: tags.length > 0 ? tags : null,
      square_customer_id: customer.id,
      square_group_ids: groupIds.length > 0 ? groupIds : null,
      square_last_synced_at: new Date().toISOString()
    }, { onConflict: 'tenant_id,email' });
  
  if (error) {
    console.error('❌ Error creating customer:', error);
    return { success: false, error };
  }
  
  console.log('✅ Customer created:', email, 'Tags:', tags.length, 'Email opt-in:', emailOptIn);
  return { success: true };
}

// Process customer.updated event
async function processCustomerUpdated(supabase: any, tenantId: string, userId: string, customerData: any, connection: any) {
  console.log('👤 Processing customer.updated event');
  
  const customer = customerData.customer || customerData;
  const email = customer.email_address;
  const phone = customer.phone_number;
  const firstName = customer.given_name;
  const lastName = customer.family_name;
  const groupIds = customer.group_ids || [];
  
  if (!email) {
    console.log('⚠️ No email in customer data, skipping');
    return { success: false, reason: 'no_email' };
  }
  
  // Phase 1: Extract marketing preferences
  const emailOptIn = customer.preferences?.email_unsubscribed === true 
    ? false 
    : customer.preferences?.email_unsubscribed === false 
      ? true 
      : null;
  
  // Get existing customer
  const { data: existingCustomer } = await supabase
    .from('crm_customers')
    .select('tags, product_tags')
    .eq('tenant_id', tenantId)
    .eq('email', email)
    .single();
  
  // Phase 2: Fetch and merge group names
  let newTags: string[] = [];
  if (groupIds.length > 0 && connection?.encrypted_access_token) {
    try {
      const { decryptToken } = await import('../_shared/crypto/tokens.ts');
      const accessToken = await decryptToken(connection.encrypted_access_token);
      const groupMap = await fetchSquareCustomerGroups(accessToken, connection.environment || 'production');
      newTags = groupIds.map((id: string) => groupMap.get(id)).filter((name: string | undefined): name is string => !!name);
    } catch (error) {
      console.error('❌ Error fetching customer groups:', error);
    }
  }
  
  const existingTags = existingCustomer?.tags || [];
  const mergedTags = [...new Set([...existingTags, ...newTags])];
  
  const { error } = await supabase
    .from('crm_customers')
    .update({
      phone: phone,
      first_name: firstName,
      last_name: lastName,
      email_opt_in: emailOptIn !== null ? emailOptIn : undefined,
      tags: mergedTags.length > 0 ? mergedTags : null,
      square_group_ids: groupIds.length > 0 ? groupIds : null,
      square_last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('tenant_id', tenantId)
    .eq('email', email);
  
  if (error) {
    console.error('❌ Error updating customer:', error);
    return { success: false, error };
  }
  
  console.log('✅ Customer updated:', email, 'Tags:', mergedTags.length);
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
        
        const personalizedContent = personalizeMessage(step.text, customer, eventData);
        const personalizedSubject = step.subject ? personalizeMessage(step.subject, customer, eventData) : undefined;
        
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

// Process catalog.version.updated event
async function processCatalogVersionUpdated(
  supabase: any, 
  tenantId: string, 
  userId: string, 
  catalogData: any,
  merchantId: string
) {
  console.log('📦 Processing catalog.version.updated event');
  console.log('📋 Catalog update timestamp:', catalogData?.updated_at);
  
  const { data: connection } = await supabase
    .from('square_connections')
    .select('id, encrypted_access_token, environment')
    .eq('merchant_id', merchantId)
    .eq('status', 'connected')
    .single();
  
  if (!connection) {
    console.error('❌ No active Square connection found');
    return { success: false, reason: 'no_connection' };
  }
  
  try {
    const { decryptToken } = await import('../_shared/crypto/tokens.ts');
    const accessToken = await decryptToken(connection.encrypted_access_token);
    
    const baseUrl = connection.environment === 'sandbox'
      ? 'https://connect.squareupsandbox.com/v2/catalog/list'
      : 'https://connect.squareup.com/v2/catalog/list';
    
    let cursor: string | undefined;
    let productsSynced = 0;
    
    do {
      const url = new URL(baseUrl);
      url.searchParams.set('types', 'ITEM');
      if (cursor) url.searchParams.set('cursor', cursor);
      
      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Square-Version': '2024-01-18',
        },
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.errors?.[0]?.detail || 'Failed to fetch catalog');
      }
      
      if (data.objects && data.objects.length > 0) {
        for (const item of data.objects) {
          if (item.type === 'ITEM') {
            const synced = await syncProductToDatabase(supabase, tenantId, userId, item, connection.environment);
            if (synced) productsSynced++;
          }
        }
      }
      
      cursor = data.cursor;
    } while (cursor);
    
    await supabase
      .from('square_connections')
      .update({
        last_product_sync: new Date().toISOString(),
        products_synced: productsSynced,
        last_synced_at: new Date().toISOString(),
      })
      .eq('id', connection.id);
    
    console.log(`✅ Catalog sync complete. Products synced: ${productsSynced}`);
    return { success: true, productsSynced };
  } catch (error: any) {
    console.error('❌ Error syncing catalog:', error.message);
    return { success: false, error: error.message };
  }
}

// Process inventory.count.updated event
async function processInventoryCountUpdated(
  supabase: any,
  tenantId: string,
  inventoryData: any
) {
  console.log('📊 Processing inventory.count.updated event');
  
  const counts = inventoryData?.inventory_counts || [];
  let updatedCount = 0;
  
  for (const count of counts) {
    const catalogObjectId = count.catalog_object_id;
    const quantity = parseInt(count.quantity || '0', 10);
    const state = count.state;
    
    console.log(`📦 Updating inventory for ${catalogObjectId}: ${quantity} (${state})`);
    
    const { data: product } = await supabase
      .from('products')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('external_id', catalogObjectId)
      .single();
    
    if (product) {
      const { error } = await supabase
        .from('products')
        .update({
          inventory_count: state === 'IN_STOCK' ? quantity : 0,
          track_inventory: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', product.id);
      
      if (!error) {
        updatedCount++;
        console.log(`✅ Updated product inventory: ${product.id}`);
      }
    }
    
    const { data: variation } = await supabase
      .from('product_variations')
      .select('id')
      .eq('external_id', catalogObjectId)
      .single();
    
    if (variation) {
      const { error } = await supabase
        .from('product_variations')
        .update({
          inventory_count: state === 'IN_STOCK' ? quantity : 0,
          track_inventory: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', variation.id);
      
      if (!error) {
        updatedCount++;
        console.log(`✅ Updated variation inventory: ${variation.id}`);
      }
    }
  }
  
  console.log(`✅ Inventory update complete. Updated ${updatedCount} items`);
  return { success: true, updatedCount };
}

// Sync a single product item to the database
async function syncProductToDatabase(
  supabase: any,
  tenantId: string,
  userId: string,
  item: any,
  environment: string
): Promise<boolean> {
  const itemData = item.item_data || {};
  
  try {
    const { data: product, error: productError } = await supabase
      .from('products')
      .upsert({
        tenant_id: tenantId,
        user_id: userId,
        external_id: item.id,
        name: itemData.name || 'Unnamed Product',
        description: itemData.description || null,
        category: itemData.category?.name || null,
        source: 'square',
        status: item.is_deleted ? 'archived' : 'active',
        sku: itemData.variations?.[0]?.item_variation_data?.sku || null,
        price: itemData.variations?.[0]?.item_variation_data?.price_money?.amount 
          ? itemData.variations[0].item_variation_data.price_money.amount / 100 
          : 0,
        currency: itemData.variations?.[0]?.item_variation_data?.price_money?.currency || 'USD',
        raw_data: item,
        updated_at: new Date().toISOString()
      }, { onConflict: 'tenant_id,external_id' })
      .select()
      .single();
    
    if (productError) {
      console.error(`❌ Error upserting product ${item.id}:`, productError);
      return false;
    }
    
    console.log(`✅ Product synced: ${itemData.name}`);
    
    if (itemData.variations && itemData.variations.length > 0) {
      for (const variation of itemData.variations) {
        const variationData = variation.item_variation_data || {};
        
        await supabase
          .from('product_variations')
          .upsert({
            product_id: product.id,
            external_id: variation.id,
            name: variationData.name || 'Default',
            sku: variationData.sku || null,
            price: variationData.price_money?.amount 
              ? variationData.price_money.amount / 100 
              : 0,
            currency: variationData.price_money?.currency || 'USD',
            attributes: variationData.item_option_values || null,
            updated_at: new Date().toISOString()
          }, { onConflict: 'product_id,external_id' });
      }
    }
    
    if (itemData.image_ids && itemData.image_ids.length > 0) {
      await supabase
        .from('products')
        .update({ has_images: true })
        .eq('id', product.id);
    }
    
    return true;
  } catch (error: any) {
    console.error(`❌ Error syncing product ${item.id}:`, error.message);
    return false;
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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('📨 Square webhook received');
  
  try {
    const body = await req.text();
    const signature = req.headers.get('x-square-hmacsha256-signature');
    const notificationUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/square-webhook-handler`;
    
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
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    const connection = await findTenantByMerchantId(supabase, payload.merchant_id);
    if (!connection) {
      console.error('❌ No connected tenant found for merchant:', payload.merchant_id);
      return new Response(
        JSON.stringify({ error: 'Merchant not connected', merchant_id: payload.merchant_id }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
    
    console.log('✅ Found tenant:', connection.tenant_id, 'for merchant:', payload.merchant_id);
    
    let result = { success: false, message: 'Unknown event type' };
    
    switch (payload.type) {
      case 'payment.completed':
        result = await processPaymentCompleted(
          supabase, 
          connection.tenant_id, 
          connection.user_id, 
          payload.data.object,
          payload.merchant_id,
          connection
        );
        break;
        
      case 'customer.created':
        result = await processCustomerCreated(
          supabase, 
          connection.tenant_id, 
          connection.user_id, 
          payload.data.object,
          connection
        );
        break;
        
      case 'customer.updated':
        result = await processCustomerUpdated(
          supabase, 
          connection.tenant_id, 
          connection.user_id, 
          payload.data.object,
          connection
        );
        break;
        
      case 'catalog.version.updated':
        result = await processCatalogVersionUpdated(
          supabase,
          connection.tenant_id,
          connection.user_id,
          payload.data.object,
          payload.merchant_id
        );
        break;
        
      case 'inventory.count.updated':
        result = await processInventoryCountUpdated(
          supabase,
          connection.tenant_id,
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
