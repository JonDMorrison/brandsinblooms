import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'
import { renderMergeTags, convertLegacyTags, createMergeTagDataFromCustomer, MergeTagData, GLOBAL_FALLBACKS } from "../_shared/mergeTagEngine.ts";
import { countSmsSegments } from "../_shared/smsSegmentCounter.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RenderPreviewRequest {
  tenantId?: string;
  campaignId?: string;
  messageTemplate?: string;
  mediaUrls?: string[];
  customerId?: string;
  sampleCustomer?: {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    custom?: Record<string, unknown>;
  };
}

/**
 * Extract merge tags used in template and identify missing ones
 */
function analyzeMergeTags(template: string, data: MergeTagData): { usedTags: string[]; missingTags: string[] } {
  const MERGE_TAG_REGEX = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\s*(?:\|\s*default:\s*["']([^"']*)["'])?\s*\}\}/g;
  
  const usedTags: string[] = [];
  const missingTags: string[] = [];
  
  let match;
  while ((match = MERGE_TAG_REGEX.exec(template)) !== null) {
    const tagPath = match[1];
    const explicitDefault = match[2];
    
    usedTags.push(`{{${tagPath}}}`);
    
    // Check if the tag has a value in data
    const parts = tagPath.split('.');
    let value: unknown = data;
    for (const part of parts) {
      if (value === null || value === undefined || typeof value !== 'object') {
        value = undefined;
        break;
      }
      value = (value as Record<string, unknown>)[part];
    }
    
    // If no value and no explicit default and no global fallback, it's missing
    if ((value === null || value === undefined || value === '') && 
        explicitDefault === undefined && 
        !GLOBAL_FALLBACKS[tagPath]) {
      missingTags.push(`{{${tagPath}}}`);
    }
  }
  
  return { usedTags: [...new Set(usedTags)], missingTags: [...new Set(missingTags)] };
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

    const body: RenderPreviewRequest = await req.json();
    const { campaignId, messageTemplate, mediaUrls, customerId, sampleCustomer } = body;

    // Get tenant from user
    const { data: userData } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    const tenantId = body.tenantId || userData?.tenant_id;

    // Load message template from campaign if campaignId provided
    let template = messageTemplate || '';
    let campaignMediaUrls: string[] = mediaUrls || [];
    let campaignImageUrl: string | null = null;

    if (campaignId) {
      const { data: campaign, error: campaignError } = await supabase
        .from('crm_sms_campaigns')
        .select('message, media_urls, image_url, tenant_id')
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
      .select('company_name, company_phone, company_email, website_url')
      .eq('user_id', user.id)
      .maybeSingle();

    const companyInfo = companyProfile || {};

    // Build merge tag data
    let mergeTagData: MergeTagData;

    if (customerId) {
      // Load real customer
      const { data: customer, error: customerError } = await supabase
        .from('crm_customers')
        .select('*')
        .eq('id', customerId)
        .eq('tenant_id', tenantId)
        .single();

      if (customerError || !customer) {
        return new Response(
          JSON.stringify({ error: 'Customer not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      mergeTagData = createMergeTagDataFromCustomer(customer, companyInfo);
    } else if (sampleCustomer) {
      // Use sample customer data
      mergeTagData = {
        first_name: sampleCustomer.first_name,
        last_name: sampleCustomer.last_name,
        email: sampleCustomer.email,
        phone: sampleCustomer.phone,
        custom: sampleCustomer.custom || {},
        company: {
          name: companyInfo.company_name,
          phone: companyInfo.company_phone,
          email: companyInfo.company_email,
          website: companyInfo.website_url,
        },
      };
    } else {
      // Empty merge data - will use defaults
      mergeTagData = {
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

    // Analyze tags
    const mergeMeta = analyzeMergeTags(convertedTemplate, mergeTagData);

    // Calculate segment info
    const segmentInfo = countSmsSegments(renderedText);

    // Build MMS info
    const allMediaUrls = campaignImageUrl 
      ? [campaignImageUrl, ...campaignMediaUrls]
      : campaignMediaUrls;
    
    const isMms = allMediaUrls.length > 0;

    console.log(`[sms-render-preview] Rendered message: ${renderedText.length} chars, ${segmentInfo.segments} segments, MMS: ${isMms}`);

    return new Response(
      JSON.stringify({
        success: true,
        renderedText,
        mergeMeta,
        segmentInfo: {
          encoding: segmentInfo.encoding,
          segments: segmentInfo.segments,
          length: segmentInfo.charCount,
          perSegment: segmentInfo.perSegment,
          isMultipart: segmentInfo.isMultipart,
        },
        mms: {
          isMms,
          mediaUrls: allMediaUrls,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[sms-render-preview] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

serve(handler);
