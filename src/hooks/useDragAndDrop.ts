import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/utils/toast";
import { format } from "date-fns";
import { UnifiedCalendarEvent } from "./useUnifiedCalendarData";
import { applyTenantUserScope } from "@/utils/tenantScope";
import type { TablesUpdate } from "@/integrations/supabase/types";
import type { PostgrestError } from "@supabase/supabase-js";

type ScopedRecordUpdate =
  | { table: "content_tasks"; values: TablesUpdate<"content_tasks"> }
  | { table: "crm_campaigns"; values: TablesUpdate<"crm_campaigns"> }
  | { table: "campaigns"; values: TablesUpdate<"campaigns"> };

interface Task {
  id: string;
  scheduled_date: string;
  post_type: string;
  status: string;
  ai_output?: string;
  campaigns?: {
    title: string;
  };
}

export const useDragAndDrop = (onTaskUpdate: () => void) => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const [isDragging, setIsDragging] = useState(false);
  const [draggedItem, setDraggedItem] = useState<
    UnifiedCalendarEvent | Task | null
  >(null);

  const updateScopedRecord = async (
    update: ScopedRecordUpdate,
    recordId: string,
  ) => {
    if (!user) {
      throw new Error("Not authenticated");
    }

    const scope = { tenantId: tenant?.id, userId: user.id };

    // One literal table per branch keeps the Supabase query types concrete
    // (a union table name makes their instantiation unbounded).
    let error: PostgrestError | null = null;
    switch (update.table) {
      case "content_tasks": {
        let query = supabase
          .from("content_tasks")
          .update(update.values)
          .eq("id", recordId);
        query = applyTenantUserScope(query, scope);
        ({ error } = await query);
        break;
      }
      case "crm_campaigns": {
        let query = supabase
          .from("crm_campaigns")
          .update(update.values)
          .eq("id", recordId);
        query = applyTenantUserScope(query, scope);
        ({ error } = await query);
        break;
      }
      case "campaigns": {
        let query = supabase
          .from("campaigns")
          .update(update.values)
          .eq("id", recordId);
        query = applyTenantUserScope(query, scope);
        ({ error } = await query);
        break;
      }
    }

    if (error) {
      throw error;
    }
  };

  const handleDragStart = (item: UnifiedCalendarEvent | Task) => {
    setIsDragging(true);
    setDraggedItem(item);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    setDraggedItem(null);
  };

  const handleDrop = async (targetDate: Date) => {
    if (!draggedItem || !user) return;

    const newDateString = format(targetDate, "yyyy-MM-dd");

    try {
      // Handle unified calendar events
      if ("type" in draggedItem) {
        const event = draggedItem as UnifiedCalendarEvent;

        // Don't update if dropping on the same date
        const currentDateString = format(event.date, "yyyy-MM-dd");
        if (currentDateString === newDateString) {
          handleDragEnd();
          return;
        }

        switch (event.type) {
          case "task":
            await updateScopedRecord(
              { table: "content_tasks", values: { scheduled_date: newDateString } },
              event.id,
            );
            break;

          case "newsletter":
            // Update scheduled_at for newsletters
            await updateScopedRecord(
              { table: "crm_campaigns", values: { scheduled_at: newDateString } },
              event.id,
            );
            break;

          case "event":
            // Update campaign start_date
            await updateScopedRecord(
              { table: "campaigns", values: { start_date: newDateString } },
              event.id,
            );
            break;

          case "holiday":
            // Holidays can't be rescheduled
            toast.info("Holidays cannot be rescheduled");
            handleDragEnd();
            return;
        }

        toast.success(
          `${event.type} rescheduled to ${format(targetDate, "MMMM d, yyyy")}`,
        );
      } else {
        // Handle legacy task format
        const task = draggedItem as Task;

        if (task.scheduled_date === newDateString) {
          handleDragEnd();
          return;
        }

        await updateScopedRecord(
          { table: "content_tasks", values: { scheduled_date: newDateString } },
          task.id,
        );

        toast.success(
          `Content rescheduled to ${format(targetDate, "MMMM d, yyyy")}`,
        );
      }

      onTaskUpdate();
    } catch (error) {
      console.error("Error updating item date:", error);
      toast.error("Failed to reschedule item");
    } finally {
      handleDragEnd();
    }
  };

  return {
    isDragging,
    draggedTask: draggedItem, // Keep legacy name for compatibility
    draggedItem,
    handleDragStart,
    handleDragEnd,
    handleDrop,
  };
};
