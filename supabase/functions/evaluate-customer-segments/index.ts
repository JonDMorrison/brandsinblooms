import { createClient } from 'npm:@supabase/supabase-js@2';
import { logActivityEvent } from '../_shared/activityLogger.ts';

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
  tenant_id: string;
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

    const { customer_id, tenant_id } = await req.json();

    if (!customer_id || !tenant_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'customer_id and tenant_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[evaluate-customer-segments] Evaluating customer ${customer_id} for tenant ${tenant_id}`);

    // Fetch the customer data
    const { data: customer, error: customerError } = await supabase
      .from('crm_customers')
      .select('*')
      .eq('id', customer_id)
      .eq('tenant_id', tenant_id)
      .single();

    if (customerError || !customer) {
      console.error('[evaluate-customer-segments] Error fetching customer:', customerError);
      return new Response(
        JSON.stringify({ success: false, error: 'Customer not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch all dynamic segments for this tenant
    const { data: segments, error: segmentsError } = await supabase
      .from('crm_segments')
      .select('id, name, tenant_id, auto_update, conditions, customer_count')
      .eq('tenant_id', tenant_id)
      .eq('auto_update', true);

    if (segmentsError) {
      console.error('[evaluate-customer-segments] Error fetching segments:', segmentsError);
      throw segmentsError;
    }

    if (!segments || segments.length === 0) {
      console.log('[evaluate-customer-segments] No dynamic segments to evaluate');
      return new Response(
        JSON.stringify({
          success: true,
          customer_id,
          segments_joined: [],
          segments_left: [],
          total_memberships: 0,
          duration_ms: Date.now() - startTime
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[evaluate-customer-segments] Found ${segments.length} dynamic segments to evaluate`);

    // Get current segment memberships for this customer
    const { data: currentMemberships, error: membershipsError } = await supabase
      .from('customer_segments')
      .select('segment_id')
      .eq('customer_id', customer_id);

    if (membershipsError) {
      console.error('[evaluate-customer-segments] Error fetching memberships:', membershipsError);
    }

    const currentSegmentIds = new Set((currentMemberships || []).map(m => m.segment_id));

    const segmentsJoined: string[] = [];
    const segmentsLeft: string[] = [];
    const segmentsJoinedNames: string[] = [];
    const segmentsLeftNames: string[] = [];

    for (const segment of segments as Segment[]) {
      const matches = evaluateCustomerAgainstSegment(customer as Customer, segment.conditions);
      const isMember = currentSegmentIds.has(segment.id);

      if (matches && !isMember) {
        // Customer should be added to this segment
        const { error: insertError } = await supabase
          .from('customer_segments')
          .upsert({
            customer_id: customer_id,
            segment_id: segment.id,
            assigned_at: new Date().toISOString(),
          }, {
            onConflict: 'customer_id,segment_id',
            ignoreDuplicates: true
          });

        if (insertError) {
          console.error(`[evaluate-customer-segments] Error adding to segment ${segment.id}:`, insertError);
        } else {
          segmentsJoined.push(segment.id);
          segmentsJoinedNames.push(segment.name);
          console.log(`[evaluate-customer-segments] Customer added to segment: ${segment.name}`);

          await logActivityEvent(supabase, {
            tenant_id,
            customer_id,
            actor_type: 'system',
            source: 'automation',
            activity_type: 'segment.joined',
            status: 'success',
            title: `Joined segment: ${segment.name}`,
            description: {
              parts: [
                { type: 'text', text: 'Added to segment ' },
                { type: 'mention', label: segment.name },
              ],
            },
            metadata: {
              segment_id: segment.id,
              segment_name: segment.name,
              customer_name: `${customer.first_name ?? ''} ${customer.last_name ?? ''}`.trim() || customer.email || 'Customer',
              customer_first_name: customer.first_name ?? null,
              customer_last_name: customer.last_name ?? null,
            },
            related_entities: {
              segment_id: segment.id,
              customer_id,
            },
          });
        }
      } else if (!matches && isMember) {
        // Customer should be removed from this segment
        const { error: deleteError } = await supabase
          .from('customer_segments')
          .delete()
          .eq('customer_id', customer_id)
          .eq('segment_id', segment.id);

        if (deleteError) {
          console.error(`[evaluate-customer-segments] Error removing from segment ${segment.id}:`, deleteError);
        } else {
          segmentsLeft.push(segment.id);
          segmentsLeftNames.push(segment.name);
          console.log(`[evaluate-customer-segments] Customer removed from segment: ${segment.name}`);

          await logActivityEvent(supabase, {
            tenant_id,
            customer_id,
            actor_type: 'system',
            source: 'automation',
            activity_type: 'segment.left',
            status: 'success',
            title: `Left segment: ${segment.name}`,
            description: {
              parts: [
                { type: 'text', text: 'Removed from segment ' },
                { type: 'mention', label: segment.name },
              ],
            },
            metadata: {
              segment_id: segment.id,
              segment_name: segment.name,
              customer_name: `${customer.first_name ?? ''} ${customer.last_name ?? ''}`.trim() || customer.email || 'Customer',
              customer_first_name: customer.first_name ?? null,
              customer_last_name: customer.last_name ?? null,
            },
            related_entities: {
              segment_id: segment.id,
              customer_id,
            },
          });
        }
      }
    }

    // Update customer counts for affected segments
    for (const segmentId of [...segmentsJoined, ...segmentsLeft]) {
      const { count, error: countError } = await supabase
        .from('customer_segments')
        .select('*', { count: 'exact', head: true })
        .eq('segment_id', segmentId);

      if (!countError && count !== null) {
        await supabase
          .from('crm_segments')
          .update({
            customer_count: count,
            updated_at: new Date().toISOString()
          })
          .eq('id', segmentId);
      }
    }

    const totalMemberships = currentSegmentIds.size + segmentsJoined.length - segmentsLeft.length;
    const duration = Date.now() - startTime;

    console.log(`[evaluate-customer-segments] Completed in ${duration}ms. Joined: ${segmentsJoined.length}, Left: ${segmentsLeft.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        customer_id,
        segments_joined: segmentsJoinedNames,
        segments_left: segmentsLeftNames,
        segments_joined_ids: segmentsJoined,
        segments_left_ids: segmentsLeft,
        total_memberships: totalMemberships,
        duration_ms: duration
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[evaluate-customer-segments] Error:', error);
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
      console.warn(`[evaluate-customer-segments] Unknown operator: ${operator}`);
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
