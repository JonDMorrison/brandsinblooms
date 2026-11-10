import type { ElementType } from "react";
import type { BlockType } from "@/types/studioBlocks";
import {
  AlignLeft,
  Play,
  Navigation,
  Table2,
  BarChart3,
  ListChecks,
  CalendarDays,
  Megaphone,
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
  TicketPercent,
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
    id: "basics",
    label: "Basic blocks",
    blocks: [
      {
        type: "preheader",
        name: "Preview Text",
        description: "Visible preview line above your newsletter header",
        icon: AlignLeft,
      },
      {
        type: "headline",
        name: "Headline",
        description: "H1–H6 heading with individual typography",
        icon: Heading,
      },
      {
        type: "plain-text",
        name: "Text",
        description: "Rich text, lists and links",
        icon: AlignLeft,
      },
      {
        type: "full-width-image",
        name: "Image",
        description: "A linked image or banner without text overlays",
        icon: Image,
      },
      {
        type: "image-text",
        name: "Image + Text",
        description: "Side-by-side photo and flexible text",
        icon: Columns,
      },
      {
        type: "text-columns",
        name: "Text Columns",
        description: "One, two or three columns of rich text",
        icon: Columns,
      },
      {
        type: "call-to-action",
        name: "Button / Call to Action",
        description: "A button with optional heading and supporting copy",
        icon: MousePointerClick,
      },
      {
        type: "button-group",
        name: "Button Group",
        description: "One to three buttons across a row",
        icon: MousePointerClick,
      },
      {
        type: "navigation",
        name: "Navigation",
        description: "One to five labelled website links",
        icon: Navigation,
      },
      {
        type: "youtube",
        name: "YouTube Video",
        description: "Clickable video thumbnail that opens YouTube",
        icon: Play,
      },
    ],
  },
  {
    id: "layout",
    label: "Layout & structure",
    blocks: [
      {
        type: "newsletter-header",
        name: "Newsletter Header",
        description: "Logo, title, subtitle, date and banner",
        icon: Newspaper,
      },
      {
        type: "email-safe-hero",
        name: "Email Safe Hero",
        description: "Editable heading, copy and optional photograph",
        icon: Heading,
      },
      {
        type: "graphic-hero",
        name: "Graphic Hero",
        description: "Image with optional text, overlay and gradient",
        icon: ImagePlus,
      },
      {
        type: "divider",
        name: "Divider",
        description: "One line style control, with colour and thickness",
        icon: Minus,
      },
      {
        type: "spacer",
        name: "Spacer",
        description: "Adjustable space between blocks",
        icon: MoveVertical,
      },
      {
        type: "footer",
        name: "Footer",
        description: "Business details and required unsubscribe links",
        icon: PanelBottom,
      },
    ],
  },
  {
    id: "presets",
    label: "Ready-made promotions",
    blocks: [
      {
        type: "product-card",
        name: "Product Card",
        description: "Product, alternate name, price and badges",
        icon: ShoppingBag,
      },
      {
        type: "coupon",
        name: "Coupon / Promotion",
        description: "Price offers, conditions, expiry and optional cut line",
        icon: TicketPercent,
      },
      {
        type: "event",
        name: "Event / Workshop",
        description: "Photo, date, location and booking link",
        icon: CalendarDays,
      },
      {
        type: "blog",
        name: "Blog Feature",
        description: "Article image, introduction and read-more link",
        icon: Newspaper,
      },
      {
        type: "announcement",
        name: "Announcement",
        description: "Important news with an optional photo and button",
        icon: Megaphone,
      },
      {
        type: "quote",
        name: "Quote",
        description: "Customer quotation and attribution",
        icon: Quote,
      },
    ],
  },
  {
    id: "galleries",
    label: "Galleries & data",
    blocks: [
      {
        type: "image-gallery",
        name: "Image Gallery",
        description: "One to four images per row or feature + grid",
        icon: Grid3X3,
      },
      {
        type: "product-gallery",
        name: "Product Gallery",
        description: "One to four linked products per row",
        icon: LayoutGrid,
      },
      {
        type: "data-table",
        name: "Data Table",
        description: "Accessible rows and columns with a caption",
        icon: Table2,
      },
      {
        type: "chart",
        name: "Bar Chart",
        description: "Email-safe labelled horizontal bars",
        icon: BarChart3,
      },
      {
        type: "survey",
        name: "Poll / Survey",
        description: "A question with links to your survey answers",
        icon: ListChecks,
      },
      {
        type: "social-follow",
        name: "Social Follow",
        description: "Your configured social profile links",
        icon: Share2,
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
