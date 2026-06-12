/**
 * Wireframe thumbnail for an IntentCard.
 *
 * Renders a small visual preview of what the matching template's email layout
 * looks like — headers, hero, sections, CTAs — using the `thumbnailBlocks`
 * descriptor already attached to every CAMPAIGN_TEMPLATES entry. Tinted with
 * the template's accent colour so different intents read visibly different at
 * a glance.
 *
 * This is the "show, don't tell" pass on the campaign creation entry point.
 * Customers stop reading "Newsletter — Monthly update with multiple sections"
 * and start seeing the shape of the email they'll get.
 *
 * Why a wireframe instead of a scaled iframe of the real HTML?
 *   - Performance: rendering 8 iframes on the campaign creation surface is a
 *     measurable cost; wireframes are pure DOM.
 *   - Safety: the email HTML compiler was just stabilised in #67; a scaled
 *     iframe pulls that pipeline onto a hot path it wasn't designed for.
 *   - Brand: the wireframe stays calm and abstract — it tells you the SHAPE
 *     of the design, not "this is exactly what your customers see," which is
 *     what we want during a picker step.
 */

import * as React from "react";
import Box from "@mui/joy/Box";
import type { CampaignTemplate } from "@/lib/studio/campaignTemplates";

const PREVIEW_HEIGHT = 96;
const PREVIEW_PADDING = 6;
const ROW_GAP = 3;

interface ResolvedRow {
  width: string;
  height: number;
  variant: "header" | "hero" | "text" | "media" | "cta" | "footer" | "spacer";
}

function thumbnailBlockToRow(
  block: CampaignTemplate["thumbnailBlocks"][number],
): ResolvedRow | null {
  // Heights from the template descriptor are abstract "slots" (8-50). Scale
  // them gently so any one block can't dominate the preview.
  const height = clamp(
    Math.round((block.height ?? 14) * 0.7),
    6,
    Math.max(8, Math.round(PREVIEW_HEIGHT * 0.6)),
  );
  const width = block.width ?? "100%";

  switch (block.kind) {
    case "newsletter-header":
      return { width: "100%", height: 10, variant: "header" };
    case "eyebrow":
      return { width, height: Math.max(6, height), variant: "header" };
    case "hero":
    case "graphic-hero":
    case "full-width-image":
    case "image-text":
      return { width: "100%", height, variant: "hero" };
    case "image-gallery":
    case "product-gallery":
    case "product-card":
      return { width: "100%", height, variant: "media" };
    case "quote":
    case "plain-text":
      return { width: "100%", height: Math.max(10, height), variant: "text" };
    case "divider":
      return { width: "60%", height: 1, variant: "spacer" };
    case "spacer":
      return { width: "100%", height: Math.max(4, height), variant: "spacer" };
    case "cta":
    case "call-to-action":
      return { width, height: Math.max(10, height), variant: "cta" };
    case "social-follow":
    case "footer":
      return { width: "100%", height: 10, variant: "footer" };
    default:
      return null;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function rgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export interface IntentCardThumbnailProps {
  template: CampaignTemplate | null;
  /** When true the matching template is unavailable — show a calm empty state. */
  emptyLabel?: string | null;
  /** Renders a smaller, simpler placeholder for the "blank" intent. */
  variant?: "preview" | "blank";
}

export function IntentCardThumbnail({
  template,
  emptyLabel,
  variant = "preview",
}: IntentCardThumbnailProps) {
  if (variant === "blank") {
    return (
      <Box
        aria-hidden
        sx={{
          height: PREVIEW_HEIGHT,
          borderRadius: "var(--joy-radius-md)",
          border: "1.5px dashed",
          borderColor: "neutral.200",
          backgroundColor: "neutral.50",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Box
          sx={{
            width: 28,
            height: 28,
            borderRadius: "999px",
            backgroundColor: "neutral.200",
            color: "neutral.500",
            fontSize: "20px",
            fontWeight: 400,
            lineHeight: "28px",
            textAlign: "center",
          }}
        >
          +
        </Box>
      </Box>
    );
  }

  if (!template) {
    return (
      <Box
        aria-hidden
        data-testid="intent-thumbnail-empty"
        sx={{
          height: PREVIEW_HEIGHT,
          borderRadius: "var(--joy-radius-md)",
          border: "1px solid",
          borderColor: "neutral.100",
          backgroundColor: "neutral.50",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "11px",
          color: "neutral.400",
        }}
      >
        {emptyLabel ?? "Coming soon"}
      </Box>
    );
  }

  const accent = template.accentColor || "#1F4341";
  const rows = template.thumbnailBlocks
    .map(thumbnailBlockToRow)
    .filter((row): row is ResolvedRow => Boolean(row));

  const variantStyle: Record<ResolvedRow["variant"], React.CSSProperties> = {
    header: {
      backgroundColor: rgba(accent, 0.18),
    },
    hero: {
      backgroundColor: rgba(accent, 0.55),
    },
    text: {
      backgroundColor: rgba(accent, 0.12),
    },
    media: {
      backgroundColor: rgba(accent, 0.3),
    },
    cta: {
      backgroundColor: accent,
    },
    footer: {
      backgroundColor: rgba(accent, 0.1),
    },
    spacer: {
      backgroundColor: rgba(accent, 0.18),
    },
  };

  return (
    <Box
      aria-hidden
      data-testid={`intent-thumbnail-${template.id}`}
      sx={{
        height: PREVIEW_HEIGHT,
        borderRadius: "var(--joy-radius-md)",
        border: "1px solid",
        borderColor: "neutral.200",
        backgroundColor: rgba(accent, 0.04),
        p: `${PREVIEW_PADDING}px`,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-start",
        gap: `${ROW_GAP}px`,
        overflow: "hidden",
      }}
    >
      {rows.map((row, index) => (
        <Box
          key={`${row.variant}-${index}`}
          sx={{
            width: row.width,
            height: `${row.height}px`,
            borderRadius:
              row.variant === "cta"
                ? "999px"
                : row.variant === "spacer" && row.height <= 2
                  ? 0
                  : "3px",
            alignSelf:
              row.variant === "cta" && row.width !== "100%"
                ? "center"
                : row.variant === "spacer" && row.width !== "100%"
                  ? "center"
                  : "stretch",
            ...variantStyle[row.variant],
          }}
        />
      ))}
    </Box>
  );
}
