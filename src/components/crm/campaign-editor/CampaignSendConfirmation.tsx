import * as React from "react";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { AlertTriangle, CheckCircle2, Send } from "lucide-react";
import {
  JoyDialog,
  JoyDialogActions,
  JoyDialogContent,
} from "@/components/joy/JoyDialog";
import { JoyButton } from "@/components/joy/JoyButton";
import { useCampaignEditor } from "@/components/crm/campaign-editor/CampaignEditorContext";
import { useTenantEmailHealthDashboard } from "@/hooks/useTenantEmailHealthDashboard";
import { useSuppressionStats } from "@/hooks/useSuppressionList";
import { useTenant } from "@/hooks/useTenant";

export function CampaignSendConfirmation({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { tenant } = useTenant();
  const {
    audienceCount,
    sendImmediately,
    sendAt,
    senderName,
    senderEmail,
    isSaving,
    activate,
  } = useCampaignEditor();
  const healthQuery = useTenantEmailHealthDashboard(tenant?.id, {
    enabled: open,
  });
  const suppressionQuery = useSuppressionStats({ enabled: open });

  const warnings = [
    healthQuery.data && healthQuery.data.reputation_score < 70
      ? `Reputation score is ${healthQuery.data.reputation_score}.`
      : null,
    (suppressionQuery.data?.total ?? 0) > 0
      ? `${suppressionQuery.data?.total ?? 0} recipients are currently suppressed.`
      : null,
    (audienceCount ?? 0) === 0 ? "Audience count is zero." : null,
  ].filter(Boolean) as string[];

  return (
    <JoyDialog
      open={open}
      onClose={onClose}
      size="lg"
      title="Confirm Campaign Send"
      description="Final send checks before the campaign is activated."
    >
      <JoyDialogContent>
        <Stack spacing={2}>
          <Sheet
            variant="soft"
            color="neutral"
            sx={{ borderRadius: "lg", p: 2 }}
          >
            <Stack spacing={1}>
              <Typography level="body-sm">
                Audience: ~{(audienceCount ?? 0).toLocaleString()} recipients
              </Typography>
              <Typography level="body-sm">
                Sender: {senderName || "Unknown sender"} ·{" "}
                {senderEmail || "No sender email"}
              </Typography>
              <Typography level="body-sm">
                Delivery:{" "}
                {sendImmediately
                  ? "Send now"
                  : `Schedule for ${sendAt?.toLocaleString() ?? "later"}`}
              </Typography>
            </Stack>
          </Sheet>

          <Sheet variant="outlined" sx={{ borderRadius: "lg", p: 2 }}>
            <Stack spacing={1}>
              <Typography level="title-sm">30-day health snapshot</Typography>
              <Typography level="body-sm">
                Reputation score: {healthQuery.data?.reputation_score ?? "—"}
              </Typography>
              <Typography level="body-sm">
                Bounce rate:{" "}
                {healthQuery.data?.bounce_rate_30d?.toFixed(2) ?? "—"}%
              </Typography>
              <Typography level="body-sm">
                Complaint rate:{" "}
                {healthQuery.data?.complaint_rate_30d?.toFixed(2) ?? "—"}%
              </Typography>
            </Stack>
          </Sheet>

          <Sheet variant="outlined" sx={{ borderRadius: "lg", p: 2 }}>
            <Stack spacing={1}>
              <Typography level="title-sm">
                Governance and suppression
              </Typography>
              <Typography level="body-sm">
                Active suppressions:{" "}
                {(suppressionQuery.data?.total ?? 0).toLocaleString()}
              </Typography>
              <Typography level="body-sm">
                Quota and sender checks run when the campaign activates.
              </Typography>
            </Stack>
          </Sheet>

          <Stack spacing={1}>
            {warnings.length === 0 ? (
              <Sheet
                variant="soft"
                color="success"
                sx={{ borderRadius: "lg", p: 1.5 }}
              >
                <Stack direction="row" spacing={1} alignItems="center">
                  <CheckCircle2 size={16} />
                  <Typography level="body-sm">
                    No blocking issues detected.
                  </Typography>
                </Stack>
              </Sheet>
            ) : (
              warnings.map((warning) => (
                <Sheet
                  key={warning}
                  variant="soft"
                  color="warning"
                  sx={{ borderRadius: "lg", p: 1.5 }}
                >
                  <Stack direction="row" spacing={1} alignItems="center">
                    <AlertTriangle size={16} />
                    <Typography level="body-sm">{warning}</Typography>
                  </Stack>
                </Sheet>
              ))
            )}
          </Stack>
        </Stack>
      </JoyDialogContent>
      <JoyDialogActions>
        <JoyButton bloomVariant="ghost" color="neutral" onClick={onClose}>
          Back
        </JoyButton>
        <JoyButton
          loading={isSaving}
          onClick={() => {
            void activate().then(onClose);
          }}
          startDecorator={<Send size={16} />}
        >
          {sendImmediately
            ? `Send to ~${(audienceCount ?? 0).toLocaleString()} Recipients`
            : `Schedule for ${sendAt?.toLocaleString() ?? "later"}`}
        </JoyButton>
      </JoyDialogActions>
    </JoyDialog>
  );
}
