import * as React from "react";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Lock } from "lucide-react";
import { CampaignDeliveryStatusCard } from "@/components/crm/CampaignDeliveryStatusCard";
import { useCampaignEditor } from "@/components/crm/campaign-editor/CampaignEditorContext";

export function CampaignLockedView() {
  const { campaignId, status, contentBlocks, smsMessage } = useCampaignEditor();

  return (
    <Stack spacing={3}>
      <Sheet variant="soft" color="neutral" sx={{ borderRadius: "lg", p: 2.5 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Lock size={18} />
          <Typography level="body-sm">
            This campaign is read-only because it is currently {status}.
          </Typography>
        </Stack>
      </Sheet>

      {campaignId ? (
        <CampaignDeliveryStatusCard campaignId={campaignId} />
      ) : null}

      <Sheet variant="outlined" sx={{ borderRadius: "lg", p: 2.5 }}>
        <Stack spacing={1}>
          <Typography level="title-sm">Content snapshot</Typography>
          {smsMessage ? (
            <Typography level="body-sm" sx={{ whiteSpace: "pre-wrap" }}>
              {smsMessage}
            </Typography>
          ) : (
            <Typography level="body-sm" color="neutral">
              {contentBlocks.length} email blocks preserved for preview and
              reporting.
            </Typography>
          )}
        </Stack>
      </Sheet>
    </Stack>
  );
}
