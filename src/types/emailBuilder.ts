
export type BlockType = 'header' | 'text' | 'image' | 'button' | 'divider' | 'product';
export type BlockLayout = 'full-width' | 'two-column-left' | 'two-column-right';

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
  type: BlockType;
  title?: string;
  content?: string;
  imageUrl?: string;
  ctaText?: string;
  ctaUrl?: string;
  source: 'newsletter' | 'ai' | 'template' | 'manual';
  personaTag?: string;
  layout?: BlockLayout;
}
