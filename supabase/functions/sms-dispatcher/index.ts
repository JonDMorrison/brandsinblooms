import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.1.0";
import {
  generateServerFooterHtml,
  hasProperFooter,
  type CompanyProfileData,
} from "../_shared/emailFooter.ts";
import { resolveSender, buildFromAddress } from "../_shared/senderResolver.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface OutboxMessage {
  id: string;
  tenant_id: string;
  automation_id?: string;
  customer_id: string;
  message_type: "sms" | "email";
  recipient: string;
  content: string;
  subject?: string;
  template_data: Record<string, any>;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("📨 SMS Dispatcher starting...");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // 1. Fetch messages ready to be sent
    const { data: queuedMessages, error: queueError } = await supabase
      .from("crm_outbox")
      .select("*")
      .eq("status", "queued")
      .lte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(50); // Process in batches

    if (queueError) {
      console.error("❌ Failed to fetch queued messages:", queueError);
      throw queueError;
    }

    console.log(`📋 Found ${queuedMessages?.length || 0} messages to process`);

    let totalSent = 0;
    let totalFailed = 0;

    // 2. Process each message
    for (const message of queuedMessages || []) {
      try {
        // Mark as processing
        await supabase
          .from("crm_outbox")
          .update({ status: "processing" })
          .eq("id", message.id);

        const success = await dispatchMessage(supabase, message);

        if (success) {
          // Mark as sent
          await supabase
            .from("crm_outbox")
            .update({
              status: "sent",
              sent_at: new Date().toISOString(),
            })
            .eq("id", message.id);
          totalSent++;
        } else {
          await handleFailedMessage(supabase, message);
          totalFailed++;
        }
      } catch (error) {
        const messageText =
          error instanceof Error ? error.message : String(error);
        console.error(`❌ Error processing message ${message.id}:`, error);
        await handleFailedMessage(supabase, message, messageText);
        totalFailed++;
      }
    }

    console.log(
      `✅ SMS Dispatch complete. Sent: ${totalSent}, Failed: ${totalFailed}`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        sent: totalSent,
        failed: totalFailed,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  } catch (error) {
    const messageText = error instanceof Error ? error.message : String(error);
    console.error("💥 SMS Dispatcher error:", error);
    return new Response(JSON.stringify({ error: messageText }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

async function dispatchMessage(
  supabase: any,
  message: OutboxMessage,
): Promise<boolean> {
  const { message_type, tenant_id } = message;

  if (message_type === "sms") {
    return await sendSMS(supabase, message);
  } else if (message_type === "email") {
    return await sendEmail(supabase, message);
  }

  console.error(`❌ Unknown message type: ${message_type}`);
  return false;
}

async function sendSMS(
  supabase: any,
  message: OutboxMessage,
): Promise<boolean> {
  try {
    console.log(`📱 Sending SMS to ${message.recipient}`);

    // 1. Get Twilio credentials for this tenant
    const { data: integration } = await supabase
      .from("user_integrations")
      .select("credentials, is_active")
      .eq("tenant_id", message.tenant_id)
      .eq("integration_type", "twilio")
      .eq("is_active", true)
      .single();

    if (!integration || !integration.credentials) {
      console.log(
        `⚠️ No active Twilio integration found for tenant ${message.tenant_id}, falling back to email`,
      );
      // Convert SMS to email fallback
      return await sendEmailFallback(supabase, message);
    }

    const { account_sid, auth_token, phone_number } = integration.credentials;

    if (!account_sid || !auth_token || !phone_number) {
      console.error("❌ Incomplete Twilio credentials");
      return await sendEmailFallback(supabase, message);
    }

    // 2. Send SMS via Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${account_sid}/Messages.json`;

    const formData = new FormData();
    formData.append("From", phone_number);
    formData.append("To", message.recipient);
    formData.append("Body", message.content);

    const response = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${account_sid}:${auth_token}`)}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Twilio API error:`, errorText);
      return false;
    }

    const result = await response.json();
    console.log(`✅ SMS sent successfully. SID: ${result.sid}`);

    // 3. Log successful delivery
    await supabase.from("crm_message_logs").insert({
      outbox_id: message.id,
      tenant_id: message.tenant_id,
      message_type: "sms",
      recipient: message.recipient,
      status: "sent",
      external_id: result.sid,
      metadata: { twilio_response: result },
    });

    return true;
  } catch (error) {
    console.error("❌ SMS sending failed:", error);
    return false;
  }
}

async function sendEmail(
  supabase: any,
  message: OutboxMessage,
): Promise<boolean> {
  try {
    console.log(`📧 Sending email to ${message.recipient}`);

    // Initialize Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("❌ Missing Resend API key");
      return false;
    }

    const resend = new Resend(resendApiKey);

    // Get company profile for footer and sender info
    // First get a user_id from the tenant
    const { data: tenantUser } = await supabase
      .from("users")
      .select("id")
      .eq("tenant_id", message.tenant_id)
      .limit(1)
      .single();

    let companyProfile: CompanyProfileData | null = null;
    let companyName = "Your Garden Center";

    if (tenantUser?.id) {
      const { data: profile } = await supabase
        .from("company_profiles")
        .select(
          `
          company_name, company_email, company_phone, website_url,
          street_address, city, state_province, postal_code, country,
          facebook_url, instagram_url, tiktok_url, pinterest_url, youtube_url, linkedin_url,
          footer_legal_text, brand_primary_color, brand_text_color, feature_flags,
          custom_sender_email
        `,
        )
        .eq("user_id", tenantUser.id)
        .single();

      if (profile) {
        companyProfile = profile;
        companyName = profile.company_name || companyName;
        console.log("📧 Company profile loaded for automation email footer:", {
          companyName: profile.company_name,
          hasFacebook: !!profile.facebook_url,
          hasInstagram: !!profile.instagram_url,
        });
      }
    }

    // Generate unsubscribe link
    const unsubscribeToken = btoa(`${message.recipient}:${message.tenant_id}`);
    const unsubscribeLink = `https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/handle-unsubscribe?email=${encodeURIComponent(message.recipient)}&tenant_id=${message.tenant_id}&token=${unsubscribeToken}`;
    const preferencesLink = unsubscribeLink.replace(
      "handle-unsubscribe",
      "manage-preferences",
    );

    // Prepare email content with proper footer
    let emailContent = message.content;

    // Check if the content already has a proper footer
    if (!hasProperFooter(emailContent) && companyProfile) {
      console.log("📧 Adding server-generated footer to automation email");

      const serverFooter = generateServerFooterHtml(
        companyProfile,
        unsubscribeLink,
        preferencesLink,
      );

      // Wrap content in a container if it's plain text
      if (!emailContent.includes("<html") && !emailContent.includes("<body")) {
        emailContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            ${emailContent}
          </div>
        `;
      }

      // Append footer
      emailContent += serverFooter;
    } else if (!emailContent.includes(unsubscribeLink)) {
      // Minimal fallback footer if no company profile but need unsubscribe
      emailContent += `
        <div style="font-size:12px; color:#888; margin-top:40px; border-top:1px solid #eee; padding-top:20px; text-align:center;">
          <a href="${unsubscribeLink}" style="color:#888;">Unsubscribe</a>
        </div>
      `;
    }

    // Resolve sender using unified sender resolver
    const senderConfig = await resolveSender(supabase, message.tenant_id, {});
    const fromAddress = buildFromAddress(senderConfig);
    // Reply-to: use sender settings with fallback to sender email
    const replyTo = senderConfig.replyTo || senderConfig.fromEmail;

    // Send email via Resend
    const emailResponse = await resend.emails.send({
      from: fromAddress,
      to: [message.recipient],
      reply_to: replyTo,
      subject: message.subject || "Notification from your garden center",
      html: emailContent,
      headers: {
        "X-Tenant-ID": message.tenant_id,
        "X-Automation-ID": message.automation_id || "direct",
      },
    });

    const responseId = (emailResponse as { data?: { id?: string } } | null)
      ?.data?.id;

    if (responseId) {
      console.log(`✅ Email sent successfully. ID: ${responseId}`);

      // Log successful delivery
      await supabase.from("crm_message_logs").insert({
        outbox_id: message.id,
        tenant_id: message.tenant_id,
        message_type: "email",
        recipient: message.recipient,
        status: "sent",
        external_id: responseId,
        metadata: { email_response: emailResponse },
      });

      return true;
    } else {
      console.error("❌ Email sending failed - no response ID");
      return false;
    }
  } catch (error) {
    console.error("❌ Email sending failed:", error);
    return false;
  }
}

async function sendEmailFallback(
  supabase: any,
  message: OutboxMessage,
): Promise<boolean> {
  try {
    console.log(`📧 SMS->Email fallback for ${message.recipient}`);

    // Get customer email if we only have phone
    const { data: customer } = await supabase
      .from("crm_customers")
      .select("email")
      .eq("id", message.customer_id)
      .single();

    if (!customer?.email) {
      console.error("❌ No email address available for SMS fallback");
      return false;
    }

    // Convert SMS content to email format
    const emailContent = `
      <p>We tried to send you an SMS but couldn't reach you. Here's your message:</p>
      <blockquote style="border-left: 3px solid #ccc; margin: 16px 0; padding: 8px 16px; font-style: italic;">
        ${message.content}
      </blockquote>
      <p><small>This message was sent as an email because SMS delivery was not available.</small></p>
    `;

    return await sendEmail(supabase, {
      ...message,
      message_type: "email",
      recipient: customer.email,
      content: emailContent,
      subject: "Message from your garden center",
    });
  } catch (error) {
    console.error("❌ Email fallback failed:", error);
    return false;
  }
}

async function handleFailedMessage(
  supabase: any,
  message: OutboxMessage,
  errorMessage?: string,
) {
  const retryCount = (message as any).retry_count || 0;
  const maxRetries = (message as any).max_retries || 3;

  if (retryCount < maxRetries) {
    // Schedule retry
    const retryDelay = Math.pow(2, retryCount) * 60; // Exponential backoff (1min, 2min, 4min)
    const nextRetryAt = new Date(Date.now() + retryDelay * 1000);

    await supabase
      .from("crm_outbox")
      .update({
        status: "retrying",
        retry_count: retryCount + 1,
        scheduled_at: nextRetryAt.toISOString(),
        error_message: errorMessage,
      })
      .eq("id", message.id);

    console.log(
      `🔄 Scheduled retry ${retryCount + 1}/${maxRetries} for message ${message.id}`,
    );
  } else {
    // Mark as permanently failed
    await supabase
      .from("crm_outbox")
      .update({
        status: "failed",
        error_message: errorMessage || "Max retries exceeded",
      })
      .eq("id", message.id);

    // Log the failure
    await supabase.from("crm_message_logs").insert({
      outbox_id: message.id,
      tenant_id: message.tenant_id,
      message_type: message.message_type,
      recipient: message.recipient,
      status: "failed",
      error_message: errorMessage || "Max retries exceeded",
    });

    console.log(
      `❌ Message ${message.id} permanently failed after ${maxRetries} retries`,
    );
  }
}

serve(handler);
