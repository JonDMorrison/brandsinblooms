import * as React from "react";
import Box from "@mui/joy/Box";
import CircularProgress from "@mui/joy/CircularProgress";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  MailCheck,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import {
  JoyDialog,
  JoyDialogActions,
  JoyDialogContent,
} from "@/components/joy/JoyDialog";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyChip } from "@/components/joy/JoyChip";
import { useEmailDomains } from "@/hooks/useEmailDomains";
import { DomainConnectWizard } from "@/components/crm/settings/DomainConnectWizard";

interface SenderVerificationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  senderConfig?: {
    companyName?: string;
    fromEmailDomainId?: string | null;
    senderEmail?: string;
    isVerified?: boolean;
  } | null;
  campaignSenderEmail?: string;
  onChooseVerifiedSender?: (email: string) => void;
}

/**
 * Domain verification is a provider status, NOT proof that the currently
 * edited campaign has a sender. Continue applies the verified identity
 * before closing, matching the campaign editor's hard send gate.
 */
export const SenderVerificationModal: React.FC<SenderVerificationModalProps> = ({
  open,
  onOpenChange,
  senderConfig,
  campaignSenderEmail,
  onChooseVerifiedSender,
}) => {
  const navigate = useNavigate();
  const { emailDomains, verifyEmailDomain, loading, refetch } = useEmailDomains();
  const [showDomainWizard, setShowDomainWizard] = React.useState(false);
  const [verifyingDomainId, setVerifyingDomainId] = React.useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = React.useState(0);

  const configuredSender = campaignSenderEmail?.trim().toLowerCase();
  const configuredDomain = configuredSender?.split("@")[1];
  const activeDomains = emailDomains.filter((domain) => domain.status === "active");
  const matchedDomain = activeDomains.find(
    (domain) =>
      domain.domain.toLowerCase() === configuredDomain ||
      (configuredSender !== undefined &&
        configuredSender.length > 0 &&
        domain.default_from_email?.trim().toLowerCase() === configuredSender),
  );
  const activeDomain =
    matchedDomain ||
    activeDomains.find((domain) => domain.id === senderConfig?.fromEmailDomainId) ||
    activeDomains[0];
  const pendingDomain = emailDomains.find((domain) =>
    ["pending", "pending_dns", "verifying", "warming_up"].includes(domain.status),
  );
  const needsCampaignSender =
    campaignSenderEmail !== undefined && Boolean(activeDomain) && !matchedDomain;
  const verifiedSenderEmail =
    activeDomain?.default_from_email?.trim() ||
    (activeDomain ? `mail@${activeDomain.domain}` : "");

  React.useEffect(() => {
    if (!open || !pendingDomain?.next_verify_at) {
      setCooldownSeconds(0);
      return;
    }
    const nextCheck = new Date(pendingDomain.next_verify_at).getTime();
    const calculate = () => {
      setCooldownSeconds(Math.max(0, Math.ceil((nextCheck - Date.now()) / 1000)));
    };
    calculate();
    const interval = window.setInterval(calculate, 1000);
    return () => window.clearInterval(interval);
  }, [open, pendingDomain?.id, pendingDomain?.next_verify_at]);

  const handleContinue = () => {
    if (needsCampaignSender) {
      if (!verifiedSenderEmail || !onChooseVerifiedSender) return;
      onChooseVerifiedSender(verifiedSenderEmail);
    }
    onOpenChange(false);
  };

  const handleVerifyDomain = async (id: string) => {
    setVerifyingDomainId(id);
    try {
      await verifyEmailDomain(id);
    } finally {
      // The hook reports verification errors and rate limits. Re-read
      // provider state even if a check could not complete.
      await refetch();
      setVerifyingDomainId(null);
    }
  };

  const openDomainSettings = () => {
    onOpenChange(false);
    navigate("/crm/settings/email-sending");
  };

  const formatCooldown = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remaining = seconds % 60;
    return minutes > 0 ? `${minutes}m ${String(remaining).padStart(2, "0")}s` : `${seconds}s`;
  };

  return (
    <>
      <JoyDialog
        open={open && !showDomainWizard}
        onClose={() => onOpenChange(false)}
        title="Sender verification"
        description="Make sure this campaign is using an approved sending address."
        size="md"
        startDecorator={
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: "lg",
              backgroundColor: "neutral.100",
              color: "neutral.700",
              display: "grid",
              placeItems: "center",
            }}
          >
            <MailCheck size={22} strokeWidth={1.9} aria-hidden="true" />
          </Box>
        }
        dialogSx={{
          borderRadius: "20px",
          backgroundColor: "background.surface",
          borderColor: "neutral.200",
          boxShadow: "0 24px 72px rgba(17, 24, 39, 0.18)",
        }}
      >
        <JoyDialogContent sx={{ pt: 0, pb: 2.5 }}>
          {loading && emailDomains.length === 0 ? (
            <Stack direction="row" spacing={1.25} alignItems="center" sx={{ py: 3 }}>
              <CircularProgress size="sm" color="neutral" />
              <Typography level="body-sm" sx={{ color: "neutral.600" }}>
                Checking your sending domain…
              </Typography>
            </Stack>
          ) : activeDomain ? (
            <Stack spacing={2}>
              <Sheet
                variant="outlined"
                sx={{
                  p: { xs: 2, sm: 2.5 },
                  borderRadius: "lg",
                  borderColor: "neutral.200",
                  backgroundColor: "neutral.50",
                }}
              >
                <Stack spacing={1.5}>
                  <Stack
                    direction="row"
                    spacing={1.5}
                    alignItems="center"
                    justifyContent="space-between"
                    useFlexGap
                    flexWrap="wrap"
                  >
                    <Stack direction="row" spacing={1} alignItems="center">
                      <CheckCircle2 size={19} color="var(--joy-palette-success-700)" aria-hidden="true" />
                      <Typography level="title-sm" sx={{ fontWeight: 700 }}>
                        Verified sending domain
                      </Typography>
                    </Stack>
                    <JoyChip size="sm" variant="soft" color="success">
                      Verified
                    </JoyChip>
                  </Stack>
                  <Stack spacing={0.35}>
                    <Typography level="body-xs" sx={{ color: "neutral.600" }}>
                      Your campaign will send from
                    </Typography>
                    <Typography
                      level="title-md"
                      sx={{ fontWeight: 700, color: "neutral.900", overflowWrap: "anywhere" }}
                    >
                      {needsCampaignSender
                        ? verifiedSenderEmail
                        : campaignSenderEmail?.trim() || senderConfig?.senderEmail || verifiedSenderEmail}
                    </Typography>
                    <Typography level="body-sm" sx={{ color: "neutral.600" }}>
                      {activeDomain.domain}
                    </Typography>
                  </Stack>
                </Stack>
              </Sheet>
              <Typography level="body-sm" sx={{ color: "neutral.700", lineHeight: 1.6 }}>
                {needsCampaignSender
                  ? `Your domain is verified. Use ${verifiedSenderEmail} as this campaign's sender to continue.`
                  : "Your sending domain is verified. You can return to your campaign and complete the final send checks."}
              </Typography>
            </Stack>
          ) : pendingDomain ? (
            <Stack spacing={2}>
              <Sheet
                variant="outlined"
                sx={{
                  p: { xs: 2, sm: 2.5 },
                  borderRadius: "lg",
                  backgroundColor: "neutral.50",
                  borderColor: "neutral.200",
                }}
              >
                <Stack spacing={1.25}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Clock3 size={20} color="var(--joy-palette-neutral-600)" aria-hidden="true" />
                    <Typography level="title-md" sx={{ fontWeight: 700 }}>
                      Domain Verification Pending
                    </Typography>
                  </Stack>
                  <Typography level="body-sm" sx={{ color: "neutral.700", overflowWrap: "anywhere" }}>
                    {pendingDomain.domain}
                  </Typography>
                  <Typography level="body-sm" sx={{ color: "neutral.600", lineHeight: 1.6 }}>
                    Sending remains unavailable until domain authentication completes. DNS updates can take time to propagate.
                  </Typography>
                  {pendingDomain.last_verify_error ? (
                    <Typography level="body-sm" sx={{ color: "warning.800" }}>
                      {pendingDomain.last_verify_error}
                    </Typography>
                  ) : null}
                  <JoyButton
                    color="neutral"
                    variant="outlined"
                    size="md"
                    startDecorator={<RefreshCw size={16} aria-hidden="true" />}
                    onClick={() => void handleVerifyDomain(pendingDomain.id)}
                    disabled={verifyingDomainId !== null || cooldownSeconds > 0}
                    loading={verifyingDomainId === pendingDomain.id}
                    sx={{ minHeight: 44, alignSelf: "flex-start" }}
                  >
                    {cooldownSeconds > 0
                      ? `Check again in ${formatCooldown(cooldownSeconds)}`
                      : "Check verification"}
                  </JoyButton>
                </Stack>
              </Sheet>
              {pendingDomain.last_verify_attempt_at ? (
                <Typography level="body-xs" sx={{ color: "neutral.600" }}>
                  Last checked {formatDistanceToNow(new Date(pendingDomain.last_verify_attempt_at))} ago
                </Typography>
              ) : null}
            </Stack>
          ) : (
            <Sheet
              variant="outlined"
              sx={{
                p: { xs: 2, sm: 2.5 },
                borderRadius: "lg",
                backgroundColor: "neutral.50",
                borderColor: "neutral.200",
              }}
            >
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <ShieldCheck size={20} color="var(--joy-palette-neutral-600)" aria-hidden="true" />
                  <Typography level="title-md" sx={{ fontWeight: 700 }}>
                    Connect a sending domain
                  </Typography>
                </Stack>
                <Typography level="body-sm" sx={{ color: "neutral.600", lineHeight: 1.6 }}>
                  Connect and verify your business domain before sending campaigns to your customers.
                </Typography>
                <JoyButton
                  size="md"
                  color="primary"
                  onClick={() => setShowDomainWizard(true)}
                  endDecorator={<ArrowRight size={16} aria-hidden="true" />}
                  sx={{ minHeight: 44, alignSelf: "flex-start" }}
                >
                  Set up a domain
                </JoyButton>
              </Stack>
            </Sheet>
          )}
        </JoyDialogContent>
        <JoyDialogActions
          sx={{
            borderColor: "neutral.200",
            backgroundColor: "background.surface",
          }}
        >
          <JoyButton
            color="neutral"
            variant="plain"
            size="md"
            onClick={openDomainSettings}
          >
            Manage domain settings
          </JoyButton>
          {activeDomain ? (
            <JoyButton
              data-testid="sender-verification-continue"
              color="primary"
              variant="solid"
              size="md"
              onClick={handleContinue}
              disabled={needsCampaignSender && !onChooseVerifiedSender}
              endDecorator={<ArrowRight size={16} aria-hidden="true" />}
              sx={{ minHeight: 44 }}
            >
              {needsCampaignSender
                ? `Use ${verifiedSenderEmail} & continue`
                : "Continue with Campaign"}
            </JoyButton>
          ) : null}
        </JoyDialogActions>
      </JoyDialog>
      {showDomainWizard ? (
        <DomainConnectWizard
          open={showDomainWizard}
          onClose={() => {
            setShowDomainWizard(false);
            void refetch();
          }}
        />
      ) : null}
    </>
  );
};
