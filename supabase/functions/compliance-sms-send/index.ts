import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ComplianceConfig {
  quiet_hours: {
    start: string;
    end: string;
  };
  timezone: string;
  footer_enabled: boolean;
  footer_text: string;
}

interface Customer {
  id: string;
  phone: string;
  timezone?: string;
  opt_out: boolean;
  sms_opt_in: boolean;
  footer_last_sent_at?: string;
}

// Quiet hours checker
function isQuietHours(config: ComplianceConfig, customerTimezone?: string): { isQuiet: boolean; nextSendTime?: Date } {
  const now = new Date();
  const timezone = customerTimezone || config.timezone;
  
  // For simplicity, we'll use basic hour checking
  // In production, use proper timezone libraries
  const currentHour = now.getHours();
  const startHour = parseInt(config.quiet_hours.start.split(':')[0]);
  const endHour = parseInt(config.quiet_hours.end.split(':')[0]);
  
  let isQuiet = false;
  let nextSendTime: Date | undefined;
  
  if (startHour > endHour) {
    // Quiet hours span midnight (e.g., 20:00 to 08:00)
    isQuiet = currentHour >= startHour || currentHour < endHour;
    
    if (isQuiet) {
      nextSendTime = new Date(now);
      if (currentHour >= startHour) {
        nextSendTime.setDate(nextSendTime.getDate() + 1);
      }
      nextSendTime.setHours(endHour, 0, 0, 0);
    }
  } else {
    isQuiet = currentHour >= startHour && currentHour < endHour;
    
    if (isQuiet) {
      nextSendTime = new Date(now);
      nextSendTime.setHours(endHour, 0, 0, 0);
    }
  }
  
  return { isQuiet, nextSendTime };
}

// Footer injection logic
function shouldInjectFooter(customer: Customer, config: ComplianceConfig): boolean {
  if (!config.footer_enabled) return false;
  if (!customer.footer_last_sent_at) return true;
  
  const lastSent = new Date(customer.footer_last_sent_at);
  const now = new Date();
  const hoursSince = (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60);
  
  return hoursSince >= 24;
}

function composeMessageWithFooter(originalMessage: string, footer: string): string {
  const messageWithFooter = `${originalMessage}\n\n${footer}`;
  
  if (messageWithFooter.length <= 160) {
    return messageWithFooter;
  }
  
  // Handle message splitting
  const maxFirstPart = 160 - ' (1/2)'.length;
  if (originalMessage.length <= maxFirstPart) {
    return `${originalMessage} (1/2)`;
  }
  
  // Smart split at word boundary
  const splitPoint = originalMessage.lastIndexOf(' ', maxFirstPart);
  const validSplitPoint = splitPoint > maxFirstPart * 0.8 ? splitPoint : maxFirstPart;
  
  return `${originalMessage.substring(0, validSplitPoint)} (1/2)`;
}

async function logCompliance(
  supabase: any,
  eventType: string,
  phone: string,
  customerId?: string,
  campaignId?: string,
  meta?: any
) {
  try {
    await supabase
      .from('compliance_logs')
      .insert({
        tenant_id: '00000000-0000-0000-0000-000000000000',
        user_id: '00000000-0000-0000-0000-000000000000',
        event_type: eventType,
        msisdn: phone,
        campaign_id: campaignId,
        meta: meta || {}
      });
  } catch (error) {
    console.error('Failed to log compliance event:', error);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      to, 
      body, 
      campaignId, 
      skipQuietHours = false,
      isKeywordResponse = false 
    } = await req.json();

    if (!to || !body) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: to, body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const cleanedPhone = to.replace(/^\+?1?/, '').replace(/\D/g, '');

    // Get customer and compliance settings
    const [customerResult, complianceResult] = await Promise.all([
      supabase
        .from('crm_customers')
        .select('*')
        .eq('phone', cleanedPhone)
        .single(),
      supabase
        .from('company_profiles')
        .select('compliance_settings')
        .limit(1)
        .single()
    ]);

    const customer = customerResult.data;
    const complianceSettings = complianceResult.data?.compliance_settings || {
      quiet_hours: { start: '20:00', end: '08:00' },
      timezone: 'America/New_York',
      footer_enabled: true,
      footer_text: 'Reply STOP to opt out, HELP for help. Msg&Data Rates May Apply.'
    };

    // Pre-flight opt-out check
    if (customer && (customer.opt_out || !customer.sms_opt_in)) {
      await logCompliance(
        supabase,
        'blocked_send',
        cleanedPhone,
        customer.id,
        campaignId,
        { reason: 'opted_out', original_message: body }
      );

      return new Response(
        JSON.stringify({
          error: 'Message blocked: recipient has opted out',
          error_code: 451,
          blocked_numbers: [to]
        }),
        { status: 451, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Quiet hours check (skip for keyword responses)
    if (!isKeywordResponse && !skipQuietHours) {
      const quietCheck = isQuietHours(complianceSettings, customer?.timezone);
      
      if (quietCheck.isQuiet) {
        await logCompliance(
          supabase,
          'deferred_send',
          cleanedPhone,
          customer?.id,
          campaignId,
          {
            quiet_hours_config: complianceSettings.quiet_hours,
            next_send_time: quietCheck.nextSendTime,
            original_message: body
          }
        );

        return new Response(
          JSON.stringify({
            status: 'deferred',
            reason: 'quiet_hours',
            next_send_time: quietCheck.nextSendTime,
            deferred_by_quiet_hours: true
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Footer injection
    let finalMessage = body;
    let footerInjected = false;

    if (customer && shouldInjectFooter(customer, complianceSettings)) {
      finalMessage = composeMessageWithFooter(body, complianceSettings.footer_text);
      footerInjected = true;

      // Update footer last sent timestamp
      await supabase
        .from('crm_customers')
        .update({ footer_last_sent_at: new Date().toISOString() })
        .eq('id', customer.id);

      await logCompliance(
        supabase,
        'footer_inserted',
        cleanedPhone,
        customer.id,
        campaignId,
        { footer_text: complianceSettings.footer_text }
      );
    }

    // Send the SMS via existing send-sms function
    const sendResult = await supabase.functions.invoke('send-sms', {
      body: {
        to,
        body: finalMessage,
        skipOptOutCheck: true // We already checked
      }
    });

    if (sendResult.error) {
      throw new Error(sendResult.error.message);
    }

    return new Response(
      JSON.stringify({
        ...sendResult.data,
        footer_injected: footerInjected,
        compliance_checked: true
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Compliance SMS send error:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to send SMS',
        details: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});