import Box from "@mui/joy/Box";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { ImagePlus } from "lucide-react";
import { formatDraftRichText } from "@/lib/crm/htmlContent";
import type { StudioBlock } from "@/types/studioBlocks";

type ImageTextRendererProps = {
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

function resolveLayout(block: StudioBlock) {
  if (block.layout) {
    return block.layout;
  }

  switch (block.imagePosition) {
    case "right":
      return "image-right";
    case "top":
      return "image-top";
    case "overlay":
      return "image-overlay";
    default:
      return "image-left";
  }
}

function getAspectRatio(value: StudioBlock["imageRatio"]) {
  switch (value) {
    case "1:1":
      return "1 / 1";
    case "4:3":
      return "4 / 3";
    case "16:9":
      return "16 / 9";
    default:
      return undefined;
  }
}

function getSplit(columnSplit: StudioBlock["columnSplit"]) {
  switch (columnSplit) {
    case "40/60":
      return { image: "40%", text: "60%" };
    case "60/40":
      return { image: "60%", text: "40%" };
    default:
      return { image: "50%", text: "50%" };
  }
}

function getButtonPadding(size: StudioBlock["buttonSize"]) {
  switch (size) {
    case "sm":
      return { px: 2, py: 0.8, fontSize: "13px", minHeight: 34 };
    case "lg":
      return { px: 3.1, py: 1.2, fontSize: "15px", minHeight: 44 };
    default:
      return { px: 2.6, py: 1, fontSize: "14px", minHeight: 40 };
  }
}

function PlaceholderImage({ compact = false }: { compact?: boolean }) {
  return (
    <Box
      sx={{
        minHeight: compact ? 132 : 200,
        width: "100%",
        border: "1.5px dashed",
        borderColor: "neutral.200",
        borderRadius: "8px",
        bgcolor: "neutral.50",
        color: "neutral.300",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Stack spacing={0.75} alignItems="center">
        <ImagePlus size={28} />
        <Typography
          level="body-xs"
          sx={{ color: "neutral.400", fontFamily: "var(--studio-font-body)" }}
        >
          Upload image
        </Typography>
      </Stack>
    </Box>
  );
}

function ImageFrame({
  block,
  aspectRatio,
  compact = false,
}: {
  block: StudioBlock;
  aspectRatio?: string;
  compact?: boolean;
}) {
  const minHeight = compact ? 132 : 200;

  if (!block.imageUrl) {
    return (
      <Box sx={{ width: "100%", aspectRatio, minHeight }}>
        <PlaceholderImage compact={compact} />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        width: "100%",
        aspectRatio,
        minHeight,
        borderRadius: `${block.borderRadius ?? 8}px`,
        overflow: "hidden",
        bgcolor: "neutral.100",
      }}
    >
      <Box
        component="img"
        src={block.imageUrl}
        alt={block.imageAlt || ""}
        sx={{
          width: "100%",
          height: "100%",
          minHeight,
          display: "block",
          objectFit: block.imageFit ?? "cover",
          bgcolor: "neutral.100",
        }}
      />
    </Box>
  );
}

function ButtonPreview({
  block,
  forceLight = false,
}: {
  block: StudioBlock;
  forceLight?: boolean;
}) {
  const hasText = Boolean(block.buttonText?.trim());
  const style = block.buttonStyle ?? "filled";
  const textColor = forceLight ? "#ffffff" : block.textColor || "#111827";
  const buttonColor = block.buttonColor || textColor;
  const buttonTextColor =
    block.buttonTextColor || (style === "filled" ? "#ffffff" : buttonColor);
  const sizeSx = getButtonPadding(block.buttonSize);
  const filled = style === "filled";
  const outlined = style === "outlined";
  const ghost = style === "ghost";

  return (
    <Box
      component={block.buttonUrl ? "a" : "span"}
      href={block.buttonUrl || undefined}
      onClick={(event) => event.preventDefault()}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: style === "link" ? "auto" : sizeSx.minHeight,
        width: block.fullWidthButton ? "100%" : "auto",
        maxWidth: block.fullWidthButton ? 320 : "none",
        px: style === "link" ? 0 : sizeSx.px,
        py: style === "link" ? 0 : sizeSx.py,
        borderRadius:
          style === "link"
            ? 0
            : block.buttonRounded === false
              ? "6px"
              : "999px",
        border: outlined
          ? "1px solid"
          : ghost
            ? "1px solid transparent"
            : "none",
        borderColor: outlined ? buttonColor : "transparent",
        bgcolor: filled
          ? buttonColor
          : ghost
            ? "rgba(15,23,42,0.08)"
            : "transparent",
        color: filled ? buttonTextColor : buttonTextColor,
        fontFamily: "var(--studio-font-button)",
        fontSize: "14px",
        fontWeight: 700,
        lineHeight: 1.2,
        textDecoration: style === "link" ? "underline" : "none",
        textUnderlineOffset: "3px",
        opacity: hasText ? 1 : 0.38,
      }}
    >
      {hasText ? block.buttonText : "Button text"}
      {style === "link" ? (
        <Box component="span" sx={{ ml: 0.75 }}>
          -&gt;
        </Box>
      ) : null}
    </Box>
  );
}

function TextContent({
  block,
  forceLight = false,
}: {
  block: StudioBlock;
  forceLight?: boolean;
}) {
  const textColor = forceLight ? "#ffffff" : block.textColor || "#111827";
  const mutedColor = forceLight
    ? "rgba(255,255,255,0.76)"
    : "rgba(17,24,39,0.66)";
  const hasHeadline = Boolean(block.headline?.trim());
  const hasSubheading = Boolean(block.subheading?.trim());
  const hasBody = hasRichText(block.body);

  return (
    <Stack
      spacing={1.25}
      sx={{
        color: textColor,
        textAlign: block.textAlign ?? "left",
        alignItems:
          block.textAlign === "center"
            ? "center"
            : block.textAlign === "right"
              ? "flex-end"
              : "flex-start",
      }}
    >
      <Typography
        sx={{
          color: textColor,
          fontFamily: "var(--studio-font-headline)",
          fontSize: "24px",
          fontWeight: 750,
          lineHeight: 1.18,
          opacity: hasHeadline ? 1 : 0.36,
        }}
      >
        {hasHeadline ? block.headline : "Headline goes here"}
      </Typography>
      <Typography
        sx={{
          color: mutedColor,
          fontFamily: "var(--studio-font-subheading)",
          fontSize: "15px",
          fontWeight: 600,
          lineHeight: 1.45,
          opacity: hasSubheading ? 1 : 0.34,
        }}
      >
        {hasSubheading ? block.subheading : "Supporting text"}
      </Typography>
      {hasBody ? (
        <Box
          sx={{
            width: "100%",
            fontFamily: "var(--studio-font-body)",
            color: mutedColor,
            fontSize: "14px",
            lineHeight: 1.65,
            "& p": { m: 0 },
            "& p + p": { mt: 1 },
            "& h1": {
              m: "0 0 8px",
              color: textColor,
              fontFamily: "var(--studio-font-headline)",
              fontSize: "22px",
              lineHeight: 1.25,
            },
            "& h2": {
              m: "0 0 8px",
              color: textColor,
              fontFamily: "var(--studio-font-headline)",
              fontSize: "18px",
              lineHeight: 1.3,
            },
            "& h3": {
              m: "0 0 6px",
              color: textColor,
              fontFamily: "var(--studio-font-headline)",
              fontSize: "16px",
              lineHeight: 1.35,
            },
            "& ul, & ol": { my: 0.75, pl: 2.25 },
            "& li + li": { mt: 0.35 },
            "& a": {
              color: "inherit",
              textDecoration: "underline",
              textUnderlineOffset: "2px",
            },
            "& strong": { color: textColor },
          }}
          dangerouslySetInnerHTML={{ __html: formatDraftRichText(block.body) }}
        />
      ) : (
        <Typography
          sx={{
            color: mutedColor,
            fontFamily: "var(--studio-font-body)",
            fontSize: "14px",
            lineHeight: 1.65,
            opacity: 0.34,
          }}
        >
          Body content with multiple lines appears here.
        </Typography>
      )}
      <Box sx={{ pt: 1 }}>
        <ButtonPreview block={block} forceLight={forceLight} />
      </Box>
    </Stack>
  );
}

export default function ImageTextRenderer({ block }: ImageTextRendererProps) {
  const layout = resolveLayout(block);
  const padding = `${block.contentPadding ?? 24}px`;
  const aspectRatio = getAspectRatio(block.imageRatio ?? "auto");
  const split = getSplit(block.columnSplit ?? "50/50");
  const backgroundColor = block.backgroundColor || "#ffffff";
  const overlayEnabled = block.showOverlay ?? true;

  if (layout === "image-overlay") {
    return (
      <Box sx={{ p: 2, bgcolor: backgroundColor }}>
        <Box
          sx={{
            position: "relative",
            minHeight: 300,
            aspectRatio,
            borderRadius: `${block.borderRadius ?? 8}px`,
            overflow: "hidden",
            bgcolor: "neutral.800",
            backgroundImage: block.imageUrl
              ? `url(${block.imageUrl})`
              : "linear-gradient(135deg, #6b7280, #111827)",
            backgroundSize: block.imageFit === "contain" ? "contain" : "cover",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "center",
          }}
        >
          {overlayEnabled ? (
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                bgcolor: block.overlayColor || "#000000",
                opacity: (block.overlayOpacity ?? 52) / 100,
              }}
            />
          ) : null}
          <Box
            sx={{ position: "relative", zIndex: 1, p: padding, maxWidth: 420 }}
          >
            <TextContent block={block} forceLight />
          </Box>
        </Box>
      </Box>
    );
  }

  if (layout === "image-top" || layout === "minimal-card") {
    const minimal = layout === "minimal-card";

    return (
      <Box
        sx={{
          bgcolor: block.backgroundColor || "#ffffff",
          p: padding,
          textAlign: minimal ? "center" : undefined,
        }}
      >
        <Stack
          spacing={minimal ? 2.5 : 2}
          alignItems={minimal ? "center" : "stretch"}
        >
          <Box
            sx={{
              width: minimal ? "76%" : "100%",
              maxWidth: minimal ? 420 : "none",
            }}
          >
            <ImageFrame
              block={block}
              aspectRatio={aspectRatio}
              compact={minimal}
            />
          </Box>
          <Box
            sx={{ maxWidth: minimal ? 460 : "none", mx: minimal ? "auto" : 0 }}
          >
            <TextContent
              block={{
                ...block,
                textAlign: minimal ? "center" : block.textAlign,
              }}
            />
          </Box>
        </Stack>
      </Box>
    );
  }

  return (
    <Box sx={{ bgcolor: backgroundColor, p: padding }}>
      <Stack
        direction={layout === "image-right" ? "row-reverse" : "row"}
        spacing={3}
        alignItems="stretch"
      >
        <Box
          sx={{ flex: `0 0 ${split.image}`, width: split.image, minWidth: 0 }}
        >
          <ImageFrame block={block} aspectRatio={aspectRatio} />
        </Box>
        <Box
          sx={{
            flex: `0 0 ${split.text}`,
            width: split.text,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            pl: layout === "image-left" ? 1 : 0,
            pr: layout === "image-right" ? 1 : 0,
          }}
        >
          <TextContent block={block} />
        </Box>
      </Stack>
    </Box>
  );
}
