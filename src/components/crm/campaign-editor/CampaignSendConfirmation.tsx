import * as React from "react";
import Box from "@mui/joy/Box";
import Checkbox from "@mui/joy/Checkbox";
import CircularProgress from "@mui/joy/CircularProgress";
import DialogActions from "@mui/joy/DialogActions";
import DialogContent from "@mui/joy/DialogContent";
import DialogTitle from "@mui/joy/DialogTitle";
import Divider from "@mui/joy/Divider";
import Modal from "@mui/joy/Modal";
import ModalClose from "@mui/joy/ModalClose";
import ModalDialog from "@mui/joy/ModalDialog";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Lock, Send, ShieldCheck } from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";
import { useCampaignEditor } from "@/components/crm/campaign-editor/CampaignEditorContext";
import { useEmailDomains } from "@/hooks/useEmailDomains";
import { useTenantEmailHealthDashboard } from "@/hooks/useTenantEmailHealthDashboard";
import { useTenant } from "@/hooks/useTenant";
import {
  isUuidLike,
  resolveAudienceRecipientIds,
} from "@/lib/computeAudienceRecipientCount";
import { supabase } from "@/integrations/supabase/client";

const PAGE_SIZE = 1000;
const ACTIVE_EMAIL_SUPPRESSION_TYPES = [
  "unsubscribed",
  "bounced",
  "complaint",
  "blocked",
  "global_block",
  "complained",
  "hard_bounce",
] as const;
const TENANT_SUPPRESSION_BYPASS_TYPES = [
  "bounced",
  "hard_bounce",
  "complaint",
  "complained",
] as const;
const FORCE_SEND_SOFT_SUPPRESSION_TYPES = ["bounced", "inactive"] as const;
const HARD_SUPPRESSION_TYPES = new Set([
  "unsubscribed",
  "complaint",
  "complained",
  "hard_bounce",
  "blocked",
  "global_block",
]);
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type AudienceCustomerRow = {
  id: string;
  email: string | null;
  email_opt_in: boolean | null;
};

type AudiencePreflightSummary = {
  filteredRecipientCount: number;
  overrideRecipientCount: number;
  consentExcludedCount: number;
  suppressionExcludedCount: number;
  suppressionBypassRecipientCount: number;
  hardSuppressionExcludedCount: number;
};

type AcknowledgedWarning = {
  id: string;
  label: string;
  detail?: string | null;
  warning?: string | null;
};

function chunkIds(ids: string[], size = 100) {
  const chunks: string[][] = [];
  for (let index = 0; index < ids.length; index += size) {
    chunks.push(ids.slice(index, index + size));
  }
  return chunks;
}

function normalizeEmail(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function hasBlockingSuppression(
  suppressionTypes: string[],
  bypassTypes: Set<string>,
) {
  return suppressionTypes.some((suppressionType) => !bypassTypes.has(suppressionType));
}

async function fetchAudienceCustomers(params: {
  tenantId: string;
  includeAllCustomers: boolean;
  additionalCustomerIds: string[];
  segmentIds: string[];
  personaIds: string[];
}) {
  const {
    tenantId,
    includeAllCustomers,
    additionalCustomerIds,
    segmentIds,
    personaIds,
  } = params;

  const usesFullTenantAudience =
    includeAllCustomers ||
    (segmentIds.length === 0 &&
      personaIds.length === 0 &&
      additionalCustomerIds.filter(isUuidLike).length === 0);

  if (usesFullTenantAudience) {
    const customers: AudienceCustomerRow[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const to = from + PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from("crm_customers")
        .select("id, email, email_opt_in")
        .eq("tenant_id", tenantId)
        .not("email", "is", null)
        .range(from, to);

      if (error) {
        throw error;
      }

      customers.push(...((data ?? []) as AudienceCustomerRow[]));
      if (!data || data.length < PAGE_SIZE) {
        break;
      }
    }

    return customers;
  }

  const allowedCustomerIds = await resolveAudienceRecipientIds({
    tenantId,
    includeAllCustomers,
    additionalCustomerIds,
    fallbackToAllCustomers: false,
    segmentIds,
    personaIds,
  });

  if (allowedCustomerIds.length === 0) {
    return [] as AudienceCustomerRow[];
  }

  const customers: AudienceCustomerRow[] = [];
  for (const chunk of chunkIds(allowedCustomerIds)) {
    const { data, error } = await supabase
      .from("crm_customers")
      .select("id, email, email_opt_in")
      .eq("tenant_id", tenantId)
      .in("id", chunk)
      .not("email", "is", null);

    if (error) {
      throw error;
    }

    customers.push(...((data ?? []) as AudienceCustomerRow[]));
  }

  return customers;
}

async function fetchTenantSuppressionBypassTypes(tenantId: string) {
  const { data, error } = await supabase.rpc(
    "get_tenant_suppression_bypass_state",
    {
      p_tenant_id: tenantId,
    },
  );

  if (error) {
    return [] as string[];
  }

  const row = Array.isArray(data) ? data[0] : data;
  const record =
    row && typeof row === "object"
      ? (row as Record<string, unknown>)
      : {};

  return record.suppression_bypass_active === true
    ? [...TENANT_SUPPRESSION_BYPASS_TYPES]
    : [];
}

async function fetchAudienceSuppressionMap(tenantId: string, emails: string[]) {
  const suppressionMap = new Map<string, string[]>();

  if (emails.length === 0) {
    return suppressionMap;
  }

  const nowIso = new Date().toISOString();

  for (const chunk of chunkIds(emails)) {
    const { data, error } = await supabase
      .from("suppression_list")
      .select("email, suppression_type, expires_at")
      .eq("tenant_id", tenantId)
      .in("channel", ["email", "all"])
      .is("lifted_at", null)
      .in("suppression_type", [...ACTIVE_EMAIL_SUPPRESSION_TYPES])
      .in("email", chunk);

    if (error) {
      throw error;
    }

    for (const row of data ?? []) {
      if (row.expires_at && row.expires_at <= nowIso) {
        continue;
      }

      const normalizedEmail = normalizeEmail(row.email);
      if (!normalizedEmail) {
        continue;
      }

      const current = suppressionMap.get(normalizedEmail) ?? [];
      current.push(String(row.suppression_type).toLowerCase());
      suppressionMap.set(normalizedEmail, current);
    }
  }

  return suppressionMap;
}

async function fetchAudiencePreflightSummary(params: {
  tenantId: string;
  includeAllCustomers: boolean;
  additionalCustomerIds: string[];
  segmentIds: string[];
  personaIds: string[];
}) {
  const audienceCustomers = await fetchAudienceCustomers({
    tenantId: params.tenantId,
    includeAllCustomers: params.includeAllCustomers,
    additionalCustomerIds: params.additionalCustomerIds,
    segmentIds: params.segmentIds,
    personaIds: params.personaIds,
  });

  const baselineBypassTypes = new Set(
    await fetchTenantSuppressionBypassTypes(params.tenantId),
  );
  const overrideBypassTypes = new Set([
    ...baselineBypassTypes,
    ...FORCE_SEND_SOFT_SUPPRESSION_TYPES,
  ]);

  const candidates = audienceCustomers
    .map((customer) => {
      const normalizedEmail = normalizeEmail(customer.email);
      return normalizedEmail &&
        !normalizedEmail.endsWith("@noemail.local") &&
        EMAIL_REGEX.test(normalizedEmail)
        ? {
            ...customer,
            normalizedEmail,
          }
        : null;
    })
    .filter(
      (
        customer,
      ): customer is AudienceCustomerRow & {
        normalizedEmail: string;
      } => customer !== null,
    );

  const suppressionMap = await fetchAudienceSuppressionMap(
    params.tenantId,
    Array.from(new Set(candidates.map((customer) => customer.normalizedEmail))),
  );

  let filteredRecipientCount = 0;
  let overrideRecipientCount = 0;
  let consentExcludedCount = 0;
  let suppressionExcludedCount = 0;
  let suppressionBypassRecipientCount = 0;
  let hardSuppressionExcludedCount = 0;

  for (const customer of candidates) {
    const suppressionTypes =
      suppressionMap.get(customer.normalizedEmail) ?? [];
    const blockedNormally = hasBlockingSuppression(
      suppressionTypes,
      baselineBypassTypes,
    );
    const blockedWithOverride = hasBlockingSuppression(
      suppressionTypes,
      overrideBypassTypes,
    );
    const isConsentExcluded = customer.email_opt_in === false;

    if (isConsentExcluded) {
      consentExcludedCount += 1;
    }

    if (blockedNormally) {
      suppressionExcludedCount += 1;
    }

    if (
      blockedWithOverride &&
      suppressionTypes.some((suppressionType) =>
        HARD_SUPPRESSION_TYPES.has(suppressionType),
      )
    ) {
      hardSuppressionExcludedCount += 1;
    }

    if (!isConsentExcluded && !blockedNormally) {
      filteredRecipientCount += 1;
    }

    if (!blockedWithOverride) {
      overrideRecipientCount += 1;
      if (!isConsentExcluded && blockedNormally) {
        suppressionBypassRecipientCount += 1;
      }
    }
  }

  return {
    filteredRecipientCount,
    overrideRecipientCount,
    consentExcludedCount,
    suppressionExcludedCount,
    suppressionBypassRecipientCount,
    hardSuppressionExcludedCount,
  } satisfies AudiencePreflightSummary;
}

function useAudiencePreflightSummary(options: {
  enabled: boolean;
  tenantId?: string | null;
  includeAllCustomers: boolean;
  additionalCustomerIds: string[];
  segmentIds: string[];
  personaIds: string[];
}) {
  return useQuery({
    queryKey: [
      "campaign-send-preflight-summary",
      options.tenantId,
      options.includeAllCustomers,
      options.additionalCustomerIds,
      options.segmentIds,
      options.personaIds,
    ],
    enabled: options.enabled && Boolean(options.tenantId),
    staleTime: 60000,
    queryFn: () =>
      fetchAudiencePreflightSummary({
        tenantId: options.tenantId as string,
        includeAllCustomers: options.includeAllCustomers,
        additionalCustomerIds: options.additionalCustomerIds,
        segmentIds: options.segmentIds,
        personaIds: options.personaIds,
      }),
  });
}

type ChecklistRow = {
  id: string;
  label: string;
  detail: string;
  loading?: boolean;
};

function ReadyRow({ row }: { row: ChecklistRow }) {
  return (
    <Stack direction="row" spacing={1.25} alignItems="flex-start">
      <Box
        sx={{ width: 20, pt: 0.25, display: "flex", justifyContent: "center" }}
      >
        {row.loading ? (
          <CircularProgress
            size="sm"
            sx={{ "--CircularProgress-size": "18px" }}
          />
        ) : (
          <CheckCircle2
            size={18}
            style={{ color: "var(--joy-palette-success-600)" }}
          />
        )}
      </Box>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={{ xs: 0.25, sm: 1 }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
        sx={{ width: "100%", minWidth: 0 }}
      >
        <Typography level="body-sm" fontWeight="lg">
          {row.label}
        </Typography>
        <Typography level="body-xs" sx={{ color: "neutral.500" }}>
          {row.detail}
        </Typography>
      </Stack>
    </Stack>
  );
}

type ProtectedRowProps = {
  id: string;
  message: string;
  variant?: "locked" | "info";
  loading?: boolean;
};

function ProtectedRow({ message, variant = "info", loading }: ProtectedRowProps) {
  const Icon = variant === "locked" ? Lock : ShieldCheck;
  return (
    <Stack direction="row" spacing={1.25} alignItems="flex-start">
      <Box
        sx={{ width: 20, pt: 0.25, display: "flex", justifyContent: "center" }}
      >
        {loading ? (
          <CircularProgress
            size="sm"
            sx={{ "--CircularProgress-size": "18px" }}
          />
        ) : (
          <Icon
            size={18}
            style={{ color: "var(--joy-palette-primary-500)" }}
          />
        )}
      </Box>
      <Typography level="body-sm" sx={{ color: "neutral.700", minWidth: 0 }}>
        {message}
      </Typography>
    </Stack>
  );
}

type ReviewExcludedDialogProps = {
  open: boolean;
  onClose: () => void;
  consentExcludedCount: number;
  softSuppressionRestorableCount: number;
  hardSuppressionExcludedCount: number;
  includeMissingConsent: boolean;
  includeSoftSuppressions: boolean;
  onChangeIncludeMissingConsent: (value: boolean) => void;
  onChangeIncludeSoftSuppressions: (value: boolean) => void;
  onConfirm: () => void;
};

function ReviewExcludedDialog({
  open,
  onClose,
  consentExcludedCount,
  softSuppressionRestorableCount,
  hardSuppressionExcludedCount,
  includeMissingConsent,
  includeSoftSuppressions,
  onChangeIncludeMissingConsent,
  onChangeIncludeSoftSuppressions,
  onConfirm,
}: ReviewExcludedDialogProps) {
  const [acknowledged, setAcknowledged] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setAcknowledged(false);
    }
  }, [open]);

  const hasSelection = includeMissingConsent || includeSoftSuppressions;
  const canInclude = hasSelection && acknowledged;

  return (
    <Modal open={open} onClose={onClose}>
      <ModalDialog
        variant="outlined"
        size="md"
        sx={{ width: "min(560px, calc(100vw - 2rem))", p: 0 }}
      >
        <ModalClose />
        <Box sx={{ px: 3, pt: 3, pb: 2 }}>
          <DialogTitle sx={{ p: 0, mb: 0.5 }}>
            Review Excluded Contacts
          </DialogTitle>
          <Typography level="body-sm" sx={{ color: "neutral.600" }}>
            Choose which protected contacts to include for this campaign send only.
          </Typography>
        </Box>

        <DialogContent sx={{ px: 3, py: 0 }}>
          <Stack spacing={2}>
            <Sheet
              variant="soft"
              color="warning"
              sx={{ borderRadius: "md", p: 1.5 }}
            >
              <Stack direction="row" spacing={1} alignItems="flex-start">
                <AlertTriangle
                  size={17}
                  style={{ flexShrink: 0, marginTop: 2 }}
                />
                <Typography level="body-sm">
                  Overrides only apply to this campaign send. Default protections
                  stay in place for future sends.
                </Typography>
              </Stack>
            </Sheet>

            <Sheet
              variant="outlined"
              sx={{ borderRadius: "md", p: 2, opacity: consentExcludedCount > 0 ? 1 : 0.6 }}
            >
              <Stack spacing={1}>
                <Checkbox
                  checked={includeMissingConsent && consentExcludedCount > 0}
                  disabled={consentExcludedCount === 0}
                  onChange={(event) =>
                    onChangeIncludeMissingConsent(Boolean(event.target.checked))
                  }
                  label={
                    <Typography level="title-sm" fontWeight="lg">
                      Missing consent · {consentExcludedCount.toLocaleString()} contacts
                    </Typography>
                  }
                />
                <Typography
                  level="body-xs"
                  sx={{ color: "neutral.600", pl: 4 }}
                >
                  These contacts don&apos;t have a recorded opt-in. Including them
                  may affect deliverability and compliance.
                </Typography>
              </Stack>
            </Sheet>

            <Sheet
              variant="outlined"
              sx={{
                borderRadius: "md",
                p: 2,
                opacity: softSuppressionRestorableCount > 0 ? 1 : 0.6,
              }}
            >
              <Stack spacing={1}>
                <Checkbox
                  checked={
                    includeSoftSuppressions && softSuppressionRestorableCount > 0
                  }
                  disabled={softSuppressionRestorableCount === 0}
                  onChange={(event) =>
                    onChangeIncludeSoftSuppressions(Boolean(event.target.checked))
                  }
                  label={
                    <Typography level="title-sm" fontWeight="lg">
                      Soft suppressions · {softSuppressionRestorableCount.toLocaleString()} contacts
                    </Typography>
                  }
                />
                <Typography
                  level="body-xs"
                  sx={{ color: "neutral.600", pl: 4 }}
                >
                  Temporarily suppressed by recent soft bounces or inactivity.
                  Re-engaging may slow this campaign while providers re-evaluate.
                </Typography>
              </Stack>
            </Sheet>

            <Sheet
              variant="soft"
              color="neutral"
              sx={{ borderRadius: "md", p: 2 }}
            >
              <Stack direction="row" spacing={1} alignItems="flex-start">
                <Lock
                  size={17}
                  style={{
                    flexShrink: 0,
                    marginTop: 2,
                    color: "var(--joy-palette-neutral-500)",
                  }}
                />
                <Stack spacing={0.5}>
                  <Typography level="title-sm" fontWeight="lg">
                    Hard suppressions · {hardSuppressionExcludedCount.toLocaleString()} contacts
                  </Typography>
                  <Typography level="body-xs" sx={{ color: "neutral.600" }}>
                    Unsubscribes, complaints, and hard bounces always stay blocked.
                    This protects your domain reputation and cannot be overridden.
                  </Typography>
                </Stack>
              </Stack>
            </Sheet>

            {hasSelection ? (
              <Checkbox
                checked={acknowledged}
                onChange={(event) =>
                  setAcknowledged(Boolean(event.target.checked))
                }
                label="I understand this override applies to this send only."
              />
            ) : null}
          </Stack>
        </DialogContent>

        <Divider sx={{ mt: 2 }} />
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              width: "100%",
              gap: 1.5,
            }}
          >
            <JoyButton variant="plain" color="neutral" onClick={onClose}>
              Cancel
            </JoyButton>
            <JoyButton
              variant="solid"
              color="warning"
              disabled={!canInclude}
              onClick={onConfirm}
            >
              Include Selected Contacts for This Send
            </JoyButton>
          </Box>
        </DialogActions>
      </ModalDialog>
    </Modal>
  );
}

export function CampaignSendConfirmation({
  open,
  onClose,
  builderWarnings = [],
  builderBlockers = [],
}: {
  open: boolean;
  onClose: () => void;
  builderWarnings?: string[];
  builderBlockers?: string[];
}) {
  const { tenant } = useTenant();
  const {
    audienceCount,
    sendImmediately,
    sendAt,
    senderName,
    senderEmail,
    replyTo,
    isSaving,
    activate,
    name,
    subjectLine,
    selectedSegments,
    selectedPersonas,
    includeAllCustomers,
    additionalCustomerIds,
  } = useCampaignEditor();
  const { emailDomains, loading: domainsLoading } = useEmailDomains();
  const healthQuery = useTenantEmailHealthDashboard(tenant?.id, {
    enabled: open,
  });
  const audienceSummaryQuery = useAudiencePreflightSummary({
    enabled: open,
    tenantId: tenant?.id,
    includeAllCustomers,
    additionalCustomerIds,
    segmentIds: selectedSegments.map((segment) => segment.id),
    personaIds: selectedPersonas.map((persona) => persona.id),
  });
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [inlineError, setInlineError] = React.useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = React.useState(false);
  const [includeMissingConsent, setIncludeMissingConsent] = React.useState(false);
  const [includeSoftSuppressions, setIncludeSoftSuppressions] =
    React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setInlineError(null);
      setIsSubmitting(false);
      setReviewOpen(false);
      setIncludeMissingConsent(false);
      setIncludeSoftSuppressions(false);
    }
  }, [open]);

  const filteredRecipientCount =
    audienceSummaryQuery.data?.filteredRecipientCount ?? audienceCount ?? 0;
  const overrideRecipientCount =
    audienceSummaryQuery.data?.overrideRecipientCount ?? filteredRecipientCount;
  const formattedRecipients = filteredRecipientCount.toLocaleString();
  const formattedOverrideRecipients = overrideRecipientCount.toLocaleString();
  const senderDomain = senderEmail.includes("@")
    ? senderEmail.split("@").pop()?.toLowerCase() || ""
    : "";
  const domainReady = emailDomains.some((domain) => {
    const defaultEmail = domain.default_from_email?.toLowerCase() || "";
    return (
      domain.status === "active" &&
      (domain.domain.toLowerCase() === senderDomain ||
        defaultEmail === senderEmail.toLowerCase())
    );
  });
  const reputationScore = healthQuery.data?.reputation_score ?? null;
  const suppressionTotal =
    audienceSummaryQuery.data?.suppressionExcludedCount ?? 0;
  const consentGap = audienceSummaryQuery.data?.consentExcludedCount ?? 0;
  const hardSuppressionExcludedCount =
    audienceSummaryQuery.data?.hardSuppressionExcludedCount ?? 0;
  const suppressionBypassRecipientCount =
    audienceSummaryQuery.data?.suppressionBypassRecipientCount ?? 0;

  const reputationDetail = healthQuery.isLoading
    ? "Checking health"
    : reputationScore === null
      ? "No score yet"
      : `${reputationScore}/100`;

  const readyRows = React.useMemo<ChecklistRow[]>(
    () => [
      {
        id: "domain",
        label: "Domain verified",
        detail: domainsLoading
          ? "Checking sender"
          : senderEmail || "No sender",
        loading: domainsLoading,
      },
      {
        id: "audience",
        label: "Audience ready",
        detail: audienceSummaryQuery.isLoading
          ? "Checking audience"
          : `${formattedRecipients} approved recipients`,
        loading: audienceSummaryQuery.isLoading,
      },
      {
        id: "reputation",
        label: "Reputation status",
        detail: reputationDetail,
        loading: healthQuery.isLoading,
      },
    ],
    [
      audienceSummaryQuery.isLoading,
      domainsLoading,
      formattedRecipients,
      healthQuery.isLoading,
      reputationDetail,
      senderEmail,
    ],
  );

  const hasBuilderWarnings = builderWarnings.length > 0;
  const hasBuilderBlockers = builderBlockers.length > 0;
  const hasProtectedExclusions =
    consentGap > 0 ||
    hardSuppressionExcludedCount > 0 ||
    suppressionBypassRecipientCount > 0;

  const overrideActive = includeMissingConsent || includeSoftSuppressions;
  const projectedRecipientCount = !overrideActive
    ? filteredRecipientCount
    : includeMissingConsent && includeSoftSuppressions
      ? overrideRecipientCount
      : filteredRecipientCount +
        (includeMissingConsent ? consentGap : 0) +
        (includeSoftSuppressions ? suppressionBypassRecipientCount : 0);
  const formattedProjectedRecipients = projectedRecipientCount.toLocaleString();

  const acknowledgedWarnings = React.useMemo<AcknowledgedWarning[]>(() => {
    const items: AcknowledgedWarning[] = [];
    if (includeMissingConsent) {
      items.push({
        id: "override-consent",
        label: "Override: missing consent",
        detail: `${consentGap.toLocaleString()} contacts without recorded consent`,
        warning:
          "User reviewed excluded contacts and chose to include missing-consent recipients for this send only.",
      });
    }
    if (includeSoftSuppressions) {
      items.push({
        id: "override-soft-suppressions",
        label: "Override: soft suppressions",
        detail: `${suppressionBypassRecipientCount.toLocaleString()} soft-suppressed contacts`,
        warning:
          "User reviewed excluded contacts and chose to include soft-suppressed recipients for this send only.",
      });
    }
    builderWarnings.forEach((warning, index) => {
      items.push({
        id: `builder-warning-${index + 1}`,
        label: "Content warning",
        detail: warning,
        warning,
      });
    });
    return items;
  }, [
    builderWarnings,
    consentGap,
    includeMissingConsent,
    includeSoftSuppressions,
    suppressionBypassRecipientCount,
  ]);

  const isBusy = isSaving || isSubmitting;
  const primaryActionLabel = !sendImmediately
    ? `Schedule for ${formattedProjectedRecipients} approved recipients`
    : overrideActive
      ? `Send to ${formattedProjectedRecipients} recipients (with override)`
      : `Send to ${formattedProjectedRecipients} approved recipients`;
  const primaryActionColor: "primary" | "warning" = overrideActive
    ? "warning"
    : "primary";
  const primaryActionDisabled =
    isBusy ||
    hasBuilderBlockers ||
    projectedRecipientCount === 0;

  const handleClose = React.useCallback(() => {
    if (!isBusy) {
      onClose();
    }
  }, [isBusy, onClose]);

  const handleSubmit = React.useCallback(async () => {
    if (primaryActionDisabled) {
      return;
    }

    setInlineError(null);
    setIsSubmitting(true);
    try {
      const result = await activate({
        suppressToasts: true,
        forceBypassConsent: includeMissingConsent,
        forceBypassSoftSuppression: includeSoftSuppressions,
        acknowledgedWarnings: overrideActive ? acknowledgedWarnings : undefined,
      });
      if (result.success) {
        onClose();
        return;
      }
      setInlineError(result.error.description || result.error.title);
    } catch (error) {
      setInlineError(
        error instanceof Error
          ? error.message
          : "The send request could not be accepted into the queue.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [
    acknowledgedWarnings,
    activate,
    includeMissingConsent,
    includeSoftSuppressions,
    onClose,
    overrideActive,
    primaryActionDisabled,
  ]);

  const handleConfirmReview = React.useCallback(() => {
    setReviewOpen(false);
  }, []);

  const showDomainWarning = !domainsLoading && !domainReady;

  return (
    <>
      <Modal open={open && !reviewOpen} onClose={handleClose}>
        <ModalDialog
          variant="outlined"
          size="md"
          sx={{ width: "min(640px, calc(100vw - 2rem))", p: 0 }}
        >
          {!isBusy ? <ModalClose /> : null}
          <Box sx={{ px: 3, pt: 3, pb: 2 }}>
            <DialogTitle sx={{ p: 0, mb: 0.5 }}>
              Ready to send {name || "this campaign"}
            </DialogTitle>
            <Typography level="body-sm" sx={{ color: "neutral.600" }}>
              {audienceSummaryQuery.isLoading
                ? "BloomSuite is checking your audience..."
                : `BloomSuite checked your campaign and found ${formattedRecipients} approved recipients.`}
            </Typography>
          </Box>

          <DialogContent sx={{ px: 3, py: 0 }}>
            <Stack spacing={2.25}>
              <Sheet
                variant="soft"
                color="neutral"
                sx={{ borderRadius: "md", p: 2 }}
              >
                <Stack spacing={1.25}>
                  <Box>
                    <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                      Campaign
                    </Typography>
                    <Typography level="title-sm" fontWeight="lg">
                      {name || "Untitled Campaign"}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                      Subject line
                    </Typography>
                    <Typography level="body-sm">
                      {subjectLine || "No subject line"}
                    </Typography>
                  </Box>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                        From
                      </Typography>
                      <Typography
                        level="body-sm"
                        sx={{ wordBreak: "break-word" }}
                      >
                        {senderName
                          ? `${senderName} <${senderEmail}>`
                          : senderEmail || "No sender"}
                      </Typography>
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                        Reply-to
                      </Typography>
                      <Typography
                        level="body-sm"
                        sx={{ wordBreak: "break-word" }}
                      >
                        {replyTo || senderEmail || "No reply-to"}
                      </Typography>
                    </Box>
                  </Stack>
                  <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                    {sendImmediately
                      ? "Delivery starts as soon as the queue is accepted."
                      : `Scheduled for ${sendAt?.toLocaleString() ?? "later"}.`}
                  </Typography>
                </Stack>
              </Sheet>

              <Stack spacing={1.25}>
                <Typography
                  level="body-xs"
                  fontWeight="lg"
                  sx={{
                    color: "neutral.500",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  Ready
                </Typography>
                <Stack spacing={1.25}>
                  {readyRows.map((row) => (
                    <ReadyRow key={row.id} row={row} />
                  ))}
                </Stack>
                {showDomainWarning ? (
                  <Typography level="body-xs" sx={{ color: "neutral.600" }}>
                    Sending may be blocked if this sender domain isn&apos;t verified.
                  </Typography>
                ) : null}
              </Stack>

              {hasProtectedExclusions ? (
                <Stack spacing={1.25}>
                  <Typography
                    level="body-xs"
                    fontWeight="lg"
                    sx={{
                      color: "neutral.500",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    Protected by BloomSuite
                  </Typography>
                  <Stack spacing={1.25}>
                    {consentGap > 0 ? (
                      <ProtectedRow
                        id="consent-check"
                        message={`${consentGap.toLocaleString()} contacts are missing recorded consent and will be excluded.`}
                      />
                    ) : null}
                    {hardSuppressionExcludedCount > 0 ? (
                      <ProtectedRow
                        id="hard-suppression"
                        variant="locked"
                        message={`${hardSuppressionExcludedCount.toLocaleString()} hard-suppressed addresses will stay blocked.`}
                      />
                    ) : null}
                    {suppressionBypassRecipientCount > 0 ? (
                      <ProtectedRow
                        id="soft-suppression"
                        message={`${suppressionBypassRecipientCount.toLocaleString()} soft-suppressed addresses can be reviewed.`}
                      />
                    ) : null}
                  </Stack>
                  <Typography level="body-xs" sx={{ color: "neutral.600" }}>
                    We recommend sending only to approved recipients to protect
                    compliance and deliverability.
                  </Typography>
                </Stack>
              ) : null}

              {overrideActive ? (
                <Sheet
                  variant="soft"
                  color="warning"
                  sx={{ borderRadius: "md", p: 1.5 }}
                >
                  <Stack direction="row" spacing={1} alignItems="flex-start">
                    <AlertTriangle
                      size={17}
                      style={{ flexShrink: 0, marginTop: 2 }}
                    />
                    <Typography level="body-sm">
                      Override active for this send:{" "}
                      {includeMissingConsent && includeSoftSuppressions
                        ? "missing-consent and soft-suppressed contacts"
                        : includeMissingConsent
                          ? "missing-consent contacts"
                          : "soft-suppressed contacts"}{" "}
                      will be included.
                    </Typography>
                  </Stack>
                </Sheet>
              ) : null}

              {hasBuilderBlockers ? (
                <Sheet
                  variant="soft"
                  color="danger"
                  sx={{ borderRadius: "md", p: 1.5 }}
                >
                  <Stack spacing={0.75}>
                    <Typography level="body-sm" fontWeight="lg">
                      Fix these blockers before sending
                    </Typography>
                    {builderBlockers.map((blocker) => (
                      <Typography key={blocker} level="body-xs">
                        {blocker}
                      </Typography>
                    ))}
                  </Stack>
                </Sheet>
              ) : null}

              {hasBuilderWarnings ? (
                <Sheet
                  variant="soft"
                  color="neutral"
                  sx={{ borderRadius: "md", p: 1.5 }}
                >
                  <Stack spacing={0.75}>
                    <Typography level="body-sm" fontWeight="lg">
                      Content notes to review
                    </Typography>
                    {builderWarnings.map((warning) => (
                      <Typography key={warning} level="body-xs">
                        {warning}
                      </Typography>
                    ))}
                  </Stack>
                </Sheet>
              ) : null}

              {inlineError ? (
                <Sheet
                  variant="soft"
                  color="danger"
                  sx={{ borderRadius: "md", p: 1.5 }}
                >
                  <Stack direction="row" spacing={1} alignItems="flex-start">
                    <AlertTriangle
                      size={17}
                      style={{ flexShrink: 0, marginTop: 2 }}
                    />
                    <Typography level="body-sm">{inlineError}</Typography>
                  </Stack>
                </Sheet>
              ) : null}
            </Stack>
          </DialogContent>

          <Divider />
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                width: "100%",
                gap: 1.5,
                flexWrap: "wrap",
              }}
            >
              <JoyButton
                variant="plain"
                color="neutral"
                onClick={handleClose}
                disabled={isBusy}
              >
                Back
              </JoyButton>
              <Stack
                direction="row"
                spacing={1}
                sx={{ ml: "auto", flexWrap: "wrap" }}
              >
                {hasProtectedExclusions ? (
                  <JoyButton
                    variant="outlined"
                    color="neutral"
                    onClick={() => setReviewOpen(true)}
                    disabled={isBusy}
                  >
                    Review Excluded Contacts
                  </JoyButton>
                ) : null}
                <JoyButton
                  variant="solid"
                  color={primaryActionColor}
                  loading={isBusy}
                  disabled={primaryActionDisabled}
                  onClick={() => void handleSubmit()}
                  startDecorator={<Send size={16} />}
                  sx={{
                    transition:
                      "background-color 200ms ease, border-color 200ms ease, color 200ms ease, box-shadow 200ms ease",
                  }}
                >
                  {primaryActionLabel}
                </JoyButton>
              </Stack>
            </Box>
          </DialogActions>
        </ModalDialog>
      </Modal>

      <ReviewExcludedDialog
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        consentExcludedCount={consentGap}
        softSuppressionRestorableCount={suppressionBypassRecipientCount}
        hardSuppressionExcludedCount={hardSuppressionExcludedCount}
        includeMissingConsent={includeMissingConsent}
        includeSoftSuppressions={includeSoftSuppressions}
        onChangeIncludeMissingConsent={setIncludeMissingConsent}
        onChangeIncludeSoftSuppressions={setIncludeSoftSuppressions}
        onConfirm={handleConfirmReview}
      />
    </>
  );
}
