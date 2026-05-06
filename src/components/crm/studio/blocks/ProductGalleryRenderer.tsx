import Box from "@mui/joy/Box";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { ImagePlus } from "lucide-react";
import type { GalleryProduct, StudioBlock } from "@/types/studioBlocks";

type ProductGalleryRendererProps = {
  block: StudioBlock;
};

function getDisplayProducts(block: StudioBlock): GalleryProduct[] {
  const products = block.galleryProducts ?? [];

  if (products.length > 0) {
    return products;
  }

  return Array.from(
    { length: block.layout === "feature-product" ? 1 : 4 },
    (_item, index) => ({
      id: `placeholder-product-${index}`,
      imageUrl: "",
      name: "",
      price: "",
    }),
  );
}

function ProductImage({
  product,
  block,
  feature = false,
}: {
  product: GalleryProduct;
  block: StudioBlock;
  feature?: boolean;
}) {
  const height = feature
    ? (block.imageHeight ?? 220)
    : (block.imageHeight ?? 160);
  const showBadge =
    block.showBadges !== false && Boolean(product.badgeText?.trim());
  const cardRadius = block.cardBorderRadius ?? 12;

  return (
    <Box sx={{ position: "relative", width: "100%" }}>
      {product.imageUrl ? (
        <Box
          component="img"
          src={product.imageUrl}
          alt={product.name || ""}
          sx={{
            width: "100%",
            height,
            display: "block",
            objectFit: "cover",
            objectPosition: "center",
            borderRadius: feature
              ? `${cardRadius}px`
              : `${cardRadius}px ${cardRadius}px 0 0`,
            bgcolor: "neutral.100",
          }}
        />
      ) : (
        <Box
          sx={{
            height,
            borderRadius: feature
              ? `${cardRadius}px`
              : `${cardRadius}px ${cardRadius}px 0 0`,
            bgcolor: "neutral.50",
            border: "1.5px dashed",
            borderColor: "neutral.200",
            color: "neutral.300",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Stack spacing={0.75} alignItems="center">
            <ImagePlus size={24} />
            <Typography level="body-xs" sx={{ color: "neutral.400" }}>
              Product image
            </Typography>
          </Stack>
        </Box>
      )}
      {showBadge ? (
        <Box
          sx={{
            position: "absolute",
            top: 8,
            right: 8,
            bgcolor: product.badgeColor || "danger.500",
            color: "#fff",
            fontSize: "10px",
            fontWeight: 700,
            lineHeight: 1.2,
            px: 1,
            py: 0.25,
            borderRadius: "4px",
            textTransform: "uppercase",
          }}
        >
          {product.badgeText}
        </Box>
      ) : null}
    </Box>
  );
}

function ProductDetails({
  product,
  block,
  feature = false,
}: {
  product: GalleryProduct;
  block: StudioBlock;
  feature?: boolean;
}) {
  const textColor = block.textColor || "#111827";
  const hasName = Boolean(product.name?.trim());
  const hasPrice = Boolean(product.price?.trim());
  const hasDescription = Boolean(product.description?.trim());
  const showPrices = block.showPrices !== false;
  const showOriginalPrice = block.showOriginalPrice ?? false;
  const showDescription = block.showDescription ?? true;
  const showCta = block.showCtaButtons !== false;
  const buttonText = product.buttonText?.trim();

  return (
    <Stack spacing={0.75} sx={{ p: feature ? 0 : 1.5 }}>
      <Typography
        sx={{
          color: textColor,
          fontSize: feature ? "20px" : "14px",
          fontWeight: 700,
          lineHeight: 1.25,
          opacity: hasName ? 1 : 0.36,
        }}
      >
        {hasName ? product.name : "Product Name"}
      </Typography>
      {showPrices ? (
        <Stack direction="row" spacing={0.75} alignItems="baseline">
          <Typography
            sx={{
              fontSize: feature ? "18px" : "16px",
              fontWeight: 700,
              color: textColor,
              opacity: hasPrice ? 1 : 0.36,
            }}
          >
            {hasPrice ? product.price : "$29.99"}
          </Typography>
          {showOriginalPrice && product.originalPrice?.trim() ? (
            <Typography
              sx={{
                color: "neutral.400",
                fontSize: "13px",
                textDecoration: "line-through",
              }}
            >
              {product.originalPrice}
            </Typography>
          ) : null}
        </Stack>
      ) : null}
      {showDescription && (feature || hasDescription) ? (
        <Typography
          sx={{
            color: textColor,
            fontSize: "13px",
            lineHeight: 1.5,
            opacity: hasDescription ? 0.64 : 0.32,
            whiteSpace: "pre-line",
          }}
        >
          {hasDescription
            ? product.description
            : "Product description appears here."}
        </Typography>
      ) : null}
      {showCta ? (
        <Box
          component={product.buttonUrl ? "a" : "span"}
          href={product.buttonUrl || undefined}
          onClick={(event) => event.preventDefault()}
          sx={{
            alignSelf: "flex-start",
            mt: 0.5,
            px: 1.5,
            py: 0.65,
            border: "1px solid",
            borderColor: textColor,
            borderRadius: "6px",
            color: textColor,
            fontSize: "12px",
            fontWeight: 700,
            lineHeight: 1.2,
            textDecoration: "none",
            opacity: buttonText ? 1 : 0.38,
          }}
        >
          {buttonText || "Shop"}
        </Box>
      ) : null}
    </Stack>
  );
}

function ProductCard({
  product,
  block,
}: {
  product: GalleryProduct;
  block: StudioBlock;
}) {
  return (
    <Box
      sx={{
        bgcolor: block.cardBackgroundColor || "#ffffff",
        border:
          (block.showCardBorder ?? block.showBorder) === false
            ? "none"
            : "1px solid",
        borderColor: "neutral.100",
        borderRadius: `${block.cardBorderRadius ?? 12}px`,
        overflow: "hidden",
      }}
    >
      <ProductImage product={product} block={block} />
      <ProductDetails product={product} block={block} />
    </Box>
  );
}

export default function ProductGalleryRenderer({
  block,
}: ProductGalleryRendererProps) {
  const products = getDisplayProducts(block);
  const gap = block.cardGap ?? 16;

  if (block.layout === "feature-product") {
    const product = products[0];

    return (
      <Box sx={{ bgcolor: block.backgroundColor || "#ffffff", p: "16px" }}>
        <Box
          sx={{
            bgcolor: block.cardBackgroundColor || "#ffffff",
            border:
              (block.showCardBorder ?? block.showBorder) === false
                ? "none"
                : "1px solid",
            borderColor: "neutral.100",
            borderRadius: `${block.cardBorderRadius ?? 12}px`,
            p: 2,
          }}
        >
          <Stack direction="row" spacing={2.5} alignItems="center">
            <Box sx={{ flex: "0 0 44%", minWidth: 0 }}>
              <ProductImage product={product} block={block} feature />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <ProductDetails product={product} block={block} feature />
            </Box>
          </Stack>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ bgcolor: block.backgroundColor || "#ffffff", p: "16px" }}>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: `repeat(${block.gridColumns ?? 2}, minmax(0, 1fr))`,
          gap: `${gap}px`,
        }}
      >
        {products.map((product) => (
          <ProductCard key={product.id} product={product} block={block} />
        ))}
      </Box>
    </Box>
  );
}
