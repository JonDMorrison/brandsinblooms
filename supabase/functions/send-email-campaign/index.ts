import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from "https://esm.sh/resend@2";
import { renderMergeTags, convertLegacyTags, createMergeTagDataFromCustomer, type MergeTagData } from "../_shared/mergeTagEngine.ts";
import { generateServerFooterHtml, type CompanyProfileData } from "../_shared/footerGenerator.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, traceparent, tracestate',
}

/**
 * Strip ALL existing footer HTML from content to prevent double footers.
 * The server-side footer generator is the single source of truth.
 */
function stripExistingFooter(html: string): string {
  let strippedHtml = html;
  
  // Pattern: Footer wrapper with margin-top: 40px (our generated footer)
  const footerWrapperPattern = /<div[^>]*style="[^"]*margin-top:\s*40px[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>(?=\s*(<\/body>|<\/html>|<\/div>\s*<\/div>\s*$))/gi;
  if (footerWrapperPattern.test(strippedHtml)) {
    console.log("📧 Stripping footer with margin-top:40px pattern");
    strippedHtml = strippedHtml.replace(footerWrapperPattern, '');
  }
  
  // Pattern: Footer with Unsubscribe link inside background-colored container
  const unsubscribeFooterPattern = /<div[^>]*style="[^"]*background-color[^"]*"[^>]*>[\s\S]*?<div[^>]*style="[^"]*max-width:\s*640px[^"]*"[^>]*>[\s\S]*?[Uu]nsubscribe[\s\S]*?<\/div>\s*<\/div>(?=\s*(<\/body>|<\/html>|<\/div>\s*$))/gi;
  if (unsubscribeFooterPattern.test(strippedHtml)) {
    console.log("📧 Stripping unsubscribe footer pattern");
    strippedHtml = strippedHtml.replace(unsubscribeFooterPattern, '');
  }
  
  // Pattern: Social icons from our storage
  const socialIconsFooterPattern = /<div[^>]*style="[^"]*background-color[^"]*"[^>]*>[\s\S]*?social-icons[\s\S]*?<\/div>\s*<\/div>(?=\s*(<\/body>|<\/html>|<\/div>\s*$))/gi;
  if (socialIconsFooterPattern.test(strippedHtml)) {
    console.log("📧 Stripping social icons footer pattern");
    strippedHtml = strippedHtml.replace(socialIconsFooterPattern, '');
  }
  
  // Pattern: Legacy footer with specific dark green background
  const legacyGreenFooterPattern = /<div[^>]*style="[^"]*background-color:\s*#283024[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>(?=\s*(<\/body>|<\/html>|<\/div>\s*$))/gi;
  if (legacyGreenFooterPattern.test(strippedHtml)) {
    console.log("📧 Stripping legacy green footer pattern");
    strippedHtml = strippedHtml.replace(legacyGreenFooterPattern, '');
  }
  
  // Final cleanup: Remove any remaining footer-like structures before closing tags
  const finalCleanupPattern = /<div[^>]*style="[^"]*background-color[^"]*width:\s*100%[^"]*"[^>]*>[\s\S]*?[Uu]nsubscribe[\s\S]*?<\/div>\s*<\/div>(?=\s*(<\/div>)*\s*(<\/body>|<\/html>|$))/gi;
  strippedHtml = strippedHtml.replace(finalCleanupPattern, (match) => {
    console.log("📧 Final cleanup: stripping remaining footer structure");
    return '';
  });
  
  return strippedHtml;
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

    // Get FULL company profile for sender configuration AND footer generation
    const { data: companyProfile, error: profileError } = await supabase
      .from('company_profiles')
      .select(`
        email_auth_status, custom_sender_email, company_name, location_info,
        street_address, city, state_province, postal_code, country,
        website_url, company_email, company_phone,
        facebook_url, instagram_url, tiktok_url, pinterest_url, youtube_url, linkedin_url,
        footer_legal_text, brand_primary_color, brand_text_color, feature_flags
      `)
      .eq('user_id', campaign.user_id)
      .single();

    if (profileError) {
      console.error('Error fetching company profile:', profileError);
    }
    
    console.log('📧 Company profile loaded for footer:', {
      companyName: companyProfile?.company_name,
      hasFacebook: !!companyProfile?.facebook_url,
      hasInstagram: !!companyProfile?.instagram_url,
      hasTiktok: !!companyProfile?.tiktok_url,
      hasPinterest: !!companyProfile?.pinterest_url,
      hasYoutube: !!companyProfile?.youtube_url,
      hasLinkedin: !!companyProfile?.linkedin_url,
    });

    // Get customers based on campaign audience targeting
    // Email opt-in restriction removed - send to all contacts with valid emails
    let customers = [];
    let customersError = null;
    let totalInSegment = 0;

    // Check if campaign has a single segment_id or multiple segments via campaign_segments
    if (campaign.segment_id) {
      console.log(`Targeting single segment: ${campaign.segment_id}`);
      const { data: segmentCustomers, error } = await supabase
        .from('customer_segments')
        .select(`
          crm_customers (
            id, first_name, last_name, email
          )
        `)
        .eq('segment_id', campaign.segment_id);

      if (error) {
        customersError = error;
      } else {
        customers = segmentCustomers
          ?.map(sc => sc.crm_customers)
          .filter(c => c && c.email && c.email.trim() !== '') || [];
        
        totalInSegment = customers.length;
        console.log(`Segment targeting: ${totalInSegment} contacts with valid emails`);
      }
    } else {
      console.log(`Checking for multiple segment targeting...`);
      const { data: campaignSegments, error: segError } = await supabase
        .from('campaign_segments')
        .select('segment_id')
        .eq('campaign_id', campaignId);

      if (segError) {
        customersError = segError;
      } else if (campaignSegments && campaignSegments.length > 0) {
        console.log(`Targeting ${campaignSegments.length} segments:`, campaignSegments.map(cs => cs.segment_id));
        
        const { data: multiSegmentCustomers, error } = await supabase
          .from('customer_segments')
          .select(`
            crm_customers (
              id, first_name, last_name, email
            )
          `)
          .in('segment_id', campaignSegments.map(cs => cs.segment_id));

        if (error) {
          customersError = error;
        } else {
          const customerMap = new Map();
          multiSegmentCustomers?.forEach(sc => {
            const customer = sc.crm_customers;
            if (customer && customer.email && customer.email.trim() !== '' && !customerMap.has(customer.email)) {
              customerMap.set(customer.email, customer);
            }
          });
          customers = Array.from(customerMap.values());
          totalInSegment = customers.length;
          
          console.log(`Multi-segment targeting: ${totalInSegment} contacts with valid emails`);
        }
      } else {
        // No segments selected - send to ALL contacts for this tenant
        console.log(`No segments selected - fetching all contacts for tenant: ${campaign.tenant_id}`);
        
        const { data: allContacts, error: allContactsError } = await supabase
          .from('crm_customers')
          .select('id, first_name, last_name, email')
          .eq('tenant_id', campaign.tenant_id)
          .not('email', 'is', null);
        
        if (allContactsError) {
          customersError = allContactsError;
        } else {
          customers = (allContacts || []).filter(c => c.email && c.email.trim() !== '');
          totalInSegment = customers.length;
          
          console.log(`All contacts mode: Found ${customers.length} contacts`);
        }
      }
    }

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
      const failureReason = 'No contacts found in the selected audience with valid email addresses';
      
      console.error(`Campaign ${campaignId} failed: ${failureReason}`);
      
      await supabase
        .from('crm_campaigns')
        .update({ 
          status: 'failed',
          send_blocked_reason: failureReason,
          metrics: { sent: 0, opens: 0, clicks: 0, unsubscribes: 0 }
        })
        .eq('id', campaignId);

      return new Response(
        JSON.stringify({ 
          error: failureReason,
          details: { totalInSegment }
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const recipientCount = customers.length;
    console.log(`Found ${recipientCount} customers with valid emails`);

    // ========== PRE-SEND QUOTA CHECK ==========
    // Check if sending is allowed before proceeding
    const { data: quotaCheck, error: quotaError } = await supabase.rpc('check_send_quota', {
      p_tenant_id: campaign.tenant_id,
      p_domain_id: campaign.from_email_domain_id || null,
      p_recipient_count: recipientCount
    });

    if (quotaError) {
      console.error('Error checking quota:', quotaError);
      return new Response(
        JSON.stringify({ error: 'Failed to check sending quota' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!quotaCheck?.allowed) {
      console.warn(`Campaign ${campaignId} blocked: ${quotaCheck?.reason} - ${quotaCheck?.message}`);
      
      // Update campaign status to blocked
      await supabase
        .from('crm_campaigns')
        .update({ 
          status: 'blocked',
          send_blocked_reason: quotaCheck?.message || quotaCheck?.reason
        })
        .eq('id', campaignId);

      return new Response(
        JSON.stringify({ 
          error: 'Send blocked',
          reason: quotaCheck?.reason,
          message: quotaCheck?.message
        }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Quota check passed. Domain: ${quotaCheck.domain?.domain || 'fallback'}, Limits: daily ${quotaCheck.limits?.daily_limit}, hourly ${quotaCheck.limits?.hourly_limit}`);

    // ========== DETERMINE SENDER ==========
    let senderEmail: string;
    let senderDisplayName: string;
    let deliveryMethod: string;
    let usesVerifiedDomain: boolean;
    let activeDomainId: string | null = null;
    const companyName = companyProfile?.company_name || 'Your Garden Center';

    if (quotaCheck.using_fallback) {
      // Use fallback sender
      senderEmail = quotaCheck.sender?.from_email || 'noreply@bloomsuite.email';
      senderDisplayName = `${companyName} via BloomSuite`;
      deliveryMethod = 'shared_sender';
      usesVerifiedDomain = false;
      console.log(`Using fallback sender: ${senderEmail}`);
    } else {
      // Use custom domain sender
      senderEmail = quotaCheck.sender?.from_email || 'noreply@bloomsuite.email';
      senderDisplayName = quotaCheck.sender?.from_name || companyName;
      deliveryMethod = 'custom_domain';
      usesVerifiedDomain = true;
      activeDomainId = quotaCheck.domain?.id || null;
      console.log(`Using custom domain: ${senderEmail}`);
    }

    const fromAddress = `${senderDisplayName} <${senderEmail}>`;
    
    // Update campaign with sender configuration
    await supabase
      .from('crm_campaigns')
      .update({
        delivery_method: deliveryMethod,
        sender_display_name: senderDisplayName,
        actual_sender_email: senderEmail,
        from_email_domain_id: activeDomainId
      })
      .eq('id', campaignId);

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

        // Generate unsubscribe token and link
        const unsubscribeToken = btoa(`${customer.email}:${campaign.tenant_id}`);
        const unsubscribeLink = `https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/handle-unsubscribe?email=${encodeURIComponent(customer.email)}&tenant_id=${campaign.tenant_id}&token=${unsubscribeToken}`;

        // Create merge tag data from customer and company info
        const mergeTagData: MergeTagData = createMergeTagDataFromCustomer(customer, {
          company_name: companyName,
          address: companyProfile?.location_info,
          website_url: companyProfile?.custom_sender_email?.split('@')[1]
        });
        
        // Add system URLs
        mergeTagData.system = {
          unsubscribe_url: unsubscribeLink,
          preferences_url: unsubscribeLink.replace('handle-unsubscribe', 'manage-preferences'),
          current_year: new Date().getFullYear().toString(),
          current_date: new Date().toLocaleDateString()
        };

        // Convert legacy tags and render with unified engine
        let emailContent = convertLegacyTags(campaign.content || '');
        let emailSubject = convertLegacyTags(campaign.subject_line || 'Newsletter from your Garden Center');
        
        emailContent = renderMergeTags(emailContent, mergeTagData);
        emailSubject = renderMergeTags(emailSubject, mergeTagData);

        // ALWAYS strip any existing footer and regenerate server-side
        // This ensures a single canonical footer with correct social icons
        console.log(`📧 Stripping any existing footer and regenerating for customer ${customer.id}`);
        
        // Strip ALL existing footer structures aggressively
        emailContent = stripExistingFooter(emailContent);
        
        // Build CompanyProfileData for footer generator
        const profileData: CompanyProfileData = {
          company_name: companyProfile?.company_name,
          company_email: companyProfile?.company_email,
          company_phone: companyProfile?.company_phone,
          website_url: companyProfile?.website_url,
          street_address: companyProfile?.street_address,
          city: companyProfile?.city,
          state_province: companyProfile?.state_province,
          postal_code: companyProfile?.postal_code,
          country: companyProfile?.country,
          facebook_url: companyProfile?.facebook_url,
          instagram_url: companyProfile?.instagram_url,
          tiktok_url: companyProfile?.tiktok_url,
          pinterest_url: companyProfile?.pinterest_url,
          youtube_url: companyProfile?.youtube_url,
          linkedin_url: companyProfile?.linkedin_url,
          footer_legal_text: companyProfile?.footer_legal_text,
          brand_primary_color: companyProfile?.brand_primary_color,
          brand_text_color: companyProfile?.brand_text_color,
          feature_flags: companyProfile?.feature_flags,
        };
        
        const serverFooter = generateServerFooterHtml(
          profileData,
          unsubscribeLink,
          unsubscribeLink.replace('handle-unsubscribe', 'manage-preferences')
        );
        
        // Insert footer before closing body/html tags, or append if no closing tags
        if (emailContent.includes('</body>')) {
          emailContent = emailContent.replace('</body>', `${serverFooter}</body>`);
        } else if (emailContent.includes('</html>')) {
          emailContent = emailContent.replace('</html>', `${serverFooter}</html>`);
        } else {
          emailContent += serverFooter;
        }
        
        console.log(`📧 Footer regenerated for customer ${customer.id}`);

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

        // Prepare email payload with campaign tracking
        const emailPayload: any = {
          from: fromAddress,
          to: [customer.email],
          subject: emailSubject,
          html: emailContent,
          headers: {
            'X-Campaign-ID': campaignId,
            'X-Campaign-Type': 'bulk',
            'X-Tenant-ID': campaign.tenant_id,
            'X-Domain-ID': activeDomainId || 'fallback'
          },
          tags: [
            `campaign:${campaignId}`,
            'type:bulk',
            `tenant:${campaign.tenant_id}`,
            `domain:${activeDomainId || 'fallback'}`
          ]
        };

        // Add reply-to if custom sender is available
        if (usesVerifiedDomain && senderEmail !== 'noreply@bloomsuite.email') {
          emailPayload.reply_to = senderEmail;
        }

        let emailResponse;
        let fallbackUsed = false;

        try {
          emailResponse = await resend.emails.send(emailPayload);
        } catch (senderError: any) {
          // If custom domain fails due to DNS issues, fallback to shared sender
          if (usesVerifiedDomain && senderError.message?.includes('DNS')) {
            console.warn(`DNS error with custom domain for ${customer.email}, falling back to shared sender`);
            
            emailPayload.from = `${companyName} via BloomSuite <noreply@bloomsuite.email>`;
            emailPayload.headers['X-Domain-ID'] = 'fallback';
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
          console.log(`Email sent to ${customer.email}, ID: ${emailResponse.id}${fallbackUsed ? ' (fallback)' : ''}`);
        } else {
          failed++;
          console.error(`Failed to send email to ${customer.email}`);
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error: any) {
        failed++;
        console.error(`Error sending email to customer ${customer.id}:`, error);
      }
    }

    // ========== RECORD USAGE ==========
    // Record email usage for quota tracking
    if (emailsSent > 0 && activeDomainId) {
      const { error: usageError } = await supabase.rpc('record_email_usage', {
        p_domain_id: activeDomainId,
        p_emails_sent: emailsSent
      });
      
      if (usageError) {
        console.error('Error recording email usage:', usageError);
      } else {
        console.log(`Recorded ${emailsSent} emails sent for domain ${activeDomainId}`);
      }
    }

    // Update campaign with final metrics
    const metrics = {
      sent: emailsSent,
      opens: 0,
      clicks: 0,
      unsubscribes: 0
    };

    await supabase
      .from('crm_campaigns')
      .update({ 
        status: 'sent',
        metrics: metrics
      })
      .eq('id', campaignId);

    // Update subscription email usage (legacy tracking)
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
    console.error('❌ CRITICAL ERROR in send-email-campaign function:', {
      error: error.message,
      stack: error.stack,
      name: error.name
    });
    
    // Provide more specific error messages based on error type
    let userMessage = 'Internal server error';
    let statusCode = 500;
    
    if (error.message?.includes('JWT')) {
      userMessage = 'Authentication error - please sign in again';
      statusCode = 401;
    } else if (error.message?.includes('permission') || error.message?.includes('RLS')) {
      userMessage = 'Permission denied - you may not have access to this campaign';
      statusCode = 403;
    } else if (error.message?.includes('timeout') || error.message?.includes('ETIMEDOUT')) {
      userMessage = 'Request timed out - please try again';
      statusCode = 504;
    }
    
    return new Response(
      JSON.stringify({ 
        error: userMessage,
        details: error.message,
        code: error.code || 'UNKNOWN_ERROR'
      }),
      { 
        status: statusCode, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
})