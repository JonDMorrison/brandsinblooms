import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { logActivity } from "@/lib/activityLogger";

export const useDeleteCustomer = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (customerId: string) => {
      const { data: customer, error: customerError } = await supabase
        .from("crm_customers")
        .select("id, tenant_id, first_name, last_name, email")
        .eq("id", customerId)
        .maybeSingle();

      if (customerError) throw customerError;

      if (customer?.tenant_id) {
        await logActivity({
          tenantId: customer.tenant_id,
          customerId: customer.id,
          actorType: "user",
          actorId: user?.id ?? null,
          source: "ui",
          activityType: "customer.deleted",
          status: "success",
          title: "Customer deleted",
          description: {
            parts: [
              {
                type: "text",
                text:
                  `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim() ||
                  customer.email ||
                  "Customer",
              },
            ],
          },
          metadata: {
            customer_name:
              `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim() ||
              customer.email ||
              "Customer",
            customer_first_name: customer.first_name ?? null,
            customer_last_name: customer.last_name ?? null,
          },
          relatedEntities: {
            customer_id: customer.id,
          },
        });
      }

      const { error } = await supabase
        .from("crm_customers")
        .delete()
        .eq("id", customerId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["crm-customers"] });
      queryClient.invalidateQueries({ queryKey: ["activity-feed"] });
      toast({
        title: "Customer deleted",
        description: "The customer has been permanently removed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete customer",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};
