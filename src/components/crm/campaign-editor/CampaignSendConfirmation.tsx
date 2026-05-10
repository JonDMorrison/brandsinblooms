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
import { AlertTriangle, CheckCircle2, Send } from "lucide-react";
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

type PreflightItem = {
  id: string;
  label: string;
  detail: string;
  warning?: string | null;
  loading?: boolean;
};

function PreflightLine({ item }: { item: PreflightItem }) {
  const hasWarning = Boolean(item.warning);
  const iconColor = hasWarning
    ? "var(--joy-palette-warning-600)"
    : "var(--joy-palette-success-600)";

  return (
    <Stack direction="row" spacing={1.25} alignItems="flex-start">
      <Box
        sx={{ width: 20, pt: 0.25, display: "flex", justifyContent: "center" }}
      >
        {item.loading ? (
          <CircularProgress
            size="sm"
            sx={{ "--CircularProgress-size": "18px" }}
          />
        ) : hasWarning ? (
          <AlertTriangle size={18} style={{ color: iconColor }} />
        ) : (
          <CheckCircle2 size={18} style={{ color: iconColor }} />
        )}
      </Box>
      <Stack spacing={0.25} sx={{ minWidth: 0 }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={{ xs: 0.25, sm: 1 }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "center" }}
          sx={{ width: "100%" }}
        >
          <Typography level="body-sm" fontWeight="lg">
            {item.label}
          </Typography>
          <Typography level="body-xs" sx={{ color: "neutral.500" }}>
            {item.detail}
          </Typography>
        </Stack>
        {item.warning ? (
          <Typography level="body-xs" sx={{ color: "warning.700" }}>
            {item.warning}
          </Typography>
        ) : null}
      </Stack>
    </Stack>
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
  const [warningsAcknowledged, setWarningsAcknowledged] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setInlineError(null);
      setIsSubmitting(false);
      setWarningsAcknowledged(false);
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

  const preflightItems = React.useMemo<PreflightItem[]>(
    () => [
      {
        id: "domain",
        label: "Domain verified",
        detail: domainsLoading ? "Checking sender" : senderEmail || "No sender",
        loading: domainsLoading,
        warning:
          !domainsLoading && !domainReady
            ? "Sending may be blocked if this sender is not verified."
            : null,
      },
      {
        id: "consent",
        label: "Consent compliance",
        detail: audienceSummaryQuery.isLoading
          ? "Checking audience"
          : `${consentGap.toLocaleString()} without consent`,
        loading: audienceSummaryQuery.isLoading,
        warning:
          !audienceSummaryQuery.isLoading && consentGap > 0
            ? `${consentGap.toLocaleString()} matching contacts are excluded from the normal send. Send Anyway includes them unless another hard block still applies.`
            : null,
      },
      {
        id: "reputation",
        label: "Reputation status",
        detail: healthQuery.isLoading
          ? "Checking health"
          : reputationScore === null
            ? "No score yet"
            : `${reputationScore}/100`,
        loading: healthQuery.isLoading,
        warning:
          reputationScore !== null && reputationScore < 70
            ? "Provider pacing may slow this campaign to protect deliverability."
            : null,
      },
      {
        id: "suppression",
        label: "Suppression list applied",
        detail: audienceSummaryQuery.isLoading
          ? "Checking list"
          : `${suppressionTotal.toLocaleString()} audience suppressions`,
        loading: audienceSummaryQuery.isLoading,
        warning:
          !audienceSummaryQuery.isLoading && suppressionTotal > 0
            ? suppressionBypassRecipientCount > 0
              ? `Normal send excludes ${suppressionTotal.toLocaleString()} suppressed addresses. Send Anyway restores ${suppressionBypassRecipientCount.toLocaleString()} soft suppressions while ${hardSuppressionExcludedCount.toLocaleString()} hard suppressions remain excluded.`
              : "Suppressed addresses will be skipped. Any remaining hard compliance suppressions still apply."
            : null,
      },
      {
        id: "audience",
        label: "Audience ready",
        detail: `${formattedRecipients} recipients`,
        warning:
          filteredRecipientCount === 0
            ? "No recipients remain after the current send safeguards are applied."
            : null,
      },
    ],
    [
      audienceSummaryQuery.isLoading,
      consentGap,
      domainReady,
      domainsLoading,
      formattedRecipients,
      filteredRecipientCount,
      hardSuppressionExcludedCount,
      healthQuery.isLoading,
      reputationScore,
      senderEmail,
      suppressionBypassRecipientCount,
      suppressionTotal,
    ],
  );

  const hasWarning = preflightItems.some((item) => Boolean(item.warning));
  const hasBuilderWarnings = builderWarnings.length > 0;
  const hasBuilderBlockers = builderBlockers.length > 0;
  const hasWarnings = hasWarning || hasBuilderWarnings;
  const canForceOverride = sendImmediately && hasWarnings;

  const acknowledgedWarnings = React.useMemo<AcknowledgedWarning[]>(
    () => [
      ...preflightItems
        .filter((item) => Boolean(item.warning))
        .map((item) => ({
          id: item.id,
          label: item.label,
          detail: item.detail,
          warning: item.warning ?? null,
        })),
      ...builderWarnings.map((warning, index) => ({
        id: `builder-warning-${index + 1}`,
        label: "Content warning",
        detail: warning,
        warning,
      })),
    ],
    [builderWarnings, preflightItems],
  );

  const isBusy = isSaving || isSubmitting;
  const useForceOverride = canForceOverride && warningsAcknowledged;
  const primaryActionLabel = useForceOverride
    ? "Send Anyway"
    : sendImmediately
      ? "Send Now"
      : "Schedule";
  const primaryActionColor = useForceOverride ? "warning" : "primary";
  const primaryActionMode = useForceOverride ? "override" : "normal";
  const primaryActionDisabled =
    isBusy ||
    hasBuilderBlockers ||
    (canForceOverride && !warningsAcknowledged) ||
    (useForceOverride
      ? overrideRecipientCount === 0
      : filteredRecipientCount === 0);

  const handleClose = React.useCallback(() => {
    if (!isBusy) {
      onClose();
    }
  }, [isBusy, onClose]);

  const handleSubmit = React.useCallback(
    async (mode: "normal" | "override") => {
      const shouldForceOverride = mode === "override" && canForceOverride;
      const isDisabled =
        isBusy ||
        hasBuilderBlockers ||
        (shouldForceOverride
          ? overrideRecipientCount === 0
          : filteredRecipientCount === 0) ||
        (canForceOverride && !shouldForceOverride);

      if (isDisabled) {
        return;
      }

      setInlineError(null);
      setIsSubmitting(true);
      try {
        const result = await activate({
          suppressToasts: true,
          forceBypassConsent: shouldForceOverride,
          forceBypassSoftSuppression: shouldForceOverride,
          acknowledgedWarnings: shouldForceOverride
            ? acknowledgedWarnings
            : undefined,
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
    },
    [
      acknowledgedWarnings,
      activate,
      canForceOverride,
      filteredRecipientCount,
      hasBuilderBlockers,
      isBusy,
      onClose,
      overrideRecipientCount,
    ],
  );

  return (
    <Modal open={open} onClose={handleClose}>
      <ModalDialog
        variant="outlined"
        size="md"
        sx={{ width: "min(640px, calc(100vw - 2rem))", p: 0 }}
      >
        {!isBusy ? <ModalClose /> : null}
        <Box sx={{ px: 3, pt: 3, pb: 2 }}>
          <DialogTitle sx={{ p: 0, mb: 0.5 }}>
            Confirm Campaign Send
          </DialogTitle>
          <Typography level="body-sm" sx={{ color: "neutral.600" }}>
            {canForceOverride && overrideRecipientCount > filteredRecipientCount
              ? `This campaign is currently ready to send to ${formattedRecipients} filtered recipients. Send Anyway expands this to ${formattedOverrideRecipients}.`
              : sendImmediately
                ? `This campaign will be sent to ${formattedRecipients} recipients.`
                : `This campaign will be scheduled for ${formattedRecipients} recipients.`}
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

            <Stack spacing={1.4}>
              {preflightItems.map((item) => (
                <PreflightLine key={item.id} item={item} />
              ))}
            </Stack>

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
                color="warning"
                sx={{ borderRadius: "md", p: 1.5 }}
              >
                <Stack spacing={0.75}>
                  <Typography level="body-sm" fontWeight="lg">
                    Review these content warnings before sending
                  </Typography>
                  {builderWarnings.map((warning) => (
                    <Typography key={warning} level="body-xs">
                      {warning}
                    </Typography>
                  ))}
                </Stack>
              </Sheet>
            ) : null}

            {canForceOverride ? (
              <Checkbox
                checked={warningsAcknowledged}
                onChange={(event) =>
                  setWarningsAcknowledged(Boolean(event.target.checked))
                }
                label="I understand these warnings and want to continue."
                disabled={hasBuilderBlockers || isBusy}
              />
            ) : null}

            {canForceOverride ? (
              <Typography level="body-xs" sx={{ color: "warning.700" }}>
                Send Anyway bypasses consent filtering and soft suppressions for
                this send only. Any remaining hard compliance blocks and
                placeholder addresses stay excluded.
              </Typography>
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
            <JoyButton
              variant="solid"
              color={primaryActionColor}
              loading={isBusy}
              disabled={primaryActionDisabled}
              onClick={() => void handleSubmit(primaryActionMode)}
              startDecorator={<Send size={16} />}
              sx={{
                ml: "auto",
                transition:
                  "background-color 200ms ease, border-color 200ms ease, color 200ms ease, box-shadow 200ms ease",
              }}
            >
              {primaryActionLabel}
            </JoyButton>
          </Box>
        </DialogActions>
      </ModalDialog>
    </Modal>
  );
}
