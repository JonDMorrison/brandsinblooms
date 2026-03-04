import { useCallback, useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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
}

interface TenantDrawerProps {
  tenant: AdminTenant | null;
  open: boolean;
  onClose: () => void;
  onExtendTrial: (tenantId: string, days: number) => void;
  onToggleActive: (tenantId: string, active: boolean) => void;
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
}: TenantDrawerProps) => {
  const navigate = useNavigate();
  const [overrideState, setOverrideState] = useState<OverrideFormState>(
    createEmptyFormState(),
  );
  const [loadingOverrides, setLoadingOverrides] = useState(false);
  const [savingOverrides, setSavingOverrides] = useState(false);

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

  if (!tenant) return null;

  const formatLocation = (city: string, region: string, country: string) => {
    const parts = [city, region, country].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : "Not specified";
  };

  const getStatusBadge = () => {
    if (!tenant.is_active) {
      return <Badge variant="secondary">Inactive</Badge>;
    }
    if (tenant.is_trialing) {
      return (
        <Badge variant="outline" className="border-yellow-500 text-yellow-700">
          Trialing
        </Badge>
      );
    }
    if (tenant.is_paid_active) {
      return (
        <Badge variant="default" className="bg-green-500">
          Active
        </Badge>
      );
    }
    return <Badge variant="destructive">Expired</Badge>;
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
  ) => {
    const field = overrideState[stateKey];
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label>{label}</Label>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Override</Label>
            <Switch
              checked={field.enabled}
              onCheckedChange={(checked) => toggleField(stateKey, checked)}
            />
          </div>
        </div>
        <Input
          value={field.value}
          onChange={(event) => updateField(stateKey, event.target.value)}
          placeholder={placeholder}
          type="number"
          step="any"
          disabled={!field.enabled || savingOverrides || loadingOverrides}
        />
      </div>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="pb-6">
          <SheetTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {tenant.company_name || "Unnamed Company"}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-6">
          {/* Status and Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Status & Actions</span>
                {getStatusBadge()}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {tenant.is_trialing && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onExtendTrial(tenant.tenant_id, 7)}
                  >
                    <Clock className="mr-2 h-4 w-4" />
                    Extend Trial (+7 days)
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onClose();
                    navigate(`/admin/tenants/${tenant.tenant_id}/email`);
                  }}
                >
                  <Globe className="mr-2 h-4 w-4" />
                  Manage Domains
                </Button>
                <Button
                  variant={tenant.is_active ? "destructive" : "default"}
                  size="sm"
                  onClick={() =>
                    onToggleActive(tenant.tenant_id, !tenant.is_active)
                  }
                >
                  {tenant.is_active ? "Deactivate Tenant" : "Activate Tenant"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Company Information */}
          <Card>
            <CardHeader>
              <CardTitle>Company Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                {tenant.website && (
                  <div className="flex items-center gap-3">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Website</p>
                      <a
                        href={`https://${tenant.website.replace(/https?:\/\//, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline flex items-center gap-1"
                      >
                        {tenant.website}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Location</p>
                    <p className="text-sm text-muted-foreground">
                      {formatLocation(
                        tenant.city,
                        tenant.region,
                        tenant.country,
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Created</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(tenant.tenant_created_at), "PPP")}
                    </p>
                  </div>
                </div>

                {tenant.onboarding_completed_at && (
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">
                        Onboarding Completed
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {format(
                          new Date(tenant.onboarding_completed_at),
                          "PPP",
                        )}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Governance Overrides</CardTitle>
              <p className="text-sm text-muted-foreground">
                Optional per-tenant overrides. Disabled fields automatically use
                global governance configuration.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {renderOverrideField(
                  "Hard Bounce Threshold (%)",
                  "hardBounceRate",
                  "5",
                )}
                {renderOverrideField(
                  "Complaint Threshold (%)",
                  "complaintRate",
                  "0.2",
                )}
                {renderOverrideField("Spam Threshold (%)", "spamRate", "0.3")}
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {renderOverrideField("Healthy Min Score", "healthyMin", "90")}
                {renderOverrideField("Warning Min Score", "warningMin", "75")}
                {renderOverrideField("Risk Min Score", "riskMin", "60")}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {renderOverrideField(
                  "Throttled Recipient Cap",
                  "throttledRecipientCap",
                  "10000",
                )}
                {renderOverrideField(
                  "Throttled Job Batch Size",
                  "throttledJobBatchSize",
                  "25",
                )}
                {renderOverrideField(
                  "Throttled Pacing Multiplier",
                  "throttledPacingMultiplier",
                  "2",
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {renderOverrideField(
                  "Restricted Recipient Cap",
                  "restrictedRecipientCap",
                  "2000",
                )}
                {renderOverrideField(
                  "Restricted Job Batch Size",
                  "restrictedJobBatchSize",
                  "10",
                )}
                {renderOverrideField(
                  "Restricted Pacing Multiplier",
                  "restrictedPacingMultiplier",
                  "4",
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {renderOverrideField(
                  "Critical Recipient Cap",
                  "criticalRecipientCap",
                  "0",
                )}
                {renderOverrideField(
                  "Critical Job Batch Size",
                  "criticalJobBatchSize",
                  "10",
                )}
                {renderOverrideField(
                  "Critical Pacing Multiplier",
                  "criticalPacingMultiplier",
                  "4",
                )}
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {renderOverrideField("Batch Max Size", "batchMaxSize", "5000")}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={saveOverrides}
                  disabled={savingOverrides || loadingOverrides}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {savingOverrides ? "Saving..." : "Save Overrides"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearOverrides}
                  disabled={savingOverrides || loadingOverrides}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Clear Overrides
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Primary Contact */}
          <Card>
            <CardHeader>
              <CardTitle>Primary Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Name</p>
                  <p className="text-sm text-muted-foreground">
                    {tenant.primary_contact_name || "Not specified"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Email</p>
                  <a
                    href={`mailto:${tenant.primary_contact_email}`}
                    className="text-sm text-primary hover:underline"
                  >
                    {tenant.primary_contact_email}
                  </a>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Last Login</p>
                  <p className="text-sm text-muted-foreground">
                    {tenant.primary_contact_last_login
                      ? format(
                          new Date(tenant.primary_contact_last_login),
                          "PPP",
                        )
                      : "Never"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Last Activity</p>
                  <p className="text-sm text-muted-foreground">
                    {tenant.last_activity_at
                      ? formatDistanceToNow(new Date(tenant.last_activity_at)) +
                        " ago"
                      : "Never"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Subscription Details */}
          <Card>
            <CardHeader>
              <CardTitle>Subscription Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Plan</p>
                  <p className="text-sm text-muted-foreground capitalize">
                    {tenant.plan}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Status</p>
                  <p className="text-sm text-muted-foreground capitalize">
                    {tenant.subscription_status}
                  </p>
                </div>
              </div>

              {tenant.trial_start && (
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Trial Started</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(tenant.trial_start), "PPP")}
                    </p>
                  </div>
                </div>
              )}

              {tenant.trial_end && (
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">
                      {tenant.is_trialing ? "Trial Ends" : "Trial Ended"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(tenant.trial_end), "PPP")}
                      {tenant.trial_not_expired && (
                        <span className="text-yellow-600 ml-2">
                          ({formatDistanceToNow(new Date(tenant.trial_end))}{" "}
                          remaining)
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              )}

              {tenant.current_period_end && (
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Current Period Ends</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(tenant.current_period_end), "PPP")}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
};
