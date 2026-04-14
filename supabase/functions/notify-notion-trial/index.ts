import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  findNotionRecord,
  updateNotionRecord,
  createNotionRecord,
} from "../_shared/notion-client.ts";

/**
 * notify-notion-trial
 *
 * Called by a Supabase database webhook (pg_net) after a new user signs up.
 * Looks up (or creates) the matching Notion CRM pipeline row via the shared
 * notion-client helper, then fires a welcome email via Resend.
 */

interface UserPayload {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
  tenant_id?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = await req.json();

    // Support both direct POST and Supabase webhook format (record nested under .record)
    const user: UserPayload = payload.record ?? payload;

    if (!user.email) {
      console.error("notify-notion-trial: missing email in payload", payload);
      return new Response(
        JSON.stringify({ error: "Missing email in payload" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabaseUserId = user.id;
    const userEmail = user.email;
    const today = new Date().toISOString().split("T")[0];

    // Preserve existing logic: resolve tenant_id so other functions can still match on it
    let tenantId = user.tenant_id || "";
    if (!tenantId && supabaseUserId) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (supabaseUrl && serviceKey) {
          const sb = createClient(supabaseUrl, serviceKey);
          const { data } = await sb
            .from("users")
            .select("tenant_id")
            .eq("id", supabaseUserId)
            .maybeSingle();
          tenantId = data?.tenant_id ?? "";
        }
      } catch (e) {
        console.warn("notify-notion-trial: could not resolve tenant_id", e);
      }
    }

    // ── PRIORITY 1: System welcome email (must always fire) ──
    let systemEmailSent = false;
    try {
      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (!resendKey) {
        console.warn("notify-notion-trial: RESEND_API_KEY not set, skipping welcome email");
      } else {
        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "BloomSuite <hello@brandsinblooms.com>",
            to: userEmail,
            subject: "Your BloomSuite access is ready",
            html: `<h2>Welcome to BloomSuite</h2>
         <p>Your account is set up and ready to go.</p>
         <p><strong><a href="https://www.bloomsuite.app">Log in to BloomSuite →</a></strong></p>
         <h3>What happens next:</h3>
         <ol>
           <li>Log in and complete your brand profile</li>
           <li>Connect your social media accounts</li>
           <li>Book your kickoff call with our team</li>
         </ol>
         <p>Questions? Reply to this email or visit our <a href="https://bloomsuite.notion.site/bloomsuite-help">knowledge base</a>.</p>
         <p>Jeff and Jon<br>BloomSuite Team</p>`,
          }),
        });
        if (!emailRes.ok) {
          const body = await emailRes.text();
          console.error(
            "notify-notion-trial: Resend email failed",
            emailRes.status,
            body,
          );
        } else {
          systemEmailSent = true;
          console.log("notify-notion-trial: welcome email sent to", userEmail);
        }
      }
    } catch (e) {
      console.error("notify-notion-trial: welcome email error", e);
    }

    // ── PRIORITY 2: Jeff's welcome email (must always fire) ──
    let jeffEmailSent = false;
    try {
      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (!resendKey) {
        console.warn(
          "notify-notion-trial: RESEND_API_KEY not set, skipping Jeff welcome email",
        );
      } else {
        const firstName =
          (user.name?.trim().split(/\s+/)[0]) || "there";

        const jeffHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">

  <tr><td style="background:#0d1f1a;padding:20px 40px;">
    <img src="https://udldmkqwnxhdeztyqcau.supabase.co/storage/v1/object/public/content-assets/bloomsuite-logo.png" alt="BloomSuite" style="height:40px;width:auto;display:block;" />
  </td></tr>

  <tr><td style="background:#1abc9c;padding:32px 40px;">
    <p style="color:#ffffff;font-size:22px;font-weight:500;margin:0 0 8px;line-height:1.3;">Welcome to BloomSuite.</p>
    <p style="color:rgba(255,255,255,0.85);font-size:15px;margin:0;line-height:1.5;">We're really glad you're here.</p>
  </td></tr>

  <tr><td style="padding:36px 40px;">
    <p style="font-size:15px;line-height:1.7;margin:0 0 20px;color:#374151;">A bit of background on why we built this. Jon and I spent years watching independent garden centers struggle to compete with big box stores — not because they had worse products or less passion, but because they didn't have the marketing tools to stay in front of their customers year-round. BloomSuite exists to give independent garden centers the same kind of marketing power that used to take a full-time marketing team.</p>
    <p style="font-size:15px;line-height:1.7;margin:0 0 32px;color:#374151;">You're exactly who we built this for.</p>

    <p style="font-size:13px;font-weight:500;color:#6b7280;text-transform:uppercase;letter-spacing:0.6px;margin:0 0 16px;">Get started</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      <tr><td style="padding-bottom:10px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;">
          <tr>
            <td style="width:56px;padding:14px 0 14px 16px;vertical-align:top;">
              <div style="width:28px;height:28px;background:#1abc9c;border-radius:50%;text-align:center;line-height:28px;font-size:13px;font-weight:500;color:#ffffff;">1</div>
            </td>
            <td style="padding:14px 16px;">
              <p style="font-size:14px;font-weight:500;margin:0 0 3px;color:#111827;">Complete the setup wizard</p>
              <p style="font-size:13px;color:#6b7280;margin:0;">Brand colors, company profile, POS, contacts, and email domain. Takes about 20 minutes.</p>
            </td>
          </tr>
        </table>
      </td></tr>
      <tr><td style="padding-bottom:10px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;">
          <tr>
            <td style="width:56px;padding:14px 0 14px 16px;vertical-align:top;">
              <div style="width:28px;height:28px;background:#1abc9c;border-radius:50%;text-align:center;line-height:28px;font-size:13px;font-weight:500;color:#ffffff;">2</div>
            </td>
            <td style="padding:14px 16px;">
              <p style="font-size:14px;font-weight:500;margin:0 0 3px;color:#111827;">Send your first campaign</p>
              <p style="font-size:13px;color:#6b7280;margin:0;">A simple spring newsletter to your full list is all you need to start.</p>
            </td>
          </tr>
        </table>
      </td></tr>
      <tr><td>
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;">
          <tr>
            <td style="width:56px;padding:14px 0 14px 16px;vertical-align:top;">
              <div style="width:28px;height:28px;background:#1abc9c;border-radius:50%;text-align:center;line-height:28px;font-size:13px;font-weight:500;color:#ffffff;">3</div>
            </td>
            <td style="padding:14px 16px;">
              <p style="font-size:14px;font-weight:500;margin:0 0 3px;color:#111827;">Book a call with Jon</p>
              <p style="font-size:13px;color:#6b7280;margin:0;">Free 30-minute kickoff. Most people leave with their first campaign scheduled.</p>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
      <tr><td style="padding-bottom:10px;">
        <a href="https://www.bloomsuite.app/account-setup" style="display:block;background:#1abc9c;color:#ffffff;text-align:center;padding:13px 24px;border-radius:6px;font-size:15px;font-weight:500;text-decoration:none;">Start the setup wizard</a>
      </td></tr>
      <tr><td>
        <a href="https://calendly.com/jonmorrison/chat-with-jon" style="display:block;background:#ffffff;color:#1abc9c;text-align:center;padding:12px 24px;border-radius:6px;font-size:15px;font-weight:500;text-decoration:none;border:1.5px solid #1abc9c;">Book a time with Jon</a>
      </td></tr>
    </table>

    <table cellpadding="0" cellspacing="0" style="border-top:1px solid #e5e7eb;padding-top:24px;width:100%;">
      <tr>
        <td style="width:44px;vertical-align:top;">
          <div style="width:44px;height:44px;border-radius:50%;background:#0d1f1a;text-align:center;line-height:44px;font-size:14px;font-weight:500;color:#1abc9c;">JM</div>
        </td>
        <td style="padding-left:14px;vertical-align:top;">
          <p style="font-size:14px;font-weight:500;margin:0;color:#111827;">Jeff &amp; Jon</p>
          <p style="font-size:13px;color:#6b7280;margin:4px 0 0;">Co-founders, BloomSuite</p>
          <p style="font-size:13px;color:#6b7280;margin:2px 0 0;"><a href="mailto:jeff@brandsinblooms.com" style="color:#1abc9c;text-decoration:none;">jeff@brandsinblooms.com</a></p>
        </td>
      </tr>
    </table>
  </td></tr>

  <tr><td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 40px;text-align:center;">
    <p style="font-size:12px;color:#9ca3af;margin:0 0 6px;">BloomSuite &middot; brandsinblooms.com</p>
    <p style="font-size:12px;color:#9ca3af;margin:0;">You received this because you started a BloomSuite trial. <a href="https://www.bloomsuite.app/unsubscribe" style="color:#9ca3af;">Unsubscribe</a></p>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;

        const jeffRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Jeff at BloomSuite <hello@brandsinblooms.com>",
            reply_to: "jeff@brandsinblooms.com",
            to: userEmail,
            subject: "Welcome to BloomSuite. Here's how to get started.",
            html: jeffHtml,
          }),
        });

        if (!jeffRes.ok) {
          const body = await jeffRes.text();
          console.error(
            "notify-notion-trial: Jeff welcome email failed",
            jeffRes.status,
            body,
          );
        } else {
          jeffEmailSent = true;
          console.log(
            "notify-notion-trial: Jeff welcome email sent to",
            userEmail,
          );
        }
      }
    } catch (e) {
      console.error("notify-notion-trial: Jeff welcome email error", e);
    }

    // ── PRIORITY 3: Notion write (best effort — never blocks emails) ──
    let resultPageId: string | null = null;
    let notionError: string | null = null;
    try {
      const sharedFields: Record<string, unknown> = {
        ...(supabaseUserId
          ? {
              "External ID": {
                rich_text: [{ text: { content: supabaseUserId } }],
              },
            }
          : {}),
        "CASL Consent": { checkbox: true },
        "CASL Consent Date": { date: { start: today } },
        "Trial Start Date": { date: { start: today } },
        "Stage": { select: { name: "Trial" } },
      };

      const pageId = await findNotionRecord(supabaseUserId || "", userEmail);

      if (pageId) {
        const ok = await updateNotionRecord(
          pageId,
          sharedFields,
          "notify-notion-trial:update",
        );
        if (!ok) {
          notionError = "Notion update failed";
          console.error("notify-notion-trial: Notion update failed for page", pageId);
        } else {
          resultPageId = pageId;
          console.log("notify-notion-trial: updated Notion page", pageId);
        }
      } else {
        const createProps: Record<string, unknown> = {
          ...sharedFields,
          "Garden Center": {
            title: [{ text: { content: userEmail } }],
          },
          "Primary Contact": {
            rich_text: [{ text: { content: user.name || "" } }],
          },
          "Next Action": {
            rich_text: [
              { text: { content: "Trial started — follow up within 48 hours" } },
            ],
          },
          "Assigned To": { rich_text: [{ text: { content: "Jon" } }] },
          ...(tenantId
            ? {
                "Supabase Tenant ID": {
                  rich_text: [{ text: { content: tenantId } }],
                },
              }
            : {}),
        };

        console.log("notify-notion-trial: createProps", JSON.stringify(createProps));
        const newId = await createNotionRecord(
          createProps,
          "notify-notion-trial:create",
        );
        if (!newId) {
          notionError = createNotionRecord.lastError || "Notion create failed (unknown reason)";
          console.error("notify-notion-trial: Notion create failed for", userEmail, "—", notionError);
        } else {
          resultPageId = newId;
          console.log("notify-notion-trial: created Notion page", newId);
        }
      }
    } catch (e) {
      notionError = String(e);
      console.error("notify-notion-trial: Notion error (non-blocking)", e);
    }

    // Send internal alert if Notion failed
    if (notionError) {
      try {
        const resendKey = Deno.env.get("RESEND_API_KEY");
        if (resendKey) {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${resendKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "BloomSuite Alerts <hello@brandsinblooms.com>",
              to: "jon@brandsinblooms.com",
              subject: `[ALERT] Notion write failed for trial signup: ${userEmail}`,
              html: `<p>Notion write failed during notify-notion-trial for <strong>${userEmail}</strong>.</p>
<p><strong>Error:</strong> ${notionError}</p>
<p>System email sent: ${systemEmailSent ? "Yes" : "No"}<br>Jeff email sent: ${jeffEmailSent ? "Yes" : "No"}</p>
<p>Manual Notion entry may be needed.</p>`,
            }),
          });
          console.log("notify-notion-trial: internal alert sent for Notion failure");
        }
      } catch (alertErr) {
        console.error("notify-notion-trial: failed to send internal alert", alertErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        system_email_sent: systemEmailSent,
        jeff_email_sent: jeffEmailSent,
        notion_page_id: resultPageId,
        notion_error: notionError,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("notify-notion-trial: unexpected error", err);
    return new Response(
      JSON.stringify({ error: "Internal error", message: String(err) }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
