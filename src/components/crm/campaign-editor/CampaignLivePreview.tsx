import * as React from "react";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Monitor, Moon, Smartphone } from "lucide-react";
import type { StudioDesignSystem } from "@/lib/studio/designSystem";
import type { StudioBlock } from "@/types/studioBlocks";
import { buildCampaignPreviewHtml } from "@/lib/crm/campaignPreviewHtml";
import {
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
  width = 168,
  height = 210,
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
        borderRadius: "lg",
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

function ToggleButton({
  pressed,
  onClick,
  icon,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Button
      aria-pressed={pressed}
      onClick={onClick}
      color={pressed ? "primary" : "neutral"}
      variant={pressed ? "solid" : "outlined"}
      startDecorator={icon}
      sx={{
        minHeight: 44,
        px: 1.5,
        "--Button-gap": "6px",
        fontSize: "md",
        fontWeight: "lg",
        "&:focus-visible": { outline: campaignEditorFocusOutline, outlineOffset: 2 },
      }}
    >
      {children}
    </Button>
  );
}

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
  const scale = containerWidth > 0 ? Math.min(1, containerWidth / frameWidth) : 1;

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
      sx={{ ...campaignEditorCardSx, p: { xs: 1.5, sm: 2 }, display: "flex", flexDirection: "column", gap: 1.5, minHeight: 0 }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} useFlexGap flexWrap="wrap">
        <Typography component="h2" level="title-md" sx={{ fontWeight: "xl", color: "text.primary" }}>
          Live preview
        </Typography>
        <Stack direction="row" spacing={0.75} role="group" aria-label="Preview view">
          <ToggleButton
            pressed={device === "mobile"}
            onClick={() => setDevice("mobile")}
            icon={<Smartphone size={16} aria-hidden />}
          >
            Mobile
          </ToggleButton>
          <ToggleButton
            pressed={device === "desktop"}
            onClick={() => setDevice("desktop")}
            icon={<Monitor size={16} aria-hidden />}
          >
            Desktop
          </ToggleButton>
          <ToggleButton
            pressed={dark}
            onClick={() => setDark((current) => !current)}
            icon={<Moon size={16} aria-hidden />}
          >
            Dark
          </ToggleButton>
        </Stack>
      </Stack>
      <Typography level="body-sm" sx={{ color: "text.secondary" }}>
        Personalisation uses a sample customer.{dark ? " Dark shows roughly how dark-mode inboxes recolour this email." : ""}
      </Typography>
      <Box
        ref={containerRef}
        data-testid="campaign-live-preview-scroll"
        sx={{
          borderRadius: "lg",
          bgcolor: dark ? "neutral.800" : "background.level2",
          p: 0,
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
            sx={{
              width: frameWidth * scale,
              height: frameHeight * scale,
              mx: "auto",
              overflow: "hidden",
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
        ) : (
          <Stack alignItems="center" spacing={1} sx={{ py: 6, px: 3, textAlign: "center" }}>
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
