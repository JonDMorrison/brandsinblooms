import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";
import {renderBloomSystemEmail,bloomEmailCard,bloomEmailEscape} from "../../../src/lib/email/premiumBotanical.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ConfirmationEmailRequest {
  customerId: string;
  email: string;
  firstName?: string;
  brandName?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { customerId, email, firstName, brandName }: ConfirmationEmailRequest = await req.json();

    console.log(`Sending confirmation email to ${email} for customer ${customerId}`);

    // Generate confirmation token (encrypted customer ID)
    const token = btoa(customerId);
    const confirmUrl = `${Deno.env.get("SUPABASE_URL")?.replace('.supabase.co', '')}/confirm-subscription?token=${token}`;

    // For confirmation emails, reply-to should be configured per tenant if needed
    // For now, use a no-reply pattern since these are automated transactional emails
    const emailResponse = await resend.emails.send({
      from: `${brandName || 'Our Team'} <onboarding@resend.dev>`,
      replyTo: 'noreply@bloomsuite.app', // Automated confirmation - no reply expected
      to: [email],
      subject: `Confirm your subscription to ${brandName || 'our newsletter'}`,
      html: renderBloomSystemEmail({
        brandName:brandName||"BloomSuite",
        eyebrow:"SUBSCRIPTION CONFIRMATION",
        title:"Confirm your subscription",
        preheader:"Please confirm you want to receive updates",
        icon:"mail",
        bodyHtml:'<p>Hi'+(firstName?' '+bloomEmailEscape(firstName):'')+',</p>'+
          '<p>Please confirm that you would like to receive emails from '+
          bloomEmailEscape(brandName||"our team")+'.</p>'+
          bloomEmailCard("What you can expect",[
            {label:"Offers",value:"Exclusive offers and promotions",icon:"check"},
            {label:"News",value:"Product announcements and store updates",icon:"leaf"},
            {label:"Guides",value:"Helpful plant-care tips and seasonal ideas",icon:"sun"},
          ],"mail")+
          '<p>If you did not request these emails, you can ignore this message. You can unsubscribe from future messages at any time.</p>',
        action:{label:"Confirm subscription",url:confirmUrl},
        footer:"© "+new Date().getFullYear()+" "+(brandName||"Our Company")+". All rights reserved.",
      }),
    });

    if (emailResponse.error) {
      console.error("Resend error:", emailResponse.error);
      throw new Error(emailResponse.error.message);
    }

    console.log(`Confirmation email sent successfully to ${email}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        messageId: emailResponse.data?.id 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error sending confirmation email:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
