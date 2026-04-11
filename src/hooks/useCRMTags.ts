import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { toast } from "sonner";

export interface CRMTag {
  id: string;
  name: string;
}

export const useCRMTags = () => {
  const [tags, setTags] = useState<CRMTag[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { tenant } = useTenant();

  const fetchTags = useCallback(async () => {
    if (!user || !tenant) {
      setTags([]);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("crm_tags")
        .select("id, name")
        .eq("tenant_id", tenant.id)
        .order("name", { ascending: true });

      if (error) throw error;

      setTags(
        (data || []).map((tag) => ({
          id: String(tag.id),
          name: String(tag.name || ""),
        })),
      );
    } catch (error) {
      console.error("Error fetching tags:", error);
      toast.error("Failed to load tags");
    } finally {
      setLoading(false);
    }
  }, [tenant, user]);

  useEffect(() => {
    void fetchTags();
  }, [fetchTags]);

  return {
    tags,
    loading,
    fetchTags,
  };
};
