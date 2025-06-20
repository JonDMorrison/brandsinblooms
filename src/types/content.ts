
export type TaskStatus = 
  | 'planned' 
  | 'review' 
  | 'approved' 
  | 'posted' 
  | 'rejected'
  | 'generated'
  | 'pending'
  | 'preview'; // Add preview status

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

export interface ReviewQueueProps {
  onTaskUpdate?: () => void;
  onTaskClick?: (task: ContentTask) => void;
}
