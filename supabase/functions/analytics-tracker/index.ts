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
    const { event_type, campaign_id, automation_id, contact_id, sms_id, message_type, payload } = await req.json();

    if (!event_type) {
      return new Response(
        JSON.stringify({ error: 'Missing event_type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get authorization header for user context
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user from JWT token
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's tenant
    const { data: userRecord } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (!userRecord?.tenant_id) {
      return new Response(
        JSON.stringify({ error: 'No tenant found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert analytics event
    const { data, error } = await supabase
      .from('analytics_events')
      .insert({
        tenant_id: userRecord.tenant_id,
        user_id: user.id,
        event_type,
        campaign_id,
        automation_id,
        contact_id,
        sms_id,
        message_type,
        payload: payload || {}
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to insert analytics event:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to track event' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle special event types
    if (event_type === 'coupon_redeem' && payload?.coupon_code) {
      // Update coupon redemption
      await supabase
        .from('coupons')
        .update({
          redeemed_at: new Date().toISOString(),
          pos_txn_id: payload.pos_txn_id,
          net_sales: payload.net_sales,
          usage_count: supabase.raw('usage_count + 1')
        })
        .eq('code', payload.coupon_code)
        .eq('tenant_id', userRecord.tenant_id);

      // Update campaign attribution if revenue present
      if (payload.net_sales && campaign_id && contact_id) {
        const { data: existingAttribution } = await supabase
          .from('campaign_attribution')
          .select('*')
          .eq('campaign_id', campaign_id)
          .eq('contact_id', contact_id)
          .single();

        if (existingAttribution) {
          await supabase
            .from('campaign_attribution')
            .update({
              total_revenue: supabase.raw(`total_revenue + ${payload.net_sales}`),
              total_redemptions: supabase.raw('total_redemptions + 1'),
              last_touch_at: new Date().toISOString()
            })
            .eq('id', existingAttribution.id);
        } else {
          await supabase
            .from('campaign_attribution')
            .insert({
              tenant_id: userRecord.tenant_id,
              campaign_id,
              contact_id,
              first_touch_at: new Date().toISOString(),
              last_touch_at: new Date().toISOString(),
              total_revenue: payload.net_sales,
              total_redemptions: 1
            });
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, event_id: data.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Analytics tracking error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});