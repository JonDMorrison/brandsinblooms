import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'
import { renderMergeTags, convertLegacyTags, createMergeTagDataFromCustomer, MergeTagData } from "../_shared/mergeTagEngine.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SendTestRequest {
  campaignId?: string;
  messageTemplate?: string;
  mediaUrls?: string[];
  testToPhone: string;
  renderAsCustomerId?: string;
  bypassConsentForTest?: boolean;
}

/**
 * Format phone number to E.164 format
 */
function formatPhoneForTwilio(phone: string): string {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+${cleaned}`;
  }
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  }
  if (phone.startsWith('+') && cleaned.length >= 10) {
    return phone;
  }
  return `+1${cleaned}`;
}

async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: SendTestRequest = await req.json();
    const { campaignId, messageTemplate, mediaUrls, testToPhone, renderAsCustomerId, bypassConsentForTest } = body;

    if (!testToPhone) {
      return new Response(
        JSON.stringify({ error: 'testToPhone is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get tenant from user
    const { data: userData } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    const tenantId = userData?.tenant_id;

    // Validate phone format
    const formattedPhone = formatPhoneForTwilio(testToPhone);
    if (!formattedPhone || formattedPhone.length < 10) {
      return new Response(
        JSON.stringify({ error: 'Invalid phone number format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Load message template from campaign if campaignId provided
    let template = messageTemplate || '';
    let campaignMediaUrls: string[] = mediaUrls || [];
    let campaignImageUrl: string | null = null;
    let fromPhone: string | null = null;

    if (campaignId) {
      const { data: campaign, error: campaignError } = await supabase
        .from('crm_sms_campaigns')
        .select('message, media_urls, image_url, from_phone, tenant_id')
        .eq('id', campaignId)
        .single();

      if (campaignError || !campaign) {
        return new Response(
          JSON.stringify({ error: 'Campaign not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify tenant access
      if (campaign.tenant_id !== tenantId) {
        return new Response(
          JSON.stringify({ error: 'Access denied to this campaign' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      template = campaign.message || template;
      campaignMediaUrls = campaign.media_urls || campaignMediaUrls;
      campaignImageUrl = campaign.image_url;
      fromPhone = campaign.from_phone;
    }

    if (!template) {
      return new Response(
        JSON.stringify({ error: 'Message template is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get company info
    const { data: companyProfile } = await supabase
      .from('company_profiles')
      .select('company_name, company_phone, company_email, website_url, test_numbers')
      .eq('user_id', user.id)
      .maybeSingle();

    const companyInfo = companyProfile || {};

    // Consent bypass validation: only allow if testToPhone is in test_numbers or matches user's phone
    if (bypassConsentForTest) {
      const testNumbers = companyProfile?.test_numbers || [];
      const userPhone = formatPhoneForTwilio(companyInfo.company_phone || '');
      
      if (!testNumbers.includes(formattedPhone) && formattedPhone !== userPhone) {
        console.log(`[sms-send-test] Consent bypass denied: ${formattedPhone} not in allowed test numbers`);
        // Don't bypass - fall through to normal consent check
      }
    }

    // Build merge tag data
    let mergeTagData: MergeTagData;

    if (renderAsCustomerId) {
      // Load real customer for merge tag data
      const { data: customer, error: customerError } = await supabase
        .from('crm_customers')
        .select('*')
        .eq('id', renderAsCustomerId)
        .eq('tenant_id', tenantId)
        .single();

      if (customerError || !customer) {
        return new Response(
          JSON.stringify({ error: 'Customer not found for preview' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      mergeTagData = createMergeTagDataFromCustomer(customer, companyInfo);
    } else {
      // Use sample data with defaults
      mergeTagData = {
        first_name: 'Test',
        last_name: 'User',
        email: 'test@example.com',
        phone: formattedPhone,
        company: {
          name: companyInfo.company_name,
          phone: companyInfo.company_phone,
          email: companyInfo.company_email,
          website: companyInfo.website_url,
        },
      };
    }

    // Convert legacy tags and render
    const convertedTemplate = convertLegacyTags(template);
    const renderedText = renderMergeTags(convertedTemplate, mergeTagData);

    // Get Twilio credentials
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER');
    const twilioMessagingServiceSid = Deno.env.get('TWILIO_MESSAGING_SERVICE_SID');

    if (!twilioAccountSid || !twilioAuthToken) {
      return new Response(
        JSON.stringify({ error: 'Twilio credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine from identity
    const senderPhone = fromPhone 
      ? formatPhoneForTwilio(fromPhone) 
      : (twilioPhoneNumber ? formatPhoneForTwilio(twilioPhoneNumber) : null);

    // Build MMS media URLs
    const allMediaUrls = campaignImageUrl 
      ? [campaignImageUrl, ...campaignMediaUrls]
      : campaignMediaUrls;

    // Build Twilio request
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
    const twilioAuth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);

    const formData = new URLSearchParams();
    formData.append('To', formattedPhone);
    formData.append('Body', renderedText);

    // Use Messaging Service SID if available, otherwise use From number
    if (twilioMessagingServiceSid) {
      formData.append('MessagingServiceSid', twilioMessagingServiceSid);
    } else if (senderPhone) {
      formData.append('From', senderPhone);
    } else {
      return new Response(
        JSON.stringify({ error: 'No sender phone number or messaging service configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Add media URLs for MMS
    for (const mediaUrl of allMediaUrls) {
      formData.append('MediaUrl', mediaUrl);
    }

    console.log(`[sms-send-test] Sending test SMS to ${formattedPhone}`);

    const twilioResponse = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${twilioAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const twilioResult = await twilioResponse.json();

    if (!twilioResponse.ok) {
      console.error('[sms-send-test] Twilio error:', twilioResult);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to send test SMS',
          twilioError: twilioResult.message || twilioResult.error_message,
          code: twilioResult.code,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[sms-send-test] Test SMS sent successfully: ${twilioResult.sid}`);

    return new Response(
      JSON.stringify({
        success: true,
        twilioSid: twilioResult.sid,
        status: twilioResult.status,
        to: twilioResult.to,
        renderedMessage: renderedText,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[sms-send-test] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

serve(handler);
