
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from "npm:stripe@14.21.0"
import { createClient } from "npm:@supabase/supabase-js@2.38.0"

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
});

const supabaseClient = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false } }
);

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

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

    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    logStep("Webhook event received", { type: event.type, id: event.id });

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        logStep("Processing checkout completion", { sessionId: session.id });

        const userId = session.metadata?.user_id;
        const plan = session.metadata?.plan;
        const billingInterval = session.metadata?.billing_interval;

        if (!userId || !plan || !billingInterval) {
          logStep("Missing metadata in checkout session", { userId, plan, billingInterval });
          break;
        }

        // Get subscription details
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
        const startDate = new Date(subscription.start_date * 1000).toISOString().split('T')[0];
        const endDate = new Date(subscription.current_period_end * 1000).toISOString().split('T')[0];

        // Update subscription in database
        const { error } = await supabaseClient
          .from('subscriptions')
          .update({
            plan: plan as 'sprout' | 'bloom',
            billing_interval: billingInterval as 'monthly' | 'annual',
            start_date: startDate,
            end_date: endDate,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);

        if (error) {
          logStep("Error updating subscription after checkout", { error, userId });
        } else {
          logStep("Successfully updated subscription after checkout", { userId, plan, billingInterval });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        logStep("Processing subscription deletion", { subscriptionId: subscription.id });

        const customer = await stripe.customers.retrieve(subscription.customer as string);
        if ('email' in customer && customer.email) {
          // Find user by email and update subscription to expired
          const { data: authUser } = await supabaseClient.auth.admin.getUserByEmail(customer.email);
          
          if (authUser.user) {
            const { error } = await supabaseClient
              .from('subscriptions')
              .update({
                plan: 'expired',
                updated_at: new Date().toISOString()
              })
              .eq('user_id', authUser.user.id);

            if (error) {
              logStep("Error updating subscription to expired", { error, userId: authUser.user.id });
            } else {
              logStep("Successfully updated subscription to expired", { userId: authUser.user.id });
            }
          }
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        logStep("Processing successful payment", { invoiceId: invoice.id });

        if (invoice.subscription) {
          const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
          const customer = await stripe.customers.retrieve(subscription.customer as string);
          
          if ('email' in customer && customer.email) {
            const { data: authUser } = await supabaseClient.auth.admin.getUserByEmail(customer.email);
            
            if (authUser.user) {
              const endDate = new Date(subscription.current_period_end * 1000).toISOString().split('T')[0];
              
              const { error } = await supabaseClient
                .from('subscriptions')
                .update({
                  end_date: endDate,
                  updated_at: new Date().toISOString()
                })
                .eq('user_id', authUser.user.id);

              if (error) {
                logStep("Error updating subscription end date", { error, userId: authUser.user.id });
              } else {
                logStep("Successfully updated subscription end date", { userId: authUser.user.id });
              }
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
