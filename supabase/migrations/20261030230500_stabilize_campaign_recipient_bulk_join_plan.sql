-- New campaigns can be underestimated until auto-analyze catches up. A nested
-- loop can recompute the event rollup for every recipient. Scope bulk join
-- planning and no-JIT execution to this reporting function only.
-- Keep the existing tenant guard, signature, event filtering and grants.
ALTER FUNCTION public.get_campaign_recipient_matches(uuid, text, text[], text, text, text, uuid[]) SET enable_nestloop TO off;
ALTER FUNCTION public.get_campaign_recipient_matches(uuid, text, text[], text, text, text, uuid[]) SET jit TO off;
