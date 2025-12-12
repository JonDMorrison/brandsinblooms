import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.10';
import { corsHeaders, handleCorsPrelight, corsJsonResponse } from '../_shared/cors.ts';

/**
 * Twilio Inbound SMS Webhook Handler
 * 
 * Handles STOP/START/HELP compliance keywords and logs all compliance events.
 */

Deno.serve(async (req) => {
  // Handle CORS preflight
  const preflightResponse = handleCorsPrelight(req);
  if (preflightResponse) return preflightResponse;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse Twilio webhook data (form-encoded)
    const formData = await req.formData();
    const from = formData.get('From') as string;
    const to = formData.get('To') as string;
    const body = formData.get('Body') as string;
    const messageSid = formData.get('MessageSid') as string;
    const accountSid = formData.get('AccountSid') as string;

    console.log('[twilio-inbound-sms] Received:', { from, to, body, messageSid });

    // Normalize the message body
    const normalizedBody = body?.toUpperCase().trim() || '';

    // Look up customer and tenant
    const { data: customer } = await supabase
      .from('crm_customers')
      .select('id, tenant_id, first_name')
      .eq('phone', from)
      .maybeSingle();

    const tenantId = customer?.tenant_id || null;
    const customerId = customer?.id || null;

    // Check for opt-out keywords (STOP, UNSUBSCRIBE, etc.)
    const optOutKeywords = ['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT'];
    const isOptOut = optOutKeywords.some(keyword => normalizedBody === keyword);

    if (isOptOut) {
      console.log('[twilio-inbound-sms] Processing STOP from:', from);

      // Update customer SMS opt-in status
      const { error: updateError } = await supabase
        .from('crm_customers')
        .update({ 
          sms_opt_in: false,
          opt_out: true,
          updated_at: new Date().toISOString()
        })
        .eq('phone', from);

      if (updateError) {
        console.error('[twilio-inbound-sms] Error updating opt-out status:', updateError);
      } else {
        console.log('[twilio-inbound-sms] Customer opted out:', from);
      }

      // Log to sms_compliance_events
      await supabase
        .from('sms_compliance_events')
        .insert({
          tenant_id: tenantId,
          customer_id: customerId,
          phone: from,
          event_type: 'STOP',
          message_content: body,
          source: 'inbound_sms',
          twilio_sid: messageSid,
          metadata: { account_sid: accountSid, to }
        });

      // Also log to compliance_logs for backward compatibility
      if (tenantId) {
        await supabase
          .from('compliance_logs')
          .insert({
            tenant_id: tenantId,
            msisdn: from,
            event_type: 'sms_opt_out',
            message_content: body,
            user_id: customerId,
            meta: { message_sid: messageSid, keyword: normalizedBody }
          });
      }

      // Respond to Twilio with confirmation message
      const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>You have been unsubscribed. Reply START to opt back in.</Message>
</Response>`;

      return new Response(twimlResponse, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/xml',
        },
      });
    }

    // Check for opt-in keywords (START, YES, UNSTOP)
    const optInKeywords = ['START', 'YES', 'UNSTOP'];
    const isOptIn = optInKeywords.some(keyword => normalizedBody === keyword);

    if (isOptIn) {
      console.log('[twilio-inbound-sms] Processing START from:', from);

      // Update customer SMS opt-in status
      const { error: updateError } = await supabase
        .from('crm_customers')
        .update({ 
          sms_opt_in: true,
          opt_out: false,
          updated_at: new Date().toISOString()
        })
        .eq('phone', from);

      if (updateError) {
        console.error('[twilio-inbound-sms] Error updating opt-in status:', updateError);
      } else {
        console.log('[twilio-inbound-sms] Customer opted in:', from);
      }

      // Log to sms_compliance_events
      await supabase
        .from('sms_compliance_events')
        .insert({
          tenant_id: tenantId,
          customer_id: customerId,
          phone: from,
          event_type: 'START',
          message_content: body,
          source: 'inbound_sms',
          twilio_sid: messageSid,
          metadata: { account_sid: accountSid, to }
        });

      // Also log to compliance_logs for backward compatibility
      if (tenantId) {
        await supabase
          .from('compliance_logs')
          .insert({
            tenant_id: tenantId,
            msisdn: from,
            event_type: 'sms_opt_in',
            message_content: body,
            user_id: customerId,
            meta: { message_sid: messageSid, keyword: normalizedBody }
          });
      }

      // Respond to Twilio with confirmation message
      const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>Welcome back! You are now subscribed to receive messages.</Message>
</Response>`;

      return new Response(twimlResponse, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/xml',
        },
      });
    }

    // Check for HELP keyword
    const isHelp = normalizedBody === 'HELP' || normalizedBody === 'INFO';

    if (isHelp) {
      console.log('[twilio-inbound-sms] Processing HELP from:', from);

      // Log to sms_compliance_events
      await supabase
        .from('sms_compliance_events')
        .insert({
          tenant_id: tenantId,
          customer_id: customerId,
          phone: from,
          event_type: 'HELP',
          message_content: body,
          source: 'inbound_sms',
          twilio_sid: messageSid,
          metadata: { account_sid: accountSid, to }
        });

      // Also log to compliance_logs
      if (tenantId) {
        await supabase
          .from('compliance_logs')
          .insert({
            tenant_id: tenantId,
            msisdn: from,
            event_type: 'sms_help_request',
            message_content: body,
            user_id: customerId,
            meta: { message_sid: messageSid }
          });
      }

      // Respond with help information
      const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>Reply STOP to unsubscribe from messages. Reply START to opt back in. Msg&amp;data rates may apply.</Message>
</Response>`;

      return new Response(twimlResponse, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/xml',
        },
      });
    }

    // Log all other inbound messages
    await supabase
      .from('sms_messages')
      .insert({
        tenant_id: tenantId,
        customer_id: customerId,
        phone: from,
        content: body,
        direction: 'inbound',
        status: 'received',
        twilio_sid: messageSid,
        metadata: {
          account_sid: accountSid,
          to: to
        }
      });

    // Default response (empty - no auto-reply)
    const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response></Response>`;

    return new Response(twimlResponse, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/xml',
      },
    });

  } catch (error) {
    console.error('[twilio-inbound-sms] Error:', error);
    
    // Return empty TwiML response even on error (prevents Twilio retries)
    const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response></Response>`;

    return new Response(twimlResponse, {
      status: 200, // Always return 200 to Twilio
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/xml',
      },
    });
  }
});
