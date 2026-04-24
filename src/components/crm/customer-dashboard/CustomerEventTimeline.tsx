import * as React from "react";
import Divider from "@mui/joy/Divider";
import List from "@mui/joy/List";
import ListItem from "@mui/joy/ListItem";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import {
  Activity,
  ArrowRightLeft,
  Gift,
  Mail,
  MailOpen,
  MessageSquare,
  MousePointerClick,
  ShoppingBag,
  ShieldAlert,
  UserPlus,
} from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import { JoyChip } from "@/components/joy/JoyChip";
import { JoySelect } from "@/components/joy/JoySelect";
import type { TimelineDisplayEvent } from "@/lib/customerDashboardTransformers";
import { formatRelativeTimestamp } from "./customerDashboardUtils";

interface CustomerEventTimelineProps {
  events: TimelineDisplayEvent[];
  hasMore?: boolean;
  compact?: boolean;
  maxItems?: number;
  errorMessage?: string | null;
  onRetry?: () => void;
  onViewAll?: () => void;
}

const eventConfig: Record<
  TimelineDisplayEvent["type"],
  {
    icon: React.ElementType;
    color: "primary" | "success" | "warning" | "danger" | "neutral";
  }
> = {
  purchase: { icon: ShoppingBag, color: "success" },
  email_open: { icon: MailOpen, color: "primary" },
  email_click: { icon: MousePointerClick, color: "primary" },
  email_sent: { icon: Mail, color: "neutral" },
  sms_click: { icon: MousePointerClick, color: "success" },
  sms_sent: { icon: MessageSquare, color: "neutral" },
  opt_out: { icon: ShieldAlert, color: "danger" },
  signup: { icon: UserPlus, color: "success" },
  loyalty: { icon: Gift, color: "warning" },
  redemption: { icon: Gift, color: "warning" },
  risk: { icon: ShieldAlert, color: "danger" },
  stage_change: { icon: ArrowRightLeft, color: "primary" },
};

export function CustomerEventTimeline({
  events,
  hasMore = false,
  compact = false,
  maxItems = 10,
  errorMessage,
  onRetry,
  onViewAll,
}: CustomerEventTimelineProps) {
  const [selectedType, setSelectedType] = React.useState<string>("all");

  const typeOptions = React.useMemo(() => {
    const values = Array.from(new Set(events.map((event) => event.type)));
    return [
      { value: "all", label: "All events" },
      ...values.map((value) => ({
        value,
        label: value
          .replace(/[_-]+/g, " ")
          .replace(/\b\w/g, (character) => character.toUpperCase()),
      })),
    ];
  }, [events]);

  const filteredEvents = React.useMemo(() => {
    const visible =
      selectedType === "all"
        ? events
        : events.filter((event) => event.type === selectedType);
    return compact ? visible.slice(0, maxItems) : visible;
  }, [compact, events, maxItems, selectedType]);

  return (
    <JoyCard variant="outlined">
      <JoyCardHeader
        title="Customer story timeline"
        description="The most recent milestones, interactions, and signals for this customer."
        actions={
          <Stack direction="row" spacing={1} alignItems="center">
            <JoySelect
              size="sm"
              value={selectedType}
              onValueChange={(value) => setSelectedType(value || "all")}
              options={typeOptions}
              sx={{ minWidth: 150 }}
            />
            {errorMessage && onRetry ? (
              <JoyButton
                color="danger"
                variant="plain"
                size="sm"
                onClick={onRetry}
              >
                Retry
              </JoyButton>
            ) : null}
          </Stack>
        }
      />
      <JoyCardContent>
        <Stack spacing={1.5}>
          {errorMessage ? (
            <Sheet
              color="danger"
              variant="soft"
              sx={{ borderRadius: "xl", p: 2 }}
            >
              <Typography level="title-sm">Failed to load timeline</Typography>
              <Typography level="body-sm" color="danger">
                {errorMessage}
              </Typography>
            </Sheet>
          ) : filteredEvents.length === 0 ? (
            <Sheet
              variant="soft"
              color="neutral"
              sx={{ borderRadius: "xl", p: 2.5 }}
            >
              <Typography level="title-sm">No timeline events yet</Typography>
              <Typography level="body-sm" color="neutral">
                Once this customer starts interacting across channels, their
                story will appear here.
              </Typography>
            </Sheet>
          ) : (
            <List
              sx={{
                maxHeight: compact ? 300 : 520,
                overflowY: "auto",
                gap: 1.25,
                "--List-padding": "0px",
              }}
            >
              {filteredEvents.map((event, index) => {
                const config = eventConfig[event.type] || {
                  icon: Activity,
                  color: "neutral" as const,
                };
                const Icon = config.icon;

                return (
                  <React.Fragment key={event.id}>
                    <ListItem sx={{ px: 0, py: 0 }}>
                      <Sheet
                        variant="outlined"
                        sx={{ width: "100%", borderRadius: "xl", p: 2 }}
                      >
                        <Stack
                          direction="row"
                          spacing={1.5}
                          alignItems="flex-start"
                        >
                          <Sheet
                            variant="soft"
                            color={config.color}
                            sx={{
                              width: 36,
                              height: 36,
                              borderRadius: "lg",
                              display: "grid",
                              placeItems: "center",
                              flexShrink: 0,
                            }}
                          >
                            <Icon size={18} />
                          </Sheet>
                          <Stack spacing={0.75} sx={{ minWidth: 0, flex: 1 }}>
                            <Stack
                              direction={{ xs: "column", sm: "row" }}
                              spacing={0.75}
                              justifyContent="space-between"
                              alignItems={{ xs: "flex-start", sm: "center" }}
                            >
                              <Typography level="title-sm">
                                {event.title}
                              </Typography>
                              <Typography level="body-xs" color="neutral">
                                {formatRelativeTimestamp(event.timestamp)}
                              </Typography>
                            </Stack>
                            <Typography level="body-sm" color="neutral">
                              {event.description ||
                                "No additional details captured."}
                            </Typography>
                            <Stack
                              direction="row"
                              spacing={0.75}
                              useFlexGap
                              flexWrap="wrap"
                            >
                              <JoyChip
                                color={config.color}
                                variant="soft"
                                size="sm"
                              >
                                {event.type.replace(/[_-]+/g, " ")}
                              </JoyChip>
                              <JoyChip
                                color={
                                  event.impact === "negative"
                                    ? "danger"
                                    : event.impact === "positive"
                                      ? "success"
                                      : "neutral"
                                }
                                variant="soft"
                                size="sm"
                              >
                                {event.impact}
                              </JoyChip>
                            </Stack>
                          </Stack>
                        </Stack>
                      </Sheet>
                    </ListItem>
                    {index < filteredEvents.length - 1 ? <Divider /> : null}
                  </React.Fragment>
                );
              })}
            </List>
          )}

          {onViewAll && (hasMore || compact) ? (
            <Stack direction="row" justifyContent="flex-end">
              <JoyButton
                color="primary"
                variant="plain"
                size="sm"
                onClick={onViewAll}
              >
                View all in Activity tab
              </JoyButton>
            </Stack>
          ) : null}
        </Stack>
      </JoyCardContent>
    </JoyCard>
  );
}

export default CustomerEventTimeline;
