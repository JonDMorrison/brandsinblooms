import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCampaignCloning } from "@/hooks/useCampaignCloning";

interface Newsletter {
  id: string;
  name: string;
  subject_line: string;
  preheader_text?: string;
  /** crm_campaigns.status (draft, scheduled, queued, sending, sent, ...). */
  status: string;
  scheduled_at: string | null;
  sent_at: string | null;
  created_at: string;
  segment_id?: string;
  crm_segments?: {
    name: string;
  };
  metrics?: {
    sent?: number;
    opened?: number;
    clicked?: number;
    revenue?: number;
  };
}

export const useNewsletterCalendar = () => {
  const { user } = useAuth();
  const { tenant, loading: tenantLoading } = useTenant();
  const [newsletters, setNewsletters] = useState<Newsletter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { cloneCampaign } = useCampaignCloning();

  useEffect(() => {
    setNewsletters([]);
    setError(null);
    setLoading(Boolean(user));
  }, [tenant?.id, user?.id]);

  const loadNewsletters = useCallback(async () => {
    if (!user) {
      setNewsletters([]);
      setLoading(false);
      return;
    }

    if (tenantLoading) {
      return;
    }

    if (!tenant?.id) {
      setNewsletters([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Load newsletters (CRM campaigns)
      const { data, error } = await supabase
        .from("crm_campaigns")
        .select(
          `
          id,
          name,
          subject_line,
          preheader_text,
          status,
          scheduled_at,
          sent_at,
          created_at,
          segment_id,
          metrics,
          crm_segments(name)
        `,
        )
        .eq("tenant_id", tenant.id)
        // Every campaign with a date: scheduled (incl. dated drafts) or sent.
        // The segment join is optional; an inner join hid campaigns sent to
        // all customers or to personas.
        .or("scheduled_at.not.is.null,sent_at.not.is.null")
        .order("scheduled_at", { ascending: true, nullsFirst: false });

      if (error) {
        console.error("Error loading newsletters:", error);
        setError("Failed to load newsletters");
        return;
      }

      // Type cast and filter the data to ensure proper typing
      const typedNewsletters = (data || []).map((item: any) => ({
        id: item.id,
        name: item.name,
        subject_line: item.subject_line,
        preheader_text: item.preheader_text,
        status: String(item.status ?? "draft"),
        scheduled_at: item.scheduled_at,
        sent_at: item.sent_at,
        created_at: item.created_at,
        segment_id: item.segment_id,
        metrics: item.metrics,
        crm_segments: item.crm_segments,
      })) as Newsletter[];

      setNewsletters(typedNewsletters);
    } catch (error) {
      console.error("Error in loadNewsletters:", error);
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }, [tenant?.id, tenantLoading, user]);

  const createNewsletter = useCallback(
    async (newsletterData: {
      name: string;
      subject_line: string;
      preheader_text?: string;
      segment_id?: string;
      scheduled_at: string;
    }) => {
      try {
        if (!user) throw new Error("Not authenticated");
        if (!tenant?.id) throw new Error("No tenant found");

        const { data, error } = await supabase
          .from("crm_campaigns")
          .insert([
            {
              ...newsletterData,
              tenant_id: tenant.id,
              user_id: user.id,
              status: "scheduled",
              delivery_method: "custom_domain",
            },
          ])
          .select()
          .single();

        if (error) throw error;

        await loadNewsletters();

        toast({
          title: "Newsletter Created",
          description: "Your newsletter has been successfully scheduled.",
        });

        return data;
      } catch (error) {
        console.error("Error creating newsletter:", error);
        toast({
          title: "Error",
          description: "Failed to create newsletter. Please try again.",
          variant: "destructive",
        });
        throw error;
      }
    },
    [loadNewsletters, tenant?.id, toast, user],
  );

  const updateNewsletter = useCallback(
    async (id: string, updates: Partial<Newsletter>) => {
      try {
        if (!tenant?.id) throw new Error("No tenant found");

        const { error } = await supabase
          .from("crm_campaigns")
          .update(updates)
          .eq("id", id)
          .eq("tenant_id", tenant.id);

        if (error) throw error;

        await loadNewsletters();

        toast({
          title: "Newsletter Updated",
          description: "Your newsletter has been successfully updated.",
        });
      } catch (error) {
        console.error("Error updating newsletter:", error);
        toast({
          title: "Error",
          description: "Failed to update newsletter. Please try again.",
          variant: "destructive",
        });
        throw error;
      }
    },
    [loadNewsletters, tenant?.id, toast],
  );

  const deleteNewsletter = useCallback(
    async (id: string) => {
      try {
        if (!tenant?.id) throw new Error("No tenant found");

        const { error } = await supabase
          .from("crm_campaigns")
          .delete()
          .eq("id", id)
          .eq("tenant_id", tenant.id);

        if (error) throw error;

        await loadNewsletters();

        toast({
          title: "Newsletter Deleted",
          description: "The newsletter has been successfully deleted.",
        });
      } catch (error) {
        console.error("Error deleting newsletter:", error);
        toast({
          title: "Error",
          description: "Failed to delete newsletter. Please try again.",
          variant: "destructive",
        });
        throw error;
      }
    },
    [loadNewsletters, tenant?.id, toast],
  );

  const duplicateNewsletter = useCallback(
    async (newsletter: Newsletter) => {
      try {
        if (!user) throw new Error("Not authenticated");
        if (!tenant?.id) throw new Error("No tenant found");

        // Use the shared clone so the copy keeps its body (content,
        // metadata.contentBlocks, campaign_blocks) and source_campaign_id.
        const clonedId = await cloneCampaign(newsletter.id, {
          newName: `Copy of ${newsletter.name}`,
          clearScheduling: true,
        });
        if (!clonedId) throw new Error("Failed to duplicate newsletter");

        // cloneCampaign already reports success or failure to the user.
        await loadNewsletters();
        return clonedId;
      } catch (error) {
        console.error("Error duplicating newsletter:", error);
        throw error;
      }
    },
    [cloneCampaign, loadNewsletters, tenant?.id, user],
  );

  // Filter newsletters by date range
  const getNewslettersForDateRange = useCallback(
    (startDate: Date, endDate: Date) => {
      return newsletters.filter((newsletter) => {
        const scheduleDate = newsletter.scheduled_at
          ? new Date(newsletter.scheduled_at)
          : null;
        if (!scheduleDate) return false;

        return scheduleDate >= startDate && scheduleDate <= endDate;
      });
    },
    [newsletters],
  );

  // Get newsletters for a specific date
  const getNewslettersForDate = useCallback(
    (date: Date) => {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      return getNewslettersForDateRange(startOfDay, endOfDay);
    },
    [getNewslettersForDateRange],
  );

  useEffect(() => {
    loadNewsletters();
  }, [loadNewsletters]);

  return {
    newsletters,
    loading,
    error,
    loadNewsletters,
    createNewsletter,
    updateNewsletter,
    deleteNewsletter,
    duplicateNewsletter,
    getNewslettersForDateRange,
    getNewslettersForDate,
  };
};
