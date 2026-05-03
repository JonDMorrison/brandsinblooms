import Box from "@mui/joy/Box";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import type { StudioBlock } from "@/types/studioBlocks";

type NewsletterHeaderRendererProps = {
  block: StudioBlock;
};

function withOpacity(color: string, opacity: number) {
  if (/^rgba?\(/i.test(color)) {
    return color;
  }

  const hex = color.replace("#", "");
  const fullHex =
    hex.length === 3
      ? hex
          .split("")
          .map((part) => `${part}${part}`)
          .join("")
      : hex;

  if (!/^[0-9a-fA-F]{6}$/.test(fullHex)) {
    return color;
  }

  const red = Number.parseInt(fullHex.slice(0, 2), 16);
  const green = Number.parseInt(fullHex.slice(2, 4), 16);
  const blue = Number.parseInt(fullHex.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}

function getDefaultPaddingY(layout: string) {
  switch (layout) {
    case "centered":
      return 24;
    case "minimal":
      return 16;
    case "banner":
      return 20;
    default:
      return 20;
  }
}

function getLogoPlaceholderWidth(block: StudioBlock, size: number) {
  return block.logoShape === "circle" ? size : Math.max(size, 52);
}

function getLogoRadius(block: StudioBlock) {
  switch (block.logoShape) {
    case "circle":
      return "50%";
    case "square":
      return "0px";
    default:
      return "10px";
  }
}

function LogoMark({
  block,
  size = 44,
  showPlaceholder = true,
}: {
  block: StudioBlock;
  size?: number;
  showPlaceholder?: boolean;
}) {
  const isCircle = block.logoShape === "circle";
  const placeholderWidth = getLogoPlaceholderWidth(block, size);

  if (block.logoUrl) {
    return (
      <Box
        component="img"
        src={block.logoUrl}
        alt=""
        sx={{
          width: isCircle ? size : "auto",
          maxWidth: isCircle ? size : Math.max(placeholderWidth, size * 2.6),
          height: size,
          borderRadius: getLogoRadius(block),
          display: "block",
          objectFit: isCircle ? "cover" : "contain",
          bgcolor: "neutral.100",
        }}
      />
    );
  }

  if (!showPlaceholder) {
    return null;
  }

  return (
    <Box
      sx={{
        width: placeholderWidth,
        height: size,
        borderRadius: getLogoRadius(block),
        border: "1.5px dashed",
        borderColor: withOpacity(block.textColor || "#1a1a2e", 0.16),
        bgcolor: "neutral.50",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--studio-font-brand)",
        fontSize: "11px",
        fontWeight: 700,
        color: withOpacity(block.textColor || "#1a1a2e", 0.42),
        flexShrink: 0,
      }}
    >
      Logo
    </Box>
  );
}

export default function NewsletterHeaderRenderer({
  block,
}: NewsletterHeaderRendererProps) {
  const layout = block.layout || "classic";
  const backgroundColor = block.backgroundColor || "#ffffff";
  const textColor = block.textColor || "#1a1a2e";
  const paddingY = block.verticalPadding ?? getDefaultPaddingY(layout);
  const showDivider = block.showDividerBelow ?? block.showDivider ?? true;
  const dividerColor = block.dividerBelowColor || "#e2e8f0";
  const logoSize = block.logoSize ?? (layout === "banner" ? 36 : 40);
  const logoDirection = block.logoAlignment === "right" ? "row-reverse" : "row";
  const title = block.headline?.trim() ? block.headline : "Newsletter Title";
  const tagline = block.tagline?.trim()
    ? block.tagline
    : "Your weekly garden update";
  const dateLabel = block.dateLabel?.trim() ? block.dateLabel : "May 2026";
  const hasTitle = Boolean(block.headline?.trim());
  const hasTagline = Boolean(block.tagline?.trim());
  const hasDate = Boolean(block.dateLabel?.trim());
  const subtitleColor = withOpacity(
    textColor,
    layout === "banner" ? 0.82 : 0.64,
  );
  const dateColor = withOpacity(textColor, layout === "banner" ? 0.7 : 0.54);
  const divider = showDivider ? (
    <Box
      sx={{
        mx: 3,
        height: "1px",
        bgcolor: dividerColor,
        opacity: layout === "banner" ? 0.45 : 1,
      }}
    />
  ) : null;

  if (layout === "centered") {
    return (
      <Box sx={{ bgcolor: backgroundColor, color: textColor }}>
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            px: 3,
            py: `${paddingY}px`,
            minHeight: 80,
          }}
        >
          <Stack spacing={1} alignItems="center" sx={{ width: "100%" }}>
            <LogoMark block={block} size={logoSize} />
            <Stack spacing={0.5} alignItems="center" sx={{ minWidth: 0 }}>
              <Typography
                sx={{
                  color: textColor,
                  fontFamily: "var(--studio-font-headline)",
                  fontSize: "22px",
                  fontWeight: 700,
                  lineHeight: 1.2,
                  opacity: hasTitle ? 1 : 0.42,
                }}
              >
                {title}
              </Typography>
              <Typography
                sx={{
                  color: subtitleColor,
                  fontFamily: "var(--studio-font-subheading)",
                  fontSize: "13px",
                  lineHeight: 1.4,
                  opacity: hasTagline ? 1 : 0.64,
                }}
              >
                {tagline}
              </Typography>
              <Typography
                sx={{
                  color: dateColor,
                  fontFamily: "var(--studio-font-body)",
                  fontSize: "12px",
                  lineHeight: 1.35,
                  opacity: hasDate ? 1 : 0.72,
                }}
              >
                {dateLabel}
              </Typography>
            </Stack>
          </Stack>
        </Box>
        {divider}
      </Box>
    );
  }

  if (layout === "minimal") {
    return (
      <Box
        sx={{
          bgcolor: backgroundColor,
          color: textColor,
          px: 3,
          py: `${paddingY}px`,
          minHeight: 48,
          borderBottom: showDivider ? "1px solid" : undefined,
          borderColor: showDivider ? dividerColor : undefined,
        }}
      >
        <Stack spacing={block.tagline?.trim() ? 0.5 : 0}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            spacing={2}
          >
            <Typography
              sx={{
                color: textColor,
                fontFamily: "var(--studio-font-headline)",
                fontSize: "18px",
                fontWeight: 600,
                lineHeight: 1.2,
                opacity: hasTitle ? 1 : 0.42,
                minWidth: 0,
              }}
            >
              {title}
            </Typography>
            <Typography
              sx={{
                color: dateColor,
                fontFamily: "var(--studio-font-body)",
                fontSize: "12px",
                lineHeight: 1.35,
                opacity: hasDate ? 1 : 0.72,
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {dateLabel}
            </Typography>
          </Stack>
          {block.tagline?.trim() ? (
            <Typography
              sx={{
                color: subtitleColor,
                fontFamily: "var(--studio-font-subheading)",
                fontSize: "13px",
                lineHeight: 1.35,
              }}
            >
              {block.tagline}
            </Typography>
          ) : null}
        </Stack>
      </Box>
    );
  }

  if (layout === "banner") {
    return (
      <Box sx={{ bgcolor: backgroundColor, color: textColor }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            px: 3,
            py: `${paddingY}px`,
            minHeight: 64,
          }}
        >
          <Box
            sx={{
              display: "flex",
              flexDirection: logoDirection as "row" | "row-reverse",
              alignItems: "center",
              gap: 1.5,
              flex: 1,
              minWidth: 0,
            }}
          >
            <LogoMark block={block} size={logoSize} showPlaceholder={false} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                sx={{
                  color: textColor,
                  fontFamily: "var(--studio-font-headline)",
                  fontSize: "18px",
                  fontWeight: 700,
                  lineHeight: 1.2,
                  opacity: hasTitle ? 1 : 0.42,
                }}
              >
                {title}
              </Typography>
              <Typography
                sx={{
                  color: subtitleColor,
                  fontFamily: "var(--studio-font-subheading)",
                  fontSize: "12px",
                  lineHeight: 1.35,
                  opacity: hasTagline ? 1 : 0.7,
                  mt: 0.25,
                }}
              >
                {tagline}
              </Typography>
            </Box>
          </Box>
          <Typography
            sx={{
              color: dateColor,
              fontFamily: "var(--studio-font-body)",
              fontSize: "12px",
              lineHeight: 1.35,
              opacity: hasDate ? 1 : 0.72,
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {dateLabel}
          </Typography>
        </Box>
        {divider}
      </Box>
    );
  }

  return (
    <Box sx={{ bgcolor: backgroundColor, color: textColor }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          px: 3,
          py: `${paddingY}px`,
          minHeight: 64,
        }}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: logoDirection as "row" | "row-reverse",
            alignItems: "center",
            gap: 1.5,
            flex: 1,
            minWidth: 0,
          }}
        >
          <LogoMark block={block} size={logoSize} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              sx={{
                color: textColor,
                fontFamily: "var(--studio-font-headline)",
                fontSize: "20px",
                fontWeight: 700,
                lineHeight: 1.2,
                opacity: hasTitle ? 1 : 0.42,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {title}
            </Typography>
            <Typography
              sx={{
                color: subtitleColor,
                fontFamily: "var(--studio-font-subheading)",
                fontSize: "13px",
                lineHeight: 1.3,
                opacity: hasTagline ? 1 : 0.64,
                mt: 0.25,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {tagline}
            </Typography>
          </Box>
        </Box>
        <Typography
          sx={{
            color: dateColor,
            fontFamily: "var(--studio-font-body)",
            fontSize: "13px",
            lineHeight: 1.3,
            opacity: hasDate ? 1 : 0.72,
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          {dateLabel}
        </Typography>
      </Box>
      {divider}
    </Box>
  );
}
