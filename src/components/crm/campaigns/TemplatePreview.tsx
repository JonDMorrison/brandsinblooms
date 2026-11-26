import * as React from "react";
import Box from "@mui/joy/Box";
import { renderDraftPreviewHtml } from "@/lib/crm/campaignDraftPersistence";
import type { StudioBlock } from "@/types/studioBlocks";

const EMAIL_WIDTH = 640;

/**
 * A small picture of a saved design, drawn by the same renderer that builds
 * the email itself, so the preview cannot drift from what would be sent.
 *
 * The frame is sandboxed with no permissions: no scripts, no forms, no
 * navigation. It is not interactive and loads only when scrolled near, which
 * keeps a library of 50 or more designs quick.
 */
export function TemplatePreview({
  blocks,
  name,
  height = 260,
}: {
  blocks: StudioBlock[];
  name: string;
  height?: number;
}) {
  const frameRef = React.useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = React.useState(0.5);
  const html = React.useMemo(() => {
    try {
      return renderDraftPreviewHtml(blocks, name);
    } catch {
      return "";
    }
  }, [blocks, name]);

  React.useLayoutEffect(() => {
    const node = frameRef.current;
    if (!node) return;
    const measure = () => {
      const width = node.clientWidth;
      if (width > 0) setScale(Math.min(1, width / EMAIL_WIDTH));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Box
      ref={frameRef}
      data-testid="template-preview"
      sx={{
        position: "relative",
        height,
        overflow: "hidden",
        borderRadius: "md",
        border: "1px solid",
        borderColor: "neutral.200",
        bgcolor: "#f0f3f2",
      }}
    >
      {html ? (
        <iframe
          title={`Preview of ${name}`}
          sandbox=""
          loading="lazy"
          tabIndex={-1}
          srcDoc={html}
          scrolling="no"
          style={{
            width: EMAIL_WIDTH,
            height: Math.ceil(height / scale),
            border: 0,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            pointerEvents: "none",
            background: "#ffffff",
          }}
        />
      ) : (
        <Box sx={{ height: "100%", display: "grid", placeItems: "center", color: "neutral.600", fontSize: 13 }}>
          This design is empty
        </Box>
      )}
    </Box>
  );
}
