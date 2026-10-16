import * as React from "react";
import Box from "@mui/joy/Box";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { AlertCircle } from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";
import {
  resolveCampaignBlocker,
  type CampaignBlockerHandlers,
  type CampaignBlockerInput,
} from "@/components/crm/campaign-editor/campaignBlockerLogic";

export interface CampaignBlockerRowProps
  extends CampaignBlockerInput,
    CampaignBlockerHandlers {}

export function CampaignBlockerRow({
  senderUnverified,
  audienceEmpty,
  contentEmpty,
  subjectEmpty,
  draftConflict,
  onVerifySender,
  onScrollToAudience,
  onScrollToContent,
  onScrollToSubject,
  onReload,
}: CampaignBlockerRowProps) {
  const blocker = resolveCampaignBlocker(
    {
      senderUnverified,
      audienceEmpty,
      contentEmpty,
      subjectEmpty,
      draftConflict,
    },
    {
      onVerifySender,
      onScrollToAudience,
      onScrollToContent,
      onScrollToSubject,
      onReload,
    },
  );

  if (!blocker) {
    return null;
  }

  return (
    <Box
      role="status"
      aria-live="polite"
      data-testid={`campaign-blocker-${blocker.kind}`}
      sx={{
        display: "flex",
        flexDirection: { xs: "column", sm: "row" },
        alignItems: { xs: "flex-start", sm: "center" },
        justifyContent: "space-between",
        gap: 1.5,
        px: { xs: 2, sm: 2.5 },
        py: 1.5,
        borderRadius: "10px",
        backgroundColor: "background.surface",
        border: "1px solid",
        borderColor: "neutral.300",
      }}
    >
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{ minWidth: 0 }}
      >
        <AlertCircle
          size={16}
          style={{ color: "var(--joy-palette-warning-600)", flexShrink: 0 }}
        />
        <Typography
          level="body-sm"
          fontWeight="md"
          sx={{ color: "neutral.800" }}
        >
          {blocker.message}
        </Typography>
      </Stack>
      {blocker.actionLabel && blocker.onAction ? (
        <JoyButton
          size="sm"
          variant="outlined"
          color="neutral"
          onClick={blocker.onAction}
        >
          {blocker.actionLabel}
        </JoyButton>
      ) : null}
    </Box>
  );
}
