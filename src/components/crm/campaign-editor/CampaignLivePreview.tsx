import * as React from "react";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import ToggleButtonGroup from "@mui/joy/ToggleButtonGroup";
import Typography from "@mui/joy/Typography";
import { Monitor, Moon, Smartphone } from "lucide-react";
import type { StudioDesignSystem } from "@/lib/studio/designSystem";
import type { StudioBlock } from "@/types/studioBlocks";
import { buildCampaignPreviewHtml } from "@/lib/crm/campaignPreviewHtml";
import { JoySwitch } from "@/components/joy/JoySwitch";
import {
  campaignEditorCardPadding,
  campaignEditorCardSx,
  campaignEditorFocusOutline,
} from "@/components/crm/campaign-editor/campaignEditorTheme";

/** Width the email is laid out at before it is scaled into the frame. */
const DEVICE_WIDTH = { desktop: 640, mobile: 375 } as const;
const THUMBNAIL_WIDTH = 600;

/**
 * Approximates how a dark-mode inbox recolours an email that has no dark
 * styles of its own: colours are inverted, photos are inverted back.
 */
const DARK_MODE_STYLE =
  "<style data-preview-dark>html{background:white;filter:invert(1) hue-rotate(180deg);}img,video,[background],[style*='background-image']{filter:invert(1) hue-rotate(180deg);}</style>";

function withDarkMode(html: string) {
  return html.includes("</head>")
    ? html.replace("</head>", `${DARK_MODE_STYLE}</head>`)
    : `${DARK_MODE_STYLE}${html}`;
}

function useElementWidth<T extends HTMLElement>() {
  const ref = React.useRef<T | null>(null);
  const [width, setWidth] = React.useState(0);
  React.useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => setWidth(node.clientWidth);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/** A scaled, non-interactive render of the real email, for the design summary. */
export function CampaignEmailThumbnail({
  blocks,
  subjectLine,
  previewText,
  designSystem,
  width = 160,
  height = 200,
}: {
  blocks: StudioBlock[];
  subjectLine: string;
  previewText: string;
  designSystem: StudioDesignSystem;
  width?: number;
  height?: number;
}) {
  const html = React.useMemo(
    () => buildCampaignPreviewHtml({ blocks, subjectLine, previewText, designSystem }),
    [blocks, designSystem, previewText, subjectLine],
  );
  const scale = width / THUMBNAIL_WIDTH;
  return (
    <Box
      data-testid="campaign-design-thumbnail"
      aria-hidden
      sx={{
        width,
        height,
        flexShrink: 0,
        overflow: "hidden",
        borderRadius: "md",
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "background.surface",
        position: "relative",
      }}
    >
      <iframe
        title="Design thumbnail"
        sandbox=""
        tabIndex={-1}
        srcDoc={html}
        scrolling="no"
        style={{
          border: 0,
          width: THUMBNAIL_WIDTH,
          height: height / scale,
          transform: `scale(${scale})`,
          transformOrigin: "0 0",
          pointerEvents: "none",
          display: "block",
        }}
      />
    </Box>
  );
}

type PreviewDevice = keyof typeof DEVICE_WIDTH;

/**
 * Space the phone frame takes from the preview box: 16px of padding and an
 * 8px bezel on each side.
 */
const MOBILE_FRAME_CHROME = 2 * 16 + 2 * 8;

const segmentSx = {
  minHeight: 44,
  px: 3,
  "--Button-gap": "8px",
  fontSize: "md",
  fontWeight: "lg",
  "&:focus-visible": { outline: campaignEditorFocusOutline, outlineOffset: 2, zIndex: 1 },
} as const;

/**
 * The live preview column: the same renderer as the editor's email preview,
 * with mobile, desktop and dark-inbox views.
 */
export function CampaignLivePreview({
  blocks,
  subjectLine,
  previewText,
  designSystem,
  loading = false,
}: {
  blocks: StudioBlock[];
  subjectLine: string;
  previewText: string;
  designSystem: StudioDesignSystem;
  loading?: boolean;
}) {
  const [device, setDevice] = React.useState<PreviewDevice>("desktop");
  const [dark, setDark] = React.useState(false);
  const [frameHeight, setFrameHeight] = React.useState(900);
  const [containerRef, containerWidth] = useElementWidth<HTMLDivElement>();
  const observerRef = React.useRef<ResizeObserver | null>(null);
  React.useEffect(() => () => observerRef.current?.disconnect(), []);

  const hasContent = blocks.some(
    (block) => block.type !== "footer" && block.visible !== false,
  );
  const html = React.useMemo(() => {
    const base = buildCampaignPreviewHtml({ blocks, subjectLine, previewText, designSystem });
    return dark ? withDarkMode(base) : base;
  }, [blocks, dark, designSystem, previewText, subjectLine]);

  const frameWidth = DEVICE_WIDTH[device];
  const mobile = device === "mobile";
  const availableWidth = containerWidth - (mobile ? MOBILE_FRAME_CHROME : 0);
  const scale = availableWidth > 0 ? Math.min(1, availableWidth / frameWidth) : 1;

  // The preview box is one scroll container kept across views, so without a
  // reset its scroll position carries over: switching Mobile, Desktop or Dark,
  // the email arriving after the skeleton, or a new design left the email
  // part-way down and the first block out of sight. Each of those starts at
  // the top. The email is rendered fresh after Dark or the design changes and
  // when content first arrives, so the iframe's own document is also reset
  // once it has loaded. Subject and preview-text edits re-render the email
  // too, but keep the reader's place.
  const resetOnNextLoadRef = React.useRef(true);
  const showEmail = !loading && hasContent;
  const designKey = React.useMemo(() => JSON.stringify(blocks), [blocks]);
  React.useLayoutEffect(() => {
    resetOnNextLoadRef.current = true;
  }, [dark, showEmail, designKey]);
  React.useLayoutEffect(() => {
    if (containerRef.current) containerRef.current.scrollTop = 0;
  }, [containerRef, dark, device, showEmail, designKey]);

  const handleLoad = (event: React.SyntheticEvent<HTMLIFrameElement>) => {
    observerRef.current?.disconnect();
    const doc = event.currentTarget.contentDocument;
    if (!doc?.body) return;
    if (resetOnNextLoadRef.current) {
      resetOnNextLoadRef.current = false;
      doc.scrollingElement?.scrollTo(0, 0);
      if (containerRef.current) containerRef.current.scrollTop = 0;
    }
    const measure = () => setFrameHeight(Math.max(400, doc.body.scrollHeight + 16));
    measure();
    doc.addEventListener("click", (clickEvent) => clickEvent.preventDefault());
    if (typeof ResizeObserver !== "undefined") {
      observerRef.current = new ResizeObserver(measure);
      observerRef.current.observe(doc.body);
    }
  };

  return (
    <Box
      component="aside"
      aria-label="Live preview"
      data-testid="campaign-live-preview"
      sx={{
        ...campaignEditorCardSx,
        p: campaignEditorCardPadding,
        display: "flex",
        flexDirection: "column",
        gap: 4,
        minHeight: 0,
        minWidth: 0,
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        useFlexGap
        flexWrap="wrap"
        data-testid="campaign-live-preview-header"
        sx={{ columnGap: 4, rowGap: 2 }}
      >
        <Typography component="h2" level="title-lg" sx={{ fontWeight: "xl", color: "text.primary" }}>
          Live preview
        </Typography>
        <Stack direction="row" alignItems="center" useFlexGap flexWrap="wrap" sx={{ columnGap: 4, rowGap: 2 }}>
          {/* The device is one choice of two: a segmented control. */}
          <ToggleButtonGroup
            aria-label="Preview device"
            data-testid="campaign-live-preview-device"
            value={device}
            onChange={(_event, next) => {
              if (next === "mobile" || next === "desktop") setDevice(next);
            }}
            variant="outlined"
            color="neutral"
            sx={{ "--ButtonGroup-radius": "var(--joy-radius-lg)" }}
          >
            <Button
              value="mobile"
              startDecorator={<Smartphone size={16} aria-hidden />}
              sx={segmentSx}
            >
              Mobile
            </Button>
            <Button
              value="desktop"
              startDecorator={<Monitor size={16} aria-hidden />}
              sx={segmentSx}
            >
              Desktop
            </Button>
          </ToggleButtonGroup>
          {/* Dark changes either device, so it is a separate switch. */}
          <Box
            component="label"
            data-testid="campaign-live-preview-dark"
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 2,
              minHeight: 44,
              cursor: "pointer",
              typography: "body-md",
              fontWeight: "lg",
              color: "text.primary",
            }}
          >
            <Moon size={16} aria-hidden />
            Dark
            <JoySwitch checked={dark} onCheckedChange={setDark} />
          </Box>
        </Stack>
      </Stack>
      <Typography level="body-sm" sx={{ color: "text.tertiary" }}>
        Personalisation uses a sample customer.{dark ? " Dark shows roughly how dark-mode inboxes recolour this email." : ""}
      </Typography>
      <Box
        ref={containerRef}
        data-testid="campaign-live-preview-scroll"
        sx={{
          borderRadius: "lg",
          bgcolor: dark ? "neutral.800" : "background.level2",
          p: mobile ? 4 : 0,
          overflowY: "auto",
          overflowX: "hidden",
          maxHeight: 640,
          "@media (min-width: 1100px)": {
            maxHeight: "calc(100vh - var(--campaign-editor-header-height, 120px) - 140px)",
          },
        }}
      >
        {loading ? (
          <Skeleton variant="rectangular" sx={{ height: 480 }} />
        ) : hasContent ? (
          <Box
            data-testid="campaign-live-preview-frame"
            data-device={device}
            sx={
              mobile
                ? {
                    // A phone: an 8px bezel with a speaker slot above the screen.
                    width: "fit-content",
                    maxWidth: "100%",
                    mx: "auto",
                    border: "8px solid",
                    borderTopWidth: 0,
                    borderColor: "neutral.800",
                    borderRadius: "2xl",
                    bgcolor: "neutral.800",
                    overflow: "hidden",
                  }
                : { width: "100%" }
            }
          >
            {mobile ? (
              <Box aria-hidden sx={{ height: 24, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Box sx={{ width: 56, height: 4, borderRadius: "xl", bgcolor: "neutral.600" }} />
              </Box>
            ) : null}
            <Box
              sx={{
                width: frameWidth * scale,
                height: frameHeight * scale,
                mx: "auto",
                overflow: "hidden",
                borderRadius: mobile ? "md" : 0,
              }}
            >
              <iframe
                title="Campaign live preview"
                sandbox="allow-same-origin"
                srcDoc={html}
                scrolling="no"
                onLoad={handleLoad}
                style={{
                  display: "block",
                  border: 0,
                  width: frameWidth,
                  height: frameHeight,
                  transform: `scale(${scale})`,
                  transformOrigin: "0 0",
                  background: "var(--joy-palette-background-surface)",
                }}
              />
            </Box>
          </Box>
        ) : (
          <Stack alignItems="center" spacing={2} sx={{ py: 12, px: 6, textAlign: "center" }}>
            <Typography
              level="title-md"
              sx={{ fontWeight: "xl", color: dark ? "common.white" : "text.primary" }}
            >
              Nothing to preview yet
            </Typography>
            <Typography level="body-sm" sx={{ color: dark ? "neutral.200" : "text.secondary" }}>
              Choose a design in step 1 and your email appears here.
            </Typography>
          </Stack>
        )}
      </Box>
    </Box>
  );
}
