
export interface ImageAttachment {
  id: string;        // unsplash_id or generated uuid
  url: string;       // full-size for upload
  thumb: string;     // small for UI
  alt: string;
  photographer: string;
  // Additional properties for MediaSelectorSidebar compatibility
  thumb_url?: string;
  download_url?: string;
  photographer_url?: string;
  download_location?: string;
}

export interface ContentTask {
  id: string;
  campaign_id?: string;
  post_type?: string;
  status: string;
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
  attachments?: {
    image?: ImageAttachment | null;
  };
  campaigns?: {
    id: string;
    title: string;
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
