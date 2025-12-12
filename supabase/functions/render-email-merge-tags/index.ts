/**
 * Edge Function: render-email-merge-tags
 * 
 * Renders merge tags in email HTML using the shared merge tag engine.
 * Used by both preview and sending pipelines for consistent rendering.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { renderEmailHtmlWithMergeTags, normalizeMergeTagsInHtml } from "../_shared/renderEmailHtml.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RenderRequest {
  tenantId?: string;
  customerId?: string;
  sampleCustomer?: {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    custom?: Record<string, unknown>;
  };
  html: string;
  mode: 'preview' | 'send';
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: RenderRequest = await req.json();
    const { tenantId, customerId, sampleCustomer, html, mode = 'preview' } = body;

    console.log(`[render-email-merge-tags] Request: mode=${mode}, hasCustomerId=${!!customerId}, hasSampleCustomer=${!!sampleCustomer}`);

    if (!html) {
      return new Response(
        JSON.stringify({ success: false, error: 'HTML content is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let customer: Record<string, unknown> | undefined;
    let companyInfo: Record<string, unknown> = {};

    // Load customer if customerId provided
    if (customerId) {
      console.log(`[render-email-merge-tags] Loading customer: ${customerId}`);
      
      const { data: customerData, error: customerError } = await supabase
        .from('crm_customers')
        .select('*')
        .eq('id', customerId)
        .single();

      if (customerError) {
        console.error(`[render-email-merge-tags] Customer load error:`, customerError);
        return new Response(
          JSON.stringify({ success: false, error: 'Customer not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      customer = customerData;
      
      // Load company info for this tenant
      if (customerData?.tenant_id) {
        const { data: tenantData } = await supabase
          .from('tenants')
          .select('owner_id')
          .eq('id', customerData.tenant_id)
          .single();

        if (tenantData?.owner_id) {
          const { data: companyData } = await supabase
            .from('company_profiles')
            .select('company_name, company_email, company_phone, website_url, street_address, city, state_province, postal_code, country')
            .eq('user_id', tenantData.owner_id)
            .single();

          if (companyData) {
            companyInfo = companyData;
          }
        }
      }
    } else if (tenantId) {
      // Load company info from tenant
      const { data: tenantData } = await supabase
        .from('tenants')
        .select('owner_id')
        .eq('id', tenantId)
        .single();

      if (tenantData?.owner_id) {
        const { data: companyData } = await supabase
          .from('company_profiles')
          .select('company_name, company_email, company_phone, website_url, street_address, city, state_province, postal_code, country')
          .eq('user_id', tenantData.owner_id)
          .single();

        if (companyData) {
          companyInfo = companyData;
        }
      }
    }

    // Render the HTML with merge tags
    const result = renderEmailHtmlWithMergeTags({
      tenantId: tenantId || '',
      html,
      mode,
      customer,
      sampleCustomer,
      companyInfo,
    });

    console.log(`[render-email-merge-tags] Rendered: usedTags=${result.diagnostics.usedTags.length}, missing=${result.diagnostics.missingTags.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        renderedHtml: result.renderedHtml,
        diagnostics: result.diagnostics,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[render-email-merge-tags] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
