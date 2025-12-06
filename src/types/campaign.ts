/**
 * Campaign Types - Explicit template and source tracking
 * CRITICAL: Template reuse is ID-based, not fuzzy name-based
 */

export interface CRMCampaign {
  id: string;
  name: string;
  tenant_id?: string;
  user_id?: string;
  status?: string;
  subject_line?: string;
  preheader?: string;
  preheader_text?: string;
  content?: string;
  metadata?: Record<string, any>;
  scheduled_at?: string;
  sent_at?: string;
  created_at?: string;
  updated_at?: string;
  
  // EXPLICIT TEMPLATE TRACKING - prevents fuzzy name-based cross-contamination
  /** ID/slug of template this campaign was created from. NULL if not from template. */
  template_id?: string | null;
  
  /** ID of campaign this was cloned from. NULL if not cloned. */
  source_campaign_id?: string | null;
  
  // Sender configuration
  sender_email?: string;
  sender_name?: string;
  sender_display_name?: string;
  actual_sender_email?: string;
  from_email_domain_id?: string;
  
  // Audience targeting
  segment_id?: string;
  persona_ids?: string[];
  predicted_segment_ids?: string[];
  
  // Metrics
  total_sent?: number;
  total_opens?: number;
  total_clicks?: number;
  open_rate?: number;
  click_rate?: number;
  metrics?: Record<string, any>;
  
  // Source tracking
  source_content_task_id?: string;
  synced_from?: string;
  
  // Auto-send configuration
  auto_send_enabled?: boolean;
  send_blocked_reason?: string;
  send_reasoning?: string;
  delivery_method?: string;
}

export interface CampaignCreateOptions {
  /** ID/slug of template to create from */
  templateId?: string;
  
  /** ID of campaign to clone from */
  sourceCampaignId?: string;
  
  /** Initial campaign name */
  name?: string;
  
  /** Initial subject line */
  subjectLine?: string;
}

/**
 * Helper to generate unique session ID for new campaigns
 * Prevents localStorage cross-contamination between campaigns
 */
export function generateCampaignSessionId(campaignSlug?: string): string {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  
  // For existing campaigns with UUID slug, use it directly
  if (campaignSlug && uuidRegex.test(campaignSlug)) {
    return campaignSlug;
  }
  
  // For new campaigns, generate unique session ID
  return `new_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}
