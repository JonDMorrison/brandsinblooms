import { assertEquals } from "@std/assert";
import Stripe from "https://esm.sh/stripe@14";

import { createMockSupabaseClient } from "../_shared/testing/testHarness.ts";
import { handleStripeEvent, type StripeWebhookDependencies } from "./index.ts";

const NOW = new Date("2026-04-28T10:00:00.000Z");

function makeDependencies(
  seededResponses: Parameters<typeof createMockSupabaseClient>[0],
  subscription: Stripe.Subscription,
) {
  const { client, recorder } = createMockSupabaseClient(seededResponses);
  const dispatchCalls: Array<{
    event: string;
    payload: Record<string, unknown>;
    options?: { userId?: string; tenantId?: string };
  }> = [];

  const deps: StripeWebhookDependencies = {
    stripe: {
      customers: {
        retrieve: () =>
          Promise.resolve({
            id: "cus_123",
            email: "user@example.com",
          } as never),
      },
      subscriptions: {
        retrieve: () => Promise.resolve(subscription),
      },
      webhooks: {
        constructEvent: () => {
          throw new Error("Not used in unit tests");
        },
      },
    } as never,
    supabaseClient: client as never,
    dispatchWebhook: (event, payload, options) => {
      dispatchCalls.push({ event, payload, options });
      return Promise.resolve();
    },
    webhookSecret: "whsec_test",
    now: () => NOW,
    logStep: () => undefined,
  };

  return { deps, recorder, dispatchCalls };
}

Deno.test(
  "stripe-webhook dispatches subscription.updated with past_due payload on invoice failure",
  async () => {
    const subscription = {
      id: "sub_123",
      customer: "cus_123",
      metadata: { plan: "bloom", billing_interval: "annual" },
      status: "past_due",
      start_date: 1774972800,
      current_period_start: 1774972800,
      current_period_end: 1777564800,
      cancel_at_period_end: false,
      trial_end: null,
      items: {
        data: [
          {
            price: {
              recurring: { interval: "year" },
            },
          },
        ],
      },
    } as unknown as Stripe.Subscription;

    const { deps, recorder, dispatchCalls } = makeDependencies(
      {
        "auth:admin:getUserByEmail": {
          data: { user: { id: "user-1" } },
          error: null,
        },
        "users:select": {
          data: { tenant_id: "tenant-1" },
          error: null,
        },
        "subscriptions:select": [
          {
            data: {
              id: "subscription-row-1",
              user_id: "user-1",
              plan: "bloom",
              tier: "bloom",
              status: "active",
              billing_interval: "annual",
              current_period_start: "2026-04-01T00:00:00.000Z",
              current_period_end: "2026-05-01T00:00:00.000Z",
              cancel_at_period_end: false,
              trial_end: null,
              start_date: "2026-04-01",
              end_date: "2026-05-01",
              deleted_at: null,
              max_connections: 25,
              stripe_customer_id: "cus_123",
              stripe_subscription_id: "sub_123",
            },
            error: null,
          },
          {
            data: {
              id: "subscription-row-1",
              user_id: "user-1",
              plan: "bloom",
              tier: "bloom",
              status: "active",
              billing_interval: "annual",
              current_period_start: "2026-04-01T00:00:00.000Z",
              current_period_end: "2026-05-01T00:00:00.000Z",
              cancel_at_period_end: false,
              trial_end: null,
              start_date: "2026-04-01",
              end_date: "2026-05-01",
              deleted_at: null,
              max_connections: 25,
              stripe_customer_id: "cus_123",
              stripe_subscription_id: "sub_123",
            },
            error: null,
          },
        ],
        "subscriptions:update": {
          data: null,
          error: null,
        },
        "plan_definitions:select": {
          data: { max_products: -1 },
          error: null,
        },
        "rpc:sync_subscription_to_org_budget": {
          data: null,
          error: null,
        },
      },
      subscription,
    );

    await handleStripeEvent(
      {
        id: "evt_123",
        type: "invoice.payment_failed",
        data: {
          object: {
            id: "in_123",
            subscription: "sub_123",
          },
        },
      } as unknown as Stripe.Event,
      deps,
    );

    assertEquals(dispatchCalls.length, 1);
    assertEquals(dispatchCalls[0].event, "subscription.updated");
    assertEquals(dispatchCalls[0].options, {
      userId: "user-1",
      tenantId: "tenant-1",
    });
    assertEquals(dispatchCalls[0].payload.status, "past_due");
    assertEquals(dispatchCalls[0].payload.plan, "bloom");
    assertEquals(dispatchCalls[0].payload.is_active, false);

    const subscriptionUpdate = recorder.find(
      (entry) =>
        entry.table === "subscriptions" && entry.operation === "update",
    );
    assertEquals(
      (subscriptionUpdate?.payload as { status?: string })?.status,
      "past_due",
    );
  },
);
