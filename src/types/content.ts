export type TaskStatus = 
  | 'planned' 
  | 'review' 
  | 'approved' 
  | 'scheduled'
  | 'published'
  | 'rejected'
  | 'generated'
  | 'pending'
  | 'preview';

export interface Campaign {
  id: string;
  created_at?: string;
  title: string;
  theme?: string;
  description?: string;
  user_id?: string;
  tenant_id?: string;
  week_number?: number;
  start_date?: string;
  end_date?: string;
  holiday_id?: string;
  prompt?: string; // Add prompt property
  source?: string; // Add source property
}

export interface ContentBlock {
  id?: string;
  title: string;
  body: string;
  cta?: string;
  link?: string;
  image_prompt?: string;
  alt_text?: string;
  order_index?: number;
  block_type?: 'text' | 'image' | 'cta' | 'divider' | 'header' | 'product' | 'video_scene' | 'event_item';
  metadata?: Record<string, any>;
}

export interface ContentMetadata {
  reading_time?: string;
  theme?: string;
  week_focus?: string;
  content_type?: string;
  keywords?: string[];
  image_prompts?: string[];
  structured_format?: boolean;
}

export interface ContentTask {
  id: string;
  campaign_id?: string;
  post_type?: string;
  status: TaskStatus; // Use the updated TaskStatus type
  ai_output?: string;
  scheduled_date?: string;
  created_at: string;
  notes?: string;
  hashtags?: string;
  image_idea?: string;
  user_id?: string;
  tenant_id?: string;
  created_by_user_id?: string;
  assigned_user_id?: string;
  holiday_id?: string;
  // Extended properties for universal content structure
  blocks?: ContentBlock[];
  metadata?: ContentMetadata;
  extra_content_ideas?: Array<{
    title: string;
    quick_desc: string;
  }>;
  campaigns?: {
    id: string;
    title: string;
    theme?: string;
    week_number?: number;
    start_date?: string;
    tenant_id: string;
    user_id?: string;
  };
  holidays?: {
    holiday_name: string;
    holiday_date: string;
  };
}

export interface ReviewQueueProps {
  onTaskUpdate?: () => void;
  onTaskClick?: (task: ContentTask) => void;
}
