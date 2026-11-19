-- crm-r1-F03: a signed-in user could insert or update their own subscriptions row
-- from the browser with any plan, tier, end date or quota ("Users can insert their
-- own subscription" checks only user_id; "Users can update their own subscription"
-- has no WITH CHECK and no column limit). One PATCH gave an account the top tier
-- for ten years, which resolve_effective_subscription_tier then reports for its
-- tenant (budgets, OAuth subscription status, partner webhooks).
--
-- Subscriptions are created and changed only on the server: sign-up provisioning
-- and the Stripe webhook (service_role), and SECURITY DEFINER functions owned by
-- postgres. None of them depends on these policies or on API-role write grants.
-- Reading one's own subscription ("Users can view their own subscription") stays.

DROP POLICY IF EXISTS "Users can insert their own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can update their own subscription" ON public.subscriptions;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.subscriptions FROM anon, authenticated;
