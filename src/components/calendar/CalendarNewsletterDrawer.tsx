import React, { useMemo, useState } from "react";
import Divider from "@mui/joy/Divider";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import {
  BarChart3,
  Calendar,
  Copy,
  Edit,
  ExternalLink,
  Eye,
  Mail,
  Send,
  Trash2,
  Users,
} from "lucide-react";
import { format } from "date-fns";
import { JoyAlertDialog } from "@/components/joy/JoyAlertDialog";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyChip, JoyStatusChip } from "@/components/joy/JoyChip";
import { JoyDrawer } from "@/components/joy/JoyDrawer";

interface Newsletter {
  id: string;
  name: string;
  subject_line: string;
  preheader_text?: string;
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
    revenue?: number;
  };
}

interface CalendarNewsletterDrawerProps {
  newsletter: Newsletter | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (newsletter: Newsletter) => void;
  onDuplicate: (newsletter: Newsletter) => void;
  onDelete: (newsletter: Newsletter) => void;
  onViewInCRM: (newsletter: Newsletter) => void;
}

export function CalendarNewsletterDrawer({
  newsletter,
  isOpen,
  onClose,
  onEdit,
  onDuplicate,
  onDelete,
  onViewInCRM,
}: CalendarNewsletterDrawerProps) {
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const metrics = newsletter?.metrics;

  const openRate = useMemo(
    () =>
      metrics?.sent && metrics?.opened
        ? ((metrics.opened / metrics.sent) * 100).toFixed(1)
        : "0",
    [metrics],
  );

  const clickRate = useMemo(
    () =>
      metrics?.sent && metrics?.clicked
        ? ((metrics.clicked / metrics.sent) * 100).toFixed(1)
        : "0",
    [metrics],
  );

  if (!newsletter) {
    return null;
  }

  const scheduleTime = newsletter.scheduled_at
    ? new Date(newsletter.scheduled_at)
    : null;
  const sentTime = newsletter.sent_at ? new Date(newsletter.sent_at) : null;
  const isEditable = newsletter.status !== "sent";

  return (
    <>
      <JoyDrawer
        open={isOpen}
        onClose={() => onClose()}
        title={newsletter.name}
        description={newsletter.subject_line}
        startDecorator={<Mail size={18} />}
      >
        <Stack spacing={2}>
          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
            <JoyStatusChip status={newsletter.status} />
            {newsletter.crm_segments?.name ? (
              <JoyChip color="neutral" variant="soft">
                {newsletter.crm_segments.name}
              </JoyChip>
            ) : null}
          </Stack>

          <Sheet
            variant="soft"
            color="primary"
            sx={{ borderRadius: "lg", p: 1.5 }}
          >
            <Stack spacing={1}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Mail size={14} />
                <Typography level="body-sm">
                  {newsletter.subject_line}
                </Typography>
              </Stack>
              {newsletter.preheader_text ? (
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <Eye size={14} />
                  <Typography level="body-sm">
                    {newsletter.preheader_text}
                  </Typography>
                </Stack>
              ) : null}
              <Stack direction="row" spacing={1} alignItems="center">
                <Users size={14} />
                <Typography level="body-sm">
                  {newsletter.crm_segments?.name || "All Customers"}
                </Typography>
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <Calendar size={14} />
                <Typography level="body-sm">
                  Created{" "}
                  {format(new Date(newsletter.created_at), "MMM d, yyyy")}
                </Typography>
              </Stack>
              {scheduleTime ? (
                <Stack direction="row" spacing={1} alignItems="center">
                  <Calendar size={14} />
                  <Typography level="body-sm">
                    Scheduled {format(scheduleTime, "MMM d, yyyy h:mm a")}
                  </Typography>
                </Stack>
              ) : null}
              {sentTime ? (
                <Stack direction="row" spacing={1} alignItems="center">
                  <Send size={14} />
                  <Typography level="body-sm">
                    Sent {format(sentTime, "MMM d, yyyy h:mm a")}
                  </Typography>
                </Stack>
              ) : null}
            </Stack>
          </Sheet>

          {newsletter.status === "sent" && newsletter.metrics ? (
            <>
              <Divider />
              <Stack spacing={1.25}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <BarChart3 size={16} />
                  <Typography level="title-sm">Performance</Typography>
                </Stack>
                <Stack
                  direction="row"
                  spacing={0.75}
                  useFlexGap
                  flexWrap="wrap"
                >
                  <JoyChip color="neutral" variant="soft">
                    Sent {newsletter.metrics.sent || 0}
                  </JoyChip>
                  <JoyChip color="neutral" variant="soft">
                    Opens {newsletter.metrics.opened || 0}
                  </JoyChip>
                  <JoyChip color="neutral" variant="soft">
                    Open rate {openRate}%
                  </JoyChip>
                  <JoyChip color="neutral" variant="soft">
                    Click rate {clickRate}%
                  </JoyChip>
                </Stack>
              </Stack>
            </>
          ) : null}

          <Divider />

          <Stack spacing={1}>
            {isEditable ? (
              <JoyButton
                onClick={() => {
                  onEdit(newsletter);
                  onClose();
                }}
                startDecorator={<Edit size={14} />}
              >
                Edit Newsletter
              </JoyButton>
            ) : null}
            <JoyButton
              bloomVariant="outline"
              color="neutral"
              onClick={() => onViewInCRM(newsletter)}
              startDecorator={<ExternalLink size={14} />}
            >
              View in CRM
            </JoyButton>
            <JoyButton
              bloomVariant="outline"
              color="neutral"
              onClick={() => {
                onDuplicate(newsletter);
                onClose();
              }}
              startDecorator={<Copy size={14} />}
            >
              Duplicate Newsletter
            </JoyButton>
            {isEditable ? (
              <JoyButton
                color="danger"
                bloomVariant="outline"
                onClick={() => setConfirmDeleteOpen(true)}
                startDecorator={<Trash2 size={14} />}
              >
                Delete Newsletter
              </JoyButton>
            ) : null}
          </Stack>
        </Stack>
      </JoyDrawer>

      <JoyAlertDialog
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={async () => {
          onDelete(newsletter);
          setConfirmDeleteOpen(false);
          onClose();
        }}
        title="Delete newsletter"
        description="This newsletter will be removed permanently."
        confirmLabel="Delete"
      />
    </>
  );
}
