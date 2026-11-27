import * as React from "react";
import Chip from "@mui/joy/Chip";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Lock, LockOpen, Palette, RefreshCw } from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";
import type { StudioDesignSystem } from "@/lib/studio/designSystem";
import type { StudioBlock } from "@/types/studioBlocks";
import type { CampaignTemplateLock } from "@/hooks/useCampaignTemplateLock";
import { CampaignEmailThumbnail } from "@/components/crm/campaign-editor/CampaignLivePreview";

/** The blue-grey pill that says whether the email is held to a locked design. */
export function DesignLockPill({ lock }: { lock: CampaignTemplateLock | null }) {
  const locked = Boolean(lock?.locked);
  return (
    <Chip
      component="span"
      variant="soft"
      color="primary"
      data-testid="campaign-design-lock-pill"
      startDecorator={
        locked ? <Lock size={14} aria-hidden /> : <LockOpen size={14} aria-hidden />
      }
      sx={{
        "--Chip-gap": "6px",
        px: 2,
        py: 1,
        bgcolor: "primary.softBg",
        color: "primary.plainColor",
        fontSize: "sm",
        fontWeight: "lg",
        width: "fit-content",
      }}
    >
      {locked
        ? `Locked design${lock?.templateName ? `: ${lock.templateName}` : ""}`
        : "Design not locked"}
    </Chip>
  );
}

/** Full width on phones, 44px tall everywhere. */
const actionSx = { minHeight: 44, width: { xs: "100%", sm: "auto" } } as const;

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
      spacing={6}
      data-testid="campaign-design-summary"
      alignItems={{ xs: "flex-start", sm: "flex-start" }}
    >
      <CampaignEmailThumbnail
        blocks={blocks}
        subjectLine={subjectLine}
        previewText={previewText}
        designSystem={designSystem}
      />
      <Stack spacing={4} sx={{ minWidth: 0, flex: 1, width: "100%" }}>
        {/* Type scale: overline, then title, then meta. */}
        <Stack spacing={1} data-testid="campaign-design-info">
          <Typography
            level="body-xs"
            data-testid="campaign-design-overline"
            sx={{ fontWeight: "xl", letterSpacing: "0.08em", textTransform: "uppercase", color: "text.tertiary" }}
          >
            Design applied
          </Typography>
          <Typography
            component="h3"
            level="title-lg"
            sx={{ fontSize: "xl", fontWeight: "xl", color: "text.primary", lineHeight: 1.3, overflowWrap: "anywhere" }}
          >
            {designName}
          </Typography>
          <Typography level="body-sm" data-testid="campaign-design-meta" sx={{ color: "text.tertiary" }}>
            {`${blockCount} ${blockCount === 1 ? "block" : "blocks"}`}
            {lastEditedLabel ? ` · Last edited ${lastEditedLabel}` : ""}
          </Typography>
        </Stack>
        <DesignLockPill lock={lock} />
        {lock?.locked ? (
          <Typography level="body-sm" sx={{ color: "text.secondary" }}>
            {lock.canDesign
              ? "You can change this design. Staff who cannot change designs can only change the words, photos, prices, dates and links."
              : "You can change the words, photos, prices, dates and links. The layout, colours and styling are set by your designer."}
          </Typography>
        ) : null}
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          useFlexGap
          flexWrap="wrap"
        >
          <JoyButton
            variant="solid"
            color="primary"
            startDecorator={<Palette size={18} aria-hidden />}
            onClick={onEditInStudio}
            disabled={studioDisabled}
            title={studioDisabled ? studioDisabledReason : undefined}
            data-testid="campaign-design-edit-studio"
            sx={actionSx}
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
            sx={actionSx}
          >
            Change design
          </JoyButton>
          {extraActions}
        </Stack>
        {studioDisabled && studioDisabledReason ? (
          <Typography level="body-sm" sx={{ color: "text.secondary" }} role="status">
            {studioDisabledReason}
          </Typography>
        ) : null}
      </Stack>
    </Stack>
  );
}
