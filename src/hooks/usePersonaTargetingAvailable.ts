import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Whether any customer in the tenant belongs to a persona, by the same
 * membership the audience resolvers use (customer_personas rows, or the
 * legacy crm_customers.persona_id). "Target by persona" is hidden when this
 * is false: picking a persona with no members always gives an empty audience.
 */
export async function fetchTenantHasPersonaMembers(tenantId: string) {
  const [legacy, junction] = await Promise.all([
    supabase
      .from("crm_customers")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .not("persona_id", "is", null),
    supabase
      .from("customer_personas")
      .select("customer_id, crm_customers!inner(tenant_id)", { count: "exact", head: true })
      .eq("crm_customers.tenant_id", tenantId),
  ]);
  if (legacy.error) throw legacy.error;
  if (junction.error) throw junction.error;
  return (legacy.count ?? 0) + (junction.count ?? 0) > 0;
}

export function usePersonaTargetingAvailable(tenantId: string | null | undefined) {
  const query = useQuery({
    queryKey: ["persona-targeting-available", tenantId],
    enabled: Boolean(tenantId),
    staleTime: 5 * 60 * 1000,
    queryFn: () => fetchTenantHasPersonaMembers(tenantId!),
  });
  return {
    // Unknown (loading or failed) counts as available, so a failed check
    // never hides an option people rely on.
    available: query.data ?? true,
    loading: query.isLoading,
  };
}
