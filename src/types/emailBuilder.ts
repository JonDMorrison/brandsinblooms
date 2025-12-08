
// CRITICAL: 'text' type deprecated for weekly themes - all content blocks should use 'image-text'
// 'text' type kept temporarily for backward compatibility with existing campaigns
export type BlockType = 'header' | 'text' | 'image' | 'image-text' | 'button' | 'divider' | 'product' | 'quote' | 'cta' | 'newsletter-header' | 'image-gallery' | 'social-follow' | 'footer';
export type BlockLayout = 'full-width' | 'two-column-left' | 'two-column-right' | 'three-column' | 'image-60-40' | 'image-70-30' | 'image-overlay' | 'image-background' | 'overlay' | 'background' | 'image-left' | 'image-right' | 'text-left';
export type AlignmentType = 'left' | 'center' | 'right' | 'justify';
export type SpacingType = 'none' | 'small' | 'medium' | 'large' | 'extra-large';
export type ResponsiveBehaviorType = 'stack' | 'reverse' | 'hide-image' | 'mobile-first';
export type ImageSizeType = 'small' | 'medium' | 'large' | 'full-width' | 'cover';
export type ImagePositionType = 'left' | 'right' | 'center' | 'background' | 'overlay';

/**
 * Block status for tracking content state
 * - "empty": Block created with placeholders, no real content
 * - "ai-generated": AI writer created content for this block
 * - "user-edited": User manually edited headline, body, CTA, or other visible content
 */
export type BlockStatus = 'empty' | 'ai-generated' | 'user-edited';

export interface EmailBlock {
  id: string;
  block_type: BlockType;
  content: Record<string, any>;
  image_url?: string;
  cta_url?: string;
  cta_text?: string;
  source?: string;
  persona_tag?: string;
  order_index: number;
  campaign_id: string;
  created_at?: string;
  updated_at?: string;
}

export interface GlobalSettings {
  fontFamily: string;
  fontSize: string;
  
  // Granular typography fonts
  headlineFont?: string;
  subheadingFont?: string;
  bodyFont?: string;
  buttonFont?: string;
  
  buttonStyle: {
    cornerRadius: string;
    backgroundColor: string;
    textColor: string;
  };
  headerStyle: {
    backgroundColor: string;
    textColor: string;
  };
  footerStyle: {
    backgroundColor: string;
    textColor: string;
  };
}

export interface ContentBlock {
  id: string;
  type: BlockType;
  title?: string;
  content?: string;
  imageUrl?: string | null; // Explicit null means user deleted the image
  imageQuery?: string; // AI-generated image search query
  ctaText?: string;
  ctaUrl?: string;
  source: 'newsletter' | 'ai' | 'template' | 'manual';
  personaTag?: string;
  layout?: BlockLayout;
  isWeeklyTheme?: boolean; // Flag for weekly theme enforcement
  
  // BLOCK STATUS - controls hydration and default injection behavior
  status?: BlockStatus;
  
  // Layout & Structure
  collapsed?: boolean;
  alignment?: AlignmentType;
  textAlign?: AlignmentType;
  padding?: SpacingType;
  margin?: SpacingType;
  responsiveBehavior?: ResponsiveBehaviorType;
  
  // Visual Settings
  visible?: boolean;
  backgroundColor?: string;
  textColor?: string;
  animation?: 'none' | 'fade-in' | 'slide-up' | 'scale-in';
  
  // Enhanced Image Settings
  imageSize?: ImageSizeType;
  imagePosition?: ImagePositionType;
  imageRounded?: boolean;
  imageShadow?: boolean;
  imageBorder?: boolean;
  
  // New specialized block fields
  headline?: string;
  body?: string;
  backgroundImageUrl?: string | null; // Explicit null means user deleted the image
  backgroundOpacity?: number;
  colorOverlayOpacity?: number;
  darkOverlayOpacity?: number;
  overlayOpacity?: number;
  overlayColor?: string;
  altText?: string;
  caption?: string;
  buttonText?: string;
  buttonUrl?: string;
  heading?: string;
  
  // Quote-specific fields
  quote?: string;
  author?: string;
  authorTitle?: string;
  
  // CTA-specific fields
  ctaStyle?: 'primary' | 'secondary' | 'outline' | 'ghost';
  ctaSize?: 'small' | 'medium' | 'large';
  
  // Newsletter Header fields
  subtitle?: string;
  issueNumber?: string;
  publishDate?: string;
  
  // Image fetching control - DETERMINISTIC IMAGE BEHAVIOR
  autoImageMode?: boolean; // true = system may auto-fetch images; false = never auto-fetch
  shouldFetchImage?: boolean; // Flag to trigger image fetching when autoImageMode is true
  
  // AI Image generation state
  isGeneratingImage?: boolean;
  imageGenerationError?: string;
  
  // Button block specific
  buttonColor?: string;
  buttonSize?: string;
  isRounded?: boolean;
  
  // Divider block specific
  dividerThickness?: number;
  dividerColor?: string;
  paddingTop?: number;
  paddingBottom?: number;
  
  // Social follow block specific
  socialLinks?: {
    [platform: string]: {
      enabled: boolean;
      url: string;
    };
  };
  iconColor?: string;
  iconSize?: string;
  
  // Text styling
  fontFamily?: string;
  fontSize?: string;
  
  // Content lifecycle tracking - PHASE 1: Add persistent tracking
  contentGeneratedAt?: number; // Timestamp when content was first generated
  hasGeneratedContent?: boolean; // Permanent flag: true once content is generated
  contentVersion?: number; // Increment on each update to prevent stale data
  userEdited?: boolean; // Flag to indicate user has manually edited this block
  
  // IMAGE GALLERY block specific fields
  galleryImages?: Array<{
    id: string;
    url: string;
    alt?: string;
    caption?: string;
  }>;
  galleryLayout?: '3-across' | '6-across' | '9-images';
  galleryGap?: 'small' | 'medium' | 'large';
  galleryImageRadius?: 'none' | 'small' | 'medium' | 'large';
  
  // PRODUCT GALLERY (2x2 grid) block specific fields
  galleryItems?: GalleryItem[];
}

// Product gallery item for 2x2 product showcase
export interface GalleryItem {
  id: string;
  title: string;
  imageUrl: string;
  badgeText?: string; // e.g. "25% OFF"
  url?: string;       // product or category link
}

// Specialized interfaces for type safety
export interface HeaderBlock extends ContentBlock {
  type: 'header';
  headline: string;
  body?: string;
  backgroundImageUrl?: string;
  backgroundOpacity?: number;
  alignment: AlignmentType;
  padding: SpacingType;
}

export interface NewsletterHeaderBlock extends ContentBlock {
  type: 'newsletter-header';
  title: string;
  subtitle?: string;
  issueNumber?: string;
  publishDate?: string;
  backgroundImageUrl?: string;
}

export interface QuoteBlock extends ContentBlock {
  type: 'quote';
  quote: string;
  author?: string;
  authorTitle?: string;
  alignment: AlignmentType;
}

export interface CTABlock extends ContentBlock {
  type: 'cta';
  heading?: string;
  body?: string;
  ctaText: string;
  ctaUrl: string;
  ctaStyle: 'primary' | 'secondary' | 'outline' | 'ghost';
  ctaSize: 'small' | 'medium' | 'large';
  alignment: AlignmentType;
}

export interface ImageBlock extends ContentBlock {
  type: 'image';
  imageUrl: string;
  altText?: string;
  caption?: string;
  imageSize: ImageSizeType;
  imagePosition: ImagePositionType;
}

export interface ButtonBlock extends ContentBlock {
  type: 'button';
  heading?: string;
  body?: string;
  buttonText: string;
  buttonUrl: string;
  alignment: AlignmentType;
}

// Newsletter Styling Configuration
export interface NewsletterTheme {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  headerFont: string;
  bodyFont: string;
  borderRadius: string;
  maxWidth: string;
}
