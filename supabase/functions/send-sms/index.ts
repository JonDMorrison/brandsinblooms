import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
import { checkSMSAvailability } from "../_shared/channelAvailability.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MOBILE_TEXT_ALERTS_BASE_URL = Deno.env.get("MOBILE_TEXT_ALERTS_BASE_URL") || "https://api.mobile-text-alerts.com";
const MOBILE_TEXT_ALERTS_API_KEY = Deno.env.get("MOBILE_TEXT_ALERTS_API_KEY");
const MOBILE_TEXT_ALERTS_LONGCODE_ID = Deno.env.get("MOBILE_TEXT_ALERTS_LONGCODE_ID");

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

/**
 * Format phone number to E.164 format
 * Handles US/Canada phone numbers by adding +1 country code
 */
function normalizePhone(phone: string): string {
  if (!phone) return '';

  // Remove all non-numeric characters
  const digits = phone.replace(/\D/g, '');

  // If starts with 1 and is 11 digits, it's already normalized
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  // If 10 digits, add +1
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  // Return as-is with + prefix if not matching expected formats
  return digits.startsWith('+') ? digits : `+${digits}`;
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

async function handler(req: Request): Promise<Response> {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // FIX: [issue #4] - Add JWT authentication to prevent unauthenticated access
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'No authorization header' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  const authToken = authHeader.replace('Bearer ', '');
  const authClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: { user: authUser }, error: authError } = await authClient.auth.getUser(authToken);
  if (authError || !authUser) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  try {
    const { to, body, mediaUrl, mediaUrls, skipOptOutCheck } = await req.json();

    if (!to || !body) {
      return new Response(
        JSON.stringify({ error: 'Phone number and message body are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Check if SMS channel is available BEFORE attempting to send
    const smsStatus = checkSMSAvailability();
    if (!smsStatus.available) {
      console.log(`📱 SMS not configured: ${smsStatus.reason}`);
      return new Response(
        JSON.stringify({
          error: 'SMS_NOT_CONFIGURED',
          skipable: true,
          message: smsStatus.reason || 'Mobile Text Alerts not configured. Step can be skipped.',
          canRetry: false
        }),
        {
          status: 200, // Return 200 so caller can handle gracefully
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Check for blocked shorteners
    const blockedShortener = containsBlockedShortener(body);
    if (blockedShortener) {
      console.error(`❌ Blocked URL shortener detected: ${blockedShortener}`);
      return new Response(
        JSON.stringify({
          error: 'BLOCKED_SHORTENER',
          message: `Blocked URL shortener detected: ${blockedShortener}. Please use full URLs.`,
          skipable: false,
          canRetry: false
        }),
        {
          status: 200, // Always return 200 so automation engine can decide retry/skip behavior
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Format phone number to E.164 format
    const formattedTo = normalizePhone(to);
    console.log(`📱 Sending SMS to ${to} (formatted: ${formattedTo}): ${body.substring(0, 50)}...`);

    // Check for unsupported international numbers (non-US/Canada)
    const digits = to.replace(/\D/g, '');
    const isUSCanada = digits.length === 10 || (digits.length === 11 && digits.startsWith('1'));

    if (!isUSCanada) {
      console.log(`📱 Unsupported international number detected: ${formattedTo}`);
      return new Response(
        JSON.stringify({
          error: 'UNSUPPORTED_REGION',
          skipable: true,
          message: 'This phone number is in an unsupported region. SMS sending is only available for US/Canada numbers.',
          canRetry: false
        }),
        {
          status: 200, // Return 200 so automation can continue
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Ensure opt-out message
    const finalMessage = ensureOptOutMessage(body);

    // Initialize Supabase client for logging
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Step 1: Validate recipient
    console.log(`📱 [MTA] Validating recipient: ${formattedTo}`);
    const validateResponse = await fetch(`${MOBILE_TEXT_ALERTS_BASE_URL}/v3/send/validate-recipients`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MOBILE_TEXT_ALERTS_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipients: [{ number: formattedTo, externalId: "bloomsuite" }],
        validateUnsubscribes: true,
      }),
    });

    const validateParsed = await parseProviderResponse(validateResponse);
    const validateData = validateParsed.json ?? {};

    console.log(`📱 [MTA] Validate response (HTTP ${validateParsed.status}):`, JSON.stringify(validateData));

    if (!validateParsed.ok) {
      const errorMessage = validateData?.message || validateData?.error ||
        `Recipient validation failed (HTTP ${validateParsed.status})`;

      return new Response(
        JSON.stringify({
          error: 'VALIDATION_FAILED',
          message: errorMessage,
          skipable: false,
          canRetry: true
        }),
        {
          status: 200, // Always return 200 so caller can apply retries/backoff
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
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

      return new Response(
        JSON.stringify({
          error: 'RECIPIENT_INVALID',
          message: errorMessage,
          skipable: true,
          canRetry: false
        }),
        {
          status: 200, // Return 200 for soft failure
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Step 2: Fetch available templates (for account flexibility)
    console.log(`📱 [MTA] Fetching available templates...`);
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
      const templatesData = templatesParsed.json ?? null;
      const templates = templatesData?.data || templatesData?.templates ||
        (Array.isArray(templatesData) ? templatesData : []);

      if (Array.isArray(templates) && templates.length > 0) {
        const template = templates.find((t: any) =>
          t.name?.toLowerCase().includes("demo") ||
          t.name?.toLowerCase().includes("general") ||
          t.name?.toLowerCase().includes("booth") ||
          t.name?.toLowerCase().includes("marketing")
        ) || templates[0];

        templateId = template.id || template.templateId;
        console.log(`📱 [MTA] Found template: ${template.name} (${templateId})`);
      }
    } catch (templateError) {
      console.warn(`📱 [MTA] Failed to fetch templates:`, templateError);
    }

    // Step 3: Send message
    console.log(`📱 [MTA] Sending message to ${formattedTo}`);

    let sendPayload: Record<string, unknown>;
    let sendEndpoint: string;

    // Build media URLs array
    const allMediaUrls: string[] = [];
    if (mediaUrl) allMediaUrls.push(mediaUrl);
    if (mediaUrls && Array.isArray(mediaUrls)) allMediaUrls.push(...mediaUrls);

    if (templateId) {
      // Use template endpoint for unverified accounts
      sendEndpoint = `${MOBILE_TEXT_ALERTS_BASE_URL}/v3/send/controlled-template`;
      sendPayload = {
        subscribers: [formattedTo],
        templateId: templateId,
      };
      console.log(`📱 [MTA] Using controlled template endpoint with templateId: ${templateId}`);
    } else {
      // Use regular send
      sendEndpoint = `${MOBILE_TEXT_ALERTS_BASE_URL}/v3/send`;
      sendPayload = {
        subscribers: [formattedTo],
        message: finalMessage,
      };

      // Add longcodeId if configured (for multi-number accounts)
      if (MOBILE_TEXT_ALERTS_LONGCODE_ID) {
        const longcodeId = Number(MOBILE_TEXT_ALERTS_LONGCODE_ID);
        if (!isNaN(longcodeId)) {
          sendPayload.longcodeId = longcodeId;
          console.log(`📱 [MTA] Using longcodeId: ${longcodeId}`);
        }
      }

      // Add image if provided
      if (allMediaUrls.length > 0) {
        sendPayload.image = allMediaUrls[0];
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

    console.log(`📱 [MTA] Send response (HTTP ${sendParsed.status}):`, JSON.stringify(sendData));

    if (!sendParsed.ok) {
      const errorMessage = sendData?.message || sendData?.error ||
        `Failed to send message (HTTP ${sendParsed.status})`;

      return new Response(
        JSON.stringify({
          error: 'SEND_FAILED',
          details: errorMessage,
          skipable: false,
          canRetry: true
        }),
        {
          status: 200, // Always return 200 so caller can apply retries/backoff
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const messageId = sendData.messageId || sendData.id || crypto.randomUUID();
    console.log(`📱 SMS sent successfully via MTA: ${messageId}`);

    // Log the SMS send
    try {
      await supabase.from('sms_messages').insert({
        phone: formattedTo,
        content: finalMessage,
        status: 'sent',
        twilio_sid: messageId, // Reusing field for MTA message ID
        media_urls: allMediaUrls.length > 0 ? allMediaUrls : null,
        sent_at: new Date().toISOString(),
      });
    } catch (logError) {
      console.warn('Failed to log SMS send:', logError);
      // Don't fail the request if logging fails
    }

    return new Response(
      JSON.stringify({
        sid: messageId,
        status: 'sent',
        message: 'SMS sent successfully via Mobile Text Alerts',
        skipable: false
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in send-sms function:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error.message,
        skipable: false,
        canRetry: true
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}

Deno.serve(handler);
