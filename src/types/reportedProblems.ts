export type ProblemStatus = 'open' | 'investigating' | 'resolved' | 'closed';
export type ProblemPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface ReportedProblem {
  id: string;
  tenant_id: string;
  user_id: string;
  user_email: string;
  title: string;
  description: string;
  captured_url: string;
  user_agent?: string;
  viewport_size?: string;
  browser_info?: Record<string, any>;
  status: ProblemStatus;
  priority: ProblemPriority;
  assigned_to?: string;
  resolved_at?: string;
  admin_notes?: string;
  created_at: string;
  updated_at: string;
  
  // Joined data
  attachments?: ReportedProblemAttachment[];
}

export interface ReportedProblemAttachment {
  id: string;
  problem_id: string;
  user_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  storage_bucket: string;
  created_at: string;
}
