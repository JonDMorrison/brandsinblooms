import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { renderBloomSystemEmail } from "../../../src/lib/email/premiumBotanical.ts";

/**
 * send-daily-digest
 *
 * Sends a single morning digest email to Jon and Jeff at 8am Pacific (16:00 UTC).
 * Replaces noisy individual alert emails. Triggered by pg_cron.
 *
 * Pulls from: edge_function_errors, reconciliation_log, health_scores, Notion pipeline.
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const NOTION_TOKEN = Deno.env.get("NOTION_TOKEN")!;
const NOTION_DB_ID = Deno.env.get("NOTION_PIPELINE_DB_ID")!;

const RECIPIENTS = ["jon@getclear.ca", "jeff@brandsinblooms.com"];

Deno.serve(async (_req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    // ── 1. Edge function errors (last 24h) ──
    const { data: errors } = await supabase
      .from("edge_function_errors")
      .select("function_name, error_message, created_at")
      .gte("created_at", twentyFourHoursAgo)
      .order("created_at", { ascending: false });

    const errorsByFunction: Record<string, { count: number; firstMessage: string }> = {};
    for (const err of errors ?? []) {
      const fn = err.function_name || "unknown";
      if (!errorsByFunction[fn]) {
        errorsByFunction[fn] = { count: 0, firstMessage: err.error_message || "" };
      }
      errorsByFunction[fn].count++;
    }
    const totalErrors = errors?.length ?? 0;

    // ── 2. Reconciliation log (most recent run) ──
    const { data: reconRows } = await supabase
      .from("reconciliation_log")
      .select("mismatch_count, details, created_at")
      .order("created_at", { ascending: false })
      .limit(1);

    const recon = reconRows?.[0] ?? null;
    const mismatchCount = recon?.mismatch_count ?? 0;
    const reconDetails: Array<{ email?: string; type?: string }> =
      Array.isArray(recon?.details) ? recon.details : [];

    // ── 3. Health score (most recent) ──
    const { data: healthRows } = await supabase
      .from("health_scores")
      .select("score, created_at")
      .order("created_at", { ascending: false })
      .limit(1);

    const healthScore = healthRows?.[0]?.score ?? null;

    // ── 4. Notion: new trials & conversions (last 24h) ──
    const notionHeaders = {
      "Authorization": `Bearer ${NOTION_TOKEN}`,
      "Content-Type": "application/json",
      "Notion-Version": "2022-06-28",
    };

    let newTrials: Array<{ name: string; email: string }> = [];
    let newWon: Array<{ name: string }> = [];

    try {
      // New trials
      const trialsRes = await fetch(
        `https://api.notion.com/v1/databases/${NOTION_DB_ID}/query`,
        {
          method: "POST",
          headers: notionHeaders,
          body: JSON.stringify({
            filter: {
              and: [
                { property: "Stage", select: { equals: "Trial" } },
                { timestamp: "created_time", created_time: { on_or_after: twentyFourHoursAgo } },
              ],
            },
          }),
        },
      );
      if (trialsRes.ok) {
        const trialsData = await trialsRes.json();
        newTrials = (trialsData.results ?? []).map((p: any) => ({
          name: p.properties?.["Garden Center"]?.title?.[0]?.text?.content || "Unknown",
          email: p.properties?.["Email"]?.email || p.properties?.["Garden Center"]?.title?.[0]?.text?.content || "",
        }));
      }

      // New paying clients (Won)
      const wonRes = await fetch(
        `https://api.notion.com/v1/databases/${NOTION_DB_ID}/query`,
        {
          method: "POST",
          headers: notionHeaders,
          body: JSON.stringify({
            filter: {
              and: [
                {
                  or: [
                    { property: "Stage", select: { equals: "Won" } },
                    { property: "Stage", select: { equals: "Active" } },
                  ],
                },
                { timestamp: "created_time", created_time: { on_or_after: twentyFourHoursAgo } },
              ],
            },
          }),
        },
      );
      if (wonRes.ok) {
        const wonData = await wonRes.json();
        newWon = (wonData.results ?? []).map((p: any) => ({
          name: p.properties?.["Garden Center"]?.title?.[0]?.text?.content || "Unknown",
        }));
      }
    } catch (notionErr) {
      console.error("send-daily-digest: Notion query failed", notionErr);
    }

    // ── Build email HTML ──
    const dateStr = now.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      timeZone: "America/Los_Angeles",
    });

    const subjectDate = now.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: "America/Los_Angeles",
    });

    // System status block
    let statusHtml: string;
    if (totalErrors === 0) {
      statusHtml = `<div style="background:#F5F7F3;border-left:4px solid #527566;padding:12px 16px;border-radius:0 6px 6px 0;margin-bottom:24px;">
      <p style="font-size:14px;font-weight:500;color:#365D4C;margin:0;">All systems healthy</p>
      <p style="font-size:13px;color:#365D4C;margin:4px 0 0;">No automation errors in the last 24 hours.</p>
    </div>`;
    } else {
      const errorLines = Object.entries(errorsByFunction)
        .map(
          ([fn, { count, firstMessage }]) =>
            `<p style="font-size:13px;color:#991b1b;margin:4px 0 0;">• <strong>${escapeHtml(fn)}</strong> — ${count} error(s): ${escapeHtml(firstMessage.slice(0, 120))}</p>`,
        )
        .join("\n      ");
      statusHtml = `<div style="background:#fef2f2;border-left:4px solid #ef4444;padding:12px 16px;border-radius:0 6px 6px 0;margin-bottom:24px;">
      <p style="font-size:14px;font-weight:500;color:#991b1b;margin:0;">${totalErrors} automation error(s) detected</p>
      ${errorLines}
    </div>`;
    }

    // Health score line
    let healthHtml = "";
    if (healthScore !== null) {
      const color = healthScore >= 80 ? "#365D4C" : healthScore >= 50 ? "#92400e" : "#991b1b";
      healthHtml = `<p style="font-size:13px;color:${color};margin:4px 0 16px;">System health score: <strong>${healthScore}</strong>/100</p>`;
    }

    // New activity section
    let activityHtml = "";
    if (newTrials.length > 0 || newWon.length > 0) {
      activityHtml = `<p style="font-size:13px;font-weight:500;color:#5B6B79;text-transform:uppercase;letter-spacing:0.6px;margin:0 0 12px;">New Activity</p>`;

      for (const t of newTrials) {
        activityHtml += `<div style="background:#FAF9F6;border:1px solid #DBE3DF;border-radius:6px;padding:10px 14px;margin-bottom:6px;">
        <p style="font-size:14px;font-weight:500;color:#1B3049;margin:0;">${escapeHtml(t.name)} <span style="background:#F5F7F3;color:#1B3049;font-size:11px;padding:2px 6px;border-radius:4px;margin-left:6px;">Trial</span></p>
        <p style="font-size:12px;color:#5B6B79;margin:2px 0 0;">${escapeHtml(t.email)}</p>
      </div>`;
      }

      for (const w of newWon) {
        activityHtml += `<div style="background:#F5F7F3;border:1px solid #DBE3DF;border-radius:6px;padding:10px 14px;margin-bottom:6px;">
        <p style="font-size:14px;font-weight:500;color:#1B3049;margin:0;">${escapeHtml(w.name)} <span style="background:#F5F7F3;color:#365D4C;font-size:11px;padding:2px 6px;border-radius:4px;margin-left:6px;">Won</span></p>
      </div>`;
      }
    }

    // Reconciliation section
    let reconHtml: string;
    if (mismatchCount === 0) {
      reconHtml = `<p style="font-size:14px;color:#536475;margin:0;">Clean — all active Stripe subscribers have Notion records.</p>`;
    } else {
      const mismatchLines = reconDetails
        .slice(0, 10)
        .map(
          (m) =>
            `<p style="font-size:13px;color:#536475;margin:2px 0;">• ${escapeHtml(m.email || "unknown")} — ${escapeHtml(m.type || "mismatch")}</p>`,
        )
        .join("\n      ");
      reconHtml = `<p style="font-size:14px;color:#536475;margin:0 0 6px;">${mismatchCount} mismatch(es) found. Check the pipeline.</p>
      ${mismatchLines}`;
    }

    // Operational status and reconciliation data remain unchanged; only the
    // fixed HTML chrome changes to the platform-wide email renderer.
    const emailHtml = renderBloomSystemEmail({
      eyebrow: "OPERATIONS",
      title: "Daily Digest",
      preheader: `${dateStr} · Generated at 8:00 AM Pacific`,
      icon: "calendar",
      bodyHtml: `
        <p style="margin:0 0 22px;color:#536475;">${dateStr} · Generated at 8:00 AM Pacific</p>
        ${statusHtml}
        ${healthHtml}
        ${activityHtml}
        <h2 style="margin:24px 0 12px;font-size:18px;line-height:1.35;color:#1B3049;">Stripe / Notion Reconciliation</h2>
        ${reconHtml}
        <p style="font-size:12px;color:#5B6B79;margin:28px 0 0;padding-top:16px;border-top:1px solid #DBE3DF;">This digest is sent every morning at 8am Pacific. Immediate alerts are only sent for new paying clients.</p>
      `,
      footer: "BloomSuite — internal operations digest.",
    });

    // ── Send via Resend ──
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "BloomSuite System <system@bloomsuite.app>",
        to: RECIPIENTS,
        subject: `BloomSuite Daily Digest — ${subjectDate}`,
        html: emailHtml,
      }),
    });

    if (!resendRes.ok) {
      const body = await resendRes.text();
      console.error("send-daily-digest: Resend failed", resendRes.status, body);
      return new Response(JSON.stringify({ error: "Resend failed", detail: body }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log("send-daily-digest: sent to", RECIPIENTS.join(", "));

    return new Response(
      JSON.stringify({
        success: true,
        errors: totalErrors,
        new_trials: newTrials.length,
        new_won: newWon.length,
        mismatches: mismatchCount,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("send-daily-digest: unexpected error", err);
    return new Response(
      JSON.stringify({ error: "Internal error", message: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
