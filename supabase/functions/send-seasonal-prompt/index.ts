import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * send-seasonal-prompt
 *
 * Triggered by 6 pg_cron jobs throughout the year, each passing a season
 * in the request body. Sends a seasonal content plan email to all Active clients.
 *
 * Cron schedule (all 17:00 UTC / 9am Pacific):
 *   Feb 15 — spring_teaser
 *   Mar 15 — pre_season
 *   May 15 — peak_season
 *   Aug 15 — fall_preview
 *   Sep 15 — bulb_season
 *   Nov 1  — holiday
 */

const NOTION_TOKEN = Deno.env.get("NOTION_TOKEN")!;
const NOTION_DB_ID = Deno.env.get("NOTION_PIPELINE_DB_ID")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

interface SeasonWeek {
  week: string;
  action: string;
}

interface SeasonContent {
  subject: string;
  headline: string;
  subheadline: string;
  weeks: SeasonWeek[];
  cta_text: string;
  cta_url: string;
  accent: string;
  heroImage: string;
}

const seasonalContent: Record<string, SeasonContent> = {
  spring_teaser: {
    subject: "Spring is 6 weeks away. Here is your pre-season plan.",
    headline: "Spring is 6 weeks away.",
    subheadline: "Time to warm up your list before the rush.",
    weeks: [
      { week: "Now", action: "Send a re-engagement email to anyone who has not opened in 6+ months. Subject: \"Are you still planning your garden this year?\" Keep it short — the goal is to clean your list before spring so your domain stays healthy." },
      { week: "Week 2", action: "Send a teaser: \"We are getting the greenhouse ready.\" A behind-the-scenes photo of your team prepping for spring. No selling. Just presence." },
      { week: "Week 3", action: "Launch your Early Bird offer. 10% off for loyal customers who pre-shop before opening weekend. Segment to target: last year's spring buyers." },
      { week: "Week 4", action: "Grand Opening announcement. What's new this year, your hours, and what to expect. This is your biggest send of the year — make sure your domain is warm." },
    ],
    cta_text: "Start your spring teaser campaign",
    cta_url: "https://www.bloomsuite.app/newsletters/new",
    accent: "#1abc9c",
    heroImage: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=1200&q=80",
  },
  pre_season: {
    subject: "Spring opens in 2 weeks. Your 4-week launch plan.",
    headline: "Spring opens in 2 weeks.",
    subheadline: "Your highest-value marketing window starts now.",
    weeks: [
      { week: "Now", action: "Send your \"What's New\" email. Feature 3-5 new arrivals with photos. This is the email your customers have been waiting for all winter." },
      { week: "Opening Week", action: "Send a \"We're Open\" email the morning of opening day. Include hours, directions, and one hero image of your best display. Keep it simple." },
      { week: "Week 2", action: "Post-opening follow-up. \"Thank you for an incredible opening weekend.\" Include a photo from the weekend and tease what's arriving next." },
      { week: "Week 3", action: "Educational content: \"5 things to plant right now in your zone.\" Position yourself as the expert. This builds trust and drives repeat visits." },
    ],
    cta_text: "Build your opening week campaign",
    cta_url: "https://www.bloomsuite.app/newsletters/new",
    accent: "#16a34a",
    heroImage: "https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?w=1200&q=80",
  },
  peak_season: {
    subject: "Peak season is here. Stay visible while you are busy.",
    headline: "Peak season is here.",
    subheadline: "You are busy. Your marketing does not have to stop.",
    weeks: [
      { week: "This Week", action: "Set up a \"Just Arrived\" automation. Every time you add new inventory, a quick email goes out automatically. One setup, sends all season." },
      { week: "Bi-Weekly", action: "Send a quick \"Weekend at the Garden Center\" email every other Friday. One photo, one sentence, one link. Takes 5 minutes." },
      { week: "Monthly", action: "Run a \"Plant of the Month\" feature. Pick your best seller, write 3 sentences about it, and send it to your full list." },
      { week: "Ongoing", action: "Let your automations do the heavy lifting. Post-purchase care tips, birthday emails, and win-back sequences run themselves while you focus on customers." },
    ],
    cta_text: "Set up a quick campaign",
    cta_url: "https://www.bloomsuite.app/newsletters/new",
    accent: "#16a34a",
    heroImage: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1200&q=80",
  },
  fall_preview: {
    subject: "Fall is your second biggest season. Here is the plan.",
    headline: "Fall is your second biggest season.",
    subheadline: "Mums, bulbs, and fall colour — your customers are ready.",
    weeks: [
      { week: "Now", action: "Send a \"Fall Preview\" email. What's arriving, what's in stock, and what sells out fast. Create urgency — fall inventory moves quickly." },
      { week: "Week 2", action: "Educational email: \"Fall planting guide for your zone.\" Trees, shrubs, and perennials planted in fall establish better root systems. Teach your customers why fall planting matters." },
      { week: "Week 3", action: "Send a \"Mums Are Here\" announcement. This is your highest-traffic fall email. One great photo, your hours, and a reminder that they sell out." },
      { week: "Week 4", action: "End-of-season clearance. Move remaining summer inventory with a targeted email to your most engaged customers." },
    ],
    cta_text: "Start your fall campaign",
    cta_url: "https://www.bloomsuite.app/newsletters/new",
    accent: "#d97706",
    heroImage: "https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=1200&q=80",
  },
  bulb_season: {
    subject: "Bulb season is here. One email can drive a week of traffic.",
    headline: "Bulb season is here.",
    subheadline: "Your customers are thinking about spring — right now.",
    weeks: [
      { week: "Now", action: "Send a \"Spring Bulbs Are In\" email. Tulips, daffodils, alliums — show them what's available and remind them that bulbs sell out fast." },
      { week: "Week 2", action: "Educational content: \"How to plant bulbs for spring colour.\" Include planting depth, spacing, and your top 5 bulb picks. Position yourself as the expert." },
      { week: "Week 3", action: "Send a \"Last Call for Bulbs\" email. Create urgency — once they're gone, they're gone until next year." },
      { week: "Week 4", action: "Transition email: \"Preparing your garden for winter.\" Winterization tips, garlic planting, and a teaser for your holiday gifts and houseplant season." },
    ],
    cta_text: "Create your bulb season campaign",
    cta_url: "https://www.bloomsuite.app/newsletters/new",
    accent: "#d97706",
    heroImage: "https://images.unsplash.com/photo-1490750967868-88aa4f44baee?w=1200&q=80",
  },
  holiday: {
    subject: "Holiday season plan: 4 emails that drive gift sales.",
    headline: "Holiday season is here.",
    subheadline: "Gift cards, houseplants, and wreaths — your customers need ideas.",
    weeks: [
      { week: "Now", action: "Send a \"Holiday Gift Guide\" email. Feature 5-8 gift ideas under $50: houseplants, gift cards, pottery, tools. This is your highest-converting holiday email." },
      { week: "Week 2", action: "\"Gift Cards Available\" email. A single focused email with one CTA. Gift cards are your easiest holiday revenue — no inventory risk, no shipping." },
      { week: "Week 3", action: "\"Last-Minute Gift Ideas\" email. Houseplants, wreaths, and gift cards. Send the week before Christmas for maximum urgency." },
      { week: "Early Jan", action: "\"New Year, New Garden\" email. Kick off the year with a \"plan your garden\" message. Seed catalogues, indoor growing, and a teaser for spring." },
    ],
    cta_text: "Start your holiday campaign",
    cta_url: "https://www.bloomsuite.app/newsletters/new",
    accent: "#0f766e",
    heroImage: "https://images.unsplash.com/photo-1482012792084-a0c3725f289f?w=1200&q=80",
  },
};

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ── Main Handler ─────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const { season } = await req.json();

    const content = seasonalContent[season];
    if (!content) {
      return new Response(
        JSON.stringify({ error: `Unknown season: ${season}`, valid: Object.keys(seasonalContent) }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // ── Get Active clients from Notion ──
    const notionRes = await fetch(
      `https://api.notion.com/v1/databases/${NOTION_DB_ID}/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${NOTION_TOKEN}`,
          "Content-Type": "application/json",
          "Notion-Version": "2022-06-28",
        },
        body: JSON.stringify({
          filter: { property: "Stage", select: { equals: "Active" } },
        }),
      },
    );

    if (!notionRes.ok) {
      const body = await notionRes.text();
      console.error("send-seasonal-prompt: Notion query failed", notionRes.status, body);
      return new Response(JSON.stringify({ error: "Notion query failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const notionData = await notionRes.json();
    const pages = notionData.results ?? [];
    const results: Array<{ email: string; status: string }> = [];

    // ── Build weekly steps HTML (shared across all clients) ──
    const weeksHtml = content.weeks
      .map(
        (w, i) => `
      <tr><td style="padding-bottom:${i < content.weeks.length - 1 ? "10" : "0"}px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;">
          <tr>
            <td style="width:56px;padding:14px 0 14px 16px;vertical-align:top;">
              <div style="width:28px;height:28px;background:${content.accent};border-radius:50%;text-align:center;line-height:28px;font-size:12px;font-weight:600;color:#ffffff;">${i + 1}</div>
            </td>
            <td style="padding:14px 16px;">
              <p style="font-size:13px;font-weight:600;color:${content.accent};margin:0 0 4px;">${escapeHtml(w.week)}</p>
              <p style="font-size:13px;color:#374151;line-height:1.6;margin:0;">${escapeHtml(w.action)}</p>
            </td>
          </tr>
        </table>
      </td></tr>`,
      )
      .join("");

    // ── Send to each client ──
    for (const page of pages) {
      const props = page.properties;
      const gardenCenter = props["Garden Center"]?.title?.[0]?.plain_text || "Unknown";
      const email = props["Email"]?.email;
      const primaryContact = props["Primary Contact"]?.rich_text?.[0]?.plain_text || "there";
      const firstName = primaryContact.split(" ")[0] || "there";

      if (!email) {
        console.warn(`send-seasonal-prompt: skipping ${gardenCenter} — no email`);
        results.push({ email: gardenCenter, status: "skipped_no_email" });
        continue;
      }

      try {
        const emailHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">

  <tr><td style="background:#0d1f1a;padding:20px 40px;">
    <img src="https://udldmkqwnxhdeztyqcau.supabase.co/storage/v1/object/public/content-assets/bloomsuite-logo.png" alt="BloomSuite" style="height:36px;width:auto;display:block;" />
  </td></tr>

  <tr><td style="padding:0;">
    <div style="position:relative;overflow:hidden;">
      <img src="${content.heroImage}" alt="" style="width:100%;height:200px;object-fit:cover;display:block;" />
      <div style="position:absolute;top:0;left:0;right:0;bottom:0;background:linear-gradient(135deg,rgba(13,31,26,0.85) 0%,rgba(26,188,156,0.6) 100%);padding:28px 40px;box-sizing:border-box;display:flex;flex-direction:column;justify-content:flex-end;">
        <p style="color:#ffffff;font-size:22px;font-weight:600;margin:0 0 6px;line-height:1.2;">${escapeHtml(content.headline)}</p>
        <p style="color:rgba(255,255,255,0.85);font-size:14px;margin:0;">${escapeHtml(content.subheadline)}</p>
      </div>
    </div>
  </td></tr>

  <tr><td style="padding:32px 40px;">
    <p style="font-size:15px;line-height:1.7;margin:0 0 16px;color:#374151;">Hi ${escapeHtml(firstName)},</p>
    <p style="font-size:15px;line-height:1.7;margin:0 0 24px;color:#374151;">Here is your step-by-step content plan for the next 4 weeks. Each step is designed to take 15 minutes or less.</p>

    <p style="font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;margin:0 0 14px;">Your 4-week plan</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      ${weeksHtml}
    </table>

    <div style="text-align:center;margin-bottom:28px;">
      <a href="${content.cta_url}" style="display:inline-block;background:${content.accent};color:#ffffff;padding:13px 32px;border-radius:6px;font-size:15px;font-weight:500;text-decoration:none;">${escapeHtml(content.cta_text)}</a>
    </div>

    <div style="background:#f0fdf4;border-radius:10px;border:1px solid #bbf7d0;padding:16px 20px;margin-bottom:28px;">
      <p style="font-size:13px;color:#166534;line-height:1.6;margin:0;">Need help getting started? Book a free 15-minute call with Jon and he will walk you through the first campaign step by step. <a href="https://calendly.com/jonmorrison/chat-with-jon" style="color:#1abc9c;">Book a time</a></p>
    </div>

    <table cellpadding="0" cellspacing="0" style="border-top:1px solid #e5e7eb;padding-top:20px;width:100%;">
      <tr>
        <td style="width:44px;vertical-align:top;">
          <div style="width:44px;height:44px;border-radius:50%;background:#0d1f1a;text-align:center;line-height:44px;font-size:14px;font-weight:500;color:#1abc9c;">JM</div>
        </td>
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

        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "BloomSuite <hello@brandsinblooms.com>",
            to: email,
            subject: `${gardenCenter} — ${content.subject}`,
            html: emailHtml,
          }),
        });

        if (!resendRes.ok) {
          const body = await resendRes.text();
          console.error(`send-seasonal-prompt: Resend failed for ${email}`, resendRes.status, body);
          results.push({ email, status: "resend_failed" });
        } else {
          console.log(`send-seasonal-prompt: sent ${season} to ${email}`);
          results.push({ email, status: "sent" });
        }
      } catch (clientErr) {
        console.error(`send-seasonal-prompt: error for ${email}`, clientErr);
        results.push({ email, status: "error" });
      }
    }

    const sent = results.filter((r) => r.status === "sent").length;
    console.log(`send-seasonal-prompt: ${season} — ${sent}/${results.length} sent`);

    return new Response(
      JSON.stringify({ success: true, season, total: results.length, sent, results }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("send-seasonal-prompt: unexpected error", err);
    return new Response(
      JSON.stringify({ error: "Internal error", message: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
