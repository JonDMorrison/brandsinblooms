import * as React from "react";
import Box from "@mui/joy/Box";
import CircularProgress from "@mui/joy/CircularProgress";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { useNavigate } from "react-router-dom";
import { JoyDialog, JoyDialogContent } from "@/components/joy/JoyDialog";
import { IntentCardThumbnail } from "@/components/crm/campaign-editor/IntentCardThumbnail";
import { useTenant } from "@/hooks/useTenant";
import { useCampaignCloning } from "@/hooks/useCampaignCloning";
import {
  useRecentCampaignsToCopy,
  type CampaignToCopy,
} from "@/hooks/useRecentCampaignsToCopy";

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

function CampaignRow({
  campaign,
  busy,
  onCopy,
}: {
  campaign: CampaignToCopy;
  busy: boolean;
  onCopy: (campaign: CampaignToCopy) => void;
}) {
  const date = campaign.date ? new Date(campaign.date) : null;
  return (
    <Box
      component="button"
      type="button"
      disabled={busy}
      onClick={() => onCopy(campaign)}
      data-testid={`copy-campaign-${campaign.id}`}
      sx={{
        display: "grid",
        gridTemplateColumns: "88px minmax(0, 1fr) auto",
        alignItems: "center",
        gap: 1.5,
        width: "100%",
        p: 1,
        textAlign: "left",
        font: "inherit",
        cursor: busy ? "progress" : "pointer",
        bgcolor: "background.surface",
        border: "1px solid",
        borderColor: "neutral.200",
        borderRadius: "md",
        "&:hover": { borderColor: "neutral.400" },
        "&:focus-visible": { outline: "2px solid #244d46", outlineOffset: 2 },
      }}
    >
      <Box
        sx={{
          width: 88,
          height: 64,
          borderRadius: "sm",
          overflow: "hidden",
          bgcolor: "neutral.100",
          backgroundImage: campaign.thumbnailUrl
            ? `url("${campaign.thumbnailUrl.replace(/"/g, "%22")}")`
            : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {campaign.thumbnailUrl ? null : (
          <IntentCardThumbnail template={null} blocks={campaign.blocks} />
        )}
      </Box>
      <Stack spacing={0.25} sx={{ minWidth: 0 }}>
        <Typography level="title-sm" noWrap>
          {campaign.subjectLine || campaign.name}
        </Typography>
        <Typography level="body-xs" noWrap sx={{ color: "neutral.500" }}>
          {campaign.name}
        </Typography>
      </Stack>
      <Stack spacing={0.25} alignItems="flex-end">
        <Typography level="body-xs" sx={{ color: campaign.status === "sent" ? "success.700" : "neutral.600", fontWeight: 600 }}>
          {campaign.status === "sent" ? "Sent" : "Draft"}
        </Typography>
        <Typography level="body-xs" sx={{ color: "neutral.500" }}>
          {date && !Number.isNaN(date.getTime()) ? dateFormat.format(date) : ""}
        </Typography>
      </Stack>
    </Box>
  );
}

/**
 * "Copy a previous email": pick one of the last 10 sent or draft emails; it
 * is duplicated (source_campaign_id set) and opened in Design Studio.
 */
export function CopyPreviousEmailDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const { tenant } = useTenant();
  const { cloneCampaign, isCloning } = useCampaignCloning();
  const recent = useRecentCampaignsToCopy(tenant?.id, { enabled: open });

  const handleCopy = async (campaign: CampaignToCopy) => {
    const newId = await cloneCampaign(campaign.id, {
      newName: `Copy of ${campaign.name}`,
      clearScheduling: true,
    });
    if (newId) {
      onClose();
      navigate(`/crm/campaigns/${newId}/studio`);
    }
  };

  return (
    <JoyDialog
      open={open}
      onClose={() => onClose()}
      title="Copy a previous email"
      description="Start from one of your recent emails. The copy opens in Design Studio as a new draft."
      size="md"
    >
      <JoyDialogContent>
        {recent.isLoading ? (
          <Stack alignItems="center" sx={{ py: 4 }}>
            <CircularProgress size="sm" />
          </Stack>
        ) : recent.isError ? (
          <Typography role="alert" color="danger">
            Your recent emails couldn't be loaded. Try again.
          </Typography>
        ) : (recent.data ?? []).length === 0 ? (
          <Typography sx={{ color: "neutral.600" }}>
            You don't have any sent or draft emails yet.
          </Typography>
        ) : (
          <Stack spacing={1} data-testid="copy-previous-email-list">
            {(recent.data ?? []).map((campaign) => (
              <CampaignRow
                key={campaign.id}
                campaign={campaign}
                busy={isCloning}
                onCopy={(item) => void handleCopy(item)}
              />
            ))}
          </Stack>
        )}
      </JoyDialogContent>
    </JoyDialog>
  );
}
