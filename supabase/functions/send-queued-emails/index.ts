import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * send-queued-emails
 *
 * Manually triggered function that sends all Approved emails from the
 * Notion Email Queue. Jon or Jeff approve emails in Notion by changing
 * Status from "Pending" to "Approved", then trigger this function.
 *
 * Flow:
 * 1. Query Notion Email Queue for Status = "Approved"
 * 2. Look up full HTML from email_queue_html table
 * 3. Send via Resend
 * 4. Update Notion record to Status = "Sent" with Sent At date
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const NOTION_TOKEN = Deno.env.get("NOTION_TOKEN")!;
const NOTION_QUEUE_DB_ID = Deno.env.get("NOTION_EMAIL_QUEUE_DB_ID") || "ae1bb028-48e1-4553-aa87-1afe24d38e96";

const notionHeaders = {
  Authorization: `Bearer ${NOTION_TOKEN}`,
  "Content-Type": "application/json",
  "Notion-Version": "2022-06-28",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async () => {
  const summary = { sent: 0, failed: 0, skipped: 0, details: [] as Array<{ email: string; status: string; error?: string }> };

  try {
    // ── 1. Query Notion for Approved emails ──
    const queueRes = await fetch(
      `https://api.notion.com/v1/databases/${NOTION_QUEUE_DB_ID}/query`,
      {
        method: "POST",
        headers: notionHeaders,
        body: JSON.stringify({
          filter: { property: "Status", select: { equals: "Approved" } },
        }),
      },
    );

    if (!queueRes.ok) {
      const body = await queueRes.text();
      console.error("send-queued-emails: Notion query failed", queueRes.status, body);
      return new Response(JSON.stringify({ error: "Notion query failed", detail: body }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const queueData = await queueRes.json();
    const pages = queueData.results ?? [];

    if (pages.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No approved emails in queue", ...summary }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    const today = new Date().toISOString().split("T")[0];

    // ── 2. Process each approved email ──
    for (const page of pages) {
      const pageId = page.id;
      const recipient = page.properties["Recipient"]?.email;
      const notionSubject = page.properties["Subject"]?.title?.[0]?.plain_text;

      if (!recipient) {
        console.warn(`send-queued-emails: skipping ${pageId} — no recipient`);
        summary.skipped++;
        summary.details.push({ email: pageId, status: "skipped_no_recipient" });
        continue;
      }

      try {
        // ── Look up full HTML from Supabase ──
        const { data: htmlRow, error: htmlErr } = await supabase
          .from("email_queue_html")
          .select("html, recipient_email, subject, from_address, reply_to")
          .eq("notion_page_id", pageId)
          .maybeSingle();

        if (htmlErr || !htmlRow) {
          console.error(`send-queued-emails: no HTML found for ${pageId}`, htmlErr);
          // Mark as Needs Edit in Notion
          await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
            method: "PATCH",
            headers: notionHeaders,
            body: JSON.stringify({
              properties: { "Status": { select: { name: "Needs Edit" } } },
            }),
          });
          summary.failed++;
          summary.details.push({ email: recipient, status: "no_html_found" });
          continue;
        }

        // ── 3. Send via Resend ──
        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: htmlRow.from_address,
            to: htmlRow.recipient_email,
            reply_to: htmlRow.reply_to,
            subject: htmlRow.subject,
            html: htmlRow.html,
          }),
        });

        if (!resendRes.ok) {
          const errBody = await resendRes.text();
          console.error(`send-queued-emails: Resend failed for ${recipient}`, resendRes.status, errBody);

          // Mark as Needs Edit
          await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
            method: "PATCH",
            headers: notionHeaders,
            body: JSON.stringify({
              properties: {
                "Status": { select: { name: "Needs Edit" } },
                "Notes": { rich_text: [{ text: { content: `Resend error: ${errBody.substring(0, 500)}` } }] },
              },
            }),
          });

          // Log to edge_function_errors
          await supabase.from("edge_function_errors").insert({
            function_name: "send-queued-emails",
            error_message: `Resend failed for ${recipient}: ${errBody.substring(0, 500)}`,
            payload: { page_id: pageId, recipient, status: resendRes.status },
          }).catch(() => {});

          summary.failed++;
          summary.details.push({ email: recipient, status: "resend_failed", error: errBody.substring(0, 200) });
        } else {
          // ── 4. Mark as Sent in Notion ──
          await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
            method: "PATCH",
            headers: notionHeaders,
            body: JSON.stringify({
              properties: {
                "Status": { select: { name: "Sent" } },
                "Sent At": { date: { start: today } },
              },
            }),
          });

          console.log(`send-queued-emails: sent to ${recipient}`);
          summary.sent++;
          summary.details.push({ email: recipient, status: "sent" });
        }

        // 500ms delay between sends
        await sleep(500);
      } catch (err) {
        console.error(`send-queued-emails: error processing ${recipient}`, err);
        summary.failed++;
        summary.details.push({ email: recipient, status: "error", error: String(err).substring(0, 200) });
      }
    }

    console.log(`send-queued-emails: ${summary.sent} sent, ${summary.failed} failed, ${summary.skipped} skipped`);

    return new Response(
      JSON.stringify({ success: true, ...summary }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("send-queued-emails: unexpected error", err);
    return new Response(
      JSON.stringify({ error: "Internal error", message: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
