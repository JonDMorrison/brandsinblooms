import Box from "@mui/joy/Box";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { ImagePlus } from "lucide-react";
import { formatDraftRichText } from "@/lib/crm/htmlContent";
import type { StudioBlock } from "@/types/studioBlocks";

type ProductCardRendererProps = {
  block: StudioBlock;
};

function ProductImage({
  block,
  wide = false,
}: {
  block: StudioBlock;
  wide?: boolean;
}) {
  const imageRadius = block.borderRadius ?? 8;
  const badgeText = block.badgeText?.trim();
  const badgePosition = block.badgePosition ?? "top-left";
  const showBadge = block.showBadges ?? Boolean(badgeText);

  return (
    <Box sx={{ position: "relative", width: "100%" }}>
      {block.imageUrl ? (
        <Box
          component="img"
          src={block.imageUrl}
          alt={block.imageAlt || block.productName || ""}
          sx={{
            width: "100%",
            height: wide ? 220 : 190,
            display: "block",
            objectFit: block.imageFit || "cover",
            borderRadius: `${imageRadius}px`,
            bgcolor: "neutral.100",
          }}
        />
      ) : (
        <Box
          sx={{
            height: wide ? 220 : 190,
            borderRadius: `${imageRadius}px`,
            border: "1.5px dashed",
            borderColor: "neutral.200",
            bgcolor: "neutral.50",
            color: "neutral.300",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Stack spacing={0.75} alignItems="center">
            <ImagePlus size={26} />
            <Typography level="body-xs" sx={{ color: "neutral.400" }}>
              Product image
            </Typography>
          </Stack>
        </Box>
      )}
      {showBadge && badgeText ? (
        <Box
          sx={{
            position: "absolute",
            top: 10,
            left: badgePosition === "top-left" ? 10 : "auto",
            right: badgePosition === "top-right" ? 10 : "auto",
            px: 1,
            py: 0.4,
            borderRadius: "999px",
            bgcolor: block.badgeColor || "#111827",
            color: block.badgeTextColor || "#ffffff",
            fontFamily: "var(--studio-font-button)",
            fontSize: "10px",
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          {badgeText}
        </Box>
      ) : null}
    </Box>
  );
}

function ProductButton({ block }: { block: StudioBlock }) {
  const hasText = Boolean(block.buttonText?.trim());
  const style = block.buttonStyle ?? "filled";
  const textColor = block.textColor || "#111827";
  const filled = style === "filled";
  const outlined = style === "outlined";
  const buttonColor = block.buttonColor || textColor;
  const buttonTextColor =
    block.buttonTextColor || (filled ? "#ffffff" : buttonColor);

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
        minHeight: 36,
        px: filled || outlined ? 2.25 : 0,
        py: filled || outlined ? 1 : 0,
        borderRadius: filled || outlined ? "999px" : 0,
        border: outlined ? "1px solid" : 0,
        borderColor: buttonColor,
        bgcolor: filled ? buttonColor : "transparent",
        color: filled ? buttonTextColor : block.buttonTextColor || buttonColor,
        textDecoration: "none",
        fontFamily: "var(--studio-font-button)",
        fontSize: "14px",
        fontWeight: 750,
        lineHeight: 1.2,
        opacity: hasText ? 1 : 0.38,
      }}
    >
      {hasText ? block.buttonText : "Shop Now"}
      {style === "link" ? (
        <Box component="span" sx={{ ml: 0.75 }}>
          -&gt;
        </Box>
      ) : null}
    </Box>
  );
}

function ProductDetails({
  block,
  centered = false,
  minimal = false,
}: {
  block: StudioBlock;
  centered?: boolean;
  minimal?: boolean;
}) {
  const textColor = block.textColor || "#111827";
  const hasName = Boolean(block.productName?.trim());
  const hasPrice = Boolean(block.productPrice?.trim());
  const hasDescription = Boolean(
    block.productDescription
      ?.replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .trim(),
  );

  return (
    <Stack
      spacing={1.15}
      alignItems={centered ? "center" : "flex-start"}
      sx={{ textAlign: centered ? "center" : "left" }}
    >
      {minimal ? (
        <Stack
          direction="row"
          spacing={2}
          alignItems="baseline"
          justifyContent="space-between"
          sx={{ width: "100%" }}
        >
          <Typography
            sx={{
              color: textColor,
              fontFamily: "var(--studio-font-headline)",
              fontSize: "20px",
              fontWeight: 750,
              lineHeight: 1.2,
              opacity: hasName ? 1 : 0.36,
            }}
          >
            {hasName ? block.productName : "Product Name"}
          </Typography>
          <Typography
            sx={{
              color: textColor,
              fontFamily: "var(--studio-font-subheading)",
              fontSize: "16px",
              fontWeight: 750,
              lineHeight: 1.2,
              opacity: hasPrice ? 0.86 : 0.34,
              whiteSpace: "nowrap",
            }}
          >
            {hasPrice ? block.productPrice : "$29.99"}
          </Typography>
          {block.originalPrice?.trim() ? (
            <Typography
              sx={{
                color: textColor,
                fontFamily: "var(--studio-font-body)",
                fontSize: "13px",
                lineHeight: 1,
                opacity: 0.45,
                textDecoration: "line-through",
                whiteSpace: "nowrap",
              }}
            >
              {block.originalPrice}
            </Typography>
          ) : null}
        </Stack>
      ) : (
        <>
          <Typography
            sx={{
              color: textColor,
              fontFamily: "var(--studio-font-headline)",
              fontSize: "21px",
              fontWeight: 750,
              lineHeight: 1.18,
              opacity: hasName ? 1 : 0.36,
            }}
          >
            {hasName ? block.productName : "Product Name"}
          </Typography>
          <Typography
            sx={{
              color: textColor,
              fontFamily: "var(--studio-font-subheading)",
              fontSize: "17px",
              fontWeight: 750,
              lineHeight: 1.2,
              opacity: hasPrice ? 0.86 : 0.34,
            }}
          >
            {hasPrice ? block.productPrice : "$29.99"}
          </Typography>
          {block.originalPrice?.trim() ? (
            <Typography
              sx={{
                color: textColor,
                fontFamily: "var(--studio-font-body)",
                fontSize: "13px",
                lineHeight: 1,
                opacity: 0.45,
                textDecoration: "line-through",
              }}
            >
              {block.originalPrice}
            </Typography>
          ) : null}
        </>
      )}
      {hasDescription ? (
        <Box
          sx={{
            color: textColor,
            fontFamily: "var(--studio-font-body)",
            fontSize: "14px",
            lineHeight: 1.55,
            opacity: 0.7,
            "& p": { m: 0 },
            "& p + p": { mt: 0.75 },
          }}
          dangerouslySetInnerHTML={{
            __html: formatDraftRichText(block.productDescription),
          }}
        />
      ) : (
        <Typography
          sx={{
            color: textColor,
            fontFamily: "var(--studio-font-body)",
            fontSize: "14px",
            lineHeight: 1.55,
            opacity: 0.32,
          }}
        >
          Short product description text here.
        </Typography>
      )}
      <Box sx={{ pt: 0.75, width: block.fullWidthButton ? "100%" : "auto" }}>
        <ProductButton block={block} />
      </Box>
    </Stack>
  );
}

export default function ProductCardRenderer({
  block,
}: ProductCardRendererProps) {
  const layout = block.layout || "standard";
  const showBorder = block.showCardBorder ?? block.showBorder ?? true;
  const border = showBorder ? "1px solid" : "none";
  const borderColor = showBorder ? "neutral.200" : "transparent";
  const borderRadius = block.cardBorderRadius ?? 12;

  if (layout === "minimal") {
    return (
      <Box sx={{ bgcolor: block.backgroundColor || "#ffffff", p: "24px" }}>
        <Box
          sx={{ border, borderColor, borderRadius: `${borderRadius}px`, p: 3 }}
        >
          <ProductDetails block={block} minimal />
        </Box>
      </Box>
    );
  }

  if (layout === "centered") {
    return (
      <Box sx={{ bgcolor: block.backgroundColor || "#ffffff", p: "24px" }}>
        <Box
          sx={{ border, borderColor, borderRadius: `${borderRadius}px`, p: 3 }}
        >
          <Stack spacing={2.25} alignItems="center">
            <ProductImage block={block} wide />
            <ProductDetails block={block} centered />
          </Stack>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ bgcolor: block.backgroundColor || "#ffffff", p: "24px" }}>
      <Box
        sx={{ border, borderColor, borderRadius: `${borderRadius}px`, p: 3 }}
      >
        <Stack direction="row" spacing={3} alignItems="center">
          <Box sx={{ flex: "0 0 40%", minWidth: 0 }}>
            <ProductImage block={block} />
          </Box>
          <Box sx={{ flex: "1 1 60%", minWidth: 0 }}>
            <ProductDetails block={block} />
          </Box>
        </Stack>
      </Box>
    </Box>
  );
}
