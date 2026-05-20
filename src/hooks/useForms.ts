import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  DEFAULT_FORM_AUDIENCE,
  DEFAULT_FORM_COMPLIANCE,
  DEFAULT_FORM_SETTINGS,
  FormAnalyticsConversion,
  DeleteFormSubmissionsResult,
  Form,
  FormAnalyticsData,
  FormAnalyticsDailyPoint,
  FormAnalyticsFieldFillRate,
  FormAnalyticsMetric,
  FormAnalyticsPeriodSummary,
  FormAnalyticsRange,
  FormAnalyticsRejectionBreakdown,
  FormAnalyticsReferrer,
  FormAnalyticsSummary,
  FormAnalyticsTotals,
  FormAnalyticsTrend,
  FormAudience,
  FormCompliance,
  FormField,
  FormSettings,
  FormTheme,
  FormSubmission,
  FormSubmissionValue,
  FormSubmissionSortColumn,
  FormSubmissionMetadata,
  FormSubmissionsPageData,
  FormSubmissionsPageSummary,
  FormWithStats,
  SortDirection,
  SubmissionResult,
} from "@/types/formBuilder";
import { Database, Json } from "@/integrations/supabase/types";
import { fetchBrandColors } from "@/hooks/useBrandColors";

interface CreateFormData {
  name: string;
  fields_json?: FormField[];
  settings_json?: FormSettings;
  compliance_json?: FormCompliance;
  audience_json?: FormAudience;
}

interface UpdateFormData {
  id: string;
  name?: string;
  status?: "draft" | "published" | "archived";
  fields_json?: FormField[];
  settings_json?: FormSettings;
  compliance_json?: FormCompliance;
  audience_json?: FormAudience;
}

interface FetchFormSubmissionsPageParams {
  formId: string | undefined;
  tenantId: string | undefined;
  page?: number;
  pageSize?: number;
  sortColumn?: FormSubmissionSortColumn;
  sortDirection?: SortDirection;
  resultFilter?: string | null;
  search?: string;
  dateFrom?: string | null;
  dateTo?: string | null;
  hideTestSubmissions?: boolean;
}

interface DeleteFormSubmissionsParams {
  formId: string;
  submissionIds: string[];
  tenantId: string;
}

type FormRow = Database["public"]["Tables"]["forms"]["Row"];
type FormSubmissionRow =
  Database["public"]["Tables"]["form_submissions"]["Row"];

interface RawFormsWithStatsRow extends FormRow {
  total_submissions: number | string | null;
  recent_submissions: number | string | null;
  recent_accepted: number | string | null;
  recent_rejected: number | string | null;
  last_submission_at: string | null;
}

interface RawFormSubmissionsPageResponse {
  rows?: FormSubmissionRow[];
  summary?: {
    total?: number | string | null;
    accepted?: number | string | null;
    rejected?: number | string | null;
    accept_rate?: number | string | null;
    last_7_days?: number | string | null;
    previous_7_days?: number | string | null;
    trend?: number | string | null;
    rejection_breakdown?: {
      invalid?: number | string | null;
      rate_limited?: number | string | null;
      spam?: number | string | null;
    } | null;
  } | null;
  filtered_total?: number | string | null;
  unfiltered_total?: number | string | null;
  page?: number | string | null;
  page_size?: number | string | null;
  total_pages?: number | string | null;
}

interface RawFormAnalyticsResponse {
  range?: {
    days?: number | string | null;
    is_all_time?: boolean | null;
    comparison_label?: string | null;
  } | null;
  summary?: {
    current?: RawFormAnalyticsPeriodSummary | null;
    previous?: RawFormAnalyticsPeriodSummary | null;
    metrics?: {
      total_submissions?: RawFormAnalyticsMetric | null;
      accepted_submissions?: RawFormAnalyticsMetric | null;
      rejected_submissions?: RawFormAnalyticsMetric | null;
      conversion_rate?: RawFormAnalyticsMetric | null;
    } | null;
  } | null;
  daily?: Array<{
    day?: string | null;
    total?: number | string | null;
    accepted?: number | string | null;
    rejected?: number | string | null;
  }>;
  top_referrers?: Array<{
    rank?: number | string | null;
    display_domain?: string | null;
    source_label?: string | null;
    count?: number | string | null;
    share_percentage?: number | string | null;
    bar_percentage?: number | string | null;
  }>;
  rejection_breakdown?: {
    total_rejections?: number | string | null;
    slices?: Array<{
      key?: string | null;
      label?: string | null;
      count?: number | string | null;
      percentage?: number | string | null;
    }>;
  } | null;
  field_fill_rates?: Array<{
    field_id?: string | null;
    field_key?: string | null;
    label?: string | null;
    field_type?: string | null;
    field_order?: number | string | null;
    required?: boolean | null;
    filled_count?: number | string | null;
    total_submissions?: number | string | null;
    fill_rate?: number | string | null;
  }>;
  conversion?: {
    available?: boolean | null;
    views?: number | string | null;
    accepted?: number | string | null;
    rate?: number | string | null;
    previous_rate?: number | string | null;
    note?: string | null;
    trend?: RawFormAnalyticsTrend | null;
  } | null;
  last_submission_at?: string | null;
}

interface RawFormAnalyticsTrend {
  has_trend?: boolean | null;
  direction?: string | null;
  sentiment?: string | null;
  change_percentage?: number | string | null;
  delta_value?: number | string | null;
}

interface RawFormAnalyticsMetric {
  value?: number | string | null;
  previous_value?: number | string | null;
  trend?: RawFormAnalyticsTrend | null;
}

interface RawFormAnalyticsPeriodSummary {
  total_submissions?: number | string | null;
  accepted_submissions?: number | string | null;
  rejected_submissions?: number | string | null;
  invalid_submissions?: number | string | null;
  rate_limited_submissions?: number | string | null;
  spam_submissions?: number | string | null;
  acceptance_rate?: number | string | null;
  rejection_rate?: number | string | null;
}

interface RawDeleteFormSubmissionsResponse {
  deleted_count?: number | string | null;
  deleted_ids?: string[] | null;
}

const EMPTY_SUBMISSIONS_SUMMARY: FormSubmissionsPageSummary = {
  total: 0,
  accepted: 0,
  rejected: 0,
  acceptRate: 0,
  last7Days: 0,
  previous7Days: 0,
  trend: 0,
  rejectionBreakdown: {
    invalid: 0,
    rateLimit: 0,
    spam: 0,
  },
};

const EMPTY_ANALYTICS_TOTALS: FormAnalyticsTotals = {
  totalSubmissions: 0,
  totalAccepted: 0,
  totalInvalid: 0,
  totalRateLimited: 0,
  totalSpam: 0,
};

const EMPTY_ANALYTICS_RANGE: FormAnalyticsRange = {
  days: 0,
  isAllTime: true,
  comparisonLabel: null,
};

const EMPTY_ANALYTICS_TREND: FormAnalyticsTrend = {
  hasTrend: false,
  direction: "none",
  sentiment: "neutral",
  changePercentage: null,
  deltaValue: null,
};

const EMPTY_ANALYTICS_METRIC: FormAnalyticsMetric = {
  value: null,
  previousValue: null,
  trend: EMPTY_ANALYTICS_TREND,
};

const EMPTY_ANALYTICS_PERIOD_SUMMARY: FormAnalyticsPeriodSummary = {
  totalSubmissions: 0,
  acceptedSubmissions: 0,
  rejectedSubmissions: 0,
  invalidSubmissions: 0,
  rateLimitedSubmissions: 0,
  spamSubmissions: 0,
  acceptanceRate: 0,
  rejectionRate: 0,
};

const EMPTY_ANALYTICS_REJECTION_BREAKDOWN: FormAnalyticsRejectionBreakdown = {
  totalRejections: 0,
  slices: [],
};

const EMPTY_ANALYTICS_CONVERSION: FormAnalyticsConversion = {
  available: false,
  views: null,
  accepted: 0,
  rate: null,
  previousRate: null,
  note: "Enable form view tracking for conversion analytics.",
  trend: EMPTY_ANALYTICS_TREND,
};

const EMPTY_ANALYTICS_SUMMARY: FormAnalyticsSummary = {
  current: EMPTY_ANALYTICS_PERIOD_SUMMARY,
  previous: null,
  metrics: {
    totalSubmissions: EMPTY_ANALYTICS_METRIC,
    acceptedSubmissions: EMPTY_ANALYTICS_METRIC,
    rejectedSubmissions: EMPTY_ANALYTICS_METRIC,
    conversionRate: EMPTY_ANALYTICS_METRIC,
  },
};

const EMPTY_ANALYTICS_DATA: FormAnalyticsData = {
  range: EMPTY_ANALYTICS_RANGE,
  summary: EMPTY_ANALYTICS_SUMMARY,
  daily: [],
  topReferrers: [],
  rejectionBreakdown: EMPTY_ANALYTICS_REJECTION_BREAKDOWN,
  fieldFillRates: [],
  conversion: EMPTY_ANALYTICS_CONVERSION,
  totals: EMPTY_ANALYTICS_TOTALS,
  total: 0,
  accepted: 0,
  rejected: 0,
  acceptanceRate: 0,
  lastSubmission: null,
};

async function getAuthenticatedTenantContext() {
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;

  if (!user) {
    throw new Error("Not authenticated");
  }

  const { data: userData, error } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (error) {
    throw error;
  }

  if (!userData?.tenant_id) {
    throw new Error("No tenant found");
  }

  return {
    userId: user.id,
    tenantId: userData.tenant_id,
  };
}

function toNumber(value: number | string | null | undefined): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function toNullableNumber(
  value: number | string | null | undefined,
): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return value.toLowerCase() === "true";
  }

  return false;
}

function toStringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeTheme(value: unknown): FormTheme {
  return isRecord(value) ? (value as FormTheme) : {};
}

function normalizeSettings(value: unknown): FormSettings {
  const candidate = isRecord(value) ? (value as Partial<FormSettings>) : {};

  return {
    ...DEFAULT_FORM_SETTINGS,
    ...candidate,
    theme: {
      ...DEFAULT_FORM_SETTINGS.theme,
      ...normalizeTheme(candidate.theme),
    },
    notification_emails: Array.isArray(candidate.notification_emails)
      ? candidate.notification_emails.filter(
          (email): email is string => typeof email === "string",
        )
      : DEFAULT_FORM_SETTINGS.notification_emails,
  };
}

function normalizeCompliance(value: unknown): FormCompliance {
  const candidate = isRecord(value) ? (value as Partial<FormCompliance>) : {};

  return {
    ...DEFAULT_FORM_COMPLIANCE,
    ...candidate,
  };
}

function normalizeAudience(value: unknown): FormAudience {
  const candidate = isRecord(value) ? (value as Partial<FormAudience>) : {};

  return {
    assign_personas: Array.isArray(candidate.assign_personas)
      ? candidate.assign_personas.filter(
          (personaId): personaId is string => typeof personaId === "string",
        )
      : DEFAULT_FORM_AUDIENCE.assign_personas,
    assign_tags: Array.isArray(candidate.assign_tags)
      ? candidate.assign_tags.filter(
          (tagId): tagId is string => typeof tagId === "string",
        )
      : DEFAULT_FORM_AUDIENCE.assign_tags,
  };
}

function mapFormRow(row: FormRow): Form {
  return {
    ...row,
    name: typeof row.name === "string" ? row.name : "",
    embed_key: typeof row.embed_key === "string" ? row.embed_key : "",
    fields_json: Array.isArray(row.fields_json)
      ? (row.fields_json as unknown as FormField[])
      : [],
    settings_json: normalizeSettings(row.settings_json),
    compliance_json: normalizeCompliance(row.compliance_json),
    audience_json: normalizeAudience(row.audience_json),
  };
}

function mapFormWithStatsRow(row: RawFormsWithStatsRow): FormWithStats {
  return {
    ...mapFormRow(row),
    total_submissions: toNumber(row.total_submissions),
    recent_submissions: toNumber(row.recent_submissions),
    recent_accepted: toNumber(row.recent_accepted),
    recent_rejected: toNumber(row.recent_rejected),
    last_submission_at: row.last_submission_at,
  };
}

function mapFormSubmissionRow(row: FormSubmissionRow): FormSubmission {
  return {
    ...row,
    data: row.data as Record<string, FormSubmissionValue>,
    metadata: row.metadata as FormSubmissionMetadata,
    result: row.result as SubmissionResult,
  } as FormSubmission;
}

function mapFormSubmissionsPageResponse(
  raw: RawFormSubmissionsPageResponse | null | undefined,
): FormSubmissionsPageData {
  return {
    rows: (raw?.rows || []).map(mapFormSubmissionRow),
    summary: {
      total: toNumber(raw?.summary?.total),
      accepted: toNumber(raw?.summary?.accepted),
      rejected: toNumber(raw?.summary?.rejected),
      acceptRate: toNumber(raw?.summary?.accept_rate),
      last7Days: toNumber(raw?.summary?.last_7_days),
      previous7Days: toNumber(raw?.summary?.previous_7_days),
      trend: toNumber(raw?.summary?.trend),
      rejectionBreakdown: {
        invalid: toNumber(raw?.summary?.rejection_breakdown?.invalid),
        rateLimit: toNumber(raw?.summary?.rejection_breakdown?.rate_limited),
        spam: toNumber(raw?.summary?.rejection_breakdown?.spam),
      },
    },
    filteredTotal: toNumber(raw?.filtered_total),
    unfilteredTotal: toNumber(raw?.unfiltered_total),
    page: Math.max(1, toNumber(raw?.page) || 1),
    pageSize: Math.max(1, toNumber(raw?.page_size) || 25),
    totalPages: Math.max(0, toNumber(raw?.total_pages)),
  };
}

function formatReferrerDisplay(referrer: string): string {
  try {
    const url = new URL(referrer);
    return url.hostname + (url.pathname !== "/" ? url.pathname : "");
  } catch {
    return referrer;
  }
}

function mapFormAnalyticsTrend(
  raw: RawFormAnalyticsTrend | null | undefined,
): FormAnalyticsTrend {
  const direction = raw?.direction;
  const sentiment = raw?.sentiment;

  return {
    hasTrend: toBoolean(raw?.has_trend),
    direction:
      direction === "up" ||
      direction === "down" ||
      direction === "flat" ||
      direction === "none"
        ? direction
        : "none",
    sentiment:
      sentiment === "positive" ||
      sentiment === "negative" ||
      sentiment === "neutral"
        ? sentiment
        : "neutral",
    changePercentage: toNullableNumber(raw?.change_percentage),
    deltaValue: toNullableNumber(raw?.delta_value),
  };
}

function mapFormAnalyticsMetric(
  raw: RawFormAnalyticsMetric | null | undefined,
): FormAnalyticsMetric {
  return {
    value: toNullableNumber(raw?.value),
    previousValue: toNullableNumber(raw?.previous_value),
    trend: mapFormAnalyticsTrend(raw?.trend),
  };
}

function mapFormAnalyticsPeriodSummary(
  raw: RawFormAnalyticsPeriodSummary | null | undefined,
): FormAnalyticsPeriodSummary {
  return {
    totalSubmissions: toNumber(raw?.total_submissions),
    acceptedSubmissions: toNumber(raw?.accepted_submissions),
    rejectedSubmissions: toNumber(raw?.rejected_submissions),
    invalidSubmissions: toNumber(raw?.invalid_submissions),
    rateLimitedSubmissions: toNumber(raw?.rate_limited_submissions),
    spamSubmissions: toNumber(raw?.spam_submissions),
    acceptanceRate: toNumber(raw?.acceptance_rate),
    rejectionRate: toNumber(raw?.rejection_rate),
  };
}

function mapFormAnalyticsRange(
  raw: RawFormAnalyticsResponse["range"],
): FormAnalyticsRange {
  return {
    days: toNumber(raw?.days),
    isAllTime: toBoolean(raw?.is_all_time),
    comparisonLabel: toStringOrNull(raw?.comparison_label),
  };
}

function mapFormAnalyticsTotals(
  summary: FormAnalyticsPeriodSummary,
): FormAnalyticsTotals {
  return {
    totalSubmissions: summary.totalSubmissions,
    totalAccepted: summary.acceptedSubmissions,
    totalInvalid: summary.invalidSubmissions,
    totalRateLimited: summary.rateLimitedSubmissions,
    totalSpam: summary.spamSubmissions,
  };
}

function normalizeAnalyticsFieldType(
  value: string | null,
): FormAnalyticsFieldFillRate["fieldType"] {
  switch (value) {
    case "email":
    case "text":
    case "phone":
    case "select":
    case "checkbox":
    case "file":
    case "email_consent":
    case "sms_consent":
      return value;
    default:
      return "text";
  }
}

function normalizeAnalyticsRejectionKey(
  value: string | null,
): FormAnalyticsRejectionBreakdown["slices"][number]["key"] {
  switch (value) {
    case "rate_limited":
    case "spam":
      return value;
    case "invalid":
    default:
      return "invalid";
  }
}

function mapFormAnalyticsResponse(
  raw: RawFormAnalyticsResponse | null | undefined,
): FormAnalyticsData {
  const current = mapFormAnalyticsPeriodSummary(raw?.summary?.current);
  const previous = raw?.summary?.previous
    ? mapFormAnalyticsPeriodSummary(raw.summary.previous)
    : null;
  const totals = mapFormAnalyticsTotals(current);

  const daily: FormAnalyticsDailyPoint[] = (raw?.daily || []).map((entry) => ({
    day: entry.day || "",
    total: toNumber(entry.total),
    accepted: toNumber(entry.accepted),
    rejected: toNumber(entry.rejected),
  }));

  const topReferrers: FormAnalyticsReferrer[] = (raw?.top_referrers || []).map(
    (entry) => ({
      rank: toNumber(entry.rank),
      displayDomain:
        toStringOrNull(entry.display_domain) ||
        formatReferrerDisplay(toStringOrNull(entry.source_label) || "Direct"),
      sourceLabel: toStringOrNull(entry.source_label) || "Direct",
      count: toNumber(entry.count),
      sharePercentage: toNumber(entry.share_percentage),
      barPercentage: toNumber(entry.bar_percentage),
    }),
  );

  const fieldFillRates: FormAnalyticsFieldFillRate[] = (
    raw?.field_fill_rates || []
  ).map((entry) => ({
    fieldId:
      toStringOrNull(entry.field_id) ||
      `field-${toStringOrNull(entry.field_key) || toNumber(entry.field_order)}`,
    fieldKey: toStringOrNull(entry.field_key) || "unknown",
    label: toStringOrNull(entry.label) || "Untitled field",
    fieldType: normalizeAnalyticsFieldType(toStringOrNull(entry.field_type)),
    fieldOrder: toNumber(entry.field_order),
    required: toBoolean(entry.required),
    filledCount: toNumber(entry.filled_count),
    totalSubmissions: toNumber(entry.total_submissions),
    fillRate: toNumber(entry.fill_rate),
  }));

  const rejectionBreakdown: FormAnalyticsRejectionBreakdown = {
    totalRejections: toNumber(raw?.rejection_breakdown?.total_rejections),
    slices: (raw?.rejection_breakdown?.slices || []).map((slice) => ({
      key: normalizeAnalyticsRejectionKey(toStringOrNull(slice.key)),
      label: toStringOrNull(slice.label) || "Unknown",
      count: toNumber(slice.count),
      percentage: toNumber(slice.percentage),
    })),
  };

  const conversion: FormAnalyticsConversion = {
    available: toBoolean(raw?.conversion?.available),
    views: toNullableNumber(raw?.conversion?.views),
    accepted: toNumber(raw?.conversion?.accepted),
    rate: toNullableNumber(raw?.conversion?.rate),
    previousRate: toNullableNumber(raw?.conversion?.previous_rate),
    note:
      toStringOrNull(raw?.conversion?.note) || EMPTY_ANALYTICS_CONVERSION.note,
    trend: mapFormAnalyticsTrend(raw?.conversion?.trend),
  };

  const summary: FormAnalyticsSummary = {
    current,
    previous,
    metrics: {
      totalSubmissions: mapFormAnalyticsMetric(
        raw?.summary?.metrics?.total_submissions,
      ),
      acceptedSubmissions: mapFormAnalyticsMetric(
        raw?.summary?.metrics?.accepted_submissions,
      ),
      rejectedSubmissions: mapFormAnalyticsMetric(
        raw?.summary?.metrics?.rejected_submissions,
      ),
      conversionRate: mapFormAnalyticsMetric(
        raw?.summary?.metrics?.conversion_rate,
      ),
    },
  };

  return {
    range: mapFormAnalyticsRange(raw?.range),
    summary,
    daily,
    topReferrers,
    rejectionBreakdown,
    fieldFillRates,
    conversion,
    totals,
    total: current.totalSubmissions,
    accepted: current.acceptedSubmissions,
    rejected: current.rejectedSubmissions,
    acceptanceRate: current.acceptanceRate,
    lastSubmission: toStringOrNull(raw?.last_submission_at),
  };
}

export async function fetchFormSubmissionsPage(
  params: FetchFormSubmissionsPageParams,
): Promise<FormSubmissionsPageData> {
  const {
    formId,
    tenantId,
    page = 1,
    pageSize = 25,
    sortColumn = "submitted_at",
    sortDirection = "desc",
    resultFilter,
    search = "",
    dateFrom,
    dateTo,
    hideTestSubmissions = true,
  } = params;

  if (!formId || !tenantId) {
    return {
      rows: [],
      summary: EMPTY_SUBMISSIONS_SUMMARY,
      filteredTotal: 0,
      unfilteredTotal: 0,
      page,
      pageSize,
      totalPages: 0,
    };
  }

  const { data, error } = await supabase.rpc("get_form_submissions_page", {
    p_tenant_id: tenantId,
    p_form_id: formId,
    p_page: page,
    p_page_size: pageSize,
    p_result_filter:
      resultFilter && resultFilter !== "all" ? resultFilter : null,
    p_search: search.trim() || null,
    p_date_from: dateFrom || null,
    p_date_to: dateTo || null,
    p_sort_column: sortColumn,
    p_sort_direction: sortDirection,
    p_hide_test: hideTestSubmissions,
  });

  if (error) {
    throw error;
  }

  return mapFormSubmissionsPageResponse(
    data as RawFormSubmissionsPageResponse | null,
  );
}

export async function deleteFormSubmissions({
  formId,
  submissionIds,
  tenantId,
}: DeleteFormSubmissionsParams): Promise<DeleteFormSubmissionsResult> {
  if (submissionIds.length === 0) {
    return { deletedCount: 0, deletedIds: [] };
  }

  const { data, error } = await supabase.rpc("delete_form_submissions", {
    p_form_id: formId,
    p_submission_ids: submissionIds,
    p_tenant_id: tenantId,
  });

  if (error) {
    throw error;
  }

  const response = (data || {}) as RawDeleteFormSubmissionsResponse;
  return {
    deletedCount: toNumber(response.deleted_count),
    deletedIds: Array.isArray(response.deleted_ids)
      ? response.deleted_ids.filter(
          (submissionId): submissionId is string =>
            typeof submissionId === "string",
        )
      : [],
  };
}

export function useForms() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const formsQuery = useQuery({
    queryKey: ["forms"],
    queryFn: async () => {
      const { tenantId } = await getAuthenticatedTenantContext();

      const { data, error } = await supabase.rpc("get_forms_with_stats", {
        p_tenant_id: tenantId,
        p_stats_days: 7,
      });

      if (error) throw error;

      const rows = Array.isArray(data) ? data : [];
      return rows
        .filter((form): form is RawFormsWithStatsRow => isRecord(form))
        .map((form) => mapFormWithStatsRow(form as RawFormsWithStatsRow));
    },
  });

  const createFormMutation = useMutation({
    mutationFn: async (formData: CreateFormData) => {
      const { userId, tenantId } = await getAuthenticatedTenantContext();

      const brandColors = await fetchBrandColors(userId);

      const settingsWithBrandColors: FormSettings = {
        ...DEFAULT_FORM_SETTINGS,
        ...formData.settings_json,
        theme: {
          ...DEFAULT_FORM_SETTINGS.theme,
          primary_color: brandColors.primary,
          ...formData.settings_json?.theme,
        },
      };

      const { data, error } = await supabase
        .from("forms")
        .insert({
          tenant_id: tenantId,
          name: formData.name,
          status: "draft",
          fields_json: (formData.fields_json || []) as unknown as Json,
          settings_json: settingsWithBrandColors as unknown as Json,
          compliance_json: (formData.compliance_json ||
            DEFAULT_FORM_COMPLIANCE) as unknown as Json,
          audience_json: (formData.audience_json ||
            DEFAULT_FORM_AUDIENCE) as unknown as Json,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forms"] });
      toast({
        title: "Form created",
        description: "Your form has been created successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error creating form",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateFormMutation = useMutation({
    mutationFn: async ({ id, ...updates }: UpdateFormData) => {
      const { tenantId } = await getAuthenticatedTenantContext();

      const dbUpdates: Record<string, unknown> = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.status !== undefined) dbUpdates.status = updates.status;
      if (updates.fields_json !== undefined) {
        dbUpdates.fields_json = updates.fields_json as unknown as Json;
      }
      if (updates.settings_json !== undefined) {
        dbUpdates.settings_json = updates.settings_json as unknown as Json;
      }
      if (updates.compliance_json !== undefined) {
        dbUpdates.compliance_json = updates.compliance_json as unknown as Json;
      }
      if (updates.audience_json !== undefined) {
        dbUpdates.audience_json = updates.audience_json as unknown as Json;
      }

      const { data, error } = await supabase
        .from("forms")
        .update(dbUpdates)
        .eq("id", id)
        .eq("tenant_id", tenantId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forms"] });
    },
    onError: (error) => {
      toast({
        title: "Error updating form",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteFormMutation = useMutation({
    mutationFn: async (formId: string) => {
      const { tenantId } = await getAuthenticatedTenantContext();

      const { error } = await supabase
        .from("forms")
        .delete()
        .eq("id", formId)
        .eq("tenant_id", tenantId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forms"] });
      toast({
        title: "Form deleted",
        description: "Your form has been deleted.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error deleting form",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    forms: (formsQuery.data || []) as FormWithStats[],
    isLoading: formsQuery.isLoading,
    isError: formsQuery.isError,
    isRefetching: formsQuery.isRefetching,
    error: formsQuery.error,
    refetchForms: formsQuery.refetch,
    createForm: createFormMutation.mutateAsync,
    updateForm: updateFormMutation.mutateAsync,
    deleteForm: deleteFormMutation.mutateAsync,
    isCreating: createFormMutation.isPending,
    isUpdating: updateFormMutation.isPending,
    isDeleting: deleteFormMutation.isPending,
  };
}

export function useForm(
  formId: string | undefined,
  tenantId: string | undefined,
) {
  return useQuery({
    queryKey: ["form", tenantId, formId],
    queryFn: async () => {
      if (!formId || !tenantId) return null;

      const { data, error } = await supabase
        .from("forms")
        .select("*")
        .eq("id", formId)
        .eq("tenant_id", tenantId)
        .single();

      if (error) throw error;

      return mapFormRow(data as FormRow);
    },
    enabled: !!formId && !!tenantId,
  });
}

export function useFormSubmissionsPage(
  formId: string | undefined,
  tenantId: string | undefined,
  page: number = 1,
  pageSize: number = 25,
  sortColumn: FormSubmissionSortColumn = "submitted_at",
  sortDirection: SortDirection = "desc",
  resultFilter: string | null = null,
  search: string = "",
  dateFrom: string | null = null,
  dateTo: string | null = null,
  hideTestSubmissions: boolean = true,
) {
  return useQuery({
    queryKey: [
      "form-submissions-page",
      tenantId,
      formId,
      page,
      pageSize,
      sortColumn,
      sortDirection,
      resultFilter,
      search,
      dateFrom,
      dateTo,
      hideTestSubmissions,
    ],
    queryFn: async () => {
      return fetchFormSubmissionsPage({
        formId,
        tenantId,
        page,
        pageSize,
        sortColumn,
        sortDirection,
        resultFilter,
        search,
        dateFrom,
        dateTo,
        hideTestSubmissions,
      });
    },
    enabled: !!formId && !!tenantId,
  });
}

export function useDeleteFormSubmissions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteFormSubmissions,
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({
        queryKey: [
          "form-submissions-page",
          variables.tenantId,
          variables.formId,
        ],
      });
      queryClient.invalidateQueries({
        queryKey: ["form-analytics", variables.tenantId, variables.formId],
      });

      toast({
        title:
          result.deletedCount === 1
            ? "Submission deleted"
            : "Submissions deleted",
        description:
          result.deletedCount === 1
            ? "The selected submission was removed."
            : `${result.deletedCount} submissions were removed.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useFormAnalytics(
  formId: string | undefined,
  tenantId: string | undefined,
  days: number = 0,
) {
  return useQuery({
    queryKey: ["form-analytics", tenantId, formId, days],
    queryFn: async () => {
      if (!formId || !tenantId) {
        return EMPTY_ANALYTICS_DATA;
      }

      const { data, error } = await supabase.rpc("get_form_analytics", {
        p_tenant_id: tenantId,
        p_form_id: formId,
        p_days: days,
      });

      if (error) throw error;

      return mapFormAnalyticsResponse(data as RawFormAnalyticsResponse | null);
    },
    enabled: !!formId && !!tenantId,
    staleTime: 30000,
  });
}
