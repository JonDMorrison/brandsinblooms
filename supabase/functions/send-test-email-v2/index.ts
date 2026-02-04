import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { renderEmailForRecipient, type CustomerShape, type CompanyProfileShape } from "../_shared/emailRenderer.ts";
import { resolveSender, buildFromAddress } from "../_shared/senderResolver.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TestSendPayload {
  toEmail: string;
  subject: string;
  html: string;
  customerId?: string;
  sampleCustomer?: {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
  };
  campaignId?: string;
  automationId?: string;
  automationNodeId?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🚀 send-test-email-v2 invoked");

    const payload: TestSendPayload = await req.json();
    const { toEmail, subject, html, customerId, sampleCustomer, campaignId, automationId, automationNodeId } = payload;

    if (!toEmail || !html) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields: toEmail and html" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Auth
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing authorization" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get tenant
    const { data: userRecord } = await supabaseClient
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();
    
    const tenantId = userRecord?.tenant_id;
    if (!tenantId) {
      return new Response(
        JSON.stringify({ success: false, error: "Tenant not found" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Fetch company profile
    const { data: companyProfile } = await supabaseClient
      .from('company_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    // Resolve customer data
    let customer: CustomerShape | null = null;
    
    if (customerId) {
      const { data: customerData } = await supabaseClient
        .from('crm_customers')
        .select('id, email, first_name, last_name, phone, lifetime_value, custom_fields')
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
          custom_fields: customerData.custom_fields as Record<string, unknown> || {},
        };
      }
    } else if (sampleCustomer) {
      customer = {
        email: sampleCustomer.email || 'sample@example.com',
        first_name: sampleCustomer.first_name || 'Jane',
        last_name: sampleCustomer.last_name || 'Gardener',
        phone: sampleCustomer.phone || '(555) 123-4567',
      };
    }

    // Render using unified renderer
    const renderResult = renderEmailForRecipient({
      tenantId,
      campaignId,
      subject: subject || 'Test Email',
      html,
      customer,
      companyProfile: companyProfile as CompanyProfileShape,
      mode: 'send',
      includeFooter: true,
    });

    console.log(`📧 Rendered: usedTags=${renderResult.diagnostics.usedTags.length}, missing=${renderResult.diagnostics.missingTags.length}`);

    // Resolve sender
    const senderConfig = await resolveSender(supabaseClient, tenantId, { userId: user.id });
    const fromAddress = senderConfig ? buildFromAddress(senderConfig) : `${companyProfile?.company_name || 'BloomSuite'} <hello@notify.bloomsuite.app>`;
    // Prioritize domain reply_to, fallback to company sender or user email
    const replyTo = senderConfig?.replyTo || companyProfile?.custom_sender_email || user.email;

    // Send via Resend
    const emailResponse = await resend.emails.send({
      from: fromAddress,
      reply_to: replyTo,
      to: [toEmail],
      subject: `[TEST] ${renderResult.renderedSubject}`,
      html: renderResult.renderedHtml,
    });

    if (emailResponse.error) {
      throw new Error(emailResponse.error.message || "Resend error");
    }

    // Log test send
    await supabaseClient.from('email_test_sends').insert({
      tenant_id: tenantId,
      user_id: user.id,
      campaign_id: campaignId || null,
      automation_id: automationId || null,
      automation_node_id: automationNodeId || null,
      to_email: toEmail,
      subject: renderResult.renderedSubject,
      status: 'sent',
      diagnostics: renderResult.diagnostics,
      customer_id: customerId || null,
    });

    console.log("✅ Test email sent:", emailResponse.data?.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        emailId: emailResponse.data?.id,
        diagnostics: renderResult.diagnostics 
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("❌ send-test-email-v2 error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
