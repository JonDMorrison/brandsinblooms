import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, handleCorsPrelight } from '../_shared/cors.ts';

serve(async (req: Request) => {
  // Handle CORS
  const corsResponse = handleCorsPrelight(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const url = new URL(req.url);
    const sessionToken = url.searchParams.get('session') || url.searchParams.get('state');
    const success = url.searchParams.get('success');
    const error = url.searchParams.get('error');

    console.log('Domain Connect callback:', { sessionToken, success, error });

    if (!sessionToken) {
      return new Response(
        `<html><body><h1>Error</h1><p>Missing session token</p></body></html>`,
        { status: 400, headers: { 'Content-Type': 'text/html', ...corsHeaders } }
      );
    }

    // Update session status
    const status = success === 'true' || success === '1' ? 'applied' : 'failed';
    const { error: updateError } = await supabase
      .from('domain_connect_sessions')
      .update({
        status,
        completed_at: new Date().toISOString()
      })
      .eq('session_token', sessionToken);

    if (updateError) {
      console.error('Failed to update session:', updateError);
    }

    // If successful, mark DNS records as applied
    if (status === 'applied') {
      const { data: session } = await supabase
        .from('domain_connect_sessions')
        .select('domain, tenant_id')
        .eq('session_token', sessionToken)
        .single();

      if (session) {
        // Find the domain record
        const { data: emailDomain } = await supabase
          .from('email_domains')
          .select('id')
          .eq('domain', session.domain)
          .eq('tenant_id', session.tenant_id)
          .single();

        if (emailDomain) {
          // Mark DNS records as applied automatically
          await supabase
            .from('email_dns_records')
            .update({
              applied_automatically: true,
              applied_provider: 'domain_connect',
              applied_at: new Date().toISOString()
            })
            .eq('email_domain_id', emailDomain.id);

          console.log('Marked DNS records as applied for domain:', session.domain);
        }
      }
    }

    // Redirect back to the app with status
    const appBaseUrl = Deno.env.get('APP_BASE_URL') || 'http://localhost:5173';
    const redirectUrl = `${appBaseUrl}/domains?dc_status=${status}&session=${sessionToken}`;

    return new Response(
      `<html>
        <head><title>Domain Connect</title></head>
        <body>
          <h1>${status === 'applied' ? 'Success!' : 'Setup Failed'}</h1>
          <p>${status === 'applied' 
            ? 'DNS records have been applied successfully. Redirecting...' 
            : 'There was an issue applying DNS records. You can try again or set up DNS manually.'
          }</p>
          <script>
            setTimeout(() => {
              window.location.href = '${redirectUrl}';
            }, 2000);
          </script>
        </body>
      </html>`,
      { 
        status: 200, 
        headers: { 'Content-Type': 'text/html', ...corsHeaders } 
      }
    );

  } catch (error) {
    console.error('Domain Connect callback error:', error);
    
    const appBaseUrl = Deno.env.get('APP_BASE_URL') || 'http://localhost:5173';
    const redirectUrl = `${appBaseUrl}/domains?dc_status=error`;

    return new Response(
      `<html>
        <head><title>Domain Connect Error</title></head>
        <body>
          <h1>Error</h1>
          <p>Something went wrong. Redirecting back to the application...</p>
          <script>
            setTimeout(() => {
              window.location.href = '${redirectUrl}';
            }, 2000);
          </script>
        </body>
      </html>`,
      { 
        status: 500, 
        headers: { 'Content-Type': 'text/html', ...corsHeaders } 
      }
    );
  }
});