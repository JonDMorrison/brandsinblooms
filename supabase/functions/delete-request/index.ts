
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailDeleteRequest {
  fromEmail: string;
  subject: string;
  body: string;
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function isDeleteRequest(subject: string, body: string): boolean {
  const deleteKeywords = [
    'delete', 'deletion', 'remove', 'erase', 'cancel',
    'gdpr', 'privacy', 'data removal', 'account removal'
  ];
  
  const text = (subject + ' ' + body).toLowerCase();
  return deleteKeywords.some(keyword => text.includes(keyword));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // SECURITY: E5 - Add JWT authentication to prevent unauthenticated access
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Authorization required' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  try {
    const { fromEmail, subject, body }: EmailDeleteRequest = await req.json();

    // A deletion request is only ever about the caller's own account (crm-r2-F34): an address that isn't the
    // caller's gets the same refusal as a malformed request, and no other account is looked up.
    const callerEmail = (user.email ?? '').trim().toLowerCase();
    const requestedEmail = typeof fromEmail === 'string' ? fromEmail.trim().toLowerCase() : '';

    if (!requestedEmail || !callerEmail || requestedEmail !== callerEmail || !isDeleteRequest(subject, body)) {
      return new Response(
        JSON.stringify({ error: 'Invalid deletion request' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // One answer whatever the address's state (crm-r1-F14): no account, a pending deletion, a processed request and
    // a failed one all look the same to the caller; the outcome is only logged.
    const processed = () =>
      new Response(
        JSON.stringify({ message: 'Request processed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    // Check if user already has a pending deletion request
    const { data: existingRequest } = await supabase
      .from('deletion_requests')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .maybeSingle();

    if (existingRequest) {
      console.log(`User ${user.id} already has pending deletion request`);
      return processed();
    }

    // Trigger the same deletion process as self-service
    const deleteResponse = await fetch(`${supabaseUrl}/functions/v1/delete-account`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ userId: user.id }),
    });

    if (!deleteResponse.ok) {
      console.error(`delete-request: deletion for user ${user.id} was not processed (${deleteResponse.status})`);
      return processed();
    }

    console.log(`Processed email deletion request for user ${user.id}`);

    return processed();

  } catch (error) {
    console.error('Email deletion request error:', error instanceof Error ? error.message : 'unknown');
    return new Response(
      JSON.stringify({ message: 'Request processed' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
