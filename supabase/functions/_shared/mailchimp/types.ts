export interface ImportReport {
  contacts_imported: number;
  contacts_skipped: number;
  contacts_failed: number;
  segments_created: number;
  tags_created: number;
  consents_recorded: number;
  errors: string[];
  batches_processed: number;
}

export interface MailchimpConnectionCredentials {
  encrypted_access_token: string;
  metadata: {
    dc?: string;
    api_endpoint?: string;
    login_url?: string;
    accountname?: string;
  };
}

export interface MailchimpList {
  id: string;
  name: string;
  stats?: {
    member_count: number;
  };
}

export interface MailchimpSegment {
  id: number;
  name: string;
  member_count: number;
  type: string;
  options?: Record<string, unknown>;
}

export interface MailchimpMember {
  id: string;
  email_address: string;
  status: "subscribed" | "unsubscribed" | "cleaned" | "pending";
  merge_fields: Record<string, string | null>;
  tags: Array<{ id: number; name: string }>;
  timestamp_opt?: string;
}

export interface MailchimpListsResponse {
  lists: MailchimpList[];
  total_items: number;
}

export interface MailchimpSegmentsResponse {
  segments: MailchimpSegment[];
  total_items: number;
}

export interface MailchimpMembersResponse {
  members: MailchimpMember[];
  total_items: number;
}
