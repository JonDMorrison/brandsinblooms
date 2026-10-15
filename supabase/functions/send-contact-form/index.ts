import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.1.0";
import {renderBloomSystemEmail,bloomEmailCard} from "../../../src/lib/email/premiumBotanical.ts";
import { handleCorsPrelight, corsJsonResponse } from "../_shared/cors.ts";

const escapeHtml = (value: string) => value.replace(/[&<>"\']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "\'": "&#39;" }[character]!));

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

interface ContactFormRequest {
  name: string;
  email: string;
  inquiryTypes: string[];
  message: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  const corsResponse = handleCorsPrelight(req);
  if (corsResponse) return corsResponse;

  try {
    const { name, email, inquiryTypes, message }: ContactFormRequest = await req.json();

    // Validate required fields
    if (typeof name !== "string" || name.trim().length < 2 || name.length > 100 || typeof email !== "string" || email.length > 255 || !Array.isArray(inquiryTypes) || !inquiryTypes.length || inquiryTypes.some(type => typeof type !== "string" || !["pos", "support", "signup", "general", "other"].includes(type)) || typeof message !== "string" || message.trim().length < 10 || message.length > 1000) {
      return corsJsonResponse(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return corsJsonResponse(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Map inquiry types to readable labels
    const inquiryLabels = {
      pos: "BloomSuite POS Demonstration",
      support: "Support & Technical Help",
      signup: "Signing Up & Getting Started", 
      general: "General Inquiry",
      other: "Other"
    };

    const selectedInquiries = inquiryTypes
      .map(type => inquiryLabels[type as keyof typeof inquiryLabels])
      .filter(Boolean)
      .join(", ");

    // Create email content
    const emailSubject = `Contact Form: ${name} - ${selectedInquiries}`;
    const emailHtml=renderBloomSystemEmail({
      eyebrow:"NEW INQUIRY",
      title:"A new message for your team",
      icon:"mail",
      preheader:emailSubject,
      bodyHtml:bloomEmailCard("Contact information",[
        {label:"Name",value:name,icon:"leaf"},
        {label:"Email",value:email,icon:"mail"},
        {label:"Inquiry",value:selectedInquiries,icon:"leaf"},
        {label:"Received",value:new Date().toLocaleString(),icon:"calendar"},
      ],"mail")+
      '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:18px 0;border:1px solid #DBE3DF;border-radius:12px;background:#F8F9F6"><tr><td style="padding:17px">'+
      '<h2 style="margin:0 0 10px;font-size:19px;color:#1B3049">Message</h2>'+
      '<p style="margin:0;color:#536475;white-space:pre-wrap;line-height:1.6">'+escapeHtml(message)+'</p>'+
      '</td></tr></table>',
      footer:"Sent through the BloomSuite contact form.",
    });

    // Send email to founders and the public support inbox
    const recipients = [
      "jon@brandsinblooms.com",
      "jeff@brandsinblooms.com",
      "support@brandsinblooms.com",
    ];

    const emailResponse = await resend.emails.send({
      from: "BloomSuite Contact <support@brandsinblooms.com>",
      to: recipients,
      reply_to: email, // Reply goes to the person who submitted the contact form
      subject: emailSubject,
      html: emailHtml,
    });

    if (emailResponse.error || !emailResponse.data?.id) {
      console.error("Contact email delivery was rejected");
      return corsJsonResponse({ error: "Your message could not be delivered. Please try again." }, { status: 502 });
    }

    return corsJsonResponse({
      success: true,
      message: "Contact form submitted successfully"
    });

  } catch (error: any) {
    console.error("Error in send-contact-form function:", error);
    return corsJsonResponse(
      { error: "Your message could not be delivered. Please try again." },
      { status: 500 }
    );
  }
};

serve(handler);
