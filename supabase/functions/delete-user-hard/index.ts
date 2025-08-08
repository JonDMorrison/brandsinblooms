
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.38.0';
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HardDeleteRequest {
  userId: string;
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const resendApiKey = Deno.env.get('RESEND_API_KEY');
const fbClientId = Deno.env.get('FB_CLIENT_ID');
const fbClientSecret = Deno.env.get('FB_CLIENT_SECRET');

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const resend = resendApiKey ? new Resend(resendApiKey) : null;

async function revokeFacebookTokens(userId: string) {
  try {
    // Get user's social connections
    const { data: connections } = await supabase
      .from('social_connections')
      .select('platform, platform_account_id, access_token, page_id')
      .eq('user_id', userId)
      .in('platform', ['facebook', 'instagram']);

    if (!connections?.length || !fbClientId || !fbClientSecret) return;

    for (const connection of connections) {
      try {
        // Revoke Facebook/Instagram tokens via Graph API
        const revokeUrl = connection.page_id 
          ? `https://graph.facebook.com/${connection.page_id}/access_token`
          : `https://graph.facebook.com/${connection.platform_account_id}/permissions`;

        await fetch(revokeUrl, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${connection.access_token}`,
            'Content-Type': 'application/json',
          },
        });

        console.log(`Revoked ${connection.platform} token for user ${userId}`);
      } catch (error) {
        console.error(`Failed to revoke ${connection.platform} token:`, error);
      }
    }
  } catch (error) {
    console.error('Error revoking Facebook tokens:', error);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate caller and restrict to super admins
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: userDataAuth, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userDataAuth?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const adminEmails = ['jon@getclear.ca', 'jeff@brandsinblooms.com'];
    const callerEmail = userDataAuth.user.email ?? '';
    if (!adminEmails.includes(callerEmail)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { userId }: HardDeleteRequest = await req.json();

    if (!userId) {
      throw new Error('User ID is required');
    }
    // Get user email before deletion for confirmation email
    const { data: userData } = await supabase.auth.admin.getUserById(userId);
    const userEmail = userData.user?.email;

    // Revoke external API tokens (Facebook/Instagram)
    await revokeFacebookTokens(userId);

    // Hard delete user data from all tables
    const { error: deleteError } = await supabase.rpc('admin_delete_user', {
      target_user_id: userId
    });

    if (deleteError) {
      console.error('Hard delete error:', deleteError);
      throw new Error('Failed to delete user data');
    }

    // Update deletion request status
    const { error: updateError } = await supabase
      .from('deletion_requests')
      .update({
        status: 'completed',
        hard_delete_completed_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    if (updateError) {
      console.error('Failed to update deletion request status:', updateError);
    }

    // Send final confirmation email
    if (resend && userEmail) {
      try {
        await resend.emails.send({
          from: 'BloomSuite <noreply@bloomsuite.com>',
          to: [userEmail],
          subject: 'Account Permanently Deleted - BloomSuite',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #dc2626;">Account Permanently Deleted</h1>
              <p>Your BloomSuite account and all associated data has been permanently deleted.</p>
              
              <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0;">What was deleted:</h3>
                <ul>
                  <li>Company profile and business information</li>
                  <li>All content, campaigns, and marketing materials</li>
                  <li>Social media connections and scheduled posts</li>
                  <li>Analytics data and performance metrics</li>
                  <li>Account preferences and settings</li>
                  <li>Billing history and subscription information</li>
                </ul>
              </div>
              
              <p>Thank you for using BloomSuite. If you have any questions about this deletion, please contact us at <a href="mailto:privacy@bloomsuite.com">privacy@bloomsuite.com</a></p>
              
              <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                This is a final confirmation that your account deletion has been completed.
              </p>
            </div>
          `,
        });
      } catch (emailError) {
        console.error('Email sending error:', emailError);
      }
    }

    console.log(`Successfully completed hard delete for user ${userId}`);

    return new Response(
      JSON.stringify({ success: true, deletedAt: new Date().toISOString() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Hard delete error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
