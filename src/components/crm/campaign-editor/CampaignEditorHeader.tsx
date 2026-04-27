import * as React from "react";
import LinearProgress from "@mui/joy/LinearProgress";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import {
  ArrowLeft,
  Eye,
  Pause,
  Play,
  SendHorizonal,
  TimerReset,
} from "lucide-react";
import { Link } from "react-router-dom";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyStatusChip } from "@/components/joy/JoyChip";
import { JoyInput } from "@/components/joy/JoyInput";
import {
  CAMPAIGN_STATUS,
  isDeliveredCampaignStatus,
} from "@/constants/campaignStatuses";
import { useCampaignEditor } from "@/components/crm/campaign-editor/CampaignEditorContext";
import { CampaignPreviewDialog } from "@/components/crm/campaign-editor/CampaignPreviewDialog";
import { CampaignScheduleDrawer } from "@/components/crm/campaign-editor/CampaignScheduleDrawer";

export function CampaignEditorHeader() {
  const {
    campaignId,
    name,
    status,
    sendBlockedReason,
    lastSavedAt,
    isSaving,
    isLocked,
    updateSetup,
    activate,
    pause,
    resume,
  } = useCampaignEditor();
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [scheduleOpen, setScheduleOpen] = React.useState(false);

  return (
    <Sheet
      variant="plain"
      sx={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        backdropFilter: "blur(10px)",
        backgroundColor:
          "rgba(var(--joy-palette-background-bodyChannel) / 0.88)",
        borderBottom: "1px solid",
        borderColor: "neutral.200",
        py: 2,
        mb: 3,
      }}
    >
      <Stack spacing={2}>
        <Stack
          direction={{ xs: "column", lg: "row" }}
          spacing={2}
          justifyContent="space-between"
        >
          <Stack spacing={1.25}>
            <JoyButton
              bloomVariant="link"
              color="neutral"
              component={Link}
              startDecorator={<ArrowLeft size={16} />}
              to="/crm/campaigns"
            >
              Back to campaigns
            </JoyButton>
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={1.25}
              alignItems={{ md: "center" }}
            >
              <JoyInput
                disabled={isLocked}
                onValueChange={(value) => updateSetup({ name: value })}
                sx={{ minWidth: { md: 320 } }}
                value={name}
              />
              <JoyStatusChip status={status} />
            </Stack>
            <Typography level="body-xs" color="neutral">
              {isSaving
                ? "Saving draft..."
                : lastSavedAt
                  ? `Last saved ${lastSavedAt.toLocaleTimeString()}`
                  : campaignId
                    ? "Saved"
                    : "New draft"}
            </Typography>
          </Stack>

          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            alignItems={{ sm: "center" }}
          >
            <JoyButton
              bloomVariant="secondary"
              onClick={() => setPreviewOpen(true)}
              startDecorator={<Eye size={16} />}
            >
              Preview
            </JoyButton>
            <JoyButton
              bloomVariant="secondary"
              onClick={() => setScheduleOpen(true)}
              startDecorator={<TimerReset size={16} />}
            >
              Schedule
            </JoyButton>
            {status === CAMPAIGN_STATUS.SENDING ? (
              <JoyButton
                color="warning"
                onClick={() => void pause()}
                startDecorator={<Pause size={16} />}
              >
                Pause
              </JoyButton>
            ) : status === CAMPAIGN_STATUS.PAUSED ? (
              <JoyButton
                color="success"
                onClick={() => void resume()}
                startDecorator={<Play size={16} />}
              >
                Resume
              </JoyButton>
            ) : (
              <JoyButton
                onClick={() => void activate()}
                startDecorator={<SendHorizonal size={16} />}
              >
                {status === CAMPAIGN_STATUS.SCHEDULED
                  ? "Reschedule / Send"
                  : "Send"}
              </JoyButton>
            )}
          </Stack>
        </Stack>

        {status === CAMPAIGN_STATUS.SENDING ? (
          <LinearProgress determinate value={55} />
        ) : null}

        {isDeliveredCampaignStatus(status) ? (
          <Typography level="body-sm" color="neutral">
            Campaign sent.{" "}
            <Link to={`/crm/campaigns/${campaignId}/report`}>View report</Link>
          </Typography>
        ) : null}

        {sendBlockedReason ? (
          <Sheet
            variant="soft"
            color="danger"
            sx={{ borderRadius: "lg", p: 1.5 }}
          >
            <Typography level="body-sm">{sendBlockedReason}</Typography>
          </Sheet>
        ) : null}
      </Stack>

      <CampaignPreviewDialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
      />
      <CampaignScheduleDrawer
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
      />
    </Sheet>
  );
}
