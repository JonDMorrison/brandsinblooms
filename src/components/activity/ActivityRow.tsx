import Box from "@mui/joy/Box";
import IconButton from "@mui/joy/IconButton";
import Link from "@mui/joy/Link";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { format, formatDistanceToNowStrict } from "date-fns";
import { Copy, Ellipsis, ExternalLink } from "lucide-react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  JoyDropdownMenu,
  JoyDropdownMenuContent,
  JoyDropdownMenuItem,
  JoyDropdownMenuTrigger,
} from "@/components/joy/JoyDropdownMenu";
import { JoyChip } from "@/components/joy/JoyChip";
import type { ActivityEvent } from "@/types/activity";
import { ActivityDescription } from "./ActivityDescription";
import {
  formatActivityActor,
  formatActivitySource,
  getCustomerNameFromEvent,
  isCustomerCreatedEvent,
} from "./activityPresentation";

export function ActivityRow({
  event,
  customerNameOverride,
  compact = false,
}: {
  event: ActivityEvent;
  customerNameOverride?: string;
  compact?: boolean;
}) {
  const navigate = useNavigate();
  const isCustomerCreated = isCustomerCreatedEvent(event);
  const customerHref = event.customer_id
    ? `/crm/customers/${event.customer_id}`
    : null;
  const customerName = getCustomerNameFromEvent(event, customerNameOverride);
  const shouldShowCustomer = Boolean(
    customerHref && customerName && !isCustomerCreated,
  );
  const detailHref = `/activity/${encodeURIComponent(String(event.id))}`;

  const timestampLabel = (() => {
    try {
      const timestamp = new Date(event.timestamp);
      return `${format(timestamp, "PPp")} · ${formatDistanceToNowStrict(
        timestamp,
        {
          addSuffix: true,
        },
      )}`;
    } catch {
      return event.timestamp;
    }
  })();

  const handleCopyId = () => {
    void navigator.clipboard.writeText(String(event.id));
    toast.success("Activity ID copied");
  };

  const handleOpenDetails = (clickEvent?: React.MouseEvent) => {
    clickEvent?.stopPropagation();
    navigate(detailHref);
  };

  return (
    <Sheet
      variant="outlined"
      sx={{
        borderRadius: "xl",
        borderColor: "neutral.200",
        backgroundColor: "background.surface",
        px: compact ? 2 : 2.5,
        py: compact ? 1.75 : 2.25,
        boxShadow: "sm",
        transition:
          "transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease",
        "&:hover": {
          transform: "translateY(-1px)",
          boxShadow: "md",
          borderColor: "primary.200",
        },
      }}
    >
      <Stack spacing={1.5} sx={{ minWidth: 0 }}>
        <Stack
          direction="row"
          spacing={1.5}
          alignItems="flex-start"
          justifyContent="space-between"
        >
          <Stack spacing={1} sx={{ minWidth: 0, flex: 1 }}>
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              useFlexGap
              flexWrap="wrap"
            >
              {!isCustomerCreated ? (
                <Box
                  component="button"
                  type="button"
                  onClick={handleOpenDetails}
                  sx={{
                    appearance: "none",
                    border: 0,
                    p: 0,
                    m: 0,
                    background: "transparent",
                    cursor: "pointer",
                    textAlign: "left",
                    minWidth: 0,
                    maxWidth: "100%",
                    color: "text.primary",
                    "&:hover": {
                      color: "primary.600",
                    },
                    "&:focus-visible": {
                      outline:
                        "2px solid rgba(var(--joy-palette-primary-mainChannel) / 0.35)",
                      outlineOffset: "3px",
                      borderRadius: "8px",
                    },
                  }}
                >
                  <Typography
                    level={compact ? "title-sm" : "title-md"}
                    sx={{
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {event.title || "Activity event"}
                  </Typography>
                </Box>
              ) : null}

              <JoyChip size="sm" variant="soft" color="primary">
                {event.activity_type || "activity"}
              </JoyChip>
              <JoyChip size="sm" variant="soft" color="neutral">
                {formatActivityActor(event.actor_type)}
              </JoyChip>
              <JoyChip size="sm" variant="soft" color="neutral">
                {formatActivitySource(event.source)}
              </JoyChip>
              {event.integration_name ? (
                <JoyChip size="sm" variant="soft" color="warning">
                  {event.integration_name}
                </JoyChip>
              ) : null}
            </Stack>

            <Typography
              level="body-xs"
              color="neutral"
              sx={{ display: { xs: "block", md: "none" } }}
            >
              {timestampLabel}
            </Typography>
          </Stack>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <JoyDropdownMenu>
              <JoyDropdownMenuTrigger aria-label="Open activity actions">
                <Ellipsis size={16} />
              </JoyDropdownMenuTrigger>
              <JoyDropdownMenuContent>
                <JoyDropdownMenuItem
                  startDecorator={<ExternalLink size={16} />}
                  onClick={() => navigate(detailHref)}
                >
                  View details
                </JoyDropdownMenuItem>
                <JoyDropdownMenuItem
                  startDecorator={<Copy size={16} />}
                  onClick={handleCopyId}
                >
                  Copy event ID
                </JoyDropdownMenuItem>
                {customerHref ? (
                  <JoyDropdownMenuItem
                    startDecorator={<ExternalLink size={16} />}
                    onClick={() => navigate(customerHref)}
                  >
                    View customer
                  </JoyDropdownMenuItem>
                ) : null}
              </JoyDropdownMenuContent>
            </JoyDropdownMenu>
          </Stack>
        </Stack>

        <Box sx={{ minWidth: 0 }}>
          {isCustomerCreated ? (
            <Typography
              level="body-sm"
              color="neutral"
              sx={{ lineHeight: 1.65 }}
            >
              Customer{" "}
              {customerHref && customerName ? (
                <Link
                  component={RouterLink}
                  to={customerHref}
                  underline="hover"
                >
                  {customerName}
                </Link>
              ) : (
                <Typography
                  component="span"
                  level="body-sm"
                  sx={{ display: "inline", fontWeight: 600 }}
                >
                  {customerName || "Customer"}
                </Typography>
              )}{" "}
              has been created.
            </Typography>
          ) : (
            <Typography
              level="body-sm"
              color="neutral"
              sx={{ lineHeight: 1.65 }}
            >
              {shouldShowCustomer ? (
                <>
                  Customer{" "}
                  <Link
                    component={RouterLink}
                    to={customerHref!}
                    underline="hover"
                  >
                    {customerName}
                  </Link>{" "}
                  —{" "}
                </>
              ) : null}
              <ActivityDescription
                description={event.description}
                maxCharacters={120}
              />
            </Typography>
          )}
        </Box>

        {event.error_message ? (
          <Sheet
            color="danger"
            variant="soft"
            sx={{ borderRadius: "lg", px: 1.5, py: 1.25 }}
          >
            <Typography level="body-sm" color="danger">
              {event.error_message}
            </Typography>
          </Sheet>
        ) : null}
      </Stack>
    </Sheet>
  );
}
