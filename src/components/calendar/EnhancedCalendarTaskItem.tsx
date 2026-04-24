import Box from "@mui/joy/Box";
import IconButton from "@mui/joy/IconButton";
import Typography from "@mui/joy/Typography";
import { GripVertical, Trash2 } from "lucide-react";
import { useLongPress } from "@/hooks/useLongPress";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { applyTenantUserScope } from "@/utils/tenantScope";
import {
  createCalendarPillSx,
  getTaskTypeLabel,
} from "@/components/calendar/calendarEventPresentation";

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

interface EnhancedCalendarTaskItemProps {
  task: Task;
  isSelected: boolean;
  isPastDate: boolean;
  onTaskClick: (task: Task) => void;
  onLongPress: (task: Task) => void;
  onDragStart?: (task: Task) => void;
  onDragEnd?: () => void;
  onDelete?: (taskId: string) => void;
}

export const EnhancedCalendarTaskItem = ({
  task,
  isSelected,
  isPastDate,
  onTaskClick,
  onLongPress,
  onDragStart,
  onDragEnd,
  onDelete,
  highlighted = false,
}: EnhancedCalendarTaskItemProps) => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const [isDragReady, setIsDragReady] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (isDeleting) return;

    setIsDeleting(true);
    try {
      let query = supabase.from("content_tasks").delete().eq("id", task.id);

      query = applyTenantUserScope(query, {
        tenantId: tenant?.id,
        userId: user?.id,
      });

      const { error } = await query;

      if (error) throw error;

      toast.success("Task deleted");
      onDelete?.(task.id);
    } catch (error) {
      console.error("Error deleting task:", error);
      toast.error("Failed to delete task");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleLongPressStart = () => {
    setIsDragReady(true);
    onLongPress(task);
    if (onDragStart) {
      onDragStart(task);
    }
  };

  const handleClick = () => {
    if (!isDragReady) {
      onTaskClick(task);
    }
  };

  const handleDirectClick = (e: React.MouseEvent) => {
    // Prevent event propagation and default behavior to ensure only dialog opens
    e.preventDefault();
    e.stopPropagation();
    if (!isDragReady) {
      onTaskClick(task);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter" && e.key !== " ") {
      return;
    }

    e.preventDefault();
    if (!isDragReady) {
      onTaskClick(task);
    }
  };

  const longPressResult = useLongPress({
    onLongPress: handleLongPressStart,
    onClick: handleClick,
    longPressThreshold: 300,
  });

  // Destructure event handlers and state separately
  const {
    onMouseDown,
    onMouseUp,
    onMouseLeave,
    onTouchStart,
    onTouchEnd,
    isPressed,
    isLongPressActive,
  } = longPressResult;

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("text/plain", task.id);
    e.dataTransfer.effectAllowed = "move";

    // Create custom drag image
    const dragElement = e.currentTarget.cloneNode(true) as HTMLElement;
    dragElement.style.transform = "rotate(2deg) scale(1.05)";
    dragElement.style.opacity = "0.9";
    dragElement.style.position = "absolute";
    dragElement.style.top = "-1000px";
    dragElement.style.left = "-1000px";
    dragElement.style.pointerEvents = "none";
    dragElement.style.zIndex = "9999";

    document.body.appendChild(dragElement);
    e.dataTransfer.setDragImage(dragElement, 50, 25);

    setTimeout(() => {
      if (document.body.contains(dragElement)) {
        document.body.removeChild(dragElement);
      }
    }, 100);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setIsDragReady(false);
    if (onDragEnd) {
      onDragEnd();
    }
  };

  const subtitle =
    task.campaigns?.title ||
    (task.ai_output ? String(task.ai_output).slice(0, 44) : "Content task");

  return (
    <Box
      component="div"
      role="button"
      tabIndex={0}
      onClick={handleDirectClick}
      onKeyDown={handleKeyDown}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      draggable={isDragReady}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      sx={{
        ...createCalendarPillSx("task", highlighted || isSelected),
        appearance: "none",
        px: 1,
        py: 0.75,
        opacity: isPastDate ? 0.75 : 1,
        cursor: isDragReady ? "move" : "pointer",
        transform: isPressed ? "scale(0.98)" : undefined,
        position: "relative",
        textAlign: "left",
        "&:hover .calendar-task-delete": { opacity: 1 },
      }}
    >
      {!isSelected && !isDragReady ? (
        <IconButton
          className="calendar-task-delete"
          variant="plain"
          color="danger"
          size="sm"
          onClick={handleDelete}
          disabled={isDeleting}
          sx={{
            position: "absolute",
            right: 2,
            top: 2,
            width: 20,
            height: 20,
            minWidth: 20,
            minHeight: 20,
            opacity: 0,
            transition: "opacity 0.16s ease",
            "&:hover": {
              backgroundColor:
                "rgba(var(--joy-palette-danger-mainChannel) / 0.12)",
            },
          }}
          title="Delete this task"
        >
          <Trash2 size={12} />
        </IconButton>
      ) : null}

      <Box
        sx={{
          display: "flex",
          alignItems: "flex-start",
          gap: 0.75,
          minWidth: 0,
          pl: 0.75,
        }}
      >
        {isDragReady ? <GripVertical size={14} /> : null}
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            level="body-xs"
            fontWeight="lg"
            sx={{
              color: "warning.800",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {getTaskTypeLabel(task.post_type)}
          </Typography>
          <Typography
            level="body-xs"
            sx={{
              color: "warning.800",
              opacity: 0.72,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {subtitle}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

interface EnhancedCalendarTaskItemProps {
  task: Task;
  isSelected: boolean;
  isPastDate: boolean;
  onTaskClick: (task: Task) => void;
  onLongPress: (task: Task) => void;
  onDragStart?: (task: Task) => void;
  onDragEnd?: () => void;
  onDelete?: (taskId: string) => void;
  highlighted?: boolean;
}
