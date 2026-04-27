import * as React from "react";
import Box from "@mui/joy/Box";
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
import { useSuppressionStats } from "@/hooks/useSuppressionList";
import { useTenant } from "@/hooks/useTenant";
import { isUuidLike } from "@/lib/computeAudienceRecipientCount";
import { supabase } from "@/integrations/supabase/client";

const PAGE_SIZE = 1000;

function chunkIds(ids: string[], size = 100) {
  const chunks: string[][] = [];
  for (let index = 0; index < ids.length; index += size) {
    chunks.push(ids.slice(index, index + size));
  }
  return chunks;
}

async function fetchAudienceConsentGap(params: {
  tenantId: string;
  segmentIds: string[];
  personaIds: string[];
}) {
  const { tenantId, segmentIds, personaIds } = params;
  let allowedCustomerIds: string[] | null = null;

  if (segmentIds.length > 0) {
    const ids = new Set<string>();
    for (let from = 0; ; from += PAGE_SIZE) {
      const to = from + PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from("customer_segments")
        .select("customer_id")
        .in("segment_id", segmentIds)
        .range(from, to);

      if (error) throw error;
      (data ?? []).forEach((row) => {
        const customerId = String(row.customer_id || "");
        if (isUuidLike(customerId)) ids.add(customerId);
      });
      if (!data || data.length < PAGE_SIZE) break;
    }
    allowedCustomerIds = Array.from(ids);
  }

  if (personaIds.length > 0) {
    const ids = new Set<string>();
    const uuidPersonas = personaIds.filter(isUuidLike);
    const predefinedPersonas = personaIds.filter((id) => !isUuidLike(id));

    if (uuidPersonas.length > 0) {
      for (let from = 0; ; from += PAGE_SIZE) {
        const to = from + PAGE_SIZE - 1;
        const { data, error } = await supabase
          .from("customer_personas")
          .select("customer_id")
          .in("persona_id", uuidPersonas)
          .range(from, to);

        if (error) throw error;
        (data ?? []).forEach((row) => {
          const customerId = String(row.customer_id || "");
          if (isUuidLike(customerId)) ids.add(customerId);
        });
        if (!data || data.length < PAGE_SIZE) break;
      }

      for (let from = 0; ; from += PAGE_SIZE) {
        const to = from + PAGE_SIZE - 1;
        const { data, error } = await supabase
          .from("crm_customers")
          .select("id")
          .eq("tenant_id", tenantId)
          .in("persona_id", uuidPersonas)
          .range(from, to);

        if (error) throw error;
        (data ?? []).forEach((row) => {
          const customerId = String(row.id || "");
          if (isUuidLike(customerId)) ids.add(customerId);
        });
        if (!data || data.length < PAGE_SIZE) break;
      }
    }

    if (predefinedPersonas.length > 0) {
      for (let from = 0; ; from += PAGE_SIZE) {
        const to = from + PAGE_SIZE - 1;
        const { data, error } = await supabase
          .from("customer_personas")
          .select("customer_id")
          .in("predefined_persona_id", predefinedPersonas)
          .range(from, to);

        if (error) throw error;
        (data ?? []).forEach((row) => {
          const customerId = String(row.customer_id || "");
          if (isUuidLike(customerId)) ids.add(customerId);
        });
        if (!data || data.length < PAGE_SIZE) break;
      }
    }

    const personaCustomerIds = Array.from(ids);
    if (allowedCustomerIds === null) {
      allowedCustomerIds = personaCustomerIds;
    } else {
      const personaSet = new Set(personaCustomerIds);
      allowedCustomerIds = allowedCustomerIds.filter((id) => personaSet.has(id));
    }
  }

  const countUnconsented = async (ids?: string[]) => {
    let query = supabase
      .from("crm_customers")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .not("email", "is", null)
      .eq("email_opt_in", false);

    if (ids) {
      query = query.in("id", ids);
    }

    const { count, error } = await query;
    if (error) throw error;
    return count ?? 0;
  };

  if (allowedCustomerIds === null) {
    return countUnconsented();
  }

  if (allowedCustomerIds.length === 0) {
    return 0;
  }

  let total = 0;
  for (const chunk of chunkIds(allowedCustomerIds)) {
    total += await countUnconsented(chunk);
  }
  return total;
}

function useAudienceConsentGap(options: {
  enabled: boolean;
  tenantId?: string | null;
  segmentIds: string[];
  personaIds: string[];
}) {
  return useQuery({
    queryKey: [
      "campaign-send-consent-gap",
      options.tenantId,
      options.segmentIds,
      options.personaIds,
    ],
    enabled: options.enabled && Boolean(options.tenantId),
    staleTime: 60000,
    queryFn: () =>
      fetchAudienceConsentGap({
        tenantId: options.tenantId as string,
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
      <Box sx={{ width: 20, pt: 0.25, display: "flex", justifyContent: "center" }}>
        {item.loading ? (
          <CircularProgress size="sm" sx={{ "--CircularProgress-size": "18px" }} />
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
}: {
  open: boolean;
  onClose: () => void;
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
  } = useCampaignEditor();
  const { emailDomains, loading: domainsLoading } = useEmailDomains();
  const healthQuery = useTenantEmailHealthDashboard(tenant?.id, {
    enabled: open,
  });
  const suppressionQuery = useSuppressionStats({ enabled: open });
  const consentGapQuery = useAudienceConsentGap({
    enabled: open,
    tenantId: tenant?.id,
    segmentIds: selectedSegments.map((segment) => segment.id),
    personaIds: selectedPersonas.map((persona) => persona.id),
  });
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [inlineError, setInlineError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      setInlineError(null);
      setIsSubmitting(false);
    }
  }, [open]);

  const recipientCount = audienceCount ?? 0;
  const formattedRecipients = recipientCount.toLocaleString();
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
  const suppressionTotal = suppressionQuery.data?.total ?? 0;
  const consentGap = consentGapQuery.data ?? 0;

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
        detail: consentGapQuery.isLoading
          ? "Checking audience"
          : `${consentGap.toLocaleString()} without consent`,
        loading: consentGapQuery.isLoading,
        warning:
          !consentGapQuery.isLoading && consentGap > 0
            ? `${consentGap.toLocaleString()} matching contacts will be excluded before queueing.`
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
        detail: suppressionQuery.isLoading
          ? "Checking list"
          : `${suppressionTotal.toLocaleString()} active suppressions`,
        loading: suppressionQuery.isLoading,
        warning:
          !suppressionQuery.isLoading && suppressionTotal > 0
            ? "Suppressed addresses will be skipped and counted separately."
            : null,
      },
      {
        id: "audience",
        label: "Audience ready",
        detail: `${formattedRecipients} recipients`,
        warning:
          recipientCount === 0
            ? "No eligible recipients are currently available for this send."
            : null,
      },
    ],
    [
      consentGap,
      consentGapQuery.isLoading,
      domainReady,
      domainsLoading,
      formattedRecipients,
      healthQuery.isLoading,
      recipientCount,
      reputationScore,
      senderEmail,
      suppressionQuery.isLoading,
      suppressionTotal,
    ],
  );

  const hasWarning = preflightItems.some((item) => Boolean(item.warning));
  const primaryLabel = sendImmediately
    ? hasWarning
      ? "Send Anyway"
      : "Send Now"
    : hasWarning
      ? "Schedule Anyway"
      : "Schedule Send";
  const isBusy = isSaving || isSubmitting;

  const handleClose = React.useCallback(() => {
    if (!isBusy) {
      onClose();
    }
  }, [isBusy, onClose]);

  const handleSubmit = React.useCallback(async () => {
    if (isBusy) return;

    setInlineError(null);
    setIsSubmitting(true);
    try {
      const result = await activate({ suppressToasts: true });
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
  }, [activate, isBusy, onClose]);

  return (
    <Modal open={open} onClose={handleClose}>
      <ModalDialog
        variant="outlined"
        size="md"
        sx={{ width: "min(640px, calc(100vw - 2rem))", p: 0 }}
      >
        {!isBusy ? <ModalClose /> : null}
        <Box sx={{ px: 3, pt: 3, pb: 2 }}>
          <DialogTitle sx={{ p: 0, mb: 0.5 }}>Confirm Campaign Send</DialogTitle>
          <Typography level="body-sm" sx={{ color: "neutral.600" }}>
            This campaign will be sent to {formattedRecipients} recipients.
          </Typography>
        </Box>

        <DialogContent sx={{ px: 3, py: 0 }}>
          <Stack spacing={2.25}>
            <Sheet variant="soft" color="neutral" sx={{ borderRadius: "md", p: 2 }}>
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
                    <Typography level="body-sm" sx={{ wordBreak: "break-word" }}>
                      {senderName ? `${senderName} <${senderEmail}>` : senderEmail || "No sender"}
                    </Typography>
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                      Reply-to
                    </Typography>
                    <Typography level="body-sm" sx={{ wordBreak: "break-word" }}>
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

            {inlineError ? (
              <Sheet variant="soft" color="danger" sx={{ borderRadius: "md", p: 1.5 }}>
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <AlertTriangle size={17} style={{ flexShrink: 0, marginTop: 2 }} />
                  <Typography level="body-sm">{inlineError}</Typography>
                </Stack>
              </Sheet>
            ) : null}
          </Stack>
        </DialogContent>

        <Divider />
        <DialogActions sx={{ px: 3, py: 2 }}>
          <JoyButton bloomVariant="ghost" color="neutral" onClick={handleClose} disabled={isBusy}>
            Back
          </JoyButton>
          <JoyButton loading={isBusy} onClick={handleSubmit} startDecorator={<Send size={16} />}>
            {primaryLabel}
          </JoyButton>
        </DialogActions>
      </ModalDialog>
    </Modal>
  );
}
