import Box from "@mui/joy/Box";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { formatDraftRichText } from "@/lib/crm/htmlContent";
import type { StudioBlock } from "@/types/studioBlocks";

type CTARendererProps = {
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

function getButtonPadding(size: StudioBlock["buttonSize"]) {
  switch (size) {
    case "sm":
      return { px: 2, py: 0.85, minHeight: 34, fontSize: "13px" };
    case "lg":
      return { px: 3.1, py: 1.25, minHeight: 46, fontSize: "16px" };
    default:
      return { px: 2.6, py: 1.05, minHeight: 40, fontSize: "14px" };
  }
}

function CTAButton({ block }: { block: StudioBlock }) {
  const style = block.buttonStyle ?? "filled";
  const sizeSx = getButtonPadding(block.buttonSize);
  const buttonColor = block.buttonColor || "#111827";
  const buttonTextColor = block.buttonTextColor || "#ffffff";
  const textColor = block.textColor || "#111827";
  const filled = style === "filled";
  const outlined = style === "outlined";
  const ghost = style === "ghost";
  const isLink = style === "link";
  const hasText = Boolean(block.buttonText?.trim());
  const resolvedTextColor =
    style === "filled" ? buttonTextColor : block.buttonTextColor || buttonColor;

  return (
    <Box
      component={block.buttonUrl ? "a" : "span"}
      href={block.buttonUrl || undefined}
      onClick={(event) => event.preventDefault()}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: block.fullWidthButton ? "100%" : "auto",
        maxWidth: block.fullWidthButton ? 420 : "none",
        minHeight: isLink ? "auto" : sizeSx.minHeight,
        px: isLink ? 0 : sizeSx.px,
        py: isLink ? 0 : sizeSx.py,
        borderRadius: block.buttonRounded === false ? "6px" : "999px",
        border: outlined ? "1px solid" : ghost ? "1px solid transparent" : 0,
        borderColor: outlined ? buttonColor : "transparent",
        bgcolor: filled
          ? buttonColor
          : ghost
            ? "rgba(15,23,42,0.08)"
            : "transparent",
        color: resolvedTextColor || textColor,
        fontFamily: "var(--studio-font-button)",
        fontSize: sizeSx.fontSize,
        fontWeight: 750,
        lineHeight: 1.2,
        textDecoration: isLink ? "underline" : "none",
        textUnderlineOffset: "3px",
        opacity: hasText ? 1 : 0.38,
        whiteSpace: "normal",
        textAlign: "center",
      }}
    >
      {hasText ? block.buttonText : "Call to Action"}
      {isLink ? (
        <Box component="span" sx={{ ml: 0.75 }}>
          -&gt;
        </Box>
      ) : null}
    </Box>
  );
}

function SecondaryLink({ block }: { block: StudioBlock }) {
  if (!block.showSecondaryLink) {
    return null;
  }

  const hasText = Boolean(block.secondaryLinkText?.trim());

  return (
    <Box
      component={block.secondaryLinkUrl ? "a" : "span"}
      href={block.secondaryLinkUrl || undefined}
      onClick={(event) => event.preventDefault()}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        color: block.linkColor || block.textColor || "#111827",
        fontFamily: "var(--studio-font-button)",
        fontSize: "14px",
        fontWeight: 700,
        lineHeight: 1.25,
        textDecoration: "underline",
        textUnderlineOffset: "3px",
        opacity: hasText ? 0.78 : 0.34,
      }}
    >
      {hasText ? block.secondaryLinkText : "Secondary link"}
    </Box>
  );
}

function CTACopy({
  block,
  compact = false,
}: {
  block: StudioBlock;
  compact?: boolean;
}) {
  const textColor = block.textColor || "#111827";
  const align = block.textAlign || "center";
  const hasHeadline = Boolean(block.headline?.trim());
  const hasBody = hasRichText(block.body);

  return (
    <Stack
      spacing={compact ? 0.6 : 1}
      sx={{
        color: textColor,
        textAlign: align,
        minWidth: 0,
      }}
    >
      <Typography
        sx={{
          color: textColor,
          fontFamily: "var(--studio-font-headline)",
          fontSize: compact ? "19px" : "26px",
          fontWeight: 780,
          lineHeight: 1.12,
          opacity: hasHeadline ? 1 : 0.36,
        }}
      >
        {hasHeadline ? block.headline : "Your CTA headline"}
      </Typography>
      {hasBody ? (
        <Box
          sx={{
            color: textColor,
            fontFamily: "var(--studio-font-body)",
            fontSize: compact ? "13px" : "15px",
            lineHeight: 1.55,
            opacity: 0.78,
            "& p": { m: 0 },
            "& p + p": { mt: 0.75 },
            "& h1, & h2, & h3": {
              fontFamily: "var(--studio-font-headline)",
            },
            "& a": {
              color: "inherit",
              textDecoration: "underline",
              textUnderlineOffset: "2px",
            },
          }}
          dangerouslySetInnerHTML={{ __html: formatDraftRichText(block.body) }}
        />
      ) : (
        <Typography
          sx={{
            color: textColor,
            fontFamily: "var(--studio-font-body)",
            fontSize: compact ? "13px" : "15px",
            lineHeight: 1.55,
            opacity: 0.3,
          }}
        >
          Add a short description that gives readers one clear reason to act.
        </Typography>
      )}
    </Stack>
  );
}

export default function CTARenderer({ block }: CTARendererProps) {
  const layout = block.layout || "centered-hero";
  const backgroundColor = block.backgroundColor || "#ffffff";
  const paddingY = block.verticalPadding ?? 32;

  if (layout === "inline-button-only") {
    return (
      <Box
        sx={{
          bgcolor: backgroundColor,
          px: 3,
          py: `${paddingY}px`,
          textAlign: block.textAlign || "center",
        }}
      >
        <CTAButton block={block} />
      </Box>
    );
  }

  if (layout === "banner") {
    return (
      <Box sx={{ bgcolor: backgroundColor, px: 3, py: `${paddingY}px` }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2.5}
          alignItems={{ xs: "stretch", sm: "center" }}
          justifyContent="space-between"
        >
          <Box sx={{ flex: "1 1 auto", minWidth: 0 }}>
            <CTACopy block={{ ...block, textAlign: "left" }} compact />
          </Box>
          <Stack spacing={1} alignItems={{ xs: "flex-start", sm: "flex-end" }}>
            <CTAButton block={block} />
            <SecondaryLink block={block} />
          </Stack>
        </Stack>
      </Box>
    );
  }

  if (layout === "split") {
    return (
      <Box sx={{ bgcolor: backgroundColor, px: 3, py: `${paddingY}px` }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={3}
          alignItems={{ xs: "stretch", sm: "center" }}
          justifyContent="space-between"
        >
          <Box sx={{ flex: "1 1 58%", minWidth: 0 }}>
            <CTACopy block={{ ...block, textAlign: "left" }} />
          </Box>
          <Stack
            spacing={1.1}
            alignItems={{ xs: "flex-start", sm: "flex-end" }}
          >
            <CTAButton block={block} />
            <SecondaryLink block={block} />
          </Stack>
        </Stack>
      </Box>
    );
  }

  if (layout === "stacked-double") {
    return (
      <Box sx={{ bgcolor: backgroundColor, px: 3, py: `${paddingY}px` }}>
        <Stack
          spacing={2.2}
          alignItems="center"
          sx={{ maxWidth: 520, mx: "auto" }}
        >
          <CTACopy block={{ ...block, textAlign: "center" }} />
          <Stack spacing={1.1} alignItems="center" sx={{ width: "100%" }}>
            <CTAButton block={block} />
            <SecondaryLink block={block} />
          </Stack>
        </Stack>
      </Box>
    );
  }

  return (
    <Box sx={{ bgcolor: backgroundColor, px: 3, py: `${paddingY}px` }}>
      <Stack
        spacing={2.1}
        alignItems={
          block.textAlign === "left"
            ? "flex-start"
            : block.textAlign === "right"
              ? "flex-end"
              : "center"
        }
        sx={{ maxWidth: 540, mx: "auto" }}
      >
        <CTACopy block={block} />
        <Stack spacing={1} alignItems="center" sx={{ width: "100%" }}>
          <CTAButton block={block} />
          <SecondaryLink block={block} />
        </Stack>
      </Stack>
    </Box>
  );
}
