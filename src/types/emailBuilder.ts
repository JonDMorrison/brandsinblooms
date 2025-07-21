
export type BlockType = 'header' | 'text' | 'image' | 'button' | 'divider' | 'product';
export type BlockLayout = 'full-width' | 'two-column-left' | 'two-column-right';
export type AlignmentType = 'left' | 'center' | 'right';
export type SpacingType = 'none' | 'small' | 'medium' | 'large';
export type ResponsiveBehaviorType = 'stack' | 'reverse' | 'hide-image';

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
  padding?: SpacingType;
  margin?: SpacingType;
  responsiveBehavior?: ResponsiveBehaviorType;
  
  // Visual Settings
  visible?: boolean;
  backgroundColor?: string;
  textColor?: string;
  animation?: 'none' | 'fade-in' | 'slide-up' | 'scale-in';
  
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

export interface ImageBlock extends ContentBlock {
  type: 'image';
  imageUrl: string;
  altText?: string;
  caption?: string;
}

export interface ButtonBlock extends ContentBlock {
  type: 'button';
  heading?: string;
  body?: string;
  buttonText: string;
  buttonUrl: string;
  alignment: AlignmentType;
}
