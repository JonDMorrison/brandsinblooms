/**
 * Render Email Preview Edge Function
 * 
 * Server-side email rendering for previews.
 * Uses the same renderer as campaign send and automation execution.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { renderEmailForRecipient, type CustomerShape, type CompanyProfileShape } from "../_shared/emailRenderer.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PreviewRequest {
  tenantId?: string;
  html: string;
  subject?: string;
  customerId?: string;
  sampleCustomer?: {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
  };
  includeFooter?: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: PreviewRequest = await req.json();
    const { html, subject, customerId, sampleCustomer, includeFooter = false } = body;

    if (!html) {
      return new Response(
        JSON.stringify({ error: 'HTML content is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get tenant ID from auth or request
    let tenantId = body.tenantId;
    
    // Try to get from auth header
    const authHeader = req.headers.get('Authorization');
    if (authHeader && !tenantId) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      
      if (user) {
        const { data: userData } = await supabase
          .from('users')
          .select('tenant_id')
          .eq('id', user.id)
          .single();
        
        tenantId = userData?.tenant_id;
      }
    }

    if (!tenantId) {
      // Fallback - use a placeholder for preview
      tenantId = 'preview-tenant';
    }

    console.log(`📧 Render preview: tenantId=${tenantId}, customerId=${customerId || 'sample'}`);

    // Build customer data
    let customer: CustomerShape | null = null;
    let companyProfile: CompanyProfileShape | null = null;

    // Load real customer if ID provided
    if (customerId) {
      const { data: customerData } = await supabase
        .from('crm_customers')
        .select('*')
        .eq('id', customerId)
        .single();

      if (customerData) {
        customer = {
          id: customerData.id,
          email: customerData.email,
          first_name: customerData.first_name,
          last_name: customerData.last_name,
          phone: customerData.phone,
          lifetime_value: customerData.lifetime_value,
          total_spent: customerData.total_spent,
          first_purchase_date: customerData.first_purchase_date,
          last_purchase_date: customerData.last_purchase_date,
          custom_fields: customerData.custom_fields as Record<string, unknown> || {},
        };
      }
    } else if (sampleCustomer) {
      // Use sample customer data
      customer = {
        email: sampleCustomer.email || 'customer@example.com',
        first_name: sampleCustomer.first_name || 'Jane',
        last_name: sampleCustomer.last_name || 'Doe',
        phone: sampleCustomer.phone || '',
      };
    }

    // Load company profile for tenant
    if (tenantId && tenantId !== 'preview-tenant') {
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('tenant_id', tenantId)
        .limit(1)
        .single();

      if (userData) {
        const { data: profileData } = await supabase
          .from('company_profiles')
          .select('*')
          .eq('user_id', userData.id)
          .single();

        if (profileData) {
          companyProfile = {
            company_name: profileData.company_name,
            location_info: profileData.location_info,
            company_email: profileData.company_email,
            company_phone: profileData.company_phone,
            website_url: profileData.website_url,
            street_address: profileData.street_address,
            city: profileData.city,
            state_province: profileData.state_province,
            postal_code: profileData.postal_code,
            facebook_url: profileData.facebook_url,
            instagram_url: profileData.instagram_url,
            tiktok_url: profileData.tiktok_url,
            pinterest_url: profileData.pinterest_url,
            youtube_url: profileData.youtube_url,
            linkedin_url: profileData.linkedin_url,
            brand_primary_color: profileData.brand_primary_color,
            brand_secondary_color: profileData.brand_secondary_color,
            feature_flags: profileData.feature_flags as CompanyProfileShape['feature_flags'],
          };
        }
      }
    }

    // Render using the unified renderer
    const result = renderEmailForRecipient({
      tenantId,
      html,
      subject: subject || '',
      customer,
      companyProfile,
      mode: 'preview',
      includeFooter,
    });

    console.log(`✅ Preview rendered: usedTags=${result.diagnostics.usedTags.length}, missing=${result.diagnostics.missingTags.length}`);

    return new Response(
      JSON.stringify({
        renderedHtml: result.renderedHtml,
        renderedSubject: result.renderedSubject,
        diagnostics: result.diagnostics,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Render preview error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
