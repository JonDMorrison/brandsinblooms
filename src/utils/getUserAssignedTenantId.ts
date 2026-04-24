import { supabase } from "@/integrations/supabase/client";

export async function getUserAssignedTenantId(
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.tenant_id ?? null;
}
