
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

interface TestEmailRequest {
  senderId: string;
  testEmail: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { senderId, testEmail }: TestEmailRequest = await req.json();

    if (!senderId || !testEmail) {
      return new Response(
        JSON.stringify({ error: 'Sender ID and test email are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the email sender details
    const { data: sender, error: senderError } = await supabase
      .from('email_senders')
      .select('*')
      .eq('id', senderId)
      .single();

    if (senderError || !sender) {
      return new Response(
        JSON.stringify({ error: 'Email sender not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!sender.verified) {
      return new Response(
        JSON.stringify({ error: 'Email sender is not verified' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ 
          error: 'Email service not configured',
          message: 'Our team needs to configure the email service. Please contact support for assistance.'
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📧 Sending test email from ${sender.sender_email} to ${testEmail}`);

    const resend = new Resend(resendApiKey);

    try {
      const result = await resend.emails.send({
        from: sender.display_name ? `${sender.display_name} <${sender.sender_email}>` : sender.sender_email,
        to: [testEmail],
        subject: 'Test Email from BloomSuite',
        html: `
          <h2>Test Email Successful! 🎉</h2>
          <p>This is a test email sent from your BloomSuite email sender configuration.</p>
          <div style="background-color: #f8f9fa; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <h3>Sender Details:</h3>
            <ul>
              <li><strong>Email:</strong> ${sender.sender_email}</li>
              ${sender.display_name ? `<li><strong>Display Name:</strong> ${sender.display_name}</li>` : ''}
              <li><strong>Provider:</strong> ${sender.provider}</li>
              <li><strong>Status:</strong> Verified ✅</li>
            </ul>
          </div>
          <p>If you received this email, your sender configuration is working correctly!</p>
          <hr style="margin: 24px 0;">
          <p style="color: #666; font-size: 14px;">
            Sent via BloomSuite • 
            <a href="https://bloomsuite.app" style="color: #0066cc;">bloomsuite.app</a>
          </p>
        `,
      });

      if (result.error) {
        console.error('❌ Resend API error:', result.error);
        return new Response(
          JSON.stringify({ 
            error: 'Failed to send test email',
            message: result.error.message
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`✅ Test email sent successfully:`, result.data);

      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Test email sent successfully!',
          emailId: result.data?.id
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (resendError) {
      console.error('❌ Resend error:', resendError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to send test email',
          message: resendError.message
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('❌ Send test email error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: 'Something went wrong. Please try again or contact support.'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);
