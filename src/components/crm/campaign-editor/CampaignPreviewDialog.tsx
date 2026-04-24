import * as React from "react";
import Box from "@mui/joy/Box";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Monitor, Smartphone } from "lucide-react";
import { JoyDialog, JoyDialogContent } from "@/components/joy/JoyDialog";
import { JoyButton } from "@/components/joy/JoyButton";
import { useCampaignEditor } from "@/components/crm/campaign-editor/CampaignEditorContext";

function buildPreviewHtml(
  blocks: ReturnType<typeof useCampaignEditor>["contentBlocks"],
) {
  if (blocks.length === 0) {
    return "<div style='font-family: sans-serif; padding: 24px;'>No email content yet.</div>";
  }

  const sections = blocks
    .map((block) => {
      const title =
        block.headline || block.title || block.heading || "Untitled block";
      const body = block.body || block.content || "";
      return `
        <section style="padding:24px;border-bottom:1px solid #e5e7eb;">
          <h2 style="margin:0 0 12px;font-size:22px;">${title}</h2>
          <div style="font-size:15px;line-height:1.6;white-space:pre-wrap;">${body}</div>
        </section>
      `;
    })
    .join("");

  return `
    <html>
      <body style="margin:0;background:#f7f7f8;">
        <div style="max-width:680px;margin:0 auto;background:#ffffff;min-height:100vh;">
          ${sections}
        </div>
      </body>
    </html>
  `;
}

export function CampaignPreviewDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { campaignType, contentBlocks, smsMessage, subjectLine } =
    useCampaignEditor();
  const [viewMode, setViewMode] = React.useState<"desktop" | "mobile">(
    "desktop",
  );

  return (
    <JoyDialog
      open={open}
      onClose={onClose}
      size="lg"
      title="Campaign Preview"
      description={
        campaignType === "sms"
          ? "Preview your SMS message."
          : subjectLine || "Preview your email layout."
      }
    >
      <JoyDialogContent>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1}>
            <JoyButton
              bloomVariant={viewMode === "desktop" ? "default" : "secondary"}
              onClick={() => setViewMode("desktop")}
              startDecorator={<Monitor size={16} />}
            >
              Desktop
            </JoyButton>
            <JoyButton
              bloomVariant={viewMode === "mobile" ? "default" : "secondary"}
              onClick={() => setViewMode("mobile")}
              startDecorator={<Smartphone size={16} />}
            >
              Mobile
            </JoyButton>
          </Stack>

          {campaignType === "sms" ? (
            <Box
              sx={{
                width: viewMode === "mobile" ? 360 : 520,
                maxWidth: "100%",
                border: "1px solid",
                borderColor: "neutral.200",
                borderRadius: "lg",
                p: 2,
                backgroundColor: "background.level1",
              }}
            >
              <Typography level="body-sm" sx={{ whiteSpace: "pre-wrap" }}>
                {smsMessage || "No SMS content yet."}
              </Typography>
            </Box>
          ) : (
            <Box
              sx={{
                width: "100%",
                display: "flex",
                justifyContent: "center",
              }}
            >
              <Box
                component="iframe"
                srcDoc={buildPreviewHtml(contentBlocks)}
                title="Campaign preview"
                sx={{
                  width: viewMode === "mobile" ? 390 : "100%",
                  minHeight: 560,
                  border: "1px solid",
                  borderColor: "neutral.200",
                  borderRadius: "lg",
                  backgroundColor: "common.white",
                }}
              />
            </Box>
          )}
        </Stack>
      </JoyDialogContent>
    </JoyDialog>
  );
}
