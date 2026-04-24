import { supabase } from "@/integrations/supabase/client";
import { getUserAssignedTenantId } from "@/utils/getUserAssignedTenantId";

interface ResolveTenantMutationContextOptions {
  userId?: string | null;
  tenantId?: string | null;
  isMasterAdmin?: boolean;
  activeTenantId?: string | null;
  hasHydratedTenantContext?: boolean;
}

export interface ResolvedTenantMutationContext {
  userId: string;
  tenantId: string;
}

export async function resolveTenantMutationContext(
  options: ResolveTenantMutationContextOptions,
): Promise<ResolvedTenantMutationContext> {
  let resolvedUserId = options.userId ?? null;

  if (!resolvedUserId) {
    const { data, error } = await supabase.auth.getUser();

    if (error) {
      throw new Error("Unable to determine the current user.");
    }

    resolvedUserId = data.user?.id ?? null;
  }

  if (!resolvedUserId) {
    throw new Error("You must be signed in to save segments.");
  }

  if (options.isMasterAdmin) {
    if (!options.hasHydratedTenantContext) {
      throw new Error(
        "Tenant context is still loading. Try again in a moment.",
      );
    }

    const resolvedTenantId =
      options.activeTenantId ??
      options.tenantId ??
      (await getUserAssignedTenantId(resolvedUserId));

    if (!resolvedTenantId) {
      throw new Error(
        "Select a tenant in Master Admin or assign a tenant to your user account before saving segments.",
      );
    }

    return {
      userId: resolvedUserId,
      tenantId: resolvedTenantId,
    };
  }

  if (options.tenantId) {
    return {
      userId: resolvedUserId,
      tenantId: options.tenantId,
    };
  }

  const { data, error } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", resolvedUserId)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to determine the current tenant.");
  }

  if (!data?.tenant_id) {
    throw new Error(
      "No tenant is assigned to your user. Please contact support.",
    );
  }

  return {
    userId: resolvedUserId,
    tenantId: data.tenant_id,
  };
}
