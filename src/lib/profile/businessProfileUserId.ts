import { supabase } from "@/integrations/supabase/client";

// company_profiles has one row per user, but the row describes the business.
// A teammate who joined an existing tenant reads and edits the tenant's
// profile, which belongs to the tenant owner. This resolves the user id whose
// company_profiles row represents the signed-in user's business
// (public.current_profile_user_id). Single-user tenants, users without a
// tenant and master admins resolve to themselves.

const cache = new Map<string, Promise<string>>();

/**
 * The user_id to use for company_profiles reads and writes on behalf of
 * `userId` (the signed-in user). Falls back to `userId` if the lookup fails,
 * which is the behaviour every single-user business already has.
 */
export function getBusinessProfileUserId(userId: string): Promise<string> {
  const cached = cache.get(userId);
  if (cached) return cached;

  const pending = (async () => {
    try {
      // The RPC resolves the signed-in user only. Any other id (admin tools
      // acting on a specific user) is used as given.
      const { data: session } = await supabase.auth.getSession();
      if (session.session?.user.id !== userId) {
        cache.delete(userId);
        return userId;
      }
      const { data, error } = await supabase.rpc("current_profile_user_id");
      if (error || typeof data !== "string" || !data) {
        cache.delete(userId);
        return userId;
      }
      return data;
    } catch {
      cache.delete(userId);
      return userId;
    }
  })();

  cache.set(userId, pending);
  return pending;
}

/** Forget resolved ids, e.g. after the user joins a team. */
export function clearBusinessProfileUserIdCache(): void {
  cache.clear();
}
