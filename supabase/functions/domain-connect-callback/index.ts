import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, handleCorsPrelight } from '../_shared/cors.ts';

// crm-r2-F37: domain-connect issues session tokens with crypto.randomUUID(); nothing else is accepted.
const SESSION_TOKEN_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// crm-r2-F37: the caller goes back to the app with a 303 redirect whose query is built with
// URLSearchParams, so no request value is ever placed in HTML or script.
function redirectToApp(params: Record<string, string>): Response {
  const appBaseUrl = (Deno.env.get('APP_BASE_URL') || 'http://localhost:5173').replace(/\/+$/, '');
  const target = new URL(`${appBaseUrl}/domains`);
  for (const [key, value] of Object.entries(params)) {
    target.searchParams.set(key, value);
  }
  return new Response(null, {
    status: 303,
    headers: { ...corsHeaders, Location: target.toString() },
  });
}

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
    // Handle both session and state parameters for compatibility
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

    if (!SESSION_TOKEN_PATTERN.test(sessionToken)) {
      return new Response(
        `<html><body><h1>Error</h1><p>Invalid session token</p></body></html>`,
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
    return redirectToApp({ dc_status: status, session: sessionToken });

  } catch (error) {
    console.error('Domain Connect callback error:', error);

    return redirectToApp({ dc_status: 'error' });
  }
});