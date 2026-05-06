import Box from "@mui/joy/Box";
import Typography from "@mui/joy/Typography";
import CTARenderer from "@/components/crm/studio/blocks/CTARenderer";
import DividerRenderer from "@/components/crm/studio/blocks/DividerRenderer";
import EmailSafeHeroRenderer from "@/components/crm/studio/blocks/EmailSafeHeroRenderer";
import FooterRenderer from "@/components/crm/studio/blocks/FooterRenderer";
import FullWidthImageRenderer from "@/components/crm/studio/blocks/FullWidthImageRenderer";
import GraphicHeroRenderer from "@/components/crm/studio/blocks/GraphicHeroRenderer";
import ImageGalleryRenderer from "@/components/crm/studio/blocks/ImageGalleryRenderer";
import ImageTextRenderer from "@/components/crm/studio/blocks/ImageTextRenderer";
import NewsletterHeaderRenderer from "@/components/crm/studio/blocks/NewsletterHeaderRenderer";
import PlainTextRenderer from "@/components/crm/studio/blocks/PlainTextRenderer";
import ProductCardRenderer from "@/components/crm/studio/blocks/ProductCardRenderer";
import ProductGalleryRenderer from "@/components/crm/studio/blocks/ProductGalleryRenderer";
import QuoteRenderer from "@/components/crm/studio/blocks/QuoteRenderer";
import SocialFollowRenderer from "@/components/crm/studio/blocks/SocialFollowRenderer";
import SpacerRenderer from "@/components/crm/studio/blocks/SpacerRenderer";
import { useDesignSystem } from "@/contexts/DesignSystemContext";
import type { StudioBlock } from "@/types/studioBlocks";

type BlockRendererProps = {
  block: StudioBlock;
  onUpdateBlockField?: (
    blockId: string,
    field: keyof StudioBlock,
    value: StudioBlock[keyof StudioBlock],
  ) => void;
};

export default function BlockRenderer({
  block,
  onUpdateBlockField,
}: BlockRendererProps) {
  const { designSystem } = useDesignSystem();

  const renderedBlock = (() => {
    switch (block.type) {
      case "email-safe-hero":
        return <EmailSafeHeroRenderer block={block} />;
      case "graphic-hero":
        return <GraphicHeroRenderer block={block} />;
      case "full-width-image":
        return <FullWidthImageRenderer block={block} />;
      case "newsletter-header":
        return <NewsletterHeaderRenderer block={block} />;
      case "image-text":
        return <ImageTextRenderer block={block} />;
      case "plain-text":
        return <PlainTextRenderer block={block} />;
      case "quote":
        return <QuoteRenderer block={block} />;
      case "product-card":
        return <ProductCardRenderer block={block} />;
      case "call-to-action":
        return <CTARenderer block={block} />;
      case "social-follow":
        return <SocialFollowRenderer block={block} />;
      case "divider":
        return <DividerRenderer block={block} />;
      case "spacer":
        return <SpacerRenderer block={block} />;
      case "footer":
        return <FooterRenderer block={block} />;
      case "image-gallery":
        return (
          <ImageGalleryRenderer
            block={block}
            onUpdateBlockField={onUpdateBlockField}
          />
        );
      case "product-gallery":
        return <ProductGalleryRenderer block={block} />;
      default:
        return (
          <Box
            sx={{
              p: 4,
              textAlign: "center",
              bgcolor: "neutral.50",
              borderRadius: "4px",
            }}
          >
            <Typography level="body-sm" sx={{ color: "neutral.500" }}>
              {block.label || block.type}
            </Typography>
          </Box>
        );
    }
  })();

  return (
    <Box
      sx={{
        "--studio-font-brand": designSystem.typography.brandFamily,
        "--studio-font-headline": designSystem.typography.headlineFamily,
        "--studio-font-subheading": designSystem.typography.subheadingFamily,
        "--studio-font-body": designSystem.typography.bodyFamily,
        "--studio-font-button": designSystem.typography.buttonFamily,
        "--joy-fontFamily-body": designSystem.typography.bodyFamily,
        "--joy-fontFamily-display": designSystem.typography.headlineFamily,
        fontFamily: "var(--studio-font-body)",
      }}
    >
      {renderedBlock}
    </Box>
  );
}
