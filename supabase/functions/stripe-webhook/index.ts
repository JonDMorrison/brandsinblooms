import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14";
import { createClient } from "npm:@supabase/supabase-js@2";

import { getPlanQuotaDefaults } from "../_shared/planFeatures.ts";
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
  { auth: { persistSession: false } },
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
      getUserByEmail: (email: string) => Promise<{
        data: { user: StripeWebhookUser | null };
        error: { message: string } | null;
      }>;
    };
  };
  from: (table: string) => {
    select: (columns?: string) => unknown;
    update: (payload: unknown) => unknown;
    insert: (payload: unknown) => unknown;
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

function normalizeStripeStatus(
  value: string | null | undefined,
  plan: SubscriptionPlan,
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
    case "unpaid":
      return "unpaid";
    default:
      return plan === "expired"
        ? "expired"
        : plan === "free_trial"
          ? "trialing"
          : "active";
  }
}

function getStripeBillingInterval(
  subscription: Stripe.Subscription,
): BillingInterval {
  const interval = subscription.items.data[0]?.price.recurring?.interval;
  return interval === "year" ? "annual" : "monthly";
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

  if (customer && "id" in customer && typeof customer.id === "string") {
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

function getCustomerEmail(
  customer: Stripe.Customer | Stripe.DeletedCustomer,
): string | null {
  return "email" in customer && typeof customer.email === "string"
    ? customer.email
    : null;
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

async function resolveUserFromEmail(
  email: string,
  deps: StripeWebhookDependencies = defaultDependencies,
): Promise<{ userId: string; tenantId: string | null } | null> {
  const { data, error } =
    await deps.supabaseClient.auth.admin.getUserByEmail(email);

  if (error || !data.user) {
    deps.logStep("Failed to resolve user from email", {
      email,
      error: error?.message,
    });
    return null;
  }

  return {
    userId: data.user.id,
    tenantId: await getTenantIdForUser(data.user.id, deps),
  };
}

async function getLatestSubscriptionRecord(
  userId: string,
  deps: StripeWebhookDependencies = defaultDependencies,
) {
  const query = deps.supabaseClient
    .from("subscriptions")
    .select(
      "id, user_id, plan, tier, status, billing_interval, current_period_start, current_period_end, cancel_at_period_end, trial_end, start_date, end_date, deleted_at, max_connections, stripe_customer_id, stripe_subscription_id",
    ) as SupabaseQueryChain;
  const { data, error } = await query
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<SubscriptionRow>();

  if (error) {
    deps.logStep("Failed to load existing subscription", {
      userId,
      error: error.message,
    });
    return null;
  }

  return data;
}

async function syncTenantBudget(
  tenantId: string | null,
  plan?: SubscriptionPlan | null,
  deps: StripeWebhookDependencies = defaultDependencies,
) {
  if (!tenantId) {
    return;
  }

  const { error } = await deps.supabaseClient.rpc(
    "sync_subscription_to_org_budget",
    {
      p_tenant_id: tenantId,
      p_plan: plan ?? undefined,
    },
  );

  if (error) {
    deps.logStep("Failed to sync tenant budget", {
      tenantId,
      plan,
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
    cancelAtPeriodEnd?: boolean;
    trialEnd?: string | null;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    resetUsage?: boolean;
    isFoundingCustomer?: boolean;
  },
  deps: StripeWebhookDependencies = defaultDependencies,
) {
  const now = deps.now().toISOString();
  const quotaDefaults = getPlanQuotaDefaults(params.plan);
  const existingSubscription = await getLatestSubscriptionRecord(
    params.userId,
    deps,
  );

  const payload: Record<string, unknown> = {
    plan: params.plan,
    tier: params.plan,
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
    const updateQuery = deps.supabaseClient
      .from("subscriptions")
      .update(payload) as {
      eq: (
        column: string,
        value: unknown,
      ) => Promise<{
        error: { message: string } | null;
      }>;
    };
    const { error } = await updateQuery.eq("id", existingSubscription.id);

    if (error) {
      throw error;
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
    cancelAtPeriodEnd?: boolean;
    trialEnd?: string | null;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    resetUsage?: boolean;
    isFoundingCustomer?: boolean;
  },
  deps: StripeWebhookDependencies = defaultDependencies,
) {
  const updatedSubscription = await upsertSubscriptionRecord(params, deps);
  await syncTenantBudget(params.tenantId, params.plan, deps);
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

async function syncStripeSubscription(
  params: {
    subscription: Stripe.Subscription;
    userId: string;
    tenantId: string | null;
    dispatchEvent: string;
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
  const plan =
    params.overridePlan ??
    normalizePlan(params.subscription.metadata.plan) ??
    normalizePlan(existingSubscription?.tier) ??
    normalizePlan(existingSubscription?.plan) ??
    params.fallbackPlan ??
    "seed";
  const status =
    params.overrideStatus ??
    normalizeStripeStatus(params.subscription.status, plan);
  const stripeCustomerId = getCustomerId(params.subscription.customer);

  const updatedSubscription = await updateSubscriptionFromStripe(
    {
      userId: params.userId,
      tenantId: params.tenantId,
      plan,
      billingInterval: normalizeBillingInterval(
        params.subscription.metadata.billing_interval ??
          getStripeBillingInterval(params.subscription),
      ),
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
      resetUsage: params.resetUsage,
      isFoundingCustomer: params.isFoundingCustomer,
    },
    deps,
  );

  await dispatchSubscriptionStateChange(
    params.dispatchEvent,
    params.userId,
    params.tenantId,
    updatedSubscription,
    deps,
  );

  return { plan, status, existingSubscription, updatedSubscription };
}

export async function handleStripeEvent(
  event: Stripe.Event,
  deps: StripeWebhookDependencies = defaultDependencies,
): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      deps.logStep("Processing checkout completion", { sessionId: session.id });

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
      }

      return;
    }

    case "customer.subscription.created": {
      const subscription = event.data.object as Stripe.Subscription;
      deps.logStep("Processing subscription creation", {
        subscriptionId: subscription.id,
      });

      const customer = await deps.stripe.customers.retrieve(
        getCustomerId(subscription.customer) ?? "",
      );
      const customerEmail = getCustomerEmail(customer);
      if (!customerEmail) {
        return;
      }

      const userContext = await resolveUserFromEmail(customerEmail, deps);
      if (!userContext) {
        return;
      }

      const existingSubscription = await getLatestSubscriptionRecord(
        userContext.userId,
        deps,
      );
      const plan =
        normalizePlan(subscription.metadata.plan) ??
        normalizePlan(existingSubscription?.tier) ??
        normalizePlan(existingSubscription?.plan) ??
        "seed";
      const status = normalizeStripeStatus(subscription.status, plan);

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
            fallbackPlan: plan,
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
      }

      return;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      deps.logStep("Processing subscription deletion", {
        subscriptionId: subscription.id,
      });

      const customer = await deps.stripe.customers.retrieve(
        getCustomerId(subscription.customer) ?? "",
      );
      const customerEmail = getCustomerEmail(customer);

      if (!customerEmail) {
        return;
      }

      const userContext = await resolveUserFromEmail(customerEmail, deps);
      if (!userContext) {
        return;
      }

      try {
        const updatedSubscription = await updateSubscriptionFromStripe(
          {
            userId: userContext.userId,
            tenantId: userContext.tenantId,
            plan: "expired",
            billingInterval: getStripeBillingInterval(subscription),
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
          },
          deps,
        );

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
      } catch (error) {
        deps.logStep("Error updating subscription to expired", {
          userId: userContext.userId,
          tenantId: userContext.tenantId,
          error: errorMessage(error),
        });
      }

      return;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      deps.logStep("Processing subscription update", {
        subscriptionId: subscription.id,
      });

      const customer = await deps.stripe.customers.retrieve(
        getCustomerId(subscription.customer) ?? "",
      );
      const customerEmail = getCustomerEmail(customer);
      if (!customerEmail) {
        return;
      }

      const userContext = await resolveUserFromEmail(customerEmail, deps);
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
      const customer = await deps.stripe.customers.retrieve(
        getCustomerId(subscription.customer) ?? "",
      );

      const customerEmail = getCustomerEmail(customer);
      if (!customerEmail) {
        return;
      }

      const userContext = await resolveUserFromEmail(customerEmail, deps);
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
      const customer = await deps.stripe.customers.retrieve(
        getCustomerId(subscription.customer) ?? "",
      );
      const customerEmail = getCustomerEmail(customer);

      if (!customerEmail) {
        return;
      }

      const userContext = await resolveUserFromEmail(customerEmail, deps);
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

  try {
    const body = await req.text();
    const webhookSecret = deps.webhookSecret;

    if (!webhookSecret) {
      deps.logStep("No webhook secret configured");
      return new Response("Webhook secret not configured", { status: 400 });
    }

    const event = deps.stripe.webhooks.constructEvent(
      body,
      signature,
      webhookSecret,
    );
    deps.logStep("Webhook event received", { type: event.type, id: event.id });

    await handleStripeEvent(event, deps);

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const message = errorMessage(error);
    deps.logStep("Webhook error", { error: message });
    return new Response(`Webhook error: ${message}`, { status: 400 });
  }
}

serve((req) => handleStripeWebhook(req));
