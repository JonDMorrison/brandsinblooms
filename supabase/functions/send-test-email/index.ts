import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TestEmailRequest {
  senderEmail: string;
  testRecipient: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { senderEmail, testRecipient }: TestEmailRequest = await req.json();

    console.log(`Sending test email from ${senderEmail} to ${testRecipient}`);

    const emailResponse = await resend.emails.send({
      from: senderEmail,
      to: [testRecipient],
      subject: "🌱 Custom Domain Email Test - BloomSuite CRM",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #059669; margin-bottom: 10px;">🎉 Success!</h1>
            <p style="color: #6b7280; font-size: 18px;">Your custom domain email is working perfectly!</p>
          </div>
          
          <div style="background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%); padding: 25px; border-radius: 12px; border-left: 4px solid #10b981; margin-bottom: 25px;">
            <h2 style="color: #065f46; margin-top: 0; margin-bottom: 15px;">✅ Domain Verification Complete</h2>
            <p style="color: #047857; margin-bottom: 10px;">
              <strong>Sender:</strong> ${senderEmail}
            </p>
            <p style="color: #047857; margin-bottom: 10px;">
              <strong>Status:</strong> Verified & Active
            </p>
            <p style="color: #047857; margin: 0;">
              Your email campaigns will now be sent from your custom domain with improved deliverability and professional branding.
            </p>
          </div>

          <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
            <h3 style="color: #374151; margin-top: 0; margin-bottom: 15px;">🌿 What's Next?</h3>
            <ul style="color: #6b7280; margin: 0; padding-left: 20px;">
              <li style="margin-bottom: 8px;">Create your first email campaign with your new custom sender</li>
              <li style="margin-bottom: 8px;">Monitor deliverability improvements in your campaign analytics</li>
              <li style="margin-bottom: 8px;">Enjoy better email reputation and customer trust</li>
              <li>Continue growing your garden center's customer relationships</li>
            </ul>
          </div>

          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; font-size: 14px; margin-bottom: 5px;">
              Sent with 💚 from BloomSuite CRM
            </p>
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
              This is a test email to verify your custom domain setup.
            </p>
          </div>
        </div>
      `,
    });

    console.log("Test email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Test email sent successfully",
        emailId: emailResponse.data?.id
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error('Error in send-test-email function:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        details: 'Failed to send test email'
      }),
      {
        status: 500,
        headers: { 
          'Content-Type': 'application/json', 
          ...corsHeaders 
        },
      }
    );
  }
};

serve(handler);