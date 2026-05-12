import * as React from "react";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Card from "@mui/joy/Card";
import Chip from "@mui/joy/Chip";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Tab from "@mui/joy/Tab";
import TabList from "@mui/joy/TabList";
import Tabs from "@mui/joy/Tabs";
import Typography from "@mui/joy/Typography";
import {
  CAMPAIGN_TEMPLATES,
  templateMatchesFilter,
  type CampaignTemplate,
  type CampaignTemplateFilter,
} from "@/lib/studio/campaignTemplates";
import { TemplateThumbnail } from "./TemplateThumbnail";

const TEMPLATE_CARD_WIDTH = { xs: 152, sm: 168 } as const;
const THUMBNAIL_HEIGHT = 120;
const FADE_WIDTH = 44;

const TEMPLATE_CATEGORIES: Array<{
  value: CampaignTemplateFilter;
  label: string;
}> = [
  { value: "all", label: "All" },
  { value: "newsletter", label: "Newsletter" },
  { value: "promo", label: "Promo" },
];

function LoadingTemplateCard() {
  return (
    <Card
      variant="outlined"
      sx={{
        minWidth: TEMPLATE_CARD_WIDTH,
        width: TEMPLATE_CARD_WIDTH,
        borderRadius: "xl",
        p: 1.5,
        gap: 1,
        scrollSnapAlign: "start",
      }}
    >
      <Skeleton
        variant="rectangular"
        sx={{ height: THUMBNAIL_HEIGHT, borderRadius: "lg" }}
      />
      <Skeleton variant="text" width="72%" />
      <Skeleton variant="text" width="90%" />
      <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
        <Skeleton variant="rounded" width={58} height={20} />
        <Skeleton variant="rounded" width={72} height={20} />
      </Stack>
    </Card>
  );
}

export function SeasonalTemplatesRow({
  selectedSeason,
  onSeasonChange,
  onApply,
  loading = false,
  disabled = false,
}: {
  selectedSeason: CampaignTemplateFilter;
  onSeasonChange: (season: CampaignTemplateFilter) => void;
  onApply: (template: CampaignTemplate) => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const railRef = React.useRef<HTMLDivElement | null>(null);
  const dragStateRef = React.useRef<{
    pointerId: number;
    startX: number;
    scrollLeft: number;
  } | null>(null);
  const [showLeftFade, setShowLeftFade] = React.useState(false);
  const [showRightFade, setShowRightFade] = React.useState(false);
  const [isDraggingRail, setIsDraggingRail] = React.useState(false);
  const visibleTemplates = CAMPAIGN_TEMPLATES.filter((template) =>
    templateMatchesFilter(template, selectedSeason),
  );

  const updateRailState = React.useCallback(() => {
    const rail = railRef.current;
    if (!rail) {
      return;
    }

    const remainingScroll =
      rail.scrollWidth - rail.clientWidth - rail.scrollLeft;
    setShowLeftFade(rail.scrollLeft > 6);
    setShowRightFade(remainingScroll > 6);
  }, []);

  React.useEffect(() => {
    updateRailState();

    const rail = railRef.current;
    if (!rail) {
      return;
    }

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateRailState);
      return () => window.removeEventListener("resize", updateRailState);
    }

    const observer = new ResizeObserver(() => updateRailState());
    observer.observe(rail);

    return () => observer.disconnect();
  }, [loading, selectedSeason, updateRailState, visibleTemplates.length]);

  const releaseRailDrag = React.useCallback(
    (pointerId?: number) => {
      const rail = railRef.current;
      const dragState = dragStateRef.current;
      if (
        !dragState ||
        (pointerId !== undefined && dragState.pointerId !== pointerId)
      ) {
        return;
      }

      if (rail?.hasPointerCapture?.(dragState.pointerId)) {
        rail.releasePointerCapture(dragState.pointerId);
      }

      dragStateRef.current = null;
      setIsDraggingRail(false);
      updateRailState();
    },
    [updateRailState],
  );

  const handlePointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.pointerType === "touch" || event.button !== 0) {
        return;
      }

      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          "button, [role='button'], a, input, textarea, select, [role='tab']",
        )
      ) {
        return;
      }

      const rail = railRef.current;
      if (!rail) {
        return;
      }

      dragStateRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        scrollLeft: rail.scrollLeft,
      };
      rail.setPointerCapture(event.pointerId);
      setIsDraggingRail(true);
    },
    [],
  );

  const handlePointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const rail = railRef.current;
      const dragState = dragStateRef.current;
      if (!rail || !dragState || dragState.pointerId !== event.pointerId) {
        return;
      }

      event.preventDefault();
      rail.scrollLeft =
        dragState.scrollLeft - (event.clientX - dragState.startX);
      updateRailState();
    },
    [updateRailState],
  );

  return (
    <Stack spacing={2.25}>
      <Stack spacing={0.5}>
        <Typography level="title-md">Templates</Typography>
        <Typography
          level="body-sm"
          sx={{ color: "neutral.600", maxWidth: 720 }}
        >
          Each template writes real Studio blocks into this campaign, so the
          live preview, Campaign Studio, and send-time renderer stay aligned.
        </Typography>
      </Stack>

      <Tabs
        value={selectedSeason}
        onChange={(_, value) => {
          if (typeof value === "string") {
            onSeasonChange(value as CampaignTemplateFilter);
          }
        }}
      >
        <TabList
          sx={{
            borderRadius: "xl",
            p: 0.5,
            gap: 0.5,
            alignSelf: "flex-start",
            maxWidth: "100%",
            overflowX: "auto",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            "&::-webkit-scrollbar": { display: "none" },
          }}
        >
          {TEMPLATE_CATEGORIES.map((category) => (
            <Tab key={category.value} value={category.value} disableIndicator>
              {category.label}
            </Tab>
          ))}
        </TabList>
      </Tabs>

      <Box sx={{ position: "relative" }}>
        {showLeftFade ? (
          <Box
            sx={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: 0,
              width: FADE_WIDTH,
              zIndex: 2,
              pointerEvents: "none",
              background:
                "linear-gradient(90deg, rgba(255,255,255,0.96) 0%, rgba(255,255,255,0) 100%)",
            }}
          />
        ) : null}
        {showRightFade ? (
          <Box
            sx={{
              position: "absolute",
              top: 0,
              bottom: 0,
              right: 0,
              width: FADE_WIDTH,
              zIndex: 2,
              pointerEvents: "none",
              background:
                "linear-gradient(270deg, rgba(255,255,255,0.96) 0%, rgba(255,255,255,0) 100%)",
            }}
          />
        ) : null}

        <Box
          ref={railRef}
          onScroll={updateRailState}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={(event) => releaseRailDrag(event.pointerId)}
          onPointerCancel={(event) => releaseRailDrag(event.pointerId)}
          sx={{
            display: "grid",
            gridAutoFlow: "column",
            gridAutoColumns: { xs: "152px", sm: "168px" },
            gap: 1.5,
            overflowX: "auto",
            scrollSnapType: "x proximity",
            pb: 0.5,
            pr: 0.5,
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            cursor: isDraggingRail ? "grabbing" : "grab",
            userSelect: isDraggingRail ? "none" : "auto",
            touchAction: "pan-x",
            "&::-webkit-scrollbar": { display: "none" },
          }}
        >
          {loading
            ? Array.from({ length: 6 }, (_, index) => (
                <LoadingTemplateCard key={`template-skeleton-${index}`} />
              ))
            : visibleTemplates.map((template) => (
                <Card
                  key={template.id}
                  variant="outlined"
                  sx={{
                    // Visual refresh: white body + 4px colored top-bar
                    // (rendered as ::before below). Season is now
                    // communicated by the bar alone — card body, chips,
                    // and the inner thumbnail wireframe are all neutral.
                    position: "relative",
                    minWidth: TEMPLATE_CARD_WIDTH,
                    width: TEMPLATE_CARD_WIDTH,
                    borderRadius: "xl",
                    pt: "calc(0.25rem + 4px)", // 4px top-bar + the existing 12px (1.5) padding
                    pb: 1.5,
                    pl: 1.5,
                    pr: 1.5,
                    gap: 1.1,
                    scrollSnapAlign: "start",
                    backgroundColor: "#ffffff",
                    overflow: "hidden", // clip the colored bar to the card's border-radius
                    transition: "transform 160ms ease, box-shadow 160ms ease",
                    "&::before": {
                      content: '""',
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      height: 4,
                      backgroundColor: template.accentColor,
                      zIndex: 1,
                    },
                    "&:hover": {
                      transform: "translateY(-2px)",
                      boxShadow: "md",
                    },
                    "&:hover .template-overlay, &:focus-within .template-overlay":
                      {
                        opacity: 1,
                        transform: "translateY(0)",
                      },
                  }}
                >
                  <Chip
                    size="sm"
                    variant="soft"
                    color="neutral"
                    sx={{
                      position: "absolute",
                      top: 16,
                      right: 12,
                      zIndex: 2,
                      textTransform: "capitalize",
                      fontWeight: 600,
                    }}
                  >
                    {template.season}
                  </Chip>

                  <TemplateThumbnail
                    blocks={template.thumbnailBlocks}
                    accentColor={template.accentColor}
                  />

                  <Stack spacing={0.4} sx={{ minHeight: 64 }}>
                    <Typography level="title-sm" sx={{ lineHeight: 1.15 }}>
                      {template.name}
                    </Typography>
                    <Typography
                      level="body-xs"
                      sx={{
                        color: "neutral.600",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {template.summary}
                    </Typography>
                  </Stack>

                  <Stack
                    direction="row"
                    spacing={0.75}
                    useFlexGap
                    flexWrap="wrap"
                  >
                    {template.tags.slice(0, 2).map((tag) => (
                      <Chip
                        key={`${template.id}-${tag}`}
                        size="sm"
                        variant="soft"
                        color="neutral"
                      >
                        {tag}
                      </Chip>
                    ))}
                  </Stack>

                  <Box
                    className="template-overlay"
                    sx={{
                      position: "absolute",
                      inset: 0,
                      p: 1.5,
                      display: "flex",
                      alignItems: "flex-end",
                      justifyContent: "stretch",
                      borderRadius: "inherit",
                      background:
                        "linear-gradient(180deg, rgba(255,255,255,0) 42%, rgba(250,250,250,0.97) 100%)",
                      opacity: { xs: 1, md: 0 },
                      transform: "translateY(8px)",
                      transition: "opacity 160ms ease, transform 160ms ease",
                      "@media (hover: none)": {
                        opacity: 1,
                        transform: "translateY(0)",
                      },
                    }}
                  >
                    <Button
                      size="sm"
                      fullWidth
                      variant="solid"
                      color="neutral"
                      disabled={disabled}
                      onClick={() => onApply(template)}
                    >
                      Use Template
                    </Button>
                  </Box>
                </Card>
              ))}
        </Box>
      </Box>
    </Stack>
  );
}
