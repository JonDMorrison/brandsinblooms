import { format } from "date-fns";
import { useState } from "react";
import Box from "@mui/joy/Box";
import Sheet from "@mui/joy/Sheet";
import Typography from "@mui/joy/Typography";

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

interface CalendarDropZoneProps {
  date: Date;
  isDragging?: boolean;
  draggedTask?: Task;
  onDrop?: (date: Date) => void;
  children: React.ReactNode;
}

export const CalendarDropZone = ({
  date,
  isDragging = false,
  draggedTask,
  onDrop,
  children,
}: CalendarDropZoneProps) => {
  const [isHoveredDrop, setIsHoveredDrop] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isDragging || e.dataTransfer.types.includes("text/plain")) {
      const targetDate = format(date, "yyyy-MM-dd");

      // Check if we have draggedTask or try to get it from dataTransfer
      if (draggedTask) {
        const draggedTaskDate = format(
          new Date(draggedTask.scheduled_date),
          "yyyy-MM-dd",
        );
        if (draggedTaskDate !== targetDate) {
          e.dataTransfer.dropEffect = "move";
          setIsHoveredDrop(true);
        } else {
          e.dataTransfer.dropEffect = "none";
        }
      } else {
        // Allow drop anyway - we'll validate in handleDrop
        e.dataTransfer.dropEffect = "move";
        setIsHoveredDrop(true);
      }
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isDragging || e.dataTransfer.types.includes("text/plain")) {
      setIsHoveredDrop(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Check if we're actually leaving the drop zone
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;

    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsHoveredDrop(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setIsHoveredDrop(false);

    if (onDrop) {
      const taskId = e.dataTransfer.getData("text/plain");
      onDrop(date);
    }
  };

  const canDrop =
    isDragging &&
    draggedTask &&
    format(new Date(draggedTask.scheduled_date), "yyyy-MM-dd") !==
      format(date, "yyyy-MM-dd");

  return (
    <Box
      sx={{
        position: "relative",
        height: "100%",
        transition:
          "background-color 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease",
        borderRadius: isHoveredDrop ? "lg" : 0,
        backgroundColor: isHoveredDrop
          ? "rgba(var(--joy-palette-primary-mainChannel) / 0.12)"
          : isDragging
            ? "rgba(var(--joy-palette-primary-mainChannel) / 0.04)"
            : "transparent",
        boxShadow: isHoveredDrop
          ? "inset 0 0 0 2px rgba(var(--joy-palette-primary-mainChannel) / 0.26)"
          : undefined,
      }}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isHoveredDrop && (
        <Sheet
          variant="soft"
          color="primary"
          sx={{
            position: "absolute",
            inset: 8,
            zIndex: 20,
            borderRadius: "lg",
            border: "2px dashed",
            borderColor: "primary.300",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <Typography level="body-sm" fontWeight="lg" color="primary">
            Drop here to reschedule
          </Typography>
        </Sheet>
      )}

      {children}
    </Box>
  );
};
