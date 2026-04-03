import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * notify-notion-stripe
 *
 * Receives Stripe webhook events and updates the matching Notion CRM record
 * with plan, MRR, stage, and next-action fields.
 *
 * Handled events:
 *   customer.subscription.created   → Stage=Won, Plan, MRR
 *   customer.subscription.updated   → Plan, MRR
 *   customer.subscription.deleted   → Stage=Churned, MRR=0
 *   invoice.payment_failed          → Next Action warning
 *   customer.subscription.trial_will_end → Next Action reminder
 */

const NOTION_API_VERSION = "2022-06-28";
const NOTION_DATABASE_ID = "344d234a0ae54f4185e19d260ac658a9";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[NOTIFY-NOTION-STRIPE] ${step}${detailsStr}`);
};

// ── Notion helpers ──────────────────────────────────────────────────

async function notionQueryByTenant(
  notionKey: string,
  tenantId: string,
): Promise<string | null> {
  const res = await fetch(
    `https://api.notion.com/v1/databases/${NOTION_DATABASE_ID}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${notionKey}`,
        "Notion-Version": NOTION_API_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filter: {
          property: "Supabase Tenant ID",
          rich_text: { equals: tenantId },
        },
      }),
    },
  );

  if (!res.ok) {
    const body = await res.text();
    logStep("Notion query failed", { status: res.status, body });
    return null;
  }

  const data = await res.json();
  if (!data.results?.length) {
    logStep("No Notion page found for tenant", { tenantId });
    return null;
  }

  return data.results[0].id as string;
}

async function notionPatch(
  notionKey: string,
  pageId: string,
  properties: Record<string, unknown>,
): Promise<boolean> {
  const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${notionKey}`,
      "Notion-Version": NOTION_API_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ properties }),
  });

  if (!res.ok) {
    const body = await res.text();
    logStep("Notion patch failed", { status: res.status, body });
    return false;
  }

  return true;
}

// ── Supabase lookup: stripe_customer_id → tenant_id ─────────────────

async function lookupTenantId(
  stripeCustomerId: string,
): Promise<{ tenantId: string; userId: string } | null> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    logStep("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return null;
  }

  const sb = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  // subscriptions.stripe_customer_id → user_id
  const { data: sub, error: subErr } = await sb
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", stripeCustomerId)
    .maybeSingle();

  if (subErr || !sub?.user_id) {
    logStep("No subscription found for Stripe customer", { stripeCustomerId, error: subErr });
    return null;
  }

  // users.id → tenant_id
  const { data: usr, error: usrErr } = await sb
    .from("users")
    .select("tenant_id")
    .eq("id", sub.user_id)
    .maybeSingle();

  if (usrErr || !usr?.tenant_id) {
    logStep("No tenant found for user", { userId: sub.user_id, error: usrErr });
    return null;
  }

  return { tenantId: usr.tenant_id, userId: sub.user_id };
}

// ── Plan name normalizer ────────────────────────────────────────────

function planFromSubscription(subscription: Stripe.Subscription): string {
  // Use metadata.plan if set during checkout, otherwise derive from price
  if (subscription.metadata?.plan) {
    return subscription.metadata.plan.charAt(0).toUpperCase() +
      subscription.metadata.plan.slice(1);
  }

  // Fall back to first line item product name or price nickname
  const item = subscription.items?.data?.[0];
  if (item?.price?.nickname) return item.price.nickname;
  return "Unknown";
}

function mrrFromSubscription(subscription: Stripe.Subscription): number {
  const item = subscription.items?.data?.[0];
  if (!item?.price?.unit_amount || !item?.price?.recurring) return 0;

  const amount = item.price.unit_amount; // in cents
  const interval = item.price.recurring.interval;
  const intervalCount = item.price.recurring.interval_count ?? 1;

  // Normalize to monthly
  if (interval === "year") {
    return Math.round(amount / (12 * intervalCount)) / 100;
  }
  // weekly
  if (interval === "week") {
    return Math.round((amount * 52) / (12 * intervalCount)) / 100;
  }
  // monthly (default)
  return Math.round(amount / intervalCount) / 100;
}

// ── Event handlers ──────────────────────────────────────────────────

function buildCreatedProps(subscription: Stripe.Subscription): Record<string, unknown> {
  return {
    Stage: { select: { name: "Won" } },
    Plan: { select: { name: planFromSubscription(subscription) } },
    MRR: { number: mrrFromSubscription(subscription) },
    "Next Action": {
      rich_text: [{ text: { content: "New paying customer — send welcome email" } }],
    },
  };
}

function buildUpdatedProps(subscription: Stripe.Subscription): Record<string, unknown> {
  return {
    Plan: { select: { name: planFromSubscription(subscription) } },
    MRR: { number: mrrFromSubscription(subscription) },
  };
}

function buildDeletedProps(): Record<string, unknown> {
  return {
    Stage: { select: { name: "Churned" } },
    MRR: { number: 0 },
    "Next Action": {
      rich_text: [{ text: { content: "Subscription cancelled — send win-back outreach" } }],
    },
  };
}

function buildPaymentFailedProps(invoice: Stripe.Invoice): Record<string, unknown> {
  const attempt = invoice.attempt_count ?? 1;
  return {
    "Next Action": {
      rich_text: [
        {
          text: {
            content: `Payment failed (attempt ${attempt}) — follow up on billing issue`,
          },
        },
      ],
    },
  };
}

function buildTrialEndingProps(subscription: Stripe.Subscription): Record<string, unknown> {
  const endsAt = subscription.trial_end
    ? new Date(subscription.trial_end * 1000).toISOString().substring(0, 10)
    : "soon";
  return {
    "Next Action": {
      rich_text: [
        {
          text: {
            content: `Trial ends ${endsAt} — reach out to convert`,
          },
        },
      ],
    },
  };
}

// ── Main handler ────────────────────────────────────────────────────

serve(async (req) => {
  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    const notionKey = Deno.env.get("NOTION_API_KEY");

    if (!stripeKey || !webhookSecret || !notionKey) {
      logStep("Missing required env vars");
      return new Response("Server misconfigured", { status: 500 });
    }

    // Verify Stripe signature
    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      return new Response("Missing stripe-signature header", { status: 400 });
    }

    const body = await req.text();
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      logStep("Signature verification failed", { error: String(err) });
      return new Response("Invalid signature", { status: 400 });
    }

    logStep("Event received", { type: event.type, id: event.id });

    // Extract Stripe customer ID from the event object
    let stripeCustomerId: string | null = null;
    let properties: Record<string, unknown> | null = null;

    switch (event.type) {
      case "customer.subscription.created": {
        const sub = event.data.object as Stripe.Subscription;
        stripeCustomerId = sub.customer as string;
        properties = buildCreatedProps(sub);
        break;
      }
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        stripeCustomerId = sub.customer as string;
        properties = buildUpdatedProps(sub);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        stripeCustomerId = sub.customer as string;
        properties = buildDeletedProps();
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        stripeCustomerId = invoice.customer as string;
        properties = buildPaymentFailedProps(invoice);
        break;
      }
      case "customer.subscription.trial_will_end": {
        const sub = event.data.object as Stripe.Subscription;
        stripeCustomerId = sub.customer as string;
        properties = buildTrialEndingProps(sub);
        break;
      }
      default:
        logStep("Ignoring unhandled event type", { type: event.type });
        return new Response(JSON.stringify({ received: true, skipped: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
    }

    if (!stripeCustomerId || !properties) {
      logStep("Could not extract customer or properties from event");
      return new Response(JSON.stringify({ received: true, error: "No customer" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Resolve Stripe customer → tenant → Notion page
    const lookup = await lookupTenantId(stripeCustomerId);
    if (!lookup) {
      logStep("Could not resolve tenant for Stripe customer", { stripeCustomerId });
      return new Response(
        JSON.stringify({ received: true, skipped: true, reason: "No tenant mapping" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    const pageId = await notionQueryByTenant(notionKey, lookup.tenantId);
    if (!pageId) {
      logStep("No Notion page for tenant", { tenantId: lookup.tenantId });
      return new Response(
        JSON.stringify({ received: true, skipped: true, reason: "No Notion page" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    const ok = await notionPatch(notionKey, pageId, properties);
    logStep("Notion update", {
      event: event.type,
      tenantId: lookup.tenantId,
      pageId,
      success: ok,
    });

    return new Response(
      JSON.stringify({ received: true, success: ok, notion_page_id: pageId }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    logStep("Unexpected error", { error: String(err) });
    return new Response(
      JSON.stringify({ received: true, error: String(err) }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }
});
