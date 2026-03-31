// Form Builder Types

export type FormFieldType =
  | 'email'
  | 'text'
  | 'phone'
  | 'select'
  | 'checkbox'
  | 'checkbox_group'
  | 'hidden'
  | 'email_consent'
  | 'sms_consent';

export interface FormFieldRules {
  min_length?: number;
  max_length?: number;
  pattern?: string;
  pattern_message?: string;
}

/**
 * A single option within a checkbox_group field.
 * Each option can map to a CRM segment so that selecting it
 * automatically assigns the contact to that segment on submission.
 */
export interface CheckboxGroupOption {
  id: string;       // Stable UUID, used as the key in submission data
  label: string;    // Display label shown to the visitor
  value: string;    // Stored value in submission data
  segment_id?: string; // crm_segments.id to assign when this option is selected
}

export interface FormField {
  id: string;
  type: FormFieldType;
  label: string;
  required: boolean;
  placeholder?: string;
  options?: string[]; // For select type
  checkbox_options?: CheckboxGroupOption[]; // For checkbox_group type
  mapping_key: string; // Maps to crm_customers fields or custom keys
  default_value?: string;
  rules?: FormFieldRules;
}

export interface FormTheme {
  primary_color?: string;
  font_family?: string;
  border_radius?: string;
  spacing?: string;
  button_style?: 'filled' | 'outline' | 'rounded';
}

export interface FormSettings {
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
  assign_personas: string[]; // persona IDs
  assign_tags: string[]; // tag names
}

export type FormStatus = 'draft' | 'published' | 'archived';

export interface Form {
  id: string;
  tenant_id: string;
  name: string;
  status: FormStatus;
  fields_json: FormField[];
  settings_json: FormSettings;
  compliance_json: FormCompliance;
  embed_key: string;
  created_at: string;
  updated_at: string;
}

/**
 * Canonical result semantics:
 * - accepted: Submission processed successfully
 * - rejected: Submission failed (see reason + metadata.rejection_type for details)
 *
 * rejection_type values (stored in metadata.rejection_type):
 * - invalid: Validation errors
 * - rate_limited: Rate limit exceeded
 * - spam: Spam detected (honeypot triggered)
 */
export type SubmissionResult = 'accepted' | 'rejected';
export type RejectionType = 'invalid' | 'rate_limited' | 'spam';

export interface FormSubmission {
  id: string;
  tenant_id: string;
  form_id: string;
  customer_id?: string;
  data: Record<string, any>;
  metadata: FormSubmissionMetadata;
  ip_hash?: string;
  result: SubmissionResult;
  reason?: string;
  submitted_at: string;
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
  email_consent: boolean;           // Whether consent was given
  email_consent_text?: string;      // Verbatim consent text shown
  email_consent_at?: string;        // ISO 8601 timestamp when consent given
  email_consent_required?: boolean; // Whether consent was required

  // ─── CANONICAL SMS CONSENT KEYS ───
  sms_consent: boolean;             // Whether consent was given
  sms_consent_text?: string;        // Verbatim consent text shown
  sms_consent_at?: string;          // ISO 8601 timestamp when consent given
  sms_consent_required?: boolean;   // Whether consent was required

  // ─── REJECTION DETAILS (for rejected submissions) ───
  rejection_type?: RejectionType;   // invalid | rate_limited | spam

  // ─── AUDIENCE PROCESSING ───
  audience_processing?: {
    personas_requested?: number;
    personas_assigned?: number;
    personas_errors?: string[] | null;
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
  success_message: 'Thank you for your submission!',
  success_redirect_url: null,
  submit_button_text: 'Submit',
  show_branding: true,
  theme: {
    primary_color: '#22C55E',
    font_family: 'inherit',
    border_radius: '8px',
    spacing: 'normal',
    button_style: 'filled',
  },
  notification_emails: [],
};

export const DEFAULT_FORM_COMPLIANCE: FormCompliance = {
  email_consent_required: false,
  email_consent_text: 'I agree to receive marketing emails',
  sms_consent_required: false,
  sms_consent_text: 'I agree to receive SMS messages',
  double_opt_in: false,
  gdpr_compliant: false,
};

// Mapping key options for form fields
export const FIELD_MAPPING_OPTIONS = [
  { value: 'email', label: 'Email' },
  { value: 'first_name', label: 'First Name' },
  { value: 'last_name', label: 'Last Name' },
  { value: 'phone', label: 'Phone' },
  { value: 'custom', label: 'Custom Field' },
] as const;
