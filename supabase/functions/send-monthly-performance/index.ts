import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * send-monthly-performance
 *
 * Runs on the 1st of every month at 17:00 UTC (9am Pacific) via pg_cron.
 * Generates personalised monthly performance emails for each Active client
 * and queues them to the Notion Email Queue for approval before sending.
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const NOTION_TOKEN = Deno.env.get("NOTION_TOKEN")!;
const NOTION_DB_ID = Deno.env.get("NOTION_PIPELINE_DB_ID")!;
const NOTION_QUEUE_DB_ID = Deno.env.get("NOTION_EMAIL_QUEUE_DB_ID") || "ae1bb028-48e1-4553-aa87-1afe24d38e96";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

const notionHeaders = {
  Authorization: `Bearer ${NOTION_TOKEN}`,
  "Content-Type": "application/json",
  "Notion-Version": "2022-06-28",
};

// ── Helpers ──────────────────────────────────────────────────────────

function trendBadge(current: number, prev: number): string {
  if (prev === 0) return "";
  const pct = Math.round(((current - prev) / prev) * 100);
  if (pct > 0) return `<span style="font-size:12px;color:#1abc9c;font-weight:500;">↑ ${pct}%</span>`;
  if (pct < 0) return `<span style="font-size:12px;color:#ef4444;font-weight:500;">↓ ${Math.abs(pct)}%</span>`;
  return `<span style="font-size:12px;color:#6b7280;">→ flat</span>`;
}

function getProvinceContext(province: string): string {
  if (province === "BC") return "BC garden centers have one of the longest seasons in Canada — spring opens in March/April and extends into November.";
  if (["AB", "SK", "MB"].includes(province)) return "Prairie garden centers have a short, intense season. Spring opens in May and every week of peak season counts.";
  if (["ON", "QC"].includes(province)) return "Central Canadian garden centers see spring open in late April to May with strong spring and fall selling windows.";
  if (["NS", "NB", "NL"].includes(province)) return "Atlantic Canadian garden centers have a short window — spring opens in May and the season moves fast.";
  return "Canadian growing seasons vary significantly by region.";
}

function getZoneContext(zone: string): string {
  const z = parseFloat(zone);
  if (z <= 3) return `Zone ${zone}: cold winters, short 10-12 week growing season, last frost typically May.`;
  if (z <= 4) return `Zone ${zone}: cold winters, moderate 14-16 week season, last frost mid-May.`;
  if (z <= 5) return `Zone ${zone}: moderately cold winters, good 18-20 week season, last frost late April to mid-May.`;
  if (z <= 6) return `Zone ${zone}: mild winters, long 22-24 week season, last frost early to mid-April.`;
  if (z <= 7) return `Zone ${zone}: mild winters, extended season, frost rare after March.`;
  return `Zone ${zone}: very mild winters, near year-round growing potential.`;
}

const featureTips = [
  { tip: "Re-engagement campaign", desc: "January has your highest open rates of the year. A \"plan your garden\" email to your full list is the easiest win before spring.", link: "https://www.bloomsuite.app/newsletters/new", cta: "Start the campaign" },
  { tip: "List cleaning", desc: "Before spring sending, suppress anyone who hasn't opened your last 5 campaigns. A clean list protects your domain and improves open rates.", link: "https://www.bloomsuite.app/crm/segments", cta: "Review your segments" },
  { tip: "Early Bird segments", desc: "Create a segment of last year's spring buyers and send them an exclusive early access offer. These are your most loyal customers.", link: "https://www.bloomsuite.app/crm/segments", cta: "Build the segment" },
  { tip: "Post-purchase automation", desc: "Every customer who buys gets a care tips email 3 days later. It reduces returns, builds loyalty, and runs on its own.", link: "https://www.bloomsuite.app/crm/automations", cta: "Enable post-purchase" },
  { tip: "Social media scheduling", desc: "Schedule a week of \"just arrived\" posts in 20 minutes. These consistently drive more foot traffic than any campaign.", link: "https://www.bloomsuite.app/integrations", cta: "Connect social media" },
  { tip: "Email domain health", desc: "Check your SPF, DKIM, and DMARC records are verified. One click shows your deliverability status before your biggest sends.", link: "https://www.bloomsuite.app/crm/settings/email-sending", cta: "Check domain health" },
  { tip: "Newsletter idea picker", desc: "Stuck on what to send? BloomSuite has 52 weekly themes built in. Pick one and AI drafts the copy in seconds.", link: "https://www.bloomsuite.app/newsletters/new", cta: "Browse ideas" },
  { tip: "AI subject lines", desc: "Generate 5 subject line options for any campaign and pick your favourite. Open rates improve significantly with tested subject lines.", link: "https://www.bloomsuite.app/newsletters/new", cta: "Try AI subject lines" },
  { tip: "Fall buyer segment", desc: "Tag customers who bought mums or fall plants this season. You'll use this list for spring early bird offers in February.", link: "https://www.bloomsuite.app/crm/segments", cta: "Create the segment" },
  { tip: "Analytics review", desc: "Check your seasonal trends view — it shows which months get your best open rates. Plan your send frequency around it.", link: "https://www.bloomsuite.app/analytics", cta: "View analytics" },
  { tip: "Gift card campaign", desc: "A single gift card email in November is your highest-converting holiday send. One image, one CTA, high conversion.", link: "https://www.bloomsuite.app/newsletters/new", cta: "Create holiday campaign" },
  { tip: "Win-Back automation", desc: "Reach customers who haven't visited in 12+ months with an automated nudge. Takes 5 minutes to set up and runs itself.", link: "https://www.bloomsuite.app/crm/automations", cta: "Set up Win-Back" },
];

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ── Main Handler ─────────────────────────────────────────────────────

Deno.serve(async () => {
  const results: Array<{ email: string; status: string }> = [];

  try {
    const notionRes = await fetch(`https://api.notion.com/v1/databases/${NOTION_DB_ID}/query`, {
      method: "POST",
      headers: notionHeaders,
      body: JSON.stringify({ filter: { property: "Stage", select: { equals: "Active" } } }),
    });

    if (!notionRes.ok) {
      const body = await notionRes.text();
      console.error("send-monthly-performance: Notion query failed", notionRes.status, body);
      return new Response(JSON.stringify({ error: "Notion query failed" }), { status: 500, headers: { "Content-Type": "application/json" } });
    }

    const notionData = await notionRes.json();
    const pages = notionData.results ?? [];
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    const now = new Date();
    const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const firstOfTwoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const monthName = firstOfLastMonth.toLocaleString("en-CA", { month: "long" });

    const month = now.getMonth();
    let heroImage = "", accentColor = "#1abc9c";
    if (month >= 2 && month <= 4) { heroImage = "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=1200&q=80"; accentColor = "#1abc9c"; }
    else if (month >= 5 && month <= 7) { heroImage = "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1200&q=80"; accentColor = "#16a34a"; }
    else if (month >= 8 && month <= 10) { heroImage = "https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=1200&q=80"; accentColor = "#d97706"; }
    else { heroImage = "https://images.unsplash.com/photo-1482012792084-a0c3725f289f?w=1200&q=80"; accentColor = "#0f766e"; }

    const featureTip = featureTips[now.getMonth()];

    for (const page of pages) {
      const props = page.properties;
      const gardenCenter = props["Garden Center"]?.title?.[0]?.plain_text || "Unknown";
      const clientEmail = props["Email"]?.email;
      const tenantId = props["Supabase Tenant ID"]?.rich_text?.[0]?.plain_text;
      const primaryContact = props["Primary Contact"]?.rich_text?.[0]?.plain_text || "there";
      const firstName = primaryContact.split(" ")[0] || "there";
      const province = props["Province"]?.select?.name || "";

      if (!clientEmail || !tenantId) {
        console.warn(`send-monthly-performance: skipping ${gardenCenter} — missing email or tenantId`);
        results.push({ email: clientEmail || gardenCenter, status: "skipped_missing_data" });
        continue;
      }

      try {
        // ── Query Supabase stats ──
        const [campaignsLM, campaignsPM, totalC, newCLM, newCPM, autoResult] = await Promise.all([
          supabase.from("crm_campaigns").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("status", "sent").gte("sent_at", firstOfLastMonth.toISOString()).lt("sent_at", firstOfThisMonth.toISOString()),
          supabase.from("crm_campaigns").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("status", "sent").gte("sent_at", firstOfTwoMonthsAgo.toISOString()).lt("sent_at", firstOfLastMonth.toISOString()),
          supabase.from("crm_customers").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
          supabase.from("crm_customers").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).gte("created_at", firstOfLastMonth.toISOString()).lt("created_at", firstOfThisMonth.toISOString()),
          supabase.from("crm_customers").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).gte("created_at", firstOfTwoMonthsAgo.toISOString()).lt("created_at", firstOfLastMonth.toISOString()),
          supabase.from("crm_automations").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("is_active", true),
        ]);

        const campaignCount = campaignsLM.count ?? 0;
        const campaignCountPrev = campaignsPM.count ?? 0;
        const totalContacts = totalC.count ?? 0;
        const newContacts = newCLM.count ?? 0;
        const newContactsPrev = newCPM.count ?? 0;
        const automationCount = autoResult.count ?? 0;

        let companyOverview = "", hardinessZone = "";
        try {
          const { data: userRow } = await supabase.from("users").select("id").eq("tenant_id", tenantId).maybeSingle();
          if (userRow?.id) {
            const { data: profile } = await supabase.from("company_profiles").select("company_overview, usda_zone").eq("user_id", userRow.id).maybeSingle();
            companyOverview = (profile as any)?.company_overview || "";
            hardinessZone = (profile as any)?.usda_zone || "";
          }
        } catch { /* non-fatal */ }

        // ── GPT-4o insight ──
        const locationContext = hardinessZone ? getZoneContext(hardinessZone) : getProvinceContext(province);
        let aiInsight = "Another month of consistent marketing — keep it up.";
        try {
          const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
            body: JSON.stringify({
              model: "gpt-4o", max_tokens: 80,
              messages: [
                { role: "system", content: "You are a marketing coach for independent garden centers. Write exactly ONE encouraging, specific sentence under 25 words commenting on this garden center's month. Use their stats, location, and specializations. Sound like a knowledgeable human advisor, not a bot." },
                { role: "user", content: `Garden center: ${gardenCenter}. ${locationContext} What they sell: ${companyOverview || "general garden center"}. Month: ${monthName}. Campaigns sent: ${campaignCount}. Total contacts: ${totalContacts}. New contacts: ${newContacts}. Active automations: ${automationCount}.` },
              ],
            }),
          });
          if (aiRes.ok) {
            const aiData = await aiRes.json();
            const reply = aiData?.choices?.[0]?.message?.content?.trim();
            if (reply) aiInsight = reply;
          }
        } catch { /* fallback */ }

        // ── Build HTML ──
        const subject = `${gardenCenter} — your ${monthName} marketing summary`;
        const emailHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
  <tr><td style="background:#0d1f1a;padding:20px 40px;">
    <img src="https://udldmkqwnxhdeztyqcau.supabase.co/storage/v1/object/public/content-assets/bloomsuite-logo.png" alt="BloomSuite" style="height:36px;width:auto;display:block;" />
  </td></tr>
  <tr><td style="padding:0;"><div style="position:relative;overflow:hidden;">
    <img src="${heroImage}" alt="" style="width:100%;height:200px;object-fit:cover;display:block;" />
    <div style="position:absolute;top:0;left:0;right:0;bottom:0;background:linear-gradient(135deg,rgba(13,31,26,0.85) 0%,rgba(26,188,156,0.6) 100%);padding:28px 40px;box-sizing:border-box;">
      <p style="color:rgba(255,255,255,0.8);font-size:12px;font-weight:500;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px;">${monthName} ${now.getFullYear()}</p>
      <p style="color:#ffffff;font-size:22px;font-weight:600;margin:0 0 6px;line-height:1.2;">${escapeHtml(gardenCenter)}</p>
      <p style="color:rgba(255,255,255,0.85);font-size:14px;margin:0;">Monthly marketing summary</p>
    </div>
  </div></td></tr>
  <tr><td style="background:${accentColor};padding:16px 40px;">
    <p style="color:#ffffff;font-size:14px;line-height:1.6;margin:0;font-style:italic;">"${escapeHtml(aiInsight)}"</p>
  </td></tr>
  <tr><td style="padding:32px 40px;">
    <p style="font-size:15px;line-height:1.7;margin:0 0 8px;color:#374151;">Hi ${escapeHtml(firstName)},</p>
    <p style="font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;margin:24px 0 14px;">Your ${monthName} numbers</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      <tr>
        <td style="width:50%;padding:0 6px 12px 0;vertical-align:top;"><div style="background:#f9fafb;border-radius:10px;border:1px solid #e5e7eb;padding:16px;text-align:center;">
          <p style="font-size:32px;font-weight:600;color:#0d1f1a;margin:0 0 2px;line-height:1;">${campaignCount}</p>
          <p style="font-size:11px;color:#6b7280;margin:0 0 6px;text-transform:uppercase;letter-spacing:0.5px;">Campaigns sent</p>${trendBadge(campaignCount, campaignCountPrev)}
        </div></td>
        <td style="width:50%;padding:0 0 12px 6px;vertical-align:top;"><div style="background:#f9fafb;border-radius:10px;border:1px solid #e5e7eb;padding:16px;text-align:center;">
          <p style="font-size:32px;font-weight:600;color:#0d1f1a;margin:0 0 2px;line-height:1;">${totalContacts.toLocaleString()}</p>
          <p style="font-size:11px;color:#6b7280;margin:0 0 6px;text-transform:uppercase;letter-spacing:0.5px;">Total contacts</p>
          <span style="font-size:12px;color:#1abc9c;font-weight:500;">+${newContacts} new</span>
        </div></td>
      </tr>
      <tr>
        <td style="width:50%;padding:0 6px 0 0;vertical-align:top;"><div style="background:#f9fafb;border-radius:10px;border:1px solid #e5e7eb;padding:16px;text-align:center;">
          <p style="font-size:32px;font-weight:600;color:#0d1f1a;margin:0 0 2px;line-height:1;">${newContacts}</p>
          <p style="font-size:11px;color:#6b7280;margin:0 0 6px;text-transform:uppercase;letter-spacing:0.5px;">New contacts</p>${trendBadge(newContacts, newContactsPrev)}
        </div></td>
        <td style="width:50%;padding:0 0 0 6px;vertical-align:top;"><div style="background:#f9fafb;border-radius:10px;border:1px solid #e5e7eb;padding:16px;text-align:center;">
          <p style="font-size:32px;font-weight:600;color:#0d1f1a;margin:0 0 2px;line-height:1;">${automationCount}</p>
          <p style="font-size:11px;color:#6b7280;margin:0 0 6px;text-transform:uppercase;letter-spacing:0.5px;">Active automations</p>
          <span style="font-size:12px;color:${automationCount > 0 ? "#1abc9c" : "#6b7280"};font-weight:500;">${automationCount > 0 ? "Running" : "None set up"}</span>
        </div></td>
      </tr>
    </table>
    <div style="background:#f0fdf4;border-radius:10px;border:1px solid #bbf7d0;padding:20px;margin-bottom:28px;">
      <p style="font-size:11px;font-weight:600;color:#166534;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 6px;">Tip of the month</p>
      <p style="font-size:14px;font-weight:600;color:#166534;margin:0 0 6px;">${escapeHtml(featureTip.tip)}</p>
      <p style="font-size:13px;color:#374151;line-height:1.6;margin:0 0 12px;">${featureTip.desc}</p>
      <a href="${featureTip.link}" style="display:inline-block;background:#1abc9c;color:#ffffff;padding:8px 20px;border-radius:6px;font-size:13px;font-weight:500;text-decoration:none;">${featureTip.cta}</a>
    </div>
    <table cellpadding="0" cellspacing="0" style="border-top:1px solid #e5e7eb;padding-top:20px;width:100%;">
      <tr>
        <td style="width:44px;vertical-align:top;"><div style="width:44px;height:44px;border-radius:50%;background:#0d1f1a;text-align:center;line-height:44px;font-size:14px;font-weight:500;color:#1abc9c;">JM</div></td>
        <td style="padding-left:14px;vertical-align:top;">
          <p style="font-size:14px;font-weight:500;margin:0;color:#111827;">Jeff &amp; Jon</p>
          <p style="font-size:13px;color:#6b7280;margin:4px 0 0;">Co-founders, BloomSuite</p>
        </td>
      </tr>
    </table>
  </td></tr>
  <tr><td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 40px;text-align:center;">
    <p style="font-size:12px;color:#9ca3af;margin:0 0 6px;">BloomSuite &middot; brandsinblooms.com</p>
    <p style="font-size:12px;color:#9ca3af;margin:0;">You received this because you are a BloomSuite member. <a href="https://www.bloomsuite.app/unsubscribe" style="color:#9ca3af;">Unsubscribe</a></p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;

        // ── Queue to Notion instead of sending ──
        const queueRes = await fetch("https://api.notion.com/v1/pages", {
          method: "POST",
          headers: notionHeaders,
          body: JSON.stringify({
            parent: { database_id: NOTION_QUEUE_DB_ID },
            properties: {
              "Subject": { title: [{ text: { content: subject.substring(0, 200) } }] },
              "Status": { select: { name: "Pending" } },
              "Recipient": { email: clientEmail },
              "Garden Center": { rich_text: [{ text: { content: gardenCenter.substring(0, 200) } }] },
              "Email Type": { select: { name: "Monthly Performance" } },
              "Preview HTML": { rich_text: [{ text: { content: emailHtml.substring(0, 2000) } }] },
              "Scheduled Send Date": { date: { start: new Date().toISOString().split("T")[0] } },
              "Notes": { rich_text: [{ text: { content: `AI insight: ${aiInsight}`.substring(0, 2000) } }] },
            },
          }),
        });

        if (!queueRes.ok) {
          const errBody = await queueRes.text();
          console.error(`send-monthly-performance: Notion queue failed for ${clientEmail}`, queueRes.status, errBody);
          results.push({ email: clientEmail, status: "queue_failed" });
          continue;
        }

        const queueData = await queueRes.json();
        const notionPageId = queueData.id;

        // Store full HTML in Supabase (Notion text field is 2000 char limit)
        const { error: htmlErr } = await supabase.from("email_queue_html").insert({
          notion_page_id: notionPageId,
          recipient_email: clientEmail,
          subject,
          html: emailHtml,
          email_type: "monthly_performance",
        });
        if (htmlErr) {
          console.error(`send-monthly-performance: HTML insert failed for ${clientEmail}`, htmlErr);
        }

        console.log(`send-monthly-performance: queued for ${clientEmail} (${notionPageId})`);
        results.push({ email: clientEmail, status: "queued" });
      } catch (clientErr) {
        console.error(`send-monthly-performance: error for ${clientEmail}`, clientErr);
        results.push({ email: clientEmail || gardenCenter, status: "error" });
      }
    }

    const queued = results.filter((r) => r.status === "queued").length;
    console.log(`send-monthly-performance: ${queued}/${results.length} queued`);

    return new Response(
      JSON.stringify({ success: true, total: results.length, queued, results }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("send-monthly-performance: unexpected error", err);
    return new Response(JSON.stringify({ error: "Internal error", message: String(err) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
