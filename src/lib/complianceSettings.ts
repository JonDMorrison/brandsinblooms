import type { Json } from "@/integrations/supabase/types";

/**
 * Tenant compliance preferences saved from Settings > Compliance.
 *
 * Stored as JSON in public.tenant_compliance_settings.settings (one row per
 * tenant). Keys are snake_case in the database and camelCase in the UI.
 */
export type DataHandlingMode = "anonymize" | "delete" | "archive";

export interface ComplianceSettingsState {
  doubleOptInRequired: boolean;
  ageVerificationRequired: boolean;
  includeOptOutInstructions: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  dataRetentionDays: number;
  dataHandlingMode: DataHandlingMode;
  optOutInstructions: string;
  privacyPolicyText: string;
}

export type ComplianceSettingKey = keyof ComplianceSettingsState;

/**
 * Which settings have a code path that actually enforces them.
 *
 * Audit (workspace QA pass 3):
 * - doubleOptInRequired: no sender or form submission path sends a
 *   confirmation email or holds consent until confirmed
 *   (submit-form never reads it; send-email-confirmation has no callers).
 * - ageVerificationRequired: nothing reads it.
 * - includeOptOutInstructions / optOutInstructions: email sends always add
 *   the unsubscribe footer regardless of this setting; no SMS sender appends
 *   this tenant text.
 * - quietHours*: only compliance-sms-send (the SMS test panel) has a quiet
 *   hours check, and it reads company_profiles without a tenant filter, so
 *   no tenant send path honours these values.
 * - dataRetentionDays / dataHandlingMode: no retention job reads them.
 * - privacyPolicyText: reusable copy only; it makes no enforcement claim.
 *
 * Flip a key to `true` only in the same change that adds its enforcing path.
 */
export const COMPLIANCE_SETTING_ENFORCED: Record<ComplianceSettingKey, boolean> = {
  doubleOptInRequired: false,
  ageVerificationRequired: false,
  includeOptOutInstructions: false,
  quietHoursEnabled: false,
  quietHoursStart: false,
  quietHoursEnd: false,
  dataRetentionDays: false,
  dataHandlingMode: false,
  optOutInstructions: false,
  privacyPolicyText: true,
};

export const DEFAULT_COMPLIANCE_SETTINGS: ComplianceSettingsState = {
  doubleOptInRequired: false,
  ageVerificationRequired: false,
  includeOptOutInstructions: false,
  quietHoursEnabled: false,
  quietHoursStart: "22:00",
  quietHoursEnd: "08:00",
  dataRetentionDays: 365,
  dataHandlingMode: "anonymize",
  optOutInstructions: "Reply STOP to unsubscribe.",
  privacyPolicyText:
    "Customer consent and message preference data is retained only for the period required to operate campaigns and satisfy compliance obligations.",
};

const BOOLEAN_KEYS = [
  "doubleOptInRequired",
  "ageVerificationRequired",
  "includeOptOutInstructions",
  "quietHoursEnabled",
] as const;

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown, fallback: string, maxLength = 2000) {
  return typeof value === "string" ? value.slice(0, maxLength) : fallback;
}

function readTime(value: unknown, fallback: string) {
  return typeof value === "string" && TIME_PATTERN.test(value) ? value : fallback;
}

function readRetentionDays(value: unknown, fallback: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(2555, Math.max(30, Math.round(numeric)));
}

function readHandlingMode(value: unknown, fallback: DataHandlingMode): DataHandlingMode {
  return value === "anonymize" || value === "delete" || value === "archive"
    ? value
    : fallback;
}

/**
 * A setting is shown (and saved) as on only when it is enforced. Unenforced
 * toggles are always forced off so neither the UI nor the stored row ever
 * claims protection that does not exist.
 */
export function applyEnforcement(
  settings: ComplianceSettingsState,
): ComplianceSettingsState {
  const next = { ...settings };
  for (const key of BOOLEAN_KEYS) {
    if (!COMPLIANCE_SETTING_ENFORCED[key]) {
      next[key] = false;
    }
  }
  return next;
}

/** Parse the stored JSON row into UI state, tolerating missing/old keys. */
export function parseComplianceSettings(raw: Json | null | undefined): ComplianceSettingsState {
  const source = isRecord(raw) ? raw : {};
  const defaults = DEFAULT_COMPLIANCE_SETTINGS;
  const quietHours = isRecord(source.quiet_hours) ? source.quiet_hours : {};
  const retention = isRecord(source.data_retention) ? source.data_retention : {};

  return applyEnforcement({
    doubleOptInRequired: source.double_opt_in_required === true,
    ageVerificationRequired: source.age_verification_required === true,
    includeOptOutInstructions: source.include_opt_out_instructions === true,
    quietHoursEnabled: quietHours.enabled === true,
    quietHoursStart: readTime(quietHours.start, defaults.quietHoursStart),
    quietHoursEnd: readTime(quietHours.end, defaults.quietHoursEnd),
    dataRetentionDays: readRetentionDays(retention.days, defaults.dataRetentionDays),
    dataHandlingMode: readHandlingMode(retention.mode, defaults.dataHandlingMode),
    optOutInstructions: readString(source.opt_out_instructions, defaults.optOutInstructions, 500),
    privacyPolicyText: readString(source.privacy_policy_text, defaults.privacyPolicyText, 5000),
  });
}

/** Serialize UI state to the stored JSON shape. */
export function serializeComplianceSettings(settings: ComplianceSettingsState): Json {
  const enforced = applyEnforcement(settings);
  return {
    version: 1,
    double_opt_in_required: enforced.doubleOptInRequired,
    age_verification_required: enforced.ageVerificationRequired,
    include_opt_out_instructions: enforced.includeOptOutInstructions,
    opt_out_instructions: enforced.optOutInstructions.slice(0, 500),
    quiet_hours: {
      enabled: enforced.quietHoursEnabled,
      start: readTime(enforced.quietHoursStart, DEFAULT_COMPLIANCE_SETTINGS.quietHoursStart),
      end: readTime(enforced.quietHoursEnd, DEFAULT_COMPLIANCE_SETTINGS.quietHoursEnd),
    },
    data_retention: {
      days: readRetentionDays(enforced.dataRetentionDays, DEFAULT_COMPLIANCE_SETTINGS.dataRetentionDays),
      mode: enforced.dataHandlingMode,
    },
    privacy_policy_text: enforced.privacyPolicyText.slice(0, 5000),
  };
}
