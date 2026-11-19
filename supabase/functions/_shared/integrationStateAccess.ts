import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

/**
 * Re-check for OAuth callbacks that a provider redirect reaches without the user's JWT (central-login 59,
 * crm-r2-F71/F95/F96/F73): before any service-role write, the user an OAuth state names must still hold
 * `integrations.manage` for the state's tenant, the same rule `has_tenant_permission` applies for that
 * permission (an owner or admin member of the tenant, or a master admin whose active tenant it is).
 * Callbacks that do carry the user's JWT use `callerHasTenantPermission` instead. Fails closed.
 * Call only with a service-role client.
 */
export async function stateUserCanManageIntegrations(
  admin: SupabaseClient,
  userId: unknown,
  tenantId: unknown,
): Promise<boolean> {
  if (typeof userId !== "string" || !userId || typeof tenantId !== "string" || !tenantId) return false;

  const { data: member, error: memberError } = await admin
    .from("users")
    .select("id")
    .eq("id", userId)
    .eq("tenant_id", tenantId)
    .in("role", ["owner", "admin"])
    .maybeSingle();
  if (!memberError && member) return true;

  const { data: isMaster, error: masterError } = await admin.rpc("is_master_admin", { _user_id: userId });
  if (masterError || isMaster !== true) return false;

  const { data: context, error: contextError } = await admin
    .from("admin_session_context")
    .select("admin_user_id")
    .eq("admin_user_id", userId)
    .eq("active_tenant_id", tenantId)
    .maybeSingle();
  return !contextError && Boolean(context);
}
