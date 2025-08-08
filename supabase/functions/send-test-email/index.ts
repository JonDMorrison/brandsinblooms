import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const RESEND_FROM_ADDRESS = Deno.env.get("RESEND_FROM_ADDRESS");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple error serializer to improve logging
const serializeError = (err: unknown) => {
  try {
    if (err instanceof Error) {
      const anyErr = err as any;
      return {
        name: anyErr.name,
        message: anyErr.message,
        stack: anyErr.stack,
        code: anyErr.code ?? anyErr.statusCode,
        response: anyErr.response ?? anyErr.error ?? null,
      };
    }
    return { error: String(err) };
  } catch {
    return { error: 'Unknown error' };
  }
};

interface TestEmailRequest {
  email?: string;
  subject?: string;
  content?: string;
  testName?: string;
  campaignId?: string; // Add campaign ID for test emails
  // Legacy support for domain verification
  senderEmail?: string;
  testRecipient?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestData: TestEmailRequest = await req.json();

    // Handle legacy domain verification request
    if (requestData.senderEmail && requestData.testRecipient) {
      console.log(`Sending domain verification test from ${requestData.senderEmail} to ${requestData.testRecipient}`);

      const emailResponse = await resend.emails.send({
        from: requestData.senderEmail,
        to: [requestData.testRecipient],
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
                <strong>Sender:</strong> ${requestData.senderEmail}
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

      console.log("Domain verification test email sent successfully:", emailResponse);

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
    }

    // Handle campaign test email request
    const { email, subject, content, testName = 'Test User', campaignId } = requestData;

    if (!email || !content) {
      return new Response(
        JSON.stringify({ error: 'Email address and content are required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email address format' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Sending campaign test email to: ${email}`);

    // Process content with test data
    let processedContent = content;
    processedContent = processedContent.replace(/\{\{first_name\}\}/g, testName);
    processedContent = processedContent.replace(/\{\{firstName\}\}/g, testName);
    processedContent = processedContent.replace(/\{firstName\}/g, testName);
    processedContent = processedContent.replace(/\{\{company_name\}\}/g, 'BloomSuite Test');
    processedContent = processedContent.replace(/\{company_name\}/g, 'BloomSuite Test');
    processedContent = processedContent.replace(/\{\{unsubscribe_link\}\}/g, 'https://bloomsuite.app/unsubscribe/test');
    processedContent = processedContent.replace(/\{unsubscribe_link\}/g, 'https://bloomsuite.app/unsubscribe/test');
    processedContent = processedContent.replace(/\{\{company_website\}\}/g, 'bloomsuite.app');
    processedContent = processedContent.replace(/\{company_website\}/g, 'bloomsuite.app');
    processedContent = processedContent.replace(/\{\{company_address\}\}/g, 'BloomSuite Test Address');
    processedContent = processedContent.replace(/\{company_address\}/g, 'BloomSuite Test Address');

    // Add test header to email
    const testHeader = `
      <div style="background: #f59e0b; color: white; padding: 8px 16px; text-align: center; font-size: 14px; font-weight: 600;">
        🧪 TEST EMAIL - This is a preview of your campaign
      </div>
    `;

    // Ensure footer is included
    if (!processedContent.includes('unsubscribe') && !processedContent.includes('opt-out')) {
      const testFooter = `
        <div style="font-size:12px; color:#888; margin-top:40px; border-top:1px solid #eee; padding-top:20px;">
          You're receiving this test email from BloomSuite.<br>
          This is a preview - <a href="https://bloomsuite.app/unsubscribe/test" style="color:#888;">test unsubscribe link</a><br>
          BloomSuite Test | Test Address
        </div>
      `;
      processedContent += testFooter;
    }

    const finalContent = testHeader + processedContent;

    // Prepare headers with optional campaign tracking
    const emailHeaders: Record<string, string> = {
      'X-Campaign-Type': 'test',
      'X-BloomSuite-Test': 'true'
    };

    // Add campaign ID for test emails if provided
    if (campaignId) {
      emailHeaders['X-Campaign-ID'] = campaignId;
    }

    // Send test email with graceful fallback if domain isn't verified and support custom from
    const configuredFrom = RESEND_FROM_ADDRESS?.trim();
    const primaryFrom = configuredFrom
      ? (configuredFrom.includes('<') ? configuredFrom : `BloomSuite Test <${configuredFrom}>`)
      : 'BloomSuite Test <noreply@bloomsuite.email>';
    const fallbackFrom = 'BloomSuite Test <onboarding@resend.dev>';

    let sentId: string | undefined;
    let usedFrom = primaryFrom;
    try {
      const emailResponse = await resend.emails.send({
        from: primaryFrom,
        to: [email],
        subject: `[TEST] ${subject || 'Email Campaign Preview'}`,
        html: finalContent,
        headers: emailHeaders,
        tags: campaignId
          ? [
              { name: 'campaign', value: campaignId },
              { name: 'type', value: 'test' },
              { name: 'sender', value: 'primary' }
            ]
          : [
              { name: 'type', value: 'test' },
              { name: 'sender', value: 'primary' }
            ]
      });
      console.log('Resend primary response:', emailResponse);
      sentId = (emailResponse as any)?.data?.id ?? (emailResponse as any)?.id;
    } catch (primaryErr) {
      console.error('Resend primary send error:', serializeError(primaryErr));

      // Common cause: unverified sender domain. Try Resend dev domain as fallback.
      try {
        const fallbackResponse = await resend.emails.send({
          from: fallbackFrom,
          to: [email],
          subject: `[TEST] ${subject || 'Email Campaign Preview'}`,
          html: finalContent,
          headers: emailHeaders,
          tags: campaignId
            ? [
                { name: 'campaign', value: campaignId },
                { name: 'type', value: 'test' },
                { name: 'sender', value: 'fallback' }
              ]
            : [
                { name: 'type', value: 'test' },
                { name: 'sender', value: 'fallback' }
              ]
        });
        console.log('Resend fallback response:', fallbackResponse);
        sentId = (fallbackResponse as any)?.data?.id ?? (fallbackResponse as any)?.id;
        usedFrom = fallbackFrom;
      } catch (fallbackErr) {
        console.error('Resend fallback send error:', serializeError(fallbackErr));
        return new Response(
          JSON.stringify({ 
            error: 'Failed to send test email',
            reason: (fallbackErr as any)?.message ?? 'Unknown error',
            details: serializeError(fallbackErr),
            primaryError: serializeError(primaryErr),
            hint: 'Verify your sending domain in Resend or set RESEND_FROM_ADDRESS to a verified sender.'
          }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    }

    if (sentId) {
      console.log(`Campaign test email sent successfully to ${email}, ID: ${sentId}`);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Test email sent successfully to ${email}`,
          emailId: sentId,
          usedFrom
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    } else {
      console.error(`Failed to send test email to ${email} - unknown ID`);
      return new Response(
        JSON.stringify({ error: 'Failed to send test email' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

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