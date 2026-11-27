import { CampaignApprovalPanel } from "@/components/crm/campaign-editor/CampaignApprovalPanel";
import { useCampaignApproval } from "@/hooks/useCampaignApproval";
import { approvalBlocksSending } from "@/lib/crm/campaignApproval";
import * as React from "react";
import { deriveCampaignDisplayName, isUnsetCampaignName } from "@/lib/crm/campaignDisplayName";
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
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import Accordion from "@mui/joy/Accordion";
import AccordionDetails from "@mui/joy/AccordionDetails";
import AccordionGroup from "@mui/joy/AccordionGroup";
import AccordionSummary from "@mui/joy/AccordionSummary";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  Lock,
  Send,
  ShieldCheck,
} from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";
import { useCampaignEditor } from "@/components/crm/campaign-editor/CampaignEditorContext";
import { useEmailDomains } from "@/hooks/useEmailDomains";
import { usePreviousCampaignRecipientCount } from "@/hooks/usePreviousCampaignRecipientCount";
import { useTenantEmailHealthDashboard } from "@/hooks/useTenantEmailHealthDashboard";
import { useTenant } from "@/hooks/useTenant";
import { useUserRole } from "@/hooks/useUserRole";
import {
  CHECKING_AUDIENCE_LABEL,
  NO_ELIGIBLE_RECIPIENTS_MESSAGE,
  useCampaignEmailEligibility,
  type EmailEligibilityGate,
} from "@/hooks/useCampaignEmailEligibility";

type AcknowledgedWarning = {
  id: string;
  label: string;
  detail?: string | null;
  warning?: string | null;
};

type ChecklistRow = {
  id: string;
  label: string;
  detail: string;
  loading?: boolean;
  /** "warning" when the row is a problem, not a pass. */
  tone?: "ok" | "warning";
};

/** The checklist row's icon: a soft circle that says pass, problem or still checking. */
function ReadyRowIcon({ row }: { row: ChecklistRow }) {
  const state = row.loading ? "loading" : row.tone === "warning" ? "warning" : "success";
  return (
    <Box
      component="span"
      data-testid={`send-check-icon-${state}`}
      aria-hidden
      sx={{
        width: 28,
        height: 28,
        flexShrink: 0,
        borderRadius: "50%",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor:
          state === "loading" ? "neutral.softBg" : state === "warning" ? "warning.softBg" : "success.softBg",
        color:
          state === "loading" ? "text.tertiary" : state === "warning" ? "warning.softColor" : "success.softColor",
      }}
    >
      {state === "loading" ? (
        <CircularProgress size="sm" color="neutral" sx={{ "--CircularProgress-size": "16px" }} />
      ) : state === "warning" ? (
        <AlertTriangle size={16} />
      ) : (
        <Check size={16} strokeWidth={3} />
      )}
    </Box>
  );
}

function ReadyRow({ row }: { row: ChecklistRow }) {
  return (
    <Stack
      component="li"
      direction="row"
      spacing={3}
      alignItems="center"
      data-testid={`send-check-${row.id}`}
      sx={{ minHeight: 44 }}
    >
      <ReadyRowIcon row={row} />
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={{ xs: 0, sm: 2 }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
        sx={{ width: "100%", minWidth: 0 }}
      >
        <Typography level="body-sm" fontWeight="lg" sx={{ color: "text.primary" }}>
          {row.label}
        </Typography>
        <Typography
          level="body-sm"
          sx={{ color: row.tone === "warning" ? "warning.plainColor" : "text.tertiary" }}
        >
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

function ProtectedRow({
  message,
  variant = "info",
  loading,
}: ProtectedRowProps) {
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
          <Icon size={18} style={{ color: "var(--joy-palette-primary-500)" }} />
        )}
      </Box>
      <Typography level="body-sm" sx={{ color: "neutral.700", minWidth: 0 }}>
        {message}
      </Typography>
    </Stack>
  );
}

type StatCardTone = "positive" | "informational" | "neutral";

type StatCardProps = {
  tone: StatCardTone;
  label: string;
  /** Undefined until the eligibility check returns; shown as a skeleton. */
  value: number | undefined;
  helper: string;
  testId?: string;
};

function StatCard({ tone, label, value, helper, testId }: StatCardProps) {
  const palette =
    tone === "positive"
      ? { color: "success" as const, icon: <CheckCircle2 size={18} aria-hidden /> }
      : tone === "informational"
        ? { color: "primary" as const, icon: <ShieldCheck size={18} aria-hidden /> }
        : { color: "neutral" as const, icon: <Lock size={18} aria-hidden /> };

  return (
    <Box
      data-testid={testId ? `${testId}-card` : undefined}
      sx={{
        flex: 1,
        minWidth: 0,
        borderRadius: "lg",
        border: "1px solid",
        borderColor: `${palette.color}.outlinedBorder`,
        bgcolor: "background.surface",
        p: 4,
      }}
    >
      <Stack spacing={2}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Box sx={{ color: `${palette.color}.plainColor`, display: "inline-flex" }}>
            {palette.icon}
          </Box>
          <Typography
            level="body-xs"
            fontWeight="lg"
            sx={{
              color: `${palette.color}.plainColor`,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            {label}
          </Typography>
        </Stack>
        <Typography
          component="div"
          sx={{
            color: "text.primary",
            fontSize: "xl2",
            fontWeight: "xl",
            lineHeight: 1.2,
            minHeight: "1.2em",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {value === undefined ? (
            <Skeleton
              variant="text"
              data-testid={testId ? `${testId}-skeleton` : undefined}
              sx={{ width: 64, display: "inline-block" }}
            />
          ) : (
            <span data-testid={testId}>{value.toLocaleString()}</span>
          )}
        </Typography>
        <Typography level="body-sm" sx={{ color: "text.tertiary" }}>
          {helper}
        </Typography>
      </Stack>
    </Box>
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
  onContinue: () => void;
};

export function ReviewExcludedDialog({
  open,
  onClose,
  consentExcludedCount,
  softSuppressionRestorableCount,
  hardSuppressionExcludedCount,
  includeMissingConsent,
  includeSoftSuppressions,
  onChangeIncludeMissingConsent,
  onChangeIncludeSoftSuppressions,
  onContinue,
}: ReviewExcludedDialogProps) {
  const hasSelection = includeMissingConsent || includeSoftSuppressions;

  return (
    <Modal open={open} onClose={onClose}>
      <ModalDialog
        variant="outlined"
        size="md"
        sx={{ width: "min(580px, calc(100vw - 2rem))", p: 0 }}
      >
        <ModalClose />
        <Box sx={{ px: 3, pt: 3, pb: 2 }}>
          <DialogTitle sx={{ p: 0, mb: 0.5 }}>
            Choose additional recipients
          </DialogTitle>
          <Typography level="body-sm" sx={{ color: "neutral.600" }}>
            You can send to your approved audience now. If these additional
            contacts have opted in, confirm their permission below.
          </Typography>
        </Box>

        <DialogContent sx={{ px: 3, py: 0 }}>
          <Stack spacing={1.5}>
            <Sheet
              variant="outlined"
              sx={{
                borderRadius: "md",
                p: 2,
                opacity: consentExcludedCount > 0 ? 1 : 0.55,
              }}
            >
              <Stack spacing={0.75}>
                <Checkbox
                  checked={includeMissingConsent && consentExcludedCount > 0}
                  disabled={consentExcludedCount === 0}
                  onChange={(event) =>
                    onChangeIncludeMissingConsent(Boolean(event.target.checked))
                  }
                  label={
                    <Typography level="title-sm" fontWeight="lg">
                      I confirm these contacts have opted in ·{" "}
                      {consentExcludedCount.toLocaleString()} contacts
                    </Typography>
                  }
                />
                <Typography
                  level="body-xs"
                  sx={{ color: "neutral.600", pl: 4 }}
                >
                  BloomSuite does not have their permission recorded. Select
                  this option to confirm you have their permission and include
                  them in this campaign.
                </Typography>
              </Stack>
            </Sheet>

            <Sheet
              variant="outlined"
              sx={{
                borderRadius: "md",
                p: 2,
                opacity: softSuppressionRestorableCount > 0 ? 1 : 0.55,
              }}
            >
              <Stack spacing={0.75}>
                <Checkbox
                  checked={
                    includeSoftSuppressions &&
                    softSuppressionRestorableCount > 0
                  }
                  disabled={softSuppressionRestorableCount === 0}
                  onChange={(event) =>
                    onChangeIncludeSoftSuppressions(
                      Boolean(event.target.checked),
                    )
                  }
                  label={
                    <Typography level="title-sm" fontWeight="lg">
                      Retry temporary delivery problems ·{" "}
                      {softSuppressionRestorableCount.toLocaleString()} contacts
                    </Typography>
                  }
                />
                <Typography
                  level="body-xs"
                  sx={{ color: "neutral.600", pl: 4 }}
                >
                  Mail to these contacts didn't go through recently — could be a
                  full inbox or a server hiccup. Including them now may affect
                  your inbox health.
                </Typography>
              </Stack>
            </Sheet>

            <Sheet
              variant="soft"
              color="neutral"
              sx={{ borderRadius: "md", p: 2 }}
            >
              <Stack direction="row" spacing={1.25} alignItems="flex-start">
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
                    Can't be sent to ·{" "}
                    {hardSuppressionExcludedCount.toLocaleString()} contacts
                  </Typography>
                  <Typography level="body-xs" sx={{ color: "neutral.600" }}>
                    These contacts unsubscribed, complained, or have an address
                    that keeps bouncing. They stay blocked to keep your inbox
                    health strong.
                  </Typography>
                </Stack>
              </Stack>
            </Sheet>
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
            <JoyButton variant="solid" color="primary" onClick={onContinue}>
              {hasSelection
                ? "Include selected contacts"
                : "Keep current audience"}
            </JoyButton>
          </Box>
        </DialogActions>
      </ModalDialog>
    </Modal>
  );
}

type OverrideConfirmDialogProps = {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  overrideCount: number;
};

type LowCountConfirmDialogProps = {
  open: boolean;
  count: number;
  singleRecipientEmail: string | null;
  campaignName: string;
  onCancel: () => void;
  onConfirm: () => void;
  isSubmitting: boolean;
};

export function LowCountConfirmDialog({
  open,
  count,
  singleRecipientEmail,
  campaignName,
  onCancel,
  onConfirm,
  isSubmitting,
}: LowCountConfirmDialogProps) {
  const cancelButtonRef = React.useRef<HTMLButtonElement | null>(null);

  React.useEffect(() => {
    if (open) {
      // Default focus on Cancel — protects against accidental confirm.
      const timer = window.setTimeout(() => {
        cancelButtonRef.current?.focus();
      }, 50);
      return () => window.clearTimeout(timer);
    }
    return;
  }, [open]);

  const isZero = count === 0;
  const recipientLabel = count === 1 ? "1 recipient" : "0 recipients";

  return (
    <Modal open={open} onClose={isSubmitting ? undefined : onCancel}>
      <ModalDialog
        variant="outlined"
        size="md"
        color="warning"
        sx={{ width: "min(520px, calc(100vw - 2rem))", p: 0 }}
        role="alertdialog"
        aria-labelledby="low-count-confirm-title"
      >
        <Box sx={{ px: 3, pt: 3, pb: 2 }}>
          <Stack direction="row" spacing={1.25} alignItems="flex-start">
            <AlertTriangle
              size={22}
              style={{
                flexShrink: 0,
                marginTop: 2,
                color: "var(--joy-palette-warning-700)",
              }}
            />
            <Stack spacing={0.5}>
              <DialogTitle
                id="low-count-confirm-title"
                sx={{ p: 0, color: "warning.700" }}
              >
                Send to only {recipientLabel}?
              </DialogTitle>
              <Typography level="body-sm" sx={{ color: "neutral.700" }}>
                {campaignName || "This campaign"} will be sent to{" "}
                <Typography
                  component="span"
                  fontWeight="lg"
                  sx={{ color: "neutral.900" }}
                >
                  {recipientLabel}
                </Typography>
                . If you expected your full customer list, cancel and check your
                audience settings.
              </Typography>
            </Stack>
          </Stack>
        </Box>

        <DialogContent sx={{ px: 3, py: 0 }}>
          <Sheet
            variant="outlined"
            sx={{
              borderRadius: "md",
              p: 2,
              backgroundColor: "background.body",
            }}
          >
            <Stack spacing={0.5}>
              <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
                {isZero
                  ? "Resolved recipient"
                  : "This send will go to one address"}
              </Typography>
              <Typography
                level="body-sm"
                fontWeight="lg"
                sx={{ wordBreak: "break-word", color: "neutral.900" }}
              >
                {isZero
                  ? "No matching contact"
                  : (singleRecipientEmail ?? "Unknown recipient")}
              </Typography>
            </Stack>
          </Sheet>
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
            <JoyButton
              ref={cancelButtonRef}
              variant="solid"
              color="primary"
              onClick={onCancel}
              disabled={isSubmitting}
              data-testid="low-count-cancel"
              autoFocus
            >
              Cancel and check audience
            </JoyButton>
            <JoyButton
              variant="outlined"
              color="warning"
              loading={isSubmitting}
              onClick={onConfirm}
              data-testid="low-count-confirm"
            >
              Send to {recipientLabel} anyway
            </JoyButton>
          </Box>
        </DialogActions>
      </ModalDialog>
    </Modal>
  );
}

function OverrideConfirmDialog({
  open,
  onCancel,
  onConfirm,
  overrideCount,
}: OverrideConfirmDialogProps) {
  const [acknowledged, setAcknowledged] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setAcknowledged(false);
    }
  }, [open]);

  return (
    <Modal open={open} onClose={onCancel}>
      <ModalDialog
        variant="outlined"
        size="md"
        sx={{ width: "min(480px, calc(100vw - 2rem))", p: 0 }}
      >
        <ModalClose />
        <Box sx={{ px: 3, pt: 3, pb: 2 }}>
          <DialogTitle sx={{ p: 0, mb: 0.5 }}>
            Confirm additional recipients
          </DialogTitle>
        </Box>

        <DialogContent sx={{ px: 3, py: 0 }}>
          <Stack spacing={1.5}>
            <Typography level="body-sm" sx={{ color: "neutral.700" }}>
              You are adding{" "}
              <Typography
                component="span"
                level="body-sm"
                fontWeight="lg"
                sx={{ color: "neutral.900" }}
              >
                {overrideCount.toLocaleString()}
              </Typography>{" "}
              contacts that BloomSuite normally excludes. Only continue if you
              are confident these contacts should receive this campaign.
            </Typography>
            <Checkbox
              checked={acknowledged}
              onChange={(event) =>
                setAcknowledged(Boolean(event.target.checked))
              }
              label="I understand these contacts are outside the recommended send and want to include them for this campaign only."
            />
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
            <JoyButton variant="plain" color="neutral" onClick={onCancel}>
              Cancel
            </JoyButton>
            <JoyButton
              variant="solid"
              color="warning"
              disabled={!acknowledged}
              onClick={onConfirm}
            >
              Include selected contacts
            </JoyButton>
          </Box>
        </DialogActions>
      </ModalDialog>
    </Modal>
  );
}

function ExclusionDetailsAccordion({
  consentGap,
  softSuppressionRestorableCount,
  hardSuppressionExcludedCount,
}: {
  consentGap: number;
  softSuppressionRestorableCount: number;
  hardSuppressionExcludedCount: number;
}) {
  const hasAnyExclusion =
    consentGap > 0 ||
    softSuppressionRestorableCount > 0 ||
    hardSuppressionExcludedCount > 0;
  if (!hasAnyExclusion) {
    return null;
  }
  return (
    <AccordionGroup
      size="sm"
      sx={{
        "--ListItem-paddingX": "0px",
        "& .MuiAccordionSummary-button": {
          paddingLeft: 0,
          paddingRight: 0,
          color: "var(--joy-palette-neutral-600)",
        },
        "& .MuiAccordionDetails-content": {
          paddingLeft: 0,
          paddingRight: 0,
        },
      }}
    >
      <Accordion>
        <AccordionSummary
          indicator={<ChevronDown size={16} />}
          slotProps={{
            button: {
              sx: { "&:hover": { background: "transparent" } },
            },
          }}
        >
          <Typography level="body-sm" fontWeight="lg">
            Why were these contacts held back?
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={1}>
            {consentGap > 0 ? (
              <Typography level="body-xs" sx={{ color: "neutral.600" }}>
                <Typography
                  component="span"
                  fontWeight="lg"
                  sx={{ color: "neutral.700" }}
                >
                  Waiting for permission ({consentGap.toLocaleString()}):
                </Typography>{" "}
                contacts who haven't said yes to email yet. Sending without
                permission risks spam complaints and hurts how mail providers
                see you.
              </Typography>
            ) : null}
            {softSuppressionRestorableCount > 0 ? (
              <Typography level="body-xs" sx={{ color: "neutral.600" }}>
                <Typography
                  component="span"
                  fontWeight="lg"
                  sx={{ color: "neutral.700" }}
                >
                  Temporary delivery problem (
                  {softSuppressionRestorableCount.toLocaleString()}):
                </Typography>{" "}
                addresses where mail recently didn't go through — could be a
                full inbox or a quiet recipient. You can review and include them
                this once if you&apos;re confident.
              </Typography>
            ) : null}
            {hardSuppressionExcludedCount > 0 ? (
              <Typography level="body-xs" sx={{ color: "neutral.600" }}>
                <Typography
                  component="span"
                  fontWeight="lg"
                  sx={{ color: "neutral.700" }}
                >
                  Can't be sent to (
                  {hardSuppressionExcludedCount.toLocaleString()}):
                </Typography>{" "}
                unsubscribes, complaints, and addresses that keep bouncing.
                These stay blocked to keep your inbox health strong — they can't
                be overridden.
              </Typography>
            ) : null}
          </Stack>
        </AccordionDetails>
      </Accordion>
    </AccordionGroup>
  );
}

export function CampaignSendConfirmation({
  open,
  onClose,
  builderWarnings = [],
  builderBlockers = [],
  placeholderWarnings = [],
  reviewContent,
  onEditContent,
  onSchedule,
}: {
  open: boolean;
  onClose: () => void;
  reviewContent?: React.ReactNode;
  onEditContent?: () => void;
  onSchedule?: () => void;
  builderWarnings?: string[];
  builderBlockers?: string[];
  /**
   * Likely-unfinished content detected by the pre-send placeholder scan
   * (scaffold headings, editorial notes). When non-empty, the user must
   * explicitly acknowledge before the send button enables. Soft gate —
   * some findings may be false positives — but the acknowledgment makes
   * the review deliberate. (Flowerhouse scaffold-send incident.)
   */
  placeholderWarnings?: string[];
}) {
  const { tenant } = useTenant();
  const { hasPermission } = useUserRole();
  const canSendCampaign = hasPermission("campaigns.send");
  const {
    audienceCount,
    isAudienceLoading,
    campaignType,
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
    campaignId,
  } = useCampaignEditor();
  const previousCampaignQuery = usePreviousCampaignRecipientCount(tenant?.id, {
    enabled: open,
    excludeCampaignId: campaignId ?? null,
  });
  const { emailDomains, loading: domainsLoading } = useEmailDomains();
  const healthQuery = useTenantEmailHealthDashboard(tenant?.id, {
    enabled: open,
  });
  const isEmail = campaignType === "email";
  // Same query (same key) as the editor page: one server answer for both.
  const eligibilityQuery = useCampaignEmailEligibility({
    enabled: open && isEmail,
    tenantId: tenant?.id,
    includeAllCustomers,
    additionalCustomerIds,
    segmentIds: selectedSegments.map((segment) => segment.id),
    personaIds: selectedPersonas.map((persona) => persona.id),
  });
  const eligibility = isEmail ? eligibilityQuery.data : undefined;
  // SMS has no email eligibility; it keeps the editor's audience count.
  const audienceGate: EmailEligibilityGate = isEmail
    ? eligibilityQuery.gate
    : isAudienceLoading
      ? "checking"
      : (audienceCount ?? 0) > 0
        ? "ready"
        : "none";
  const audienceChecking = audienceGate === "checking";
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [inlineError, setInlineError] = React.useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = React.useState(false);
  const [confirmOverrideOpen, setConfirmOverrideOpen] = React.useState(false);
  const [lowCountConfirmOpen, setLowCountConfirmOpen] = React.useState(false);
  const [pendingIncludeMissingConsent, setPendingIncludeMissingConsent] =
    React.useState(false);
  const [pendingIncludeSoftSuppressions, setPendingIncludeSoftSuppressions] =
    React.useState(false);
  const [includeMissingConsent, setIncludeMissingConsent] =
    React.useState(false);
  const [includeSoftSuppressions, setIncludeSoftSuppressions] =
    React.useState(false);
  const [placeholderAcknowledged, setPlaceholderAcknowledged] =
    React.useState(false);

  // A newly discovered website warning requires a fresh acknowledgement.
  const placeholderWarningKey = JSON.stringify(placeholderWarnings);
  React.useEffect(() => { setPlaceholderAcknowledged(false); }, [placeholderWarningKey]);

  React.useEffect(() => {
    if (!open) {
      setInlineError(null);
      setIsSubmitting(false);
      setReviewOpen(false);
      setConfirmOverrideOpen(false);
      setLowCountConfirmOpen(false);
      setPendingIncludeMissingConsent(false);
      setPendingIncludeSoftSuppressions(false);
      setIncludeMissingConsent(false);
      setIncludeSoftSuppressions(false);
      setPlaceholderAcknowledged(false);
    }
  }, [open]);

  const openReviewDialog = React.useCallback(() => {
    setPendingIncludeMissingConsent(includeMissingConsent);
    setPendingIncludeSoftSuppressions(includeSoftSuppressions);
    setReviewOpen(true);
  }, [includeMissingConsent, includeSoftSuppressions]);

  const handleReviewContinue = React.useCallback(() => {
    setReviewOpen(false);
    // The permission checkbox is the explicit attestation. Only delivery
    // retries need the additional confirmation about retrying failed mail.
    if (pendingIncludeSoftSuppressions) {
      setConfirmOverrideOpen(true);
      return;
    }
    setIncludeMissingConsent(pendingIncludeMissingConsent);
    setIncludeSoftSuppressions(false);
  }, [pendingIncludeMissingConsent, pendingIncludeSoftSuppressions]);

  const handleOverrideConfirm = React.useCallback(() => {
    setIncludeMissingConsent(pendingIncludeMissingConsent);
    setIncludeSoftSuppressions(pendingIncludeSoftSuppressions);
    setConfirmOverrideOpen(false);
  }, [pendingIncludeMissingConsent, pendingIncludeSoftSuppressions]);

  const handleOverrideCancel = React.useCallback(() => {
    setConfirmOverrideOpen(false);
    setReviewOpen(true);
  }, []);

  const clearOverride = React.useCallback(() => {
    setIncludeMissingConsent(false);
    setIncludeSoftSuppressions(false);
    setPendingIncludeMissingConsent(false);
    setPendingIncludeSoftSuppressions(false);
  }, []);

  // Real numbers only once the check has returned; undefined renders a
  // skeleton, never a placeholder count.
  const filteredRecipientCount: number | undefined = isEmail
    ? eligibility?.eligible
    : audienceChecking
      ? undefined
      : (audienceCount ?? 0);
  const formattedRecipients = (filteredRecipientCount ?? 0).toLocaleString();
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
  const consentGap = eligibility
    ? eligibility.eligibleWithConsentOverride - eligibility.eligible
    : 0;
  const hardSuppressionExcludedCount = eligibility?.blocked ?? 0;
  const suppressionBypassRecipientCount = eligibility
    ? eligibility.eligibleWithSoftOverride - eligibility.eligible
    : 0;

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
        detail: domainsLoading ? "Checking sender" : senderEmail || "No sender",
        loading: domainsLoading,
      },
      audienceGate === "ready" || audienceChecking
        ? {
            id: "audience",
            label: "Audience ready",
            detail: audienceChecking
              ? CHECKING_AUDIENCE_LABEL
              : `${formattedRecipients} approved recipients`,
            loading: audienceChecking,
          }
        : {
            id: "audience",
            label:
              audienceGate === "error"
                ? "Audience not checked"
                : NO_ELIGIBLE_RECIPIENTS_MESSAGE,
            detail:
              audienceGate === "error"
                ? "We couldn't check who can receive this email"
                : "0 approved recipients",
            tone: "warning",
          },
      {
        id: "reputation",
        label: "Reputation status",
        detail: reputationDetail,
        loading: healthQuery.isLoading,
      },
    ],
    [
      audienceChecking,
      audienceGate,
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
  // Each override combination is its own server count, so the total is what
  // the worker would send with exactly those overrides.
  const projectedRecipientCount: number | undefined = !overrideActive
    ? filteredRecipientCount
    : !eligibility
      ? undefined
      : includeMissingConsent && includeSoftSuppressions
        ? eligibility.eligibleWithBothOverrides
        : includeMissingConsent
          ? eligibility.eligibleWithConsentOverride
          : eligibility.eligibleWithSoftOverride;
  const formattedProjectedRecipients = (projectedRecipientCount ?? 0).toLocaleString();
  const overrideAddedCount =
    (projectedRecipientCount ?? 0) - (filteredRecipientCount ?? 0);
  const pendingOverrideAddedCount = !eligibility
    ? 0
    : pendingIncludeMissingConsent && pendingIncludeSoftSuppressions
      ? eligibility.eligibleWithBothOverrides - eligibility.eligible
      : (pendingIncludeMissingConsent ? consentGap : 0) +
        (pendingIncludeSoftSuppressions ? suppressionBypassRecipientCount : 0);
  const protectedExcludedTotal = consentGap + suppressionBypassRecipientCount;
  const displayedProtectedCount: number | undefined =
    isEmail && !eligibility
      ? undefined
      : Math.max(0, protectedExcludedTotal - overrideAddedCount);
  const audienceReady = audienceGate === "ready";

  const acknowledgedWarnings = React.useMemo<AcknowledgedWarning[]>(() => {
    const items: AcknowledgedWarning[] = [];
    if (includeMissingConsent) {
      items.push({
        id: "override-consent",
        label: "Override: missing consent",
        detail: `${consentGap.toLocaleString()} contacts without recorded consent`,
        warning:
          "User confirmed these contacts have opted in and chose to include them for this send only.",
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
    if (placeholderAcknowledged && placeholderWarnings.length > 0) {
      items.push({
        id: "placeholder-content-acknowledged",
        label: "Unfinished-content warning acknowledged",
        detail: placeholderWarnings.join("; "),
        warning:
          "User reviewed the detected placeholder/scaffold content and chose to send anyway.",
      });
    }
    return items;
  }, [
    builderWarnings,
    consentGap,
    includeMissingConsent,
    includeSoftSuppressions,
    placeholderAcknowledged,
    placeholderWarnings,
    suppressionBypassRecipientCount,
  ]);

  const isBusy = isSaving || isSubmitting;
  // The same count as the Approved card: the shared eligibility check, plus
  // any contacts an override adds back.
  const recipientCountLabel = `${formattedProjectedRecipients} ${projectedRecipientCount === 1 ? "person" : "people"}`;
  const primaryActionLabel = audienceChecking
    ? CHECKING_AUDIENCE_LABEL
    : !audienceReady
      ? NO_ELIGIBLE_RECIPIENTS_MESSAGE
      : !sendImmediately
        ? `Schedule for ${recipientCountLabel}`
        : `Send to ${recipientCountLabel}`;
  const primaryActionColor: "primary" | "warning" = overrideActive
    ? "warning"
    : "primary";
  const requiresPlaceholderAck =
    placeholderWarnings.length > 0 && !placeholderAcknowledged;
  // Approval (only for organisations that turned it on). The database
  // refuses an unapproved send; this keeps the button honest about it.
  const { approval: campaignApproval, error: campaignApprovalError } = useCampaignApproval(campaignId, open);
  const approvalBlocked = approvalBlocksSending(campaignApproval) || Boolean(campaignApprovalError);
  const primaryActionDisabled =
    !canSendCampaign ||
    approvalBlocked ||
    isBusy ||
    hasBuilderBlockers ||
    requiresPlaceholderAck ||
    !audienceReady ||
    projectedRecipientCount === undefined ||
    projectedRecipientCount === 0;

  const handleClose = React.useCallback(() => {
    if (!isBusy) {
      onClose();
    }
  }, [isBusy, onClose]);

  const proceedWithSend = React.useCallback(async () => {
    if (!canSendCampaign) {
      setInlineError("You need campaign sending permission to send this campaign.");
      return;
    }
    setInlineError(null);
    setIsSubmitting(true);
    try {
      const result = await activate({
        suppressToasts: true,
        forceBypassConsent: includeMissingConsent,
        forceBypassSoftSuppression: includeSoftSuppressions,
        acknowledgedWarnings:
          overrideActive || placeholderAcknowledged
            ? acknowledgedWarnings
            : undefined,
      });
      if (result.success === true) {
        setLowCountConfirmOpen(false);
        onClose();
        return;
      }
      setLowCountConfirmOpen(false);
      setInlineError(result.error.description || result.error.title);
    } catch (error) {
      setLowCountConfirmOpen(false);
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
    canSendCampaign,
    includeMissingConsent,
    includeSoftSuppressions,
    onClose,
    overrideActive,
    placeholderAcknowledged,
  ]);

  const handleSubmit = React.useCallback(async () => {
    if (primaryActionDisabled) {
      return;
    }

    if (projectedRecipientCount !== undefined && projectedRecipientCount <= 1) {
      setLowCountConfirmOpen(true);
      return;
    }

    await proceedWithSend();
  }, [primaryActionDisabled, projectedRecipientCount, proceedWithSend]);

  const showDomainWarning = !domainsLoading && !domainReady;

  const showMainModal =
    open && !reviewOpen && !confirmOverrideOpen && !lowCountConfirmOpen;

  return (
    <>
      <Modal open={showMainModal} onClose={handleClose}>
        <ModalDialog
          variant="outlined"
          size="md"
          data-testid="campaign-send-dialog"
          sx={{
            width: "min(680px, calc(100vw - 32px))",
            p: 0,
            // Every control in the dialog is at least 44px tall.
            "& .MuiButton-root, & .MuiIconButton-root": { minHeight: 44 },
            "& .MuiIconButton-root": { minWidth: 44 },
          }}
        >
          {!isBusy ? <ModalClose /> : null}
          <Box sx={{ px: 6, pt: 6, pb: 4 }}>
            <DialogTitle sx={{ p: 0, mb: 0.5 }}>Ready to send</DialogTitle>
            <Typography level="body-sm" sx={{ color: "neutral.600" }}>
              {audienceChecking
                ? "BloomSuite is checking your audience..."
                : audienceGate === "error"
                  ? "BloomSuite couldn't check your audience. Close this and try again in a moment."
                  : audienceGate === "none"
                    ? `${NO_ELIGIBLE_RECIPIENTS_MESSAGE}. Change the audience before you send.`
                    : overrideActive
                      ? `Sending ${formattedProjectedRecipients} contacts, including ${overrideAddedCount.toLocaleString()} added from review.`
                      : `BloomSuite checked your campaign and found ${formattedRecipients} approved recipients.`}
            </Typography>
          </Box>

          <DialogContent sx={{ px: 6, py: 0 }}>
            <Stack spacing={4}>
              <Typography level="body-sm">
                Nothing sends until you confirm.
              </Typography>
              {reviewContent}
              {/* Campaign summary */}
              <Sheet
                variant="outlined"
                sx={{
                  borderRadius: "md",
                  p: 2,
                  backgroundColor: "background.body",
                }}
              >
                <Stack spacing={1.25}>
                  <Box>
                    <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
                      Campaign
                    </Typography>
                    <Typography level="title-sm" fontWeight="lg">
                      {deriveCampaignDisplayName({ name, subjectLine })}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
                      Subject line
                    </Typography>
                    <Typography level="body-sm">
                      {subjectLine || "No subject line"}
                    </Typography>
                  </Box>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
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
                      <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
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
                  <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
                    {sendImmediately
                      ? "Delivery starts as soon as the queue is accepted."
                      : `Scheduled for ${sendAt?.toLocaleString() ?? "later"}.`}
                  </Typography>
                </Stack>
              </Sheet>

              {/* Stat cards: Approved / Protected / Blocked */}
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={4}
                data-testid="send-stat-cards"
                sx={{ width: "100%" }}
              >
                <StatCard
                  tone="positive"
                  label="Approved"
                  testId="send-stat-approved"
                  value={projectedRecipientCount}
                  helper="Ready to receive this campaign"
                />
                <StatCard
                  tone="informational"
                  label="Protected"
                  testId="send-stat-protected"
                  value={displayedProtectedCount}
                  helper="Held back to protect consent and deliverability"
                />
                <StatCard
                  tone="neutral"
                  label="Blocked"
                  testId="send-stat-blocked"
                  value={isEmail ? eligibility?.blocked : audienceChecking ? undefined : 0}
                  helper="Cannot be sent"
                />
              </Stack>

              {/* Section A — Campaign is ready */}
              <Stack spacing={2}>
                <Typography
                  level="body-xs"
                  fontWeight="lg"
                  data-testid="send-checklist-title"
                  sx={{
                    color: "text.tertiary",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  {audienceChecking
                    ? CHECKING_AUDIENCE_LABEL
                    : audienceReady
                      ? "Campaign is ready"
                      : audienceGate === "error"
                        ? "Audience not checked"
                        : NO_ELIGIBLE_RECIPIENTS_MESSAGE}
                </Typography>
                <Stack component="ul" spacing={1} data-testid="send-checklist" sx={{ m: 0, p: 0, listStyle: "none" }}>
                  {readyRows.map((row) => (
                    <ReadyRow key={row.id} row={row} />
                  ))}
                </Stack>
                {!healthQuery.isLoading && reputationScore === null ? (
                  <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
                    Your sender reputation will appear after enough campaign
                    activity is available.
                  </Typography>
                ) : null}
                {!domainsLoading && domainReady ? (
                  <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
                    Your sending domain is authenticated and ready.
                  </Typography>
                ) : null}
                {showDomainWarning ? (
                  <Typography level="body-xs" sx={{ color: "neutral.600" }}>
                    Sending may be blocked if this sender domain isn&apos;t
                    verified.
                  </Typography>
                ) : null}
              </Stack>

              {/* Section B — Protected by BloomSuite */}
              {hasProtectedExclusions ? (
                <Stack spacing={1.25}>
                  <Typography
                    level="body-xs"
                    fontWeight="lg"
                    sx={{
                      color: "text.tertiary",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    BloomSuite protected this send
                  </Typography>
                  <Stack spacing={1.25}>
                    {consentGap > 0 ? (
                      <ProtectedRow
                        id="consent-check"
                        message={`${consentGap.toLocaleString()} contacts are waiting for permission and won't get this campaign.`}
                      />
                    ) : null}
                    {hardSuppressionExcludedCount > 0 ? (
                      <ProtectedRow
                        id="hard-suppression"
                        variant="locked"
                        message={`${hardSuppressionExcludedCount.toLocaleString()} addresses can't be sent to — they stay blocked.`}
                      />
                    ) : null}
                    {suppressionBypassRecipientCount > 0 ? (
                      <ProtectedRow
                        id="soft-suppression"
                        message={`${suppressionBypassRecipientCount.toLocaleString()} addresses had a temporary delivery problem — you can review them.`}
                      />
                    ) : null}
                  </Stack>
                  <Typography level="body-xs" sx={{ color: "neutral.600" }}>
                    Holding these contacts back keeps your inbox health strong
                    and protects you from spam complaints.
                  </Typography>
                  <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
                    Most campaigns hold a few contacts back. That's normal and
                    it's how providers keep trusting you.
                  </Typography>
                  <ExclusionDetailsAccordion
                    consentGap={consentGap}
                    softSuppressionRestorableCount={
                      suppressionBypassRecipientCount
                    }
                    hardSuppressionExcludedCount={hardSuppressionExcludedCount}
                  />
                </Stack>
              ) : null}

              {/* Audience-shrinkage warning vs previous send */}
              {previousCampaignQuery.data?.count &&
              previousCampaignQuery.data.count >= 1 &&
              projectedRecipientCount !== undefined &&
              projectedRecipientCount > 0 &&
              projectedRecipientCount <
                previousCampaignQuery.data.count * 0.5 ? (
                <Sheet
                  variant="soft"
                  color="warning"
                  data-testid="audience-shrinkage-warning"
                  sx={{ borderRadius: "md", p: 2 }}
                >
                  <Stack direction="row" spacing={1.25} alignItems="flex-start">
                    <AlertTriangle
                      size={18}
                      style={{
                        flexShrink: 0,
                        marginTop: 2,
                        color: "var(--joy-palette-warning-700)",
                      }}
                    />
                    <Stack spacing={0.5}>
                      <Typography
                        level="title-sm"
                        fontWeight="lg"
                        sx={{ color: "warning.700" }}
                      >
                        Your eligible audience has changed significantly.
                      </Typography>
                      <Typography level="body-sm" sx={{ color: "neutral.700" }}>
                        Your audience for this send is{" "}
                        <Typography
                          component="span"
                          fontWeight="lg"
                          sx={{ color: "neutral.900" }}
                        >
                          {projectedRecipientCount.toLocaleString()} recipients
                        </Typography>
                        . Your previous campaign
                        {previousCampaignQuery.data.campaignName
                          ? ` (${previousCampaignQuery.data.campaignName})`
                          : ""}{" "}
                        sent to{" "}
                        <Typography
                          component="span"
                          fontWeight="lg"
                          sx={{ color: "neutral.900" }}
                        >
                          {previousCampaignQuery.data.count.toLocaleString()}{" "}
                          recipients
                        </Typography>
                        . Review your customer consent settings before sending
                        if this is unexpected.
                      </Typography>
                    </Stack>
                  </Stack>
                </Sheet>
              ) : null}

              {/* Section C — Recommendation box */}
              {!overrideActive && audienceReady ? (
                <Sheet
                  variant="soft"
                  color="neutral"
                  sx={{ borderRadius: "md", p: 2 }}
                >
                  <Stack spacing={0.5}>
                    <Typography
                      level="title-sm"
                      fontWeight="lg"
                      sx={{ color: "neutral.800" }}
                    >
                      Recommended: send to approved recipients only.
                    </Typography>
                    <Typography level="body-sm" sx={{ color: "neutral.700" }}>
                      This sends your campaign to{" "}
                      {formattedRecipients.toLocaleString()} contacts and keeps
                      excluded contacts out of this send.
                    </Typography>
                  </Stack>
                </Sheet>
              ) : overrideActive ? (
                <Sheet
                  variant="soft"
                  color="warning"
                  sx={{ borderRadius: "md", p: 2 }}
                >
                  <Stack spacing={0.5}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <AlertTriangle size={17} />
                      <Typography
                        level="title-sm"
                        fontWeight="lg"
                        sx={{ color: "warning.700" }}
                      >
                        Override active for this send
                      </Typography>
                    </Stack>
                    <Typography level="body-sm" sx={{ color: "neutral.700" }}>
                      {overrideAddedCount.toLocaleString()} additional contacts
                      included for this send only.{" "}
                      <Typography
                        component="span"
                        level="body-sm"
                        sx={{
                          color: "primary.600",
                          cursor: "pointer",
                          textDecoration: "underline",
                        }}
                        onClick={clearOverride}
                      >
                        Remove override
                      </Typography>
                    </Typography>
                  </Stack>
                </Sheet>
              ) : null}

              {hasBuilderBlockers ? (
                <Sheet
                  variant="soft"
                  color="neutral"
                  sx={{ borderRadius: "md", p: 1.5 }}
                >
                  <Stack spacing={0.75}>
                    <Typography level="body-sm" fontWeight="lg">
                      Review before sending
                    </Typography>
                    {builderBlockers.map((blocker) => (
                      <Typography key={blocker} level="body-xs">
                        {blocker}
                      </Typography>
                    ))}
                  </Stack>
                </Sheet>
              ) : null}

              {placeholderWarnings.length > 0 ? (
                <Sheet
                  variant="soft"
                  color="warning"
                  data-testid="placeholder-content-warning"
                  sx={{ borderRadius: "md", p: 2 }}
                >
                  <Stack spacing={1}>
                    <Stack direction="row" spacing={1} alignItems="flex-start">
                      <AlertTriangle
                        size={18}
                        style={{
                          flexShrink: 0,
                          marginTop: 2,
                          color: "var(--joy-palette-warning-700)",
                        }}
                      />
                      <Stack spacing={0.5}>
                        <Typography
                          level="title-sm"
                          fontWeight="lg"
                          sx={{ color: "warning.700" }}
                        >
                          This campaign may contain unfinished content.
                        </Typography>
                        <Typography
                          level="body-sm"
                          sx={{ color: "neutral.700" }}
                        >
                          We spotted text that looks like template scaffolding
                          or editing notes. Review before sending:
                        </Typography>
                      </Stack>
                    </Stack>
                    <Stack spacing={0.25} sx={{ pl: 3.5 }}>
                      {placeholderWarnings.map((warning) =>
                        onEditContent ? (
                          <JoyButton
                            key={warning}
                            variant="outlined"
                            color="neutral"
                            onClick={onEditContent}
                            sx={{
                              justifyContent: "flex-start",
                              textAlign: "left",
                              whiteSpace: "normal",
                            }}
                          >
                            {warning} · Review in Studio
                          </JoyButton>
                        ) : (
                          <Typography key={warning} level="body-xs">
                            {warning}
                          </Typography>
                        ),
                      )}
                    </Stack>
                    <Checkbox
                      size="sm"
                      checked={placeholderAcknowledged}
                      onChange={(event) =>
                        setPlaceholderAcknowledged(event.target.checked)
                      }
                      label="I've reviewed these and want to send anyway"
                      data-testid="placeholder-acknowledge-checkbox"
                      sx={{ mt: 0.5 }}
                    />
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

              <CampaignApprovalPanel campaignId={campaignId} enabled={open} />
              {inlineError ? (
                <Sheet
                  variant="soft"
                  color="neutral"
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
          <DialogActions sx={{ px: 6, py: 4 }}>
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
                spacing={2}
                useFlexGap
                justifyContent="flex-end"
                sx={{ ml: "auto", flexWrap: "wrap", maxWidth: "100%" }}
              >
                {hasProtectedExclusions ? (
                  <JoyButton
                    variant="outlined"
                    color="neutral"
                    onClick={openReviewDialog}
                    disabled={isBusy}
                  >
                    Confirm permission / review contacts
                  </JoyButton>
                ) : null}
                {onSchedule ? (
                  <JoyButton
                    variant="outlined"
                    color="neutral"
                    disabled={isBusy || approvalBlocked || !audienceReady}
                    onClick={onSchedule}
                    data-testid="campaign-send-choose-time"
                  >
                    Choose send time
                  </JoyButton>
                ) : null}
                <JoyButton
                  variant="solid"
                  color={primaryActionColor}
                  loading={isBusy}
                  disabled={primaryActionDisabled}
                  onClick={() => void handleSubmit()}
                  startDecorator={<Send size={16} aria-hidden />}
                  data-testid="campaign-send-primary"
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
        includeMissingConsent={pendingIncludeMissingConsent}
        includeSoftSuppressions={pendingIncludeSoftSuppressions}
        onChangeIncludeMissingConsent={setPendingIncludeMissingConsent}
        onChangeIncludeSoftSuppressions={setPendingIncludeSoftSuppressions}
        onContinue={handleReviewContinue}
      />

      <OverrideConfirmDialog
        open={confirmOverrideOpen}
        onCancel={handleOverrideCancel}
        onConfirm={handleOverrideConfirm}
        overrideCount={pendingOverrideAddedCount}
      />

      <LowCountConfirmDialog
        open={lowCountConfirmOpen}
        count={projectedRecipientCount ?? 0}
        singleRecipientEmail={
          eligibility?.singleEligibleEmail ?? null
        }
        campaignName={name || "this campaign"}
        onCancel={() => {
          if (!isSubmitting) {
            setLowCountConfirmOpen(false);
          }
        }}
        onConfirm={() => void proceedWithSend()}
        isSubmitting={isSubmitting}
      />
    </>
  );
}
