import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      coupon_code, 
      pos_txn_id, 
      net_sales, 
      verification_token 
    } = await req.json();

    if (!coupon_code || !pos_txn_id || !net_sales) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: coupon_code, pos_txn_id, net_sales' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify webhook token (optional security measure)
    const expectedToken = Deno.env.get('POS_WEBHOOK_TOKEN');
    if (expectedToken && verification_token !== expectedToken) {
      return new Response(
        JSON.stringify({ error: 'Invalid verification token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find and validate coupon
    const { data: coupon, error: couponError } = await supabase
      .from('coupons')
      .select('*')
      .eq('code', coupon_code.toUpperCase())
      .single();

    if (couponError || !coupon) {
      return new Response(
        JSON.stringify({ error: 'Coupon not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!coupon.is_active) {
      return new Response(
        JSON.stringify({ error: 'Coupon is not active' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'Coupon has expired' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (coupon.usage_count >= coupon.usage_limit) {
      return new Response(
        JSON.stringify({ error: 'Coupon usage limit exceeded' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (coupon.min_purchase_amount && net_sales < coupon.min_purchase_amount) {
      return new Response(
        JSON.stringify({ error: 'Minimum purchase amount not met' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Redeem the coupon
    const { error: updateError } = await supabase
      .from('coupons')
      .update({
        usage_count: coupon.usage_count + 1,
        redeemed_at: new Date().toISOString(),
        pos_txn_id,
        net_sales,
        is_active: coupon.usage_count + 1 >= coupon.usage_limit ? false : coupon.is_active
      })
      .eq('id', coupon.id);

    if (updateError) {
      console.error('Failed to update coupon:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to redeem coupon' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Track analytics event
    await supabase
      .from('analytics_events')
      .insert({
        tenant_id: coupon.tenant_id,
        user_id: '00000000-0000-0000-0000-000000000000', // System user for POS events
        event_type: 'coupon_redeem',
        campaign_id: coupon.campaign_id,
        automation_id: coupon.automation_id,
        payload: {
          coupon_code,
          pos_txn_id,
          net_sales,
          discount_type: coupon.discount_type,
          discount_value: coupon.discount_value,
          timestamp: new Date().toISOString()
        }
      });

    // Calculate discount amount
    let discount_amount = 0;
    if (coupon.discount_type === 'percentage') {
      discount_amount = (net_sales * coupon.discount_value) / 100;
    } else if (coupon.discount_type === 'fixed_amount') {
      discount_amount = Math.min(coupon.discount_value, net_sales);
    }

    return new Response(
      JSON.stringify({
        success: true,
        coupon_code,
        discount_type: coupon.discount_type,
        discount_value: coupon.discount_value,
        discount_amount,
        net_sales,
        redeemed_at: new Date().toISOString()
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('POS redeem error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});