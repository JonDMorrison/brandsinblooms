export interface SmartBlock {
  id: string;
  name: string;
  description: string;
  category: 'essentials' | 'promotions' | 'events' | 'inspiration' | 'saved';
  thumbnail?: string;
  template: {
    blocks: Array<{
      block_type: string;
      content: Record<string, any>;
      image_url?: string;
      cta_url?: string;
      cta_text?: string;
    }>;
  };
  isCustom?: boolean;
  tags: string[];
}

export const SMART_BLOCK_CATEGORIES = {
  essentials: { label: 'Essentials', icon: 'Type' },
  promotions: { label: 'Promotions', icon: 'Percent' },
  events: { label: 'Events & Classes', icon: 'Calendar' },
  inspiration: { label: 'Inspiration & Education', icon: 'Lightbulb' },
  saved: { label: 'Saved Blocks', icon: 'Bookmark' }
} as const;