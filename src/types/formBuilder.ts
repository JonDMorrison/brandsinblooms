// Form Builder Types

export type FormFieldType =
  | "email"
  | "text"
  | "phone"
  | "select"
  | "checkbox"
  | "file"
  | "hidden"
  | "email_consent"
  | "sms_consent"
  | "segment_checkbox";

export interface FormFieldRules {
  min_length?: number;
  max_length?: number;
  pattern?: string;
  pattern_message?: string;
  max_files?: number;
  max_file_size_mb?: number;
  allowed_mime_types?: string[];
}

export interface FormFileUploadReference {
  upload_id: string;
  field_id: string;
  session_id?: string;
  bucket: string;
  path: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  uploaded_at: string;
}

export type FormVisibilityOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_empty"
  | "is_empty";

export interface FormVisibilityRule {
  field_id: string;
  operator: FormVisibilityOperator;
  value?: string;
}

export interface FormStep {
  index: number;
  title: string;
  description: string;
}

export interface FormField {
  id: string;
  type: FormFieldType;
  label: string;
  required: boolean;
  placeholder?: string;
  options?: string[]; // For select type
  mapping_key: string; // Maps to crm_customers fields or custom keys
  default_value?: string | boolean;
  rules?: FormFieldRules;
  step_index?: number;
  visibility_rules?: FormVisibilityRule[];
  // Segment / Persona assignment (for checkbox and segment_checkbox fields)
  segment_id?: string;
  segment_name?: string;
  persona_id?: string;
  persona_name?: string;
}

export type FormFontFamily = "inter" | "system" | "serif" | "mono";
export type FormBorderRadius = "0px" | "4px" | "8px" | "12px" | "9999px";
export type FormSpacing = "compact" | "normal" | "relaxed" | "comfortable";
export type FormButtonStyle = "filled" | "outlined" | "ghost";
export type FormButtonShape = "rounded" | "pill" | "square";
export type FormButtonWidth = "full" | "auto" | "medium";
export type FormBackgroundStyle = "white" | "transparent" | "green-tint" | "custom";
export type FormInputStyle = "outlined" | "filled" | "underlined";
export type FormWidth = "narrow" | "medium" | "wide" | "full";
export type FormLabelPosition = "above";

export interface FormTheme {
  primary_color?: string;
  secondary_color?: string;
  text_color?: string;
  background_color?: string;
  font_family?: FormFontFamily;
  border_radius?: FormBorderRadius;
  spacing?: FormSpacing;
  button_style?: FormButtonStyle;
  button_shape?: FormButtonShape;
  button_width?: FormButtonWidth;
  input_style?: FormInputStyle;
  background_style?: FormBackgroundStyle;
  google_font?: string;
}

export interface FormSettings {
  form_title?: string;
  form_description?: string;
  form_headline?: string;
  form_subheadline?: string;
  form_width?: FormWidth;
  label_position?: FormLabelPosition;
  columns?: 1 | 2;
  steps?: FormStep[];
  success_message: string;
  success_redirect_url?: string | null;
  submit_button_text: string;
  show_branding: boolean;
  theme: FormTheme;
  notification_emails: string[];
}

export interface FormCompliance {
  email_consent_required: boolean;
  email_consent_text: string;
  sms_consent_required: boolean;
  sms_consent_text: string;
  double_opt_in: boolean;
  gdpr_compliant: boolean;
}

export interface FormAudience {
  assign_personas: string[]; // persona IDs (from global personas table)
  assign_tags: string[]; // crm_tags IDs
  segment_ids?: string[]; // crm_segments IDs to auto-assign on submission
}

export type FormStatus = "draft" | "published" | "archived";

export interface Form {
  id: string;
  tenant_id: string;
  name: string;
  status: FormStatus;
  fields_json: FormField[];
  settings_json: FormSettings;
  compliance_json: FormCompliance;
  audience_json: FormAudience;
  embed_key: string;
  created_at: string;
  updated_at: string;
}

export interface FormWithStats extends Form {
  total_submissions: number;
  recent_submissions: number;
  recent_accepted: number;
  recent_rejected: number;
  last_submission_at: string | null;
}

/**
 * Stored result semantics:
 * - accepted: Submission processed successfully
 * - rejected_invalid: Validation failed (see reason + metadata.rejection_type)
 * - rejected_rate_limited: Submission exceeded rate limits
 * - rejected_spam: Submission matched spam controls
 */
export type SubmissionResult =
  | "accepted"
  | "rejected_invalid"
  | "rejected_rate_limited"
  | "rejected_spam";
export type RejectionType = "invalid" | "rate_limited" | "spam";

export type FormSubmissionValue =
  | string
  | number
  | boolean
  | null
  | FormFileUploadReference
  | FormSubmissionValue[]
  | { [key: string]: FormSubmissionValue };

export interface FormSubmission {
  id: string;
  tenant_id: string;
  form_id: string;
  customer_id?: string;
  data: Record<string, FormSubmissionValue>;
  metadata: FormSubmissionMetadata;
  ip_hash?: string;
  result: SubmissionResult;
  reason?: string;
  submitted_at: string;
}

export type FormSubmissionSortColumn =
  | "submitted_at"
  | "name"
  | "email"
  | "result"
  | "source";

export type SortDirection = "asc" | "desc";

export interface FormSubmissionsPageSummary {
  total: number;
  accepted: number;
  rejected: number;
  acceptRate: number;
  last7Days: number;
  previous7Days: number;
  trend: number;
  rejectionBreakdown: {
    invalid: number;
    rateLimit: number;
    spam: number;
  };
}

export interface FormSubmissionsPageData {
  rows: FormSubmission[];
  summary: FormSubmissionsPageSummary;
  filteredTotal: number;
  unfilteredTotal: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface DeleteFormSubmissionsResult {
  deletedCount: number;
  deletedIds: string[];
}

export type FormAnalyticsTrendDirection = "up" | "down" | "flat" | "none";
export type FormAnalyticsTrendSentiment = "positive" | "negative" | "neutral";

export interface FormAnalyticsTrend {
  hasTrend: boolean;
  direction: FormAnalyticsTrendDirection;
  sentiment: FormAnalyticsTrendSentiment;
  changePercentage: number | null;
  deltaValue: number | null;
}

export interface FormAnalyticsMetric {
  value: number | null;
  previousValue: number | null;
  trend: FormAnalyticsTrend;
}

export interface FormAnalyticsRange {
  days: number;
  isAllTime: boolean;
  comparisonLabel: string | null;
}

export interface FormAnalyticsPeriodSummary {
  totalSubmissions: number;
  acceptedSubmissions: number;
  rejectedSubmissions: number;
  invalidSubmissions: number;
  rateLimitedSubmissions: number;
  spamSubmissions: number;
  acceptanceRate: number;
  rejectionRate: number;
}

export interface FormAnalyticsDailyPoint {
  day: string;
  total: number;
  accepted: number;
  rejected: number;
}

export interface FormAnalyticsReferrer {
  rank: number;
  displayDomain: string;
  sourceLabel: string;
  count: number;
  sharePercentage: number;
  barPercentage: number;
}

export interface FormAnalyticsTotals {
  totalSubmissions: number;
  totalAccepted: number;
  totalInvalid: number;
  totalRateLimited: number;
  totalSpam: number;
}

export interface FormAnalyticsRejectionSlice {
  key: RejectionType;
  label: string;
  count: number;
  percentage: number;
}

export interface FormAnalyticsRejectionBreakdown {
  totalRejections: number;
  slices: FormAnalyticsRejectionSlice[];
}

export interface FormAnalyticsFieldFillRate {
  fieldId: string;
  fieldKey: string;
  label: string;
  fieldType: Exclude<FormFieldType, "hidden">;
  fieldOrder: number;
  required: boolean;
  filledCount: number;
  totalSubmissions: number;
  fillRate: number;
}

export interface FormAnalyticsConversion {
  available: boolean;
  views: number | null;
  accepted: number;
  rate: number | null;
  previousRate: number | null;
  note: string | null;
  trend: FormAnalyticsTrend;
}

export interface FormAnalyticsSummary {
  current: FormAnalyticsPeriodSummary;
  previous: FormAnalyticsPeriodSummary | null;
  metrics: {
    totalSubmissions: FormAnalyticsMetric;
    acceptedSubmissions: FormAnalyticsMetric;
    rejectedSubmissions: FormAnalyticsMetric;
    conversionRate: FormAnalyticsMetric;
  };
}

export interface FormAnalyticsData {
  range: FormAnalyticsRange;
  summary: FormAnalyticsSummary;
  daily: FormAnalyticsDailyPoint[];
  topReferrers: FormAnalyticsReferrer[];
  rejectionBreakdown: FormAnalyticsRejectionBreakdown;
  fieldFillRates: FormAnalyticsFieldFillRate[];
  conversion: FormAnalyticsConversion;
  totals: FormAnalyticsTotals;
  total: number;
  accepted: number;
  rejected: number;
  acceptanceRate: number;
  lastSubmission: string | null;
}

/**
 * Canonical consent metadata keys.
 * All form submissions MUST use these exact key names for consistency.
 */
export interface FormSubmissionMetadata {
  // Page & attribution context
  page_url?: string;
  referrer?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  user_agent?: string;

  // Form identification
  form_embed_key?: string;
  form_id?: string;
  consent_source?: string;

  // Submission timestamp
  submitted_at?: string;

  // ─── CANONICAL EMAIL CONSENT KEYS ───
  email_consent: boolean; // Whether consent was given
  email_consent_text?: string; // Verbatim consent text shown
  email_consent_at?: string; // ISO 8601 timestamp when consent given
  email_consent_required?: boolean; // Whether consent was required

  // ─── CANONICAL SMS CONSENT KEYS ───
  sms_consent: boolean; // Whether consent was given
  sms_consent_text?: string; // Verbatim consent text shown
  sms_consent_at?: string; // ISO 8601 timestamp when consent given
  sms_consent_required?: boolean; // Whether consent was required

  // ─── REJECTION DETAILS (for rejected submissions) ───
  rejection_type?: RejectionType; // invalid | rate_limited | spam

  // ─── AUDIENCE PROCESSING ───
  audience_processing?: {
    personas_requested?: number;
    personas_assigned?: number;
    personas_errors?: string[] | null;
    tags_requested?: number;
    tags_assigned?: number;
    tags_errors?: string[] | null;
    segments_joined?: string[] | null;
    segments_left?: string[] | null;
    processed_at?: string;
  };

  // Debug info (error codes only, no PII)
  debug?: Record<string, unknown>;
}

// Form Templates
export interface FormTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  fields: FormField[];
  settings: Partial<FormSettings>;
  compliance: Partial<FormCompliance>;
}

// Default values
export const DEFAULT_FORM_SETTINGS: FormSettings = {
  form_title: "",
  form_description: "",
  form_headline: "",
  form_subheadline: "",
  form_width: "medium",
  label_position: "above",
  columns: 1,
  steps: [],
  success_message: "Thank you for your submission!",
  success_redirect_url: null,
  submit_button_text: "Submit",
  show_branding: true,
  theme: {
    primary_color: "#22C55E",
    secondary_color: "#1E40AF",
    text_color: "#1F2937",
    background_color: "#FFFFFF",
    font_family: "inter",
    border_radius: "8px",
    spacing: "normal",
    button_style: "filled",
    input_style: "outlined",
  },
  notification_emails: [],
};

export const DEFAULT_FORM_COMPLIANCE: FormCompliance = {
  email_consent_required: false,
  email_consent_text: "I agree to receive marketing emails",
  sms_consent_required: false,
  sms_consent_text: "I agree to receive SMS messages",
  double_opt_in: false,
  gdpr_compliant: false,
};

export const DEFAULT_FORM_AUDIENCE: FormAudience = {
  assign_personas: [],
  assign_tags: [],
};

// Mapping key options for form fields
export const FIELD_MAPPING_OPTIONS = [
  { value: "email", label: "Email" },
  { value: "first_name", label: "First Name" },
  { value: "last_name", label: "Last Name" },
  { value: "phone", label: "Phone" },
  { value: "custom", label: "Custom Field" },
] as const;

export const CRM_FIELD_MAPPING_SUGGESTIONS = [
  {
    value: "email",
    label: "email",
    description: "Primary email address",
  },
  {
    value: "first_name",
    label: "first_name",
    description: "Customer first name",
  },
  {
    value: "last_name",
    label: "last_name",
    description: "Customer last name",
  },
  {
    value: "phone",
    label: "phone",
    description: "Phone number",
  },
  {
    value: "company",
    label: "company",
    description: "Company or business name",
  },
  {
    value: "address",
    label: "address",
    description: "Street address",
  },
  {
    value: "city",
    label: "city",
    description: "City",
  },
  {
    value: "state",
    label: "state",
    description: "State or province",
  },
  {
    value: "zip",
    label: "zip",
    description: "Postal / ZIP code",
  },
  {
    value: "country",
    label: "country",
    description: "Country",
  },
  {
    value: "notes",
    label: "notes",
    description: "Free-text notes or comments",
  },
] as const;
