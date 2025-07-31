export interface NewsletterIdea {
  id: string;
  title: string;
  description: string;
  category: 'holiday' | 'seasonal' | 'product' | 'ai-generated' | 'general';
  badge?: string;
  previewHtml?: string;
  templateBlocks: any[];
  heroQuery?: string;
  estimatedReadTime?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
}

export interface NewsletterTemplate {
  id: string;
  name: string;
  layout: 'classic' | 'magazine' | 'one-column';
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