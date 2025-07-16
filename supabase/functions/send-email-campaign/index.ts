import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from "npm:resend@2.0.0";

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
    const { campaignId } = await req.json();

    if (!campaignId) {
      return new Response(
        JSON.stringify({ error: 'Campaign ID is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Initialize Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      console.error('Missing Resend API key');
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const resend = new Resend(resendApiKey);

    console.log(`Starting email campaign send for campaign: ${campaignId}`);

    // Get campaign details
    const { data: campaign, error: campaignError } = await supabase
      .from('crm_campaigns')
      .select(`
        *,
        crm_segments (
          id,
          name
        )
      `)
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      console.error('Campaign not found:', campaignError);
      return new Response(
        JSON.stringify({ error: 'Campaign not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!campaign.segment_id) {
      return new Response(
        JSON.stringify({ error: 'Campaign has no segment selected' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get customers from the segment
    const { data: customers, error: customersError } = await supabase
      .from('crm_customers')
      .select('id, first_name, last_name, email')
      .not('email', 'is', null)
      .not('email', 'eq', '');

    if (customersError) {
      console.error('Error fetching customers:', customersError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch customers' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!customers || customers.length === 0) {
      await supabase
        .from('crm_campaigns')
        .update({ 
          status: 'failed',
          metrics: { sent: 0, opens: 0, clicks: 0, unsubscribes: 0 }
        })
        .eq('id', campaignId);

      return new Response(
        JSON.stringify({ error: 'No customers found with valid email addresses' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Found ${customers.length} customers with valid emails`);

    // Update campaign status to sending
    await supabase
      .from('crm_campaigns')
      .update({ 
        status: 'sending',
        sent_at: new Date().toISOString()
      })
      .eq('id', campaignId);

    // Send emails to each customer
    let emailsSent = 0;
    let failed = 0;

    for (const customer of customers) {
      try {
        console.log(`Sending email to customer ${customer.id} at ${customer.email}`);

        // Prepare email content with personalization
        let emailContent = campaign.content || '';
        let emailSubject = campaign.subject_line || 'Newsletter from your Garden Center';
        
        if (customer.first_name) {
          emailContent = emailContent.replace(/\{firstName\}/g, customer.first_name);
          emailSubject = emailSubject.replace(/\{firstName\}/g, customer.first_name);
        }

        const emailResponse = await resend.emails.send({
          from: "Garden Center <noreply@resend.dev>",
          to: [customer.email],
          subject: emailSubject,
          html: emailContent,
        });

        if (emailResponse.id) {
          emailsSent++;
          console.log(`Email sent successfully to ${customer.email}, ID: ${emailResponse.id}`);
        } else {
          failed++;
          console.error(`Failed to send email to ${customer.email}`);
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        failed++;
        console.error(`Error sending email to customer ${customer.id}:`, error);
      }
    }

    // Update campaign with final metrics
    const metrics = {
      sent: emailsSent,
      opens: 0, // Will be updated by webhook handlers later
      clicks: 0, // Will be updated by webhook handlers later
      unsubscribes: 0 // Will be updated by webhook handlers later
    };

    await supabase
      .from('crm_campaigns')
      .update({ 
        status: 'sent',
        metrics: metrics
      })
      .eq('id', campaignId);

    // Update subscription email usage
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('email_usage, user_id')
      .eq('user_id', campaign.user_id)
      .single();

    if (!subError && subscription) {
      await supabase
        .from('subscriptions')
        .update({ 
          email_usage: (subscription.email_usage || 0) + emailsSent
        })
        .eq('user_id', campaign.user_id);

      console.log(`Updated email usage for user ${campaign.user_id}: +${emailsSent} emails`);
    }

    console.log(`Campaign ${campaignId} completed. Sent: ${emailsSent}, Failed: ${failed}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        metrics: metrics,
        message: `Email campaign sent successfully to ${emailsSent} customers`
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in send-email-campaign function:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
})