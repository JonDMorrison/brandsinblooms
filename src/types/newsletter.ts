export interface NewsletterIdea {
  id: string;
  title: string;
  description: string;
  category: 'holiday' | 'seasonal' | 'product' | 'ai-generated' | 'general' | 'weekly';
  badge?: string;
  previewHtml?: string;
  templateBlocks: any[];
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