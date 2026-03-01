import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Save, Search, Plus, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (loadingConfig || !config) {
    return (
      <div className="container max-w-5xl mx-auto p-6">
        <Card>
          <CardContent className="py-8 text-muted-foreground">
            Loading governance configuration...
          </CardContent>
        </Card>
      </div>
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
    <div className="container max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-7 w-7 text-warning" />
        <div>
          <h1 className="text-3xl font-bold">Email Governance Settings</h1>
          <p className="text-muted-foreground">
            Global controls for governance thresholds, batch behavior, and
            warmup limits.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profiles</CardTitle>
          <CardDescription>
            Apply a predefined global profile for faster governance tuning.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col md:flex-row gap-3">
          <Button
            variant="outline"
            onClick={() => void applyProfile("strict")}
            disabled={
              saving || loadingConfig || profileApplying !== null || !config
            }
          >
            {profileApplying === "strict"
              ? "Applying Strict..."
              : "Apply Strict Profile"}
          </Button>
          <Button
            variant="outline"
            onClick={() => void applyProfile("relaxed")}
            disabled={
              saving || loadingConfig || profileApplying !== null || !config
            }
          >
            {profileApplying === "relaxed"
              ? "Applying Relaxed..."
              : "Apply Relaxed Profile"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Hard Stop Thresholds (%)</CardTitle>
          <CardDescription>
            Used by automatic tenant hard-stop enforcement.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            label="Hard Bounce %"
            helperText="Automatically stops sending when too many emails permanently fail (bad addresses)."
            value={toPercent(config.hard_stop_thresholds.hard_bounce_rate)}
            onChange={updatePercent((n, v) => {
              n.hard_stop_thresholds.hard_bounce_rate = v;
            })}
            error={validationErrors["hard_stop.hard_bounce_rate"]}
          />
          <Field
            label="Complaint %"
            helperText="Automatically stops sending when recipients report too many spam/complaints."
            value={toPercent(config.hard_stop_thresholds.complaint_rate)}
            onChange={updatePercent((n, v) => {
              n.hard_stop_thresholds.complaint_rate = v;
            })}
            error={validationErrors["hard_stop.complaint_rate"]}
          />
          <Field
            label="Spam %"
            helperText="Automatically stops sending when spam signals exceed this threshold."
            value={toPercent(config.hard_stop_thresholds.spam_rate)}
            onChange={updatePercent((n, v) => {
              n.hard_stop_thresholds.spam_rate = v;
            })}
            error={validationErrors["hard_stop.spam_rate"]}
          />
          <Field
            label="Delivery Failure %"
            helperText="Automatically stops sending when too many deliveries fail (rejects/timeouts)."
            value={toPercent(config.hard_stop_thresholds.failed_delivery_rate)}
            onChange={updatePercent((n, v) => {
              n.hard_stop_thresholds.failed_delivery_rate = v;
            })}
            error={validationErrors["hard_stop.failed_delivery_rate"]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Warning Thresholds</CardTitle>
          <CardDescription>
            Used by campaign warning evaluation and throttle sensitivity.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field
            label="Warning Hard Bounce %"
            helperText="Shows a warning (and may throttle) before a hard stop if permanent failures increase."
            value={toPercent(config.warning_thresholds.hard_bounce_rate)}
            onChange={updatePercent((n, v) => {
              n.warning_thresholds.hard_bounce_rate = v;
            })}
            error={validationErrors["warning.hard_bounce_rate"]}
          />
          <Field
            label="Soft Bounce %"
            helperText="Shows a warning for temporary delivery issues (mailbox full, rate limiting, etc.)."
            value={toPercent(config.warning_thresholds.soft_bounce_rate)}
            onChange={updatePercent((n, v) => {
              n.warning_thresholds.soft_bounce_rate = v;
            })}
            error={validationErrors["warning.soft_bounce_rate"]}
          />
          <Field
            label="Warning Complaint %"
            helperText="Shows a warning when recipients report spam/complaints above this level."
            value={toPercent(config.warning_thresholds.complaint_rate)}
            onChange={updatePercent((n, v) => {
              n.warning_thresholds.complaint_rate = v;
            })}
            error={validationErrors["warning.complaint_rate"]}
          />
          <Field
            label="Trend Multiplier"
            helperText="How sensitive warnings are to sudden spikes (recent window vs prior window)."
            value={String(config.warning_thresholds.trend_multiplier)}
            onChange={updateNumeric((n, v) => {
              n.warning_thresholds.trend_multiplier = v;
            })}
            error={validationErrors["warning.trend_multiplier"]}
          />
          <Field
            label="Trend Prior Min Sent"
            helperText="Minimum emails in the prior window before trend comparisons are considered reliable."
            value={String(config.warning_thresholds.trend_prior_min_sent)}
            onChange={updateNumeric((n, v) => {
              n.warning_thresholds.trend_prior_min_sent = v;
            })}
            error={validationErrors["warning.trend_prior_min_sent"]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reputation Tiers</CardTitle>
          <CardDescription>
            Score cutoffs and policy caps by tier.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field
            label="Healthy Min Score"
            helperText="Score at or above this is treated as Healthy."
            value={String(config.reputation_tiers.healthy_min)}
            onChange={updateNumeric((n, v) => {
              n.reputation_tiers.healthy_min = v;
            })}
            error={validationErrors["reputation.cutoffs"]}
          />
          <Field
            label="Warning Min Score"
            helperText="Below Healthy but above this cutoff enters Warning tier."
            value={String(config.reputation_tiers.warning_min)}
            onChange={updateNumeric((n, v) => {
              n.reputation_tiers.warning_min = v;
            })}
            error={validationErrors["reputation.cutoffs"]}
          />
          <Field
            label="Risk Min Score"
            helperText="Below this cutoff enters higher-risk tiers with stronger sending limits."
            value={String(config.reputation_tiers.risk_min)}
            onChange={updateNumeric((n, v) => {
              n.reputation_tiers.risk_min = v;
            })}
            error={validationErrors["reputation.cutoffs"]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Default Batch Settings</CardTitle>
          <CardDescription>
            Default batch size and delay used for governance pacing.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field
            label="Default Batch Size"
            helperText="How many recipients are sent per chunk before pausing."
            value={String(config.batch.max_batch_size)}
            onChange={updateNumeric((n, v) => {
              n.batch.max_batch_size = v;
            })}
            error={validationErrors["batch.max_batch_size"]}
          />
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Warmup Limits</CardTitle>
          <CardDescription>
            Default warmup progression controls for deliverability safety.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            label="Warmup Base Caps (comma-separated)"
            helperText="Daily limits for early warmup days (example: 50, 100, 200)."
            value={warmupBaseCapsText}
            onChange={(valueText) => {
              setWarmupBaseCapsText(valueText);
            }}
            error={validationErrors["warmup.base_caps"]}
          />
          <Field
            label="Warmup Scaling Factor"
            helperText="How quickly the daily cap grows over time (higher = faster growth)."
            value={String(config.warmup.scaling_factor)}
            onChange={updateNumeric((n, v) => {
              n.warmup.scaling_factor = v;
            })}
            error={validationErrors["warmup.scaling_factor"]}
          />
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Global Suppression Management</CardTitle>
          <CardDescription>
            Cross-tenant suppression controls for known bad recipients.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-2 md:col-span-2">
              <Label>Search Email</Label>
              <p className="text-xs text-muted-foreground">
                Find recipients suppressed across all tenants.
              </p>
              <div className="flex gap-2">
                <Input
                  value={globalSuppressionSearch}
                  onChange={(event) => {
                    setGlobalSuppressionSearch(event.target.value);
                    setGlobalSuppressionPage(0);
                  }}
                  placeholder="Search globally suppressed email"
                />
                <Button
                  variant="outline"
                  onClick={() => void loadGlobalSuppressions()}
                  disabled={globalSuppressionLoading || globalSuppressionBusy}
                >
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Reason Filter</Label>
              <p className="text-xs text-muted-foreground">
                Filter results by suppression reason text.
              </p>
              <Input
                value={globalSuppressionReasonFilter}
                onChange={(event) => {
                  setGlobalSuppressionReasonFilter(event.target.value);
                  setGlobalSuppressionPage(0);
                }}
                placeholder="Contains text"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
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
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Remove Selected ({selectedGlobalSuppressionIds.length})
            </Button>
          </div>

          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[48px]">
                    <input
                      type="checkbox"
                      checked={allGlobalVisibleSelected}
                      onChange={(event) => {
                        if (!event.target.checked) {
                          setSelectedGlobalSuppressionIds([]);
                          return;
                        }
                        setSelectedGlobalSuppressionIds(
                          globalSuppressionRows.map((row) => row.id),
                        );
                      }}
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
                {globalSuppressionRows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-muted-foreground"
                    >
                      No global suppression entries found.
                    </TableCell>
                  </TableRow>
                ) : (
                  globalSuppressionRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedGlobalSuppressionIds.includes(
                            row.id,
                          )}
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
                        />
                      </TableCell>
                      <TableCell className="font-medium">{row.email}</TableCell>
                      <TableCell>{row.reason || "-"}</TableCell>
                      <TableCell>{row.suppressed_at}</TableCell>
                      <TableCell>{row.expires_at || "-"}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
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
              Showing {globalSuppressionRows.length} of {globalSuppressionCount}{" "}
              entries
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setGlobalSuppressionPage((page) => Math.max(0, page - 1))
                }
                disabled={
                  globalSuppressionPage === 0 ||
                  globalSuppressionLoading ||
                  globalSuppressionBusy
                }
              >
                Prev
              </Button>
              <span>
                Page {globalSuppressionPage + 1} / {globalSuppressionTotalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setGlobalSuppressionPage((page) =>
                    Math.min(globalSuppressionTotalPages - 1, page + 1),
                  )
                }
                disabled={
                  globalSuppressionPage >= globalSuppressionTotalPages - 1 ||
                  globalSuppressionLoading ||
                  globalSuppressionBusy
                }
              >
                Next
              </Button>
            </div>
          </div>

          <div className="space-y-3 border rounded-md p-3">
            <p className="font-medium">Add Manual Global Suppression</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <Field
                label="Email"
                helperText="Email address to block globally (applies to every tenant)."
                value={manualGlobalSuppressionEmail}
                onChange={setManualGlobalSuppressionEmail}
              />
              <Field
                label="Reason"
                helperText="Why this address is blocked (used for audit/history)."
                value={manualGlobalSuppressionReason}
                onChange={setManualGlobalSuppressionReason}
              />
              <div className="space-y-2">
                <Label>Expires At (optional)</Label>
                <p className="text-xs text-muted-foreground">
                  Optional expiry time to automatically lift this suppression.
                </p>
                <Input
                  type="datetime-local"
                  value={manualGlobalSuppressionExpiresAt}
                  onChange={(event) =>
                    setManualGlobalSuppressionExpiresAt(event.target.value)
                  }
                />
              </div>
            </div>
            <Button
              onClick={() =>
                void runGlobalSuppressionAction(
                  "admin_add_global_email_suppression",
                  {
                    p_email: manualGlobalSuppressionEmail,
                    p_reason:
                      manualGlobalSuppressionReason.trim() ||
                      "admin_governance_global_suppression_manual_add",
                    p_expires_at: toIsoOrNull(manualGlobalSuppressionExpiresAt),
                  },
                  "Global suppression added",
                )
              }
              disabled={
                globalSuppressionBusy ||
                manualGlobalSuppressionEmail.trim() === ""
              }
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Global Suppression
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <Button onClick={() => setConfirmOpen(true)} disabled={!canSave}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save Email Governance Settings"}
          </Button>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Confirm Global Governance Update
              </AlertDialogTitle>
              <AlertDialogDescription>
                This will update global email governance behavior for all
                tenants and campaigns.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={onSave} disabled={!canSave}>
                {saving ? "Saving..." : "Confirm Save"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
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
    <div className="space-y-2">
      <Label>{label}</Label>
      {helperText ? (
        <p className="text-xs text-muted-foreground">{helperText}</p>
      ) : null}
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
