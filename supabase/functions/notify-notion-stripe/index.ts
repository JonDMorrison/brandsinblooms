import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14";
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
