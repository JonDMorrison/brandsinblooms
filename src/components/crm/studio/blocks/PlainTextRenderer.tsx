import Box from "@mui/joy/Box";
import Typography from "@mui/joy/Typography";
import { formatDraftRichText } from "@/lib/crm/htmlContent";
import type { StudioBlock } from "@/types/studioBlocks";

type PlainTextRendererProps = {
  block: StudioBlock;
};

function hasRichText(value: string | undefined) {
  return Boolean(
    value
      ?.replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .trim(),
  );
}

function getFontSize(size: StudioBlock["fontSize"]) {
  switch (size) {
    case "sm":
      return "14px";
    case "lg":
      return "18px";
    default:
      return "16px";
  }
}

function getFontWeight(value: StudioBlock["fontWeightPreset"]) {
  return value === "medium" ? 500 : 400;
}

function RichText({
  block,
  forceCentered = false,
}: {
  block: StudioBlock;
  forceCentered?: boolean;
}) {
  const hasBody = hasRichText(block.body);
  const textAlign = forceCentered ? "center" : block.textAlign || "left";
  const textColor = block.textColor || "#111827";
  const resolvedFontSize = getFontSize(block.fontSizePreset ?? block.fontSize);
  const resolvedLineHeight = block.lineHeightValue ?? block.lineHeight ?? 1.6;
  const fontWeight = getFontWeight(block.fontWeightPreset);

  if (!hasBody) {
    return (
      <Typography
        sx={{
          color: textColor,
          fontFamily: "var(--studio-font-body)",
          fontSize: resolvedFontSize,
          lineHeight: resolvedLineHeight,
          fontWeight,
          textAlign,
          opacity: 0.36,
        }}
      >
        Body text content appears here. Add rich text to build the main message.
      </Typography>
    );
  }

  return (
    <Box
      sx={{
        color: textColor,
        fontFamily: "var(--studio-font-body)",
        fontSize: resolvedFontSize,
        lineHeight: resolvedLineHeight,
        fontWeight,
        textAlign,
        "& p": { m: 0 },
        "& p + p": { mt: 1 },
        "& h1": {
          m: "0 0 10px",
          color: textColor,
          fontFamily: "var(--studio-font-headline)",
          fontSize: "24px",
          lineHeight: 1.25,
        },
        "& h2": {
          m: "0 0 8px",
          color: textColor,
          fontFamily: "var(--studio-font-headline)",
          fontSize: "20px",
          lineHeight: 1.3,
        },
        "& h3": {
          m: "0 0 6px",
          color: textColor,
          fontFamily: "var(--studio-font-headline)",
          fontSize: "17px",
          lineHeight: 1.35,
        },
        "& ul, & ol": { my: 1, pl: 2.5, textAlign: "left" },
        "& li + li": { mt: 0.4 },
        "& a": {
          color: "inherit",
          textDecoration: "underline",
          textUnderlineOffset: "2px",
        },
        "& strong": { color: textColor },
      }}
      dangerouslySetInnerHTML={{ __html: formatDraftRichText(block.body) }}
    />
  );
}

export default function PlainTextRenderer({ block }: PlainTextRendererProps) {
  const layout = block.layout || "standard";
  const padding = `${block.contentPadding ?? 28}px 24px`;

  if (layout === "centered-feature") {
    return (
      <Box sx={{ bgcolor: block.backgroundColor || "#ffffff", p: padding }}>
        <Box sx={{ maxWidth: 520, mx: "auto" }}>
          <RichText
            block={{
              ...block,
              fontSize: block.fontSizePreset || block.fontSize || "lg",
              lineHeight: block.lineHeightValue ?? block.lineHeight ?? 1.8,
            }}
            forceCentered
          />
        </Box>
      </Box>
    );
  }

  if (layout === "boxed") {
    return (
      <Box sx={{ bgcolor: block.backgroundColor || "#ffffff", p: padding }}>
        <Box
          sx={{
            bgcolor: "neutral.50",
            borderRadius: `${block.boxBorderRadius ?? 12}px`,
            p: 3,
            border: "1px solid",
            borderColor:
              block.showAccent === false
                ? "neutral.100"
                : block.accentColor || "#dbe4f0",
            borderWidth: `${block.accentThickness ?? 1}px`,
          }}
        >
          <RichText block={block} />
        </Box>
      </Box>
    );
  }

  if (layout === "side-accent") {
    return (
      <Box sx={{ bgcolor: block.backgroundColor || "#ffffff", p: padding }}>
        <Box
          sx={{
            borderLeft:
              block.showAccent === false
                ? "none"
                : `${block.accentThickness ?? 3}px solid`,
            borderColor: block.accentColor || "#111827",
            pl: 2.5,
          }}
        >
          <RichText block={block} />
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ bgcolor: block.backgroundColor || "#ffffff", p: padding }}>
      <RichText block={block} />
    </Box>
  );
}
