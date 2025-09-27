import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2";
import { corsHeaders, handleCorsPrelight, corsJsonResponse } from "../_shared/cors.ts";

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
    if (!name || !email || !inquiryTypes?.length || !message) {
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
    const emailHtml = `
      <h2>New Contact Form Submission</h2>
      
      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #2563eb;">Contact Information</h3>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Inquiry Type(s):</strong> ${selectedInquiries}</p>
      </div>
      
      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #2563eb;">Message</h3>
        <p style="white-space: pre-wrap; line-height: 1.6;">${message}</p>
      </div>
      
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
      
      <p style="color: #6b7280; font-size: 14px;">
        This message was sent through the BloomSuite contact form on ${new Date().toLocaleString()}.
      </p>
    `;

    // Send email to both recipients
    const recipients = ["jon@brandsinblooms.com", "jeff@brandsinblooms.com"];
    
    const emailResponse = await resend.emails.send({
      from: "BloomSuite Contact Form <contact@resend.dev>",
      to: recipients,
      replyTo: email,
      subject: emailSubject,
      html: emailHtml,
    });

    console.log("Contact form email sent successfully:", emailResponse);

    return corsJsonResponse({
      success: true,
      message: "Contact form submitted successfully"
    });

  } catch (error: any) {
    console.error("Error in send-contact-form function:", error);
    return corsJsonResponse(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
};

serve(handler);