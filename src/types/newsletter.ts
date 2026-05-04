import type { StudioBlock } from "@/types/studioBlocks";

export type NewsletterIdeaTemplateBlockType =
  | "header"
  | "hero"
  | "email-safe-hero"
  | "graphic-hero"
  | "newsletter-header"
  | "image-text"
  | "text"
  | "plain-text"
  | "image"
  | "full-width-image"
  | "button"
  | "cta"
  | "call-to-action"
  | "quote"
  | "divider"
  | "spacer"
  | "product"
  | "product-card"
  | "image-gallery"
  | "product-gallery"
  | "social-follow"
  | "footer"
  | (string & {});

type NewsletterIdeaStudioFieldSubset = Pick<
  StudioBlock,
  | "headline"
  | "subheading"
  | "body"
  | "tagLabel"
  | "tagline"
  | "dateLabel"
  | "imageUrl"
  | "imageAlt"
  | "caption"
  | "showCaption"
  | "buttonText"
  | "buttonUrl"
  | "quoteText"
  | "authorName"
  | "authorTitle"
  | "businessName"
  | "address"
  | "websiteUrl"
  | "complianceText"
  | "galleryImages"
  | "galleryProducts"
  | "socialLinks"
  | "productName"
  | "productPrice"
  | "originalPrice"
  | "productDescription"
  | "badgeText"
>;

export interface NewsletterIdeaTemplateBlock
  extends Partial<NewsletterIdeaStudioFieldSubset> {
  type: NewsletterIdeaTemplateBlockType;
  title?: string;
  content?: string;
  description?: string;
  image_url?: string;
  altText?: string;
  ctaText?: string;
  cta_text?: string;
  ctaUrl?: string;
  cta_url?: string;
  image_prompt?: string;
}

export interface NewsletterIdea {
  id: string;
  title: string;
  description: string;
  category: 'holiday' | 'seasonal' | 'product' | 'ai-generated' | 'general' | 'weekly';
  badge?: string;
  previewHtml?: string;
  templateBlocks: NewsletterIdeaTemplateBlock[];
  heroQuery?: string;
  estimatedReadTime?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  priority?: number;
  daysUntil?: number;
  weekNumber?: number;
}

export interface NewsletterTemplate {
  id: string;
  name: string;
  layout: 'block-builder' | 'simple-email';
  thumbnail: string;
  description: string;
  isDefault?: boolean;
}

export interface NewsletterPickerData {
  ideas: NewsletterIdea[];
  templates: NewsletterTemplate[];
  loading: boolean;
  error?: string;
}