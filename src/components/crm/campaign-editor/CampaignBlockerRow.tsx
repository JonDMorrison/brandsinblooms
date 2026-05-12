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
        alignItems: "center",
        justifyContent: "space-between",
        gap: 1.5,
        px: 2,
        py: 1.25,
        borderRadius: "10px",
        backgroundColor: "warning.50",
        border: "1px solid",
        borderColor: "warning.200",
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
          sx={{ color: "warning.700" }}
        >
          {blocker.message}
        </Typography>
      </Stack>
      {blocker.actionLabel && blocker.onAction ? (
        <JoyButton
          size="sm"
          variant="soft"
          color="warning"
          onClick={blocker.onAction}
        >
          {blocker.actionLabel}
        </JoyButton>
      ) : null}
    </Box>
  );
}
