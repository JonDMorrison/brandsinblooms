import * as React from "react";
import Alert from "@mui/joy/Alert";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Typography from "@mui/joy/Typography";
import { Lock } from "lucide-react";
import type { CampaignTemplateLock } from "@/hooks/useCampaignTemplateLock";

/** Tells the person this email is held to a locked design, and what they can change. */
export function CampaignTemplateLockNotice({
  lock,
  onRelease,
  releasing = false,
}: {
  lock: CampaignTemplateLock | null;
  onRelease?: () => void;
  releasing?: boolean;
}) {
  if (!lock?.locked) return null;
  return (
    <Alert
      color="warning"
      variant="soft"
      startDecorator={<Lock size={18} aria-hidden="true" />}
      data-testid="campaign-template-lock-notice"
      endDecorator={
        lock.canDesign && onRelease ? (
          <Button size="sm" variant="outlined" color="neutral" loading={releasing} onClick={onRelease}>
            Unlock this email
          </Button>
        ) : undefined
      }
    >
      <Box>
        <Typography level="title-sm">
          Locked design{lock.templateName ? `: ${lock.templateName}` : ""}
        </Typography>
        <Typography level="body-sm">
          {lock.canDesign
            ? "You can change this design. Staff who cannot change designs can only change the words, photos, prices, dates and links."
            : "You can change the words, photos, prices, dates and links. The layout, colours and styling are set by your designer. A change to those will not save."}
        </Typography>
      </Box>
    </Alert>
  );
}
