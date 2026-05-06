import * as React from "react";
import Avatar from "@mui/joy/Avatar";
import Box from "@mui/joy/Box";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Textarea from "@mui/joy/Textarea";
import Typography from "@mui/joy/Typography";
import {
  Activity,
  ArrowLeft,
  Clock3,
  Mail,
  MessageSquare,
  MoreVertical,
  Pencil,
  Phone,
  Star,
  StickyNote,
  Trash2,
} from "lucide-react";
import { JoyAlertDialog } from "@/components/joy/JoyAlertDialog";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyChip } from "@/components/joy/JoyChip";
import {
  JoyDropdownMenu,
  JoyDropdownMenuContent,
  JoyDropdownMenuItem,
  JoyDropdownMenuSeparator,
  JoyDropdownMenuTrigger,
} from "@/components/joy/JoyDropdownMenu";
import {
  JoyDialog,
  JoyDialogActions,
  JoyDialogContent,
} from "@/components/joy/JoyDialog";
import { JoyTooltip } from "@/components/joy/JoyTooltip";
import useMediaQuery from "@/hooks/use-media-query";
import { useToast } from "@/hooks/use-toast";
import {
  formatDateLabel,
  formatRelativeTimestamp,
  getInitials,
  getLifecyclePresentation,
  getPersonaLabel,
} from "./customerDashboardUtils";

export interface CustomerProfileHeaderProps {
  customerName: string;
  email: string;
  phone?: string | null;
  emailOptIn?: boolean | null;
  smsOptIn?: boolean | null;
  lifecycleStage?: string | null;
  createdAt?: string | null;
  lastActiveAt?: string | null;
  primaryPersona?: string | null;
  segmentLabels?: string[];
  isVip?: boolean;
  isDeleting?: boolean;
  onBack: () => void;
  onEdit: () => void;
  onViewActivity: () => void;
  onDelete: () => Promise<void> | void;
  onAddNote: (note: string) => Promise<void>;
  onRefresh: () => Promise<void> | void;
}

const subscriptionDot = (subscribed: boolean | null | undefined) => (
  <Box
    component="span"
    sx={{
      width: 8,
      height: 8,
      borderRadius: 999,
      backgroundColor: subscribed ? "success.500" : "danger.500",
      flexShrink: 0,
    }}
  />
);

export function CustomerProfileHeader({
  customerName,
  email,
  phone,
  emailOptIn,
  smsOptIn,
  lifecycleStage,
  createdAt,
  lastActiveAt,
  primaryPersona,
  segmentLabels = [],
  isVip = false,
  isDeleting = false,
  onBack,
  onEdit,
  onViewActivity,
  onDelete,
  onAddNote,
  onRefresh,
}: CustomerProfileHeaderProps) {
  const isCompact = useMediaQuery("(max-width:767px)");
  const { toast } = useToast();
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [noteOpen, setNoteOpen] = React.useState(false);
  const [noteValue, setNoteValue] = React.useState("");
  const [noteSaving, setNoteSaving] = React.useState(false);

  const lifecycle = getLifecyclePresentation(lifecycleStage, isVip);
  const visibleSegments = segmentLabels.slice(0, 3);
  const hiddenSegmentCount = Math.max(
    segmentLabels.length - visibleSegments.length,
    0,
  );

  const handleCopy = React.useCallback(
    async (value: string, label: string) => {
      if (!value) {
        return;
      }

      try {
        await navigator.clipboard.writeText(value);
        toast({
          title: `${label} copied`,
          description: value,
        });
      } catch {
        toast({
          title: `Could not copy ${label.toLowerCase()}`,
          description: value,
          variant: "destructive",
        });
      }
    },
    [toast],
  );

  const handleSaveNote = async () => {
    const trimmed = noteValue.trim();
    if (!trimmed) {
      return;
    }

    setNoteSaving(true);
    try {
      await onAddNote(trimmed);
      setNoteValue("");
      setNoteOpen(false);
    } finally {
      setNoteSaving(false);
    }
  };

  return (
    <>
      <Sheet
        variant="plain"
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 5,
          backgroundColor: "background.surface",
          borderBottom: "1px solid",
          borderColor: "neutral.200",
          boxShadow: "sm",
          px: { xs: 1.5, md: 2 },
          py: 1.5,
          borderRadius: "xl",
        }}
      >
        <Stack spacing={1.5}>
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{ minWidth: 0, flexWrap: "wrap" }}
          >
            <JoyButton
              variant="plain"
              color="neutral"
              size="sm"
              startDecorator={<ArrowLeft size={14} />}
              onClick={onBack}
            >
              Customers
            </JoyButton>
            <Typography level="body-xs" color="neutral">
              /
            </Typography>
            <Typography
              level="body-xs"
              color="neutral"
              sx={{
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {customerName}
            </Typography>
          </Stack>

          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", md: "center" }}
          >
            <Stack direction="row" spacing={1.5} sx={{ minWidth: 0, flex: 1 }}>
              <Avatar
                size={isCompact ? "md" : "lg"}
                color="primary"
                sx={{
                  width: isCompact ? 44 : 52,
                  height: isCompact ? 44 : 52,
                  fontWeight: "lg",
                }}
              >
                {getInitials(customerName)}
              </Avatar>

              <Stack spacing={1} sx={{ minWidth: 0, flex: 1 }}>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1}
                  alignItems={{ xs: "flex-start", sm: "center" }}
                  sx={{ minWidth: 0 }}
                >
                  <Typography
                    level="h3"
                    sx={{
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {customerName}
                  </Typography>
                  <JoyChip
                    color={lifecycle.color}
                    variant="soft"
                    size="sm"
                    startDecorator={isVip ? <Star size={12} /> : undefined}
                  >
                    {lifecycle.label}
                  </JoyChip>
                </Stack>

                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  <JoyTooltip title="Click to copy email">
                    <Box component="span">
                      <JoyChip
                        color="neutral"
                        variant="outlined"
                        size="sm"
                        startDecorator={<Mail size={12} />}
                        endDecorator={
                          <JoyTooltip
                            title={
                              emailOptIn
                                ? "Email: Subscribed"
                                : "Email: Not subscribed"
                            }
                          >
                            <Box component="span">
                              {subscriptionDot(emailOptIn)}
                            </Box>
                          </JoyTooltip>
                        }
                        onClick={() => {
                          void handleCopy(email, "Email");
                        }}
                        sx={{ cursor: "pointer" }}
                      >
                        {email}
                      </JoyChip>
                    </Box>
                  </JoyTooltip>

                  {phone ? (
                    <JoyTooltip title="Click to copy phone">
                      <Box component="span">
                        <JoyChip
                          color="neutral"
                          variant="outlined"
                          size="sm"
                          startDecorator={<Phone size={12} />}
                          endDecorator={
                            <JoyTooltip
                              title={
                                smsOptIn
                                  ? "SMS: Subscribed"
                                  : "SMS: Not subscribed"
                              }
                            >
                              <Box component="span">
                                {subscriptionDot(smsOptIn)}
                              </Box>
                            </JoyTooltip>
                          }
                          onClick={() => {
                            void handleCopy(phone, "Phone");
                          }}
                          sx={{ cursor: "pointer" }}
                        >
                          {phone}
                        </JoyChip>
                      </Box>
                    </JoyTooltip>
                  ) : null}
                </Stack>

                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  <JoyChip color="primary" variant="soft" size="sm">
                    Persona: {getPersonaLabel(primaryPersona)}
                  </JoyChip>
                  {visibleSegments.map((segment, index) => (
                    <JoyChip
                      key={`${segment}-${index}`}
                      color="neutral"
                      variant="soft"
                      size="sm"
                    >
                      {segment}
                    </JoyChip>
                  ))}
                  {hiddenSegmentCount > 0 ? (
                    <JoyChip color="neutral" variant="soft" size="sm">
                      +{hiddenSegmentCount} more
                    </JoyChip>
                  ) : null}
                </Stack>

                <Stack
                  direction="row"
                  spacing={1}
                  useFlexGap
                  flexWrap="wrap"
                  alignItems="center"
                >
                  <Typography level="body-xs" color="neutral">
                    Customer since {formatDateLabel(createdAt, "MMM yyyy")}
                  </Typography>
                  <Typography level="body-xs" color="neutral">
                    .
                  </Typography>
                  <Typography level="body-xs" color="neutral">
                    Last active {formatRelativeTimestamp(lastActiveAt)}
                  </Typography>
                </Stack>
              </Stack>
            </Stack>

            <Stack
              direction="row"
              spacing={1}
              useFlexGap
              flexWrap="wrap"
              alignSelf={{ xs: "stretch", md: "flex-start" }}
            >
              <JoyButton
                color="neutral"
                variant="soft"
                size="sm"
                startDecorator={<Pencil size={14} />}
                onClick={onEdit}
              >
                Edit
              </JoyButton>

              {!isCompact ? (
                <JoyTooltip title="Coming soon">
                  <Box component="span">
                    <JoyButton
                      color="neutral"
                      variant="plain"
                      size="sm"
                      startDecorator={<Mail size={14} />}
                      disabled
                    >
                      Email
                    </JoyButton>
                  </Box>
                </JoyTooltip>
              ) : null}

              {!isCompact ? (
                <JoyTooltip title="Coming soon">
                  <Box component="span">
                    <JoyButton
                      color="neutral"
                      variant="plain"
                      size="sm"
                      startDecorator={<MessageSquare size={14} />}
                      disabled
                    >
                      SMS
                    </JoyButton>
                  </Box>
                </JoyTooltip>
              ) : null}

              <JoyDropdownMenu>
                <JoyDropdownMenuTrigger aria-label="Customer actions">
                  <MoreVertical size={16} />
                </JoyDropdownMenuTrigger>
                <JoyDropdownMenuContent>
                  <JoyDropdownMenuItem
                    startDecorator={<Activity size={16} />}
                    onClick={onViewActivity}
                  >
                    View Activity Log
                  </JoyDropdownMenuItem>
                  <JoyDropdownMenuItem
                    startDecorator={<StickyNote size={16} />}
                    onClick={() => setNoteOpen(true)}
                  >
                    Add Note
                  </JoyDropdownMenuItem>
                  <JoyDropdownMenuItem
                    startDecorator={<Clock3 size={16} />}
                    onClick={() => {
                      void onRefresh();
                    }}
                  >
                    Refresh Data
                  </JoyDropdownMenuItem>
                  <JoyDropdownMenuSeparator />
                  <JoyDropdownMenuItem
                    startDecorator={<Trash2 size={16} />}
                    destructive
                    onClick={() => setDeleteOpen(true)}
                  >
                    Delete Customer
                  </JoyDropdownMenuItem>
                </JoyDropdownMenuContent>
              </JoyDropdownMenu>
            </Stack>
          </Stack>
        </Stack>
      </Sheet>

      <JoyDialog
        open={noteOpen}
        onClose={() => {
          if (noteSaving) {
            return;
          }
          setNoteOpen(false);
        }}
        title="Add note"
        description={`Record a note for ${customerName} in the activity history.`}
        size="md"
      >
        <JoyDialogContent>
          <Textarea
            minRows={5}
            placeholder="Add context, follow-up details, or investigation notes..."
            value={noteValue}
            onChange={(event) => setNoteValue(event.target.value)}
            sx={{ borderRadius: "lg" }}
          />
        </JoyDialogContent>
        <JoyDialogActions>
          <JoyButton
            bloomVariant="ghost"
            color="neutral"
            onClick={() => setNoteOpen(false)}
            disabled={noteSaving}
          >
            Cancel
          </JoyButton>
          <JoyButton
            onClick={() => {
              void handleSaveNote();
            }}
            loading={noteSaving}
            disabled={!noteValue.trim()}
          >
            Save Note
          </JoyButton>
        </JoyDialogActions>
      </JoyDialog>

      <JoyAlertDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={async () => {
          await onDelete();
          setDeleteOpen(false);
        }}
        title="Delete Customer"
        description={`This will permanently remove ${customerName} and all associated activity, segments, and campaign history. This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        loading={isDeleting}
      />
    </>
  );
}
