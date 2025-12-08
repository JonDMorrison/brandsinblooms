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

// Fetch customer details from Square
async function fetchSquareCustomer(supabase: any, tenantId: string, customerId: string, merchantId: string): Promise<any | null> {
  const { data: connection } = await supabase
    .from('square_connections')
    .select('encrypted_access_token, environment')
    .eq('merchant_id', merchantId)
    .eq('status', 'connected')
    .single();

  if (!connection?.encrypted_access_token) {
    console.log('⚠️ No access token found for merchant');
    return null;
  }

  try {
    const { decryptToken } = await import('../_shared/crypto/tokens.ts');
    const accessToken = await decryptToken(connection.encrypted_access_token);
    
    const baseUrl = connection.environment === 'sandbox'
      ? `https://connect.squareupsandbox.com/v2/customers/${customerId}`
      : `https://connect.squareup.com/v2/customers/${customerId}`;

    const response = await fetch(baseUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Square-Version': '2024-01-18',
      },
    });

    const data = await response.json();
    if (!response.ok) {
      console.error(`❌ Failed to fetch customer ${customerId}:`, data.errors);
      return null;
    }
    return data.customer;
  } catch (error) {
    console.error(`❌ Error fetching customer ${customerId}:`, error);
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

// Helper function to check persona targeting
function checkPersonaTargeting(customer: any, personaTargeting: any): boolean {
  if (!personaTargeting || Object.keys(personaTargeting).length === 0) {
    return true;
  }

  if (personaTargeting.persona_ids && personaTargeting.persona_ids.length > 0) {
    if (!customer.persona_id || !personaTargeting.persona_ids.includes(customer.persona_id)) {
      return false;
    }
  }

  if (personaTargeting.required_tags && personaTargeting.required_tags.length > 0) {
    const customerTags = customer.tags || [];
    const hasAllTags = personaTargeting.required_tags.every((tag: string) => customerTags.includes(tag));
    if (!hasAllTags) {
      return false;
    }
  }

  if (personaTargeting.min_lifetime_value !== undefined && personaTargeting.min_lifetime_value !== null) {
    const customerLTV = customer.lifetime_value || 0;
    if (customerLTV < personaTargeting.min_lifetime_value) {
      return false;
    }
  }

  return true;
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
  
  if (customer) {
    const triggerTypes = ['order.completed', 'review_request'];
    
    if (isFirstPurchase) {
      triggerTypes.push('first_purchase');
      console.log('🎉 First purchase detected, adding first_purchase trigger');
    }
    
    console.log('⭐ review_request trigger included - will fire if automation exists for tenant');
    
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
  
  const emailOptIn = customer.preferences?.email_unsubscribed === true 
    ? false 
    : customer.preferences?.email_unsubscribed === false 
      ? true 
      : null;
  
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
  
  const emailOptIn = customer.preferences?.email_unsubscribed === true 
    ? false 
    : customer.preferences?.email_unsubscribed === false 
      ? true 
      : null;
  
  const { data: existingCustomer } = await supabase
    .from('crm_customers')
    .select('tags, product_tags')
    .eq('tenant_id', tenantId)
    .eq('email', email)
    .single();
  
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

// Process loyalty.account.created event
async function processLoyaltyAccountCreated(
  supabase: any,
  tenantId: string,
  userId: string,
  loyaltyData: any,
  merchantId: string
) {
  console.log('🎖️ Processing loyalty.account.created event');
  
  const loyaltyAccount = loyaltyData.loyalty_account || loyaltyData;
  const squareCustomerId = loyaltyAccount.customer_id;
  
  if (!squareCustomerId) {
    console.log('⚠️ No customer_id in loyalty account data');
    return { success: false, error: 'No customer ID' };
  }

  // Fetch customer details from Square
  const squareCustomer = await fetchSquareCustomer(supabase, tenantId, squareCustomerId, merchantId);
  
  if (!squareCustomer) {
    console.log('⚠️ Could not fetch Square customer details');
    return { success: false, error: 'Customer not found in Square' };
  }

  const email = squareCustomer.email_address;
  const phone = squareCustomer.phone_number;

  if (!email && !phone) {
    console.log('⚠️ No email or phone for loyalty customer');
    return { success: false, error: 'No contact info' };
  }

  // Find or create CRM customer
  let customer;
  const query = email 
    ? supabase.from('crm_customers').select('*').eq('tenant_id', tenantId).eq('email', email).single()
    : supabase.from('crm_customers').select('*').eq('tenant_id', tenantId).eq('phone', phone).single();

  const { data: existingCustomer } = await query;

  if (existingCustomer) {
    // Add loyalty tag if not already present
    const existingTags = existingCustomer.tags || [];
    const updatedTags = existingTags.includes('Loyalty Member') 
      ? existingTags 
      : [...existingTags, 'Loyalty Member'];
    
    const { data: updatedCustomer, error } = await supabase
      .from('crm_customers')
      .update({
        tags: updatedTags,
        updated_at: new Date().toISOString()
      })
      .eq('id', existingCustomer.id)
      .select()
      .single();
    
    if (error) {
      console.error('❌ Error updating customer with loyalty tag:', error);
    } else {
      customer = updatedCustomer;
      console.log('✅ Added Loyalty Member tag to customer:', customer.email || customer.phone);
    }
  } else {
    // Create new customer with loyalty tag
    const { data: newCustomer, error } = await supabase
      .from('crm_customers')
      .insert({
        tenant_id: tenantId,
        user_id: userId,
        email: email,
        phone: phone,
        first_name: squareCustomer.given_name,
        last_name: squareCustomer.family_name,
        tags: ['Loyalty Member'],
        pos_source: 'square',
        square_customer_id: squareCustomerId
      })
      .select()
      .single();
    
    if (error) {
      console.error('❌ Error creating loyalty customer:', error);
    } else {
      customer = newCustomer;
      console.log('✅ Created new loyalty customer:', customer.email || customer.phone);
    }
  }

  // Fire loyalty_join automation trigger
  if (customer) {
    await fireAutomationTriggers(supabase, tenantId, customer.id, ['loyalty_join'], {
      loyalty_account_id: loyaltyAccount.id,
      merchant_id: merchantId,
      enrolled_at: new Date().toISOString()
    });
  }

  return { success: true, customerId: customer?.id };
}

// Process order.fulfillment.updated event
async function processFulfillmentUpdated(
  supabase: any,
  tenantId: string,
  userId: string,
  fulfillmentData: any,
  merchantId: string
) {
  console.log('📦 Processing order.fulfillment.updated event');
  
  const fulfillment = fulfillmentData.fulfillment || fulfillmentData;
  const orderId = fulfillment.order_id;
  const state = fulfillment.state; // PROPOSED, RESERVED, PREPARED, COMPLETED, CANCELED, FAILED
  const type = fulfillment.type; // PICKUP, SHIPMENT

  console.log('📦 Fulfillment details:', { orderId, state, type });

  // Update pos_orders with fulfillment state
  const { error: updateError } = await supabase
    .from('pos_orders')
    .update({
      fulfillment_state: state,
      fulfillment_type: type,
      updated_at: new Date().toISOString()
    })
    .eq('external_id', orderId)
    .eq('tenant_id', tenantId);

  if (updateError) {
    console.error('❌ Error updating order fulfillment:', updateError);
  }

  // Get customer for this order
  const { data: order } = await supabase
    .from('pos_orders')
    .select('customer_external_id')
    .eq('external_id', orderId)
    .eq('tenant_id', tenantId)
    .single();

  if (!order?.customer_external_id) {
    console.log('⚠️ No customer linked to order');
    return { success: true, message: 'Order updated, no customer to notify' };
  }

  // Find CRM customer by square_customer_id
  const { data: customer } = await supabase
    .from('crm_customers')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('square_customer_id', order.customer_external_id)
    .single();

  if (!customer) {
    console.log('⚠️ CRM customer not found for order');
    return { success: true, message: 'Order updated, CRM customer not found' };
  }

  // Fire appropriate trigger based on state
  const triggerTypes: string[] = [];
  
  if (state === 'PREPARED' && type === 'PICKUP') {
    triggerTypes.push('order.ready_for_pickup');
    console.log('🏪 Order ready for pickup');
  } else if (state === 'COMPLETED' && type === 'SHIPMENT') {
    triggerTypes.push('order.shipped');
    console.log('📬 Order shipped');
  }

  if (triggerTypes.length > 0) {
    await fireAutomationTriggers(supabase, tenantId, customer.id, triggerTypes, {
      order_id: orderId,
      fulfillment_type: type,
      fulfillment_state: state,
      merchant_id: merchantId
    });
  }

  return { success: true, triggersFiret: triggerTypes };
}

// Process refund.created event
async function processRefundCreated(
  supabase: any,
  tenantId: string,
  userId: string,
  refundData: any,
  merchantId: string
) {
  console.log('💸 Processing refund.created event');
  
  const refund = refundData.refund || refundData;
  const paymentId = refund.payment_id;
  const refundAmountCents = refund.amount_money?.amount || 0;
  const refundAmount = refundAmountCents / 100;
  const reason = refund.reason || 'Not specified';

  console.log('💸 Refund details:', { paymentId, refundAmount, reason });

  // Find the original order by payment ID (which is stored as external_id)
  const { data: order } = await supabase
    .from('pos_orders')
    .select('id, customer_external_id, total_amount')
    .eq('external_id', paymentId)
    .eq('tenant_id', tenantId)
    .single();

  if (!order) {
    console.log('⚠️ Original order not found for refund');
    return { success: false, error: 'Order not found' };
  }

  // Update order with refund info
  const { error: updateError } = await supabase
    .from('pos_orders')
    .update({
      status: 'REFUNDED',
      refund_amount: refundAmount,
      refund_reason: reason,
      refunded_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', order.id);

  if (updateError) {
    console.error('❌ Error updating order with refund:', updateError);
  }

  // Find CRM customer and adjust lifetime_value
  if (order.customer_external_id) {
    const { data: customer } = await supabase
      .from('crm_customers')
      .select('id, lifetime_value, total_spent')
      .eq('tenant_id', tenantId)
      .eq('square_customer_id', order.customer_external_id)
      .single();

    if (customer) {
      const { error: customerUpdateError } = await supabase
        .from('crm_customers')
        .update({
          lifetime_value: Math.max(0, (customer.lifetime_value || 0) - refundAmount),
          total_spent: Math.max(0, (customer.total_spent || 0) - refundAmount),
          updated_at: new Date().toISOString()
        })
        .eq('id', customer.id);

      if (customerUpdateError) {
        console.error('❌ Error adjusting customer LTV:', customerUpdateError);
      } else {
        console.log('✅ Adjusted customer lifetime value by -$' + refundAmount);
      }

      // Fire refund.created trigger for service recovery automation
      await fireAutomationTriggers(supabase, tenantId, customer.id, ['refund.created'], {
        refund_amount: refundAmount,
        refund_reason: reason,
        original_order_id: paymentId,
        merchant_id: merchantId
      });
    }
  }

  return { success: true, refundAmount };
}

// Fire automation triggers with consent and targeting checks
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
      
      // Check persona targeting
      const personaTargeting = automation.persona_targeting || {};
      if (!checkPersonaTargeting(customer, personaTargeting)) {
        console.log(`⏭️ Skipping automation ${automation.name} - customer does not match persona targeting`);
        continue;
      }
      
      // Check for existing queued messages (idempotency)
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
      let messagesEnqueued = 0;
      let messagesSkipped = 0;
      
      for (let i = 0; i < workflowSteps.length; i++) {
        const step = workflowSteps[i];
        const delayMs = step.delayMin * 60 * 1000;
        const scheduledAt = new Date(baseTime.getTime() + delayMs);
        const messageType = step.type || 'email';
        
        // Check consent for this message type
        if (messageType === 'email' && customer.email_opt_in === false) {
          console.log(`⏭️ Skipping email step ${i} for ${customer.email} - not opted in`);
          messagesSkipped++;
          continue;
        }
        if (messageType === 'sms' && customer.sms_opt_in !== true) {
          console.log(`⏭️ Skipping SMS step ${i} for ${customer.email} - not opted in`);
          messagesSkipped++;
          continue;
        }
        
        const recipient = messageType === 'sms' ? customer.phone : customer.email;
        
        if (!recipient) {
          console.log(`⚠️ No ${messageType} recipient for customer ${customer.email}`);
          messagesSkipped++;
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
            message_type: messageType,
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
            message_type: messageType,
            status: 'queued',
            scheduled_at: scheduledAt.toISOString()
          });
        
        messagesEnqueued++;
        console.log(`✅ Enqueued ${messageType} message for ${customer.email} (step ${i + 1}, scheduled: ${scheduledAt.toISOString()})`);
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
            steps_scheduled: messagesEnqueued,
            steps_skipped: messagesSkipped
          }
        });
      
      console.log(`✅ Automation ${automation.name} processed: ${messagesEnqueued} enqueued, ${messagesSkipped} skipped`);
      
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
        created_by_user_id: userId,
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
        external_data: item,
        last_synced_at: new Date().toISOString(),
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
    '{{refund_amount}}': eventData.refund_amount ? `$${eventData.refund_amount.toFixed(2)}` : '',
    '{{refund_reason}}': eventData.refund_reason || '',
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
    
    let result: any = { success: false, message: 'Unknown event type' };
    
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
        
      case 'loyalty.account.created':
      case 'loyalty.program.enrollment.created':
        result = await processLoyaltyAccountCreated(
          supabase,
          connection.tenant_id,
          connection.user_id,
          payload.data.object,
          payload.merchant_id
        );
        break;
        
      case 'order.fulfillment.updated':
        result = await processFulfillmentUpdated(
          supabase,
          connection.tenant_id,
          connection.user_id,
          payload.data.object,
          payload.merchant_id
        );
        break;
        
      case 'refund.created':
        result = await processRefundCreated(
          supabase,
          connection.tenant_id,
          connection.user_id,
          payload.data.object,
          payload.merchant_id
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
    
  } catch (error: any) {
    console.error('💥 Webhook handler error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
};

serve(handler);
