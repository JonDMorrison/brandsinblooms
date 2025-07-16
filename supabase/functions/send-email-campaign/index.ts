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

    // Get campaign details with company profile for sender configuration
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

    // Get company profile for sender configuration
    const { data: companyProfile, error: profileError } = await supabase
      .from('company_profiles')
      .select('email_auth_status, custom_sender_email, company_name')
      .eq('user_id', campaign.user_id)
      .single();

    if (profileError) {
      console.error('Error fetching company profile:', profileError);
      // Continue with fallback sender if profile not found
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

    // Dynamically determine sender configuration based on domain verification
    const isVerified = companyProfile?.email_auth_status === 'verified' && companyProfile?.custom_sender_email;
    const companyName = companyProfile?.company_name || 'Your Garden Center';
    
    let senderEmail: string;
    let senderDisplayName: string;
    let deliveryMethod: string;
    let usesVerifiedDomain: boolean;

    if (isVerified) {
      // Use verified custom domain
      senderEmail = companyProfile.custom_sender_email;
      senderDisplayName = companyName;
      deliveryMethod = 'custom_domain';
      usesVerifiedDomain = true;
      console.log(`Using verified domain: ${senderEmail}`);
    } else {
      // Fallback to shared sender
      senderEmail = 'noreply@bloomsuite.email';
      senderDisplayName = `${companyName} via BloomSuite`;
      deliveryMethod = 'shared_sender';
      usesVerifiedDomain = false;
      console.log(`Using shared sender fallback for: ${companyName}`);
    }

    const fromAddress = `${senderDisplayName} <${senderEmail}>`;
    
    // Update campaign with sender configuration
    await supabase
      .from('crm_campaigns')
      .update({
        delivery_method: deliveryMethod,
        sender_display_name: senderDisplayName,
        actual_sender_email: senderEmail
      })
      .eq('id', campaignId);

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

        // Generate unsubscribe token and link
        const unsubscribeToken = btoa(`${customer.email}:${campaign.tenant_id}`);
        const unsubscribeLink = `https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/handle-unsubscribe?email=${encodeURIComponent(customer.email)}&tenant_id=${campaign.tenant_id}&token=${unsubscribeToken}`;

        // Replace merge tags in content
        emailContent = emailContent.replace(/\{\{unsubscribe_link\}\}/g, unsubscribeLink);
        emailContent = emailContent.replace(/\{\{company_name\}\}/g, companyName);
        emailContent = emailContent.replace(/\{\{company_website\}\}/g, companyProfile?.email_domain || 'your website');
        emailContent = emailContent.replace(/\{\{company_address\}\}/g, companyProfile?.location_info || 'Your Business Address');

        // Check if unsubscribe link is missing and auto-append footer
        if (!emailContent.includes(unsubscribeLink) && !emailContent.includes('{{unsubscribe_link}}')) {
          const autoFooter = `
            <div style="font-size:12px; color:#888; margin-top:40px; border-top:1px solid #eee; padding-top:20px;">
              You're receiving this email from ${companyName} because you signed up for updates.<br>
              To unsubscribe, <a href="${unsubscribeLink}" style="color:#888;">click here</a>.<br>
              ${companyName} | ${companyProfile?.location_info || 'Your Business Address'}
            </div>
          `;
          emailContent += autoFooter;
          console.log(`Auto-appended compliance footer for campaign ${campaignId}`);
        }

        // Create or update subscription record
        await supabase
          .from('crm_subscriptions')
          .upsert({
            email: customer.email,
            tenant_id: campaign.tenant_id,
            user_id: campaign.user_id,
            customer_id: customer.id,
            opt_out: false,
            source: 'campaign'
          }, {
            onConflict: 'email,tenant_id'
          });

        // Prepare email payload
        const emailPayload: any = {
          from: fromAddress,
          to: [customer.email],
          subject: emailSubject,
          html: emailContent,
        };

        // Add reply-to if custom sender is available
        if (isVerified && companyProfile?.custom_sender_email) {
          emailPayload.reply_to = companyProfile.custom_sender_email;
        }

        let emailResponse;
        let fallbackUsed = false;

        try {
          // Attempt to send with configured sender
          emailResponse = await resend.emails.send(emailPayload);
        } catch (senderError: any) {
          // If custom domain fails due to DNS issues, fallback to shared sender
          if (isVerified && senderError.message?.includes('DNS')) {
            console.warn(`DNS error with custom domain for ${customer.email}, falling back to shared sender`);
            
            emailPayload.from = `${companyName} via BloomSuite <noreply@bloomsuite.email>`;
            fallbackUsed = true;
            
            try {
              emailResponse = await resend.emails.send(emailPayload);
            } catch (fallbackError) {
              throw fallbackError;
            }
          } else {
            throw senderError;
          }
        }

        if (emailResponse?.id) {
          emailsSent++;
          const logMessage = fallbackUsed 
            ? `Email sent with fallback sender to ${customer.email}, ID: ${emailResponse.id}`
            : `Email sent successfully to ${customer.email}, ID: ${emailResponse.id}`;
          console.log(logMessage);
          
          // Log delivery method used
          if (fallbackUsed) {
            console.log(`Campaign ${campaignId}: Fallback sender used due to DNS issues`);
          }
        } else {
          failed++;
          console.error(`Failed to send email to ${customer.email}`);
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error: any) {
        failed++;
        console.error(`Error sending email to customer ${customer.id}:`, error);
        
        // Log specific error details for debugging
        if (error.message?.includes('DNS')) {
          console.error(`DNS configuration issue detected for campaign ${campaignId}`);
        }
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