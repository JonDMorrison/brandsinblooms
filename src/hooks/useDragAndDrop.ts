import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/utils/toast";
import { format } from "date-fns";
import { UnifiedCalendarEvent } from "./useUnifiedCalendarData";
import { applyTenantUserScope } from "@/utils/tenantScope";

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
    table: "content_tasks" | "scheduled_posts" | "crm_campaigns" | "campaigns",
    values: Record<string, string>,
    recordId: string,
  ) => {
    if (!user) {
      throw new Error("Not authenticated");
    }

    let query = supabase.from(table).update(values).eq("id", recordId);
    query = applyTenantUserScope(query, {
      tenantId: tenant?.id,
      userId: user.id,
    });

    const { error } = await query;
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
              "content_tasks",
              { scheduled_date: newDateString },
              event.id,
            );
            break;

          case "scheduled_post":
            // Update publish_at while preserving time
            const currentDate = new Date(event.meta.publish_at);
            const targetDateTime = new Date(targetDate);
            targetDateTime.setHours(
              currentDate.getHours(),
              currentDate.getMinutes(),
              currentDate.getSeconds(),
            );

            await updateScopedRecord(
              "scheduled_posts",
              { publish_at: targetDateTime.toISOString() },
              event.id,
            );
            break;

          case "newsletter":
            // Update scheduled_at for newsletters
            await updateScopedRecord(
              "crm_campaigns",
              { scheduled_at: newDateString },
              event.id,
            );
            break;

          case "event":
            // Update campaign start_date
            await updateScopedRecord(
              "campaigns",
              { start_date: newDateString },
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
          "content_tasks",
          { scheduled_date: newDateString },
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
