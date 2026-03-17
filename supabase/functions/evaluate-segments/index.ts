import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SegmentCondition {
  field: string;
  operator: string;
  value: any;
}

interface SegmentRule {
  conditions: SegmentCondition[];
  logic?: 'AND' | 'OR';
}

interface Segment {
  id: string;
  name: string;
  tenant_id: string;
  auto_update: boolean;
  conditions: SegmentRule | null;
  customer_count: number;
}

interface Customer {
  id: string;
  [key: string]: any;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { tenant_id, segment_id } = await req.json().catch(() => ({}));

    console.log(`[evaluate-segments] Starting evaluation for tenant: ${tenant_id || 'all'}, segment: ${segment_id || 'all'}`);

    // Fetch segments to evaluate (auto_update = true means dynamic)
    let segmentsQuery = supabase
      .from('crm_segments')
      .select('id, name, tenant_id, auto_update, conditions, customer_count')
      .eq('auto_update', true);

    if (tenant_id) {
      segmentsQuery = segmentsQuery.eq('tenant_id', tenant_id);
    }
    if (segment_id) {
      segmentsQuery = segmentsQuery.eq('id', segment_id);
    }

    const { data: segments, error: segmentsError } = await segmentsQuery;

    if (segmentsError) {
      console.error('[evaluate-segments] Error fetching segments:', segmentsError);
      throw segmentsError;
    }

    if (!segments || segments.length === 0) {
      console.log('[evaluate-segments] No dynamic segments to evaluate');
      return new Response(
        JSON.stringify({ success: true, message: 'No segments to evaluate', evaluated: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[evaluate-segments] Found ${segments.length} segments to evaluate`);

    const results = [];

    for (const segment of segments as Segment[]) {
      try {
        const segmentStartTime = Date.now();
        console.log(`[evaluate-segments] Evaluating segment: ${segment.name} (${segment.id})`);

        // Get current membership
        const { data: currentMembers, error: membersError } = await supabase
          .from('customer_segments')
          .select('customer_id')
          .eq('segment_id', segment.id);

        if (membersError) {
          console.error(`[evaluate-segments] Error fetching members for segment ${segment.id}:`, membersError);
          continue;
        }

        const currentMemberIds = new Set((currentMembers || []).map(m => m.customer_id));

        // Fetch all customers for this tenant
        const { data: customers, error: customersError } = await supabase
          .from('crm_customers')
          .select('*')
          .eq('tenant_id', segment.tenant_id);

        if (customersError) {
          console.error(`[evaluate-segments] Error fetching customers:`, customersError);
          continue;
        }

        if (!customers || customers.length === 0) {
          console.log(`[evaluate-segments] No customers found for tenant ${segment.tenant_id}`);
          continue;
        }

        // Evaluate each customer against segment conditions
        const matchingCustomerIds = new Set<string>();

        for (const customer of customers as Customer[]) {
          if (evaluateCustomerAgainstSegment(customer, segment.conditions)) {
            matchingCustomerIds.add(customer.id);
          }
        }

        // Calculate entries and exits
        const customersEntering: string[] = [];
        const customersExiting: string[] = [];

        for (const customerId of matchingCustomerIds) {
          if (!currentMemberIds.has(customerId)) {
            customersEntering.push(customerId);
          }
        }

        for (const customerId of currentMemberIds) {
          if (!matchingCustomerIds.has(customerId)) {
            customersExiting.push(customerId);
          }
        }

        console.log(`[evaluate-segments] Segment ${segment.name}: ${customersEntering.length} entering, ${customersExiting.length} exiting`);

        // Process entries - insert into customer_segments
        if (customersEntering.length > 0) {
          const entryRecords = customersEntering.map(customerId => ({
            customer_id: customerId,
            segment_id: segment.id,
            assigned_at: new Date().toISOString(),
          }));

          const { error: insertError } = await supabase
            .from('customer_segments')
            .upsert(entryRecords, {
              onConflict: 'customer_id,segment_id',
              ignoreDuplicates: true
            });

          if (insertError) {
            console.error(`[evaluate-segments] Error inserting membership:`, insertError);
          }
        }

        // Process exits - delete from customer_segments
        if (customersExiting.length > 0) {
          const { error: exitError } = await supabase
            .from('customer_segments')
            .delete()
            .eq('segment_id', segment.id)
            .in('customer_id', customersExiting);

          if (exitError) {
            console.error(`[evaluate-segments] Error removing exited customers:`, exitError);
          }
        }

        // Update segment customer count
        const { error: updateError } = await supabase
          .from('crm_segments')
          .update({
            customer_count: matchingCustomerIds.size,
            updated_at: new Date().toISOString()
          })
          .eq('id', segment.id);

        if (updateError) {
          console.error(`[evaluate-segments] Error updating segment:`, updateError);
        }

        // Log the evaluation duration
        const evaluationDuration = Date.now() - segmentStartTime;
        console.log(`[evaluate-segments] Segment ${segment.name} evaluated in ${evaluationDuration}ms`);

        results.push({
          segment_id: segment.id,
          segment_name: segment.name,
          previous_count: currentMemberIds.size,
          new_count: matchingCustomerIds.size,
          entered: customersEntering.length,
          exited: customersExiting.length,
          duration_ms: evaluationDuration
        });

      } catch (segmentError) {
        console.error(`[evaluate-segments] Error evaluating segment ${segment.id}:`, segmentError);
        results.push({
          segment_id: segment.id,
          segment_name: segment.name,
          error: String(segmentError)
        });
      }
    }

    const totalDuration = Date.now() - startTime;
    console.log(`[evaluate-segments] Completed evaluation in ${totalDuration}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        evaluated: results.length,
        duration_ms: totalDuration,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[evaluate-segments] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Evaluate a customer against segment conditions
 */
function evaluateCustomerAgainstSegment(customer: Customer, conditions: SegmentRule | null): boolean {
  if (!conditions || !conditions.conditions || conditions.conditions.length === 0) {
    return false; // No conditions means no match
  }

  const logic = conditions.logic || 'AND';
  const results = conditions.conditions.map(condition =>
    evaluateCondition(customer, condition)
  );

  if (logic === 'AND') {
    return results.every(r => r);
  } else {
    return results.some(r => r);
  }
}

/**
 * Evaluate a single condition against a customer
 */
function evaluateCondition(customer: Customer, condition: SegmentCondition): boolean {
  const { field, operator, value } = condition;

  // Handle nested fields (e.g., "order_history.total")
  const customerValue = getNestedValue(customer, field);

  switch (operator) {
    case 'equals':
    case 'eq':
    case '=':
      return customerValue === value;

    case 'not_equals':
    case 'neq':
    case '!=':
      return customerValue !== value;

    case 'greater_than':
    case 'gt':
    case '>':
      return Number(customerValue) > Number(value);

    case 'greater_than_or_equal':
    case 'gte':
    case '>=':
      return Number(customerValue) >= Number(value);

    case 'less_than':
    case 'lt':
    case '<':
      return Number(customerValue) < Number(value);

    case 'less_than_or_equal':
    case 'lte':
    case '<=':
      return Number(customerValue) <= Number(value);

    case 'contains':
      return String(customerValue || '').toLowerCase().includes(String(value).toLowerCase());

    case 'not_contains':
      return !String(customerValue || '').toLowerCase().includes(String(value).toLowerCase());

    case 'starts_with':
      return String(customerValue || '').toLowerCase().startsWith(String(value).toLowerCase());

    case 'ends_with':
      return String(customerValue || '').toLowerCase().endsWith(String(value).toLowerCase());

    case 'is_empty':
      return customerValue === null || customerValue === undefined || customerValue === '';

    case 'is_not_empty':
      return customerValue !== null && customerValue !== undefined && customerValue !== '';

    case 'in':
      return Array.isArray(value) && value.includes(customerValue);

    case 'not_in':
      return !Array.isArray(value) || !value.includes(customerValue);

    case 'is_true':
      return customerValue === true;

    case 'is_false':
      return customerValue === false;

    case 'between':
      if (Array.isArray(value) && value.length === 2) {
        const numValue = Number(customerValue);
        return numValue >= Number(value[0]) && numValue <= Number(value[1]);
      }
      return false;

    case 'days_ago_less_than':
      return getDaysAgo(customerValue) < Number(value);

    case 'days_ago_greater_than':
      return getDaysAgo(customerValue) > Number(value);

    default:
      console.warn(`[evaluate-segments] Unknown operator: ${operator}`);
      return false;
  }
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : null;
  }, obj);
}

/**
 * Calculate days ago from a date value
 */
function getDaysAgo(dateValue: any): number {
  if (!dateValue) return Infinity;
  const date = new Date(dateValue);
  if (isNaN(date.getTime())) return Infinity;
  const now = new Date();
  const diffTime = now.getTime() - date.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}