import * as React from "react";
import Box from "@mui/joy/Box";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Lock, LockOpen, Palette, RefreshCw } from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";
import type { StudioDesignSystem } from "@/lib/studio/designSystem";
import type { StudioBlock } from "@/types/studioBlocks";
import type { CampaignTemplateLock } from "@/hooks/useCampaignTemplateLock";
import { CampaignEmailThumbnail } from "@/components/crm/campaign-editor/CampaignLivePreview";
import { CAMPAIGN_EDITOR_COLORS as C } from "@/components/crm/campaign-editor/campaignEditorTheme";

/** The blue-grey pill that says whether the email is held to a locked design. */
export function DesignLockPill({ lock }: { lock: CampaignTemplateLock | null }) {
  const locked = Boolean(lock?.locked);
  return (
    <Box
      component="span"
      data-testid="campaign-design-lock-pill"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.75,
        px: 1.25,
        py: 0.5,
        borderRadius: "999px",
        bgcolor: C.infoBg,
        color: C.infoText,
        fontSize: 14,
        fontWeight: 600,
        width: "fit-content",
      }}
    >
      {locked ? <Lock size={14} aria-hidden /> : <LockOpen size={14} aria-hidden />}
      {locked
        ? `Locked design${lock?.templateName ? `: ${lock.templateName}` : ""}`
        : "Design not locked"}
    </Box>
  );
}

/**
 * The applied design, shown as a real rendered thumbnail with its name,
 * block count and last edit, and the two ways to change it.
 */
export function CampaignDesignSummary({
  blocks,
  subjectLine,
  previewText,
  designSystem,
  designName,
  blockCount,
  lastEditedLabel,
  lock,
  onEditInStudio,
  onChangeDesign,
  studioDisabled,
  studioDisabledReason,
  changeDisabled,
  studioLabel,
  extraActions,
}: {
  blocks: StudioBlock[];
  subjectLine: string;
  previewText: string;
  designSystem: StudioDesignSystem;
  designName: string;
  blockCount: number;
  lastEditedLabel: string | null;
  lock: CampaignTemplateLock | null;
  onEditInStudio: () => void;
  onChangeDesign: () => void;
  studioDisabled: boolean;
  studioDisabledReason?: string;
  changeDisabled: boolean;
  studioLabel: string;
  extraActions?: React.ReactNode;
}) {
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={2.5}
      data-testid="campaign-design-summary"
      alignItems={{ xs: "stretch", sm: "flex-start" }}
    >
      <CampaignEmailThumbnail
        blocks={blocks}
        subjectLine={subjectLine}
        previewText={previewText}
        designSystem={designSystem}
      />
      <Stack spacing={1.25} sx={{ minWidth: 0, flex: 1 }}>
        <Box>
          <Typography sx={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.muted }}>
            Design applied
          </Typography>
          <Typography component="h3" sx={{ fontSize: 20, fontWeight: 700, color: C.text, lineHeight: 1.3 }}>
            {designName}
          </Typography>
          <Typography sx={{ fontSize: 15, color: C.muted, mt: 0.25 }}>
            {`${blockCount} ${blockCount === 1 ? "block" : "blocks"}`}
            {lastEditedLabel ? ` · Last edited ${lastEditedLabel}` : ""}
          </Typography>
        </Box>
        <DesignLockPill lock={lock} />
        {lock?.locked ? (
          <Typography sx={{ fontSize: 14, color: C.muted }}>
            {lock.canDesign
              ? "You can change this design. Staff who cannot change designs can only change the words, photos, prices, dates and links."
              : "You can change the words, photos, prices, dates and links. The layout, colours and styling are set by your designer."}
          </Typography>
        ) : null}
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          <JoyButton
            variant="solid"
            color="primary"
            startDecorator={<Palette size={18} aria-hidden />}
            onClick={onEditInStudio}
            disabled={studioDisabled}
            title={studioDisabled ? studioDisabledReason : undefined}
            data-testid="campaign-design-edit-studio"
          >
            {studioLabel}
          </JoyButton>
          <JoyButton
            variant="outlined"
            color="neutral"
            startDecorator={<RefreshCw size={18} aria-hidden />}
            onClick={onChangeDesign}
            disabled={changeDisabled}
            data-testid="campaign-design-change"
          >
            Change design
          </JoyButton>
          {extraActions}
        </Stack>
        {studioDisabled && studioDisabledReason ? (
          <Typography sx={{ fontSize: 14, color: C.muted }} role="status">
            {studioDisabledReason}
          </Typography>
        ) : null}
      </Stack>
    </Stack>
  );
}
