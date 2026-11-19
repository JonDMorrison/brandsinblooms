import { assertEquals } from "@std/assert";
import Stripe from "npm:stripe@14.25.0";

import { createMockSupabaseClient } from "../_shared/testing/testHarness.ts";
import {
  handleStripeEvent,
  handleStripeWebhook,
  type StripeWebhookDependencies,
} from "./index.ts";

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
        constructEventAsync: () => {
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
      metadata: { plan: "bloom", billing_interval: "annual", user_id: "user-1" },
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
        "auth:admin:getUserById": {
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
          data: [{ id: "subscription-row-1" }],
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
        created: 1777000000,
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

Deno.test("stripe-webhook verifies real signatures with the Deno Stripe build", async () => {
  const stripe = new Stripe("sk_test_local_signature_only", {
    apiVersion: "2023-10-16",
  });
  const { deps, recorder, dispatchCalls } = makeDependencies(
    {},
    {} as Stripe.Subscription,
  );
  deps.stripe = stripe;
  const payload = JSON.stringify({
    id: "evt_signature_test",
    type: "test.unhandled",
    data: { object: {} },
  });
  const sign = async (timestamp: number) => {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode("whsec_test"),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const digest = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(`${timestamp}.${payload}`),
    );
    const signature = Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0")).join("");
    return `t=${timestamp},v1=${signature}`;
  };
  const signature = await sign(Math.floor(Date.now() / 1000));
  const request = (body: string, header: string) =>
    new Request("https://example.test/stripe-webhook", {
      method: "POST",
      headers: { "stripe-signature": header },
      body,
    });

  const accepted = await handleStripeWebhook(request(payload, signature), deps);
  assertEquals(accepted.status, 200);
  assertEquals(await accepted.json(), { received: true });

  const tampered = await handleStripeWebhook(
    request(payload.replace("evt_signature_test", "evt_tampered"), signature),
    deps,
  );
  assertEquals(tampered.status, 400);

  const expiredSignature = await sign(Math.floor(Date.now() / 1000) - 600);
  const expired = await handleStripeWebhook(
    request(payload, expiredSignature),
    deps,
  );
  assertEquals(expired.status, 400);
  // Only the accepted delivery records its event id (crm-r1-F23); refused deliveries write nothing.
  assertEquals(
    recorder.map((entry) => `${entry.table}:${entry.operation}`),
    ["idempotency_log:insert"],
  );
  assertEquals(
    (recorder[0].payload as { idempotency_key?: string }).idempotency_key,
    "stripe-webhook:evt_signature_test",
  );
  assertEquals(dispatchCalls.length, 0);
});

// central-login 59 (crm-r2-F108 to F111): which Stripe events may change an account's row.
const BOUND_ROW = {
  id: "subscription-row-1",
  user_id: "user-1",
  plan: "bloom",
  tier: "bloom",
  status: "active",
  billing_interval: "monthly",
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
  stripe_event_created_at: "2026-04-20T00:00:00.000Z",
};

function stripeSubscription(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub_123",
    customer: "cus_123",
    metadata: { plan: "bloom", user_id: "user-1" },
    status: "active",
    start_date: 1774972800,
    current_period_start: 1774972800,
    current_period_end: 1777564800,
    cancel_at_period_end: false,
    trial_end: null,
    items: { data: [{ price: { lookup_key: null, recurring: { interval: "month" } } }] },
    ...overrides,
  } as unknown as Stripe.Subscription;
}

async function applySubscriptionEvent(
  type: string,
  subscription: Stripe.Subscription,
  row: Record<string, unknown> | null,
  created = 1777000000,
  rereadRow: Record<string, unknown> | null = row,
  updatedRows: Array<{ id: string }> = [{ id: "subscription-row-1" }],
) {
  const { deps, recorder } = makeDependencies(
    {
      "auth:admin:getUserById": { data: { user: { id: "user-1" } }, error: null },
      "users:select": { data: { tenant_id: "tenant-1" }, error: null },
      // customer.subscription.updated reads the row twice before writing, then once more if no row changed.
      "subscriptions:select": [
        { data: row, error: null },
        { data: row, error: null },
        { data: rereadRow, error: null },
        { data: rereadRow, error: null },
      ],
      "subscriptions:update": { data: updatedRows, error: null },
      "subscriptions:insert": { data: { id: "subscription-row-1" }, error: null },
    },
    subscription,
  );
  await handleStripeEvent(
    { id: "evt_case", type, created, data: { object: subscription } } as unknown as Stripe.Event,
    deps,
  );
  const writes = recorder.filter(
    (entry) =>
      entry.table === "subscriptions" &&
      (entry.operation === "update" || entry.operation === "insert"),
  );
  return { writes, recorder };
}

Deno.test("stripe-webhook cancellation writes plan expired with no tier (F108)", async () => {
  const { writes } = await applySubscriptionEvent(
    "customer.subscription.deleted",
    stripeSubscription({ status: "canceled" }),
    BOUND_ROW,
  );
  assertEquals(writes.length, 1);
  const payload = writes[0].payload as Record<string, unknown>;
  assertEquals([payload.plan, payload.tier, payload.status], ["expired", null, "canceled"]);
  assertEquals(typeof payload.deleted_at, "string");
});

async function signedStripeHeader(payload: string): Promise<string> {
  const timestamp = Math.floor(Date.now() / 1000);
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode("whsec_test"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${payload}`));
  const signature = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `t=${timestamp},v1=${signature}`;
}

Deno.test("stripe-webhook answers 500 and releases the claim when applying fails (F108)", async () => {
  const stripe = new Stripe("sk_test_local_signature_only", { apiVersion: "2023-10-16" });
  const { deps, recorder } = makeDependencies(
    {
      "auth:admin:getUserById": { data: { user: { id: "user-1" } }, error: null },
      "users:select": { data: { tenant_id: "tenant-1" }, error: null },
      "subscriptions:select": { data: null, error: { message: "read failed" } },
    },
    {} as Stripe.Subscription,
  );
  deps.stripe = stripe;
  const payload = JSON.stringify({
    id: "evt_apply_fails",
    type: "customer.subscription.updated",
    created: 1777000000,
    data: { object: stripeSubscription() },
  });
  const header = await signedStripeHeader(payload);
  const response = await handleStripeWebhook(
    new Request("https://example.test/stripe-webhook", {
      method: "POST",
      headers: { "stripe-signature": header },
      body: payload,
    }),
    deps,
  );
  assertEquals(response.status, 500);
  assertEquals(
    recorder
      .filter((entry) => entry.table === "idempotency_log")
      .map((entry) => entry.operation),
    ["insert", "delete"],
  );
});

Deno.test("stripe-webhook never grants a paid plan for a non-paying status (F109)", async () => {
  for (const status of ["incomplete", "incomplete_expired", "paused", "unpaid"]) {
    const unbound = await applySubscriptionEvent(
      "customer.subscription.created",
      stripeSubscription({ status, metadata: { plan: "thrive", user_id: "user-1" } }),
      { ...BOUND_ROW, plan: "free_trial", tier: null, stripe_subscription_id: null, status: null },
    );
    assertEquals(unbound.writes.length, 0);
  }
  const bound = await applySubscriptionEvent(
    "customer.subscription.updated",
    stripeSubscription({ status: "paused" }),
    BOUND_ROW,
  );
  const payload = bound.writes[0].payload as Record<string, unknown>;
  assertEquals([payload.plan, payload.tier, payload.status], ["expired", null, "unpaid"]);
});

Deno.test("stripe-webhook ignores an unpaid checkout session (F109)", async () => {
  const { deps, recorder } = makeDependencies({}, stripeSubscription());
  await handleStripeEvent(
    {
      id: "evt_checkout",
      type: "checkout.session.completed",
      created: 1777000000,
      data: {
        object: {
          id: "cs_1",
          payment_status: "unpaid",
          subscription: "sub_123",
          metadata: { user_id: "user-1", plan: "thrive" },
        },
      },
    } as unknown as Stripe.Event,
    deps,
  );
  assertEquals(recorder.length, 0);
});

Deno.test("stripe-webhook takes the plan from the current price before metadata (F110)", async () => {
  const { writes } = await applySubscriptionEvent(
    "customer.subscription.updated",
    stripeSubscription({
      metadata: { plan: "thrive", user_id: "user-1" },
      items: { data: [{ price: { lookup_key: "seed_monthly", recurring: { interval: "month" } } }] },
    }),
    BOUND_ROW,
  );
  const payload = writes[0].payload as Record<string, unknown>;
  assertEquals([payload.plan, payload.tier], ["seed", "seed"]);
});

Deno.test("stripe-webhook skips older events and other subscriptions (F111)", async () => {
  const older = await applySubscriptionEvent(
    "customer.subscription.updated",
    stripeSubscription({ status: "active" }),
    { ...BOUND_ROW, status: "canceled", deleted_at: "2026-04-25T00:00:00.000Z", stripe_event_created_at: "2026-04-25T00:00:00.000Z" },
    Math.floor(Date.parse("2026-04-24T00:00:00.000Z") / 1000),
  );
  assertEquals(older.writes.length, 0);

  const other = await applySubscriptionEvent(
    "customer.subscription.updated",
    stripeSubscription({ id: "sub_other", status: "canceled" }),
    BOUND_ROW,
  );
  assertEquals(other.writes.length, 0);

  const newer = await applySubscriptionEvent(
    "customer.subscription.updated",
    stripeSubscription({ status: "canceled" }),
    BOUND_ROW,
  );
  assertEquals(newer.writes.length, 1);
  assertEquals(
    newer.writes[0].filters.filter((filter) => filter.type === "eq").map((filter) => filter.column),
    ["id", "stripe_subscription_id", "stripe_event_created_at"],
  );

  // A newer event applied in between (or the stale-event trigger skipped this one): not an error.
  const overtaken = await applySubscriptionEvent(
    "customer.subscription.updated",
    stripeSubscription({ status: "active" }),
    BOUND_ROW,
    1777000000,
    { ...BOUND_ROW, stripe_event_created_at: "2026-05-01T00:00:00.000Z" },
    [],
  );
  assertEquals(overtaken.writes.length, 1);
});
