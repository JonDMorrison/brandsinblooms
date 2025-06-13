
export interface Campaign {
  id: string;
  title: string;
  description?: string;
  theme?: string;
  prompt?: string;
  source?: string;
  week_number: number;
  start_date: string;
  created_at: string;
}

export interface ContentTask {
  id: string;
  post_type?: string;
  status: 'planned' | 'generating' | 'pending' | 'posted' | 'completed' | 'draft';
  ai_output?: string;
  notes?: string;
  scheduled_date?: string;
  created_at: string;
  campaign_id?: string;
  assigned_user_id?: string;
  image_idea?: string;
  hashtags?: string;
  campaigns?: Campaign;
}

export interface ReviewQueueProps {
  onTaskUpdate?: () => void;
  onTaskClick?: (task: ContentTask) => void;
}
