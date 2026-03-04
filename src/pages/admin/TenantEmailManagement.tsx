import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
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
      <div className="container max-w-6xl mx-auto p-6">
        <Card>
          <CardContent className="py-8 text-muted-foreground">
            Loading tenant email management...
          </CardContent>
        </Card>
      </div>
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
    <div className="container max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Mail className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Tenant Email Management</h1>
            <p className="text-muted-foreground">
              {panel.company_name || "Tenant"} ({panel.tenant_id})
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => navigate("/admin/tenants")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Tenants
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Domains ({domainCount})</CardTitle>
          <CardDescription>
            View the tenant's sending domains and clear a paused state.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {domainLoading ? (
            <div className="text-sm text-muted-foreground">
              Loading domains...
            </div>
          ) : domainRows.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No domains found for this tenant.
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Domain</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Bounce (30d)</TableHead>
                    <TableHead className="text-right">
                      Complaints (30d)
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
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
                        : formatReputationRate(Number(row.complaint_rate_30d));

                    return (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">
                          {row.domain}
                        </TableCell>
                        <TableCell>
                          <Badge variant={config.variant}>{config.label}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{bounce}</TableCell>
                        <TableCell className="text-right">
                          {complaint}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.status === "paused" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => void handleUnpauseDomain(row.id)}
                              disabled={busyAction !== null}
                            >
                              <PlayCircle className="h-4 w-4 mr-1" />
                              Unpause
                            </Button>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              —
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Suppression Management</CardTitle>
          <CardDescription>
            Manage tenant-level suppressions, manual corrections, and temporary
            bypass.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="space-y-1 lg:col-span-2">
              <Label>Search Email</Label>
              <div className="flex gap-2">
                <Input
                  value={suppressionSearch}
                  onChange={(event) => {
                    setSuppressionSearch(event.target.value);
                    setSuppressionPage(0);
                  }}
                  placeholder="Search suppressed email"
                />
                <Button
                  variant="outline"
                  onClick={() => void loadSuppressionList()}
                  disabled={busyAction !== null}
                >
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Reason Filter</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={suppressionReasonFilter}
                onChange={(event) => {
                  const value = event.target.value as
                    | "all"
                    | "bounce"
                    | "complaint"
                    | "unsubscribe";
                  setSuppressionReasonFilter(value);
                  setSuppressionPage(0);
                }}
              >
                <option value="all">All</option>
                <option value="bounce">Bounce</option>
                <option value="complaint">Complaint</option>
                <option value="unsubscribe">Unsubscribe</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() =>
                void runSuppressionAction(
                  "bulk-lift-suppression",
                  "admin_bulk_lift_tenant_suppressions",
                  {
                    p_tenant_id: tenantId,
                    p_suppression_ids: selectedSuppressionIds,
                    p_reason: "tenant_email_management_bulk_lift_suppression",
                  },
                  "Selected suppression entries removed",
                )
              }
              disabled={
                busyAction !== null || selectedSuppressionIds.length === 0
              }
            >
              Remove Selected ({selectedSuppressionIds.length})
            </Button>
            <Button
              variant="outline"
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
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear Suppression History
            </Button>
          </div>

          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[48px]">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={(event) =>
                        toggleSelectAllVisible(event.target.checked)
                      }
                    />
                  </TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Suppressed At</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="w-[120px]">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppressionRows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-muted-foreground"
                    >
                      No suppression entries found.
                    </TableCell>
                  </TableRow>
                ) : (
                  suppressionRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedSuppressionIds.includes(row.id)}
                          onChange={(event) =>
                            toggleSuppressionSelection(
                              row.id,
                              event.target.checked,
                            )
                          }
                        />
                      </TableCell>
                      <TableCell className="font-medium">{row.email}</TableCell>
                      <TableCell>{row.suppression_type}</TableCell>
                      <TableCell>{row.suppressed_at}</TableCell>
                      <TableCell>{row.expires_at || "-"}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
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
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <p>
              Showing {suppressionRows.length} of {suppressionCount} suppressed
              emails
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setSuppressionPage((page) => Math.max(0, page - 1))
                }
                disabled={suppressionPage === 0 || busyAction !== null}
              >
                Prev
              </Button>
              <span>
                Page {suppressionPage + 1} / {suppressionTotalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setSuppressionPage((page) =>
                    Math.min(suppressionTotalPages - 1, page + 1),
                  )
                }
                disabled={
                  suppressionPage >= suppressionTotalPages - 1 ||
                  busyAction !== null
                }
              >
                Next
              </Button>
            </div>
          </div>

          <div className="space-y-3 border rounded-md p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium">Add Manual Suppression</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={() => {
                  setManualSuppressionEmail("");
                  setManualSuppressionType("bounced");
                  setManualSuppressionReason("");
                  setManualSuppressionExpiresAt("");
                }}
                disabled={busyAction !== null || !manualSuppressionHasValues}
              >
                <X className="h-4 w-4 mr-2" />
                Clear
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <LabeledInput
                label="Email"
                value={manualSuppressionEmail}
                onChange={setManualSuppressionEmail}
              />
              <div className="space-y-1">
                <Label>Suppression Type</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={manualSuppressionType}
                  onChange={(event) =>
                    setManualSuppressionType(
                      event.target.value as
                        | "bounced"
                        | "complaint"
                        | "unsubscribed",
                    )
                  }
                >
                  <option value="bounced">Bounce</option>
                  <option value="complaint">Complaint</option>
                  <option value="unsubscribed">Unsubscribe</option>
                </select>
              </div>
              <LabeledInput
                label="Reason"
                value={manualSuppressionReason}
                onChange={setManualSuppressionReason}
              />
              <div className="space-y-1">
                <Label>Expires At (optional)</Label>
                <Input
                  type="datetime-local"
                  value={manualSuppressionExpiresAt}
                  onChange={(event) =>
                    setManualSuppressionExpiresAt(event.target.value)
                  }
                />
              </div>
            </div>
            <Button
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
                busyAction !== null || manualSuppressionEmail.trim() === ""
              }
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Manual Suppression
            </Button>
          </div>

          <div className="space-y-3 border rounded-md p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Temporary Suppression Bypass</p>
                <p className="text-xs text-muted-foreground">
                  Bypass applies to bounce/complaint only. Unsubscribe and
                  global blocks remain enforced.
                </p>
              </div>
              <Switch
                checked={suppressionBypassEnabled}
                onCheckedChange={setSuppressionBypassEnabled}
                disabled={busyAction !== null}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label>Bypass Until (optional)</Label>
                <Input
                  type="datetime-local"
                  value={suppressionBypassUntil}
                  onChange={(event) =>
                    setSuppressionBypassUntil(event.target.value)
                  }
                  disabled={!suppressionBypassEnabled}
                />
              </div>
              <div className="space-y-1">
                <Label>Automation Precedence</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={suppressionAutomationMode}
                  onChange={(event) =>
                    setSuppressionAutomationMode(
                      event.target.value as
                        | "campaign_only"
                        | "campaign_and_automation",
                    )
                  }
                >
                  <option value="campaign_only">Campaigns only</option>
                  <option value="campaign_and_automation">
                    Campaigns + automations
                  </option>
                </select>
              </div>
              <LabeledInput
                label="Reason"
                value={suppressionBypassReason}
                onChange={setSuppressionBypassReason}
              />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Active:{" "}
                {suppressionControls?.suppression_bypass_active ? "Yes" : "No"}
              </p>
              <Button
                variant="outline"
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
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Campaign Intervention</CardTitle>
          <CardDescription>
            Super Admin controls for active campaigns and override precedence.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3 border rounded-md p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Campaign Creation Lock</p>
                <p className="text-xs text-muted-foreground">
                  Lock or unlock campaign creation for this tenant.
                </p>
              </div>
              <Switch
                checked={campaignCreationLocked}
                onCheckedChange={setCampaignCreationLocked}
                disabled={busyAction !== null}
              />
            </div>
            <LabeledInput
              label="Reason"
              value={campaignCreationLockReason}
              onChange={setCampaignCreationLockReason}
            />
            <div className="flex justify-end">
              <Button
                variant="outline"
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
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="space-y-1 lg:col-span-2">
              <Label>Search Campaign</Label>
              <div className="flex gap-2">
                <Input
                  value={campaignSearch}
                  onChange={(event) => {
                    setCampaignSearch(event.target.value);
                    setCampaignPage(0);
                  }}
                  placeholder="Search campaign name or subject"
                />
                <Button
                  variant="outline"
                  onClick={() => void loadCampaignList()}
                  disabled={busyAction !== null}
                >
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Status Filter</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={campaignStatusFilter}
                onChange={(event) => {
                  setCampaignStatusFilter(event.target.value);
                  setCampaignPage(0);
                }}
              >
                <option value="all">All</option>
                <option value="draft">Draft</option>
                <option value="scheduled">Scheduled</option>
                <option value="sending">Sending</option>
                <option value="paused">Paused</option>
                <option value="sent">Sent</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Intervention Reason</Label>
            <Input
              value={campaignOverrideReason}
              onChange={(event) =>
                setCampaignOverrideReason(event.target.value)
              }
              placeholder="Reason to log for campaign intervention actions"
            />
          </div>

          <div className="space-y-1">
            <Label>Override Expiration (optional)</Label>
            <Input
              type="datetime-local"
              value={campaignOverrideUntil}
              onChange={(event) => setCampaignOverrideUntil(event.target.value)}
              placeholder="When this override should expire"
            />
          </div>

          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Override</TableHead>
                  <TableHead className="w-[360px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaignRows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center text-muted-foreground"
                    >
                      No campaigns found.
                    </TableCell>
                  </TableRow>
                ) : (
                  campaignRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="font-medium">{row.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {row.subject_line || "No subject"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>{row.status}</div>
                        <div className="text-xs text-muted-foreground">
                          {row.updated_at}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground">
                            {row.autopause_override_enabled
                              ? row.autopause_override_precedence
                              : "disabled"}
                          </div>
                          <select
                            className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                            value={
                              campaignOverrideModeById[row.id] ||
                              "automation_allowed"
                            }
                            onChange={(event) =>
                              setCampaignOverrideModeById((prev) => ({
                                ...prev,
                                [row.id]: event.target.value as
                                  | "final_override"
                                  | "automation_allowed",
                              }))
                            }
                          >
                            <option value="final_override">
                              Final Override
                            </option>
                            <option value="automation_allowed">
                              Automation Allowed
                            </option>
                          </select>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Button
                            size="sm"
                            variant="destructive"
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
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
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
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
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
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
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
                                  p_until: toIsoOrNull(campaignOverrideUntil),
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
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
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
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
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
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <p>
              Showing {campaignRows.length} of {campaignCount} campaigns
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCampaignPage((page) => Math.max(0, page - 1))}
                disabled={campaignPage === 0 || busyAction !== null}
              >
                Prev
              </Button>
              <span>
                Page {campaignPage + 1} / {campaignTotalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setCampaignPage((page) =>
                    Math.min(campaignTotalPages - 1, page + 1),
                  )
                }
                disabled={
                  campaignPage >= campaignTotalPages - 1 || busyAction !== null
                }
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current Reputation</CardTitle>
          <CardDescription>
            Live tenant reputation and policy state.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Stat
            label="Reputation Score"
            value={String(panel.reputation_score)}
          />
          <Stat
            label="Current Reputation Tier"
            value={panel.current_reputation_tier}
          />
          <Stat label="Current Action" value={panel.reputation_action} />
          <Stat label="Frozen" value={frozen ? "Yes" : "No"} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>24h Metrics</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Stat
              label="Hard Bounce %"
              value={toPercent(panel.metrics_24h.hard_bounce_rate)}
            />
            <Stat
              label="Soft Bounce %"
              value={toPercent(panel.metrics_24h.soft_bounce_rate)}
            />
            <Stat
              label="Complaint %"
              value={toPercent(panel.metrics_24h.complaint_rate)}
            />
            <Stat
              label="Unsubscribe %"
              value={toPercent(panel.metrics_24h.unsubscribe_rate)}
            />
            <Stat
              label="Delivery Failure %"
              value={toPercent(panel.metrics_24h.delivery_failure_rate)}
            />
            <Stat label="Sent" value={String(panel.metrics_24h.sent)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>30d Metrics</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Stat
              label="Hard Bounce %"
              value={toPercent(panel.metrics_30d.hard_bounce_rate)}
            />
            <Stat
              label="Soft Bounce %"
              value={toPercent(panel.metrics_30d.soft_bounce_rate)}
            />
            <Stat
              label="Complaint %"
              value={toPercent(panel.metrics_30d.complaint_rate)}
            />
            <Stat
              label="Unsubscribe %"
              value={toPercent(panel.metrics_30d.unsubscribe_rate)}
            />
            <Stat
              label="Delivery Failure %"
              value={toPercent(panel.metrics_30d.delivery_failure_rate)}
            />
            <Stat label="Sent" value={String(panel.metrics_30d.sent)} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Current Thresholds (Effective)</CardTitle>
          <CardDescription>
            Shows active threshold values and source.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <Stat
            label="Hard Bounce %"
            value={`${toPercent(panel.current_thresholds_effective.hard_bounce_rate.value)} (${panel.current_thresholds_effective.hard_bounce_rate.source})`}
          />
          <Stat
            label="Soft Bounce %"
            value={`${toPercent(panel.current_thresholds_effective.soft_bounce_rate.value)} (${panel.current_thresholds_effective.soft_bounce_rate.source})`}
          />
          <Stat
            label="Complaint %"
            value={`${toPercent(panel.current_thresholds_effective.complaint_rate.value)} (${panel.current_thresholds_effective.complaint_rate.source})`}
          />
          <Stat
            label="Spam %"
            value={`${toPercent(panel.current_thresholds_effective.spam_rate.value)} (${panel.current_thresholds_effective.spam_rate.source})`}
          />
          <Stat
            label="Delivery Failure %"
            value={`${toPercent(panel.current_thresholds_effective.delivery_failure_rate.value)} (${panel.current_thresholds_effective.delivery_failure_rate.source})`}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current Send Limits</CardTitle>
          <CardDescription>
            Effective volume limits and pacing policy.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Stat
            label="Recipient Cap"
            value={
              panel.current_send_limits.recipient_cap === null
                ? "Unlimited"
                : String(panel.current_send_limits.recipient_cap)
            }
          />
          <Stat
            label="Monthly Limit"
            value={
              panel.current_send_limits.monthly_limit === null
                ? "Unlimited"
                : String(panel.current_send_limits.monthly_limit)
            }
          />
          <Stat
            label="Daily Limit"
            value={
              panel.current_send_limits.daily_limit === null
                ? "Unlimited"
                : String(panel.current_send_limits.daily_limit)
            }
          />
          <Stat
            label="Hourly Limit"
            value={
              panel.current_send_limits.hourly_limit === null
                ? "Unlimited"
                : String(panel.current_send_limits.hourly_limit)
            }
          />
          <Stat
            label="Job Batch Size"
            value={String(panel.current_send_limits.job_batch_size)}
          />
          <Stat
            label="Pacing Multiplier"
            value={String(panel.current_send_limits.send_pacing_multiplier)}
          />
          <Stat
            label="Unlimited Mode"
            value={
              panel.current_send_limits.is_unlimited ? "Enabled" : "Disabled"
            }
          />
          <Stat
            label="Emergency Restriction"
            value={emergencyRestrictionActive ? "Active" : "Inactive"}
          />
          <Stat
            label="Temporary Boost"
            value={boostActive ? "Active" : "Inactive"}
          />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Reputation Controls</CardTitle>
            <CardDescription>
              Reset to 100, set custom score, and control automation penalties.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Set Reputation Score (0-100)</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>Override Mode</Label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={overrideMode}
                    onChange={(event) => {
                      const nextMode =
                        event.target.value === "temporary"
                          ? "temporary"
                          : "final";
                      setOverrideMode(nextMode);
                      if (nextMode === "final") {
                        setOverrideExpiresAt("");
                      }
                    }}
                  >
                    <option value="final">Final Override</option>
                    <option value="temporary">Temporary Override</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Override Expiration (optional)</Label>
                  <Input
                    type="datetime-local"
                    value={overrideExpiresAt}
                    onChange={(event) =>
                      setOverrideExpiresAt(event.target.value)
                    }
                    disabled={!temporaryOverrideMode}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Reason</Label>
                <Input
                  value={overrideReason}
                  onChange={(event) => setOverrideReason(event.target.value)}
                  placeholder="Explain why this override is being applied"
                />
              </div>
              <div className="flex gap-2">
                <Input
                  value={manualScore}
                  onChange={(e) => setManualScore(e.target.value)}
                />
                <Button
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
                    (temporaryOverrideMode && !toIsoOrNull(overrideExpiresAt))
                  }
                >
                  Set Score
                </Button>
              </div>
            </div>

            <Button
              variant="outline"
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
            </Button>

            <Button
              variant="ghost"
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
            </Button>

            <div className="rounded-md border p-3 text-sm space-y-1">
              <p>
                <span className="font-medium">Override Active:</span>{" "}
                {overrideActive ? "Yes" : "No"}
              </p>
              <p>
                <span className="font-medium">Current Mode:</span>{" "}
                {panel.reputation_state?.reputation_override_mode || "none"}
              </p>
              <p>
                <span className="font-medium">Expires:</span>{" "}
                {panel.reputation_state?.reputation_override_expires_at ||
                  "not set"}
              </p>
            </div>

            <div className="space-y-2 border rounded-md p-3">
              <p className="font-medium">Under Review Override</p>
              <p className="text-xs text-muted-foreground">
                Control whether automation can set tenant under-review state.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>Precedence</Label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={underReviewOverridePrecedence}
                    onChange={(event) =>
                      setUnderReviewOverridePrecedence(
                        event.target.value === "final_override"
                          ? "final_override"
                          : "automation_allowed",
                      )
                    }
                  >
                    <option value="final_override">Final Override</option>
                    <option value="automation_allowed">
                      Automation Allowed
                    </option>
                  </select>
                </div>

                <div className="space-y-1">
                  <Label>Override Until (optional)</Label>
                  <Input
                    type="datetime-local"
                    value={underReviewOverrideUntil}
                    onChange={(event) =>
                      setUnderReviewOverrideUntil(event.target.value)
                    }
                    disabled={!underReviewOverrideEnabled}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label>Reason</Label>
                <Input
                  value={underReviewOverrideReason}
                  onChange={(event) =>
                    setUnderReviewOverrideReason(event.target.value)
                  }
                  placeholder="Explain why this under-review override is applied"
                />
              </div>

              <div className="flex items-center justify-between border rounded-md p-3">
                <div>
                  <p className="font-medium">Enable Under Review Override</p>
                  <p className="text-xs text-muted-foreground">
                    When enabled, precedence controls whether automation can set
                    under-review.
                  </p>
                </div>
                <Switch
                  checked={underReviewOverrideEnabled}
                  onCheckedChange={setUnderReviewOverrideEnabled}
                  disabled={busyAction !== null}
                />
              </div>

              <Button
                variant="outline"
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
              </Button>

              <p className="text-xs text-muted-foreground">
                Override active: {underReviewOverrideActive ? "Yes" : "No"}
              </p>
            </div>

            <div className="flex items-center justify-between border rounded-md p-3">
              <div>
                <p className="font-medium">Freeze Reputation Score</p>
                <p className="text-xs text-muted-foreground">
                  Prevent automatic score updates while frozen.
                </p>
              </div>
              <Switch
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
            </div>

            <div className="space-y-2 border rounded-md p-3">
              <p className="font-medium">Automation Penalties</p>
              <p className="text-xs text-muted-foreground">
                Disable penalties temporarily or re-enable them.
              </p>

              <div className="space-y-1">
                <Label>Disable Until (optional)</Label>
                <Input
                  type="datetime-local"
                  value={penaltiesDisableUntil}
                  onChange={(event) =>
                    setPenaltiesDisableUntil(event.target.value)
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Reason</Label>
                <Input
                  value={penaltiesReason}
                  onChange={(event) => setPenaltiesReason(event.target.value)}
                  placeholder="Explain why penalties are disabled/enabled"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
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
                </Button>
                <Button
                  variant="outline"
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
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                Penalties Disabled: {penaltiesDisabledActive ? "Yes" : "No"}
                {panel.reputation_state?.penalties_disabled_until
                  ? ` (until ${panel.reputation_state.penalties_disabled_until})`
                  : ""}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <CardTitle>Send Limit Controls</CardTitle>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={resetSendLimitControls}
                disabled={busyAction !== null || !sendLimitIsDirty}
              >
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            </div>
            <CardDescription>
              Configure monthly, daily, hourly limits and mode overrides.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 border rounded-md p-3">
              <p className="font-medium">Custom Sending Limits</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <LabeledInput
                  label="Monthly"
                  value={monthlyLimitInput}
                  onChange={setMonthlyLimitInput}
                />
                <LabeledInput
                  label="Daily"
                  value={dailyLimitInput}
                  onChange={setDailyLimitInput}
                />
                <LabeledInput
                  label="Hourly"
                  value={hourlyLimitInput}
                  onChange={setHourlyLimitInput}
                />
              </div>
              <div className="space-y-1">
                <Label>Reason</Label>
                <Input
                  value={sendingLimitReason}
                  onChange={(event) =>
                    setSendingLimitReason(event.target.value)
                  }
                  placeholder="Explain why custom limits are being changed"
                />
              </div>
              <Button
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
              </Button>
            </div>

            <div className="space-y-2 border rounded-md p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Unlimited Mode</p>
                  <p className="text-xs text-muted-foreground">
                    Disables quota enforcement and auto throttle.
                  </p>
                </div>
                <Switch
                  checked={unlimitedMode}
                  onCheckedChange={setUnlimitedMode}
                  disabled={busyAction !== null}
                />
              </div>
              <Button
                variant="outline"
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
              </Button>
            </div>

            <div className="space-y-2 border rounded-md p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Emergency Restriction Mode</p>
                  <p className="text-xs text-muted-foreground">
                    Block all sends for this tenant until cleared.
                  </p>
                </div>
                <Switch
                  checked={emergencyRestrictionEnabled}
                  onCheckedChange={setEmergencyRestrictionEnabled}
                  disabled={busyAction !== null}
                />
              </div>
              <div className="space-y-1">
                <Label>Until (optional)</Label>
                <Input
                  type="datetime-local"
                  value={emergencyRestrictionUntil}
                  onChange={(event) =>
                    setEmergencyRestrictionUntil(event.target.value)
                  }
                  disabled={!emergencyRestrictionEnabled}
                />
              </div>
              <div className="space-y-1">
                <Label>Reason</Label>
                <Input
                  value={emergencyRestrictionReason}
                  onChange={(event) =>
                    setEmergencyRestrictionReason(event.target.value)
                  }
                  placeholder="Explain why emergency restriction is being changed"
                />
              </div>
              <Button
                variant="outline"
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
              </Button>
            </div>

            <div className="space-y-2 border rounded-md p-3">
              <p className="font-medium">Temporary Boost Mode</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <LabeledInput
                  label="Boost Monthly"
                  value={boostMonthlyInput}
                  onChange={setBoostMonthlyInput}
                />
                <LabeledInput
                  label="Boost Daily"
                  value={boostDailyInput}
                  onChange={setBoostDailyInput}
                />
                <LabeledInput
                  label="Boost Hourly"
                  value={boostHourlyInput}
                  onChange={setBoostHourlyInput}
                />
              </div>
              <div className="space-y-1">
                <Label>Expires At</Label>
                <Input
                  type="datetime-local"
                  value={boostUntilInput}
                  onChange={(event) => setBoostUntilInput(event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Reason</Label>
                <Input
                  value={boostReason}
                  onChange={(event) => setBoostReason(event.target.value)}
                  placeholder="Explain why temporary boost is required"
                />
              </div>
              <div className="flex gap-2">
                <Button
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
                </Button>
                <Button
                  variant="outline"
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
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Override Thresholds</CardTitle>
          <CardDescription>
            Apply tenant-specific threshold overrides.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <LabeledInput
              label="Hard Bounce Rate (fraction)"
              value={overrideHardBounce}
              onChange={setOverrideHardBounce}
            />
            <LabeledInput
              label="Complaint Rate (fraction)"
              value={overrideComplaint}
              onChange={setOverrideComplaint}
            />
            <LabeledInput
              label="Spam Rate (fraction)"
              value={overrideSpam}
              onChange={setOverrideSpam}
            />
            <LabeledInput
              label="Batch Max Size"
              value={overrideBatchSize}
              onChange={setOverrideBatchSize}
            />
            <LabeledInput
              label="Healthy Min"
              value={overrideHealthyMin}
              onChange={setOverrideHealthyMin}
            />
            <LabeledInput
              label="Warning Min"
              value={overrideWarningMin}
              onChange={setOverrideWarningMin}
            />
            <LabeledInput
              label="Risk Min"
              value={overrideRiskMin}
              onChange={setOverrideRiskMin}
            />
          </div>

          <div className="flex gap-2">
            <Button
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
            </Button>
            <Button
              variant="outline"
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
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Campaign Controls</CardTitle>
            <CardDescription>
              Pause or resume all campaigns for this tenant.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button
              variant="destructive"
              onClick={() =>
                void runAction(
                  "pause-campaigns",
                  "admin_pause_tenant_email_campaigns",
                  {
                    p_tenant_id: tenantId,
                    p_reason: "tenant_email_management_pause_all_campaigns",
                  },
                )
              }
              disabled={busyAction !== null}
            >
              <PauseCircle className="h-4 w-4 mr-2" />
              Pause All Campaigns
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                void runAction(
                  "resume-campaigns",
                  "admin_resume_tenant_email_campaigns",
                  {
                    p_tenant_id: tenantId,
                    p_reason: "tenant_email_management_resume_all_campaigns",
                  },
                )
              }
              disabled={busyAction !== null}
            >
              <PlayCircle className="h-4 w-4 mr-2" />
              Resume All Campaigns
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Data Cleanup Controls</CardTitle>
            <CardDescription>
              Suppression and reputation history controls.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() =>
                void runAction(
                  "clear-suppression",
                  "admin_clear_tenant_suppression_list",
                  {
                    p_tenant_id: tenantId,
                    p_reason: "tenant_email_management_clear_suppression_list",
                  },
                )
              }
              disabled={busyAction !== null}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear Suppression List
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                void runAction(
                  "forgive-bounce",
                  "admin_forgive_tenant_bounce_history",
                  {
                    p_tenant_id: tenantId,
                    p_reason: "tenant_email_management_clear_bounce_history",
                  },
                )
              }
              disabled={busyAction !== null}
            >
              Clear Bounce History
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                void runAction(
                  "forgive-complaint",
                  "admin_forgive_tenant_complaint_history",
                  {
                    p_tenant_id: tenantId,
                    p_reason: "tenant_email_management_clear_complaint_history",
                  },
                )
              }
              disabled={busyAction !== null}
            >
              Clear Complaint History
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="text-xs text-muted-foreground flex items-center gap-2">
        <Shield className="h-4 w-4" />
        Actions and changes are logged internally in admin audit logs.
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium break-all">{value}</p>
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}
