import React from "react";
import Box from "@mui/joy/Box";
import Typography from "@mui/joy/Typography";
import { format } from "date-fns";
import { createCalendarPillSx } from "@/components/calendar/calendarEventPresentation";

interface Newsletter {
  id: string;
  name: string;
  subject_line: string;
  status: "draft" | "scheduled" | "sent";
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
  };
}

interface NewsletterCalendarBlockProps {
  newsletter: Newsletter;
  onClick: (newsletter: Newsletter) => void;
  isCompact?: boolean;
}

export const NewsletterCalendarBlock: React.FC<
  NewsletterCalendarBlockProps
> = ({ newsletter, onClick, isCompact = false, highlighted = false }) => {
  const scheduleTime = newsletter.scheduled_at
    ? new Date(newsletter.scheduled_at)
    : null;
  const sentTime = newsletter.sent_at ? new Date(newsletter.sent_at) : null;

  return (
    <Box
      component="button"
      type="button"
      sx={{
        ...createCalendarPillSx("newsletter", highlighted),
        appearance: "none",
        px: isCompact ? 0.75 : 1,
        py: isCompact ? 0.5 : 0.75,
      }}
      onClick={() => onClick(newsletter)}
    >
      <Box sx={{ pl: 0.75, minWidth: 0 }}>
        <Typography
          level="body-xs"
          fontWeight="lg"
          sx={{
            color: "info.700",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {newsletter.subject_line || newsletter.name}
        </Typography>
        <Typography
          level="body-xs"
          sx={{
            color: "info.800",
            opacity: 0.72,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {scheduleTime
            ? format(scheduleTime, "h:mm a")
            : sentTime
              ? format(sentTime, "h:mm a")
              : newsletter.crm_segments?.name || "Draft"}
        </Typography>
      </Box>
    </Box>
  );
};

interface NewsletterCalendarBlockProps {
  newsletter: Newsletter;
  onClick: (newsletter: Newsletter) => void;
  isCompact?: boolean;
  highlighted?: boolean;
}
