// Hardcoded social-post templates surfaced in PostComposerModal and prefilled
// into the /publish composer when a template card is clicked.
//
// TODO: replace hardcoded seasonal templates with date-aware or AI-generated
// alternatives. The current copy ("Spring is here!" etc.) becomes stale by
// season — a May visitor still sees a "Spring is here!" template. Tracked
// separately from the click-handler fix; do not address inline.

export interface PostTemplate {
  id: string;
  title: string;
  description: string;
  category: string;
  content: string;
}

export const postTemplates: PostTemplate[] = [
  {
    id: "seasonal-tips",
    title: "Seasonal Garden Tips",
    description: "Share helpful gardening advice for the current season",
    category: "Educational",
    content:
      "Spring is here! 🌸 Time to prepare your garden for the growing season...",
  },
  {
    id: "product-showcase",
    title: "Product Showcase",
    description: "Highlight featured plants or garden supplies",
    category: "Product",
    content:
      "Check out these beautiful succulents! Perfect for beginners...",
  },
  {
    id: "behind-scenes",
    title: "Behind the Scenes",
    description: "Show your team or garden center in action",
    category: "Personal",
    content:
      "Our team is hard at work preparing for spring arrivals...",
  },
];

export function findPostTemplate(id: string | null | undefined): PostTemplate | null {
  if (!id) return null;
  return postTemplates.find((template) => template.id === id) ?? null;
}
