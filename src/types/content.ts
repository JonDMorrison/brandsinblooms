
export interface Campaign {
  id: string;
  title: string;
  week_number: number;
  start_date: string;
  created_at: string;
  user_id: string;
  theme?: string;
  description?: string;
  prompt?: string;
  source?: string;
}

export interface ContentTask {
  id: string;
  campaign_id: string | null;
  holiday_id?: string | null;
  post_type: string | null;
  status: 'planned' | 'review' | 'approved' | 'posted' | 'rejected';
  ai_output: string | null;
  hashtags: string | null;
  image_idea: string | null;
  scheduled_date: string | null;
  assigned_user_id: string | null;
  user_id: string | null;
  notes: string | null;
  created_at: string;
  campaigns?: Campaign;
  holidays?: {
    holiday_name: string;
    holiday_date: string;
  };
}

export interface Holiday {
  id: string;
  holiday_name: string;
  holiday_date: string;
  description: string;
  category: string;
  garden_relevance: string;
  is_active: boolean;
}
