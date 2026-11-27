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
  tenantCache.clear();
}

const tenantCache = new Map<string, Promise<string | null>>();

/**
 * The user_id whose company_profiles row represents `tenantId`'s business,
 * for the signed-in `userId` working in that tenant.
 *
 * In the user's own tenant this is getBusinessProfileUserId. In any other
 * tenant (a master admin using the tenant switcher) it is that tenant's
 * profile (public.tenant_profile_user_id), never the signed-in user's own
 * company. Returns null when that tenant's profile cannot be resolved, so
 * callers show the tenant's own name rather than someone else's business.
 */
export function getTenantBusinessProfileUserId(
  userId: string,
  tenantId: string | null | undefined,
): Promise<string | null> {
  if (!tenantId) return getBusinessProfileUserId(userId);

  const key = `${userId}:${tenantId}`;
  const cached = tenantCache.get(key);
  if (cached) return cached;

  const pending = (async (): Promise<string | null> => {
    try {
      const { data: member, error: memberError } = await supabase
        .from("users")
        .select("tenant_id")
        .eq("id", userId)
        .maybeSingle();
      if (!memberError && member?.tenant_id === tenantId) {
        return await getBusinessProfileUserId(userId);
      }

      const { data, error } = await supabase.rpc("tenant_profile_user_id", {
        p_tenant_id: tenantId,
      });
      if (error) {
        tenantCache.delete(key);
        return null;
      }
      return typeof data === "string" && data ? data : null;
    } catch {
      tenantCache.delete(key);
      return null;
    }
  })();

  tenantCache.set(key, pending);
  return pending;
}
