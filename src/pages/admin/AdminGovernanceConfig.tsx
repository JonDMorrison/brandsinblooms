import { useEffect, useMemo, useState } from "react";
import Checkbox from "@mui/joy/Checkbox";
import CircularProgress from "@mui/joy/CircularProgress";
import Grid from "@mui/joy/Grid";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";
import { supabase } from "@/integrations/supabase/client";
import { JoyCard, JoyCardContent } from "@/components/joy/JoyCard";
import { JoyAlertDialog } from "@/components/joy/JoyAlertDialog";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyFormSection } from "@/components/joy/JoyFormSection";
import { JoyInput as Input } from "@/components/joy/JoyInput";
import { JoySearchInput } from "@/components/joy/JoySearchInput";
import { PageContainer } from "@/components/joy/PageContainer";
import { Shield, Save, Search, Plus, Trash2 } from "lucide-react";
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

interface GovernanceConfig {
  version: number;
  windows: {
    hard_stop_window: string;
    warning_window: string;
    tenant_snapshot_24h: string;
    tenant_snapshot_30d: string;
    warning_trend_recent: string;
    warning_trend_prior: string;
  };
  hard_stop_thresholds: {
    hard_bounce_rate: number;
    complaint_rate: number;
    spam_rate: number;
    failed_delivery_rate: number;
    rejected_rate: number;
    reputation_score_cutoff: number;
  };
  warning_thresholds: {
    hard_bounce_rate: number;
    soft_bounce_rate: number;
    complaint_rate: number;
    trend_multiplier: number;
    trend_prior_min_sent: number;
  };
  reputation_tiers: {
    healthy_min: number;
    warning_min: number;
    risk_min: number;
    normal: {
      recipient_cap: number | null;
      job_batch_size: number;
      send_pacing_multiplier: number;
    };
    throttled: {
      recipient_cap: number;
      job_batch_size: number;
      send_pacing_multiplier: number;
    };
    restricted: {
      recipient_cap: number;
      job_batch_size: number;
      send_pacing_multiplier: number;
    };
    critical: {
      recipient_cap: number;
      job_batch_size: number;
      send_pacing_multiplier: number;
    };
  };
  batch: {
    max_batch_size: number;
    delay_min_seconds: number;
    delay_max_seconds: number;
  };
  warmup: {
    base_caps: number[];
    scaling_factor: number;
    max_daily_cap: number;
    min_healthy_cap_floor: number;
  };
  compliance: {
    high_volume_threshold: number;
    spam_score_threshold: number;
  };
  list_hygiene: {
    invalid_block_threshold_pct: number;
    inactive_warning_threshold_pct: number;
    bounce_warning_threshold_pct: number;
    inactive_days: number;
  };
}

interface GlobalSuppressionRow {
  id: string;
  email: string;
  reason: string | null;
  suppressed_at: string;
  expires_at: string | null;
}

const toPercent = (fraction: number) => (fraction * 100).toFixed(3);
const fromPercent = (percentText: string) => Number(percentText || "0") / 100;
const toBaseCapsText = (caps: number[]) => caps.join(", ");
const GLOBAL_SUPPRESSION_PAGE_SIZE = 20;

const toIsoOrNull = (value: string) => {
  if (!value.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

function validateConfig(
  config: GovernanceConfig,
  warmupBaseCapsText: string,
): Record<string, string> {
  const errors: Record<string, string> = {};

  const validateRate = (value: number, key: string) => {
    if (!Number.isFinite(value)) {
      errors[key] = "Value must be numeric";
      return;
    }
    if (value < 0 || value > 1) {
      errors[key] = "Value must be between 0% and 100%";
    }
  };

  validateRate(
    config.hard_stop_thresholds.hard_bounce_rate,
    "hard_stop.hard_bounce_rate",
  );
  validateRate(
    config.hard_stop_thresholds.complaint_rate,
    "hard_stop.complaint_rate",
  );
  validateRate(config.hard_stop_thresholds.spam_rate, "hard_stop.spam_rate");
  validateRate(
    config.hard_stop_thresholds.failed_delivery_rate,
    "hard_stop.failed_delivery_rate",
  );

  validateRate(
    config.warning_thresholds.hard_bounce_rate,
    "warning.hard_bounce_rate",
  );
  validateRate(
    config.warning_thresholds.soft_bounce_rate,
    "warning.soft_bounce_rate",
  );
  validateRate(
    config.warning_thresholds.complaint_rate,
    "warning.complaint_rate",
  );

  if (
    !Number.isFinite(config.warning_thresholds.trend_multiplier) ||
    config.warning_thresholds.trend_multiplier <= 0
  ) {
    errors["warning.trend_multiplier"] =
      "Trend multiplier must be greater than 0";
  }

  if (
    !Number.isInteger(config.warning_thresholds.trend_prior_min_sent) ||
    config.warning_thresholds.trend_prior_min_sent <= 0
  ) {
    errors["warning.trend_prior_min_sent"] =
      "Trend prior min sent must be a positive integer";
  }

  const { healthy_min, warning_min, risk_min } = config.reputation_tiers;
  if (
    healthy_min < 0 ||
    healthy_min > 100 ||
    warning_min < 0 ||
    warning_min > 100 ||
    risk_min < 0 ||
    risk_min > 100
  ) {
    errors["reputation.cutoffs"] = "Tier cutoffs must be between 0 and 100";
  }
  if (!(healthy_min > warning_min && warning_min > risk_min)) {
    errors["reputation.cutoffs"] =
      "Healthy must be greater than Warning, and Warning greater than Risk";
  }

  if (
    !Number.isInteger(config.batch.max_batch_size) ||
    config.batch.max_batch_size <= 0
  ) {
    errors["batch.max_batch_size"] =
      "Default batch size must be a positive integer";
  }
  if (
    !Number.isInteger(config.batch.delay_min_seconds) ||
    config.batch.delay_min_seconds <= 0
  ) {
    errors["batch.delay_min_seconds"] = "Delay min must be a positive integer";
  }
  if (
    !Number.isInteger(config.batch.delay_max_seconds) ||
    config.batch.delay_max_seconds <= 0
  ) {
    errors["batch.delay_max_seconds"] = "Delay max must be a positive integer";
  }
  if (config.batch.delay_min_seconds > config.batch.delay_max_seconds) {
    errors["batch.delay_range"] =
      "Delay min must be less than or equal to delay max";
  }

  if (
    !Number.isFinite(config.warmup.scaling_factor) ||
    config.warmup.scaling_factor <= 0
  ) {
    errors["warmup.scaling_factor"] = "Scaling factor must be greater than 0";
  }
  if (
    !Number.isInteger(config.warmup.max_daily_cap) ||
    config.warmup.max_daily_cap <= 0
  ) {
    errors["warmup.max_daily_cap"] = "Max daily cap must be a positive integer";
  }
  if (
    !Number.isInteger(config.warmup.min_healthy_cap_floor) ||
    config.warmup.min_healthy_cap_floor < 0
  ) {
    errors["warmup.min_healthy_cap_floor"] =
      "Min healthy cap floor must be 0 or greater";
  }
  if (config.warmup.min_healthy_cap_floor > config.warmup.max_daily_cap) {
    errors["warmup.floor_vs_max"] =
      "Min healthy cap floor must be less than or equal to max daily cap";
  }

  const caps = warmupBaseCapsText
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (caps.length === 0) {
    errors["warmup.base_caps"] = "Provide at least one warmup base cap";
  } else {
    const parsed = caps.map((part) => Number(part));
    if (parsed.some((value) => !Number.isInteger(value) || value <= 0)) {
      errors["warmup.base_caps"] =
        "Warmup base caps must be comma-separated positive integers";
    }
  }

  return errors;
}

export default function AdminGovernanceConfig() {
  const { data: isSuperAdmin, isLoading } = useIsSuperAdmin();
  const [config, setConfig] = useState<GovernanceConfig | null>(null);
  const [initialConfigJson, setInitialConfigJson] = useState("");
  const [warmupBaseCapsText, setWarmupBaseCapsText] = useState("");
  const [saving, setSaving] = useState(false);
  const [profileApplying, setProfileApplying] = useState<
    null | "strict" | "relaxed"
  >(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [globalSuppressionSearch, setGlobalSuppressionSearch] = useState("");
  const [globalSuppressionReasonFilter, setGlobalSuppressionReasonFilter] =
    useState("");
  const [globalSuppressionPage, setGlobalSuppressionPage] = useState(0);
  const [globalSuppressionRows, setGlobalSuppressionRows] = useState<
    GlobalSuppressionRow[]
  >([]);
  const [globalSuppressionCount, setGlobalSuppressionCount] = useState(0);
  const [selectedGlobalSuppressionIds, setSelectedGlobalSuppressionIds] =
    useState<string[]>([]);
  const [globalSuppressionLoading, setGlobalSuppressionLoading] =
    useState(false);
  const [globalSuppressionBusy, setGlobalSuppressionBusy] = useState(false);

  const [manualGlobalSuppressionEmail, setManualGlobalSuppressionEmail] =
    useState("");
  const [manualGlobalSuppressionReason, setManualGlobalSuppressionReason] =
    useState("");
  const [
    manualGlobalSuppressionExpiresAt,
    setManualGlobalSuppressionExpiresAt,
  ] = useState("");

  useEffect(() => {
    const loadConfig = async () => {
      setLoadingConfig(true);
      const { data, error } = await supabase.rpc(
        "admin_get_email_governance_config" as never,
      );

      if (error) {
        toast.error(error.message || "Failed to load governance config");
        setLoadingConfig(false);
        return;
      }

      const value = data as GovernanceConfig;
      setConfig(value);
      setWarmupBaseCapsText(toBaseCapsText(value.warmup.base_caps || []));
      setInitialConfigJson(JSON.stringify(value));
      setLoadingConfig(false);
    };

    void loadConfig();
  }, []);

  const loadGlobalSuppressions = async () => {
    setGlobalSuppressionLoading(true);
    const { data, error } = await supabase.rpc(
      "admin_list_global_email_suppressions" as never,
      {
        p_search: globalSuppressionSearch.trim() || null,
        p_reason_filter: globalSuppressionReasonFilter.trim() || null,
        p_page: globalSuppressionPage,
        p_page_size: GLOBAL_SUPPRESSION_PAGE_SIZE,
      } as never,
    );
    setGlobalSuppressionLoading(false);

    if (error) {
      toast.error(error.message || "Failed to load global suppressions");
      return;
    }

    const payload =
      (data as { data?: GlobalSuppressionRow[]; count?: number }) || {};
    setGlobalSuppressionRows(payload.data || []);
    setGlobalSuppressionCount(Number(payload.count || 0));
    setSelectedGlobalSuppressionIds([]);
  };

  useEffect(() => {
    void loadGlobalSuppressions();
  }, [
    globalSuppressionSearch,
    globalSuppressionReasonFilter,
    globalSuppressionPage,
  ]);

  const runGlobalSuppressionAction = async (
    rpcName: string,
    args: Record<string, unknown>,
    successMessage: string,
  ) => {
    setGlobalSuppressionBusy(true);
    const { error } = await supabase.rpc(rpcName as never, args as never);
    setGlobalSuppressionBusy(false);

    if (error) {
      toast.error(error.message || "Action failed");
      return;
    }

    toast.success(successMessage);
    await loadGlobalSuppressions();
  };

  const validationErrors = useMemo(() => {
    if (!config) return {};
    return validateConfig(config, warmupBaseCapsText);
  }, [config, warmupBaseCapsText]);

  const hasValidationErrors = Object.keys(validationErrors).length > 0;
  const isDirty = useMemo(() => {
    if (!config || !initialConfigJson) return false;
    return JSON.stringify(config) !== initialConfigJson;
  }, [config, initialConfigJson]);

  const canSave = useMemo(
    () =>
      !!config && !saving && !loadingConfig && !hasValidationErrors && isDirty,
    [config, saving, loadingConfig, hasValidationErrors, isDirty],
  );

  const globalSuppressionTotalPages = Math.max(
    1,
    Math.ceil(globalSuppressionCount / GLOBAL_SUPPRESSION_PAGE_SIZE),
  );

  const allGlobalVisibleSelected =
    globalSuppressionRows.length > 0 &&
    globalSuppressionRows.every((row) =>
      selectedGlobalSuppressionIds.includes(row.id),
    );

  if (isLoading) {
    return (
      <PageContainer
        sx={{
          maxWidth: "64rem",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Stack spacing={1.5} alignItems="center">
          <CircularProgress size="lg" />
          <Typography level="body-sm" color="neutral">
            Loading governance access...
          </Typography>
        </Stack>
      </PageContainer>
    );
  }

  if (!isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (loadingConfig || !config) {
    return (
      <PageContainer sx={{ maxWidth: "64rem" }}>
        <JoyCard>
          <JoyCardContent sx={{ pt: 3 }}>
            <Typography level="body-md" color="neutral">
              Loading governance configuration...
            </Typography>
          </JoyCardContent>
        </JoyCard>
      </PageContainer>
    );
  }

  const updateNumeric =
    (updater: (next: GovernanceConfig, value: number) => void) =>
    (valueText: string) => {
      const value = Number(valueText || "0");
      setConfig((prev) => {
        if (!prev) return prev;
        const next = structuredClone(prev);
        updater(next, value);
        return next;
      });
    };

  const updatePercent =
    (updater: (next: GovernanceConfig, value: number) => void) =>
    (valueText: string) => {
      const value = fromPercent(valueText);
      setConfig((prev) => {
        if (!prev) return prev;
        const next = structuredClone(prev);
        updater(next, value);
        return next;
      });
    };

  const onSave = async () => {
    if (!config) return;

    const caps = warmupBaseCapsText
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part.length > 0)
      .map((part) => Number(part));

    const nextConfig = structuredClone(config);
    nextConfig.warmup.base_caps = caps;

    setSaving(true);
    const { error } = await supabase.rpc(
      "admin_set_email_governance_config" as never,
      {
        p_config: nextConfig,
        p_reason: "email_governance_settings_update",
      } as never,
    );

    setSaving(false);

    if (error) {
      toast.error(error.message || "Failed to save governance configuration");
      return;
    }

    setConfig(nextConfig);
    setInitialConfigJson(JSON.stringify(nextConfig));
    setConfirmOpen(false);
    toast.success("Governance configuration saved");
  };

  const applyProfile = async (profile: "strict" | "relaxed") => {
    setProfileApplying(profile);
    const { data, error } = await supabase.rpc(
      "admin_apply_email_governance_profile" as never,
      {
        p_profile: profile,
        p_reason: `apply_${profile}_profile_from_admin_ui`,
      } as never,
    );
    setProfileApplying(null);

    if (error) {
      toast.error(error.message || "Failed to apply profile");
      return;
    }

    const nextConfig = data as GovernanceConfig;
    setConfig(nextConfig);
    setWarmupBaseCapsText(toBaseCapsText(nextConfig.warmup.base_caps || []));
    setInitialConfigJson(JSON.stringify(nextConfig));
    toast.success(
      profile === "strict"
        ? "Strict governance profile applied"
        : "Relaxed governance profile applied",
    );
  };

  return (
    <PageContainer sx={{ maxWidth: "64rem" }}>
      <Stack spacing={3}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Shield className="h-7 w-7 text-warning" />
          <Stack spacing={0.5}>
            <Typography level="h1">Email Governance Settings</Typography>
            <Typography level="body-md" color="neutral">
              Global controls for governance thresholds, batch behavior, and
              warmup limits.
            </Typography>
          </Stack>
        </Stack>

        <JoyFormSection
          title="Profiles"
          description="Apply a predefined global profile for faster governance tuning."
        >
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1.5}
            useFlexGap
          >
            <JoyButton
              bloomVariant="outline"
              onClick={() => void applyProfile("strict")}
              disabled={
                saving || loadingConfig || profileApplying !== null || !config
              }
            >
              {profileApplying === "strict"
                ? "Applying Strict..."
                : "Apply Strict Profile"}
            </JoyButton>
            <JoyButton
              bloomVariant="outline"
              onClick={() => void applyProfile("relaxed")}
              disabled={
                saving || loadingConfig || profileApplying !== null || !config
              }
            >
              {profileApplying === "relaxed"
                ? "Applying Relaxed..."
                : "Apply Relaxed Profile"}
            </JoyButton>
          </Stack>
        </JoyFormSection>

        <JoyFormSection
          title="Hard Stop Thresholds (%)"
          description="Used by automatic tenant hard-stop enforcement."
        >
          <Grid container spacing={2}>
            <Grid xs={12} md={6}>
              <Field
                label="Hard Bounce %"
                helperText="Automatically stops sending when too many emails permanently fail (bad addresses)."
                value={toPercent(config.hard_stop_thresholds.hard_bounce_rate)}
                onChange={updatePercent((n, v) => {
                  n.hard_stop_thresholds.hard_bounce_rate = v;
                })}
                error={validationErrors["hard_stop.hard_bounce_rate"]}
              />
            </Grid>
            <Grid xs={12} md={6}>
              <Field
                label="Complaint %"
                helperText="Automatically stops sending when recipients report too many spam/complaints."
                value={toPercent(config.hard_stop_thresholds.complaint_rate)}
                onChange={updatePercent((n, v) => {
                  n.hard_stop_thresholds.complaint_rate = v;
                })}
                error={validationErrors["hard_stop.complaint_rate"]}
              />
            </Grid>
            <Grid xs={12} md={6}>
              <Field
                label="Spam %"
                helperText="Automatically stops sending when spam signals exceed this threshold."
                value={toPercent(config.hard_stop_thresholds.spam_rate)}
                onChange={updatePercent((n, v) => {
                  n.hard_stop_thresholds.spam_rate = v;
                })}
                error={validationErrors["hard_stop.spam_rate"]}
              />
            </Grid>
            <Grid xs={12} md={6}>
              <Field
                label="Delivery Failure %"
                helperText="Automatically stops sending when too many deliveries fail (rejects/timeouts)."
                value={toPercent(
                  config.hard_stop_thresholds.failed_delivery_rate,
                )}
                onChange={updatePercent((n, v) => {
                  n.hard_stop_thresholds.failed_delivery_rate = v;
                })}
                error={validationErrors["hard_stop.failed_delivery_rate"]}
              />
            </Grid>
          </Grid>
        </JoyFormSection>

        <JoyFormSection
          title="Warning Thresholds"
          description="Used by campaign warning evaluation and throttle sensitivity."
        >
          <Grid container spacing={2}>
            <Grid xs={12} md={4}>
              <Field
                label="Warning Hard Bounce %"
                helperText="Shows a warning (and may throttle) before a hard stop if permanent failures increase."
                value={toPercent(config.warning_thresholds.hard_bounce_rate)}
                onChange={updatePercent((n, v) => {
                  n.warning_thresholds.hard_bounce_rate = v;
                })}
                error={validationErrors["warning.hard_bounce_rate"]}
              />
            </Grid>
            <Grid xs={12} md={4}>
              <Field
                label="Soft Bounce %"
                helperText="Shows a warning for temporary delivery issues (mailbox full, rate limiting, etc.)."
                value={toPercent(config.warning_thresholds.soft_bounce_rate)}
                onChange={updatePercent((n, v) => {
                  n.warning_thresholds.soft_bounce_rate = v;
                })}
                error={validationErrors["warning.soft_bounce_rate"]}
              />
            </Grid>
            <Grid xs={12} md={4}>
              <Field
                label="Warning Complaint %"
                helperText="Shows a warning when recipients report spam/complaints above this level."
                value={toPercent(config.warning_thresholds.complaint_rate)}
                onChange={updatePercent((n, v) => {
                  n.warning_thresholds.complaint_rate = v;
                })}
                error={validationErrors["warning.complaint_rate"]}
              />
            </Grid>
            <Grid xs={12} md={4}>
              <Field
                label="Trend Multiplier"
                helperText="How sensitive warnings are to sudden spikes (recent window vs prior window)."
                value={String(config.warning_thresholds.trend_multiplier)}
                onChange={updateNumeric((n, v) => {
                  n.warning_thresholds.trend_multiplier = v;
                })}
                error={validationErrors["warning.trend_multiplier"]}
              />
            </Grid>
            <Grid xs={12} md={4}>
              <Field
                label="Trend Prior Min Sent"
                helperText="Minimum emails in the prior window before trend comparisons are considered reliable."
                value={String(config.warning_thresholds.trend_prior_min_sent)}
                onChange={updateNumeric((n, v) => {
                  n.warning_thresholds.trend_prior_min_sent = v;
                })}
                error={validationErrors["warning.trend_prior_min_sent"]}
              />
            </Grid>
          </Grid>
        </JoyFormSection>

        <JoyFormSection
          title="Reputation Tiers"
          description="Score cutoffs and policy caps by tier."
        >
          <Grid container spacing={2}>
            <Grid xs={12} md={4}>
              <Field
                label="Healthy Min Score"
                helperText="Score at or above this is treated as Healthy."
                value={String(config.reputation_tiers.healthy_min)}
                onChange={updateNumeric((n, v) => {
                  n.reputation_tiers.healthy_min = v;
                })}
                error={validationErrors["reputation.cutoffs"]}
              />
            </Grid>
            <Grid xs={12} md={4}>
              <Field
                label="Warning Min Score"
                helperText="Below Healthy but above this cutoff enters Warning tier."
                value={String(config.reputation_tiers.warning_min)}
                onChange={updateNumeric((n, v) => {
                  n.reputation_tiers.warning_min = v;
                })}
                error={validationErrors["reputation.cutoffs"]}
              />
            </Grid>
            <Grid xs={12} md={4}>
              <Field
                label="Risk Min Score"
                helperText="Below this cutoff enters higher-risk tiers with stronger sending limits."
                value={String(config.reputation_tiers.risk_min)}
                onChange={updateNumeric((n, v) => {
                  n.reputation_tiers.risk_min = v;
                })}
                error={validationErrors["reputation.cutoffs"]}
              />
            </Grid>
          </Grid>
        </JoyFormSection>

        <JoyFormSection
          title="Default Batch Settings"
          description="Default batch size and delay used for governance pacing."
        >
          <Grid container spacing={2}>
            <Grid xs={12} md={4}>
              <Field
                label="Default Batch Size"
                helperText="How many recipients are sent per chunk before pausing."
                value={String(config.batch.max_batch_size)}
                onChange={updateNumeric((n, v) => {
                  n.batch.max_batch_size = v;
                })}
                error={validationErrors["batch.max_batch_size"]}
              />
            </Grid>
            <Grid xs={12} md={4}>
              <Field
                label="Default Batch Delay Min (s)"
                helperText="Shortest pause between chunks (in seconds)."
                value={String(config.batch.delay_min_seconds)}
                onChange={updateNumeric((n, v) => {
                  n.batch.delay_min_seconds = v;
                })}
                error={
                  validationErrors["batch.delay_min_seconds"] ||
                  validationErrors["batch.delay_range"]
                }
              />
            </Grid>
            <Grid xs={12} md={4}>
              <Field
                label="Default Batch Delay Max (s)"
                helperText="Longest pause between chunks (randomized up to this limit)."
                value={String(config.batch.delay_max_seconds)}
                onChange={updateNumeric((n, v) => {
                  n.batch.delay_max_seconds = v;
                })}
                error={
                  validationErrors["batch.delay_max_seconds"] ||
                  validationErrors["batch.delay_range"]
                }
              />
            </Grid>
          </Grid>
        </JoyFormSection>

        <JoyFormSection
          title="Warmup Limits"
          description="Default warmup progression controls for deliverability safety."
        >
          <Grid container spacing={2}>
            <Grid xs={12} md={6}>
              <Field
                label="Warmup Base Caps (comma-separated)"
                helperText="Daily limits for early warmup days (example: 50, 100, 200)."
                value={warmupBaseCapsText}
                onChange={(valueText) => {
                  setWarmupBaseCapsText(valueText);
                }}
                error={validationErrors["warmup.base_caps"]}
              />
            </Grid>
            <Grid xs={12} md={6}>
              <Field
                label="Warmup Scaling Factor"
                helperText="How quickly the daily cap grows over time (higher = faster growth)."
                value={String(config.warmup.scaling_factor)}
                onChange={updateNumeric((n, v) => {
                  n.warmup.scaling_factor = v;
                })}
                error={validationErrors["warmup.scaling_factor"]}
              />
            </Grid>
            <Grid xs={12} md={6}>
              <Field
                label="Warmup Max Daily Cap"
                helperText="Absolute ceiling for warmup sends per day."
                value={String(config.warmup.max_daily_cap)}
                onChange={updateNumeric((n, v) => {
                  n.warmup.max_daily_cap = v;
                })}
                error={
                  validationErrors["warmup.max_daily_cap"] ||
                  validationErrors["warmup.floor_vs_max"]
                }
              />
            </Grid>
            <Grid xs={12} md={6}>
              <Field
                label="Warmup Min Healthy Floor"
                helperText="Minimum daily cap when things look healthy (prevents over-throttling)."
                value={String(config.warmup.min_healthy_cap_floor)}
                onChange={updateNumeric((n, v) => {
                  n.warmup.min_healthy_cap_floor = v;
                })}
                error={
                  validationErrors["warmup.min_healthy_cap_floor"] ||
                  validationErrors["warmup.floor_vs_max"]
                }
              />
            </Grid>
          </Grid>
        </JoyFormSection>

        <JoyFormSection
          title="Global Suppression Management"
          description="Cross-tenant suppression controls for known bad recipients."
        >
          <Stack spacing={2}>
            <Grid container spacing={2}>
              <Grid xs={12} md={8}>
                <Stack spacing={1}>
                  <Stack direction="row" spacing={1} alignItems="flex-end">
                    <JoySearchInput
                      label="Search Email"
                      helperText="Find recipients suppressed across all tenants."
                      value={globalSuppressionSearch}
                      onChange={(event) => {
                        setGlobalSuppressionSearch(event.target.value);
                        setGlobalSuppressionPage(0);
                      }}
                      placeholder="Search globally suppressed email"
                    />
                    <JoyButton
                      bloomVariant="outline"
                      onClick={() => void loadGlobalSuppressions()}
                      disabled={
                        globalSuppressionLoading || globalSuppressionBusy
                      }
                      sx={{ minWidth: 44 }}
                    >
                      <Search className="h-4 w-4" />
                    </JoyButton>
                  </Stack>
                </Stack>
              </Grid>
              <Grid xs={12} md={4}>
                <Input
                  label="Reason Filter"
                  helperText="Filter results by suppression reason text."
                  value={globalSuppressionReasonFilter}
                  onChange={(event) => {
                    setGlobalSuppressionReasonFilter(event.target.value);
                    setGlobalSuppressionPage(0);
                  }}
                  placeholder="Contains text"
                />
              </Grid>
            </Grid>

            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              <JoyButton
                bloomVariant="outline"
                onClick={() =>
                  void runGlobalSuppressionAction(
                    "admin_bulk_lift_global_email_suppressions",
                    {
                      p_ids: selectedGlobalSuppressionIds,
                      p_reason: "admin_governance_global_suppression_bulk_lift",
                    },
                    "Selected global suppressions removed",
                  )
                }
                disabled={
                  globalSuppressionBusy ||
                  selectedGlobalSuppressionIds.length === 0
                }
                startDecorator={<Trash2 className="h-4 w-4" />}
              >
                Remove Selected ({selectedGlobalSuppressionIds.length})
              </JoyButton>
            </Stack>

            <Sheet
              variant="outlined"
              sx={{ borderRadius: "var(--joy-radius-md)" }}
            >
              <JoyTable containerSx={{ minWidth: 760 }}>
                <JoyTableHead>
                  <JoyTableRow>
                    <JoyTableHeaderCell sx={{ width: 48 }}>
                      <Checkbox
                        size="sm"
                        checked={allGlobalVisibleSelected}
                        slotProps={{
                          input: {
                            "aria-label": "Select all global suppressions",
                          },
                        }}
                        onChange={(event) => {
                          if (!event.target.checked) {
                            setSelectedGlobalSuppressionIds([]);
                            return;
                          }
                          setSelectedGlobalSuppressionIds(
                            globalSuppressionRows.map((row) => row.id),
                          );
                        }}
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
                  {globalSuppressionLoading ? (
                    Array.from({ length: GLOBAL_SUPPRESSION_PAGE_SIZE }).map(
                      (_, index) => (
                        <JoyTableRow key={index}>
                          {Array.from({ length: 6 }).map((__, cellIndex) => (
                            <JoyTableCell key={cellIndex}>
                              <Skeleton sx={{ height: 20, width: "100%" }} />
                            </JoyTableCell>
                          ))}
                        </JoyTableRow>
                      ),
                    )
                  ) : globalSuppressionRows.length === 0 ? (
                    <JoyTableRow>
                      <JoyTableCell
                        colSpan={6}
                        sx={{
                          color: "neutral.500",
                          py: 5,
                          textAlign: "center",
                        }}
                      >
                        No global suppression entries found.
                      </JoyTableCell>
                    </JoyTableRow>
                  ) : (
                    globalSuppressionRows.map((row) => (
                      <JoyTableRow key={row.id}>
                        <JoyTableCell>
                          <Checkbox
                            size="sm"
                            checked={selectedGlobalSuppressionIds.includes(
                              row.id,
                            )}
                            slotProps={{
                              input: {
                                "aria-label": `Select ${row.email}`,
                              },
                            }}
                            onChange={(event) => {
                              if (event.target.checked) {
                                setSelectedGlobalSuppressionIds((prev) =>
                                  prev.includes(row.id)
                                    ? prev
                                    : [...prev, row.id],
                                );
                                return;
                              }
                              setSelectedGlobalSuppressionIds((prev) =>
                                prev.filter((id) => id !== row.id),
                              );
                            }}
                            sx={{ m: 0 }}
                          />
                        </JoyTableCell>
                        <JoyTableCell
                          sx={{ fontWeight: "var(--joy-fontWeight-md)" }}
                        >
                          {row.email}
                        </JoyTableCell>
                        <JoyTableCell>{row.reason || "-"}</JoyTableCell>
                        <JoyTableCell>{row.suppressed_at}</JoyTableCell>
                        <JoyTableCell>{row.expires_at || "-"}</JoyTableCell>
                        <JoyTableCell>
                          <JoyButton
                            bloomVariant="ghost"
                            size="sm"
                            onClick={() =>
                              void runGlobalSuppressionAction(
                                "admin_lift_global_email_suppression",
                                {
                                  p_id: row.id,
                                  p_reason:
                                    "admin_governance_global_suppression_single_lift",
                                },
                                "Global suppression removed",
                              )
                            }
                            disabled={globalSuppressionBusy}
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
              page={globalSuppressionPage}
              pageIndexBase={0}
              pageSize={GLOBAL_SUPPRESSION_PAGE_SIZE}
              totalCount={globalSuppressionCount}
              disabled={globalSuppressionLoading || globalSuppressionBusy}
              showPageSizeSelector={false}
              onPageChange={setGlobalSuppressionPage}
            />

            <Sheet
              variant="soft"
              color="neutral"
              sx={{ p: 2, borderRadius: "var(--joy-radius-lg)" }}
            >
              <Stack spacing={2}>
                <Typography level="title-sm">
                  Add Manual Global Suppression
                </Typography>
                <Grid container spacing={2}>
                  <Grid xs={12} md={4}>
                    <Field
                      label="Email"
                      helperText="Email address to block globally (applies to every tenant)."
                      value={manualGlobalSuppressionEmail}
                      onChange={setManualGlobalSuppressionEmail}
                    />
                  </Grid>
                  <Grid xs={12} md={4}>
                    <Field
                      label="Reason"
                      helperText="Why this address is blocked (used for audit/history)."
                      value={manualGlobalSuppressionReason}
                      onChange={setManualGlobalSuppressionReason}
                    />
                  </Grid>
                  <Grid xs={12} md={4}>
                    <Input
                      label="Expires At (optional)"
                      helperText="Optional expiry time to automatically lift this suppression."
                      type="datetime-local"
                      value={manualGlobalSuppressionExpiresAt}
                      onChange={(event) =>
                        setManualGlobalSuppressionExpiresAt(event.target.value)
                      }
                    />
                  </Grid>
                </Grid>
                <JoyButton
                  onClick={() =>
                    void runGlobalSuppressionAction(
                      "admin_add_global_email_suppression",
                      {
                        p_email: manualGlobalSuppressionEmail,
                        p_reason:
                          manualGlobalSuppressionReason.trim() ||
                          "admin_governance_global_suppression_manual_add",
                        p_expires_at: toIsoOrNull(
                          manualGlobalSuppressionExpiresAt,
                        ),
                      },
                      "Global suppression added",
                    )
                  }
                  disabled={
                    globalSuppressionBusy ||
                    manualGlobalSuppressionEmail.trim() === ""
                  }
                  startDecorator={<Plus className="h-4 w-4" />}
                >
                  Add Global Suppression
                </JoyButton>
              </Stack>
            </Sheet>
          </Stack>
        </JoyFormSection>

        <Stack alignItems="flex-end">
          <JoyButton
            onClick={() => setConfirmOpen(true)}
            disabled={!canSave}
            loading={saving}
            loadingPosition="start"
            startDecorator={<Save className="h-4 w-4" />}
          >
            {saving ? "Saving..." : "Save Email Governance Settings"}
          </JoyButton>
          <JoyAlertDialog
            open={confirmOpen}
            onClose={() => setConfirmOpen(false)}
            onConfirm={() => {
              void onSave();
            }}
            title="Confirm Global Governance Update"
            description="This will update global email governance behavior for all tenants and campaigns."
            variant="warning"
            confirmLabel={saving ? "Saving..." : "Confirm Save"}
            confirmDisabled={!canSave}
            cancelDisabled={saving}
            disableClose={saving}
            loading={saving}
          />
        </Stack>
      </Stack>
    </PageContainer>
  );
}

function Field({
  label,
  helperText,
  value,
  onChange,
  error,
}: {
  label: string;
  helperText?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  return (
    <Input
      label={label}
      helperText={helperText}
      error={Boolean(error)}
      errorMessage={error}
      value={value}
      onValueChange={onChange}
      aria-invalid={Boolean(error)}
    />
  );
}
