import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useIsSuperAdmin = () => {
  return useQuery({
    queryKey: ["is-super-admin"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.email) {
        return false;
      }

      const { data, error } = await supabase
        .from("app_admin_emails")
        .select("email")
        .eq("email", user.email)
        .maybeSingle();
      if (error) {
        console.error("❌ Admin Check - Database error:", error);
        return false;
      }

      const isAdmin = !!data;
      return isAdmin;
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: false, // Don't retry failed admin checks
    refetchOnWindowFocus: false, // Don't refetch on window focus
  });
};
