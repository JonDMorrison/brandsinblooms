import type { ElementType } from "react";
import type { BlockType } from "@/types/studioBlocks";
import {
  AlignLeft,
  Play,
  Navigation,
  Table2,
  BarChart3,
  Code2,
  ListChecks,
  CalendarDays,
  Megaphone,
  Sprout,
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
    label: "Start here",
    blocks: [
      {
        type: "preheader",
        name: "Top Line of Text",
        description: "A short line of text at the very top of your email",
        icon: AlignLeft,
      },
      {
        type: "headline",
        name: "Headline",
        description: "A big title to start a section",
        icon: Heading,
      },
      {
        type: "plain-text",
        name: "Text",
        description: "A paragraph of writing. Add bold, lists and links",
        icon: AlignLeft,
      },
      {
        type: "full-width-image",
        name: "Image",
        description: "One photo. It can link to your website",
        icon: Image,
      },
      {
        type: "image-text",
        name: "Image + Text",
        description: "A photo beside your words, with a button",
        icon: Columns,
      },
      {
        type: "text-columns",
        name: "Text Columns",
        description: "Writing side by side in two or three columns",
        icon: Columns,
      },
      {
        type: "call-to-action",
        name: "Button",
        description: "One button that sends people to your website",
        icon: MousePointerClick,
      },
      {
        type: "button-group",
        name: "Button Group",
        description: "Two or three buttons in a row",
        icon: MousePointerClick,
      },
      {
        type: "navigation",
        name: "Website Links",
        description: "A row of links to pages on your website",
        icon: Navigation,
      },
      {
        type: "youtube",
        name: "YouTube Video",
        description: "A video picture that opens on YouTube when clicked",
        icon: Play,
      },
      {
        type: "html",
        name: "HTML",
        description: "Your own HTML code, cleaned so it is safe in email",
        icon: Code2,
      },
    ],
  },
  {
    id: "layout",
    label: "Top, bottom and spacing",
    blocks: [
      {
        type: "newsletter-header",
        name: "Newsletter Header",
        description: "Your logo and newsletter name at the top",
        icon: Newspaper,
      },
      {
        type: "email-safe-hero",
        name: "Headline Banner",
        description: "A bold coloured banner with a headline and button",
        icon: Heading,
      },
      {
        type: "graphic-hero",
        name: "Photo Banner",
        description: "A large photo with a headline on top of it",
        icon: ImagePlus,
      },
      {
        type: "divider",
        name: "Divider Line",
        description: "A thin line between sections",
        icon: Minus,
      },
      {
        type: "spacer",
        name: "Space",
        description: "Empty space between sections",
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
    label: "Offers, events and news",
    blocks: [
      {
        type: "product-card",
        name: "Product Card",
        description: "One product with a photo, price and button",
        icon: ShoppingBag,
      },
      {
        type: "coupon",
        name: "Coupon / Promotion",
        description: "A coupon customers can show in store",
        icon: TicketPercent,
      },
      {
        type: "event",
        name: "Event / Workshop",
        description: "Invite people to an event or workshop",
        icon: CalendarDays,
      },
      {
        type: "blog",
        name: "Blog Post",
        description: "Share a blog post with a link to read it",
        icon: Newspaper,
      },
      {
        type: "announcement",
        name: "Announcement",
        description: "Share important news, like new hours",
        icon: Megaphone,
      },
      {
        type: "plant-care",
        name: "Plant Care Spotlight",
        description: "Feature one plant with its light, water and care tips",
        icon: Sprout,
      },
      {
        type: "quote",
        name: "Quote",
        description: "A kind word from a customer",
        icon: Quote,
      },
    ],
  },
  {
    id: "galleries",
    label: "Photo grids and more",
    blocks: [
      {
        type: "image-gallery",
        name: "Image Gallery",
        description: "Several photos in a grid",
        icon: Grid3X3,
      },
      {
        type: "product-gallery",
        name: "Product Gallery",
        description: "Several products with prices in a grid",
        icon: LayoutGrid,
      },
      {
        type: "data-table",
        name: "Table",
        description: "A simple table, like a price list",
        icon: Table2,
      },
      {
        type: "chart",
        name: "Chart",
        description: "A simple chart to compare numbers",
        icon: BarChart3,
      },
      {
        type: "survey",
        name: "Poll / Survey",
        description: "Ask a question. Each answer is a link",
        icon: ListChecks,
      },
      {
        type: "social-follow",
        name: "Social Media Links",
        description: "Links to your Facebook, Instagram and more",
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

// Block names changed to plain language. Blocks created before that still
// store the old default name as their label, so show the current name for
// those. A name the person typed themselves is always kept.
const LEGACY_DEFAULT_BLOCK_NAMES: Partial<Record<StudioBlockType, string>> = {
  preheader: "Preview Text",
  "email-safe-hero": "Email Safe Hero",
  "graphic-hero": "Graphic Hero",
  "call-to-action": "Button / Call to Action",
  navigation: "Navigation",
  blog: "Blog Feature",
  "data-table": "Data Table",
  chart: "Bar Chart",
  "social-follow": "Social Follow",
  spacer: "Spacer",
  divider: "Divider",
};

export function getBlockDisplayLabel(block: {
  type: StudioBlockType;
  label?: string | null;
}) {
  const currentName = STUDIO_BLOCK_LOOKUP[block.type]?.name ?? block.type;
  const label = (block.label || "").trim();
  if (!label || label === LEGACY_DEFAULT_BLOCK_NAMES[block.type]) {
    return currentName;
  }
  return label;
}
