import { renderBloomSystemEmail } from "../../../src/lib/email/premiumBotanical.ts";
import { assess, stripeList } from "./core.ts";

const env = (name: string) => {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing ${name}`);
  return v;
};
async function json(url: string, init: RequestInit = {}) {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) {
    throw new Error(
      `Upstream request failed (${response.status}) at ${
        new URL(url).hostname
      }`,
    );
  }
  return response.status === 204 ? null : await response.json();
}
const escape = (s: string) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

Deno.serve(async (req: Request) => {
  try {
    const key = env("SUPABASE_SERVICE_ROLE_KEY");
    if (
      req.headers.get("apikey") !== key &&
      req.headers.get("authorization") !== `Bearer ${key}`
    ) {
      return new Response("Unauthorized", { status: 401 });
    }
    const dryRun = new URL(req.url).searchParams.get("dry_run") === "true";
    const db = (path: string, init: RequestInit = {}) =>
      json(`${env("SUPABASE_URL")}/rest/v1/${path}`, {
        ...init,
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          ...init.headers,
        },
      });
    const stripe = (path: string) =>
      json(`https://api.stripe.com/v1${path}`, {
        headers: { Authorization: `Bearer ${env("STRIPE_SECRET_KEY")}` },
      });
    const notion = (path: string, body: unknown) =>
      json(`https://api.notion.com/v1/${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env("NOTION_TOKEN")}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
    const account = await stripe("/account");
    // Obtain a complete snapshot before writing state or declaring resolution.
    const subscriptions = await stripeList(stripe, "/subscriptions", {
      status: "all",
      "expand[]": "data.customer",
    });
    const pages = [];
    let cursor: string | undefined;
    do {
      const r = await notion(
        `databases/${env("NOTION_PIPELINE_DB_ID")}/query`,
        { page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) },
      );
      if (!Array.isArray(r.results) || typeof r.has_more !== "boolean") {
        throw new Error("Incomplete Notion response");
      }
      for (const p of r.results) {
        const text = (name: string) =>
          (p.properties[name]?.rich_text || []).map((t: any) =>
            t.plain_text ?? t.text?.content ?? ""
          ).join("");
        pages.push({
          id: p.id,
          external: text("External ID"),
          email: p.properties.Email?.email,
          stage: p.properties.Stage?.select?.name,
        });
      }
      if (!r.has_more) break;
      if (!r.next_cursor || r.next_cursor === cursor) {
        throw new Error("Invalid Notion pagination");
      }
      cursor = r.next_cursor;
    } while (true);
    const mappings = await db(
      `stripe_notion_customer_links?stripe_account_id=eq.${account.id}&select=*`,
    );
    const groups = new Map();
    for (const sub of subscriptions) {
      const customer = sub.customer;
      if (!customer || typeof customer !== "object" || !customer.id) {
        throw new Error("Missing expanded Stripe customer");
      }
      const scope = `${sub.livemode}:${customer.id}`;
      if (!groups.has(scope)) {
        groups.set(scope, {
          customer,
          livemode: sub.livemode,
          subscriptions: [],
        });
      }
      groups.get(scope).subscriptions.push(sub);
    }
    const scopes = [];
    const issues = [];
    for (const group of groups.values()) {
      const { customer, livemode } = group;
      scopes.push({ stripe_customer_id: customer.id, livemode });
      const invoices = await stripeList(stripe, "/invoices", {
        customer: customer.id,
      });
      const mapping = mappings.find((m: any) =>
        m.stripe_customer_id === customer.id && m.livemode === livemode
      );
      for (
        const issue of assess(
          customer,
          group.subscriptions,
          invoices,
          pages,
          mapping,
        )
      ) {
        issues.push({
          ...issue,
          livemode,
          fingerprint: JSON.stringify([
            issue.stripe_status,
            issue.notion_stage,
            issue.detail,
          ]),
        });
      }
    }
    if (dryRun) {
      return Response.json({
        dry_run: true,
        account: account.id,
        customers_checked: scopes.length,
        issues,
      });
    }
    // Atomic scope-specific queue update, with an advisory lock in the RPC.
    const pending = await db("rpc/reconcile_stripe_notion_snapshot", {
      method: "POST",
      body: JSON.stringify({
        p_account: account.id,
        p_scopes: scopes,
        p_issues: issues,
      }),
    });
    if (pending.length) {
      const items = pending.map((i: any) =>
        `<li><strong>${
          escape(i.customer_email || i.stripe_customer_id)
        }</strong>: ${escape(i.mismatch_type)}${
          i.resolved_at ? " (resolved)" : ""
        }<br>${escape(i.detail)}</li>`
      ).join("");
      // Retry the same transition digest safely after a delivery/network failure.
      const digest = Array.from(
        new Uint8Array(
          await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(
              JSON.stringify(
                pending.map((
                  i: any,
                ) => [
                  i.stripe_customer_id,
                  i.mismatch_type,
                  i.fingerprint,
                  i.resolved_at,
                ]),
              ),
            ),
          ),
        ),
      ).map((b) => b.toString(16).padStart(2, "0")).join("");
      await json("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env("RESEND_API_KEY")}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `stripe-notion-${digest}`,
        },
        body: JSON.stringify({
          from: "BloomSuite System <system@bloomsuite.app>",
          to: ["jon@getclear.ca", "jeff@brandsinblooms.com"],
          subject: `BloomSuite Reconciliation — ${pending.length} changes`,
          html: renderBloomSystemEmail({
            eyebrow: "OPERATIONS",
            title: "Stripe / Notion Reconciliation",
            preheader: `BloomSuite Reconciliation — ${pending.length} changes`,
            icon: "alert",
            bodyHtml: `<ul>${items}</ul><p>Customer records and billing were not changed. Review the reconciliation queue and <a href="https://www.notion.so/344d234a0ae54f4185e19d260ac658a9">customer pipeline</a>.</p>`,
            footer: "BloomSuite — internal reconciliation notice.",
          }),
        }),
      });
      for (const i of pending) {
        await db(
          `stripe_notion_reconciliation_state?stripe_account_id=eq.${account.id}&livemode=eq.${i.livemode}&stripe_customer_id=eq.${i.stripe_customer_id}&mismatch_type=eq.${i.mismatch_type}&fingerprint=eq.${
            encodeURIComponent(i.fingerprint)
          }`,
          {
            method: "PATCH",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify({ notified_fingerprint: i.fingerprint }),
          },
        );
      }
    }
    return Response.json({
      customers_checked: scopes.length,
      open_issues: issues.length,
      changes_notified: pending.length,
    });
  } catch (error) {
    console.error(
      "Stripe/Notion reconciliation failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return Response.json({
      error:
        "Reconciliation incomplete. No customer records were changed; do not treat this run as clean.",
    }, { status: 500 });
  }
});
