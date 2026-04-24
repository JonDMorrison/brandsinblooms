import type { ComponentType } from "react";
import Box from "@mui/joy/Box";
import type { ChipProps } from "@mui/joy/Chip";
import type { ColorPaletteProp } from "@mui/joy/styles";
import type { SxProps } from "@mui/joy/styles/types";
import { CalendarDays, FileText, Mail, Megaphone, Send } from "lucide-react";
import { format } from "date-fns";
import type { UnifiedCalendarEvent } from "@/hooks/useUnifiedCalendarData";

type CalendarEventType = UnifiedCalendarEvent["type"];

export type CalendarEventConfig = {
  label: string;
  chipColor: ChipProps["color"];
  dotColor: string;
  surfaceColor: string;
  surfaceHoverColor: string;
  textColor: string;
  borderColor: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  statusColor?: ColorPaletteProp;
};

export const CALENDAR_EVENT_CONFIG: Record<
  CalendarEventType,
  CalendarEventConfig
> = {
  event: {
    label: "Campaign",
    chipColor: "success",
    dotColor: "var(--joy-palette-success-500)",
    surfaceColor: "rgba(var(--joy-palette-success-mainChannel) / 0.12)",
    surfaceHoverColor: "rgba(var(--joy-palette-success-mainChannel) / 0.18)",
    textColor: "success.700",
    borderColor: "rgba(var(--joy-palette-success-mainChannel) / 0.34)",
    icon: Megaphone,
    statusColor: "success",
  },
  newsletter: {
    label: "Newsletter",
    chipColor: "info",
    dotColor: "var(--joy-palette-info-500)",
    surfaceColor: "rgba(var(--joy-palette-info-mainChannel) / 0.12)",
    surfaceHoverColor: "rgba(var(--joy-palette-info-mainChannel) / 0.18)",
    textColor: "info.700",
    borderColor: "rgba(var(--joy-palette-info-mainChannel) / 0.34)",
    icon: Mail,
    statusColor: "info",
  },
  task: {
    label: "Task",
    chipColor: "warning",
    dotColor: "var(--joy-palette-warning-500)",
    surfaceColor: "rgba(var(--joy-palette-warning-mainChannel) / 0.16)",
    surfaceHoverColor: "rgba(var(--joy-palette-warning-mainChannel) / 0.24)",
    textColor: "warning.700",
    borderColor: "rgba(var(--joy-palette-warning-mainChannel) / 0.34)",
    icon: FileText,
    statusColor: "warning",
  },
  scheduled_post: {
    label: "Scheduled Post",
    chipColor: "primary",
    dotColor: "var(--joy-palette-primary-500)",
    surfaceColor: "rgba(var(--joy-palette-primary-mainChannel) / 0.12)",
    surfaceHoverColor: "rgba(var(--joy-palette-primary-mainChannel) / 0.18)",
    textColor: "primary.700",
    borderColor: "rgba(var(--joy-palette-primary-mainChannel) / 0.34)",
    icon: Send,
    statusColor: "primary",
  },
  holiday: {
    label: "Holiday",
    chipColor: "danger",
    dotColor: "var(--joy-palette-danger-500)",
    surfaceColor: "rgba(var(--joy-palette-danger-mainChannel) / 0.12)",
    surfaceHoverColor: "rgba(var(--joy-palette-danger-mainChannel) / 0.18)",
    textColor: "danger.700",
    borderColor: "rgba(var(--joy-palette-danger-mainChannel) / 0.34)",
    icon: CalendarDays,
    statusColor: "danger",
  },
};

export const CALENDAR_EVENT_ORDER: Record<CalendarEventType, number> = {
  event: 0,
  holiday: 1,
  newsletter: 2,
  scheduled_post: 3,
  task: 4,
};

const TASK_TYPE_LABELS: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  blog: "Blog",
  video: "Video",
  newsletter: "Newsletter",
  sms: "SMS",
};

export function getCalendarEventConfig(type: CalendarEventType) {
  return CALENDAR_EVENT_CONFIG[type];
}

export function getCalendarDateKey(date: Date | string) {
  return format(typeof date === "string" ? new Date(date) : date, "yyyy-MM-dd");
}

export function getTaskTypeLabel(postType?: string | null) {
  if (!postType) {
    return "Content";
  }

  return (
    TASK_TYPE_LABELS[postType] ??
    postType
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (character) => character.toUpperCase())
  );
}

export function formatCalendarStatus(status?: string | null) {
  if (!status) {
    return null;
  }

  return status
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function getCalendarEventTitle(event: UnifiedCalendarEvent) {
  if (event.type === "task") {
    const content = String(event.meta?.ai_output ?? event.title ?? "").trim();
    return content || `${getTaskTypeLabel(event.meta?.post_type)} task`;
  }

  if (event.type === "scheduled_post") {
    const caption = String(
      event.meta?.content?.caption ?? event.title ?? "",
    ).trim();
    return (
      caption ||
      `${String(event.meta?.platform ?? event.platform ?? "Post")} post`
    );
  }

  if (event.type === "newsletter") {
    return String(
      event.meta?.subject_line ??
        event.title ??
        event.meta?.name ??
        "Newsletter",
    );
  }

  if (event.type === "event") {
    return String(
      event.meta?.title ?? event.meta?.theme ?? event.title ?? "Campaign",
    );
  }

  return String(event.meta?.holiday_name ?? event.title ?? "Holiday");
}

export function getCalendarEventDescription(event: UnifiedCalendarEvent) {
  switch (event.type) {
    case "task":
      return String(
        event.meta?.campaigns?.title ?? event.meta?.notes ?? "Content task",
      );
    case "newsletter":
      return String(
        event.meta?.crm_segments?.name ??
          event.meta?.preheader_text ??
          "Email campaign",
      );
    case "scheduled_post":
      return String(event.meta?.status ?? event.platform ?? "Scheduled post");
    case "event":
      return String(
        event.meta?.description ?? event.meta?.theme ?? "Weekly theme campaign",
      );
    case "holiday":
      return String(
        event.meta?.garden_relevance ??
          event.meta?.description ??
          "Seasonal opportunity",
      );
    default:
      return "";
  }
}

export function getCalendarEventTime(event: UnifiedCalendarEvent) {
  if (event.time) {
    return event.time;
  }

  if (event.type === "newsletter" && event.meta?.scheduled_at) {
    return format(new Date(event.meta.scheduled_at), "h:mm a");
  }

  if (event.type === "scheduled_post" && event.meta?.publish_at) {
    return format(new Date(event.meta.publish_at), "h:mm a");
  }

  return null;
}

export function sortCalendarEvents(events: UnifiedCalendarEvent[]) {
  return [...events].sort((left, right) => {
    const leftTime = getCalendarEventTime(left);
    const rightTime = getCalendarEventTime(right);

    if (leftTime && rightTime && leftTime !== rightTime) {
      return leftTime.localeCompare(rightTime);
    }

    return CALENDAR_EVENT_ORDER[left.type] - CALENDAR_EVENT_ORDER[right.type];
  });
}

export function CalendarEventDot({ type }: { type: CalendarEventType }) {
  const config = getCalendarEventConfig(type);

  return (
    <Box
      sx={{
        width: 6,
        height: 6,
        borderRadius: "999px",
        backgroundColor: config.dotColor,
        flexShrink: 0,
      }}
    />
  );
}

export const createCalendarPillSx = (
  type: CalendarEventType,
  highlighted = false,
): SxProps => {
  const config = getCalendarEventConfig(type);

  return {
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: 0.75,
    width: "100%",
    minWidth: 0,
    borderRadius: "sm",
    border: "1px solid",
    borderColor: highlighted ? "primary.400" : config.borderColor,
    backgroundColor: highlighted
      ? "rgba(var(--joy-palette-primary-mainChannel) / 0.12)"
      : config.surfaceColor,
    px: 0.75,
    py: 0.5,
    textAlign: "left",
    cursor: "pointer",
    transition:
      "transform 0.16s ease, background-color 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease",
    boxShadow: highlighted ? "sm" : "none",
    "&::before": {
      content: '""',
      position: "absolute",
      left: 0,
      top: 4,
      bottom: 4,
      width: 3,
      borderRadius: "999px",
      backgroundColor: config.dotColor,
    },
    "&:hover": {
      backgroundColor: config.surfaceHoverColor,
      transform: "translateY(-1px)",
      boxShadow: "sm",
    },
    "&:focus-visible": {
      outline: "2px solid rgba(var(--joy-palette-primary-mainChannel) / 0.32)",
      outlineOffset: 2,
    },
  };
};
