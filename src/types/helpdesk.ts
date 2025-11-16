export type TicketStatus = 'open' | 'pending' | 'in_progress' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface SupportTicket {
  id: string;
  tenant_id: string;
  user_id: string;
  ticket_number: string;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  category_id?: string;
  assigned_to?: string;
  resolved_at?: string;
  resolution_notes?: string;
  first_response_at?: string;
  metadata?: any;
  created_at: string;
  updated_at: string;
  
  // Joined data
  user?: {
    name: string;
    email: string;
  };
  category?: SupportCategory;
  assigned_agent?: {
    name: string;
    email: string;
  };
}

export interface SupportComment {
  id: string;
  ticket_id: string;
  user_id: string;
  comment_text: string;
  is_internal: boolean;
  is_system: boolean;
  metadata?: any;
  created_at: string;
  updated_at: string;
  
  // Joined data
  user?: {
    name: string;
    email: string;
    role: string;
  };
  attachments?: SupportAttachment[];
}

export interface SupportAttachment {
  id: string;
  ticket_id?: string;
  comment_id?: string;
  user_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  storage_bucket: string;
  created_at: string;
}

export interface SupportCategory {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface SupportNotification {
  id: string;
  user_id: string;
  ticket_id: string;
  notification_type: string;
  is_read: boolean;
  metadata?: any;
  created_at: string;
}

export interface TicketHistory {
  id: string;
  ticket_id: string;
  user_id: string;
  action: string;
  old_value?: any;
  new_value?: any;
  description?: string;
  created_at: string;
  
  user?: {
    name: string;
    email: string;
  };
}

export interface SupportAnalytics {
  total_tickets: number;
  open_tickets: number;
  in_progress: number;
  resolved_tickets: number;
  closed_tickets: number;
  avg_resolution_time: number;
  by_priority: {
    urgent: number;
    high: number;
    medium: number;
    low: number;
  };
}
