
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.38.0';
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DeleteAccountRequest {
  userId: string;
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const resendApiKey = Deno.env.get('RESEND_API_KEY');

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const resend = resendApiKey ? new Resend(resendApiKey) : null;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the authorization header and verify the user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Invalid authentication');
    }

    const { userId }: DeleteAccountRequest = await req.json();

    // Verify user can only delete their own account
    if (user.id !== userId) {
      throw new Error('Unauthorized');
    }

    // Check if user already has a pending deletion request
    const { data: existingRequest } = await supabase
      .from('deletion_requests')
      .select('id, status')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .maybeSingle();

    if (existingRequest) {
      throw new Error('Account deletion already requested');
    }

    // Check for active subscription that isn't free trial
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('plan, end_date')
      .eq('user_id', userId)
      .eq('deleted_at', null)
      .maybeSingle();

    if (subscription && subscription.plan !== 'free_trial' && 
        new Date(subscription.end_date) > new Date()) {
      throw new Error('Please cancel your active subscription first');
    }

    // Soft delete user data
    const { error: softDeleteError } = await supabase.rpc('soft_delete_user_data', {
      target_user_id: userId
    });

    if (softDeleteError) {
      console.error('Soft delete error:', softDeleteError);
      throw new Error('Failed to delete user data');
    }

    // Create deletion request with 30-day grace period
    const scheduledDeleteAt = new Date();
    scheduledDeleteAt.setDate(scheduledDeleteAt.getDate() + 30);

    const { error: requestError } = await supabase
      .from('deletion_requests')
      .insert({
        user_id: userId,
        scheduled_hard_delete_at: scheduledDeleteAt.toISOString(),
        status: 'pending'
      });

    if (requestError) {
      console.error('Deletion request error:', requestError);
      throw new Error('Failed to create deletion request');
    }

    // Send deletion confirmation email
    if (resend && user.email) {
      try {
        await resend.emails.send({
          from: 'BloomSuite <noreply@bloomsuite.com>',
          to: [user.email],
          subject: 'Account Deletion Scheduled - BloomSuite',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #dc2626;">Account Deletion Scheduled</h1>
              <p>We have received your request to delete your BloomSuite account.</p>
              
              <div style="background-color: #fef2f2; border: 1px solid #fecaca; padding: 16px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #dc2626; margin-top: 0;">Important Information:</h3>
                <ul style="color: #dc2626;">
                  <li>Your account is scheduled for permanent deletion on <strong>${scheduledDeleteAt.toLocaleDateString()}</strong></li>
                  <li>All your data, content, and campaigns will be permanently removed</li>
                  <li>Social media connections will be revoked</li>
                  <li>This action cannot be undone after the deletion date</li>
                </ul>
              </div>
              
              <h3>Grace Period</h3>
              <p>You have 30 days to change your mind. If you want to reactivate your account:</p>
              <ol>
                <li>Log back into BloomSuite before ${scheduledDeleteAt.toLocaleDateString()}</li>
                <li>Your account and data will be restored automatically</li>
              </ol>
              
              <p>If you have any questions, please contact us at <a href="mailto:support@bloomsuite.com">support@bloomsuite.com</a></p>
              
              <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                This email was sent because you requested account deletion from your BloomSuite account.
              </p>
            </div>
          `,
        });

        // Mark email as sent
        await supabase
          .from('deletion_requests')
          .update({ email_sent: true })
          .eq('user_id', userId)
          .eq('status', 'pending');

      } catch (emailError) {
        console.error('Email sending error:', emailError);
        // Don't fail the whole request if email fails
      }
    }

    return new Response(
      JSON.stringify({ success: true, scheduledDeleteAt }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Delete account error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
