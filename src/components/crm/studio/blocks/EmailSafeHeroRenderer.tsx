import Box from "@mui/joy/Box";
import Typography from "@mui/joy/Typography";
import { formatDraftRichText } from "@/lib/crm/htmlContent";
import type { StudioBlock } from "@/types/studioBlocks";

type EmailSafeHeroRendererProps = {
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

function HeroContent({
  block,
  forceLightText = false,
}: {
  block: StudioBlock;
  forceLightText?: boolean;
}) {
  const textColor = forceLightText ? "#ffffff" : block.textColor || "#ffffff";
  const subTextColor = forceLightText
    ? "rgba(255,255,255,0.78)"
    : hexToRgba(textColor, 0.78);
  const textAlign = block.textAlign || "center";
  const hasHeadline = Boolean(block.headline?.trim());
  const hasSubheading = Boolean(block.subheading?.trim());
  const hasBody = Boolean(block.body?.trim());
  const buttonPadding = getButtonPadding(block.buttonSize);
  const buttonColor =
    block.buttonColor || (forceLightText ? "#ffffff" : textColor);
  const buttonTextColor =
    block.buttonTextColor ||
    (forceLightText ? "#1a1a2e" : block.backgroundColor || "#1a1a2e");

  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: 560,
        mx: textAlign === "center" ? "auto" : 0,
        color: textColor,
        textAlign,
        textShadow: forceLightText ? "0 1px 18px rgba(0,0,0,0.32)" : "none",
      }}
    >
      {block.tagLabel ? (
        <Typography
          sx={{
            mb: 1,
            fontFamily: "var(--studio-font-subheading)",
            fontSize: "11px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.15em",
            color: forceLightText
              ? "rgba(255,255,255,0.7)"
              : hexToRgba(textColor, 0.6),
          }}
        >
          {block.tagLabel}
        </Typography>
      ) : null}
      <Typography
        sx={{
          mb: hasSubheading || hasBody ? 1 : 0,
          fontFamily: "var(--studio-font-headline)",
          fontSize: "28px",
          fontWeight: 700,
          color: textColor,
          lineHeight: 1.2,
          opacity: hasHeadline ? 1 : 0.4,
        }}
      >
        {hasHeadline ? block.headline : "Your headline here"}
      </Typography>
      <Typography
        sx={{
          fontFamily: "var(--studio-font-subheading)",
          fontSize: "16px",
          color: subTextColor,
          lineHeight: 1.5,
          opacity: hasSubheading ? 1 : 0.42,
        }}
      >
        {hasSubheading ? block.subheading : "Add a supporting message"}
      </Typography>
      {hasBody ? (
        <Box
          sx={{
            mt: 1.5,
            fontFamily: "var(--studio-font-body)",
            color: subTextColor,
            fontSize: "14px",
            lineHeight: 1.6,
            "& p": { m: 0 },
            "& p + p": { mt: 1 },
            "& h1, & h2, & h3": {
              fontFamily: "var(--studio-font-headline)",
            },
          }}
          dangerouslySetInnerHTML={{ __html: formatDraftRichText(block.body) }}
        />
      ) : null}
      {block.buttonText ? (
        <Box sx={{ mt: 3 }}>
          <Box
            component="span"
            sx={{
              display: "inline-block",
              borderRadius: block.buttonRounded === false ? "6px" : "24px",
              bgcolor: buttonColor,
              color: buttonTextColor,
              fontFamily: "var(--studio-font-button)",
              fontWeight: 600,
              lineHeight: 1.2,
              ...buttonPadding,
            }}
          >
            {block.buttonText}
          </Box>
        </Box>
      ) : null}
    </Box>
  );
}

export default function EmailSafeHeroRenderer({
  block,
}: EmailSafeHeroRendererProps) {
  const textAlign = block.textAlign || "center";
  const alignItems = getAlignItems(textAlign);
  const heroStyle = block.heroStyle || "solid";

  if (heroStyle === "image-overlay") {
    return (
      <Box
        sx={{
          position: "relative",
          minHeight: 280,
          overflow: "hidden",
          borderRadius: "4px 4px 0 0",
          bgcolor: block.imageUrl ? "transparent" : "#1a1a2e",
          backgroundImage: block.imageUrl ? `url(${block.imageUrl})` : "none",
          backgroundSize: "cover",
          backgroundPosition: "center",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            bgcolor: hexToRgba(
              block.overlayColor,
              (block.overlayOpacity ?? 45) / 100,
            ),
          }}
        />
        <Box
          sx={{
            position: "relative",
            zIndex: 1,
            width: "100%",
            p: "48px 32px",
            display: "flex",
            flexDirection: "column",
            alignItems,
          }}
        >
          <HeroContent block={block} forceLightText />
        </Box>
      </Box>
    );
  }

  if (heroStyle === "image-bottom") {
    return (
      <Box sx={{ overflow: "hidden", borderRadius: "4px 4px 0 0" }}>
        <Box
          sx={{
            bgcolor: block.backgroundColor || "#f8f9fa",
            p: "48px 32px",
            minHeight: 180,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems,
          }}
        >
          <HeroContent block={block} />
        </Box>
        {block.imageUrl ? (
          <Box sx={{ width: "100%", lineHeight: 0 }}>
            <Box
              component="img"
              src={block.imageUrl}
              alt={block.imageAlt || ""}
              sx={{ width: "100%", height: "auto", display: "block" }}
            />
          </Box>
        ) : null}
      </Box>
    );
  }

  return (
    <Box
      sx={{
        bgcolor:
          heroStyle === "gradient"
            ? undefined
            : block.backgroundColor || "#1a1a2e",
        background:
          heroStyle === "gradient"
            ? `linear-gradient(135deg, ${block.gradientFrom || "#ff6b6b"}, ${block.gradientTo || "#ffd93d"})`
            : undefined,
        p: "48px 32px",
        minHeight: 200,
        borderRadius: "4px 4px 0 0",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems,
      }}
    >
      <HeroContent block={block} />
    </Box>
  );
}
