import { useCallback, useEffect, useState } from "react";
import Divider from "@mui/joy/Divider";
import Grid from "@mui/joy/Grid";
import Stack from "@mui/joy/Stack";
import Tab from "@mui/joy/Tab";
import TabList from "@mui/joy/TabList";
import TabPanel from "@mui/joy/TabPanel";
import Tabs from "@mui/joy/Tabs";
import Typography from "@mui/joy/Typography";
import { JoyStatusChip } from "@/components/joy/JoyChip";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import { JoyDrawer } from "@/components/joy/JoyDrawer";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyFormSection } from "@/components/joy/JoyFormSection";
import { JoyInput as Input } from "@/components/joy/JoyInput";
import { JoySwitch } from "@/components/joy/JoySwitch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  Mail,
  Globe,
  MapPin,
  Calendar,
  Clock,
  CreditCard,
  User,
  ExternalLink,
  Save,
  RotateCcw,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface AdminTenant {
  tenant_id: string;
  company_name: string;
  website: string;
  city: string;
  region: string;
  country: string;
  onboarding_completed_at: string | null;
  tenant_created_at: string;
  primary_contact_email: string;
  primary_contact_name: string;
  primary_contact_last_login: string | null;
  plan: string;
  subscription_status: string;
  trial_start: string | null;
  trial_end: string | null;
  current_period_end: string | null;
  last_activity_at: string | null;
  is_trialing: boolean;
  is_paid_active: boolean;
  trial_not_expired: boolean;
  is_active: boolean;
  health_score: number | null;
  onboarding_steps_done: number | null;
  onboarding_steps_total: number | null;
}

interface TenantDrawerProps {
  tenant: AdminTenant | null;
  open: boolean;
  onClose: () => void;
  onExtendTrial: (tenantId: string, days: number) => void;
  onToggleActive: (tenantId: string, active: boolean) => void;
  onChangePlan?: (tenant: AdminTenant) => void;
}

type OverrideFieldState = {
  enabled: boolean;
  value: string;
};

type OverrideFormState = {
  hardBounceRate: OverrideFieldState;
  complaintRate: OverrideFieldState;
  spamRate: OverrideFieldState;
  healthyMin: OverrideFieldState;
  warningMin: OverrideFieldState;
  riskMin: OverrideFieldState;
  throttledRecipientCap: OverrideFieldState;
  throttledJobBatchSize: OverrideFieldState;
  throttledPacingMultiplier: OverrideFieldState;
  restrictedRecipientCap: OverrideFieldState;
  restrictedJobBatchSize: OverrideFieldState;
  restrictedPacingMultiplier: OverrideFieldState;
  criticalRecipientCap: OverrideFieldState;
  criticalJobBatchSize: OverrideFieldState;
  criticalPacingMultiplier: OverrideFieldState;
  batchMaxSize: OverrideFieldState;
};

const emptyField = (): OverrideFieldState => ({ enabled: false, value: "" });

const createEmptyFormState = (): OverrideFormState => ({
  hardBounceRate: emptyField(),
  complaintRate: emptyField(),
  spamRate: emptyField(),
  healthyMin: emptyField(),
  warningMin: emptyField(),
  riskMin: emptyField(),
  throttledRecipientCap: emptyField(),
  throttledJobBatchSize: emptyField(),
  throttledPacingMultiplier: emptyField(),
  restrictedRecipientCap: emptyField(),
  restrictedJobBatchSize: emptyField(),
  restrictedPacingMultiplier: emptyField(),
  criticalRecipientCap: emptyField(),
  criticalJobBatchSize: emptyField(),
  criticalPacingMultiplier: emptyField(),
  batchMaxSize: emptyField(),
});

function toFieldFromNumber(
  rawValue: unknown,
  isPercent = false,
): OverrideFieldState {
  const numericValue = Number(rawValue);
  if (!Number.isFinite(numericValue)) {
    return emptyField();
  }

  return {
    enabled: true,
    value: isPercent
      ? String(Number((numericValue * 100).toFixed(3)))
      : String(numericValue),
  };
}

function getNested(source: unknown, path: string[]): unknown {
  return path.reduce<unknown>((acc, key) => {
    if (!acc || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[key];
  }, source);
}

function formStateFromOverrides(
  overrides: Record<string, unknown> | null | undefined,
): OverrideFormState {
  const source = overrides || {};
  return {
    hardBounceRate: toFieldFromNumber(
      getNested(source, ["hard_stop_thresholds", "hard_bounce_rate"]),
      true,
    ),
    complaintRate: toFieldFromNumber(
      getNested(source, ["hard_stop_thresholds", "complaint_rate"]),
      true,
    ),
    spamRate: toFieldFromNumber(
      getNested(source, ["hard_stop_thresholds", "spam_rate"]),
      true,
    ),
    healthyMin: toFieldFromNumber(
      getNested(source, ["reputation_tiers", "healthy_min"]),
    ),
    warningMin: toFieldFromNumber(
      getNested(source, ["reputation_tiers", "warning_min"]),
    ),
    riskMin: toFieldFromNumber(
      getNested(source, ["reputation_tiers", "risk_min"]),
    ),
    throttledRecipientCap: toFieldFromNumber(
      getNested(source, ["reputation_tiers", "throttled", "recipient_cap"]),
    ),
    throttledJobBatchSize: toFieldFromNumber(
      getNested(source, ["reputation_tiers", "throttled", "job_batch_size"]),
    ),
    throttledPacingMultiplier: toFieldFromNumber(
      getNested(source, [
        "reputation_tiers",
        "throttled",
        "send_pacing_multiplier",
      ]),
    ),
    restrictedRecipientCap: toFieldFromNumber(
      getNested(source, ["reputation_tiers", "restricted", "recipient_cap"]),
    ),
    restrictedJobBatchSize: toFieldFromNumber(
      getNested(source, ["reputation_tiers", "restricted", "job_batch_size"]),
    ),
    restrictedPacingMultiplier: toFieldFromNumber(
      getNested(source, [
        "reputation_tiers",
        "restricted",
        "send_pacing_multiplier",
      ]),
    ),
    criticalRecipientCap: toFieldFromNumber(
      getNested(source, ["reputation_tiers", "critical", "recipient_cap"]),
    ),
    criticalJobBatchSize: toFieldFromNumber(
      getNested(source, ["reputation_tiers", "critical", "job_batch_size"]),
    ),
    criticalPacingMultiplier: toFieldFromNumber(
      getNested(source, [
        "reputation_tiers",
        "critical",
        "send_pacing_multiplier",
      ]),
    ),
    batchMaxSize: toFieldFromNumber(
      getNested(source, ["batch", "max_batch_size"]),
    ),
  };
}

function parseRequiredNumber(valueText: string, label: string): number {
  const value = Number(valueText);
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a valid number`);
  }
  return value;
}

export const TenantDrawer = ({
  tenant,
  open,
  onClose,
  onExtendTrial,
  onToggleActive,
  onChangePlan,
}: TenantDrawerProps) => {
  const navigate = useNavigate();
  const [overrideState, setOverrideState] = useState<OverrideFormState>(
    createEmptyFormState(),
  );
  const [loadingOverrides, setLoadingOverrides] = useState(false);
  const [savingOverrides, setSavingOverrides] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "governance">(
    "overview",
  );

  const loadOverrides = useCallback(async () => {
    if (!tenant?.tenant_id) return;
    setLoadingOverrides(true);

    const { data, error } = await supabase.rpc(
      "admin_get_tenant_email_governance_overrides" as never,
      {
        p_tenant_id: tenant.tenant_id,
      } as never,
    );

    setLoadingOverrides(false);

    if (error) {
      toast.error(
        error.message || "Failed to load tenant governance overrides",
      );
      return;
    }

    setOverrideState(
      formStateFromOverrides((data || {}) as Record<string, unknown>),
    );
  }, [tenant?.tenant_id]);

  useEffect(() => {
    if (!open || !tenant?.tenant_id) return;
    void loadOverrides();
  }, [open, tenant?.tenant_id, loadOverrides]);

  useEffect(() => {
    if (open) {
      setActiveTab("overview");
    }
  }, [open, tenant?.tenant_id]);

  if (!tenant) return null;

  const formatLocation = (city: string, region: string, country: string) => {
    const parts = [city, region, country].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : "Not specified";
  };

  const getStatusBadge = () => {
    if (!tenant.is_active) {
      return <JoyStatusChip status="inactive" />;
    }
    if (tenant.is_trialing) {
      return <JoyStatusChip label="Trialing" status="trialing" />;
    }
    if (tenant.is_paid_active) {
      return <JoyStatusChip status="active" />;
    }
    return <JoyStatusChip status="expired" />;
  };

  const toggleField = (key: keyof OverrideFormState, enabled: boolean) => {
    setOverrideState((prev) => ({
      ...prev,
      [key]: {
        enabled,
        value: enabled ? prev[key].value : "",
      },
    }));
  };

  const updateField = (key: keyof OverrideFormState, value: string) => {
    setOverrideState((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        value,
      },
    }));
  };

  const saveOverrides = async () => {
    try {
      const overrides: Record<string, unknown> = {};
      const hardStopThresholds: Record<string, number> = {};
      const reputationTiers: Record<string, unknown> = {};
      const throttledTier: Record<string, number> = {};
      const restrictedTier: Record<string, number> = {};
      const criticalTier: Record<string, number> = {};

      if (overrideState.hardBounceRate.enabled) {
        hardStopThresholds.hard_bounce_rate =
          parseRequiredNumber(
            overrideState.hardBounceRate.value,
            "Hard bounce threshold",
          ) / 100;
      }
      if (overrideState.complaintRate.enabled) {
        hardStopThresholds.complaint_rate =
          parseRequiredNumber(
            overrideState.complaintRate.value,
            "Complaint threshold",
          ) / 100;
      }
      if (overrideState.spamRate.enabled) {
        hardStopThresholds.spam_rate =
          parseRequiredNumber(overrideState.spamRate.value, "Spam threshold") /
          100;
      }

      if (overrideState.healthyMin.enabled) {
        reputationTiers.healthy_min = parseRequiredNumber(
          overrideState.healthyMin.value,
          "Healthy min score",
        );
      }
      if (overrideState.warningMin.enabled) {
        reputationTiers.warning_min = parseRequiredNumber(
          overrideState.warningMin.value,
          "Warning min score",
        );
      }
      if (overrideState.riskMin.enabled) {
        reputationTiers.risk_min = parseRequiredNumber(
          overrideState.riskMin.value,
          "Risk min score",
        );
      }

      if (overrideState.throttledRecipientCap.enabled) {
        throttledTier.recipient_cap = parseRequiredNumber(
          overrideState.throttledRecipientCap.value,
          "Throttled recipient cap",
        );
      }
      if (overrideState.throttledJobBatchSize.enabled) {
        throttledTier.job_batch_size = parseRequiredNumber(
          overrideState.throttledJobBatchSize.value,
          "Throttled job batch size",
        );
      }
      if (overrideState.throttledPacingMultiplier.enabled) {
        throttledTier.send_pacing_multiplier = parseRequiredNumber(
          overrideState.throttledPacingMultiplier.value,
          "Throttled pacing multiplier",
        );
      }

      if (overrideState.restrictedRecipientCap.enabled) {
        restrictedTier.recipient_cap = parseRequiredNumber(
          overrideState.restrictedRecipientCap.value,
          "Restricted recipient cap",
        );
      }
      if (overrideState.restrictedJobBatchSize.enabled) {
        restrictedTier.job_batch_size = parseRequiredNumber(
          overrideState.restrictedJobBatchSize.value,
          "Restricted job batch size",
        );
      }
      if (overrideState.restrictedPacingMultiplier.enabled) {
        restrictedTier.send_pacing_multiplier = parseRequiredNumber(
          overrideState.restrictedPacingMultiplier.value,
          "Restricted pacing multiplier",
        );
      }

      if (overrideState.criticalRecipientCap.enabled) {
        criticalTier.recipient_cap = parseRequiredNumber(
          overrideState.criticalRecipientCap.value,
          "Critical recipient cap",
        );
      }
      if (overrideState.criticalJobBatchSize.enabled) {
        criticalTier.job_batch_size = parseRequiredNumber(
          overrideState.criticalJobBatchSize.value,
          "Critical job batch size",
        );
      }
      if (overrideState.criticalPacingMultiplier.enabled) {
        criticalTier.send_pacing_multiplier = parseRequiredNumber(
          overrideState.criticalPacingMultiplier.value,
          "Critical pacing multiplier",
        );
      }

      if (Object.keys(hardStopThresholds).length > 0) {
        overrides.hard_stop_thresholds = hardStopThresholds;
      }

      if (Object.keys(throttledTier).length > 0) {
        reputationTiers.throttled = throttledTier;
      }
      if (Object.keys(restrictedTier).length > 0) {
        reputationTiers.restricted = restrictedTier;
      }
      if (Object.keys(criticalTier).length > 0) {
        reputationTiers.critical = criticalTier;
      }
      if (Object.keys(reputationTiers).length > 0) {
        overrides.reputation_tiers = reputationTiers;
      }

      if (overrideState.batchMaxSize.enabled) {
        overrides.batch = {
          max_batch_size: parseRequiredNumber(
            overrideState.batchMaxSize.value,
            "Batch max size",
          ),
        };
      }

      setSavingOverrides(true);
      const { error } = await supabase.rpc(
        "admin_set_tenant_email_governance_overrides" as never,
        {
          p_tenant_id: tenant.tenant_id,
          p_overrides: overrides,
          p_reason: "admin_tenant_override_form_update",
        } as never,
      );
      setSavingOverrides(false);

      if (error) {
        toast.error(
          error.message || "Failed to save tenant governance overrides",
        );
        return;
      }

      toast.success("Tenant governance overrides saved");
      await loadOverrides();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Invalid override value";
      toast.error(message);
    }
  };

  const clearOverrides = async () => {
    setSavingOverrides(true);
    const { error } = await supabase.rpc(
      "admin_set_tenant_email_governance_overrides" as never,
      {
        p_tenant_id: tenant.tenant_id,
        p_overrides: {},
        p_reason: "admin_tenant_override_clear",
      } as never,
    );
    setSavingOverrides(false);

    if (error) {
      toast.error(
        error.message || "Failed to clear tenant governance overrides",
      );
      return;
    }

    setOverrideState(createEmptyFormState());
    toast.success("Tenant governance overrides cleared");
  };

  const renderOverrideField = (
    label: string,
    stateKey: keyof OverrideFormState,
    placeholder: string,
    helperText = "Enable the override to apply a tenant-specific value instead of the global governance default.",
  ) => {
    const field = overrideState[stateKey];
    return (
      <Stack spacing={1.25}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          spacing={1}
        >
          <Typography level="body-xs" color="neutral">
            Use a tenant-specific override
          </Typography>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography level="body-xs" color="neutral">
              {field.enabled ? "Enabled" : "Disabled"}
            </Typography>
            <JoySwitch
              checked={field.enabled}
              onCheckedChange={(checked) => toggleField(stateKey, checked)}
            />
          </Stack>
        </Stack>
        <Input
          label={label}
          helperText={helperText}
          value={field.value}
          onValueChange={(value) => updateField(stateKey, value)}
          placeholder={placeholder}
          type="number"
          step="any"
          disabled={!field.enabled || savingOverrides || loadingOverrides}
        />
      </Stack>
    );
  };

  return (
    <JoyDrawer
      open={open}
      onClose={() => onClose()}
      size="md"
      title={tenant.company_name || "Unnamed Company"}
      startDecorator={<Building2 className="h-5 w-5" />}
    >
      <Stack spacing={3}>
        <JoyCard>
          <JoyCardHeader title="Status & Actions" actions={getStatusBadge()} />
          <JoyCardContent>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              {tenant.is_trialing ? (
                <JoyButton
                  bloomVariant="outline"
                  size="sm"
                  onClick={() => onExtendTrial(tenant.tenant_id, 7)}
                  startDecorator={<Clock className="h-4 w-4" />}
                >
                  Extend Trial (+7 days)
                </JoyButton>
              ) : null}
              {onChangePlan ? (
                <JoyButton
                  bloomVariant="outline"
                  size="sm"
                  onClick={() => onChangePlan(tenant)}
                  startDecorator={<CreditCard className="h-4 w-4" />}
                >
                  Change Plan
                </JoyButton>
              ) : null}
              <JoyButton
                bloomVariant="outline"
                size="sm"
                onClick={() => {
                  onClose();
                  navigate(`/admin/tenants/${tenant.tenant_id}/email`);
                }}
                startDecorator={<Globe className="h-4 w-4" />}
              >
                Email Management
              </JoyButton>
              <JoyButton
                bloomVariant={tenant.is_active ? "destructive" : "default"}
                size="sm"
                onClick={() =>
                  onToggleActive(tenant.tenant_id, !tenant.is_active)
                }
              >
                {tenant.is_active ? "Deactivate Tenant" : "Activate Tenant"}
              </JoyButton>
            </Stack>
          </JoyCardContent>
        </JoyCard>

        <Tabs
          value={activeTab}
          onChange={(_event, value) =>
            setActiveTab((value as "overview" | "governance") ?? "overview")
          }
        >
          <TabList
            sx={{
              borderRadius: "var(--joy-radius-lg)",
              backgroundColor: "neutral.50",
              p: 0.5,
              gap: 0.5,
            }}
          >
            <Tab disableIndicator value="overview">
              Overview
            </Tab>
            <Tab disableIndicator value="governance">
              Governance
            </Tab>
          </TabList>

          <TabPanel value="overview" sx={{ px: 0, pt: 2.5 }}>
            <Stack spacing={3}>
              <JoyCard>
                <JoyCardHeader title="Company Information" />
                <JoyCardContent>
                  <Stack spacing={2}>
                    {tenant.website ? (
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <Stack spacing={0.5}>
                          <Typography level="body-sm" fontWeight="lg">
                            Website
                          </Typography>
                          <Typography
                            component="a"
                            level="body-sm"
                            href={`https://${tenant.website.replace(/https?:\/\//, "")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 0.5,
                              color: "primary.600",
                              textDecoration: "none",
                              "&:hover": {
                                color: "primary.700",
                                textDecoration: "underline",
                              },
                            }}
                          >
                            {tenant.website}
                            <ExternalLink className="h-3 w-3" />
                          </Typography>
                        </Stack>
                      </Stack>
                    ) : null}

                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <Stack spacing={0.5}>
                        <Typography level="body-sm" fontWeight="lg">
                          Location
                        </Typography>
                        <Typography level="body-sm" color="neutral">
                          {formatLocation(
                            tenant.city,
                            tenant.region,
                            tenant.country,
                          )}
                        </Typography>
                      </Stack>
                    </Stack>

                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <Stack spacing={0.5}>
                        <Typography level="body-sm" fontWeight="lg">
                          Created
                        </Typography>
                        <Typography level="body-sm" color="neutral">
                          {format(new Date(tenant.tenant_created_at), "PPP")}
                        </Typography>
                      </Stack>
                    </Stack>

                    {tenant.onboarding_completed_at ? (
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <Stack spacing={0.5}>
                          <Typography level="body-sm" fontWeight="lg">
                            Onboarding Completed
                          </Typography>
                          <Typography level="body-sm" color="neutral">
                            {format(
                              new Date(tenant.onboarding_completed_at),
                              "PPP",
                            )}
                          </Typography>
                        </Stack>
                      </Stack>
                    ) : null}
                  </Stack>
                </JoyCardContent>
              </JoyCard>

              <JoyCard>
                <JoyCardHeader title="Primary Contact" />
                <JoyCardContent>
                  <Stack spacing={2}>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <Stack spacing={0.5}>
                        <Typography level="body-sm" fontWeight="lg">
                          Name
                        </Typography>
                        <Typography level="body-sm" color="neutral">
                          {tenant.primary_contact_name || "Not specified"}
                        </Typography>
                      </Stack>
                    </Stack>

                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <Stack spacing={0.5}>
                        <Typography level="body-sm" fontWeight="lg">
                          Email
                        </Typography>
                        <Typography
                          component="a"
                          level="body-sm"
                          href={`mailto:${tenant.primary_contact_email}`}
                          sx={{
                            color: "primary.600",
                            textDecoration: "none",
                            "&:hover": {
                              color: "primary.700",
                              textDecoration: "underline",
                            },
                          }}
                        >
                          {tenant.primary_contact_email}
                        </Typography>
                      </Stack>
                    </Stack>

                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <Stack spacing={0.5}>
                        <Typography level="body-sm" fontWeight="lg">
                          Last Login
                        </Typography>
                        <Typography level="body-sm" color="neutral">
                          {tenant.primary_contact_last_login
                            ? format(
                                new Date(tenant.primary_contact_last_login),
                                "PPP",
                              )
                            : "Never"}
                        </Typography>
                      </Stack>
                    </Stack>

                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <Stack spacing={0.5}>
                        <Typography level="body-sm" fontWeight="lg">
                          Last Activity
                        </Typography>
                        <Typography level="body-sm" color="neutral">
                          {tenant.last_activity_at &&
                          new Date(tenant.last_activity_at).getFullYear() >=
                            2000
                            ? `${formatDistanceToNow(new Date(tenant.last_activity_at))} ago`
                            : "Never"}
                        </Typography>
                      </Stack>
                    </Stack>
                  </Stack>
                </JoyCardContent>
              </JoyCard>

              <JoyCard>
                <JoyCardHeader title="Subscription Details" />
                <JoyCardContent>
                  <Stack spacing={2}>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                      <Stack spacing={0.5}>
                        <Typography level="body-sm" fontWeight="lg">
                          Plan
                        </Typography>
                        <Typography
                          level="body-sm"
                          color="neutral"
                          textTransform="capitalize"
                        >
                          {tenant.plan}
                        </Typography>
                      </Stack>
                    </Stack>

                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <Stack spacing={0.5}>
                        <Typography level="body-sm" fontWeight="lg">
                          Status
                        </Typography>
                        <Typography
                          level="body-sm"
                          color="neutral"
                          textTransform="capitalize"
                        >
                          {tenant.subscription_status}
                        </Typography>
                      </Stack>
                    </Stack>

                    {tenant.trial_start ? (
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <Stack spacing={0.5}>
                          <Typography level="body-sm" fontWeight="lg">
                            Trial Started
                          </Typography>
                          <Typography level="body-sm" color="neutral">
                            {format(new Date(tenant.trial_start), "PPP")}
                          </Typography>
                        </Stack>
                      </Stack>
                    ) : null}

                    {tenant.trial_end ? (
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <Stack spacing={0.5}>
                          <Typography level="body-sm" fontWeight="lg">
                            {tenant.is_trialing ? "Trial Ends" : "Trial Ended"}
                          </Typography>
                          <Typography level="body-sm" color="neutral">
                            {format(new Date(tenant.trial_end), "PPP")}
                          </Typography>
                        </Stack>
                      </Stack>
                    ) : null}

                    {tenant.current_period_end ? (
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <Stack spacing={0.5}>
                          <Typography level="body-sm" fontWeight="lg">
                            Current Period End
                          </Typography>
                          <Typography level="body-sm" color="neutral">
                            {format(new Date(tenant.current_period_end), "PPP")}
                          </Typography>
                        </Stack>
                      </Stack>
                    ) : null}
                  </Stack>
                </JoyCardContent>
              </JoyCard>
            </Stack>
          </TabPanel>

          <TabPanel value="governance" sx={{ px: 0, pt: 2.5 }}>
            <JoyFormSection
              title="Governance Overrides"
              description="Optional per-tenant overrides. Disabled fields automatically use global governance configuration."
              actions={
                <>
                  <JoyButton
                    bloomVariant="default"
                    size="sm"
                    onClick={saveOverrides}
                    disabled={savingOverrides || loadingOverrides}
                    loading={savingOverrides}
                    loadingPosition="start"
                    startDecorator={<Save className="h-4 w-4" />}
                  >
                    {savingOverrides ? "Saving..." : "Save Overrides"}
                  </JoyButton>
                  <JoyButton
                    bloomVariant="outline"
                    size="sm"
                    onClick={clearOverrides}
                    disabled={savingOverrides || loadingOverrides}
                    startDecorator={<RotateCcw className="h-4 w-4" />}
                  >
                    Clear Overrides
                  </JoyButton>
                </>
              }
            >
              <Stack spacing={3}>
                <Grid container spacing={2}>
                  <Grid xs={12} md={4}>
                    {renderOverrideField(
                      "Hard Bounce Threshold (%)",
                      "hardBounceRate",
                      "5",
                    )}
                  </Grid>
                  <Grid xs={12} md={4}>
                    {renderOverrideField(
                      "Complaint Threshold (%)",
                      "complaintRate",
                      "0.2",
                    )}
                  </Grid>
                  <Grid xs={12} md={4}>
                    {renderOverrideField(
                      "Spam Threshold (%)",
                      "spamRate",
                      "0.3",
                    )}
                  </Grid>
                </Grid>

                <Divider />

                <Grid container spacing={2}>
                  <Grid xs={12} md={4}>
                    {renderOverrideField(
                      "Healthy Min Score",
                      "healthyMin",
                      "90",
                    )}
                  </Grid>
                  <Grid xs={12} md={4}>
                    {renderOverrideField(
                      "Warning Min Score",
                      "warningMin",
                      "75",
                    )}
                  </Grid>
                  <Grid xs={12} md={4}>
                    {renderOverrideField("Risk Min Score", "riskMin", "60")}
                  </Grid>
                </Grid>

                <Grid container spacing={2}>
                  <Grid xs={12} md={4}>
                    {renderOverrideField(
                      "Throttled Recipient Cap",
                      "throttledRecipientCap",
                      "10000",
                    )}
                  </Grid>
                  <Grid xs={12} md={4}>
                    {renderOverrideField(
                      "Throttled Job Batch Size",
                      "throttledJobBatchSize",
                      "25",
                    )}
                  </Grid>
                  <Grid xs={12} md={4}>
                    {renderOverrideField(
                      "Throttled Pacing Multiplier",
                      "throttledPacingMultiplier",
                      "2",
                    )}
                  </Grid>
                </Grid>

                <Grid container spacing={2}>
                  <Grid xs={12} md={4}>
                    {renderOverrideField(
                      "Restricted Recipient Cap",
                      "restrictedRecipientCap",
                      "2000",
                    )}
                  </Grid>
                  <Grid xs={12} md={4}>
                    {renderOverrideField(
                      "Restricted Job Batch Size",
                      "restrictedJobBatchSize",
                      "10",
                    )}
                  </Grid>
                  <Grid xs={12} md={4}>
                    {renderOverrideField(
                      "Restricted Pacing Multiplier",
                      "restrictedPacingMultiplier",
                      "4",
                    )}
                  </Grid>
                </Grid>

                <Grid container spacing={2}>
                  <Grid xs={12} md={4}>
                    {renderOverrideField(
                      "Critical Recipient Cap",
                      "criticalRecipientCap",
                      "0",
                    )}
                  </Grid>
                  <Grid xs={12} md={4}>
                    {renderOverrideField(
                      "Critical Job Batch Size",
                      "criticalJobBatchSize",
                      "10",
                    )}
                  </Grid>
                  <Grid xs={12} md={4}>
                    {renderOverrideField(
                      "Critical Pacing Multiplier",
                      "criticalPacingMultiplier",
                      "4",
                    )}
                  </Grid>
                </Grid>

                <Divider />

                <Grid container spacing={2}>
                  <Grid xs={12} md={4}>
                    {renderOverrideField(
                      "Batch Max Size",
                      "batchMaxSize",
                      "5000",
                      "Maximum recipients per send batch before pacing pauses are applied.",
                    )}
                  </Grid>
                </Grid>
              </Stack>
            </JoyFormSection>
          </TabPanel>
        </Tabs>
      </Stack>
    </JoyDrawer>
  );
};
