import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MOBILE_TEXT_ALERTS_BASE_URL = Deno.env.get("MOBILE_TEXT_ALERTS_BASE_URL") || "https://api.mobile-text-alerts.com";
const MOBILE_TEXT_ALERTS_API_KEY = Deno.env.get("MOBILE_TEXT_ALERTS_API_KEY");

// Blocked shortener domains
const BLOCKED_SHORTENERS = [
  "bit.ly",
  "bitly.com",
  "tinyurl.com",
  "t.co",
  "rebrand.ly",
  "shorturl.at",
  "is.gd",
  "goo.gl",
  "ow.ly",
  "buff.ly",
];

// Rate limit: 3 per minute per user
const RATE_LIMIT = 3;
const RATE_WINDOW_SECONDS = 60;

type ParsedProviderResponse = {
  ok: boolean;
  status: number;
  contentType: string | null;
  text: string;
  json: any | null;
};

async function parseProviderResponse(res: Response): Promise<ParsedProviderResponse> {
  const contentType = res.headers.get("content-type");
  const text = await res.text();
  let json: any | null = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  return {
    ok: res.ok,
    status: res.status,
    contentType,
    text,
    json,
  };
}

function normalizePhone(phone: string): string {
  // Remove all non-digits
  const digits = phone.replace(/\D/g, "");

  // If starts with 1 and is 11 digits, it's already normalized
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  // If 10 digits, add +1
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  // Return as-is with + prefix if not matching expected formats
  return digits.startsWith("+") ? digits : `+${digits}`;
}

function containsBlockedShortener(message: string): string | null {
  const lowerMessage = message.toLowerCase();
  for (const shortener of BLOCKED_SHORTENERS) {
    if (lowerMessage.includes(shortener)) {
      return shortener;
    }
  }
  return null;
}

function ensureOptOutMessage(message: string): string {
  const optOutPhrases = ["reply stop", "text stop", "stop to opt"];
  const lowerMessage = message.toLowerCase();

  for (const phrase of optOutPhrases) {
    if (lowerMessage.includes(phrase)) {
      return message;
    }
  }

  return `${message.trim()}\n\nReply STOP to opt out.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Check API key
    if (!MOBILE_TEXT_ALERTS_API_KEY) {
      throw new Error("MOBILE_TEXT_ALERTS_API_KEY is not configured");
    }

    // Get auth header and verify user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));

    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    // Parse request body
    const { phone, message, mediaUrl } = await req.json();

    if (!phone || !message) {
      throw new Error("Phone and message are required");
    }

    // Rate limiting check
    const oneMinuteAgo = new Date(Date.now() - RATE_WINDOW_SECONDS * 1000).toISOString();
    const { count: recentCount } = await supabase
      .from("sms_demo_sends")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", oneMinuteAgo);

    if ((recentCount || 0) >= RATE_LIMIT) {
      throw new Error(`Rate limit exceeded. Maximum ${RATE_LIMIT} sends per minute.`);
    }

    // Check for blocked shorteners
    const blockedShortener = containsBlockedShortener(message);
    if (blockedShortener) {
      throw new Error(`Blocked URL shortener detected: ${blockedShortener}. Please use full URLs.`);
    }

    // Normalize phone number
    const normalizedPhone = normalizePhone(phone);
    console.log(`[send-demo-sms] Normalized phone: ${normalizedPhone}`);

    // Ensure opt-out message
    const finalMessage = ensureOptOutMessage(message);

    // Create initial log entry
    const { data: logEntry, error: logError } = await supabase
      .from("sms_demo_sends")
      .insert({
        user_id: user.id,
        phone: normalizedPhone,
        message: finalMessage,
        media_url: mediaUrl || null,
        status: "pending",
      })
      .select()
      .single();

    if (logError) {
      console.error("[send-demo-sms] Failed to create log entry:", logError);
      throw new Error("Failed to log send attempt");
    }

    // Step A: Validate recipient
    console.log(`[send-demo-sms] Validating recipient: ${normalizedPhone}`);
    const validateResponse = await fetch(`${MOBILE_TEXT_ALERTS_BASE_URL}/v3/send/validate-recipients`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MOBILE_TEXT_ALERTS_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipients: [{ number: normalizedPhone, externalId: "bloomsuite_demo" }],
        validateUnsubscribes: true,
      }),
    });

    const validateParsed = await parseProviderResponse(validateResponse);
    const validateData = validateParsed.json ?? {};

    console.log(
      `[send-demo-sms] Validate response (HTTP ${validateParsed.status}, content-type ${validateParsed.contentType}):`,
      JSON.stringify(validateParsed.json ?? { raw: validateParsed.text.substring(0, 500) })
    );

    if (!validateParsed.ok) {
      const errorMessage =
        validateData?.message ||
        validateData?.error ||
        `Recipient validation failed (HTTP ${validateParsed.status}). Raw: ${validateParsed.text.substring(0, 200)}`;

      await supabase
        .from("sms_demo_sends")
        .update({
          status: "failed",
          error: errorMessage,
          provider_payload: validateParsed.json ?? { raw: validateParsed.text },
        })
        .eq("id", logEntry.id);

      throw new Error(errorMessage);
    }

    // Check if any recipients are invalid or unsubscribed
    const invalidList = Array.isArray(validateData?.invalid) ? validateData.invalid : [];
    const unsubscribedList = Array.isArray(validateData?.unsubscribed) ? validateData.unsubscribed : [];

    if (invalidList.length > 0 || unsubscribedList.length > 0) {
      let errorMessage: string;

      if (unsubscribedList.length > 0) {
        errorMessage = "This number has opted out. They must text UNSTOP to opt back in.";
      } else if (invalidList.length > 0) {
        errorMessage = `Invalid phone number: ${invalidList.join(", ")}`;
      } else {
        errorMessage = "Recipient validation failed";
      }

      await supabase
        .from("sms_demo_sends")
        .update({
          status: "failed",
          error: errorMessage,
          provider_payload: validateParsed.json ?? { raw: validateParsed.text },
        })
        .eq("id", logEntry.id);

      throw new Error(errorMessage);
    }

    // Step B: Fetch available templates (required for unverified accounts)
    console.log(`[send-demo-sms] Fetching available templates...`);

    let templateId: string | null = null;

    try {
      const templatesResponse = await fetch(`${MOBILE_TEXT_ALERTS_BASE_URL}/v3/controlled-templates`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${MOBILE_TEXT_ALERTS_API_KEY}`,
          "Content-Type": "application/json",
        },
      });

      const templatesParsed = await parseProviderResponse(templatesResponse);
      console.log(
        `[send-demo-sms] Templates response (HTTP ${templatesParsed.status}, content-type ${templatesParsed.contentType}):`,
        templatesParsed.json ? JSON.stringify(templatesParsed.json) : templatesParsed.text.substring(0, 500)
      );

      const templatesData = templatesParsed.json ?? null;
      const templates =
        templatesData?.data || templatesData?.templates || (Array.isArray(templatesData) ? templatesData : []);

      if (Array.isArray(templates) && templates.length > 0) {
        const template =
          templates.find((t: any) =>
            t.name?.toLowerCase().includes("demo") ||
            t.name?.toLowerCase().includes("general") ||
            t.name?.toLowerCase().includes("booth") ||
            t.name?.toLowerCase().includes("marketing")
          ) || templates[0];

        templateId = template.id || template.templateId;
        console.log(`[send-demo-sms] Using template: ${template.name} (${templateId})`);
      }
    } catch (templateError) {
      console.error(`[send-demo-sms] Failed to fetch templates:`, templateError);
    }

    // Step C: Send message using template (for unverified accounts)
    console.log(`[send-demo-sms] Sending message to ${normalizedPhone}`);

    let sendPayload: Record<string, unknown>;
    let sendEndpoint: string;

    if (templateId) {
      // Use template endpoint for unverified accounts
      sendEndpoint = `${MOBILE_TEXT_ALERTS_BASE_URL}/v3/send/controlled-template`;
      sendPayload = {
        subscribers: [normalizedPhone],
        templateId: templateId,
      };
      console.log(`[send-demo-sms] Using controlled template endpoint with templateId: ${templateId}`);
    } else {
      // Fallback to regular send (will fail for unverified accounts)
      sendEndpoint = `${MOBILE_TEXT_ALERTS_BASE_URL}/v3/send`;
      sendPayload = {
        subscribers: [normalizedPhone],
        message: finalMessage,
      };

      // Add image if provided
      if (mediaUrl) {
        sendPayload.image = mediaUrl;
        sendPayload.rehost = true;
      }
    }

    const sendResponse = await fetch(sendEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MOBILE_TEXT_ALERTS_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(sendPayload),
    });

    const sendParsed = await parseProviderResponse(sendResponse);
    const sendData = sendParsed.json ?? {};

    console.log(
      `[send-demo-sms] Send response (HTTP ${sendParsed.status}, content-type ${sendParsed.contentType}):`,
      JSON.stringify(sendParsed.json ?? { raw: sendParsed.text.substring(0, 500) })
    );

    if (!sendParsed.ok) {
      const errorMessage =
        sendData?.message ||
        sendData?.error ||
        `Failed to send message (HTTP ${sendParsed.status}). Raw: ${sendParsed.text.substring(0, 200)}`;

      await supabase
        .from("sms_demo_sends")
        .update({
          status: "failed",
          error: errorMessage,
          provider_payload: sendParsed.json ?? { raw: sendParsed.text },
        })
        .eq("id", logEntry.id);

      throw new Error(errorMessage);
    }

    // Update log entry with success
    await supabase
      .from("sms_demo_sends")
      .update({ 
        status: "sent",
        provider_payload: sendData 
      })
      .eq("id", logEntry.id);

    console.log(`[send-demo-sms] Successfully sent to ${normalizedPhone}`);

    return new Response(
      JSON.stringify({
        success: true,
        messageId: sendData.messageId || sendData.id || logEntry.id,
        message: "Sent successfully",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[send-demo-sms] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
