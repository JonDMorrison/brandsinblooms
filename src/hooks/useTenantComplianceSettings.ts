import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  parseComplianceSettings,
  serializeComplianceSettings,
  type ComplianceSettingsState,
} from "@/lib/complianceSettings";

export const tenantComplianceSettingsQueryKey = (tenantId: string | null | undefined) =>
  ["tenant-compliance-settings", tenantId ?? null] as const;

export async function fetchTenantComplianceSettings(
  tenantId: string,
): Promise<ComplianceSettingsState> {
  const { data, error } = await supabase
    .from("tenant_compliance_settings")
    .select("settings")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) throw error;
  return parseComplianceSettings(data?.settings ?? null);
}

export async function saveTenantComplianceSettings(
  tenantId: string,
  settings: ComplianceSettingsState,
): Promise<ComplianceSettingsState> {
  const { data, error } = await supabase
    .from("tenant_compliance_settings")
    .upsert(
      { tenant_id: tenantId, settings: serializeComplianceSettings(settings) },
      { onConflict: "tenant_id" },
    )
    .select("settings")
    .single();

  if (error) throw error;
  return parseComplianceSettings(data.settings);
}

export function useTenantComplianceSettings(tenantId: string | null | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: tenantComplianceSettingsQueryKey(tenantId),
    queryFn: () => fetchTenantComplianceSettings(tenantId as string),
    enabled: Boolean(tenantId),
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: (settings: ComplianceSettingsState) => {
      if (!tenantId) {
        throw new Error("No workspace is selected.");
      }
      return saveTenantComplianceSettings(tenantId, settings);
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(tenantComplianceSettingsQueryKey(tenantId), saved);
    },
  });

  return { query, mutation };
}
