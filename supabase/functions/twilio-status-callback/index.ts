import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, handleCorsPrelight, corsJsonResponse } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight
  const preflightResponse = handleCorsPrelight(req);
  if (preflightResponse) return preflightResponse;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse Twilio status callback data (form-encoded)
    const formData = await req.formData();
    const messageSid = formData.get('MessageSid') as string;
    const messageStatus = formData.get('MessageStatus') as string;
    const errorCode = formData.get('ErrorCode') as string;
    const errorMessage = formData.get('ErrorMessage') as string;
    const to = formData.get('To') as string;
    const from = formData.get('From') as string;

    console.log('Received status callback:', { 
      messageSid, 
      messageStatus, 
      errorCode, 
      errorMessage,
      to,
      from
    });

    // Map Twilio status to our status
    let status = 'sent';
    let errorText = null;

    switch (messageStatus) {
      case 'delivered':
        status = 'delivered';
        break;
      case 'sent':
        status = 'sent';
        break;
      case 'failed':
        status = 'failed';
        errorText = errorCode === '30034' 
          ? 'Blocked: Unregistered 10DLC number. A2P registration required.'
          : errorMessage || `Twilio error ${errorCode}`;
        break;
      case 'undelivered':
        status = 'failed';
        errorText = errorCode === '30034'
          ? 'Undelivered: Unregistered 10DLC number. A2P registration required.'
          : errorMessage || `Undelivered - Error ${errorCode}`;
        break;
      default:
        status = messageStatus;
    }

    // First get the message to find the customer_id
    const { data: message } = await supabase
      .from('sms_messages')
      .select('id, customer_id, sent_at')
      .eq('twilio_sid', messageSid)
      .maybeSingle();

    // Update the message status in our database
    const { error: updateError } = await supabase
      .from('sms_messages')
      .update({ 
        status,
        error_message: errorText,
        delivered_at: messageStatus === 'delivered' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
        metadata: {
          twilio_status: messageStatus,
          error_code: errorCode,
          error_message: errorMessage
        }
      })
      .eq('twilio_sid', messageSid);

    if (updateError) {
      console.error('Error updating message status:', updateError);
    }

    // Update customer SMS metrics and cross-channel metrics
    if (message?.customer_id) {
      if (messageStatus === 'delivered') {
        const { error: metricsError } = await supabase.rpc('update_customer_sms_metrics', {
          p_customer_id: message.customer_id,
          p_event_type: 'delivered',
        });
        if (metricsError) {
          console.error('Error updating SMS metrics for delivered:', metricsError);
        } else {
          console.log('Updated SMS metrics for delivered message, customer:', message.customer_id);
        }

        // Update cross-channel metrics
        const { error: crossChannelError } = await supabase.rpc('update_cross_channel_metrics', {
          p_customer_id: message.customer_id,
          p_channel: 'sms',
          p_event_type: 'delivered',
        });
        if (crossChannelError) {
          console.error('Error updating cross-channel metrics:', crossChannelError);
        }
      } else if (status === 'failed') {
        const { error: metricsError } = await supabase.rpc('update_customer_sms_metrics', {
          p_customer_id: message.customer_id,
          p_event_type: 'failed',
        });
        if (metricsError) {
          console.error('Error updating SMS metrics for failed:', metricsError);
        }

        // Update cross-channel metrics for failed
        const { error: crossChannelError } = await supabase.rpc('update_cross_channel_metrics', {
          p_customer_id: message.customer_id,
          p_channel: 'sms',
          p_event_type: 'failed',
        });
        if (crossChannelError) {
          console.error('Error updating cross-channel metrics:', crossChannelError);
        }
      }
    }

    // If message failed due to 30034, log it prominently
    if (errorCode === '30034') {
      console.error('⚠️ A2P 10DLC REGISTRATION REQUIRED - Message blocked by carrier');
      console.error('Message SID:', messageSid);
      console.error('To:', to);
      console.error('Error:', errorMessage);
    }

    // Return 200 OK with proper content type (prevents Twilio error 12300)
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });

  } catch (error) {
    console.error('Error processing status callback:', error);
    
    // Always return 200 OK to prevent Twilio retries
    return new Response(JSON.stringify({ success: false, error: 'Internal error' }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  }
});
