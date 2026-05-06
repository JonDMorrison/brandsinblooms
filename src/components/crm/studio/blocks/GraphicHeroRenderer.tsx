import Box from "@mui/joy/Box";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { ImagePlus } from "lucide-react";
import type { StudioBlock } from "@/types/studioBlocks";

type GraphicHeroRendererProps = {
  block: StudioBlock;
};

function hexToRgba(color: string | undefined, opacity: number) {
  const fallback = `rgba(0,0,0,${opacity})`;

  if (!color) {
    return fallback;
  }

  const normalized = color.trim();

  if (/^rgba?\(/i.test(normalized)) {
    return normalized;
  }

  const hex = normalized.replace("#", "");
  const fullHex =
    hex.length === 3
      ? hex
          .split("")
          .map((part) => `${part}${part}`)
          .join("")
      : hex;

  if (!/^[0-9a-f]{6}$/i.test(fullHex)) {
    return fallback;
  }

  const red = Number.parseInt(fullHex.slice(0, 2), 16);
  const green = Number.parseInt(fullHex.slice(2, 4), 16);
  const blue = Number.parseInt(fullHex.slice(4, 6), 16);

  return `rgba(${red},${green},${blue},${opacity})`;
}

function getAlignItems(textAlign: StudioBlock["textAlign"]) {
  if (textAlign === "left") {
    return "flex-start";
  }

  if (textAlign === "right") {
    return "flex-end";
  }

  return "center";
}

function getJustifyContent(textPosition: StudioBlock["textPosition"]) {
  if (textPosition === "top") {
    return "flex-start";
  }

  if (textPosition === "bottom") {
    return "flex-end";
  }

  return "center";
}

function getButtonPadding(size: StudioBlock["buttonSize"]) {
  switch (size) {
    case "sm":
      return { px: 2, py: 0.875, fontSize: "13px" };
    case "lg":
      return { px: 3.5, py: 1.4, fontSize: "15px" };
    default:
      return { px: 3, py: 1.125, fontSize: "14px" };
  }
}

function getOverlayBackground(block: StudioBlock) {
  const overlayColor = block.overlayColor ?? "#000000";
  const overlayOpacity = Math.max(0, Math.min(100, block.overlayOpacity ?? 45));
  const solid = hexToRgba(overlayColor, overlayOpacity / 100);
  const transparent = hexToRgba(overlayColor, 0);

  switch (block.overlayGradientDirection) {
    case "top-to-bottom":
      return `linear-gradient(to bottom, ${solid}, ${transparent})`;
    case "bottom-to-top":
      return `linear-gradient(to top, ${solid}, ${transparent})`;
    default:
      return solid;
  }
}

function GraphicHeroButton({ block }: GraphicHeroRendererProps) {
  if (!block.showButton || !block.buttonText) {
    return null;
  }

  const buttonColor = block.buttonColor ?? "#ffffff";
  const buttonTextColor = block.buttonTextColor ?? "#000000";
  const buttonStyle = block.buttonStyle ?? "filled";
  const radius = block.buttonRounded === false ? "8px" : "999px";
  const buttonPadding = getButtonPadding(block.buttonSize);
  const resolvedTextColor =
    buttonStyle === "filled"
      ? buttonTextColor
      : (block.buttonTextColor ?? buttonColor);

  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: radius,
        fontFamily: "var(--studio-font-button)",
        fontWeight: 700,
        lineHeight: 1.2,
        textDecoration: "none",
        border:
          buttonStyle === "outlined"
            ? "1px solid"
            : buttonStyle === "ghost"
              ? "1px solid transparent"
              : "none",
        borderColor: buttonStyle === "outlined" ? buttonColor : "transparent",
        bgcolor:
          buttonStyle === "filled"
            ? buttonColor
            : buttonStyle === "ghost"
              ? hexToRgba(buttonColor, 0.16)
              : "transparent",
        color: resolvedTextColor,
        backdropFilter: buttonStyle === "ghost" ? "blur(4px)" : "none",
        boxShadow:
          buttonStyle === "filled"
            ? "0 10px 20px -14px rgba(15, 23, 42, 0.45)"
            : "none",
        ...buttonPadding,
      }}
    >
      {block.buttonText}
    </Box>
  );
}

export default function GraphicHeroRenderer({
  block,
}: GraphicHeroRendererProps) {
  const hasImage = Boolean(block.imageUrl);
  const borderRadius = block.borderRadius ?? 0;
  const maxHeight = block.maxHeight ?? 400;
  const backgroundColor = block.backgroundColor ?? "#ffffff";
  const textColor = block.textColor ?? "#ffffff";
  const insetPadding = block.insetPadding ?? block.imagePadding ?? false;
  const showCaptionBar = block.showCaptionBar ?? false;
  const showTextOverlay = block.showTextOverlay ?? false;
  const showFloatingButton = (block.showButton ?? false) && !showCaptionBar;
  const imageBorderRadius = showCaptionBar
    ? `${borderRadius}px ${borderRadius}px 0 0`
    : `${borderRadius}px`;
  const alignItems = getAlignItems(block.textAlign ?? "center");
  const justifyContent = showTextOverlay
    ? getJustifyContent(block.textPosition ?? "center")
    : "flex-end";
  const textShadow = block.textShadow ? "0 1px 3px rgba(0,0,0,0.3)" : "none";

  return (
    <Box
      sx={{
        position: "relative",
        bgcolor: backgroundColor,
        p: insetPadding ? 2 : 0,
        borderRadius: insetPadding ? `${borderRadius + 4}px` : 0,
      }}
    >
      {hasImage ? (
        <Stack
          spacing={0}
          sx={{
            borderRadius: `${borderRadius}px`,
            overflow: "hidden",
            boxShadow: block.showShadow
              ? "0 4px 16px rgba(0,0,0,0.12)"
              : "none",
          }}
        >
          <Box
            component={block.linkUrl ? "a" : "div"}
            href={block.linkUrl || undefined}
            onClick={(event) => event.preventDefault()}
            sx={{
              position: "relative",
              display: "block",
              height: `${maxHeight}px`,
              maxHeight: `${maxHeight}px`,
              overflow: "hidden",
              lineHeight: 0,
              textDecoration: "none",
              borderRadius: imageBorderRadius,
              bgcolor: backgroundColor,
            }}
          >
            <Box
              component="img"
              src={block.imageUrl}
              alt={block.imageAlt || ""}
              sx={{
                width: "100%",
                height: "100%",
                maxHeight: `${maxHeight}px`,
                objectFit: block.imageFit ?? "cover",
                display: "block",
                bgcolor: backgroundColor,
              }}
            />

            {block.showOverlay ? (
              <Box
                sx={{
                  position: "absolute",
                  inset: 0,
                  background: getOverlayBackground(block),
                }}
              />
            ) : null}

            {showTextOverlay || showFloatingButton ? (
              <Box
                sx={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent,
                  alignItems,
                  p: showTextOverlay ? "32px 24px" : "24px",
                  textAlign: block.textAlign ?? "center",
                  zIndex: 2,
                }}
              >
                {showTextOverlay ? (
                  <Box
                    sx={{
                      width: "100%",
                      maxWidth: 520,
                      ml: block.textAlign === "right" ? "auto" : 0,
                      mr: block.textAlign === "left" ? "auto" : 0,
                    }}
                  >
                    {block.headline ? (
                      <Typography
                        sx={{
                          fontFamily: "var(--studio-font-headline)",
                          fontSize: "28px",
                          fontWeight: 700,
                          lineHeight: 1.2,
                          color: textColor,
                          textShadow,
                          mb: block.subheading ? 0.5 : 0,
                        }}
                      >
                        {block.headline}
                      </Typography>
                    ) : null}
                    {block.subheading ? (
                      <Typography
                        sx={{
                          fontFamily: "var(--studio-font-subheading)",
                          fontSize: "16px",
                          lineHeight: 1.5,
                          color: hexToRgba(textColor, 0.82),
                          textShadow,
                        }}
                      >
                        {block.subheading}
                      </Typography>
                    ) : null}
                    {showFloatingButton && block.buttonText ? (
                      <Box sx={{ mt: 2 }}>
                        <GraphicHeroButton block={block} />
                      </Box>
                    ) : null}
                  </Box>
                ) : showFloatingButton && block.buttonText ? (
                  <GraphicHeroButton block={block} />
                ) : null}
              </Box>
            ) : null}
          </Box>

          {showCaptionBar ? (
            <Box
              sx={{
                bgcolor: block.captionBarColor ?? "#1e293b",
                p: "16px 24px",
                textAlign: block.textAlign ?? "center",
              }}
            >
              {block.headline ? (
                <Typography
                  sx={{
                    fontFamily: "var(--studio-font-headline)",
                    fontSize: "16px",
                    fontWeight: 600,
                    color: textColor,
                    lineHeight: 1.35,
                    mb: block.subheading ? 0.5 : 0,
                  }}
                >
                  {block.headline}
                </Typography>
              ) : null}
              {block.subheading ? (
                <Typography
                  sx={{
                    fontFamily: "var(--studio-font-subheading)",
                    fontSize: "13px",
                    lineHeight: 1.5,
                    color: hexToRgba(textColor, 0.72),
                  }}
                >
                  {block.subheading}
                </Typography>
              ) : null}
              {block.showButton && block.buttonText ? (
                <Box sx={{ mt: 1.5 }}>
                  <GraphicHeroButton block={block} />
                </Box>
              ) : null}
            </Box>
          ) : null}
        </Stack>
      ) : (
        <Box
          sx={{
            height: "280px",
            bgcolor: "neutral.50",
            border: "2px dashed",
            borderColor: "neutral.200",
            borderRadius: `${borderRadius}px`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 1,
            cursor: "pointer",
            transition: "all 150ms ease",
            "&:hover": {
              borderColor: "primary.300",
              bgcolor: "primary.50",
            },
          }}
        >
          <ImagePlus
            size={36}
            style={{ color: "var(--joy-palette-neutral-300)" }}
          />
          <Typography level="body-sm" color="neutral">
            Upload your hero graphic
          </Typography>
          <Typography level="body-xs" sx={{ color: "neutral.300" }}>
            Canva designs, banners, or custom graphics
          </Typography>
        </Box>
      )}
    </Box>
  );
}
