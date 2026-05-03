import type { ElementType } from "react";
import type { BlockType } from "@/types/studioBlocks";
import {
  AlignLeft,
  Columns,
  Grid3X3,
  Heading,
  Image,
  ImagePlus,
  LayoutGrid,
  Minus,
  MousePointerClick,
  MoveVertical,
  Newspaper,
  PanelBottom,
  Quote,
  Share2,
  ShoppingBag,
} from "lucide-react";

export type StudioBlockType = BlockType;

export type StudioBlockDefinition = {
  type: StudioBlockType;
  name: string;
  description: string;
  icon: ElementType;
};

export type BlockCategory = {
  id: string;
  label: string;
  blocks: StudioBlockDefinition[];
};

export const BLOCK_CATEGORIES: BlockCategory[] = [
  {
    id: "hero-headers",
    label: "Hero & Headers",
    blocks: [
      {
        type: "email-safe-hero",
        name: "Email Safe Hero",
        description: "Text on solid or gradient background - works everywhere",
        icon: Heading,
      },
      {
        type: "graphic-hero",
        name: "Graphic Hero",
        description:
          "Full image with baked-in text - perfect for Canva designs",
        icon: ImagePlus,
      },
      {
        type: "full-width-image",
        name: "Full-Width Image",
        description: "Responsive image spanning full width",
        icon: Image,
      },
      {
        type: "newsletter-header",
        name: "Newsletter Header",
        description: "Branded header with logo and date",
        icon: Newspaper,
      },
    ],
  },
  {
    id: "content",
    label: "Content",
    blocks: [
      {
        type: "image-text",
        name: "Image + Text",
        description: "Side-by-side image and text layout",
        icon: Columns,
      },
      {
        type: "plain-text",
        name: "Plain Text",
        description: "Single column body text",
        icon: AlignLeft,
      },
      {
        type: "quote",
        name: "Quote",
        description: "Styled blockquote with author attribution",
        icon: Quote,
      },
      {
        type: "product-card",
        name: "Product Card",
        description: "Product image, name, price, and CTA",
        icon: ShoppingBag,
      },
    ],
  },
  {
    id: "media",
    label: "Media",
    blocks: [
      {
        type: "image-gallery",
        name: "Image Gallery",
        description: "Grid of 3, 6, or 9 images",
        icon: Grid3X3,
      },
      {
        type: "product-gallery",
        name: "Product Gallery",
        description: "2x2 product grid with badges",
        icon: LayoutGrid,
      },
    ],
  },
  {
    id: "actions",
    label: "Actions",
    blocks: [
      {
        type: "call-to-action",
        name: "Call to Action",
        description: "Button with customizable link",
        icon: MousePointerClick,
      },
      {
        type: "social-follow",
        name: "Social Follow",
        description: "Social media icon links",
        icon: Share2,
      },
    ],
  },
  {
    id: "layout",
    label: "Layout",
    blocks: [
      {
        type: "divider",
        name: "Divider",
        description: "Horizontal line separator",
        icon: Minus,
      },
      {
        type: "spacer",
        name: "Spacer",
        description: "Adjustable vertical space",
        icon: MoveVertical,
      },
    ],
  },
  {
    id: "footer",
    label: "Footer",
    blocks: [
      {
        type: "footer",
        name: "Footer",
        description: "Business info, unsubscribe, and compliance links",
        icon: PanelBottom,
      },
    ],
  },
];

export const STUDIO_BLOCK_LOOKUP = BLOCK_CATEGORIES.flatMap(
  (category) => category.blocks,
).reduce<Record<StudioBlockType, StudioBlockDefinition>>(
  (lookup, block) => {
    lookup[block.type] = block;
    return lookup;
  },
  {} as Record<StudioBlockType, StudioBlockDefinition>,
);
