import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  findNotionRecord,
  updateNotionRecord,
  createNotionRecord,
} from "../_shared/notion-client.ts";

/**
 * notify-notion-stripe
 *
 * Receives Stripe webhook events and syncs the matching Notion CRM record
 * via the shared notion-client helper (which handles retries, error
 * logging, broken-record creation, and internal alerts).
 *
 * Handled events:
 *   customer.subscription.created (status=active) → Won + plan/MRR/CASL
 *   customer.subscription.updated                 → Plan + MRR
 *   customer.subscription.deleted                 → Churned
 */

// TODO: replace with actual Stripe price IDs before go-live.
const PRICE_PLAN_MAP: Record<string, string> = {
  "price_starter_id": "Starter",
  "price_growth_id": "Growth",
  "price_pro_id": "Pro",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[NOTIFY-NOTION-STRIPE] ${step}${detailsStr}`);
};

async function fetchStripeCustomerEmail(
  stripeSecretKey: string,
  customerId: string,
): Promise<string | null> {
  try {
    const res = await fetch(`https://api.stripe.com/v1/customers/${customerId}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${stripeSecretKey}` },
    });
    if (!res.ok) {
      logStep("Stripe customer fetch failed", { status: res.status });
      return null;
    }
    const data = await res.json();
    return (data?.email as string) ?? null;
  } catch (err) {
    logStep("Stripe customer fetch error", { error: String(err) });
    return null;
  }
}

/**
 * Sends a personalised paid conversion email from Jeff with a setup-step
 * nudge based on the customer's current onboarding state.
 *
 * Wrapped end-to-end in try/catch — every failure mode is non-fatal so the
 * Notion update remains the critical path. Returns void.
 */
async function sendPaidConversionEmail(
  stripeKey: string,
  stripeCustomerId: string,
  customerEmail: string,
): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendKey = Deno.env.get("RESEND_API_KEY");

    if (!supabaseUrl || !serviceKey || !resendKey) {
      logStep("Conversion email skipped — missing env vars");
      return;
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // Fetch customer name from Stripe (separate fetch — keeps the existing
    // fetchStripeCustomerEmail helper untouched for the other code paths).
    let customerName: string | null = null;
    try {
      const stripeCustomerRes = await fetch(
        `https://api.stripe.com/v1/customers/${stripeCustomerId}`,
        { headers: { Authorization: `Bearer ${stripeKey}` } },
      );
      if (stripeCustomerRes.ok) {
        const stripeCustomerData = await stripeCustomerRes.json();
        customerName = (stripeCustomerData?.name as string) ?? null;
      }
    } catch (e) {
      logStep("Conversion email: Stripe name fetch failed", { error: String(e) });
    }

    // Find the user by email, then their tenant_id from company_profiles.
    const { data: userRow } = await supabase
      .from("users")
      .select("id")
      .eq("email", customerEmail)
      .maybeSingle();

    const userId = (userRow as { id?: string } | null)?.id;
    if (!userId) {
      logStep("Conversion email skipped — no user found", { customerEmail });
      return;
    }

    const { data: tenantRow } = await supabase
      .from("company_profiles")
      .select("tenant_id")
      .eq("user_id", userId)
      .maybeSingle();

    const tenantId = (tenantRow as { tenant_id?: string } | null)?.tenant_id;
    if (!tenantId) {
      logStep("Conversion email skipped — no tenant_id found", { userId });
      return;
    }

    // Run setup-status queries in parallel.
    const [
      profileResult,
      customerCount,
      emailDomainResult,
      squareResult,
      cloverResult,
      lightspeedResult,
    ] = await Promise.all([
      supabase
        .from("company_profiles")
        .select("company_name, brand_primary_color, company_overview")
        .eq("user_id", userId)
        .single(),
      supabase
        .from("crm_customers")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId),
      supabase
        .from("email_domains")
        .select("status")
        .eq("tenant_id", tenantId)
        .in("status", ["verified", "warming_up", "active"])
        .limit(1),
      supabase
        .from("square_connections")
        .select("id")
        .eq("tenant_id", tenantId)
        .limit(1),
      supabase
        .from("clover_connections")
        .select("id")
        .eq("tenant_id", tenantId)
        .limit(1),
      supabase
        .from("lightspeed_connections")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("status", "connected")
        .limit(1),
    ]);

    const profileData = profileResult.data as
      | {
          company_name?: string | null;
          brand_primary_color?: string | null;
          company_overview?: string | null;
        }
      | null;

    const domainConfigured =
      ((emailDomainResult.data as unknown[] | null)?.length ?? 0) > 0;
    const clientListImported = (customerCount.count ?? 0) > 0;
    const posIntegrated =
      ((squareResult.data as unknown[] | null)?.length ?? 0) > 0 ||
      ((cloverResult.data as unknown[] | null)?.length ?? 0) > 0 ||
      ((lightspeedResult.data as unknown[] | null)?.length ?? 0) > 0;
    const companyProfileComplete = !!(
      profileData?.company_name && profileData?.company_overview
    );
    const colorsConfirmed = !!profileData?.brand_primary_color;

    // Determine first incomplete step in priority order.
    let incompleteStepHtml = "";

    if (!domainConfigured) {
      incompleteStepHtml = `<p style="margin:0 0 12px 0;line-height:1.6;"><strong>One thing to finish before your first campaign:</strong> Your email domain is not connected yet. This is what gets your emails into inboxes instead of spam folders. It takes about 15 minutes and makes everything else work better.</p><p style="margin:0 0 16px 0;line-height:1.6;">👉 <a href="https://www.bloomsuite.app/crm/settings/email-sending" style="color:#1abc9c;">Connect your email domain</a></p>`;
    } else if (!clientListImported) {
      incompleteStepHtml = `<p style="margin:0 0 12px 0;line-height:1.6;"><strong>One thing to finish before your first campaign:</strong> Your customer list has not been imported yet. Without it, your campaigns have no one to go to. Export your list from your POS or email tool as a CSV and upload it.</p><p style="margin:0 0 16px 0;line-height:1.6;">👉 <a href="https://www.bloomsuite.app/crm/customers" style="color:#1abc9c;">Import your customer list</a></p>`;
    } else if (!posIntegrated) {
      incompleteStepHtml = `<p style="margin:0 0 12px 0;line-height:1.6;"><strong>One thing to finish before your first campaign:</strong> Your POS system is not connected yet. Connecting it lets BloomSuite build smart segments automatically based on what your customers actually buy.</p><p style="margin:0 0 16px 0;line-height:1.6;">👉 <a href="https://www.bloomsuite.app/integrations" style="color:#1abc9c;">Connect your POS</a></p>`;
    } else if (!companyProfileComplete) {
      incompleteStepHtml = `<p style="margin:0 0 12px 0;line-height:1.6;"><strong>One thing to finish before your first campaign:</strong> Your company profile is not complete yet. This trains the AI content generator on your business so the emails it writes actually sound like you.</p><p style="margin:0 0 16px 0;line-height:1.6;">👉 <a href="https://www.bloomsuite.app/profile/company" style="color:#1abc9c;">Complete your company profile</a></p>`;
    } else if (!colorsConfirmed) {
      incompleteStepHtml = `<p style="margin:0 0 12px 0;line-height:1.6;"><strong>One thing to finish before your first campaign:</strong> Your brand colors are not set yet. These appear in every email you send to make sure everything looks like your business.</p><p style="margin:0 0 16px 0;line-height:1.6;">👉 <a href="https://www.bloomsuite.app/profile/brand-colors" style="color:#1abc9c;">Set your brand colors</a></p>`;
    } else {
      incompleteStepHtml = "";
    }

    const companyName =
      profileData?.company_name || customerName || "your garden center";
    const firstName =
      (customerName?.trim().split(/\s+/)[0]) || "there";

    const month = new Date().getMonth(); // 0-indexed
    let seasonLine = "";
    if (month >= 2 && month <= 4) {
      seasonLine = "Quick note on timing: spring is the highest-value marketing window of the year for garden centers. Your customers are thinking about their gardens right now. The stores that show up in their inbox this month are the ones they visit first.";
    } else if (month >= 8 && month <= 9) {
      seasonLine = "Quick note on timing: fall is your second-biggest selling season. Mums, bulbs, and fall color are on your customers minds right now. Show up in their inbox before your competitors do.";
    } else if (month >= 10 || month <= 1) {
      seasonLine = "The holiday season and early new year are a great time to stay connected with your customers through gift guides, houseplant content, and early spring teasers.";
    } else {
      seasonLine = "Summer is a great time to build loyalty with educational content and keep your customers engaged between the big selling seasons.";
    }

    const emailHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">

  <tr><td style="background:#0d1f1a;padding:20px 40px;">
    <img src="https://udldmkqwnxhdeztyqcau.supabase.co/storage/v1/object/public/content-assets/bloomsuite-logo.png" alt="BloomSuite" style="height:40px;width:auto;display:block;" />
  </td></tr>

  <tr><td style="background:#1abc9c;padding:32px 40px;">
    <p style="color:#ffffff;font-size:22px;font-weight:500;margin:0 0 8px;line-height:1.3;">${companyName} is officially on BloomSuite.</p>
    <p style="color:rgba(255,255,255,0.85);font-size:15px;margin:0;line-height:1.5;">Your account is fully unlocked.</p>
  </td></tr>

  <tr><td style="padding:36px 40px;">
    <p style="font-size:15px;line-height:1.7;margin:0 0 16px;color:#374151;">Hi ${firstName},</p>
    <p style="font-size:15px;line-height:1.7;margin:0 0 16px;color:#374151;">${companyName} is now a full BloomSuite member. You're ready to start marketing to your customers in a way most independent garden centers never get to.</p>
    <p style="font-size:15px;line-height:1.7;margin:0 0 28px;color:#374151;">${seasonLine}</p>

    ${incompleteStepHtml}

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      <tr><td style="padding-bottom:10px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;">
          <tr>
            <td style="width:56px;padding:14px 0 14px 16px;vertical-align:top;">
              <div style="width:28px;height:28px;background:#1abc9c;border-radius:50%;text-align:center;line-height:28px;font-size:13px;font-weight:500;color:#ffffff;">1</div>
            </td>
            <td style="padding:14px 16px;">
              <p style="font-size:14px;font-weight:500;margin:0 0 3px;color:#111827;">Send your first campaign</p>
              <p style="font-size:13px;color:#6b7280;margin:0;">A simple "what's new this spring" newsletter to your full list is all you need to start.</p>
            </td>
          </tr>
        </table>
      </td></tr>
      <tr><td>
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;">
          <tr>
            <td style="width:56px;padding:14px 0 14px 16px;vertical-align:top;">
              <div style="width:28px;height:28px;background:#1abc9c;border-radius:50%;text-align:center;line-height:28px;font-size:13px;font-weight:500;color:#ffffff;">2</div>
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
        <a href="https://www.bloomsuite.app/newsletters/new" style="display:block;background:#1abc9c;color:#ffffff;text-align:center;padding:13px 24px;border-radius:6px;font-size:15px;font-weight:500;text-decoration:none;">Start a new campaign</a>
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
    <p style="font-size:12px;color:#9ca3af;margin:0;">You received this because you subscribed to BloomSuite. <a href="https://www.bloomsuite.app/unsubscribe" style="color:#9ca3af;">Unsubscribe</a></p>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Jeff at BloomSuite <hello@brandsinblooms.com>",
        reply_to: "jeff@brandsinblooms.com",
        to: customerEmail,
        subject: `${companyName} is officially on BloomSuite. Here's what's next.`,
        html: emailHtml,
      }),
    });

    if (!resendRes.ok) {
      const body = await resendRes.text();
      logStep("Conversion email Resend failed", {
        status: resendRes.status,
        body,
      });
    } else {
      logStep("Conversion email sent", { customerEmail, companyName });
    }
  } catch (err) {
    logStep("Conversion email failed (non-fatal)", { error: String(err) });
  }
}

serve(async (req) => {
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  if (!stripeKey || !webhookSecret) {
    logStep("Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET");
    return new Response("Server misconfigured", { status: 500 });
  }

  // ── Stripe signature verification (preserved) ─────────────────────
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  const body = await req.text();
  const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret,
    );
  } catch (err) {
    logStep("Signature verification failed", { error: String(err) });
    return new Response("Invalid signature", { status: 400 });
  }

  logStep("Event received", { type: event.type, id: event.id });

  try {
    switch (event.type) {
      case "customer.subscription.created": {
        const sub = event.data.object as Stripe.Subscription;
        if (sub.status !== "active") {
          logStep("Skipping non-active subscription.created", {
            status: sub.status,
          });
          return new Response(
            JSON.stringify({ received: true, skipped: true }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        const stripeCustomerId = sub.customer as string;
        const email = await fetchStripeCustomerEmail(
          stripeKey,
          stripeCustomerId,
        );
        if (!email) {
          logStep("No email resolved for customer", { stripeCustomerId });
          return new Response(
            JSON.stringify({ received: true, error: "No email" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }

        const firstItem = sub.items?.data?.[0];
        const priceId = firstItem?.price?.id ?? "";
        const mrr = (firstItem?.price?.unit_amount ?? 0) / 100;
        const wonDate = new Date(sub.start_date * 1000)
          .toISOString()
          .split("T")[0];
        const plan = PRICE_PLAN_MAP[priceId] || "Starter";

        const updateProps = {
          "Stage": { select: { name: "Won" } },
          "Won Date": { date: { start: wonDate } },
          "External ID": {
            rich_text: [{ text: { content: stripeCustomerId } }],
          },
          "Email": { email: email },
          "Plan": { select: { name: plan } },
          "MRR": { number: mrr },
          "CASL Consent": { checkbox: true },
          "CASL Consent Date": { date: { start: wonDate } },
        };

        const pageId = await findNotionRecord(stripeCustomerId, email);

        if (pageId) {
          const ok = await updateNotionRecord(
            pageId,
            updateProps,
            "notify-notion-stripe:subscription.created",
          );
          if (!ok) {
            return new Response(
              JSON.stringify({ received: true, error: "Notion update failed" }),
              { status: 500, headers: { "Content-Type": "application/json" } },
            );
          }

          await sendPaidConversionEmail(stripeKey, stripeCustomerId, email);

          return new Response(
            JSON.stringify({ received: true, updated: pageId }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        const createProps = {
          ...updateProps,
          "Garden Center": { title: [{ text: { content: email } }] },
          "Next Action": {
            rich_text: [{ text: { content: "Book kickoff call" } }],
          },
          "Next Action Date": {
            date: { start: new Date().toISOString().split("T")[0] },
          },
        };

        const newPageId = await createNotionRecord(
          createProps,
          "notify-notion-stripe:create-new-record",
        );
        if (!newPageId) {
          return new Response(
            JSON.stringify({ received: true, error: "Notion create failed" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }

        await sendPaidConversionEmail(stripeKey, stripeCustomerId, email);

        return new Response(
          JSON.stringify({ received: true, created: newPageId }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const stripeCustomerId = sub.customer as string;
        const email = await fetchStripeCustomerEmail(
          stripeKey,
          stripeCustomerId,
        );

        const firstItem = sub.items?.data?.[0];
        const priceId = firstItem?.price?.id ?? "";
        const mrr = (firstItem?.price?.unit_amount ?? 0) / 100;
        const plan = PRICE_PLAN_MAP[priceId] || "Starter";

        const pageId = await findNotionRecord(
          stripeCustomerId,
          email ?? undefined,
        );
        if (!pageId) {
          logStep("No Notion record for updated subscription", {
            stripeCustomerId,
          });
          return new Response(
            JSON.stringify({ received: true, skipped: true }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        const ok = await updateNotionRecord(
          pageId,
          {
            "Plan": { select: { name: plan } },
            "MRR": { number: mrr },
          },
          "notify-notion-stripe:subscription.updated",
        );
        if (!ok) {
          return new Response(
            JSON.stringify({ received: true, error: "Notion update failed" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response(
          JSON.stringify({ received: true, updated: pageId }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const stripeCustomerId = sub.customer as string;
        const email = await fetchStripeCustomerEmail(
          stripeKey,
          stripeCustomerId,
        );

        const pageId = await findNotionRecord(
          stripeCustomerId,
          email ?? undefined,
        );
        if (!pageId) {
          logStep("No Notion record for deleted subscription", {
            stripeCustomerId,
          });
          return new Response(
            JSON.stringify({ received: true, skipped: true }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        const ok = await updateNotionRecord(
          pageId,
          {
            "Stage": { select: { name: "Churned" } },
            "Churn Reason": { select: { name: "Unknown" } },
          },
          "notify-notion-stripe:subscription.deleted",
        );
        if (!ok) {
          return new Response(
            JSON.stringify({ received: true, error: "Notion update failed" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response(
          JSON.stringify({ received: true, updated: pageId }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      default:
        logStep("Ignoring unhandled event type", { type: event.type });
        return new Response(
          JSON.stringify({ received: true, skipped: true }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
    }
  } catch (err) {
    logStep("Unexpected handler error", { error: String(err) });
    return new Response(
      JSON.stringify({ received: false, error: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
