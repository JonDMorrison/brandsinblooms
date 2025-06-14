export interface Campaign {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  theme: string | null;
  week_number: number;
  created_at?: string;
  updated_at?: string;
  prompt?: string | null;
  source?: string | null;
  user_id?: string | null;
}

export interface ContentTask {
  id: string;
  campaign_id: string;
  post_type: string;
  platform: string;
  status: 'draft' | 'scheduled' | 'published' | 'completed';
  ai_output: string | null;
  human_input: string | null;
  scheduled_date: string | null;
  created_at: string;
  updated_at: string;
  campaigns?: {
    title: string;
  };
}

export interface TeamMember {
  id: string;
  email: string;
  role: 'owner' | 'admin' | 'member';
  status: 'active' | 'pending' | 'inactive';
  invited_at: string;
  joined_at?: string;
  user_id?: string;
}

export interface Team {
  id: string;
  name: string;
  max_members: number;
  is_paid: boolean;
  owner_id: string;
  created_at: string;
}

export interface OnboardingData {
  aboutBusiness: string;
  toneSamples: string;
  annualEvents: string;
  websiteUrl: string;
}

export interface SeasonalContent {
  theme: string;
  posts: {
    type: string;
    content: string;
    hashtags: string;
    imageIdea: string;
  }[];
}
