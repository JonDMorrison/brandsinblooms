
export type BlockType = 'header' | 'text' | 'image' | 'image-text' | 'button' | 'divider' | 'product' | 'quote' | 'cta' | 'newsletter-header' | 'image-gallery' | 'social-follow' | 'footer';
export type BlockLayout = 'full-width' | 'two-column-left' | 'two-column-right' | 'three-column' | 'image-60-40' | 'image-70-30' | 'image-overlay' | 'image-background' | 'overlay' | 'background' | 'image-left' | 'text-left';
export type AlignmentType = 'left' | 'center' | 'right' | 'justify';
export type SpacingType = 'none' | 'small' | 'medium' | 'large' | 'extra-large';
export type ResponsiveBehaviorType = 'stack' | 'reverse' | 'hide-image' | 'mobile-first';
export type ImageSizeType = 'small' | 'medium' | 'large' | 'full-width' | 'cover';
export type ImagePositionType = 'left' | 'right' | 'center' | 'background' | 'overlay';

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
  imageUrl?: string;
  ctaText?: string;
  ctaUrl?: string;
  source: 'newsletter' | 'ai' | 'template' | 'manual';
  personaTag?: string;
  layout?: BlockLayout;
  
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
  backgroundImageUrl?: string;
  backgroundOpacity?: number;
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
