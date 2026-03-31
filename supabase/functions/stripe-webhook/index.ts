import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14";
import { createClient } from "npm:@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
});

const supabaseClient = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
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

const PLAN_LIMITS: Record<
  SubscriptionPlan,
  { email_quota: number; sms_quota: number }
> = {
  free_trial: { email_quota: 1000, sms_quota: 250 },
  seed: { email_quota: 10000, sms_quota: 1000 },
  sprout: { email_quota: 20000, sms_quota: 2000 },
  bloom: { email_quota: 100000, sms_quota: 5000 },
  thrive: { email_quota: -1, sms_quota: 50000 },
  expired: { email_quota: 0, sms_quota: 0 },
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
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

function getStripeBillingInterval(
  subscription: Stripe.Subscription,
): BillingInterval {
  const interval = subscription.items.data[0]?.price.recurring?.interval;
  return interval === "year" ? "annual" : "monthly";
}

function toIsoDate(unixSeconds?: number | null): string {
  return new Date((unixSeconds ?? Math.floor(Date.now() / 1000)) * 1000)
    .toISOString()
    .split("T")[0];
}

function getCustomerEmail(
  customer: Stripe.Customer | Stripe.DeletedCustomer,
): string | null {
  return "email" in customer && typeof customer.email === "string"
    ? customer.email
    : null;
}

async function getTenantIdForUser(userId: string): Promise<string | null> {
  const { data, error } = await supabaseClient
    .from("users")
    .select("tenant_id")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    logStep("Failed to resolve tenant for user", {
      error: error.message,
      userId,
    });
    return null;
  }

  return data?.tenant_id ?? null;
}

async function resolveUserFromEmail(
  email: string,
): Promise<{ userId: string; tenantId: string | null } | null> {
  const { data, error } = await supabaseClient.auth.admin.getUserByEmail(email);

  if (error || !data.user) {
    logStep("Failed to resolve user from email", {
      email,
      error: error?.message,
    });
    return null;
  }

  return {
    userId: data.user.id,
    tenantId: await getTenantIdForUser(data.user.id),
  };
}

async function getLatestSubscriptionRecord(userId: string) {
  const { data, error } = await supabaseClient
    .from("subscriptions")
    .select("id, plan, tier, billing_interval")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    logStep("Failed to load existing subscription", {
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
) {
  if (!tenantId) {
    return;
  }

  const { error } = await supabaseClient.rpc(
    "sync_subscription_to_org_budget",
    {
      p_tenant_id: tenantId,
      p_plan: plan ?? undefined,
    },
  );

  if (error) {
    logStep("Failed to sync tenant budget", {
      tenantId,
      plan,
      error: error.message,
    });
  }
}

async function upsertSubscriptionRecord(params: {
  userId: string;
  plan: SubscriptionPlan;
  billingInterval: BillingInterval;
  startDate: string;
  endDate: string;
  resetUsage?: boolean;
  isFoundingCustomer?: boolean;
}) {
  const now = new Date().toISOString();
  const limits = PLAN_LIMITS[params.plan];
  const existingSubscription = await getLatestSubscriptionRecord(params.userId);

  const payload: Record<string, unknown> = {
    plan: params.plan,
    tier: params.plan,
    billing_interval: params.billingInterval,
    start_date: params.startDate,
    end_date: params.endDate,
    email_quota: limits.email_quota,
    sms_quota: limits.sms_quota,
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
    const { error } = await supabaseClient
      .from("subscriptions")
      .update(payload)
      .eq("id", existingSubscription.id);

    if (error) {
      throw error;
    }

    return existingSubscription.id;
  }

  const { data, error } = await supabaseClient
    .from("subscriptions")
    .insert({
      user_id: params.userId,
      ...payload,
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return data.id;
}

async function updateSubscriptionFromStripe(params: {
  userId: string;
  tenantId: string | null;
  plan: SubscriptionPlan;
  billingInterval: BillingInterval;
  startDate: string;
  endDate: string;
  resetUsage?: boolean;
  isFoundingCustomer?: boolean;
}) {
  await upsertSubscriptionRecord(params);
  await syncTenantBudget(params.tenantId, params.plan);
}

serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("No signature", { status: 400 });
  }

  try {
    const body = await req.text();
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    if (!webhookSecret) {
      logStep("No webhook secret configured");
      return new Response("Webhook secret not configured", { status: 400 });
    }

    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      webhookSecret,
    );
    logStep("Webhook event received", { type: event.type, id: event.id });

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        logStep("Processing checkout completion", { sessionId: session.id });

        const userId = session.metadata?.user_id;
        const checkoutPlan = normalizePlan(session.metadata?.plan);
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;

        if (!userId || !checkoutPlan || !subscriptionId) {
          logStep("Missing metadata in checkout session", {
            userId,
            plan: checkoutPlan,
            subscriptionId,
          });
          break;
        }

        const subscription =
          await stripe.subscriptions.retrieve(subscriptionId);
        const tenantId = await getTenantIdForUser(userId);
        const plan = normalizePlan(subscription.metadata.plan) ?? checkoutPlan;
        const billingInterval = normalizeBillingInterval(
          session.metadata?.billing_interval ??
            subscription.metadata.billing_interval ??
            getStripeBillingInterval(subscription),
        );

        try {
          await updateSubscriptionFromStripe({
            userId,
            tenantId,
            plan,
            billingInterval,
            startDate: toIsoDate(subscription.start_date),
            endDate: toIsoDate(subscription.current_period_end),
            resetUsage: true,
            isFoundingCustomer: true,
          });

          logStep("Successfully updated subscription after checkout", {
            userId,
            tenantId,
            plan,
            billingInterval,
          });
        } catch (error) {
          logStep("Error updating subscription after checkout", {
            userId,
            tenantId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        logStep("Processing subscription deletion", {
          subscriptionId: subscription.id,
        });

        const customer = await stripe.customers.retrieve(
          subscription.customer as string,
        );
        const customerEmail = getCustomerEmail(customer);

        if (customerEmail) {
          const userContext = await resolveUserFromEmail(customerEmail);
          if (!userContext) {
            break;
          }

          try {
            await updateSubscriptionFromStripe({
              userId: userContext.userId,
              tenantId: userContext.tenantId,
              plan: "expired",
              billingInterval: getStripeBillingInterval(subscription),
              startDate: toIsoDate(subscription.start_date),
              endDate: toIsoDate(subscription.current_period_end),
            });

            logStep("Successfully updated subscription to expired", {
              userId: userContext.userId,
              tenantId: userContext.tenantId,
            });
          } catch (error) {
            logStep("Error updating subscription to expired", {
              userId: userContext.userId,
              tenantId: userContext.tenantId,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        logStep("Processing subscription update", {
          subscriptionId: subscription.id,
        });

        const customer = await stripe.customers.retrieve(
          subscription.customer as string,
        );
        const customerEmail = getCustomerEmail(customer);
        if (!customerEmail) {
          break;
        }

        const userContext = await resolveUserFromEmail(customerEmail);
        if (!userContext) {
          break;
        }

        const existingSubscription = await getLatestSubscriptionRecord(
          userContext.userId,
        );
        const plan =
          normalizePlan(subscription.metadata.plan) ??
          normalizePlan(existingSubscription?.tier) ??
          normalizePlan(existingSubscription?.plan) ??
          "seed";

        try {
          await updateSubscriptionFromStripe({
            userId: userContext.userId,
            tenantId: userContext.tenantId,
            plan,
            billingInterval: normalizeBillingInterval(
              subscription.metadata.billing_interval ??
                getStripeBillingInterval(subscription),
            ),
            startDate: toIsoDate(subscription.start_date),
            endDate: toIsoDate(subscription.current_period_end),
          });

          logStep("Successfully synchronized subscription update", {
            userId: userContext.userId,
            tenantId: userContext.tenantId,
            plan,
          });
        } catch (error) {
          logStep("Error synchronizing subscription update", {
            userId: userContext.userId,
            tenantId: userContext.tenantId,
            error: error instanceof Error ? error.message : String(error),
          });
        }

        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        logStep("Processing successful payment", { invoiceId: invoice.id });

        if (invoice.subscription) {
          const subscription = await stripe.subscriptions.retrieve(
            invoice.subscription as string,
          );
          const customer = await stripe.customers.retrieve(
            subscription.customer as string,
          );

          const customerEmail = getCustomerEmail(customer);
          if (customerEmail) {
            const userContext = await resolveUserFromEmail(customerEmail);
            if (!userContext) {
              break;
            }

            const existingSubscription = await getLatestSubscriptionRecord(
              userContext.userId,
            );
            const plan =
              normalizePlan(subscription.metadata.plan) ??
              normalizePlan(existingSubscription?.tier) ??
              normalizePlan(existingSubscription?.plan) ??
              "seed";

            try {
              await updateSubscriptionFromStripe({
                userId: userContext.userId,
                tenantId: userContext.tenantId,
                plan,
                billingInterval: normalizeBillingInterval(
                  subscription.metadata.billing_interval ??
                    getStripeBillingInterval(subscription),
                ),
                startDate: toIsoDate(subscription.start_date),
                endDate: toIsoDate(subscription.current_period_end),
              });

              logStep("Successfully updated subscription after payment", {
                userId: userContext.userId,
                tenantId: userContext.tenantId,
                plan,
              });
            } catch (error) {
              logStep("Error updating subscription after payment", {
                userId: userContext.userId,
                tenantId: userContext.tenantId,
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }
        }
        break;
      }

      default:
        logStep("Unhandled webhook event type", { type: event.type });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    logStep("Webhook error", { error: error.message });
    return new Response(`Webhook error: ${error.message}`, { status: 400 });
  }
});
