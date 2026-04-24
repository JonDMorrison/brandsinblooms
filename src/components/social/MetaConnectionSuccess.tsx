import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { BarChart3, Calendar, Check, Send } from "lucide-react";

import type { SocialConnection } from "@/components/analytics/SocialConnectionManager";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyChip } from "@/components/joy/JoyChip";
import { PLATFORM_CONFIG } from "@/utils/platformConfig";

interface MetaConnectionSuccessProps {
  facebookConnection?: SocialConnection;
  instagramConnection?: SocialConnection;
  onSyncAnalytics?: () => Promise<void> | void;
  onOpenAnalytics?: () => void;
  onOpenScheduling?: () => void;
  onOpenPublishing?: () => void;
  onManageConnections?: () => void;
}

const MetaConnectionSuccess = ({
  facebookConnection,
  instagramConnection,
  onSyncAnalytics,
  onOpenAnalytics,
  onOpenScheduling,
  onOpenPublishing,
  onManageConnections,
}: MetaConnectionSuccessProps) => {
  void facebookConnection;
  void instagramConnection;

  const facebookLabel = PLATFORM_CONFIG.facebook.label;
  const instagramLabel = PLATFORM_CONFIG.instagram.label;

  return (
    <Stack spacing={3}>
      <Stack spacing={1.5} alignItems="center">
        <Typography level="title-lg" textAlign="center">
          Meta Accounts Connected
        </Typography>

        <Stack
          direction="row"
          spacing={1}
          useFlexGap
          flexWrap="wrap"
          justifyContent="center"
        >
          <JoyChip
            color="success"
            size="sm"
            startDecorator={<Check size={12} />}
            variant="soft"
          >
            {facebookLabel}
          </JoyChip>
          <JoyChip
            color="success"
            size="sm"
            startDecorator={<Check size={12} />}
            variant="soft"
          >
            {instagramLabel}
          </JoyChip>
        </Stack>
      </Stack>

      <Stack spacing={1.25}>
        <Typography level="title-sm" sx={{ color: "text.secondary" }}>
          What's next
        </Typography>

        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
          <Sheet
            component="button"
            type="button"
            variant="outlined"
            onClick={() => {
              void onSyncAnalytics?.();
              onOpenAnalytics?.();
            }}
            sx={{
              flex: 1,
              minWidth: 0,
              borderRadius: "md",
              p: 2,
              bgcolor: "background.surface",
              textAlign: "left",
              cursor: "pointer",
              appearance: "none",
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <Stack spacing={0.75}>
              <BarChart3
                size={16}
                style={{ color: "var(--joy-palette-text-secondary)" }}
              />
              <Typography level="body-sm" sx={{ fontWeight: "md" }}>
                Review analytics
              </Typography>
              <Typography level="body-xs" sx={{ color: "text.secondary" }}>
                Open the analytics tab to review performance across connected
                accounts.
              </Typography>
            </Stack>
          </Sheet>

          <Sheet
            component="button"
            type="button"
            variant="outlined"
            onClick={onOpenScheduling}
            sx={{
              flex: 1,
              minWidth: 0,
              borderRadius: "md",
              p: 2,
              bgcolor: "background.surface",
              textAlign: "left",
              cursor: "pointer",
              appearance: "none",
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <Stack spacing={0.75}>
              <Calendar
                size={16}
                style={{ color: "var(--joy-palette-text-secondary)" }}
              />
              <Typography level="body-sm" sx={{ fontWeight: "md" }}>
                Configure scheduling
              </Typography>
              <Typography level="body-xs" sx={{ color: "text.secondary" }}>
                Move into auto-scheduling to prepare the next set of optimized
                posting windows.
              </Typography>
            </Stack>
          </Sheet>

          <Sheet
            component="button"
            type="button"
            variant="outlined"
            onClick={onOpenPublishing}
            sx={{
              flex: 1,
              minWidth: 0,
              borderRadius: "md",
              p: 2,
              bgcolor: "background.surface",
              textAlign: "left",
              cursor: "pointer",
              appearance: "none",
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <Stack spacing={0.75}>
              <Send
                size={16}
                style={{ color: "var(--joy-palette-text-secondary)" }}
              />
              <Typography level="body-sm" sx={{ fontWeight: "md" }}>
                Open publishing
              </Typography>
              <Typography level="body-xs" sx={{ color: "text.secondary" }}>
                Jump to publishing when you are ready to turn connected channels
                into outbound content.
              </Typography>
            </Stack>
          </Sheet>
        </Stack>
      </Stack>

      <Stack alignItems="flex-start">
        <JoyButton
          color="neutral"
          size="sm"
          variant="plain"
          onClick={onManageConnections}
        >
          Back to connections
        </JoyButton>
      </Stack>
    </Stack>
  );
};

export default MetaConnectionSuccess;
