
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

  try {
    const { fromEmail, subject, body }: EmailDeleteRequest = await req.json();

    if (!fromEmail || !isDeleteRequest(subject, body)) {
      return new Response(
        JSON.stringify({ error: 'Invalid deletion request' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Find user by email
    const { data: userData, error: userError } = await supabase.auth.admin.listUsers();
    
    if (userError) {
      throw new Error('Failed to lookup user');
    }

    const user = userData.users.find(u => u.email === fromEmail);
    
    if (!user) {
      console.log(`No user found for email: ${fromEmail}`);
      return new Response(
        JSON.stringify({ message: 'Request processed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user already has a pending deletion request
    const { data: existingRequest } = await supabase
      .from('deletion_requests')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .maybeSingle();

    if (existingRequest) {
      console.log(`User ${user.id} already has pending deletion request`);
      return new Response(
        JSON.stringify({ message: 'Request already processed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
      throw new Error('Failed to process deletion request');
    }

    console.log(`Processed email deletion request for user ${user.id} (${fromEmail})`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Deletion request processed successfully' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Email deletion request error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
