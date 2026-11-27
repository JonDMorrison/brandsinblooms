import * as React from "react";
import Box from "@mui/joy/Box";
import IconButton from "@mui/joy/IconButton";
import Menu from "@mui/joy/Menu";
import MenuItem from "@mui/joy/MenuItem";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import {
  Check,
  Calendar,
  CalendarDays,
  FilePlus,
  Flower2,
  Leaf,
  ShoppingBag,
  Heart,
  Images,
  MoreHorizontal,
  Newspaper,
  Sprout,
  Sun,
  Tag,
  type LucideIcon,
} from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";
import {
  getTemplateForIntent,
  CAMPAIGN_TEMPLATES,
  type CampaignTemplate,
  type CampaignIntentKey,
} from "@/lib/studio/campaignTemplates";
import type { SavedTemplate } from "@/hooks/useSavedTemplates";
import { IntentCardThumbnail } from "@/components/crm/campaign-editor/IntentCardThumbnail";
import { useOptionalDesignSystem } from "@/contexts/DesignSystemContext";

/** What the "This week's theme" start card shows. */
export interface WeeklyThemeStartOption {
  title: string;
  weekLabel: string;
  summary?: string;
  imageUrl?: string | null;
}

interface StartCardProps {
  testId: string;
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
  imageUrl?: string | null;
  selected?: boolean;
  disabled?: boolean;
  loading?: boolean;
  onSelect: () => void;
}

/** One of the two primary ways to start: this week's theme, or scratch. */
function StartCard({
  testId,
  icon: Icon,
  eyebrow,
  title,
  description,
  imageUrl,
  selected = false,
  disabled = false,
  loading = false,
  onSelect,
}: StartCardProps) {
  const inactive = disabled || loading;
  return (
    <Box
      role="button"
      tabIndex={inactive ? -1 : 0}
      aria-pressed={selected}
      aria-disabled={inactive || undefined}
      aria-busy={loading || undefined}
      data-testid={testId}
      onClick={() => {
        if (!inactive) onSelect();
      }}
      onKeyDown={(event) => {
        if (!inactive && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onSelect();
        }
      }}
      sx={{
        ...cardBaseSx,
        flexDirection: "row",
        alignItems: "stretch",
        gap: 1.5,
        minHeight: 112,
        ...(selected ? cardSelectedSx : {}),
        ...(inactive ? cardDisabledSx : {}),
      }}
    >
      <Box
        aria-hidden
        sx={{
          width: 104,
          flexShrink: 0,
          borderRadius: "var(--joy-radius-md)",
          backgroundColor: "neutral.100",
          backgroundImage: imageUrl ? `url("${imageUrl.replace(/"/g, "%22")}")` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "neutral.600",
        }}
      >
        {imageUrl ? null : <Icon size={28} strokeWidth={1.6} />}
      </Box>
      <Stack spacing={0.5} sx={{ minWidth: 0, flex: 1, justifyContent: "center" }}>
        <Typography level="body-xs" sx={{ textTransform: "uppercase", letterSpacing: "0.06em", color: "primary.plainColor", fontWeight: 700 }}>
          {eyebrow}
        </Typography>
        <Typography level="title-md" sx={{ fontSize: 18, fontWeight: 600, color: "neutral.800" }}>
          {title}
        </Typography>
        <Typography level="body-sm" sx={{ color: "neutral.600", display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 2, overflow: "hidden" }}>
          {description}
        </Typography>
      </Stack>
    </Box>
  );
}

export type IntentCardEntry = {
  key: CampaignIntentKey;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  /** When true, no underlying template matches this intent. */
  comingSoon?: boolean;
};

const DEFAULT_INTENTS: ReadonlyArray<Omit<IntentCardEntry, "comingSoon">> = [
  {
    key: "newsletter",
    title: "Editorial Newsletter",
    subtitle: "Monthly update with multiple sections",
    icon: Newspaper,
  },
  {
    key: "showcase",
    title: "Seasonal Showcase",
    subtitle: "Image-led stories in a magazine-style layout",
    icon: Images,
  },
  {
    key: "sale",
    title: "Sale or promotion",
    subtitle: "Hero image, offer, and a big call to action",
    icon: Tag,
  },
  {
    key: "new-arrivals",
    title: "New arrivals",
    subtitle: "Show off new plants or products",
    icon: Sprout,
  },
  {
    key: "event",
    title: "Event invite",
    subtitle: "Workshop, class, or in-store event",
    icon: Calendar,
  },
  {
    key: "thank-you",
    title: "Thank you",
    subtitle: "A personal note to loyal customers",
    icon: Heart,
  },
  {
    key: "blank",
    title: "Blank canvas",
    subtitle: "Start from scratch in the editor",
    icon: FilePlus,
  },
];

function buildIntentEntries(
  isIntentAvailable: (key: CampaignIntentKey) => boolean,
): IntentCardEntry[] {
  return DEFAULT_INTENTS.map((entry) => ({
    ...entry,
    comingSoon: !isIntentAvailable(entry.key),
  }));
}

const cardBaseSx = {
  position: "relative",
  display: "flex",
  flexDirection: "column",
  gap: 1,
  p: 1.75,
  borderRadius: "var(--joy-radius-lg)",
  border: "1px solid",
  borderColor: "neutral.200",
  backgroundColor: "background.surface",
  textAlign: "left",
  cursor: "pointer",
  transition:
    "transform 150ms ease, box-shadow 150ms ease, border-color 150ms ease, background-color 150ms ease",
  "&:focus-visible": { outline: "2px solid", outlineColor: "primary.500", outlineOffset: 4 },
  "&:hover": {
    borderColor: "neutral.300",
    transform: "translateY(-1px)",
  },
} as const;

// Selected = a 2px primary ring drawn with box-shadow, so the card's size and
// position never change when it is selected.
const cardSelectedSx = {
  borderColor: "primary.solidBg",
  backgroundColor: "background.surface",
  boxShadow: "0 0 0 1px var(--joy-palette-primary-solidBg)",
} as const;

const selectedBadgeSx = {
  position: "absolute",
  top: 10,
  right: 10,
  width: 22,
  height: 22,
  borderRadius: "50%",
  bgcolor: "primary.solidBg",
  color: "primary.solidColor",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1,
} as const;

/** Each built-in design has its own icon and one-line description. */
const BUILT_IN_DESIGN_DETAILS: Record<string, { icon: LucideIcon; description: string }> = {
  "botanical-editorial": { icon: Flower2, description: "A welcoming invitation with a beautiful photographic opening" },
  "botanical-seasonal": { icon: Leaf, description: "Garden news, seasonal tips and featured highlights" },
  "botanical-product": { icon: ShoppingBag, description: "Showcase a plant or product with imagery and details" },
  "botanical-events": { icon: CalendarDays, description: "Bring upcoming workshops and events together" },
};

const cardDisabledSx = {
  cursor: "not-allowed",
  opacity: 0.5,
  "&:hover": {
    borderColor: "neutral.200",
    transform: "none",
  },
} as const;

const iconContainerSx = {
  width: 32,
  height: 32,
  borderRadius: "var(--joy-radius-md)",
  backgroundColor: "neutral.100",
  color: "neutral.700",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
} as const;

function formatRelativeFromNow(value: string) {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return "Saved";
  }
  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.round(diffMs / 60000);
  if (diffMinutes < 1) return "Saved just now";
  if (diffMinutes < 60) return `Saved ${diffMinutes} min ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24)
    return `Saved ${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7)
    return `Saved ${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  const diffWeeks = Math.round(diffDays / 7);
  if (diffWeeks < 5)
    return `Saved ${diffWeeks} week${diffWeeks === 1 ? "" : "s"} ago`;
  const date = new Date(timestamp);
  return `Saved ${date.toLocaleDateString()}`;
}

interface IntentCardProps {
  entry: IntentCardEntry;
  selected?: boolean;
  disabled?: boolean;
  onSelect: (key: CampaignIntentKey) => void;
}

function IntentCard({
  entry,
  selected = false,
  disabled = false,
  onSelect,
}: IntentCardProps) {
  const isInactive = disabled || entry.comingSoon;
  const Icon = entry.icon;
  const isBlank = entry.key === "blank";
  const template = React.useMemo(
    () => (isBlank ? null : getTemplateForIntent(entry.key)),
    [entry.key, isBlank],
  );

  return (
    <Box
      role="button"
      tabIndex={isInactive ? -1 : 0}
      aria-pressed={selected}
      aria-disabled={isInactive || undefined}
      data-testid={`intent-card-${entry.key}`}
      title={entry.comingSoon ? "Coming soon" : undefined}
      onClick={() => {
        if (isInactive) return;
        onSelect(entry.key);
      }}
      onKeyDown={(event) => {
        if (isInactive) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(entry.key);
        }
      }}
      sx={{
        ...cardBaseSx,
        ...(selected ? cardSelectedSx : {}),
        ...(isInactive ? cardDisabledSx : {}),
      }}
    >
      <IntentCardThumbnail
        intent={entry.key}
        template={template}
        variant={isBlank ? "blank" : "preview"}
        emptyLabel={entry.comingSoon ? "Coming soon" : null}
      />
      {selected ? (
        <Box sx={selectedBadgeSx} aria-hidden>
          <Check size={14} />
        </Box>
      ) : null}
      <Stack
        direction="row"
        spacing={1.25}
        alignItems="flex-start"
        sx={{ mt: 0.5 }}
      >
        <Box sx={iconContainerSx} aria-hidden>
          <Icon size={18} strokeWidth={1.8} />
        </Box>
        <Stack spacing={0.25} sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            level="title-sm"
            sx={{ fontSize: "17px", fontWeight: 600, color: "neutral.800" }}
          >
            {entry.title}
          </Typography>
          <Typography
            level="body-sm"
            sx={{ fontSize: "14px", color: "neutral.600" }}
          >
            {entry.subtitle}
          </Typography>
        </Stack>
      </Stack>
    </Box>
  );
}

interface SavedTemplateCardProps {
  template: SavedTemplate;
  selected?: boolean;
  disabled?: boolean;
  onApply: (template: SavedTemplate) => void;
  onRename: (template: SavedTemplate) => void;
  onArchive: (template: SavedTemplate) => void;
}

function SavedTemplateCard({
  template,
  selected = false,
  disabled = false,
  onApply,
  onRename,
  onArchive,
}: SavedTemplateCardProps) {
  const [menuAnchor, setMenuAnchor] = React.useState<HTMLElement | null>(null);
  const menuOpen = Boolean(menuAnchor);
  const blockCount = template.layout_json.length;
  const savedLabel = formatRelativeFromNow(
    template.updated_at || template.created_at,
  );

  return (
    <Box
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-pressed={selected}
      aria-disabled={disabled || undefined}
      data-testid={`saved-template-card-${template.id}`}
      onClick={() => {
        if (disabled) return;
        onApply(template);
      }}
      onKeyDown={(event) => {
        if (disabled) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onApply(template);
        }
      }}
      sx={{
        ...cardBaseSx,
        ...(selected ? cardSelectedSx : {}),
        ...(disabled ? cardDisabledSx : {}),
      }}
    >
      <IntentCardThumbnail template={null} blocks={template.layout_json} />
      <Stack
        direction="row"
        spacing={1}
        alignItems="flex-start"
        justifyContent="space-between"
      >
        <Typography
          level="title-sm"
          sx={{
            fontSize: "15px",
            fontWeight: 500,
            color: "neutral.800",
            display: "-webkit-box",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: 2,
            overflow: "hidden",
          }}
        >
          {template.name}
        </Typography>
        {/* Teammates' templates can be used but not renamed or archived. */}
        {template.isOwn ? (
        <IconButton
          variant="plain"
          color="neutral"
          size="sm"
          aria-label={`Manage ${template.name}`}
          onClick={(event) => {
            event.stopPropagation();
            setMenuAnchor(event.currentTarget);
          }}
          sx={{ "--IconButton-size": "28px" }}
        >
          <MoreHorizontal size={16} />
        </IconButton>
        ) : null}
      </Stack>
      <Typography
        level="body-xs"
        sx={{ fontSize: "12px", color: "neutral.500" }}
      >
        {blockCount} block{blockCount === 1 ? "" : "s"}
      </Typography>
      <Typography
        level="body-xs"
        sx={{ fontSize: "11px", color: "neutral.500" }}
      >
        {template.isOwn ? savedLabel : `${savedLabel} · From a teammate`}
      </Typography>

      <Menu
        anchorEl={menuAnchor}
        open={menuOpen}
        onClose={() => setMenuAnchor(null)}
        placement="bottom-end"
      >
        <MenuItem
          onClick={(event) => {
            event.stopPropagation();
            setMenuAnchor(null);
            onRename(template);
          }}
        >
          Rename
        </MenuItem>
        <MenuItem
          onClick={(event) => {
            event.stopPropagation();
            setMenuAnchor(null);
            onArchive(template);
          }}
        >
          Archive
        </MenuItem>
      </Menu>
    </Box>
  );
}

export interface IntentPickerProps {
  savedTemplates: SavedTemplate[];
  selectedIntent?: CampaignIntentKey | null;
  selectedSavedTemplateId?: string | null;
  disabled?: boolean;
  /** Intent keys that have no matching template — rendered as Coming soon. */
  unavailableIntents?: ReadonlySet<CampaignIntentKey>;
  onSelectIntent: (key: CampaignIntentKey) => void;
  onApplyBuiltInTemplate?: (template: CampaignTemplate) => void;
  onApplySavedTemplate: (template: SavedTemplate) => void;
  onRenameSavedTemplate: (template: SavedTemplate) => void;
  onArchiveSavedTemplate: (template: SavedTemplate) => void;
  onOpenManage: () => void;
  /** This week's theme for the "start from our theme" card; null hides it. */
  weeklyTheme?: WeeklyThemeStartOption | null;
  weeklyThemeLoading?: boolean;
  weeklyThemeSelected?: boolean;
  onStartFromTheme?: () => void;
  /** Built-in design last applied, shown as selected. */
  selectedBuiltInTemplateId?: string | null;
  /** True when the email already has content. Scratch then offers "start over". */
  hasContent?: boolean;
}

/** The four ways to start an email. */
export type StartMode = "scratch" | "preset" | "template" | "theme";

const START_MODES: ReadonlyArray<{ mode: StartMode; title: string; description: string; icon: LucideIcon }> = [
  { mode: "scratch", title: "Start from scratch", description: "A clean newsletter you fill in yourself.", icon: FilePlus },
  { mode: "preset", title: "Pick a preset", description: "A ready-made layout designed by BloomSuite.", icon: Newspaper },
  { mode: "template", title: "Choose a template", description: "A design your own business has saved.", icon: Images },
  { mode: "theme", title: "Choose a theme", description: "Seasonal garden centre content, written for you.", icon: Sun },
];

export function IntentPicker({
  savedTemplates,
  selectedIntent = null,
  selectedSavedTemplateId = null,
  disabled = false,
  unavailableIntents,
  onSelectIntent,
  onApplyBuiltInTemplate,
  onApplySavedTemplate,
  onRenameSavedTemplate,
  onArchiveSavedTemplate,
  onOpenManage,
  weeklyTheme = null,
  weeklyThemeLoading = false,
  weeklyThemeSelected = false,
  onStartFromTheme,
  selectedBuiltInTemplateId = null,
  hasContent = false,
}: IntentPickerProps) {
  const designSystem = useOptionalDesignSystem()?.designSystem ?? null;
  const intentEntries = React.useMemo(
    () => buildIntentEntries((key) => !(unavailableIntents?.has(key) ?? false)),
    [unavailableIntents],
  );

  const hasSavedTemplates = savedTemplates.length > 0;
  const themeAvailable = Boolean(onStartFromTheme && (weeklyTheme || weeklyThemeLoading));
  // Open on whatever this email already uses. A new email opens on scratch.
  const appliedMode: StartMode = weeklyThemeSelected
    ? "theme"
    : selectedSavedTemplateId
      ? "template"
      : (selectedIntent && selectedIntent !== "blank") || selectedBuiltInTemplateId
        ? "preset"
        : "scratch";
  const [mode, setMode] = React.useState<StartMode>(appliedMode);
  React.useEffect(() => {
    setMode(appliedMode);
  }, [appliedMode]);

  return (
    <Stack spacing={2.5} data-testid="intent-picker">
      <Stack spacing={0.5}>
        <Typography level="h2" sx={{ fontSize: 24, fontWeight: 700 }}>
          Choose a design
        </Typography>
        <Typography
          level="body-sm"
          sx={{ color: "neutral.600", maxWidth: 620 }}
        >
          Pick how you want to start. You can change every word, photo and colour in Design Studio.
        </Typography>
      </Stack>

      <Box
        role="radiogroup"
        aria-label="How do you want to start?"
        data-testid="intent-picker-start"
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" },
          gap: 1.5,
        }}
      >
        {START_MODES.map(({ mode: option, title, description, icon: Icon }) => {
          const chosen = mode === option;
          return (
            <Box
              key={option}
              role="radio"
              aria-checked={chosen}
              tabIndex={disabled ? -1 : 0}
              aria-disabled={disabled || undefined}
              data-testid={`start-mode-${option}`}
              onClick={() => {
                if (!disabled) setMode(option);
              }}
              onKeyDown={(event) => {
                if (!disabled && (event.key === "Enter" || event.key === " ")) {
                  event.preventDefault();
                  setMode(option);
                }
              }}
              sx={{
                ...cardBaseSx,
                gap: 0.75,
                minHeight: 108,
                ...(chosen ? cardSelectedSx : {}),
                ...(disabled ? cardDisabledSx : {}),
              }}
            >
              {chosen ? (
                <Box sx={selectedBadgeSx} aria-hidden>
                  <Check size={14} />
                </Box>
              ) : null}
              <Box sx={iconContainerSx} aria-hidden>
                <Icon size={18} strokeWidth={1.8} />
              </Box>
              <Typography level="title-sm" sx={{ fontSize: 16, fontWeight: 600, color: "neutral.800" }}>
                {title}
              </Typography>
              <Typography level="body-sm" sx={{ color: "neutral.600", fontSize: 13.5 }}>
                {description}
              </Typography>
            </Box>
          );
        })}
      </Box>

      {mode === "scratch" ? (
        <Stack spacing={1} data-testid="start-panel-scratch" alignItems="flex-start">
          <Typography level="body-sm" sx={{ color: "neutral.700", maxWidth: 620 }}>
            {hasContent && selectedIntent !== "blank"
              ? "This email already has a design. Keep it and open Design Studio below, or start over with a blank newsletter."
              : "You get a header and an empty paragraph, ready for your own words. Open Design Studio below to begin."}
          </Typography>
          {hasContent && selectedIntent !== "blank" ? (
            <JoyButton
              variant="outlined"
              color="neutral"
              size="sm"
              disabled={disabled}
              data-testid="intent-card-blank"
              onClick={() => onSelectIntent("blank")}
            >
              Start over with a blank newsletter
            </JoyButton>
          ) : null}
        </Stack>
      ) : null}

      {mode === "theme" ? (
        <Stack spacing={1} data-testid="start-panel-theme">
          {themeAvailable && onStartFromTheme ? (
            <Box sx={{ maxWidth: 560 }}>
              <StartCard
                testId="intent-start-weekly-theme"
                icon={Sun}
                eyebrow={weeklyTheme ? `This week's theme · ${weeklyTheme.weekLabel}` : "This week's theme"}
                title={weeklyTheme?.title ?? "Loading this week's theme…"}
                description={
                  weeklyTheme?.summary ||
                  "Start from this week's theme, copy and photos. Edit anything in Design Studio."
                }
                imageUrl={weeklyTheme?.imageUrl}
                selected={weeklyThemeSelected}
                disabled={disabled}
                loading={weeklyThemeLoading && !weeklyTheme}
                onSelect={onStartFromTheme}
              />
            </Box>
          ) : (
            <Typography level="body-sm" sx={{ color: "neutral.700" }}>
              There is no theme for this week yet. Pick a preset, or start from scratch.
            </Typography>
          )}
        </Stack>
      ) : null}

      {mode === "template" && !hasSavedTemplates ? (
        <Typography level="body-sm" sx={{ color: "neutral.700", maxWidth: 620 }} data-testid="start-panel-template-empty">
          Your business has no saved designs yet. Build an email in Design Studio, then choose Save as template to reuse it here.
        </Typography>
      ) : null}

      {mode === "template" && hasSavedTemplates ? (
        <Stack spacing={1.5} data-testid="intent-picker-my-templates">
          <Stack
            direction="row"
            spacing={1}
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography
              level="title-sm"
              sx={{ fontWeight: 500, color: "neutral.800" }}
            >
              Your saved designs
            </Typography>
            <JoyButton
              variant="plain"
              color="neutral"
              size="sm"
              onClick={onOpenManage}
              disabled={disabled}
              data-testid="intent-picker-manage-link"
            >
              Manage
            </JoyButton>
          </Stack>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(2, minmax(0, 1fr))",
                lg: "repeat(3, minmax(0, 1fr))",
              },
              gap: 1.5,
            }}
          >
            {savedTemplates.map((template) => (
              <SavedTemplateCard
                key={template.id}
                template={template}
                selected={template.id === selectedSavedTemplateId}
                disabled={disabled}
                onApply={onApplySavedTemplate}
                onRename={onRenameSavedTemplate}
                onArchive={onArchiveSavedTemplate}
              />
            ))}
          </Box>
        </Stack>
      ) : null}

      {mode === "preset" ? (
      <Box
        data-testid="campaign-design-gallery"
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" },
          gap: 1.5,
        }}
      >
        {intentEntries.filter((entry) => ["newsletter", "sale", "event"].includes(entry.key)).map((entry) => (
          <IntentCard key={entry.key} entry={entry} selected={entry.key === selectedIntent} disabled={disabled} onSelect={onSelectIntent} />
        ))}
        {onApplyBuiltInTemplate ? (() => {
          // The four botanical designs share one layout and differ only in
          // their opening line, so they are one card with a tone choice
          // instead of four near-identical cards.
          const botanical = CAMPAIGN_TEMPLATES.filter((template) => template.id.startsWith("botanical-"));
          if (botanical.length === 0) return null;
          const selected = botanical.some((template) => template.id === selectedBuiltInTemplateId);
          const preview = botanical.find((template) => template.id === selectedBuiltInTemplateId) ?? botanical[0];
          return (
            <Box
              key="botanical"
              data-testid="botanical-design-card"
              aria-disabled={disabled || undefined}
              sx={{ ...cardBaseSx, cursor: "default", ...(selected ? cardSelectedSx : {}), ...(disabled ? cardDisabledSx : {}) }}
            >
              {selected ? (
                <Box sx={selectedBadgeSx} aria-hidden>
                  <Check size={14} />
                </Box>
              ) : null}
              <IntentCardThumbnail template={null} blocks={preview.buildBlocks(designSystem)} />
              <Stack direction="row" spacing={1.25} alignItems="flex-start" sx={{ mt: 0.5, minWidth: 0 }}>
                <Box sx={iconContainerSx} aria-hidden>
                  <Flower2 size={18} strokeWidth={1.8} />
                </Box>
                <Stack spacing={0.25} sx={{ minWidth: 0, flex: 1 }}>
                  <Typography level="title-sm" sx={{ color: "neutral.800", fontSize: 17, fontWeight: 600 }}>
                    Botanical editorial
                  </Typography>
                  <Typography level="body-sm" sx={{ color: "neutral.600", fontSize: 14 }}>
                    An elegant photographic layout. Pick how it opens:
                  </Typography>
                </Stack>
              </Stack>
              <Stack direction="row" useFlexGap flexWrap="wrap" gap={0.75}>
                {botanical.map((template) => {
                  const details = BUILT_IN_DESIGN_DETAILS[template.id];
                  const Icon = details?.icon ?? Newspaper;
                  const chipSelected = template.id === selectedBuiltInTemplateId;
                  return (
                    <JoyButton
                      key={template.id}
                      size="sm"
                      variant="outlined"
                      color="neutral"
                      aria-label={`Use ${template.name}`}
                      aria-pressed={chipSelected}
                      title={details?.description}
                      data-testid={`botanical-template-${template.id}`}
                      disabled={disabled}
                      startDecorator={<Icon size={14} aria-hidden />}
                      onClick={() => onApplyBuiltInTemplate(template)}
                      // Always outlined (same border), so selecting never changes size.
                      sx={{
                        minHeight: 30,
                        ...(chipSelected
                          ? {
                              bgcolor: "primary.solidBg",
                              borderColor: "primary.solidBg",
                              color: "primary.solidColor",
                              "&:hover": { bgcolor: "primary.solidHoverBg" },
                            }
                          : {}),
                      }}
                    >
                      {template.name}
                    </JoyButton>
                  );
                })}
              </Stack>
            </Box>
          );
        })() : null}
        {intentEntries.filter((entry) => ["showcase", "new-arrivals", "thank-you"].includes(entry.key)).map((entry) => (
          <IntentCard key={entry.key} entry={entry} selected={entry.key === selectedIntent} disabled={disabled} onSelect={onSelectIntent} />
        ))}
      </Box>
      ) : null}
    </Stack>
  );
}
