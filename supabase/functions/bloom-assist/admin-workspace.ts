import type { PersistenceClient } from "./types.ts";

/**
 * A master admin working inside a client company (the admin workspace switch,
 * stored in admin_session_context) uses Bloom in that company, matching how the
 * CRM pages and has_tenant_permission already scope them. Everyone else keeps
 * their own company. Returns null when no admin workspace applies.
 */
export async function resolveAdminWorkspaceTenant(
  userClient: Pick<PersistenceClient, "rpc" | "from">,
  userId: string,
): Promise<string | null> {
  const { data: isMasterAdmin, error: adminError } = await userClient.rpc(
    "is_master_admin",
    { _user_id: userId },
  );
  if (adminError) {
    throw new Error(`Failed to resolve admin access: ${adminError.message}`);
  }
  if (isMasterAdmin !== true) {
    return null;
  }

  const { data, error } = await userClient
    .from("admin_session_context")
    .select("active_tenant_id")
    .eq("admin_user_id", userId)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to resolve admin workspace: ${error.message}`);
  }

  const activeTenantId = (data as { active_tenant_id?: unknown } | null)
    ?.active_tenant_id;
  return typeof activeTenantId === "string" && activeTenantId.length > 0
    ? activeTenantId
    : null;
}
