import { useCallback, useEffect, useMemo, useState } from "react";
import Checkbox from "@mui/joy/Checkbox";
import CircularProgress from "@mui/joy/CircularProgress";
import Grid from "@mui/joy/Grid";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import Chip from "@mui/joy/Chip";
import {
  ArrowLeft,
  Mail,
  PauseCircle,
  PlayCircle,
  Plus,
  Search,
  Shield,
  Trash2,
  X,
} from "lucide-react";
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";
import { supabase } from "@/integrations/supabase/client";
import {
  formatReputationRate,
  getDomainStatusConfig,
} from "@/lib/email/domainService";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyFormSection } from "@/components/joy/JoyFormSection";
import { JoyInput as Input } from "@/components/joy/JoyInput";
import { JoySearchInput } from "@/components/joy/JoySearchInput";
import { JoySelect } from "@/components/joy/JoySelect";
import { JoySwitch } from "@/components/joy/JoySwitch";
import { PageContainer } from "@/components/joy/PageContainer";
import {
  JoyTable,
  JoyTableBody,
  JoyTableCell,
  JoyTableHead,
  JoyTableHeaderCell,
  JoyTablePagination,
  JoyTableRow,
} from "@/components/joy/JoyTable";
import Skeleton from "@mui/joy/Skeleton";

interface MetricBucket {
  sent: number;
  delivered: number;
  hard_bounce_count: number;
  soft_bounce_count: number;
  complaint_count: number;
  unsubscribe_count: number;
  failed_count: number;
  hard_bounce_rate: number;
  soft_bounce_rate: number;
  complaint_rate: number;
  unsubscribe_rate: number;
  delivery_failure_rate: number;
}

interface ThresholdField {
  value: number;
  source: string;
}

interface TenantEmailPanelData {
  tenant_id: string;
  company_name: string | null;
  as_of: string;
  reputation_score: number;
  current_reputation_tier: string;
  reputation_action: string;
  metrics_24h: MetricBucket;
  metrics_30d: MetricBucket;
  current_thresholds_effective: {
    hard_bounce_rate: ThresholdField;
    soft_bounce_rate: ThresholdField;
    complaint_rate: ThresholdField;
    spam_rate: ThresholdField;
    delivery_failure_rate: ThresholdField;
  };
  current_send_limits: {
    recipient_cap: number | null;
    job_batch_size: number;
    send_pacing_multiplier: number;
    is_unlimited: boolean;
    monthly_limit: number | null;
    daily_limit: number | null;
    hourly_limit: number | null;
  };
  sending_limit_state?: {
    unlimited_sending_enabled: boolean;
    emergency_restriction_enabled: boolean;
    emergency_restriction_until: string | null;
    emergency_restriction_reason: string | null;
    emergency_restriction_active: boolean;
    base_monthly_limit: number | null;
    base_daily_limit: number | null;
    base_hourly_limit: number | null;
    boost_until: string | null;
    boost_monthly: number | null;
    boost_daily: number | null;
    boost_hourly: number | null;
    boost_reason: string | null;
    boost_active: boolean;
    effective_monthly_limit: number | null;
    effective_daily_limit: number | null;
    effective_hourly_limit: number | null;
    monthly_used: number;
    daily_used: number;
    hourly_used: number;
  };
  reputation_state: {
    manual_reputation_score: number | null;
    is_reputation_frozen: boolean;
    reputation_override_mode: "final" | "temporary" | null;
    reputation_override_expires_at: string | null;
    reputation_override_reason: string | null;
    reputation_override_active: boolean;
    penalties_disabled_until: string | null;
    penalties_disabled_reason: string | null;
    penalties_disabled_active: boolean;
    forgive_bounce_before: string | null;
    forgive_complaint_before: string | null;
  };
  tenant_overrides: Record<string, unknown>;
}

interface TenantSuppressionRow {
  id: string;
  email: string;
  suppression_type: string;
  reason: string | null;
  auto_suppressed: boolean;
  suppressed_at: string;
  expires_at: string | null;
}

interface TenantSuppressionControls {
  suppression_bypass_enabled: boolean;
  suppression_bypass_until: string | null;
  suppression_bypass_reason: string | null;
  suppression_bypass_automation_mode:
    | "campaign_only"
    | "campaign_and_automation";
  suppression_bypass_active: boolean;
}

interface TenantCampaignCreationLockState {
  campaign_creation_locked: boolean;
  campaign_creation_locked_reason: string | null;
}

interface TenantCampaignInterventionRow {
  id: string;
  name: string;
  subject_line: string | null;
  status: string;
  scheduled_at: string | null;
  send_started_at: string | null;
  sent_at: string | null;
  updated_at: string;
  created_at: string;
  admin_paused: boolean;
  force_stopped: boolean;
  autopause_override_enabled: boolean;
  autopause_override_precedence: "final_override" | "automation_allowed";
  autopause_override_until?: string | null;
}

interface TenantUnderReviewOverrideState {
  tenant_id: string;
  under_review_override_enabled: boolean;
  under_review_override_precedence: "final_override" | "automation_allowed";
  under_review_override_until: string | null;
  under_review_override_reason: string | null;
  under_review_override_active: boolean;
  under_review_override_final: boolean;
}

interface TenantEmailDomainRow {
  id: string;
  tenant_id: string;
  domain: string;
  status: string;
  manual_pause: boolean;
  bounce_rate_30d: number | null;
  complaint_rate_30d: number | null;
  total_sent_30d: number | null;
  total_bounces_30d: number | null;
  total_complaints_30d: number | null;
  updated_at: string | null;
  notes: string | null;
}

const toPercent = (fraction: number) => `${(fraction * 100).toFixed(3)}%`;

const toDateTimeLocal = (value: string | null | undefined) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const toIsoOrNull = (value: string) => {
  if (!value.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const toIntOrNull = (value: string) => {
  if (!value.trim()) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.floor(parsed));
};

const SUPPRESSION_PAGE_SIZE = 20;
const CAMPAIGN_PAGE_SIZE = 20;

const formatStatusLabel = (value: string) =>
  value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

const getDomainStatusChipColor = (status: string) => {
  switch (status) {
    case "active":
    case "warming_up":
      return "success";
    case "verifying":
      return "info";
    case "pending_dns":
      return "warning";
    case "paused":
    case "blocked":
      return "danger";
    default:
      return "neutral";
  }
};

const getCampaignStatusChip = (status: string) => {
  const normalized = status.toLowerCase();

  if (
    ["active", "running", "sent", "delivered", "completed"].includes(normalized)
  ) {
    return { color: "success", label: formatStatusLabel(status) };
  }

  if (["paused", "scheduled", "queued", "pending"].includes(normalized)) {
    return { color: "warning", label: formatStatusLabel(status) };
  }

  if (
    ["failed", "cancelled", "stopped", "force_stopped"].includes(normalized)
  ) {
    return { color: "danger", label: formatStatusLabel(status) };
  }

  if (normalized === "draft") {
    return { color: "neutral", label: "Draft" };
  }

  return { color: "neutral", label: formatStatusLabel(status) };
};

const getRateTone = (
  value: number | null,
  warningThreshold: number,
  dangerThreshold: number,
) => {
  if (value == null || !Number.isFinite(Number(value))) {
    return "neutral.500";
  }

  if (value >= dangerThreshold) {
    return "danger.700";
  }

  if (value >= warningThreshold) {
    return "warning.700";
  }

  return "success.700";
};

const embeddedFormSectionSx = {
  backgroundColor: "neutral.50",
  borderColor: "neutral.200",
  boxShadow: "none",
};

export default function TenantEmailManagement() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const navigate = useNavigate();
  const { data: isSuperAdmin, isLoading } = useIsSuperAdmin();

  const [panel, setPanel] = useState<TenantEmailPanelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const [domainRows, setDomainRows] = useState<TenantEmailDomainRow[]>([]);
  const [domainCount, setDomainCount] = useState(0);
  const [domainLoading, setDomainLoading] = useState(true);

  const [manualScore, setManualScore] = useState("");
  const [overrideMode, setOverrideMode] = useState<"final" | "temporary">(
    "final",
  );
  const [overrideExpiresAt, setOverrideExpiresAt] = useState("");
  const [overrideReason, setOverrideReason] = useState("");

  const [penaltiesDisableUntil, setPenaltiesDisableUntil] = useState("");
  const [penaltiesReason, setPenaltiesReason] = useState("");
  const [monthlyLimitInput, setMonthlyLimitInput] = useState("");
  const [dailyLimitInput, setDailyLimitInput] = useState("");
  const [hourlyLimitInput, setHourlyLimitInput] = useState("");
  const [sendingLimitReason, setSendingLimitReason] = useState("");
  const [unlimitedMode, setUnlimitedMode] = useState(false);
  const [emergencyRestrictionEnabled, setEmergencyRestrictionEnabled] =
    useState(false);
  const [emergencyRestrictionUntil, setEmergencyRestrictionUntil] =
    useState("");
  const [emergencyRestrictionReason, setEmergencyRestrictionReason] =
    useState("");
  const [boostMonthlyInput, setBoostMonthlyInput] = useState("");
  const [boostDailyInput, setBoostDailyInput] = useState("");
  const [boostHourlyInput, setBoostHourlyInput] = useState("");
  const [boostUntilInput, setBoostUntilInput] = useState("");
  const [boostReason, setBoostReason] = useState("");

  const sendLimitDefaults = useMemo(() => {
    return {
      monthlyLimitInput:
        panel?.sending_limit_state?.base_monthly_limit?.toString() ?? "",
      dailyLimitInput:
        panel?.sending_limit_state?.base_daily_limit?.toString() ?? "",
      hourlyLimitInput:
        panel?.sending_limit_state?.base_hourly_limit?.toString() ?? "",
      unlimitedMode: Boolean(
        panel?.sending_limit_state?.unlimited_sending_enabled,
      ),
      emergencyRestrictionEnabled: Boolean(
        panel?.sending_limit_state?.emergency_restriction_enabled,
      ),
      emergencyRestrictionUntil: toDateTimeLocal(
        panel?.sending_limit_state?.emergency_restriction_until,
      ),
      emergencyRestrictionReason:
        panel?.sending_limit_state?.emergency_restriction_reason ?? "",
      boostMonthlyInput:
        panel?.sending_limit_state?.boost_monthly?.toString() ?? "",
      boostDailyInput:
        panel?.sending_limit_state?.boost_daily?.toString() ?? "",
      boostHourlyInput:
        panel?.sending_limit_state?.boost_hourly?.toString() ?? "",
      boostUntilInput: toDateTimeLocal(panel?.sending_limit_state?.boost_until),
      boostReason: panel?.sending_limit_state?.boost_reason ?? "",
    };
  }, [panel]);

  const sendLimitIsDirty = useMemo(() => {
    if (!panel) return false;
    return (
      monthlyLimitInput !== sendLimitDefaults.monthlyLimitInput ||
      dailyLimitInput !== sendLimitDefaults.dailyLimitInput ||
      hourlyLimitInput !== sendLimitDefaults.hourlyLimitInput ||
      unlimitedMode !== sendLimitDefaults.unlimitedMode ||
      emergencyRestrictionEnabled !==
        sendLimitDefaults.emergencyRestrictionEnabled ||
      emergencyRestrictionUntil !==
        sendLimitDefaults.emergencyRestrictionUntil ||
      emergencyRestrictionReason !==
        sendLimitDefaults.emergencyRestrictionReason ||
      boostMonthlyInput !== sendLimitDefaults.boostMonthlyInput ||
      boostDailyInput !== sendLimitDefaults.boostDailyInput ||
      boostHourlyInput !== sendLimitDefaults.boostHourlyInput ||
      boostUntilInput !== sendLimitDefaults.boostUntilInput ||
      boostReason !== sendLimitDefaults.boostReason ||
      Boolean(sendingLimitReason.trim())
    );
  }, [
    boostDailyInput,
    boostHourlyInput,
    boostMonthlyInput,
    boostReason,
    boostUntilInput,
    dailyLimitInput,
    emergencyRestrictionEnabled,
    emergencyRestrictionReason,
    emergencyRestrictionUntil,
    hourlyLimitInput,
    monthlyLimitInput,
    panel,
    sendLimitDefaults,
    sendingLimitReason,
    unlimitedMode,
  ]);

  const resetSendLimitControls = useCallback(() => {
    if (!panel) return;
    setMonthlyLimitInput(sendLimitDefaults.monthlyLimitInput);
    setDailyLimitInput(sendLimitDefaults.dailyLimitInput);
    setHourlyLimitInput(sendLimitDefaults.hourlyLimitInput);
    setUnlimitedMode(sendLimitDefaults.unlimitedMode);
    setEmergencyRestrictionEnabled(
      sendLimitDefaults.emergencyRestrictionEnabled,
    );
    setEmergencyRestrictionUntil(sendLimitDefaults.emergencyRestrictionUntil);
    setEmergencyRestrictionReason(sendLimitDefaults.emergencyRestrictionReason);
    setBoostMonthlyInput(sendLimitDefaults.boostMonthlyInput);
    setBoostDailyInput(sendLimitDefaults.boostDailyInput);
    setBoostHourlyInput(sendLimitDefaults.boostHourlyInput);
    setBoostUntilInput(sendLimitDefaults.boostUntilInput);
    setBoostReason(sendLimitDefaults.boostReason);
    setSendingLimitReason("");
  }, [panel, sendLimitDefaults]);

  const [suppressionSearch, setSuppressionSearch] = useState("");
  const [suppressionReasonFilter, setSuppressionReasonFilter] = useState<
    "all" | "bounce" | "complaint" | "unsubscribe"
  >("all");
  const [suppressionPage, setSuppressionPage] = useState(0);
  const [suppressionRows, setSuppressionRows] = useState<
    TenantSuppressionRow[]
  >([]);
  const [suppressionCount, setSuppressionCount] = useState(0);
  const [selectedSuppressionIds, setSelectedSuppressionIds] = useState<
    string[]
  >([]);
  const [suppressionControls, setSuppressionControls] =
    useState<TenantSuppressionControls | null>(null);

  const [manualSuppressionEmail, setManualSuppressionEmail] = useState("");
  const [manualSuppressionType, setManualSuppressionType] = useState<
    "bounced" | "complaint" | "unsubscribed"
  >("bounced");
  const [manualSuppressionReason, setManualSuppressionReason] = useState("");
  const [manualSuppressionExpiresAt, setManualSuppressionExpiresAt] =
    useState("");

  const [suppressionBypassEnabled, setSuppressionBypassEnabled] =
    useState(false);
  const [suppressionBypassUntil, setSuppressionBypassUntil] = useState("");
  const [suppressionBypassReason, setSuppressionBypassReason] = useState("");
  const [suppressionAutomationMode, setSuppressionAutomationMode] = useState<
    "campaign_only" | "campaign_and_automation"
  >("campaign_only");

  const [campaignCreationLocked, setCampaignCreationLocked] = useState(false);
  const [campaignCreationLockReason, setCampaignCreationLockReason] =
    useState("");
  const [campaignSearch, setCampaignSearch] = useState("");
  const [campaignStatusFilter, setCampaignStatusFilter] = useState("all");
  const [campaignPage, setCampaignPage] = useState(0);
  const [campaignRows, setCampaignRows] = useState<
    TenantCampaignInterventionRow[]
  >([]);
  const [campaignCount, setCampaignCount] = useState(0);
  const [campaignOverrideReason, setCampaignOverrideReason] = useState("");
  const [campaignOverrideUntil, setCampaignOverrideUntil] = useState("");
  const [campaignOverrideModeById, setCampaignOverrideModeById] = useState<
    Record<string, "final_override" | "automation_allowed">
  >({});

  const [underReviewOverrideEnabled, setUnderReviewOverrideEnabled] =
    useState(false);
  const [underReviewOverridePrecedence, setUnderReviewOverridePrecedence] =
    useState<"final_override" | "automation_allowed">("automation_allowed");
  const [underReviewOverrideUntil, setUnderReviewOverrideUntil] = useState("");
  const [underReviewOverrideReason, setUnderReviewOverrideReason] =
    useState("");
  const [underReviewOverrideActive, setUnderReviewOverrideActive] =
    useState(false);

  const [overrideHardBounce, setOverrideHardBounce] = useState("");
  const [overrideComplaint, setOverrideComplaint] = useState("");
  const [overrideSpam, setOverrideSpam] = useState("");
  const [overrideHealthyMin, setOverrideHealthyMin] = useState("");
  const [overrideWarningMin, setOverrideWarningMin] = useState("");
  const [overrideRiskMin, setOverrideRiskMin] = useState("");
  const [overrideBatchSize, setOverrideBatchSize] = useState("");

  const loadPanel = useCallback(async () => {
    if (!tenantId) return;

    setLoading(true);
    const { data, error } = await supabase.rpc(
      "admin_get_tenant_email_management_panel" as never,
      {
        p_tenant_id: tenantId,
      } as never,
    );

    if (error) {
      toast.error(
        error.message || "Failed to load tenant email management panel",
      );
      setLoading(false);
      return;
    }

    const panelData = data as TenantEmailPanelData;
    setPanel(panelData);
    setManualScore(
      panelData.reputation_state?.manual_reputation_score?.toString() ?? "",
    );
    setOverrideMode(
      panelData.reputation_state?.reputation_override_mode === "temporary"
        ? "temporary"
        : "final",
    );
    setOverrideExpiresAt(
      toDateTimeLocal(
        panelData.reputation_state?.reputation_override_expires_at,
      ),
    );
    setPenaltiesDisableUntil(
      toDateTimeLocal(panelData.reputation_state?.penalties_disabled_until),
    );
    setMonthlyLimitInput(
      panelData.sending_limit_state?.base_monthly_limit?.toString() ?? "",
    );
    setDailyLimitInput(
      panelData.sending_limit_state?.base_daily_limit?.toString() ?? "",
    );
    setHourlyLimitInput(
      panelData.sending_limit_state?.base_hourly_limit?.toString() ?? "",
    );
    setUnlimitedMode(
      Boolean(panelData.sending_limit_state?.unlimited_sending_enabled),
    );
    setEmergencyRestrictionEnabled(
      Boolean(panelData.sending_limit_state?.emergency_restriction_enabled),
    );
    setEmergencyRestrictionUntil(
      toDateTimeLocal(
        panelData.sending_limit_state?.emergency_restriction_until,
      ),
    );
    setEmergencyRestrictionReason(
      panelData.sending_limit_state?.emergency_restriction_reason ?? "",
    );
    setBoostMonthlyInput(
      panelData.sending_limit_state?.boost_monthly?.toString() ?? "",
    );
    setBoostDailyInput(
      panelData.sending_limit_state?.boost_daily?.toString() ?? "",
    );
    setBoostHourlyInput(
      panelData.sending_limit_state?.boost_hourly?.toString() ?? "",
    );
    setBoostUntilInput(
      toDateTimeLocal(panelData.sending_limit_state?.boost_until),
    );
    setBoostReason(panelData.sending_limit_state?.boost_reason ?? "");

    const reputationTiers =
      (panelData.tenant_overrides?.reputation_tiers as
        | Record<string, unknown>
        | undefined) || {};
    const hardStop =
      (panelData.tenant_overrides?.hard_stop_thresholds as
        | Record<string, unknown>
        | undefined) || {};
    const batch =
      (panelData.tenant_overrides?.batch as
        | Record<string, unknown>
        | undefined) || {};

    setOverrideHardBounce(hardStop.hard_bounce_rate?.toString() ?? "");
    setOverrideComplaint(hardStop.complaint_rate?.toString() ?? "");
    setOverrideSpam(hardStop.spam_rate?.toString() ?? "");
    setOverrideHealthyMin(reputationTiers.healthy_min?.toString() ?? "");
    setOverrideWarningMin(reputationTiers.warning_min?.toString() ?? "");
    setOverrideRiskMin(reputationTiers.risk_min?.toString() ?? "");
    setOverrideBatchSize(batch.max_batch_size?.toString() ?? "");

    const { data: controlsData, error: controlsError } = await supabase.rpc(
      "admin_get_tenant_suppression_controls" as never,
      {
        p_tenant_id: tenantId,
      } as never,
    );

    if (!controlsError) {
      const controls = controlsData as TenantSuppressionControls;
      setSuppressionControls(controls);
      setSuppressionBypassEnabled(
        Boolean(controls?.suppression_bypass_enabled),
      );
      setSuppressionBypassUntil(
        toDateTimeLocal(controls?.suppression_bypass_until),
      );
      setSuppressionBypassReason(controls?.suppression_bypass_reason || "");
      setSuppressionAutomationMode(
        controls?.suppression_bypass_automation_mode ===
          "campaign_and_automation"
          ? "campaign_and_automation"
          : "campaign_only",
      );
    }

    const { data: lockData, error: lockError } = await supabase.rpc(
      "admin_get_tenant_campaign_creation_lock" as never,
      {
        p_tenant_id: tenantId,
      } as never,
    );

    if (!lockError) {
      const lockState = lockData as TenantCampaignCreationLockState;
      setCampaignCreationLocked(Boolean(lockState?.campaign_creation_locked));
      setCampaignCreationLockReason(
        lockState?.campaign_creation_locked_reason || "",
      );
    }

    const { data: underReviewData, error: underReviewError } =
      await supabase.rpc(
        "admin_get_tenant_under_review_override" as never,
        {
          p_tenant_id: tenantId,
        } as never,
      );

    if (!underReviewError && underReviewData) {
      const overrideState = underReviewData as TenantUnderReviewOverrideState;
      setUnderReviewOverrideEnabled(
        Boolean(overrideState?.under_review_override_enabled),
      );
      setUnderReviewOverridePrecedence(
        overrideState?.under_review_override_precedence === "final_override"
          ? "final_override"
          : "automation_allowed",
      );
      setUnderReviewOverrideUntil(
        toDateTimeLocal(overrideState?.under_review_override_until),
      );
      setUnderReviewOverrideReason(
        overrideState?.under_review_override_reason || "",
      );
      setUnderReviewOverrideActive(
        Boolean(overrideState?.under_review_override_active),
      );
    }

    setLoading(false);
  }, [tenantId]);

  const loadDomains = useCallback(async () => {
    if (!tenantId) return;

    setDomainLoading(true);
    const { data, error } = await supabase.rpc(
      "admin_list_tenant_email_domains" as never,
      {
        p_tenant_id: tenantId,
      } as never,
    );

    if (error) {
      toast.error(error.message || "Failed to load tenant domains");
      setDomainRows([]);
      setDomainCount(0);
      setDomainLoading(false);
      return;
    }

    const payload =
      (data as { data?: TenantEmailDomainRow[]; count?: number }) || {};
    setDomainRows(payload.data || []);
    setDomainCount(Number(payload.count || 0));
    setDomainLoading(false);
  }, [tenantId]);

  const loadSuppressionList = useCallback(async () => {
    if (!tenantId) return;

    const { data, error } = await supabase.rpc(
      "admin_list_tenant_suppressions" as never,
      {
        p_tenant_id: tenantId,
        p_search: suppressionSearch.trim() || null,
        p_reason_filter: suppressionReasonFilter,
        p_page: suppressionPage,
        p_page_size: SUPPRESSION_PAGE_SIZE,
      } as never,
    );

    if (error) {
      toast.error(error.message || "Failed to load tenant suppressions");
      return;
    }

    const payload =
      (data as { data?: TenantSuppressionRow[]; count?: number }) || {};
    setSuppressionRows(payload.data || []);
    setSuppressionCount(Number(payload.count || 0));
    setSelectedSuppressionIds([]);
  }, [tenantId, suppressionSearch, suppressionReasonFilter, suppressionPage]);

  const loadCampaignList = useCallback(async () => {
    if (!tenantId) return;

    const { data, error } = await supabase.rpc(
      "admin_list_tenant_campaigns" as never,
      {
        p_tenant_id: tenantId,
        p_search: campaignSearch.trim() || null,
        p_status_filter: campaignStatusFilter,
        p_page: campaignPage,
        p_page_size: CAMPAIGN_PAGE_SIZE,
      } as never,
    );

    if (error) {
      toast.error(error.message || "Failed to load tenant campaigns");
      return;
    }

    const payload =
      (data as { data?: TenantCampaignInterventionRow[]; count?: number }) ||
      {};
    const rows = payload.data || [];
    setCampaignRows(rows);
    setCampaignCount(Number(payload.count || 0));
    setCampaignOverrideModeById((prev) => {
      const next: Record<string, "final_override" | "automation_allowed"> = {
        ...prev,
      };
      for (const row of rows) {
        next[row.id] =
          row.autopause_override_precedence === "final_override"
            ? "final_override"
            : "automation_allowed";
      }
      return next;
    });
  }, [tenantId, campaignSearch, campaignStatusFilter, campaignPage]);

  useEffect(() => {
    if (isLoading || !isSuperAdmin) return;
    void loadPanel();
  }, [loadPanel, isLoading, isSuperAdmin]);

  useEffect(() => {
    if (isLoading || !isSuperAdmin) return;
    void loadDomains();
  }, [loadDomains, isLoading, isSuperAdmin]);

  useEffect(() => {
    if (isLoading || !isSuperAdmin) return;
    void loadSuppressionList();
  }, [loadSuppressionList, isLoading, isSuperAdmin]);

  useEffect(() => {
    if (isLoading || !isSuperAdmin) return;
    void loadCampaignList();
  }, [loadCampaignList, isLoading, isSuperAdmin]);

  const handleUnpauseDomain = async (domainId: string) => {
    if (!tenantId) return;

    const actionKey = `domain:unpause:${domainId}`;
    setBusyAction(actionKey);

    const { error } = await supabase.rpc(
      "admin_unpause_tenant_email_domain" as never,
      {
        p_tenant_id: tenantId,
        p_domain_id: domainId,
        p_reason: "unpaused_from_tenant_email_management",
      } as never,
    );

    setBusyAction(null);

    if (error) {
      toast.error(error.message || "Failed to unpause domain");
      return;
    }

    toast.success("Domain unpaused");
    await loadDomains();
    await loadPanel();
  };

  const runAction = useCallback(
    async (
      actionKey: string,
      rpcName: string,
      args: Record<string, unknown>,
    ) => {
      setBusyAction(actionKey);
      const { error } = await supabase.rpc(rpcName as never, args as never);
      setBusyAction(null);

      if (error) {
        toast.error(error.message || "Action failed");
        return;
      }

      toast.success("Action completed");
      await loadPanel();
    },
    [loadPanel],
  );

  const thresholdsOverridePayload = useMemo(() => {
    const hardStop: Record<string, number> = {};
    const reputationTiers: Record<string, number> = {};
    const batch: Record<string, number> = {};

    if (overrideHardBounce.trim() !== "")
      hardStop.hard_bounce_rate = Number(overrideHardBounce);
    if (overrideComplaint.trim() !== "")
      hardStop.complaint_rate = Number(overrideComplaint);
    if (overrideSpam.trim() !== "") hardStop.spam_rate = Number(overrideSpam);

    if (overrideHealthyMin.trim() !== "")
      reputationTiers.healthy_min = Number(overrideHealthyMin);
    if (overrideWarningMin.trim() !== "")
      reputationTiers.warning_min = Number(overrideWarningMin);
    if (overrideRiskMin.trim() !== "")
      reputationTiers.risk_min = Number(overrideRiskMin);

    if (overrideBatchSize.trim() !== "")
      batch.max_batch_size = Number(overrideBatchSize);

    const payload: Record<string, unknown> = {};
    if (Object.keys(hardStop).length > 0)
      payload.hard_stop_thresholds = hardStop;
    if (Object.keys(reputationTiers).length > 0)
      payload.reputation_tiers = reputationTiers;
    if (Object.keys(batch).length > 0) payload.batch = batch;

    return payload;
  }, [
    overrideHardBounce,
    overrideComplaint,
    overrideSpam,
    overrideHealthyMin,
    overrideWarningMin,
    overrideRiskMin,
    overrideBatchSize,
  ]);

  const suppressionTotalPages = Math.max(
    1,
    Math.ceil(suppressionCount / SUPPRESSION_PAGE_SIZE),
  );
  const campaignTotalPages = Math.max(
    1,
    Math.ceil(campaignCount / CAMPAIGN_PAGE_SIZE),
  );

  const toggleSuppressionSelection = (id: string, checked: boolean) => {
    setSelectedSuppressionIds((prev) => {
      if (checked) {
        return prev.includes(id) ? prev : [...prev, id];
      }
      return prev.filter((entry) => entry !== id);
    });
  };

  const allVisibleSelected =
    suppressionRows.length > 0 &&
    suppressionRows.every((row) => selectedSuppressionIds.includes(row.id));

  const toggleSelectAllVisible = (checked: boolean) => {
    if (!checked) {
      setSelectedSuppressionIds([]);
      return;
    }
    setSelectedSuppressionIds(suppressionRows.map((row) => row.id));
  };

  const runSuppressionAction = async (
    actionKey: string,
    rpcName: string,
    args: Record<string, unknown>,
    successMessage = "Action completed",
  ) => {
    setBusyAction(actionKey);
    const { error } = await supabase.rpc(rpcName as never, args as never);
    setBusyAction(null);

    if (error) {
      toast.error(error.message || "Action failed");
      return;
    }

    toast.success(successMessage);
    await loadPanel();
    await loadSuppressionList();
  };

  const manualSuppressionHasValues =
    manualSuppressionEmail.trim() !== "" ||
    manualSuppressionReason.trim() !== "" ||
    manualSuppressionExpiresAt.trim() !== "" ||
    manualSuppressionType !== "bounced";

  const runCampaignAction = async (
    actionKey: string,
    rpcName: string,
    args: Record<string, unknown>,
    successMessage = "Action completed",
  ) => {
    setBusyAction(actionKey);
    const { error } = await supabase.rpc(rpcName as never, args as never);
    setBusyAction(null);

    if (error) {
      toast.error(error.message || "Action failed");
      return;
    }

    toast.success(successMessage);
    await loadPanel();
    await loadCampaignList();
  };

  if (isLoading) {
    return (
      <PageContainer
        sx={{
          maxWidth: "72rem",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Stack spacing={1.5} alignItems="center">
          <CircularProgress size="lg" />
          <Typography level="body-sm" color="neutral">
            Loading tenant email access...
          </Typography>
        </Stack>
      </PageContainer>
    );
  }

  if (!isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (!tenantId) {
    return <Navigate to="/admin/tenants" replace />;
  }

  if (loading || !panel) {
    return (
      <PageContainer sx={{ maxWidth: "72rem" }}>
        <JoyCard>
          <JoyCardContent sx={{ pt: 3 }}>
            <Typography level="body-md" color="neutral">
              Loading tenant email management...
            </Typography>
          </JoyCardContent>
        </JoyCard>
      </PageContainer>
    );
  }

  const frozen = panel.reputation_state?.is_reputation_frozen ?? false;
  const overrideActive =
    panel.reputation_state?.reputation_override_active ?? false;
  const penaltiesDisabledActive =
    panel.reputation_state?.penalties_disabled_active ?? false;
  const temporaryOverrideMode = overrideMode === "temporary";
  const sendingLimitState = panel.sending_limit_state;
  const emergencyRestrictionActive =
    sendingLimitState?.emergency_restriction_active ?? false;
  const boostActive = sendingLimitState?.boost_active ?? false;

  return (
    <PageContainer sx={{ maxWidth: "72rem" }}>
      <Stack spacing={3}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          alignItems={{ xs: "flex-start", md: "center" }}
          justifyContent="space-between"
          spacing={2}
        >
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Mail className="h-7 w-7 text-primary" />
            <Stack spacing={0.5}>
              <Typography level="h1">Tenant Email Management</Typography>
              <Typography level="body-md" color="neutral">
                {panel.company_name || "Tenant"} ({panel.tenant_id})
              </Typography>
            </Stack>
          </Stack>
          <JoyButton
            bloomVariant="outline"
            onClick={() => navigate("/admin/tenants")}
            startDecorator={<ArrowLeft className="h-4 w-4" />}
          >
            Back to Tenants
          </JoyButton>
        </Stack>

        <JoyCard>
          <JoyCardHeader
            title={`Domains (${domainCount})`}
            description="View the tenant's sending domains and clear a paused state."
          />
          <JoyCardContent>
            {domainLoading ? (
              <Sheet
                variant="outlined"
                sx={{ borderRadius: "var(--joy-radius-md)" }}
              >
                <JoyTable containerSx={{ minWidth: 720 }}>
                  <JoyTableHead>
                    <JoyTableRow>
                      <JoyTableHeaderCell>Domain</JoyTableHeaderCell>
                      <JoyTableHeaderCell>Status</JoyTableHeaderCell>
                      <JoyTableHeaderCell align="right">
                        Bounce (30d)
                      </JoyTableHeaderCell>
                      <JoyTableHeaderCell align="right">
                        Complaints (30d)
                      </JoyTableHeaderCell>
                      <JoyTableHeaderCell align="right">
                        Actions
                      </JoyTableHeaderCell>
                    </JoyTableRow>
                  </JoyTableHead>
                  <JoyTableBody>
                    {Array.from({ length: 5 }).map((_, index) => (
                      <JoyTableRow key={index}>
                        {Array.from({ length: 5 }).map((__, cellIndex) => (
                          <JoyTableCell key={cellIndex}>
                            <Skeleton sx={{ height: 20, width: "100%" }} />
                          </JoyTableCell>
                        ))}
                      </JoyTableRow>
                    ))}
                  </JoyTableBody>
                </JoyTable>
              </Sheet>
            ) : domainRows.length === 0 ? (
              <Stack spacing={0.75} alignItems="center" sx={{ py: 5 }}>
                <Mail
                  className="h-5 w-5"
                  style={{ color: "var(--joy-palette-neutral-400)" }}
                />
                <Typography level="title-sm">No domains found</Typography>
                <Typography level="body-sm" color="neutral" textAlign="center">
                  Add or verify a sending domain before managing tenant email
                  reputation.
                </Typography>
              </Stack>
            ) : (
              <Sheet
                variant="outlined"
                sx={{ borderRadius: "var(--joy-radius-md)" }}
              >
                <JoyTable containerSx={{ minWidth: 720 }}>
                  <JoyTableHead>
                    <JoyTableRow>
                      <JoyTableHeaderCell>Domain</JoyTableHeaderCell>
                      <JoyTableHeaderCell>Status</JoyTableHeaderCell>
                      <JoyTableHeaderCell align="right">
                        Bounce (30d)
                      </JoyTableHeaderCell>
                      <JoyTableHeaderCell align="right">
                        Complaints (30d)
                      </JoyTableHeaderCell>
                      <JoyTableHeaderCell align="right">
                        Actions
                      </JoyTableHeaderCell>
                    </JoyTableRow>
                  </JoyTableHead>
                  <JoyTableBody>
                    {domainRows.map((row) => {
                      const config = getDomainStatusConfig(row.status as never);
                      const bounce =
                        row.bounce_rate_30d === null ||
                        !Number.isFinite(Number(row.bounce_rate_30d))
                          ? "—"
                          : formatReputationRate(Number(row.bounce_rate_30d));
                      const complaint =
                        row.complaint_rate_30d === null ||
                        !Number.isFinite(Number(row.complaint_rate_30d))
                          ? "—"
                          : formatReputationRate(
                              Number(row.complaint_rate_30d),
                            );

                      return (
                        <JoyTableRow key={row.id}>
                          <JoyTableCell
                            sx={{ fontWeight: "var(--joy-fontWeight-md)" }}
                          >
                            {row.domain}
                          </JoyTableCell>
                          <JoyTableCell>
                            <Chip
                              color={getDomainStatusChipColor(row.status)}
                              size="sm"
                              variant="soft"
                            >
                              {config.label}
                            </Chip>
                          </JoyTableCell>
                          <JoyTableCell
                            sx={{
                              textAlign: "right",
                              color: getRateTone(row.bounce_rate_30d, 2, 5),
                              fontWeight: "var(--joy-fontWeight-medium)",
                            }}
                          >
                            {bounce}
                          </JoyTableCell>
                          <JoyTableCell
                            sx={{
                              textAlign: "right",
                              color: getRateTone(
                                row.complaint_rate_30d,
                                0.1,
                                0.2,
                              ),
                              fontWeight: "var(--joy-fontWeight-medium)",
                            }}
                          >
                            {complaint}
                          </JoyTableCell>
                          <JoyTableCell sx={{ textAlign: "right" }}>
                            {row.status === "paused" ? (
                              <JoyButton
                                bloomVariant="outline"
                                size="sm"
                                onClick={() => void handleUnpauseDomain(row.id)}
                                disabled={busyAction !== null}
                                startDecorator={
                                  <PlayCircle className="h-4 w-4" />
                                }
                              >
                                Unpause
                              </JoyButton>
                            ) : (
                              <Typography level="body-sm" color="neutral">
                                —
                              </Typography>
                            )}
                          </JoyTableCell>
                        </JoyTableRow>
                      );
                    })}
                  </JoyTableBody>
                </JoyTable>
              </Sheet>
            )}
          </JoyCardContent>
        </JoyCard>

        <JoyCard>
          <JoyCardHeader
            title="Suppression Management"
            description="Manage tenant-level suppressions, manual corrections, and temporary bypass."
          />
          <JoyCardContent>
            <Stack spacing={2}>
              <Grid container spacing={2}>
                <Grid xs={12} lg={8}>
                  <Stack spacing={1}>
                    <Stack direction="row" spacing={1} alignItems="flex-end">
                      <JoySearchInput
                        label="Search Email"
                        value={suppressionSearch}
                        onChange={(event) => {
                          setSuppressionSearch(event.target.value);
                          setSuppressionPage(0);
                        }}
                        placeholder="Search suppressed email"
                      />
                      <JoyButton
                        aria-label="Search suppression list"
                        bloomVariant="outline"
                        onClick={() => void loadSuppressionList()}
                        disabled={busyAction !== null}
                        size="icon"
                      >
                        <Search className="h-4 w-4" />
                      </JoyButton>
                    </Stack>
                  </Stack>
                </Grid>
                <Grid xs={12} lg={4}>
                  <JoySelect
                    label="Reason Filter"
                    value={suppressionReasonFilter}
                    onValueChange={(value) => {
                      setSuppressionReasonFilter(
                        value as "all" | "bounce" | "complaint" | "unsubscribe",
                      );
                      setSuppressionPage(0);
                    }}
                    options={[
                      { value: "all", label: "All" },
                      { value: "bounce", label: "Bounce" },
                      { value: "complaint", label: "Complaint" },
                      { value: "unsubscribe", label: "Unsubscribe" },
                    ]}
                  />
                </Grid>
              </Grid>

              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                <JoyButton
                  bloomVariant="outline"
                  onClick={() =>
                    void runSuppressionAction(
                      "bulk-lift-suppression",
                      "admin_bulk_lift_tenant_suppressions",
                      {
                        p_tenant_id: tenantId,
                        p_suppression_ids: selectedSuppressionIds,
                        p_reason:
                          "tenant_email_management_bulk_lift_suppression",
                      },
                      "Selected suppression entries removed",
                    )
                  }
                  disabled={
                    busyAction !== null || selectedSuppressionIds.length === 0
                  }
                >
                  Remove Selected ({selectedSuppressionIds.length})
                </JoyButton>
                <JoyButton
                  bloomVariant="outline"
                  onClick={() =>
                    void runSuppressionAction(
                      "clear-suppression-history",
                      "admin_clear_tenant_suppression_history",
                      {
                        p_tenant_id: tenantId,
                        p_reason:
                          "tenant_email_management_clear_suppression_history",
                      },
                      "Tenant suppression history cleared",
                    )
                  }
                  disabled={busyAction !== null}
                  startDecorator={<Trash2 className="h-4 w-4" />}
                >
                  Clear Suppression History
                </JoyButton>
              </Stack>

              <Sheet
                variant="outlined"
                sx={{ borderRadius: "var(--joy-radius-md)" }}
              >
                <JoyTable containerSx={{ minWidth: 820 }}>
                  <JoyTableHead>
                    <JoyTableRow>
                      <JoyTableHeaderCell sx={{ width: 48 }}>
                        <Checkbox
                          size="sm"
                          checked={allVisibleSelected}
                          indeterminate={
                            selectedSuppressionIds.length > 0 &&
                            !allVisibleSelected
                          }
                          slotProps={{
                            input: {
                              "aria-label": "Select all suppression rows",
                            },
                          }}
                          onChange={(event) =>
                            toggleSelectAllVisible(event.target.checked)
                          }
                          sx={{ m: 0 }}
                        />
                      </JoyTableHeaderCell>
                      <JoyTableHeaderCell>Email</JoyTableHeaderCell>
                      <JoyTableHeaderCell>Reason</JoyTableHeaderCell>
                      <JoyTableHeaderCell>Suppressed At</JoyTableHeaderCell>
                      <JoyTableHeaderCell>Expires</JoyTableHeaderCell>
                      <JoyTableHeaderCell sx={{ width: 120 }}>
                        Action
                      </JoyTableHeaderCell>
                    </JoyTableRow>
                  </JoyTableHead>
                  <JoyTableBody>
                    {suppressionRows.length === 0 ? (
                      <JoyTableRow>
                        <JoyTableCell
                          colSpan={6}
                          sx={{
                            color: "neutral.500",
                            py: 5,
                            textAlign: "center",
                          }}
                        >
                          No suppression entries found.
                        </JoyTableCell>
                      </JoyTableRow>
                    ) : (
                      suppressionRows.map((row) => (
                        <JoyTableRow key={row.id}>
                          <JoyTableCell>
                            <Checkbox
                              size="sm"
                              checked={selectedSuppressionIds.includes(row.id)}
                              slotProps={{
                                input: {
                                  "aria-label": `Select ${row.email}`,
                                },
                              }}
                              onChange={(event) =>
                                toggleSuppressionSelection(
                                  row.id,
                                  event.target.checked,
                                )
                              }
                              sx={{ m: 0 }}
                            />
                          </JoyTableCell>
                          <JoyTableCell
                            sx={{ fontWeight: "var(--joy-fontWeight-md)" }}
                          >
                            {row.email}
                          </JoyTableCell>
                          <JoyTableCell>{row.suppression_type}</JoyTableCell>
                          <JoyTableCell>{row.suppressed_at}</JoyTableCell>
                          <JoyTableCell>{row.expires_at || "-"}</JoyTableCell>
                          <JoyTableCell>
                            <JoyButton
                              bloomVariant="ghost"
                              size="sm"
                              onClick={() =>
                                void runSuppressionAction(
                                  `lift-suppression-${row.id}`,
                                  "admin_lift_tenant_suppression",
                                  {
                                    p_tenant_id: tenantId,
                                    p_suppression_id: row.id,
                                    p_reason:
                                      "tenant_email_management_single_lift_suppression",
                                  },
                                  "Suppression entry removed",
                                )
                              }
                              disabled={busyAction !== null}
                            >
                              Remove
                            </JoyButton>
                          </JoyTableCell>
                        </JoyTableRow>
                      ))
                    )}
                  </JoyTableBody>
                </JoyTable>
              </Sheet>

              <JoyTablePagination
                page={suppressionPage}
                pageIndexBase={0}
                pageSize={SUPPRESSION_PAGE_SIZE}
                totalCount={suppressionCount}
                disabled={busyAction !== null}
                showPageSizeSelector={false}
                onPageChange={setSuppressionPage}
              />

              <JoyFormSection
                title="Add Manual Suppression"
                description="Insert a tenant-specific suppression entry with an optional expiry."
                headerActions={
                  <JoyButton
                    type="button"
                    bloomVariant="ghost"
                    size="sm"
                    onClick={() => {
                      setManualSuppressionEmail("");
                      setManualSuppressionType("bounced");
                      setManualSuppressionReason("");
                      setManualSuppressionExpiresAt("");
                    }}
                    disabled={
                      busyAction !== null || !manualSuppressionHasValues
                    }
                    startDecorator={<X className="h-4 w-4" />}
                    sx={{ minHeight: 32, px: 1 }}
                  >
                    Clear
                  </JoyButton>
                }
                actions={
                  <JoyButton
                    onClick={() =>
                      void runSuppressionAction(
                        "add-manual-suppression",
                        "admin_add_tenant_suppression",
                        {
                          p_tenant_id: tenantId,
                          p_email: manualSuppressionEmail,
                          p_suppression_type: manualSuppressionType,
                          p_reason:
                            manualSuppressionReason.trim() ||
                            "tenant_email_management_manual_suppression",
                          p_expires_at: toIsoOrNull(manualSuppressionExpiresAt),
                        },
                        "Manual suppression added",
                      )
                    }
                    disabled={
                      busyAction !== null ||
                      manualSuppressionEmail.trim() === ""
                    }
                    startDecorator={<Plus className="h-4 w-4" />}
                  >
                    Add Manual Suppression
                  </JoyButton>
                }
                sx={embeddedFormSectionSx}
              >
                <Grid container spacing={2}>
                  <Grid xs={12} md={6}>
                    <LabeledInput
                      label="Email"
                      value={manualSuppressionEmail}
                      onChange={setManualSuppressionEmail}
                    />
                  </Grid>
                  <Grid xs={12} md={6}>
                    <JoySelect
                      label="Suppression Type"
                      value={manualSuppressionType}
                      onValueChange={(value) =>
                        setManualSuppressionType(
                          value as "bounced" | "complaint" | "unsubscribed",
                        )
                      }
                      options={[
                        { value: "bounced", label: "Bounce" },
                        { value: "complaint", label: "Complaint" },
                        { value: "unsubscribed", label: "Unsubscribe" },
                      ]}
                    />
                  </Grid>
                  <Grid xs={12} md={6}>
                    <LabeledInput
                      label="Reason"
                      value={manualSuppressionReason}
                      onChange={setManualSuppressionReason}
                    />
                  </Grid>
                  <Grid xs={12} md={6}>
                    <LabeledInput
                      label="Expires At (optional)"
                      type="datetime-local"
                      value={manualSuppressionExpiresAt}
                      onChange={setManualSuppressionExpiresAt}
                    />
                  </Grid>
                </Grid>
              </JoyFormSection>

              <JoyFormSection
                title="Temporary Suppression Bypass"
                description="Bypass applies to bounce and complaint suppressions only. Unsubscribe and global blocks remain enforced."
                headerActions={
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography level="body-xs" color="neutral">
                      {suppressionBypassEnabled ? "Enabled" : "Disabled"}
                    </Typography>
                    <JoySwitch
                      checked={suppressionBypassEnabled}
                      onCheckedChange={setSuppressionBypassEnabled}
                      disabled={busyAction !== null}
                    />
                  </Stack>
                }
                actions={
                  <JoyButton
                    bloomVariant="outline"
                    onClick={() =>
                      void runSuppressionAction(
                        "set-suppression-bypass",
                        "admin_set_tenant_suppression_bypass",
                        {
                          p_tenant_id: tenantId,
                          p_enabled: suppressionBypassEnabled,
                          p_until: suppressionBypassEnabled
                            ? toIsoOrNull(suppressionBypassUntil)
                            : null,
                          p_reason:
                            suppressionBypassReason.trim() ||
                            "tenant_email_management_set_suppression_bypass",
                          p_automation_mode: suppressionAutomationMode,
                        },
                        "Suppression bypass settings saved",
                      )
                    }
                    disabled={busyAction !== null}
                  >
                    Save Suppression Bypass
                  </JoyButton>
                }
                sx={embeddedFormSectionSx}
              >
                <Grid container spacing={2}>
                  <Grid xs={12} md={4}>
                    <LabeledInput
                      label="Bypass Until (optional)"
                      type="datetime-local"
                      value={suppressionBypassUntil}
                      onChange={setSuppressionBypassUntil}
                      disabled={!suppressionBypassEnabled}
                    />
                  </Grid>
                  <Grid xs={12} md={4}>
                    <JoySelect
                      label="Automation Precedence"
                      value={suppressionAutomationMode}
                      onValueChange={(value) =>
                        setSuppressionAutomationMode(
                          value as "campaign_only" | "campaign_and_automation",
                        )
                      }
                      options={[
                        { value: "campaign_only", label: "Campaigns only" },
                        {
                          value: "campaign_and_automation",
                          label: "Campaigns + automations",
                        },
                      ]}
                    />
                  </Grid>
                  <Grid xs={12} md={4}>
                    <LabeledInput
                      label="Reason"
                      value={suppressionBypassReason}
                      onChange={setSuppressionBypassReason}
                    />
                  </Grid>
                </Grid>
                <Typography level="body-xs" color="neutral">
                  Active:{" "}
                  {suppressionControls?.suppression_bypass_active
                    ? "Yes"
                    : "No"}
                </Typography>
              </JoyFormSection>
            </Stack>
          </JoyCardContent>
        </JoyCard>

        <JoyCard>
          <JoyCardHeader
            title="Campaign Intervention"
            description="Super Admin controls for active campaigns and override precedence."
          />
          <JoyCardContent>
            <Stack spacing={2}>
              <JoyFormSection
                title="Campaign Creation Lock"
                description="Lock or unlock campaign creation for this tenant."
                headerActions={
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography level="body-xs" color="neutral">
                      {campaignCreationLocked ? "Locked" : "Unlocked"}
                    </Typography>
                    <JoySwitch
                      checked={campaignCreationLocked}
                      onCheckedChange={setCampaignCreationLocked}
                      disabled={busyAction !== null}
                    />
                  </Stack>
                }
                actions={
                  <JoyButton
                    bloomVariant="outline"
                    onClick={() =>
                      void runCampaignAction(
                        "save-campaign-creation-lock",
                        "admin_set_tenant_campaign_creation_lock",
                        {
                          p_tenant_id: tenantId,
                          p_locked: campaignCreationLocked,
                          p_reason:
                            campaignCreationLockReason.trim() ||
                            "tenant_email_management_campaign_creation_lock",
                        },
                        campaignCreationLocked
                          ? "Campaign creation locked"
                          : "Campaign creation unlocked",
                      )
                    }
                    disabled={busyAction !== null}
                  >
                    Save Creation Lock
                  </JoyButton>
                }
                sx={embeddedFormSectionSx}
              >
                <LabeledInput
                  label="Reason"
                  value={campaignCreationLockReason}
                  onChange={setCampaignCreationLockReason}
                  placeholder="Explain why campaign creation is being locked or unlocked"
                />
              </JoyFormSection>

              <JoyFormSection
                title="Campaign Override Context"
                description="Shared reason and expiration used when pausing, resuming, force-stopping, or overriding campaign automation."
                sx={embeddedFormSectionSx}
              >
                <Grid container spacing={2}>
                  <Grid xs={12} md={6}>
                    <LabeledInput
                      label="Intervention Reason"
                      value={campaignOverrideReason}
                      onChange={setCampaignOverrideReason}
                      placeholder="Reason to log for campaign intervention actions"
                    />
                  </Grid>
                  <Grid xs={12} md={6}>
                    <LabeledInput
                      label="Override Expiration (optional)"
                      type="datetime-local"
                      value={campaignOverrideUntil}
                      onChange={setCampaignOverrideUntil}
                    />
                  </Grid>
                </Grid>
              </JoyFormSection>

              <Grid container spacing={2}>
                <Grid xs={12} lg={8}>
                  <Stack spacing={1}>
                    <Stack direction="row" spacing={1} alignItems="flex-end">
                      <JoySearchInput
                        label="Search Campaign"
                        value={campaignSearch}
                        onChange={(event) => {
                          setCampaignSearch(event.target.value);
                          setCampaignPage(0);
                        }}
                        placeholder="Search campaign name or subject"
                      />
                      <JoyButton
                        aria-label="Search campaigns"
                        bloomVariant="outline"
                        onClick={() => void loadCampaignList()}
                        disabled={busyAction !== null}
                        size="icon"
                      >
                        <Search className="h-4 w-4" />
                      </JoyButton>
                    </Stack>
                  </Stack>
                </Grid>
                <Grid xs={12} lg={4}>
                  <JoySelect
                    label="Status Filter"
                    value={campaignStatusFilter}
                    onValueChange={(value) => {
                      setCampaignStatusFilter(value);
                      setCampaignPage(0);
                    }}
                    options={[
                      { value: "all", label: "All" },
                      { value: "draft", label: "Draft" },
                      { value: "scheduled", label: "Scheduled" },
                      { value: "sending", label: "Sending" },
                      { value: "paused", label: "Paused" },
                      { value: "sent", label: "Sent" },
                      { value: "failed", label: "Failed" },
                    ]}
                  />
                </Grid>
              </Grid>

              <Sheet
                variant="outlined"
                sx={{ borderRadius: "var(--joy-radius-md)" }}
              >
                <JoyTable containerSx={{ minWidth: 980 }}>
                  <JoyTableHead>
                    <JoyTableRow>
                      <JoyTableHeaderCell>Campaign</JoyTableHeaderCell>
                      <JoyTableHeaderCell>Status</JoyTableHeaderCell>
                      <JoyTableHeaderCell>Override</JoyTableHeaderCell>
                      <JoyTableHeaderCell sx={{ width: 360 }}>
                        Actions
                      </JoyTableHeaderCell>
                    </JoyTableRow>
                  </JoyTableHead>
                  <JoyTableBody>
                    {campaignRows.length === 0 ? (
                      <JoyTableRow>
                        <JoyTableCell
                          colSpan={4}
                          sx={{
                            color: "neutral.500",
                            py: 5,
                            textAlign: "center",
                          }}
                        >
                          No campaigns found.
                        </JoyTableCell>
                      </JoyTableRow>
                    ) : (
                      campaignRows.map((row) => (
                        <JoyTableRow key={row.id}>
                          <JoyTableCell>
                            <Typography
                              sx={{ fontWeight: "var(--joy-fontWeight-md)" }}
                            >
                              {row.name}
                            </Typography>
                            <Typography level="body-xs" color="neutral">
                              {row.subject_line || "No subject"}
                            </Typography>
                          </JoyTableCell>
                          <JoyTableCell>
                            <Chip
                              color={getCampaignStatusChip(row.status).color}
                              size="sm"
                              variant="soft"
                            >
                              {getCampaignStatusChip(row.status).label}
                            </Chip>
                            <Typography
                              level="body-xs"
                              color="neutral"
                              sx={{ mt: 0.5 }}
                            >
                              {row.updated_at}
                            </Typography>
                          </JoyTableCell>
                          <JoyTableCell>
                            <Stack spacing={0.5}>
                              <Typography level="body-xs" color="neutral">
                                {row.autopause_override_enabled
                                  ? row.autopause_override_precedence
                                  : "disabled"}
                              </Typography>
                              <JoySelect
                                value={
                                  campaignOverrideModeById[row.id] ||
                                  "automation_allowed"
                                }
                                onValueChange={(value) =>
                                  setCampaignOverrideModeById((prev) => ({
                                    ...prev,
                                    [row.id]: value as
                                      | "final_override"
                                      | "automation_allowed",
                                  }))
                                }
                                options={[
                                  {
                                    value: "final_override",
                                    label: "Final Override",
                                  },
                                  {
                                    value: "automation_allowed",
                                    label: "Automation Allowed",
                                  },
                                ]}
                                slotProps={{
                                  button: {
                                    sx: { fontSize: "var(--joy-fontSize-xs)" },
                                  },
                                  listbox: {
                                    sx: {
                                      '& [role="option"]': {
                                        fontSize: "var(--joy-fontSize-xs)",
                                      },
                                    },
                                  },
                                }}
                              />
                            </Stack>
                          </JoyTableCell>
                          <JoyTableCell>
                            <Stack
                              direction="row"
                              spacing={0.5}
                              useFlexGap
                              flexWrap="wrap"
                            >
                              <JoyButton
                                size="sm"
                                bloomVariant="destructive"
                                onClick={() =>
                                  void runCampaignAction(
                                    `force-stop-campaign-${row.id}`,
                                    "admin_force_stop_campaign",
                                    {
                                      p_campaign_id: row.id,
                                      p_reason:
                                        campaignOverrideReason.trim() ||
                                        "tenant_email_management_force_stop_campaign",
                                    },
                                    "Campaign force-stopped",
                                  )
                                }
                                disabled={busyAction !== null}
                              >
                                Force Stop
                              </JoyButton>
                              <JoyButton
                                size="sm"
                                bloomVariant="outline"
                                onClick={() =>
                                  void runCampaignAction(
                                    `pause-campaign-${row.id}`,
                                    "admin_pause_campaign",
                                    {
                                      p_campaign_id: row.id,
                                      p_reason:
                                        campaignOverrideReason.trim() ||
                                        "tenant_email_management_pause_campaign",
                                    },
                                    "Campaign paused",
                                  )
                                }
                                disabled={busyAction !== null}
                              >
                                Pause
                              </JoyButton>
                              <JoyButton
                                size="sm"
                                bloomVariant="outline"
                                onClick={() =>
                                  void runCampaignAction(
                                    `resume-campaign-${row.id}`,
                                    "admin_resume_campaign",
                                    {
                                      p_campaign_id: row.id,
                                      p_reason:
                                        campaignOverrideReason.trim() ||
                                        "tenant_email_management_resume_campaign",
                                    },
                                    "Campaign resumed",
                                  )
                                }
                                disabled={busyAction !== null}
                              >
                                Resume
                              </JoyButton>
                              <JoyButton
                                size="sm"
                                bloomVariant="outline"
                                onClick={() =>
                                  void runCampaignAction(
                                    `save-override-${row.id}`,
                                    "admin_set_campaign_autopause_override",
                                    {
                                      p_campaign_id: row.id,
                                      p_enabled: true,
                                      p_precedence:
                                        campaignOverrideModeById[row.id] ||
                                        "automation_allowed",
                                      p_until: toIsoOrNull(
                                        campaignOverrideUntil,
                                      ),
                                      p_reason:
                                        campaignOverrideReason.trim() ||
                                        "tenant_email_management_set_campaign_override",
                                    },
                                    "Campaign override saved",
                                  )
                                }
                                disabled={busyAction !== null}
                              >
                                Save Override
                              </JoyButton>
                              <JoyButton
                                size="sm"
                                bloomVariant="ghost"
                                onClick={() =>
                                  void runCampaignAction(
                                    `clear-override-${row.id}`,
                                    "admin_set_campaign_autopause_override",
                                    {
                                      p_campaign_id: row.id,
                                      p_enabled: false,
                                      p_precedence: "automation_allowed",
                                      p_until: null,
                                      p_reason:
                                        campaignOverrideReason.trim() ||
                                        "tenant_email_management_clear_campaign_override",
                                    },
                                    "Campaign override cleared",
                                  )
                                }
                                disabled={busyAction !== null}
                              >
                                Clear Override
                              </JoyButton>
                              <JoyButton
                                size="sm"
                                bloomVariant="outline"
                                onClick={() =>
                                  void runCampaignAction(
                                    `reset-restrictions-${row.id}`,
                                    "admin_reset_campaign_restrictions",
                                    {
                                      p_campaign_id: row.id,
                                      p_reason:
                                        campaignOverrideReason.trim() ||
                                        "tenant_email_management_reset_campaign_restrictions",
                                    },
                                    "Campaign restrictions reset",
                                  )
                                }
                                disabled={busyAction !== null}
                              >
                                Reset Restrictions
                              </JoyButton>
                            </Stack>
                          </JoyTableCell>
                        </JoyTableRow>
                      ))
                    )}
                  </JoyTableBody>
                </JoyTable>
              </Sheet>

              <JoyTablePagination
                page={campaignPage}
                pageIndexBase={0}
                pageSize={CAMPAIGN_PAGE_SIZE}
                totalCount={campaignCount}
                disabled={busyAction !== null}
                showPageSizeSelector={false}
                onPageChange={setCampaignPage}
              />
            </Stack>
          </JoyCardContent>
        </JoyCard>

        <JoyCard>
          <JoyCardHeader
            title="Current Reputation"
            description="Live tenant reputation and policy state."
          />
          <JoyCardContent>
            <Grid container spacing={2}>
              <Grid xs={12} md={3}>
                <Stat
                  label="Reputation Score"
                  value={String(panel.reputation_score)}
                />
              </Grid>
              <Grid xs={12} md={3}>
                <Stat
                  label="Current Reputation Tier"
                  value={panel.current_reputation_tier}
                />
              </Grid>
              <Grid xs={12} md={3}>
                <Stat label="Current Action" value={panel.reputation_action} />
              </Grid>
              <Grid xs={12} md={3}>
                <Stat label="Frozen" value={frozen ? "Yes" : "No"} />
              </Grid>
            </Grid>
          </JoyCardContent>
        </JoyCard>

        <Grid container spacing={3}>
          <Grid xs={12} lg={6}>
            <JoyCard>
              <JoyCardHeader title="24h Metrics" />
              <JoyCardContent>
                <Grid container spacing={1.5}>
                  <Grid xs={6}>
                    <Stat
                      label="Hard Bounce %"
                      value={toPercent(panel.metrics_24h.hard_bounce_rate)}
                    />
                  </Grid>
                  <Grid xs={6}>
                    <Stat
                      label="Soft Bounce %"
                      value={toPercent(panel.metrics_24h.soft_bounce_rate)}
                    />
                  </Grid>
                  <Grid xs={6}>
                    <Stat
                      label="Complaint %"
                      value={toPercent(panel.metrics_24h.complaint_rate)}
                    />
                  </Grid>
                  <Grid xs={6}>
                    <Stat
                      label="Unsubscribe %"
                      value={toPercent(panel.metrics_24h.unsubscribe_rate)}
                    />
                  </Grid>
                  <Grid xs={6}>
                    <Stat
                      label="Delivery Failure %"
                      value={toPercent(panel.metrics_24h.delivery_failure_rate)}
                    />
                  </Grid>
                  <Grid xs={6}>
                    <Stat label="Sent" value={String(panel.metrics_24h.sent)} />
                  </Grid>
                </Grid>
              </JoyCardContent>
            </JoyCard>
          </Grid>

          <Grid xs={12} lg={6}>
            <JoyCard>
              <JoyCardHeader title="30d Metrics" />
              <JoyCardContent>
                <Grid container spacing={1.5}>
                  <Grid xs={6}>
                    <Stat
                      label="Hard Bounce %"
                      value={toPercent(panel.metrics_30d.hard_bounce_rate)}
                    />
                  </Grid>
                  <Grid xs={6}>
                    <Stat
                      label="Soft Bounce %"
                      value={toPercent(panel.metrics_30d.soft_bounce_rate)}
                    />
                  </Grid>
                  <Grid xs={6}>
                    <Stat
                      label="Complaint %"
                      value={toPercent(panel.metrics_30d.complaint_rate)}
                    />
                  </Grid>
                  <Grid xs={6}>
                    <Stat
                      label="Unsubscribe %"
                      value={toPercent(panel.metrics_30d.unsubscribe_rate)}
                    />
                  </Grid>
                  <Grid xs={6}>
                    <Stat
                      label="Delivery Failure %"
                      value={toPercent(panel.metrics_30d.delivery_failure_rate)}
                    />
                  </Grid>
                  <Grid xs={6}>
                    <Stat label="Sent" value={String(panel.metrics_30d.sent)} />
                  </Grid>
                </Grid>
              </JoyCardContent>
            </JoyCard>
          </Grid>
        </Grid>

        <JoyCard>
          <JoyCardHeader
            title="Current Thresholds (Effective)"
            description="Shows active threshold values and source."
          />
          <JoyCardContent>
            <Grid container spacing={1.5}>
              <Grid xs={12} md={6} lg={4}>
                <Stat
                  label="Hard Bounce %"
                  value={`${toPercent(panel.current_thresholds_effective.hard_bounce_rate.value)} (${panel.current_thresholds_effective.hard_bounce_rate.source})`}
                />
              </Grid>
              <Grid xs={12} md={6} lg={4}>
                <Stat
                  label="Soft Bounce %"
                  value={`${toPercent(panel.current_thresholds_effective.soft_bounce_rate.value)} (${panel.current_thresholds_effective.soft_bounce_rate.source})`}
                />
              </Grid>
              <Grid xs={12} md={6} lg={4}>
                <Stat
                  label="Complaint %"
                  value={`${toPercent(panel.current_thresholds_effective.complaint_rate.value)} (${panel.current_thresholds_effective.complaint_rate.source})`}
                />
              </Grid>
              <Grid xs={12} md={6} lg={4}>
                <Stat
                  label="Spam %"
                  value={`${toPercent(panel.current_thresholds_effective.spam_rate.value)} (${panel.current_thresholds_effective.spam_rate.source})`}
                />
              </Grid>
              <Grid xs={12} md={6} lg={4}>
                <Stat
                  label="Delivery Failure %"
                  value={`${toPercent(panel.current_thresholds_effective.delivery_failure_rate.value)} (${panel.current_thresholds_effective.delivery_failure_rate.source})`}
                />
              </Grid>
            </Grid>
          </JoyCardContent>
        </JoyCard>

        <JoyCard>
          <JoyCardHeader
            title="Current Send Limits"
            description="Effective volume limits and pacing policy."
          />
          <JoyCardContent>
            <Grid container spacing={2}>
              <Grid xs={12} md={3}>
                <Stat
                  label="Recipient Cap"
                  value={
                    panel.current_send_limits.recipient_cap === null
                      ? "Unlimited"
                      : String(panel.current_send_limits.recipient_cap)
                  }
                />
              </Grid>
              <Grid xs={12} md={3}>
                <Stat
                  label="Monthly Limit"
                  value={
                    panel.current_send_limits.monthly_limit === null
                      ? "Unlimited"
                      : String(panel.current_send_limits.monthly_limit)
                  }
                />
              </Grid>
              <Grid xs={12} md={3}>
                <Stat
                  label="Daily Limit"
                  value={
                    panel.current_send_limits.daily_limit === null
                      ? "Unlimited"
                      : String(panel.current_send_limits.daily_limit)
                  }
                />
              </Grid>
              <Grid xs={12} md={3}>
                <Stat
                  label="Hourly Limit"
                  value={
                    panel.current_send_limits.hourly_limit === null
                      ? "Unlimited"
                      : String(panel.current_send_limits.hourly_limit)
                  }
                />
              </Grid>
              <Grid xs={12} md={3}>
                <Stat
                  label="Job Batch Size"
                  value={String(panel.current_send_limits.job_batch_size)}
                />
              </Grid>
              <Grid xs={12} md={3}>
                <Stat
                  label="Pacing Multiplier"
                  value={String(
                    panel.current_send_limits.send_pacing_multiplier,
                  )}
                />
              </Grid>
              <Grid xs={12} md={3}>
                <Stat
                  label="Unlimited Mode"
                  value={
                    panel.current_send_limits.is_unlimited
                      ? "Enabled"
                      : "Disabled"
                  }
                />
              </Grid>
              <Grid xs={12} md={3}>
                <Stat
                  label="Emergency Restriction"
                  value={emergencyRestrictionActive ? "Active" : "Inactive"}
                />
              </Grid>
              <Grid xs={12} md={3}>
                <Stat
                  label="Temporary Boost"
                  value={boostActive ? "Active" : "Inactive"}
                />
              </Grid>
            </Grid>
          </JoyCardContent>
        </JoyCard>

        <Grid container spacing={3}>
          <Grid xs={12} lg={6}>
            <JoyCard>
              <JoyCardHeader
                title="Reputation Controls"
                description="Reset to 100, set a custom score, and control automation penalties."
              />
              <JoyCardContent>
                <Stack spacing={2}>
                  <JoyFormSection
                    title="Manual Reputation Override"
                    description="Reset to 100, set a custom score, and control override expiration."
                    actions={
                      <>
                        <JoyButton
                          onClick={() =>
                            void runAction(
                              "set-score",
                              "admin_set_tenant_reputation_override",
                              {
                                p_tenant_id: tenantId,
                                p_score: Number(manualScore || "0"),
                                p_mode: overrideMode,
                                p_expires_at: temporaryOverrideMode
                                  ? toIsoOrNull(overrideExpiresAt)
                                  : null,
                                p_reason:
                                  overrideReason.trim() ||
                                  "tenant_email_management_manual_score",
                              },
                            )
                          }
                          disabled={
                            busyAction !== null ||
                            manualScore.trim() === "" ||
                            (temporaryOverrideMode &&
                              !toIsoOrNull(overrideExpiresAt))
                          }
                        >
                          Set Score
                        </JoyButton>
                        <JoyButton
                          bloomVariant="outline"
                          onClick={() =>
                            void runAction(
                              "reset-score",
                              "admin_set_tenant_reputation_override",
                              {
                                p_tenant_id: tenantId,
                                p_score: 100,
                                p_mode: "final",
                                p_expires_at: null,
                                p_reason:
                                  overrideReason.trim() ||
                                  "tenant_email_management_reset_to_100",
                              },
                            )
                          }
                          disabled={busyAction !== null}
                        >
                          Reset Reputation to 100
                        </JoyButton>
                        <JoyButton
                          bloomVariant="ghost"
                          onClick={() =>
                            void runAction(
                              "clear-score-override",
                              "admin_clear_tenant_reputation_override",
                              {
                                p_tenant_id: tenantId,
                                p_reason:
                                  overrideReason.trim() ||
                                  "tenant_email_management_clear_score_override",
                              },
                            )
                          }
                          disabled={busyAction !== null}
                        >
                          Clear Manual Override
                        </JoyButton>
                      </>
                    }
                    sx={embeddedFormSectionSx}
                  >
                    <Grid container spacing={2}>
                      <Grid xs={12} md={6}>
                        <JoySelect
                          label="Override Mode"
                          value={overrideMode}
                          onValueChange={(value) => {
                            const nextMode =
                              value === "temporary" ? "temporary" : "final";
                            setOverrideMode(nextMode);
                            if (nextMode === "final") {
                              setOverrideExpiresAt("");
                            }
                          }}
                          options={[
                            { value: "final", label: "Final Override" },
                            {
                              value: "temporary",
                              label: "Temporary Override",
                            },
                          ]}
                        />
                      </Grid>
                      <Grid xs={12} md={6}>
                        <LabeledInput
                          label="Override Expiration (optional)"
                          type="datetime-local"
                          value={overrideExpiresAt}
                          onChange={setOverrideExpiresAt}
                          disabled={!temporaryOverrideMode}
                        />
                      </Grid>
                    </Grid>

                    <LabeledInput
                      label="Reason"
                      value={overrideReason}
                      onChange={setOverrideReason}
                      placeholder="Explain why this override is being applied"
                    />

                    <LabeledInput
                      label="Set Reputation Score (0-100)"
                      value={manualScore}
                      onChange={setManualScore}
                    />

                    <Sheet
                      variant="outlined"
                      sx={{ p: 2, borderRadius: "var(--joy-radius-lg)" }}
                    >
                      <Stack spacing={0.5}>
                        <Typography level="body-sm">
                          <strong>Override Active:</strong>{" "}
                          {overrideActive ? "Yes" : "No"}
                        </Typography>
                        <Typography level="body-sm">
                          <strong>Current Mode:</strong>{" "}
                          {panel.reputation_state?.reputation_override_mode ||
                            "none"}
                        </Typography>
                        <Typography level="body-sm">
                          <strong>Expires:</strong>{" "}
                          {panel.reputation_state
                            ?.reputation_override_expires_at || "not set"}
                        </Typography>
                      </Stack>
                    </Sheet>
                  </JoyFormSection>

                  <JoyFormSection
                    title="Under Review Override"
                    description="Control whether automation can set tenant under-review state."
                    headerActions={
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Typography level="body-xs" color="neutral">
                          {underReviewOverrideEnabled ? "Enabled" : "Disabled"}
                        </Typography>
                        <JoySwitch
                          checked={underReviewOverrideEnabled}
                          onCheckedChange={setUnderReviewOverrideEnabled}
                          disabled={busyAction !== null}
                        />
                      </Stack>
                    }
                    actions={
                      <JoyButton
                        bloomVariant="outline"
                        onClick={() =>
                          void runAction(
                            "set-under-review-override",
                            "admin_set_tenant_under_review_override",
                            {
                              p_tenant_id: tenantId,
                              p_enabled: underReviewOverrideEnabled,
                              p_precedence: underReviewOverridePrecedence,
                              p_until: underReviewOverrideEnabled
                                ? toIsoOrNull(underReviewOverrideUntil)
                                : null,
                              p_reason:
                                underReviewOverrideReason.trim() ||
                                "tenant_email_management_under_review_override",
                            },
                          )
                        }
                        disabled={busyAction !== null}
                      >
                        Save Under Review Override
                      </JoyButton>
                    }
                    sx={embeddedFormSectionSx}
                  >
                    <Grid container spacing={2}>
                      <Grid xs={12} md={6}>
                        <JoySelect
                          label="Precedence"
                          value={underReviewOverridePrecedence}
                          onValueChange={(value) =>
                            setUnderReviewOverridePrecedence(
                              value === "final_override"
                                ? "final_override"
                                : "automation_allowed",
                            )
                          }
                          options={[
                            {
                              value: "final_override",
                              label: "Final Override",
                            },
                            {
                              value: "automation_allowed",
                              label: "Automation Allowed",
                            },
                          ]}
                        />
                      </Grid>
                      <Grid xs={12} md={6}>
                        <LabeledInput
                          label="Override Until (optional)"
                          type="datetime-local"
                          value={underReviewOverrideUntil}
                          onChange={setUnderReviewOverrideUntil}
                          disabled={!underReviewOverrideEnabled}
                        />
                      </Grid>
                    </Grid>

                    <LabeledInput
                      label="Reason"
                      value={underReviewOverrideReason}
                      onChange={setUnderReviewOverrideReason}
                      placeholder="Explain why this under-review override is applied"
                    />

                    <Typography level="body-xs" color="neutral">
                      Override active:{" "}
                      {underReviewOverrideActive ? "Yes" : "No"}
                    </Typography>
                  </JoyFormSection>

                  <JoyFormSection
                    title="Freeze Reputation Score"
                    description="Prevent automatic score updates while frozen. Changes save immediately when the toggle changes."
                    headerActions={
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Typography level="body-xs" color="neutral">
                          {frozen ? "Frozen" : "Live"}
                        </Typography>
                        <JoySwitch
                          checked={frozen}
                          onCheckedChange={(checked) => {
                            void runAction(
                              "freeze-score",
                              "admin_freeze_tenant_reputation_score",
                              {
                                p_tenant_id: tenantId,
                                p_is_frozen: checked,
                                p_reason:
                                  overrideReason.trim() ||
                                  "tenant_email_management_toggle_freeze",
                              },
                            );
                          }}
                          disabled={busyAction !== null}
                        />
                      </Stack>
                    }
                    sx={embeddedFormSectionSx}
                  >
                    <Typography level="body-xs" color="neutral">
                      Automatic reputation recalculations are paused until this
                      switch is turned off.
                    </Typography>
                  </JoyFormSection>

                  <JoyFormSection
                    title="Automation Penalties"
                    description="Disable penalties temporarily or re-enable them."
                    actions={
                      <>
                        <JoyButton
                          bloomVariant="outline"
                          onClick={() =>
                            void runAction(
                              "disable-penalties",
                              "admin_disable_tenant_reputation_penalties",
                              {
                                p_tenant_id: tenantId,
                                p_until: toIsoOrNull(penaltiesDisableUntil),
                                p_reason:
                                  penaltiesReason.trim() ||
                                  "tenant_email_management_disable_penalties",
                              },
                            )
                          }
                          disabled={busyAction !== null}
                        >
                          Disable Penalties
                        </JoyButton>
                        <JoyButton
                          bloomVariant="outline"
                          onClick={() =>
                            void runAction(
                              "enable-penalties",
                              "admin_enable_tenant_reputation_penalties",
                              {
                                p_tenant_id: tenantId,
                                p_reason:
                                  penaltiesReason.trim() ||
                                  "tenant_email_management_enable_penalties",
                              },
                            )
                          }
                          disabled={busyAction !== null}
                        >
                          Re-enable Penalties
                        </JoyButton>
                      </>
                    }
                    sx={embeddedFormSectionSx}
                  >
                    <LabeledInput
                      label="Disable Until (optional)"
                      type="datetime-local"
                      value={penaltiesDisableUntil}
                      onChange={setPenaltiesDisableUntil}
                    />

                    <LabeledInput
                      label="Reason"
                      value={penaltiesReason}
                      onChange={setPenaltiesReason}
                      placeholder="Explain why penalties are disabled or re-enabled"
                    />

                    <Typography level="body-xs" color="neutral">
                      Penalties Disabled:{" "}
                      {penaltiesDisabledActive ? "Yes" : "No"}
                      {panel.reputation_state?.penalties_disabled_until
                        ? ` (until ${panel.reputation_state.penalties_disabled_until})`
                        : ""}
                    </Typography>
                  </JoyFormSection>
                </Stack>
              </JoyCardContent>
            </JoyCard>
          </Grid>

          <Grid xs={12} lg={6}>
            <JoyCard>
              <JoyCardHeader
                title="Send Limit Controls"
                description="Configure monthly, daily, hourly limits, and mode overrides."
                actions={
                  <JoyButton
                    type="button"
                    bloomVariant="ghost"
                    size="sm"
                    onClick={resetSendLimitControls}
                    disabled={busyAction !== null || !sendLimitIsDirty}
                    startDecorator={<X className="h-4 w-4" />}
                    sx={{ minHeight: 32, px: 1 }}
                  >
                    Clear
                  </JoyButton>
                }
              />
              <JoyCardContent>
                <Stack spacing={2}>
                  <JoyFormSection
                    title="Custom Sending Limits"
                    description="Configure monthly, daily, and hourly caps for this tenant."
                    actions={
                      <JoyButton
                        onClick={() =>
                          void runAction(
                            "set-limits",
                            "admin_set_tenant_sending_limits",
                            {
                              p_tenant_id: tenantId,
                              p_monthly: toIntOrNull(monthlyLimitInput),
                              p_daily: toIntOrNull(dailyLimitInput),
                              p_hourly: toIntOrNull(hourlyLimitInput),
                              p_reason:
                                sendingLimitReason.trim() ||
                                "tenant_email_management_set_sending_limits",
                            },
                          )
                        }
                        disabled={busyAction !== null}
                      >
                        Apply Custom Limits
                      </JoyButton>
                    }
                    sx={embeddedFormSectionSx}
                  >
                    <Grid container spacing={2}>
                      <Grid xs={12} md={4}>
                        <LabeledInput
                          label="Monthly"
                          value={monthlyLimitInput}
                          onChange={setMonthlyLimitInput}
                        />
                      </Grid>
                      <Grid xs={12} md={4}>
                        <LabeledInput
                          label="Daily"
                          value={dailyLimitInput}
                          onChange={setDailyLimitInput}
                        />
                      </Grid>
                      <Grid xs={12} md={4}>
                        <LabeledInput
                          label="Hourly"
                          value={hourlyLimitInput}
                          onChange={setHourlyLimitInput}
                        />
                      </Grid>
                    </Grid>

                    <LabeledInput
                      label="Reason"
                      value={sendingLimitReason}
                      onChange={setSendingLimitReason}
                      placeholder="Explain why custom limits are being changed"
                    />
                  </JoyFormSection>

                  <JoyFormSection
                    title="Unlimited Mode"
                    description="Disables quota enforcement and auto throttle."
                    headerActions={
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Typography level="body-xs" color="neutral">
                          {unlimitedMode ? "Enabled" : "Disabled"}
                        </Typography>
                        <JoySwitch
                          checked={unlimitedMode}
                          onCheckedChange={setUnlimitedMode}
                          disabled={busyAction !== null}
                        />
                      </Stack>
                    }
                    actions={
                      <JoyButton
                        bloomVariant="outline"
                        onClick={() =>
                          void runAction(
                            "set-unlimited-mode",
                            "admin_set_tenant_unlimited_sending",
                            {
                              p_tenant_id: tenantId,
                              p_enabled: unlimitedMode,
                              p_reason:
                                sendingLimitReason.trim() ||
                                "tenant_email_management_toggle_unlimited_mode",
                            },
                          )
                        }
                        disabled={busyAction !== null}
                      >
                        Save Unlimited Mode
                      </JoyButton>
                    }
                    sx={embeddedFormSectionSx}
                  >
                    <Typography level="body-xs" color="neutral">
                      Current effective mode:{" "}
                      {panel.current_send_limits.is_unlimited
                        ? "Unlimited"
                        : "Quota enforced"}
                    </Typography>
                  </JoyFormSection>

                  <JoyFormSection
                    title="Emergency Restriction Mode"
                    description="Block all sends for this tenant until cleared."
                    headerActions={
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Typography level="body-xs" color="neutral">
                          {emergencyRestrictionEnabled ? "Enabled" : "Disabled"}
                        </Typography>
                        <JoySwitch
                          checked={emergencyRestrictionEnabled}
                          onCheckedChange={setEmergencyRestrictionEnabled}
                          disabled={busyAction !== null}
                        />
                      </Stack>
                    }
                    actions={
                      <JoyButton
                        bloomVariant="outline"
                        onClick={() =>
                          void runAction(
                            "set-emergency-restriction",
                            "admin_set_tenant_emergency_restriction",
                            {
                              p_tenant_id: tenantId,
                              p_enabled: emergencyRestrictionEnabled,
                              p_until: emergencyRestrictionEnabled
                                ? toIsoOrNull(emergencyRestrictionUntil)
                                : null,
                              p_reason:
                                emergencyRestrictionReason.trim() ||
                                "tenant_email_management_set_emergency_restriction",
                            },
                          )
                        }
                        disabled={busyAction !== null}
                      >
                        Save Emergency Restriction
                      </JoyButton>
                    }
                    sx={embeddedFormSectionSx}
                  >
                    <LabeledInput
                      label="Until (optional)"
                      type="datetime-local"
                      value={emergencyRestrictionUntil}
                      onChange={setEmergencyRestrictionUntil}
                      disabled={!emergencyRestrictionEnabled}
                    />

                    <LabeledInput
                      label="Reason"
                      value={emergencyRestrictionReason}
                      onChange={setEmergencyRestrictionReason}
                      placeholder="Explain why emergency restriction is being changed"
                    />
                  </JoyFormSection>

                  <JoyFormSection
                    title="Temporary Boost Mode"
                    description="Temporarily raise monthly, daily, and hourly caps with an expiry."
                    actions={
                      <>
                        <JoyButton
                          onClick={() =>
                            void runAction(
                              "set-boost",
                              "admin_set_tenant_temporary_boost",
                              {
                                p_tenant_id: tenantId,
                                p_monthly: toIntOrNull(boostMonthlyInput),
                                p_daily: toIntOrNull(boostDailyInput),
                                p_hourly: toIntOrNull(boostHourlyInput),
                                p_until: toIsoOrNull(boostUntilInput),
                                p_reason:
                                  boostReason.trim() ||
                                  "tenant_email_management_set_temporary_boost",
                              },
                            )
                          }
                          disabled={
                            busyAction !== null || !toIsoOrNull(boostUntilInput)
                          }
                        >
                          Apply Temporary Boost
                        </JoyButton>
                        <JoyButton
                          bloomVariant="outline"
                          onClick={() =>
                            void runAction(
                              "clear-boost",
                              "admin_clear_tenant_temporary_boost",
                              {
                                p_tenant_id: tenantId,
                                p_reason:
                                  boostReason.trim() ||
                                  "tenant_email_management_clear_temporary_boost",
                              },
                            )
                          }
                          disabled={busyAction !== null}
                        >
                          Clear Temporary Boost
                        </JoyButton>
                      </>
                    }
                    sx={embeddedFormSectionSx}
                  >
                    <Grid container spacing={2}>
                      <Grid xs={12} md={4}>
                        <LabeledInput
                          label="Boost Monthly"
                          value={boostMonthlyInput}
                          onChange={setBoostMonthlyInput}
                        />
                      </Grid>
                      <Grid xs={12} md={4}>
                        <LabeledInput
                          label="Boost Daily"
                          value={boostDailyInput}
                          onChange={setBoostDailyInput}
                        />
                      </Grid>
                      <Grid xs={12} md={4}>
                        <LabeledInput
                          label="Boost Hourly"
                          value={boostHourlyInput}
                          onChange={setBoostHourlyInput}
                        />
                      </Grid>
                    </Grid>

                    <LabeledInput
                      label="Expires At"
                      type="datetime-local"
                      value={boostUntilInput}
                      onChange={setBoostUntilInput}
                    />

                    <LabeledInput
                      label="Reason"
                      value={boostReason}
                      onChange={setBoostReason}
                      placeholder="Explain why temporary boost is required"
                    />
                  </JoyFormSection>
                </Stack>
              </JoyCardContent>
            </JoyCard>
          </Grid>
        </Grid>

        <JoyFormSection
          title="Override Thresholds"
          description="Apply tenant-specific threshold overrides."
          actions={
            <>
              <JoyButton
                onClick={() =>
                  void runAction(
                    "override-thresholds",
                    "admin_set_tenant_email_governance_overrides",
                    {
                      p_tenant_id: tenantId,
                      p_overrides: thresholdsOverridePayload,
                      p_reason: "tenant_email_management_override_thresholds",
                    },
                  )
                }
                disabled={busyAction !== null}
              >
                Override Thresholds
              </JoyButton>
              <JoyButton
                bloomVariant="outline"
                onClick={() =>
                  void runAction(
                    "clear-overrides",
                    "admin_set_tenant_email_governance_overrides",
                    {
                      p_tenant_id: tenantId,
                      p_overrides: {},
                      p_reason: "tenant_email_management_clear_overrides",
                    },
                  )
                }
                disabled={busyAction !== null}
              >
                Clear Threshold Overrides
              </JoyButton>
            </>
          }
        >
          <Grid container spacing={2}>
            <Grid xs={12} md={6} lg={3}>
              <LabeledInput
                label="Hard Bounce Rate (fraction)"
                value={overrideHardBounce}
                onChange={setOverrideHardBounce}
              />
            </Grid>
            <Grid xs={12} md={6} lg={3}>
              <LabeledInput
                label="Complaint Rate (fraction)"
                value={overrideComplaint}
                onChange={setOverrideComplaint}
              />
            </Grid>
            <Grid xs={12} md={6} lg={3}>
              <LabeledInput
                label="Spam Rate (fraction)"
                value={overrideSpam}
                onChange={setOverrideSpam}
              />
            </Grid>
            <Grid xs={12} md={6} lg={3}>
              <LabeledInput
                label="Batch Max Size"
                value={overrideBatchSize}
                onChange={setOverrideBatchSize}
              />
            </Grid>
            <Grid xs={12} md={6} lg={3}>
              <LabeledInput
                label="Healthy Min"
                value={overrideHealthyMin}
                onChange={setOverrideHealthyMin}
              />
            </Grid>
            <Grid xs={12} md={6} lg={3}>
              <LabeledInput
                label="Warning Min"
                value={overrideWarningMin}
                onChange={setOverrideWarningMin}
              />
            </Grid>
            <Grid xs={12} md={6} lg={3}>
              <LabeledInput
                label="Risk Min"
                value={overrideRiskMin}
                onChange={setOverrideRiskMin}
              />
            </Grid>
          </Grid>
        </JoyFormSection>

        <Grid container spacing={3}>
          <Grid xs={12} lg={6}>
            <JoyCard>
              <JoyCardHeader
                title="Campaign Controls"
                description="Pause or resume all campaigns for this tenant."
              />
              <JoyCardContent>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  <JoyButton
                    bloomVariant="destructive"
                    onClick={() =>
                      void runAction(
                        "pause-campaigns",
                        "admin_pause_tenant_email_campaigns",
                        {
                          p_tenant_id: tenantId,
                          p_reason:
                            "tenant_email_management_pause_all_campaigns",
                        },
                      )
                    }
                    disabled={busyAction !== null}
                    startDecorator={<PauseCircle className="h-4 w-4" />}
                  >
                    Pause All Campaigns
                  </JoyButton>
                  <JoyButton
                    bloomVariant="outline"
                    onClick={() =>
                      void runAction(
                        "resume-campaigns",
                        "admin_resume_tenant_email_campaigns",
                        {
                          p_tenant_id: tenantId,
                          p_reason:
                            "tenant_email_management_resume_all_campaigns",
                        },
                      )
                    }
                    disabled={busyAction !== null}
                    startDecorator={<PlayCircle className="h-4 w-4" />}
                  >
                    Resume All Campaigns
                  </JoyButton>
                </Stack>
              </JoyCardContent>
            </JoyCard>
          </Grid>

          <Grid xs={12} lg={6}>
            <JoyCard>
              <JoyCardHeader
                title="Data Cleanup Controls"
                description="Suppression and reputation history controls."
              />
              <JoyCardContent>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  <JoyButton
                    bloomVariant="outline"
                    onClick={() =>
                      void runAction(
                        "clear-suppression",
                        "admin_clear_tenant_suppression_list",
                        {
                          p_tenant_id: tenantId,
                          p_reason:
                            "tenant_email_management_clear_suppression_list",
                        },
                      )
                    }
                    disabled={busyAction !== null}
                    startDecorator={<Trash2 className="h-4 w-4" />}
                  >
                    Clear Suppression List
                  </JoyButton>
                  <JoyButton
                    bloomVariant="outline"
                    onClick={() =>
                      void runAction(
                        "forgive-bounce",
                        "admin_forgive_tenant_bounce_history",
                        {
                          p_tenant_id: tenantId,
                          p_reason:
                            "tenant_email_management_clear_bounce_history",
                        },
                      )
                    }
                    disabled={busyAction !== null}
                  >
                    Clear Bounce History
                  </JoyButton>
                  <JoyButton
                    bloomVariant="outline"
                    onClick={() =>
                      void runAction(
                        "forgive-complaint",
                        "admin_forgive_tenant_complaint_history",
                        {
                          p_tenant_id: tenantId,
                          p_reason:
                            "tenant_email_management_clear_complaint_history",
                        },
                      )
                    }
                    disabled={busyAction !== null}
                  >
                    Clear Complaint History
                  </JoyButton>
                </Stack>
              </JoyCardContent>
            </JoyCard>
          </Grid>
        </Grid>

        <Stack direction="row" spacing={1} alignItems="center">
          <Shield className="h-4 w-4" />
          <Typography level="body-xs" color="neutral">
            Actions and changes are logged internally in admin audit logs.
          </Typography>
        </Stack>
      </Stack>
    </PageContainer>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Sheet
      variant="outlined"
      sx={{ p: 1.5, borderRadius: "var(--joy-radius-md)" }}
    >
      <Typography level="body-xs" color="neutral">
        {label}
      </Typography>
      <Typography
        level="body-sm"
        fontWeight="lg"
        sx={{ wordBreak: "break-all" }}
      >
        {value}
      </Typography>
    </Sheet>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  type,
  placeholder,
  helperText,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: React.ComponentProps<typeof Input>["type"];
  placeholder?: string;
  helperText?: React.ComponentProps<typeof Input>["helperText"];
  disabled?: boolean;
}) {
  return (
    <Input
      label={label}
      type={type}
      value={value}
      onValueChange={onChange}
      placeholder={placeholder}
      helperText={helperText}
      disabled={disabled}
    />
  );
}
