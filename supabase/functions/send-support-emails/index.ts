import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * send-support-emails
 *
 * Scheduled job that queries the Notion CRM for trial users who are stuck
 * on specific onboarding steps and sends targeted support emails via Resend.
 *
 * Designed to run via pg_cron (daily) or manual HTTP POST trigger.
 */

const NOTION_API_VERSION = "2022-06-28";
const NOTION_DATABASE_ID = "344d234a0ae54f4185e19d260ac658a9";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[SEND-SUPPORT-EMAILS] ${step}${detailsStr}`);
};

// ── Support email conditions ────────────────────────────────────────

interface SupportCondition {
  key: string;
  /** Notion checkbox property that must be false */
  checkboxProp: string | null;
  /** Minimum days since trial start before sending */
  minDaysOld: number;
  /** Whether this triggers on last login age instead of checkbox */
  loginBased?: boolean;
  subject: string;
  helpPageId: string;
  buildHtml: (gardenCenter: string, helpUrl: string) => string;
}

const CONDITIONS: SupportCondition[] = [
  {
    key: "email_domain_setup",
    checkboxProp: "Onboarding: Email Domain",
    minDaysOld: 3,
    subject: "Quick tip: Set up your email domain in BloomSuite",
    helpPageId: "326e5ab409458149bcabe56fdace3a3b",
    buildHtml: (name, url) => supportEmailHtml({
      gardenCenter: name,
      heading: "Send emails from your own domain",
      body: `Setting up your custom email domain means your campaigns arrive from <strong>you@${name.toLowerCase().replace(/\s+/g, "")}.com</strong> instead of a generic address. This dramatically improves deliverability and trust with your customers.`,
      ctaText: "See how to set it up →",
      ctaUrl: url,
    }),
  },
  {
    key: "brand_setup",
    checkboxProp: "Onboarding: Brand Setup",
    minDaysOld: 2,
    subject: "Make BloomSuite yours: Set up your brand colors",
    helpPageId: "326e5ab40945819bbba4d94a7ebfacd9",
    buildHtml: (name, url) => supportEmailHtml({
      gardenCenter: name,
      heading: "Your brand, your colors",
      body: "Adding your brand colors and logo takes about 2 minutes and makes every email, campaign, and template look like it came straight from your garden center — not a generic tool.",
      ctaText: "Set up your brand →",
      ctaUrl: url,
    }),
  },
  {
    key: "pos_connected",
    checkboxProp: "Onboarding: POS Connected",
    minDaysOld: 5,
    subject: "Connect your POS to unlock smart customer insights",
    helpPageId: "326e5ab4094581f0bb7ce3942a6eafd9",
    buildHtml: (name, url) => supportEmailHtml({
      gardenCenter: name,
      heading: "Your POS + BloomSuite = powerful automations",
      body: "Connecting your point-of-sale (Square, Clover, or Lightspeed) lets BloomSuite automatically sync your customers and trigger campaigns based on real purchase data. Most garden centers see results within the first week.",
      ctaText: "Connect your POS →",
      ctaUrl: url,
    }),
  },
  {
    key: "clients_imported",
    checkboxProp: "Onboarding: Clients Imported",
    minDaysOld: 4,
    subject: "Import your contacts to start reaching customers",
    helpPageId: "326e5ab4094581279873dd4ed297f9a1",
    buildHtml: (name, url) => supportEmailHtml({
      gardenCenter: name,
      heading: "Your customers are waiting to hear from you",
      body: "BloomSuite works best when it knows your customers. You can import contacts from a CSV, sync them from your POS, or add them manually. Even a small list gets you started with automated campaigns.",
      ctaText: "Import your contacts →",
      ctaUrl: url,
    }),
  },
  {
    key: "re_engagement",
    checkboxProp: null,
    minDaysOld: 7,
    loginBased: true,
    subject: "We miss you! Your BloomSuite trial is waiting",
    helpPageId: "326e5ab40945818fb25af3afeb338c05",
    buildHtml: (name, url) => supportEmailHtml({
      gardenCenter: name,
      heading: "Still growing with BloomSuite?",
      body: "We noticed you haven't logged in for a while. Your trial is still active and we'd love to help you get the most out of it. Whether you're stuck on setup or just got busy, we're here to help.",
      ctaText: "Get back to BloomSuite →",
      ctaUrl: url,
    }),
  },
];

// ── Email template ──────────────────────────────────────────────────

function supportEmailHtml(opts: {
  gardenCenter: string;
  heading: string;
  body: string;
  ctaText: string;
  ctaUrl: string;
}): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
    .content { background: #fff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
    .footer { background: #f9fafb; padding: 20px; border-radius: 0 0 12px 12px; text-align: center; font-size: 12px; color: #6b7280; border: 1px solid #e5e7eb; border-top: none; }
    .cta-button { display: inline-block; background: #22c55e; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">${opts.heading}</h1>
    </div>
    <div class="content">
      <p>Hi ${opts.gardenCenter} team,</p>
      <p>${opts.body}</p>
      <p>We put together a quick guide to walk you through it step by step:</p>
      <center>
        <a href="${opts.ctaUrl}" class="cta-button">${opts.ctaText}</a>
      </center>
      <p style="margin-top: 24px;">If you have any questions, just reply to this email — a real person will get back to you.</p>
      <p>Happy growing,<br><strong>The BloomSuite Team</strong></p>
    </div>
    <div class="footer">
      <p>BloomSuite — Marketing Made Simple for Garden Centers</p>
      <p>You're receiving this because you signed up for a BloomSuite trial.</p>
    </div>
  </div>
</body>
</html>`;
}

// ── Notion helpers ──────────────────────────────────────────────────

interface NotionTrialRecord {
  pageId: string;
  gardenCenter: string;
  email: string;
  tenantId: string;
  trialStartDate: string | null;
  lastLogin: string | null;
  checkboxes: Record<string, boolean>;
}

function notionUrl(pageId: string): string {
  return `https://www.notion.so/${pageId.replace(/-/g, "")}`;
}

function extractPlainText(prop: any): string {
  if (!prop) return "";
  // title type
  if (prop.title) return prop.title.map((t: any) => t.plain_text).join("");
  // rich_text type
  if (prop.rich_text) return prop.rich_text.map((t: any) => t.plain_text).join("");
  // email type
  if (prop.email) return prop.email;
  return "";
}

function extractCheckbox(prop: any): boolean {
  return prop?.checkbox === true;
}

function extractDate(prop: any): string | null {
  return prop?.date?.start ?? null;
}

async function fetchTrialRecords(notionKey: string): Promise<NotionTrialRecord[]> {
  const records: NotionTrialRecord[] = [];
  let hasMore = true;
  let startCursor: string | undefined;

  while (hasMore) {
    const body: any = {
      filter: {
        property: "Stage",
        select: { equals: "Trial" },
      },
      page_size: 100,
    };
    if (startCursor) body.start_cursor = startCursor;

    const res = await fetch(
      `https://api.notion.com/v1/databases/${NOTION_DATABASE_ID}/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${notionKey}`,
          "Notion-Version": NOTION_API_VERSION,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );

    if (!res.ok) {
      const errBody = await res.text();
      logStep("Notion query failed", { status: res.status, body: errBody });
      break;
    }

    const data = await res.json();

    for (const page of data.results) {
      const props = page.properties;
      records.push({
        pageId: page.id,
        gardenCenter: extractPlainText(props["Garden Center"]),
        email: extractPlainText(props["Email"]),
        tenantId: extractPlainText(props["Supabase Tenant ID"]),
        trialStartDate: extractDate(props["Trial Start Date"]),
        lastLogin: extractDate(props["Last Login"]),
        checkboxes: {
          "Onboarding: Email Domain": extractCheckbox(props["Onboarding: Email Domain"]),
          "Onboarding: Brand Setup": extractCheckbox(props["Onboarding: Brand Setup"]),
          "Onboarding: POS Connected": extractCheckbox(props["Onboarding: POS Connected"]),
          "Onboarding: Clients Imported": extractCheckbox(props["Onboarding: Clients Imported"]),
        },
      });
    }

    hasMore = data.has_more;
    startCursor = data.next_cursor;
  }

  return records;
}

// ── Main handler ────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const notionKey = Deno.env.get("NOTION_API_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!notionKey || !resendApiKey || !supabaseUrl || !serviceKey) {
      logStep("Missing required env vars");
      return new Response(
        JSON.stringify({ error: "Missing required environment variables" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const resend = new Resend(resendApiKey);
    const sb = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    logStep("Fetching trial records from Notion");
    const trials = await fetchTrialRecords(notionKey);
    logStep("Found trial records", { count: trials.length });

    const now = new Date();
    let sent = 0;
    let skipped = 0;
    let errors = 0;

    for (const trial of trials) {
      if (!trial.email || !trial.tenantId) {
        logStep("Skipping record — missing email or tenant ID", {
          gardenCenter: trial.gardenCenter,
        });
        skipped++;
        continue;
      }

      for (const condition of CONDITIONS) {
        // Check if this email was already sent
        const { data: existing } = await sb
          .from("sent_support_emails")
          .select("id")
          .eq("tenant_id", trial.tenantId)
          .eq("condition_key", condition.key)
          .maybeSingle();

        if (existing) continue;

        // Evaluate the condition
        let shouldSend = false;

        if (condition.loginBased) {
          // Re-engagement: check last login age
          if (trial.lastLogin) {
            const lastLogin = new Date(trial.lastLogin);
            const daysSinceLogin = (now.getTime() - lastLogin.getTime()) / (1000 * 60 * 60 * 24);
            shouldSend = daysSinceLogin >= condition.minDaysOld;
          } else if (trial.trialStartDate) {
            // No last login recorded — use trial start as proxy
            const trialStart = new Date(trial.trialStartDate);
            const daysSinceStart = (now.getTime() - trialStart.getTime()) / (1000 * 60 * 60 * 24);
            shouldSend = daysSinceStart >= condition.minDaysOld;
          }
        } else if (condition.checkboxProp) {
          // Checkbox-based: must be false AND trial old enough
          const isComplete = trial.checkboxes[condition.checkboxProp] ?? false;
          if (!isComplete && trial.trialStartDate) {
            const trialStart = new Date(trial.trialStartDate);
            const daysSinceStart = (now.getTime() - trialStart.getTime()) / (1000 * 60 * 60 * 24);
            shouldSend = daysSinceStart >= condition.minDaysOld;
          }
        }

        if (!shouldSend) continue;

        // Build and send the email
        const helpUrl = notionUrl(condition.helpPageId);
        const html = condition.buildHtml(trial.gardenCenter || "there", helpUrl);

        try {
          const response = await resend.emails.send({
            from: "BloomSuite <noreply@bloomsuite.app>",
            to: [trial.email],
            subject: condition.subject,
            html,
          });

          if (response.error) {
            logStep("Resend error", {
              tenant: trial.tenantId,
              condition: condition.key,
              error: response.error.message,
            });
            errors++;
            continue;
          }

          // Record that we sent this email
          await sb.from("sent_support_emails").insert({
            tenant_id: trial.tenantId,
            condition_key: condition.key,
          });

          logStep("Sent support email", {
            tenant: trial.tenantId,
            condition: condition.key,
            messageId: response.data?.id,
          });
          sent++;
        } catch (sendErr) {
          logStep("Send failed", {
            tenant: trial.tenantId,
            condition: condition.key,
            error: String(sendErr),
          });
          errors++;
        }
      }
    }

    const summary = { trials: trials.length, sent, skipped, errors };
    logStep("Run complete", summary);

    return new Response(JSON.stringify({ success: true, ...summary }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    logStep("Unexpected error", { error: String(err) });
    return new Response(
      JSON.stringify({ error: "Internal error", message: String(err) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
