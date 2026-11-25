// company_profiles has one row per user, but the row describes the business.
// A teammate who joined an existing tenant has no row of their own: their
// business profile is the tenant owner's (public.profile_user_id_for).
// Single-user tenants, users without a tenant, and tenants with no profile
// resolve to the user themselves, so existing behaviour is unchanged.
//
// profile_user_id_for is executable by service_role only; with any other
// client, or on error, the given id is returned unchanged.

// Structural so npm:, jsr: and esm.sh Supabase clients (typed or untyped)
// are all accepted.
interface RpcClient {
  rpc(fn: string, args?: Record<string, unknown>): unknown;
}

/** The user_id whose company_profiles row represents `userId`'s business. */
export async function resolveBusinessProfileUserId(
  supabase: RpcClient,
  userId: string,
): Promise<string> {
  if (!userId) return userId;
  try {
    const { data, error } = (await supabase.rpc("profile_user_id_for", {
      p_user_id: userId,
    })) as { data: unknown; error: unknown };
    if (error || typeof data !== "string" || !data) return userId;
    return data;
  } catch {
    return userId;
  }
}
