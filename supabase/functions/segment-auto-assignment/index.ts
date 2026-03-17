import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SegmentRule {
  field: string;
  operator: string;
  value: any;
}

interface Segment {
  id: string;
  name: string;
  rules: SegmentRule[];
  rule_logic?: string;
}

interface Customer {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  lifetime_value?: number;
  total_spent?: number;
  tags?: string[];
  product_tags?: string[];
  first_purchase_date?: string;
  last_purchase_date?: string;
  is_vip?: boolean;
  email_opt_in?: boolean;
  sms_opt_in?: boolean;
  pos_source?: string;
  created_at?: string;
}

// Evaluate a single rule against customer data
function evaluateRule(rule: SegmentRule, customer: Customer): boolean {
  const { field, operator, value } = rule;
  
  // Get the customer field value with support for nested paths
  let customerValue: any;
  if (field.includes('.')) {
    const parts = field.split('.');
    customerValue = parts.reduce((obj, key) => obj?.[key], customer as any);
  } else {
    customerValue = (customer as any)[field];
  }

  switch (operator) {
    case 'equals':
    case 'eq':
      return customerValue === value;
    
    case 'not_equals':
    case 'neq':
      return customerValue !== value;
    
    case 'greater_than':
    case 'gt':
      return (customerValue ?? 0) > value;
    
    case 'less_than':
    case 'lt':
      return (customerValue ?? 0) < value;
    
    case 'greater_than_or_equal':
    case 'gte':
      return (customerValue ?? 0) >= value;
    
    case 'less_than_or_equal':
    case 'lte':
      return (customerValue ?? 0) <= value;
    
    case 'contains':
      if (Array.isArray(customerValue)) {
        return customerValue.some(v => 
          String(v).toLowerCase().includes(String(value).toLowerCase())
        );
      }
      return String(customerValue ?? '').toLowerCase().includes(String(value).toLowerCase());
    
    case 'not_contains':
      if (Array.isArray(customerValue)) {
        return !customerValue.some(v => 
          String(v).toLowerCase().includes(String(value).toLowerCase())
        );
      }
      return !String(customerValue ?? '').toLowerCase().includes(String(value).toLowerCase());
    
    case 'in':
      if (Array.isArray(value)) {
        return value.includes(customerValue);
      }
      return false;
    
    case 'not_in':
      if (Array.isArray(value)) {
        return !value.includes(customerValue);
      }
      return true;
    
    case 'is_empty':
      return !customerValue || (Array.isArray(customerValue) && customerValue.length === 0);
    
    case 'is_not_empty':
      return !!customerValue && (!Array.isArray(customerValue) || customerValue.length > 0);
    
    case 'is_true':
      return customerValue === true;
    
    case 'is_false':
      return customerValue === false || customerValue === null || customerValue === undefined;
    
    case 'days_ago_greater_than':
      if (!customerValue) return false;
      const daysAgoGt = Math.floor((Date.now() - new Date(customerValue).getTime()) / (1000 * 60 * 60 * 24));
      return daysAgoGt > value;
    
    case 'days_ago_less_than':
      if (!customerValue) return false;
      const daysAgoLt = Math.floor((Date.now() - new Date(customerValue).getTime()) / (1000 * 60 * 60 * 24));
      return daysAgoLt < value;
    
    default:
      console.warn(`[SEGMENT-AUTO] Unknown operator: ${operator}`);
      return false;
  }
}

// Evaluate all rules for a segment against a customer
function evaluateSegmentRules(segment: Segment, customer: Customer): boolean {
  const rules = segment.rules || [];
  if (rules.length === 0) return false;

  const logic = segment.rule_logic || 'AND';
  
  if (logic === 'OR') {
    return rules.some(rule => evaluateRule(rule, customer));
  } else {
    // Default to AND logic
    return rules.every(rule => evaluateRule(rule, customer));
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization header');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user from auth
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (userError || !user) throw new Error('Unauthorized');

    // Get tenant_id
    const { data: userData } = await supabaseClient
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (!userData?.tenant_id) throw new Error('No tenant found');

    const tenantId = userData.tenant_id;

    // Parse request body for optional customer_id (single customer) or process all
    let customerId: string | undefined;
    try {
      const body = await req.json();
      customerId = body.customer_id;
    } catch {
      // No body - process all customers
    }

    console.log(`[SEGMENT-AUTO] Starting segment assignment for tenant ${tenantId}${customerId ? ` (customer: ${customerId})` : ' (all customers)'}`);

    // Fetch all dynamic segments for tenant
    const { data: segments, error: segmentsError } = await supabaseClient
      .from('crm_segments')
      .select('id, name, rules, rule_logic')
      .eq('tenant_id', tenantId)
      .eq('is_dynamic', true);

    if (segmentsError) {
      console.error('[SEGMENT-AUTO] Failed to fetch segments:', segmentsError);
      throw new Error('Failed to fetch segments');
    }

    if (!segments || segments.length === 0) {
      console.log('[SEGMENT-AUTO] No dynamic segments found for tenant');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No dynamic segments found',
          segmentsProcessed: 0,
          customersProcessed: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[SEGMENT-AUTO] Found ${segments.length} dynamic segments`);

    // Fetch customers to evaluate
    let customerQuery = supabaseClient
      .from('crm_customers')
      .select('id, email, first_name, last_name, lifetime_value, total_spent, tags, product_tags, first_purchase_date, last_purchase_date, is_vip, email_opt_in, sms_opt_in, pos_source, created_at')
      .eq('tenant_id', tenantId);

    if (customerId) {
      customerQuery = customerQuery.eq('id', customerId);
    }

    const { data: customers, error: customersError } = await customerQuery;

    if (customersError) {
      console.error('[SEGMENT-AUTO] Failed to fetch customers:', customersError);
      throw new Error('Failed to fetch customers');
    }

    if (!customers || customers.length === 0) {
      console.log('[SEGMENT-AUTO] No customers found');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No customers found',
          segmentsProcessed: segments.length,
          customersProcessed: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[SEGMENT-AUTO] Evaluating ${customers.length} customers against ${segments.length} segments`);

    // Track assignments
    const assignments: { customerId: string; segmentId: string; segmentName: string }[] = [];
    const removals: { customerId: string; segmentId: string }[] = [];

    // Get existing customer_segments for these customers
    const { data: existingAssignments } = await supabaseClient
      .from('customer_segments')
      .select('customer_id, segment_id')
      .eq('tenant_id', tenantId)
      .in('customer_id', customers.map(c => c.id));

    const existingMap = new Map<string, Set<string>>();
    for (const ea of existingAssignments || []) {
      if (!existingMap.has(ea.customer_id)) {
        existingMap.set(ea.customer_id, new Set());
      }
      existingMap.get(ea.customer_id)!.add(ea.segment_id);
    }

    // Evaluate each customer against each segment
    for (const customer of customers as Customer[]) {
      const currentSegments = existingMap.get(customer.id) || new Set();
      
      for (const segment of segments as Segment[]) {
        const shouldBeInSegment = evaluateSegmentRules(segment, customer);
        const isInSegment = currentSegments.has(segment.id);

        if (shouldBeInSegment && !isInSegment) {
          // Add to segment
          assignments.push({
            customerId: customer.id,
            segmentId: segment.id,
            segmentName: segment.name
          });
        } else if (!shouldBeInSegment && isInSegment) {
          // Remove from segment
          removals.push({
            customerId: customer.id,
            segmentId: segment.id
          });
        }
      }
    }

    console.log(`[SEGMENT-AUTO] Assignments to make: ${assignments.length}, Removals: ${removals.length}`);

    // Batch insert new assignments
    if (assignments.length > 0) {
      const insertRecords = assignments.map(a => ({
        tenant_id: tenantId,
        customer_id: a.customerId,
        segment_id: a.segmentId,
        assigned_at: new Date().toISOString()
      }));

      const { error: insertError } = await supabaseClient
        .from('customer_segments')
        .upsert(insertRecords, {
          onConflict: 'tenant_id,customer_id,segment_id',
          ignoreDuplicates: true
        });

      if (insertError) {
        console.error('[SEGMENT-AUTO] Failed to insert assignments:', insertError);
      } else {
        console.log(`[SEGMENT-AUTO] Inserted ${assignments.length} segment assignments`);
      }
    }

    // Batch remove old assignments
    if (removals.length > 0) {
      for (const removal of removals) {
        await supabaseClient
          .from('customer_segments')
          .delete()
          .eq('tenant_id', tenantId)
          .eq('customer_id', removal.customerId)
          .eq('segment_id', removal.segmentId);
      }
      console.log(`[SEGMENT-AUTO] Removed ${removals.length} segment assignments`);
    }

    // Update segment customer counts
    for (const segment of segments as Segment[]) {
      const { count } = await supabaseClient
        .from('customer_segments')
        .select('*', { count: 'exact', head: true })
        .eq('segment_id', segment.id);

      await supabaseClient
        .from('crm_segments')
        .update({ customer_count: count || 0, updated_at: new Date().toISOString() })
        .eq('id', segment.id);
    }

    console.log(`[SEGMENT-AUTO] Segment auto-assignment complete`);

    return new Response(
      JSON.stringify({
        success: true,
        segmentsProcessed: segments.length,
        customersProcessed: customers.length,
        assignmentsCreated: assignments.length,
        assignmentsRemoved: removals.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[SEGMENT-AUTO] Error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
