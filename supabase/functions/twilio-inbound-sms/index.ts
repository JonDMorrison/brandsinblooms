import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.10';
import { corsHeaders, handleCorsPrelight, corsJsonResponse } from '../_shared/cors.ts';

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

    console.log('Received inbound SMS:', { from, to, body, messageSid });

    // Check for opt-out keywords (STOP, UNSUBSCRIBE, etc.)
    const optOutKeywords = ['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT'];
    const isOptOut = optOutKeywords.some(keyword => 
      body?.toUpperCase().trim() === keyword
    );

    if (isOptOut) {
      // Update customer SMS opt-in status
      const { error: updateError } = await supabase
        .from('crm_customers')
        .update({ 
          sms_opt_in: false,
          updated_at: new Date().toISOString()
        })
        .eq('phone', from);

      if (updateError) {
        console.error('Error updating opt-out status:', updateError);
      } else {
        console.log('Customer opted out:', from);
      }

      // Log compliance action
      await supabase
        .from('compliance_logs')
        .insert({
          customer_phone: from,
          action_type: 'opt_out',
          method: 'sms_reply',
          metadata: { message_sid: messageSid, body }
        });

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

    // Check for opt-in keywords (START)
    const optInKeywords = ['START', 'YES', 'UNSTOP'];
    const isOptIn = optInKeywords.some(keyword => 
      body?.toUpperCase().trim() === keyword
    );

    if (isOptIn) {
      // Update customer SMS opt-in status
      const { error: updateError } = await supabase
        .from('crm_customers')
        .update({ 
          sms_opt_in: true,
          updated_at: new Date().toISOString()
        })
        .eq('phone', from);

      if (updateError) {
        console.error('Error updating opt-in status:', updateError);
      } else {
        console.log('Customer opted in:', from);
      }

      // Log compliance action
      await supabase
        .from('compliance_logs')
        .insert({
          customer_phone: from,
          action_type: 'opt_in',
          method: 'sms_reply',
          metadata: { message_sid: messageSid, body }
        });

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

    // Log all inbound messages for future use
    await supabase
      .from('sms_messages')
      .insert({
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
    console.error('Error processing inbound SMS:', error);
    
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
