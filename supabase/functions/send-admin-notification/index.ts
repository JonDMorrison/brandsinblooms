import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
import { Resend } from "npm:resend@2.1.0";
import {renderBloomSystemEmail,bloomEmailCard} from "../../../src/lib/email/premiumBotanical.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationPayload {
  type: 'trial_signup' | 'trial_conversion';
  user_id: string;
  user_email?: string;
  user_name?: string;
  company_name?: string;
  plan?: string;
}

// crm-r1-F21 / F22: this function used to run for any caller, any user_id and any content. It now acts only
// for a real, brand-new account, at most once per account and type, and every detail in the email (address,
// reply-to, name, company) comes from the server's own records. The browser calls it straight after
// signUp(), before the address is confirmed, so the caller has no session yet: the "caller" is the new
// account itself, proven by its age. A user session, when present, must be that account's.
const MAX_BODY_BYTES = 4096;
const SIGNUP_WINDOW_MS = 15 * 60 * 1000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const clip = (value: unknown, max = 200): string =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

function reply(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return reply(405, { error: "Method not allowed" });
  }

  try {
    console.log('[ADMIN-NOTIFICATION] Function started');

    // Initialize Supabase and Resend
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY')!;

    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured');
    }

    const raw = await req.text();
    if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) {
      return reply(413, { error: "Request too large" });
    }
    let payload: NotificationPayload;
    try {
      payload = JSON.parse(raw);
    } catch {
      return reply(400, { error: "Invalid JSON" });
    }
    if (
      (payload?.type !== "trial_signup" && payload?.type !== "trial_conversion") ||
      typeof payload.user_id !== "string" || !UUID_RE.test(payload.user_id)
    ) {
      return reply(400, { error: "Invalid notification" });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const isService = bearer !== "" && bearer === supabaseServiceKey;

    // A trial conversion is a server event (billing); no browser may announce one.
    if (payload.type === "trial_conversion" && !isService) {
      return reply(403, { error: "Not allowed" });
    }

    const { data: authData, error: authLookupError } = await supabase.auth.admin.getUserById(payload.user_id);
    const account = authData?.user;
    if (authLookupError || !account?.email) {
      return reply(403, { error: "Not allowed" });
    }

    if (!isService) {
      if (bearer) {
        const { data: caller } = await supabase.auth.getUser(bearer);
        if (caller?.user && caller.user.id !== account.id) {
          return reply(403, { error: "Not allowed" });
        }
      }
      const createdAt = Date.parse(account.created_at ?? "");
      if (!Number.isFinite(createdAt) || Date.now() - createdAt > SIGNUP_WINDOW_MS) {
        return reply(403, { error: "Not allowed" });
      }
    }

    // One notification per account and type, ever (unique idempotency_key).
    const { error: claimError } = await supabase.from("idempotency_log").insert({
      idempotency_key: `send-admin-notification:${payload.type}:${account.id}`,
      function_name: "send-admin-notification",
    });
    if (claimError) {
      if ((claimError as { code?: string }).code === "23505") {
        return reply(200, { success: true, duplicate: true });
      }
      throw claimError;
    }
    console.log('[ADMIN-NOTIFICATION] Accepted', { type: payload.type, user_id: account.id });

    // Get additional user data from database
    const { data: userData, error: userError } = await supabase
      .from('company_profiles')
      .select('company_name')
      .eq('user_id', account.id)
      .maybeSingle();

    if (userError) {
      console.log('[ADMIN-NOTIFICATION] No company profile found, continuing with basic info');
    }

    const metadata = (account.user_metadata ?? {}) as Record<string, unknown>;
    const accountEmail = account.email;
    const companyName = clip(userData?.company_name) || clip(metadata.company_name) || 'Not provided';
    const userName = clip(metadata.full_name) || 'Not provided';

    // Prepare email content based on notification type
    let subject: string;
    let htmlContent: string;

    const signup=payload.type==="trial_signup";
    subject=signup?"New Trial Signup - BloomSuite":"Trial Conversion - BloomSuite";
    const rows=[
      {label:"Name",value:userName,icon:"leaf" as const},
      {label:"Email",value:accountEmail,icon:"mail" as const},
      {label:"Company",value:companyName,icon:"leaf" as const},
      ...(signup?[]:[{label:"Plan",value:clip(payload.plan,40)||"Paid Plan",icon:"check" as const}]),
      {label:signup?"Signup time":"Conversion time",value:new Date().toLocaleString(),icon:"calendar" as const},
    ];
    htmlContent=renderBloomSystemEmail({
      eyebrow:signup?"NEW TRIAL SIGNUP":"TRIAL CONVERTED",
      title:signup?"A new business has started a trial":"A trial has converted to paid",
      icon:signup?"leaf":"check",
      bodyHtml:bloomEmailCard("Account details",rows,signup?"mail":"check")+
        '<p>This is an automated operational notification from BloomSuite.</p>',
      footer:"BloomSuite — internal account notification.",
    });

    const resend = new Resend(resendApiKey);

    // Send notification emails to admin emails
    const adminEmails = ['jon@brandsinblooms.com', 'jeff@brandsinblooms.com'];

    for (const adminEmail of adminEmails) {
      console.log(`[ADMIN-NOTIFICATION] Sending ${payload.type} notification`);

      const emailResponse = await resend.emails.send({
        from: "BloomSuite Notifications <noreply@brandsinblooms.com>",
        replyTo: accountEmail, // The account's own verified Auth address, never the request body's
        to: [adminEmail],
        subject: subject,
        html: htmlContent,
      });

      if (emailResponse.error) {
        console.error(`[ADMIN-NOTIFICATION] Failed to send:`, emailResponse.error);
      } else {
        console.log(`[ADMIN-NOTIFICATION] Sent`);
      }
    }

    return reply(200, {
      success: true,
      message: `${payload.type} notification sent to admin emails`
    });

  } catch (error) {
    console.error("[ADMIN-NOTIFICATION] Error:", error instanceof Error ? error.message : error);
    return reply(500, { error: "Notification failed" });
  }
};

serve(handler);
