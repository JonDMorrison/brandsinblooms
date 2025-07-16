import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const email = url.searchParams.get('email');
    const tenantId = url.searchParams.get('tenant_id');
    const token = url.searchParams.get('token');

    if (!email || !tenantId) {
      return new Response(getUnsubscribeHTML('Invalid unsubscribe link'), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'text/html' }
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Simple token validation (email + tenant_id base64 encoded)
    const expectedToken = btoa(`${email}:${tenantId}`);
    if (token !== expectedToken) {
      return new Response(getUnsubscribeHTML('Invalid unsubscribe token'), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'text/html' }
      });
    }

    // Update or insert subscription record
    const { error: upsertError } = await supabase
      .from('crm_subscriptions')
      .upsert({
        email: email,
        tenant_id: tenantId,
        opt_out: true,
        opt_out_at: new Date().toISOString(),
        source: 'unsubscribe_link'
      }, {
        onConflict: 'email,tenant_id'
      });

    if (upsertError) {
      console.error('Error updating subscription:', upsertError);
      return new Response(getUnsubscribeHTML('Error processing unsubscribe request'), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'text/html' }
      });
    }

    console.log(`Successfully unsubscribed ${email} for tenant ${tenantId}`);

    return new Response(getUnsubscribeHTML('You have been successfully unsubscribed', true), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'text/html' }
    });

  } catch (error) {
    console.error('Error in handle-unsubscribe function:', error);
    return new Response(getUnsubscribeHTML('An error occurred while processing your request'), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'text/html' }
    });
  }
});

function getUnsubscribeHTML(message: string, success = false): string {
  const status = success ? 'success' : 'error';
  const bgColor = success ? '#f0f9ff' : '#fef2f2';
  const borderColor = success ? '#0ea5e9' : '#ef4444';
  const textColor = success ? '#0c4a6e' : '#7f1d1d';

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Unsubscribe - BloomSuite</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background-color: #f8fafc;
          margin: 0;
          padding: 20px;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
        }
        .container {
          background: white;
          border-radius: 8px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          padding: 40px;
          max-width: 500px;
          text-align: center;
        }
        .status-box {
          background-color: ${bgColor};
          border: 2px solid ${borderColor};
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 20px;
        }
        .status-text {
          color: ${textColor};
          font-size: 18px;
          font-weight: 600;
          margin: 0;
        }
        .logo {
          font-size: 24px;
          font-weight: bold;
          color: #22c55e;
          margin-bottom: 20px;
        }
        .footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          color: #6b7280;
          font-size: 14px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">🌿 BloomSuite</div>
        <div class="status-box">
          <p class="status-text">${message}</p>
        </div>
        ${success ? `
          <p>You will no longer receive emails from this sender. If you believe this was done in error, please contact the sender directly.</p>
        ` : ''}
        <div class="footer">
          <p>If you have any questions, please contact support.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}