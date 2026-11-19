import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "npm:stripe@14.25.0";
import { createClient } from "npm:@supabase/supabase-js@2";

import { getPlanQuotaDefaults, isPaidPlan } from "../_shared/planFeatures.ts";
import {
  buildSubscriptionWebhookPayload,
  getEffectivePlan,
  normalizeTimestamp,
  type OAuthSubscriptionStatus,
  type PlanDefinitionShape,
  type SubscriptionRecordShape,
} from "../_shared/subscriptionSnapshot.ts";
import { dispatchWebhook as dispatchOAuthWebhook } from "../_shared/webhookDispatch.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
});

const supabaseClient = createClient(
  Deno.env.get("SUPABASE_URL") ?? "https://placeholder.supabase.co",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "placeholder-service-role-key",
  // A server key never refreshes; without this the client's refresh timer outlives the tests.
  { auth: { persistSession: false, autoRefreshToken: false } },
);

type BillingInterval = "monthly" | "annual";
type SubscriptionPlan =
  | "free_trial"
  | "seed"
  | "sprout"
  | "bloom"
  | "thrive"
  | "expired";

interface StripeWebhookUser {
  id: string;
}

interface StripeWebhookSupabaseClient {
  auth: {
    admin: {
      getUserById: (userId: string) => Promise<{
        data: { user: StripeWebhookUser | null };
        error: { message: string } | null;
      }>;
    };
  };
  from: (table: string) => {
    select: (columns?: string) => unknown;
    update: (payload: unknown) => unknown;
    insert: (payload: unknown) => unknown;
    delete: () => unknown;
  };
  rpc: (
    name: string,
    payload?: unknown,
  ) => Promise<{
    data: unknown;
    error: { message: string } | null;
  }>;
}

interface SupabaseQueryChain {
  eq: (column: string, value: unknown) => SupabaseQueryChain;
  is: (column: string, value: null) => SupabaseQueryChain;
  order: (column: string, value: unknown) => SupabaseQueryChain;
  limit: (value: unknown) => SupabaseQueryChain;
  maybeSingle: <T = unknown>() => Promise<{
    data: T | null;
    error: { message: string } | null;
  }>;
  single: <T = unknown>() => Promise<{
    data: T | null;
    error: { message: string } | null;
  }>;
}

interface SubscriptionRow extends SubscriptionRecordShape {
  id?: string;
  user_id?: string;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  stripe_event_created_at?: string | null;
}

type DispatchWebhookFn = (
  event: string,
  payload: Record<string, unknown>,
  options?: { userId?: string; tenantId?: string },
) => Promise<void>;

type StripeLike = Pick<Stripe, "customers" | "subscriptions" | "webhooks">;

export interface StripeWebhookDependencies {
  stripe: StripeLike;
  supabaseClient: StripeWebhookSupabaseClient;
  dispatchWebhook: DispatchWebhookFn;
  webhookSecret: string | null;
  now: () => Date;
  logStep: (step: string, details?: unknown) => void;
}

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

const defaultDependencies: StripeWebhookDependencies = {
  stripe,
  supabaseClient: supabaseClient as unknown as StripeWebhookSupabaseClient,
  dispatchWebhook: dispatchOAuthWebhook,
  webhookSecret: Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? null,
  now: () => new Date(),
  logStep,
};

function normalizePlan(value?: string | null): SubscriptionPlan | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (
    normalized === "free_trial" ||
    normalized === "seed" ||
    normalized === "sprout" ||
    normalized === "bloom" ||
    normalized === "thrive" ||
    normalized === "expired"
  ) {
    return normalized;
  }

  return null;
}

function normalizeBillingInterval(value?: string | null): BillingInterval {
  return value === "annual" ? "annual" : "monthly";
}

// crm-r2-F109: Stripe's own status decides entitlement and fails closed. incomplete, paused and any
// status this code does not know become 'unpaid', incomplete_expired becomes 'expired'; never 'active'.
// Only active, trialing and past_due (Stripe's retry window) keep a paid plan.
function normalizeStripeStatus(
  value: string | null | undefined,
): OAuthSubscriptionStatus {
  switch (value?.trim().toLowerCase()) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
      return "past_due";
    case "canceled":
      return "canceled";
    case "incomplete_expired":
      return "expired";
    default:
      return "unpaid";
  }
}

function isEntitledStatus(status: string | null | undefined): boolean {
  return status === "active" || status === "trialing" || status === "past_due";
}

// crm-r2-F110: the plan follows the price the subscription is billed at now. create-checkout resolves
// prices by lookup_key '<plan>_<interval>', so the current item's lookup_key names the plan;
// metadata.plan (fixed at checkout) is only the fallback for a price without such a key.
function getStripePricePlan(
  subscription: Stripe.Subscription,
): SubscriptionPlan | null {
  const lookupKey = subscription.items?.data?.[0]?.price?.lookup_key;
  const match = typeof lookupKey === "string"
    ? lookupKey.trim().toLowerCase().match(/^(seed|sprout|bloom|thrive)_[a-z]+$/)
    : null;
  return match ? normalizePlan(match[1]) : null;
}

function getStripeBillingInterval(
  subscription: Stripe.Subscription,
): BillingInterval | null {
  const interval = subscription.items?.data?.[0]?.price?.recurring?.interval;
  return interval === "year" ? "annual" : interval === "month" ? "monthly" : null;
}

// crm-r2-F111: every applied event stores its Stripe created time on the row, so a late older event
// for the same subscription cannot overwrite newer state. Real Stripe events always carry it.
function getEventCreatedAt(event: Stripe.Event): string {
  const created = (event as { created?: unknown }).created;
  if (typeof created !== "number" || !Number.isFinite(created)) {
    throw new Error("Stripe event has no created time");
  }
  return new Date(created * 1000).toISOString();
}

function toIsoTimestamp(unixSeconds?: number | null): string {
  return new Date(
    (unixSeconds ?? Math.floor(Date.now() / 1000)) * 1000,
  ).toISOString();
}

function toIsoDate(unixSeconds?: number | null): string {
  return new Date((unixSeconds ?? Math.floor(Date.now() / 1000)) * 1000)
    .toISOString()
    .split("T")[0];
}

function getCustomerId(
  customer:
    | string
    | Stripe.Customer
    | Stripe.DeletedCustomer
    | null
    | undefined,
): string | null {
  if (typeof customer === "string" && customer) {
    return customer;
  }

  if (customer && typeof customer === "object" && "id" in customer && typeof customer.id === "string") {
    return customer.id;
  }

  return null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function maybeSingle<T>(query: unknown): Promise<{
  data: T | null;
  error: { message: string } | null;
}> {
  return await (query as SupabaseQueryChain).maybeSingle<T>();
}

async function getTenantIdForUser(
  userId: string,
  deps: StripeWebhookDependencies = defaultDependencies,
): Promise<string | null> {
  const query = deps.supabaseClient
    .from("users")
    .select("tenant_id") as SupabaseQueryChain;
  const { data, error } = await query
    .eq("id", userId)
    .maybeSingle<{ tenant_id?: string | null }>();

  if (error) {
    deps.logStep("Failed to resolve tenant for user", {
      error: error.message,
      userId,
    });
    return null;
  }

  return data?.tenant_id ?? null;
}

// crm-r1-F24: a Stripe subscription is bound to the CRM account that bought it, never to whoever the Stripe
// customer's (changeable) email resolves to today. First the owner create-checkout stamped into the
// subscription's metadata (server-set from the signed-in caller), then the CRM row already linked to this
// Stripe subscription or customer. With neither, the event is not applied.
async function resolveUserForSubscription(
  subscription: Stripe.Subscription,
  deps: StripeWebhookDependencies = defaultDependencies,
): Promise<{ userId: string; tenantId: string | null } | null> {
  const metadataUserId =
    typeof subscription.metadata?.user_id === "string"
      ? subscription.metadata.user_id
      : null;

  if (metadataUserId) {
    const { data, error } =
      await deps.supabaseClient.auth.admin.getUserById(metadataUserId);
    if (!error && data.user) {
      return {
        userId: data.user.id,
        tenantId: await getTenantIdForUser(data.user.id, deps),
      };
    }
    deps.logStep("Subscription owner from metadata not found", {
      subscriptionId: subscription.id,
      error: error?.message,
    });
  }

  const links: Array<[string, string | null]> = [
    ["stripe_subscription_id", subscription.id],
    ["stripe_customer_id", getCustomerId(subscription.customer)],
  ];
  for (const [column, value] of links) {
    if (!value) {
      continue;
    }
    const query = deps.supabaseClient
      .from("subscriptions")
      .select("user_id") as SupabaseQueryChain;
    const { data, error } = await query
      .eq(column, value)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ user_id?: string | null }>();
    if (error) {
      throw new Error(`Failed to resolve subscription owner: ${error.message}`);
    }
    if (data?.user_id) {
      return {
        userId: data.user_id,
        tenantId: await getTenantIdForUser(data.user_id, deps),
      };
    }
  }

  deps.logStep("No CRM account is bound to this Stripe subscription", {
    subscriptionId: subscription.id,
  });
  return null;
}

// crm-r1-F23: Stripe delivers at least once (retries, manual resends). Each event id is claimed once in
// idempotency_log (unique idempotency_key) before it is applied; a repeat is acknowledged and skipped.
// A claim is released when applying the event throws, so Stripe's retry can apply it.
const stripeEventKey = (eventId: string) => `stripe-webhook:${eventId}`;

async function claimStripeEvent(
  eventId: string,
  deps: StripeWebhookDependencies = defaultDependencies,
): Promise<boolean> {
  const { error } = (await deps.supabaseClient.from("idempotency_log").insert({
    idempotency_key: stripeEventKey(eventId),
    function_name: "stripe-webhook",
  })) as { error: ({ message: string; code?: string }) | null };

  if (!error) {
    return true;
  }
  if (error.code === "23505") {
    return false;
  }
  throw new Error(`Failed to record Stripe event: ${error.message}`);
}

async function releaseStripeEvent(
  eventId: string,
  deps: StripeWebhookDependencies = defaultDependencies,
): Promise<boolean> {
  const query = deps.supabaseClient.from("idempotency_log").delete() as {
    eq: (column: string, value: unknown) => Promise<{
      error: { message: string } | null;
    }>;
  };
  const { error } = await query.eq("idempotency_key", stripeEventKey(eventId));
  if (error) {
    deps.logStep("Failed to release Stripe event claim", {
      eventId,
      error: error.message,
    });
    return false;
  }
  return true;
}

async function getLatestSubscriptionRecord(
  userId: string,
  deps: StripeWebhookDependencies = defaultDependencies,
) {
  const query = deps.supabaseClient
    .from("subscriptions")
    .select(
      "id, user_id, plan, tier, status, billing_interval, current_period_start, current_period_end, cancel_at_period_end, trial_end, start_date, end_date, deleted_at, max_connections, stripe_customer_id, stripe_subscription_id, stripe_event_created_at",
    ) as SupabaseQueryChain;
  const { data, error } = await query
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<SubscriptionRow>();

  // crm-r2-F108: a failed read must not look like "no row yet" (that would insert a second row).
  if (error) {
    throw new Error(`Failed to load existing subscription: ${error.message}`);
  }

  return data;
}

// crm-r2-F112: the tenant budget follows the tenant's effective plan (resolve_effective_subscription_tier),
// never the plan of the one member row this event touched, so no p_plan is passed.
async function syncTenantBudget(
  tenantId: string | null,
  deps: StripeWebhookDependencies = defaultDependencies,
) {
  if (!tenantId) {
    return;
  }

  const { error } = await deps.supabaseClient.rpc(
    "sync_subscription_to_org_budget",
    {
      p_tenant_id: tenantId,
    },
  );

  if (error) {
    deps.logStep("Failed to sync tenant budget", {
      tenantId,
      error: error.message,
    });
  }
}

async function loadPlanDefinition(
  plan: string,
  deps: StripeWebhookDependencies = defaultDependencies,
): Promise<PlanDefinitionShape | null> {
  const query = deps.supabaseClient
    .from("plan_definitions")
    .select("max_products") as SupabaseQueryChain;
  const { data, error } = await maybeSingle<PlanDefinitionShape>(
    query.eq("plan", plan),
  );

  if (error) {
    deps.logStep("Failed to load plan definition", {
      plan,
      error: error.message,
    });
    return null;
  }

  return data;
}

// crm-r2-F111: one account row follows one Stripe subscription, newest event first. An event is not
// applied when (1) it does not entitle and is not for the subscription the row follows, (2) the row
// follows another subscription that is still live, or (3) the row follows this subscription and has
// already applied a newer event. Returns the reason, or null when the event may be applied.
function stripeEventSkipReason(
  existingSubscription: SubscriptionRow | null,
  stripeSubscriptionId: string | null,
  status: OAuthSubscriptionStatus,
  eventCreatedAt: string,
): string | null {
  const boundTo = existingSubscription?.stripe_subscription_id ?? null;
  const sameSubscription = boundTo !== null && boundTo === stripeSubscriptionId;

  if (!isEntitledStatus(status) && !sameSubscription) {
    return "not entitled and not the subscription this account follows";
  }

  if (
    boundTo !== null &&
    !sameSubscription &&
    !existingSubscription?.deleted_at &&
    isEntitledStatus(existingSubscription?.status)
  ) {
    return "the account follows another live Stripe subscription";
  }

  const appliedAt = normalizeTimestamp(
    existingSubscription?.stripe_event_created_at ?? null,
  );
  if (
    sameSubscription &&
    appliedAt !== null &&
    new Date(eventCreatedAt).getTime() < new Date(appliedAt).getTime()
  ) {
    return "older than the newest event already applied";
  }

  return null;
}

async function upsertSubscriptionRecord(
  params: {
    userId: string;
    plan: SubscriptionPlan;
    billingInterval: BillingInterval;
    startDate: string;
    endDate: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    status: OAuthSubscriptionStatus;
    eventCreatedAt: string;
    cancelAtPeriodEnd?: boolean;
    trialEnd?: string | null;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    resetUsage?: boolean;
    isFoundingCustomer?: boolean;
  },
  deps: StripeWebhookDependencies = defaultDependencies,
): Promise<SubscriptionRow | null> {
  const now = deps.now().toISOString();
  const quotaDefaults = getPlanQuotaDefaults(params.plan);
  const existingSubscription = await getLatestSubscriptionRecord(
    params.userId,
    deps,
  );

  const skipReason = stripeEventSkipReason(
    existingSubscription,
    params.stripeSubscriptionId ?? null,
    params.status,
    params.eventCreatedAt,
  );
  if (skipReason) {
    deps.logStep("Stripe event not applied", {
      userId: params.userId,
      subscriptionId: params.stripeSubscriptionId,
      reason: skipReason,
    });
    return null;
  }

  const payload: Record<string, unknown> = {
    plan: params.plan,
    // subscriptions_tier_check allows only the paid tiers; expired and free_trial live in plan alone.
    tier: isPaidPlan(params.plan) ? params.plan : null,
    status: params.status,
    billing_interval: params.billingInterval,
    start_date: params.startDate,
    end_date: params.endDate,
    current_period_start: params.currentPeriodStart,
    current_period_end: params.currentPeriodEnd,
    cancel_at_period_end: params.cancelAtPeriodEnd ?? false,
    trial_end: params.trialEnd ?? null,
    stripe_customer_id: params.stripeCustomerId ?? null,
    stripe_subscription_id: params.stripeSubscriptionId ?? null,
    stripe_event_created_at: params.eventCreatedAt,
    contacts_limit: quotaDefaults.contacts_limit,
    email_quota: quotaDefaults.email_quota,
    sms_quota: quotaDefaults.sms_quota,
    max_connections: quotaDefaults.max_connections,
    deleted_at: params.status === "canceled" ? now : null,
    updated_at: now,
  };

  if (params.resetUsage) {
    payload.email_usage = 0;
    payload.sms_usage = 0;
    payload.overage_emails_this_month = 0;
    payload.overage_sms_this_month = 0;
  }

  if (typeof params.isFoundingCustomer === "boolean") {
    payload.is_founding_customer = params.isFoundingCustomer;
  }

  if (existingSubscription?.id) {
    // Compare-and-set on the binding and the stored event time read above: a delivery that changed
    // the row in between makes this one fail, so its claim is released and Stripe's retry re-decides.
    let updateQuery = (deps.supabaseClient
      .from("subscriptions")
      .update(payload) as SupabaseQueryChain)
      .eq("id", existingSubscription.id);
    updateQuery = existingSubscription.stripe_subscription_id
      ? updateQuery.eq(
        "stripe_subscription_id",
        existingSubscription.stripe_subscription_id,
      )
      : updateQuery.is("stripe_subscription_id", null);
    updateQuery = existingSubscription.stripe_event_created_at
      ? updateQuery.eq(
        "stripe_event_created_at",
        existingSubscription.stripe_event_created_at,
      )
      : updateQuery.is("stripe_event_created_at", null);
    const { data, error } = await (updateQuery as unknown as {
      select: (columns?: string) => Promise<{
        data: Array<{ id: string }> | null;
        error: { message: string } | null;
      }>;
    }).select("id");

    if (error) {
      throw error;
    }

    if (!Array.isArray(data) || data.length !== 1) {
      // No row changed: either a newer event was applied meanwhile (or the database's stale-event
      // trigger skipped this older one), which is final, or the row changed otherwise, which is retried.
      const current = await getLatestSubscriptionRecord(params.userId, deps);
      const appliedAt = normalizeTimestamp(current?.stripe_event_created_at ?? null);
      if (
        current?.id === existingSubscription.id &&
        appliedAt !== null &&
        new Date(params.eventCreatedAt).getTime() < new Date(appliedAt).getTime()
      ) {
        deps.logStep("Stripe event not applied", {
          userId: params.userId,
          subscriptionId: params.stripeSubscriptionId,
          reason: "older than the newest event already applied",
        });
        return null;
      }
      throw new Error("Subscription row changed while applying the Stripe event");
    }

    return {
      ...existingSubscription,
      ...payload,
      id: existingSubscription.id,
      user_id: params.userId,
    } as SubscriptionRow;
  }

  const insertQuery = deps.supabaseClient.from("subscriptions").insert({
    user_id: params.userId,
    ...payload,
  }) as {
    select: (columns?: string) => {
      single: <T = unknown>() => Promise<{
        data: T | null;
        error: { message: string } | null;
      }>;
    };
  };
  const { data, error } = await insertQuery
    .select("id")
    .single<{ id: string }>();

  if (error) {
    throw error;
  }

  if (!data?.id) {
    throw new Error("Subscription insert did not return an id");
  }

  return {
    ...payload,
    id: data.id,
    user_id: params.userId,
  } as SubscriptionRow;
}

async function updateSubscriptionFromStripe(
  params: {
    userId: string;
    tenantId: string | null;
    plan: SubscriptionPlan;
    billingInterval: BillingInterval;
    startDate: string;
    endDate: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    status: OAuthSubscriptionStatus;
    eventCreatedAt: string;
    cancelAtPeriodEnd?: boolean;
    trialEnd?: string | null;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    resetUsage?: boolean;
    isFoundingCustomer?: boolean;
  },
  deps: StripeWebhookDependencies = defaultDependencies,
): Promise<SubscriptionRow | null> {
  const updatedSubscription = await upsertSubscriptionRecord(params, deps);
  if (updatedSubscription) {
    await syncTenantBudget(params.tenantId, deps);
  }
  return updatedSubscription;
}

async function dispatchSubscriptionStateChange(
  event: string,
  userId: string,
  tenantId: string | null,
  subscription: SubscriptionRow | null,
  deps: StripeWebhookDependencies = defaultDependencies,
) {
  const plan = getEffectivePlan(subscription);
  const planDefinition = plan ? await loadPlanDefinition(plan, deps) : null;
  const payload = buildSubscriptionWebhookPayload({
    userId,
    tenantId,
    subscription,
    planDefinition,
    now: deps.now(),
  });

  await deps.dispatchWebhook(event, payload, {
    userId,
    ...(tenantId ? { tenantId } : {}),
  });
}

function isDuplicateCreatedSubscription(
  existingSubscription: SubscriptionRow | null,
  subscription: Stripe.Subscription,
  plan: SubscriptionPlan,
  status: OAuthSubscriptionStatus,
): boolean {
  if (!existingSubscription?.stripe_subscription_id) {
    return false;
  }

  return (
    existingSubscription.stripe_subscription_id === subscription.id &&
    getEffectivePlan(existingSubscription) === plan &&
    existingSubscription.status === status &&
    normalizeTimestamp(
      existingSubscription.current_period_end ?? existingSubscription.end_date,
    ) === toIsoTimestamp(subscription.current_period_end)
  );
}

function resolveStripePlan(
  subscription: Stripe.Subscription,
  existingSubscription: SubscriptionRow | null,
  fallbackPlan?: SubscriptionPlan,
): SubscriptionPlan {
  return (
    getStripePricePlan(subscription) ??
    normalizePlan(subscription.metadata?.plan) ??
    normalizePlan(existingSubscription?.tier) ??
    normalizePlan(existingSubscription?.plan) ??
    fallbackPlan ??
    "seed"
  );
}

async function syncStripeSubscription(
  params: {
    subscription: Stripe.Subscription;
    userId: string;
    tenantId: string | null;
    dispatchEvent: string;
    eventCreatedAt: string;
    fallbackPlan?: SubscriptionPlan;
    overridePlan?: SubscriptionPlan;
    overrideStatus?: OAuthSubscriptionStatus;
    resetUsage?: boolean;
    isFoundingCustomer?: boolean;
  },
  deps: StripeWebhookDependencies = defaultDependencies,
) {
  const existingSubscription = await getLatestSubscriptionRecord(
    params.userId,
    deps,
  );
  // crm-r2-F109: a paid plan, the usage reset and the founding flag are granted only while Stripe
  // reports the subscription as active, trialing or past_due; any other status writes plan 'expired'.
  const stripeStatus = normalizeStripeStatus(params.subscription.status);
  const entitled = isEntitledStatus(stripeStatus);
  const plan: SubscriptionPlan = entitled
    ? params.overridePlan ??
      resolveStripePlan(
        params.subscription,
        existingSubscription,
        params.fallbackPlan,
      )
    : "expired";
  const status = entitled
    ? params.overrideStatus ?? stripeStatus
    : stripeStatus;
  const stripeCustomerId = getCustomerId(params.subscription.customer);

  const updatedSubscription = await updateSubscriptionFromStripe(
    {
      userId: params.userId,
      tenantId: params.tenantId,
      plan,
      // crm-r2-F110: the current price's interval wins over the checkout-time metadata.
      billingInterval: getStripeBillingInterval(params.subscription) ??
        normalizeBillingInterval(params.subscription.metadata?.billing_interval),
      startDate: toIsoDate(params.subscription.start_date),
      endDate: toIsoDate(params.subscription.current_period_end),
      currentPeriodStart: toIsoTimestamp(
        params.subscription.current_period_start ??
          params.subscription.start_date,
      ),
      currentPeriodEnd: toIsoTimestamp(params.subscription.current_period_end),
      status,
      cancelAtPeriodEnd: params.subscription.cancel_at_period_end ?? false,
      trialEnd: params.subscription.trial_end
        ? toIsoTimestamp(params.subscription.trial_end)
        : null,
      stripeCustomerId,
      stripeSubscriptionId: params.subscription.id,
      eventCreatedAt: params.eventCreatedAt,
      resetUsage: entitled ? params.resetUsage : undefined,
      isFoundingCustomer: entitled ? params.isFoundingCustomer : undefined,
    },
    deps,
  );

  if (updatedSubscription) {
    await dispatchSubscriptionStateChange(
      params.dispatchEvent,
      params.userId,
      params.tenantId,
      updatedSubscription,
      deps,
    );
  }

  return { plan, status, existingSubscription, updatedSubscription };
}

export async function handleStripeEvent(
  event: Stripe.Event,
  deps: StripeWebhookDependencies = defaultDependencies,
): Promise<void> {
  switch (event.type) {
    // crm-r2-F109: a Checkout session grants the plan only once it is paid or needs no payment. A delayed
    // payment method completes the session unpaid and later sends async_payment_succeeded (handled the
    // same way) or async_payment_failed (grants nothing).
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object as Stripe.Checkout.Session;
      deps.logStep("Processing checkout completion", {
        sessionId: session.id,
        type: event.type,
      });

      if (
        session.payment_status !== "paid" &&
        session.payment_status !== "no_payment_required"
      ) {
        deps.logStep("Checkout session not paid; no plan applied", {
          sessionId: session.id,
          paymentStatus: session.payment_status,
        });
        return;
      }

      const userId = session.metadata?.user_id;
      const checkoutPlan = normalizePlan(session.metadata?.plan);
      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id;

      if (!userId || !checkoutPlan || !subscriptionId) {
        deps.logStep("Missing metadata in checkout session", {
          userId,
          plan: checkoutPlan,
          subscriptionId,
        });
        return;
      }

      const subscription =
        await deps.stripe.subscriptions.retrieve(subscriptionId);
      const tenantId = await getTenantIdForUser(userId, deps);

      try {
        const { plan } = await syncStripeSubscription(
          {
            subscription,
            userId,
            tenantId,
            dispatchEvent: "subscription.created",
            eventCreatedAt: getEventCreatedAt(event),
            fallbackPlan: checkoutPlan,
            resetUsage: true,
            isFoundingCustomer: true,
          },
          deps,
        );

        deps.logStep("Successfully updated subscription after checkout", {
          userId,
          tenantId,
          plan,
        });
      } catch (error) {
        deps.logStep("Error updating subscription after checkout", {
          userId,
          tenantId,
          error: errorMessage(error),
        });
        // crm-r2-F108: rethrow so the event claim is released and Stripe retries.
        throw error;
      }

      return;
    }

    case "checkout.session.async_payment_failed": {
      const session = event.data.object as Stripe.Checkout.Session;
      deps.logStep("Checkout payment failed; no plan applied", {
        sessionId: session.id,
      });
      return;
    }

    case "customer.subscription.created": {
      const subscription = event.data.object as Stripe.Subscription;
      deps.logStep("Processing subscription creation", {
        subscriptionId: subscription.id,
      });

      const userContext = await resolveUserForSubscription(subscription, deps);
      if (!userContext) {
        return;
      }

      const existingSubscription = await getLatestSubscriptionRecord(
        userContext.userId,
        deps,
      );
      const status = normalizeStripeStatus(subscription.status);
      const plan: SubscriptionPlan = isEntitledStatus(status)
        ? resolveStripePlan(subscription, existingSubscription)
        : "expired";

      if (
        isDuplicateCreatedSubscription(
          existingSubscription,
          subscription,
          plan,
          status,
        )
      ) {
        deps.logStep("Skipping duplicate subscription creation sync", {
          userId: userContext.userId,
          subscriptionId: subscription.id,
        });
        return;
      }

      try {
        await syncStripeSubscription(
          {
            subscription,
            userId: userContext.userId,
            tenantId: userContext.tenantId,
            dispatchEvent: "subscription.created",
            eventCreatedAt: getEventCreatedAt(event),
          },
          deps,
        );

        deps.logStep("Successfully synchronized subscription creation", {
          userId: userContext.userId,
          tenantId: userContext.tenantId,
          plan,
        });
      } catch (error) {
        deps.logStep("Error synchronizing subscription creation", {
          userId: userContext.userId,
          tenantId: userContext.tenantId,
          error: errorMessage(error),
        });
        throw error;
      }

      return;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      deps.logStep("Processing subscription deletion", {
        subscriptionId: subscription.id,
      });

      const userContext = await resolveUserForSubscription(subscription, deps);
      if (!userContext) {
        return;
      }

      try {
        const updatedSubscription = await updateSubscriptionFromStripe(
          {
            userId: userContext.userId,
            tenantId: userContext.tenantId,
            plan: "expired",
            billingInterval: getStripeBillingInterval(subscription) ?? "monthly",
            startDate: toIsoDate(subscription.start_date),
            endDate: toIsoDate(subscription.current_period_end),
            currentPeriodStart: toIsoTimestamp(
              subscription.current_period_start ?? subscription.start_date,
            ),
            currentPeriodEnd: toIsoTimestamp(subscription.current_period_end),
            status: "canceled",
            cancelAtPeriodEnd: false,
            trialEnd: subscription.trial_end
              ? toIsoTimestamp(subscription.trial_end)
              : null,
            stripeCustomerId: getCustomerId(subscription.customer),
            stripeSubscriptionId: subscription.id,
            eventCreatedAt: getEventCreatedAt(event),
          },
          deps,
        );

        if (updatedSubscription) {
          await dispatchSubscriptionStateChange(
            "subscription.deleted",
            userContext.userId,
            userContext.tenantId,
            updatedSubscription,
            deps,
          );

          deps.logStep("Successfully updated subscription to expired", {
            userId: userContext.userId,
            tenantId: userContext.tenantId,
          });
        }
      } catch (error) {
        deps.logStep("Error updating subscription to expired", {
          userId: userContext.userId,
          tenantId: userContext.tenantId,
          error: errorMessage(error),
        });
        throw error;
      }

      return;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      deps.logStep("Processing subscription update", {
        subscriptionId: subscription.id,
      });

      const userContext = await resolveUserForSubscription(subscription, deps);
      if (!userContext) {
        return;
      }

      try {
        const { plan } = await syncStripeSubscription(
          {
            subscription,
            userId: userContext.userId,
            tenantId: userContext.tenantId,
            dispatchEvent: "subscription.updated",
            eventCreatedAt: getEventCreatedAt(event),
          },
          deps,
        );

        deps.logStep("Successfully synchronized subscription update", {
          userId: userContext.userId,
          tenantId: userContext.tenantId,
          plan,
        });
      } catch (error) {
        deps.logStep("Error synchronizing subscription update", {
          userId: userContext.userId,
          tenantId: userContext.tenantId,
          error: errorMessage(error),
        });
        throw error;
      }

      return;
    }

    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice;
      deps.logStep("Processing successful payment", { invoiceId: invoice.id });

      if (!invoice.subscription) {
        return;
      }

      const subscription = await deps.stripe.subscriptions.retrieve(
        invoice.subscription as string,
      );
      const userContext = await resolveUserForSubscription(subscription, deps);
      if (!userContext) {
        return;
      }

      try {
        const { plan } = await syncStripeSubscription(
          {
            subscription,
            userId: userContext.userId,
            tenantId: userContext.tenantId,
            dispatchEvent: "subscription.updated",
            eventCreatedAt: getEventCreatedAt(event),
          },
          deps,
        );

        deps.logStep("Successfully updated subscription after payment", {
          userId: userContext.userId,
          tenantId: userContext.tenantId,
          plan,
        });
      } catch (error) {
        deps.logStep("Error updating subscription after payment", {
          userId: userContext.userId,
          tenantId: userContext.tenantId,
          error: errorMessage(error),
        });
        throw error;
      }

      return;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      deps.logStep("Processing failed payment", { invoiceId: invoice.id });

      if (!invoice.subscription) {
        return;
      }

      const subscription = await deps.stripe.subscriptions.retrieve(
        invoice.subscription as string,
      );
      const userContext = await resolveUserForSubscription(subscription, deps);
      if (!userContext) {
        return;
      }

      try {
        const { plan } = await syncStripeSubscription(
          {
            subscription,
            userId: userContext.userId,
            tenantId: userContext.tenantId,
            dispatchEvent: "subscription.updated",
            eventCreatedAt: getEventCreatedAt(event),
            overrideStatus: "past_due",
          },
          deps,
        );

        deps.logStep("Successfully marked subscription past due", {
          userId: userContext.userId,
          tenantId: userContext.tenantId,
          plan,
        });
      } catch (error) {
        deps.logStep("Error marking subscription past due", {
          userId: userContext.userId,
          tenantId: userContext.tenantId,
          error: errorMessage(error),
        });
        throw error;
      }

      return;
    }

    default:
      deps.logStep("Unhandled webhook event type", { type: event.type });
  }
}

export async function handleStripeWebhook(
  req: Request,
  deps: StripeWebhookDependencies = defaultDependencies,
): Promise<Response> {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("No signature", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const body = await req.text();
    const webhookSecret = deps.webhookSecret;

    if (!webhookSecret) {
      deps.logStep("No webhook secret configured");
      return new Response("Webhook secret not configured", { status: 400 });
    }

    event = await deps.stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret,
    );
  } catch (error) {
    const message = errorMessage(error);
    deps.logStep("Webhook error", { error: message });
    return new Response(`Webhook error: ${message}`, { status: 400 });
  }
  deps.logStep("Webhook event received", { type: event.type, id: event.id });

  // crm-r2-F108: a delivery is acknowledged (2xx) only when its event was applied, skipped on purpose
  // or already claimed. A claim or apply failure answers 500, after releasing the claim, so Stripe's
  // retry applies the event; a failed release is logged (the retry would then be skipped as duplicate).
  try {
    if (!(await claimStripeEvent(event.id, deps))) {
      deps.logStep("Duplicate webhook event skipped", { id: event.id });
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }
  } catch (error) {
    deps.logStep("Webhook claim failed", {
      id: event.id,
      error: errorMessage(error),
    });
    return new Response("Webhook processing failed", { status: 500 });
  }

  try {
    await handleStripeEvent(event, deps);
  } catch (error) {
    const released = await releaseStripeEvent(event.id, deps);
    deps.logStep("Webhook apply failed", {
      id: event.id,
      type: event.type,
      claimReleased: released,
      error: errorMessage(error),
    });
    return new Response("Webhook processing failed", { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
}

if (import.meta.main) {
  serve((req) => handleStripeWebhook(req));
}
