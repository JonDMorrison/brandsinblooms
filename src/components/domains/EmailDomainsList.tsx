import React, { useState } from "react";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Chip from "@mui/joy/Chip";
import IconButton from "@mui/joy/IconButton";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Tooltip from "@mui/joy/Tooltip";
import Typography from "@mui/joy/Typography";
import {
  Globe,
  Plus,
  Settings,
  CheckCircle,
  XCircle,
  RefreshCw,
  AlertTriangle,
  Wrench,
} from "lucide-react";
import { DomainConnectWizard } from "@/components/crm/settings/DomainConnectWizard";
import { EmailDomainDetails } from "./EmailDomainDetails";
import { useEmailDomains, EmailDomain } from "@/hooks/useEmailDomains";
import { useEntriConnect } from "@/hooks/useEntriConnect";
import { useTenant } from "@/hooks/useTenant";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// =========================================================
// Readiness Status Types (matches edge function)
// =========================================================

type ReadinessStatus =
  | "CONNECTED_READY" // DNS verified, domain is working - primary success state
  | "ACTION_REQUIRED_DNS_MISSING"
  | "ACTION_REQUIRED_DNS_CONFLICT"
  | "DOMAIN_NOT_CONNECTED"
  // Legacy statuses (for backward compatibility)
  | "READY_TO_SEND"
  | "READY_AWAITING_PROVIDER";

interface ReadinessDisplay {
  status: ReadinessStatus;
  badge: { text: string; variant: "green" | "amber" | "red" | "gray" };
  message: string;
  subMessage?: string;
  ctaLabel?: string;
  ctaAction?: "repair" | "fix_conflict" | "connect";
  showForceCheck: boolean;
}

interface EmailDomainsListProps {
  addDomainOpen: boolean;
  onAddDomainOpenChange: (open: boolean) => void;
}

const SPIN_SX = {
  animation: "domains-refresh-spin 1s linear infinite",
  "@keyframes domains-refresh-spin": {
    to: { transform: "rotate(360deg)" },
  },
} as const;

const badgeToneMap = {
  green: "success",
  amber: "warning",
  red: "danger",
  gray: "neutral",
} as const;

const formatCooldown = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return minutes > 0
    ? `${minutes}m ${String(remainingSeconds).padStart(2, "0")}s`
    : `${remainingSeconds}s`;
};

// =========================================================
// Main Component
// =========================================================

export const EmailDomainsList = ({
  addDomainOpen,
  onAddDomainOpenChange,
}: EmailDomainsListProps) => {
  const {
    emailDomains,
    loading,
    verifyEmailDomain,
    retryEmailDomain,
    getDomainRecords,
    refetch,
  } = useEmailDomains();
  const {
    openEntriSetup,
    sanitizeAndConvertRecords,
    isLoading: entriLoading,
  } = useEntriConnect();
  const { tenant, refetch: refetchTenant } = useTenant();
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [verifyingDomains, setVerifyingDomains] = useState<Set<string>>(
    new Set(),
  );
  const [repairingDomains, setRepairingDomains] = useState<Set<string>>(
    new Set(),
  );
  const [savingDefaultDomain, setSavingDefaultDomain] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Rate limiting: track last check time per domain
  const [lastCheckTimes, setLastCheckTimes] = useState<Record<string, number>>(
    {},
  );
  const RATE_LIMIT_MS = 5 * 60 * 1000; // 5 minutes

  // =========================================================
  // Compute Readiness Display (single source of truth)
  // =========================================================

  const defaultDomainId = tenant?.default_from_email_domain_id || null;

  const setDefaultSendingDomain = async (domainId: string | null) => {
    if (!tenant?.id) return;

    setSavingDefaultDomain(true);
    try {
      const { error } = await supabase.rpc(
        "set_tenant_default_from_email_domain" as any,
        {
          p_domain_id: domainId,
        },
      );

      if (error) {
        throw error;
      }

      await refetchTenant();

      toast.success(
        domainId
          ? "Default sending domain updated."
          : "Default sending domain cleared.",
      );
    } catch (err: any) {
      console.error("Failed to set default sending domain:", err);
      toast.error(err?.message || "Failed to update default sending domain");
    } finally {
      setSavingDefaultDomain(false);
    }
  };

  const getReadinessDisplay = (domain: EmailDomain): ReadinessDisplay => {
    const resendStatus = domain.resend_status as any;

    // Check for readiness object from API (new format)
    if (resendStatus?.readiness?.status) {
      const r = resendStatus.readiness;
      return mapReadinessToDisplay(
        r.status,
        r.message,
        r.subMessage,
        r.cta,
        domain,
      );
    }

    // Fallback: compute from legacy fields
    return computeReadinessFromLegacy(domain, resendStatus);
  };

  const mapReadinessToDisplay = (
    status: ReadinessStatus,
    message: string,
    subMessage?: string,
    cta?: string | null,
    domain?: EmailDomain,
  ): ReadinessDisplay => {
    switch (status) {
      case "CONNECTED_READY":
        // Primary success state - confident, celebratory
        return {
          status,
          badge: { text: "Connected", variant: "green" },
          message:
            message || "Your email domain is connected and ready to use.",
          subMessage,
          showForceCheck: false,
        };
      // Legacy: still support READY_TO_SEND for backward compatibility
      case "READY_TO_SEND":
        return {
          status: "CONNECTED_READY",
          badge: { text: "Connected", variant: "green" },
          message:
            message || "Your email domain is connected and ready to use.",
          subMessage,
          showForceCheck: false,
        };
      // Legacy: still support READY_AWAITING_PROVIDER - map to CONNECTED_READY
      // since DNS is correct, user should feel DONE
      case "READY_AWAITING_PROVIDER":
        return {
          status: "CONNECTED_READY",
          badge: { text: "Connected", variant: "green" },
          message: "Your email domain is connected and ready to use.",
          subMessage: undefined, // Hide provider status from user
          showForceCheck: false,
        };
      case "ACTION_REQUIRED_DNS_MISSING":
        return {
          status,
          badge: { text: "Action Required", variant: "red" },
          message,
          subMessage,
          ctaLabel: cta || "Repair DNS",
          ctaAction: "repair",
          showForceCheck: false,
        };
      case "ACTION_REQUIRED_DNS_CONFLICT":
        return {
          status,
          badge: { text: "DNS Conflict", variant: "red" },
          message,
          subMessage,
          ctaLabel: cta || "Fix DNS Conflict",
          ctaAction: "fix_conflict",
          showForceCheck: false,
        };
      case "DOMAIN_NOT_CONNECTED":
      default:
        return {
          status,
          badge: { text: "Not Connected", variant: "gray" },
          message: message || "Domain isn't connected to BloomSuite yet.",
          ctaLabel: cta || "Connect DNS",
          ctaAction: "connect",
          showForceCheck: false,
        };
    }
  };

  const computeReadinessFromLegacy = (
    domain: EmailDomain,
    resendStatus: any,
  ): ReadinessDisplay => {
    // Check DNS verification status FIRST
    const records = resendStatus?.records || [];
    const allDnsVerified =
      records.length > 0 &&
      records.every((r: any) => r.dns_verified || r.status === "verified");
    const resendVerified =
      resendStatus?.status === "verified" || resendStatus?.dkim_verified;

    // Check for paused status (reputation issues) - show connected but with warning
    if (domain.status === "paused") {
      return {
        status: "CONNECTED_READY",
        badge: { text: "Paused", variant: "amber" },
        message: "Domain is currently paused.",
        subMessage: "Contact support for assistance.",
        showForceCheck: false,
      };
    }

    // If DNS is verified OR domain is active, show CONNECTED_READY - user should feel DONE
    if (
      allDnsVerified ||
      resendVerified ||
      domain.status === "active" ||
      resendStatus?.verification_phase === "dns_present_waiting_provider"
    ) {
      return mapReadinessToDisplay(
        "CONNECTED_READY",
        "Your email domain is connected and ready to use.",
      );
    }

    // Check for conflicts (highest priority error after checking active status)
    if (resendStatus?.dns_conflict_detected) {
      return mapReadinessToDisplay(
        "ACTION_REQUIRED_DNS_CONFLICT",
        "A conflicting DNS record is blocking email setup.",
        domain.is_entri_managed
          ? "We can fix this automatically."
          : "Please remove the conflicting CNAME record.",
        domain.is_entri_managed ? "Fix DNS Conflict" : undefined,
      );
    }

    // Domain has no DNS configured and isn't connected via any method
    if (
      !domain.is_entri_managed &&
      !domain.entri_connection_id &&
      !domain.resend_domain_id
    ) {
      return mapReadinessToDisplay(
        "DOMAIN_NOT_CONNECTED",
        "Domain isn't connected to BloomSuite yet.",
        "Set up automatic DNS configuration to get started.",
        "Connect DNS",
      );
    }

    // DNS not verified - action required
    if (domain.status === "failed") {
      return mapReadinessToDisplay(
        "ACTION_REQUIRED_DNS_MISSING",
        "Domain verification failed.",
        "Click Retry to try again.",
        "Retry",
      );
    }

    // Domain is pending/warming up - still in progress
    if (domain.status === "pending_dns" || domain.status === "verifying") {
      return {
        status: "CONNECTED_READY",
        badge: { text: "Verifying", variant: "amber" },
        message: "DNS verification in progress.",
        subMessage: "This may take a few minutes.",
        showForceCheck: true,
      };
    }

    if (domain.status === "warming_up") {
      return {
        status: "CONNECTED_READY",
        badge: { text: "Warming Up", variant: "amber" },
        message: "Your domain is connected and warming up.",
        subMessage: "Sending limits will increase over time.",
        showForceCheck: false,
      };
    }

    return mapReadinessToDisplay(
      "ACTION_REQUIRED_DNS_MISSING",
      "DNS records not visible yet.",
      domain.is_entri_managed
        ? "We can repair automatically."
        : "Please check your DNS configuration.",
      domain.is_entri_managed ? "Repair DNS" : undefined,
    );
  };

  // =========================================================
  // Rate Limiting for Force Check
  // =========================================================

  const canForceCheck = (domainId: string): boolean => {
    const lastCheck = lastCheckTimes[domainId] || 0;
    return Date.now() - lastCheck > RATE_LIMIT_MS;
  };

  const getTimeUntilNextCheck = (domainId: string): number => {
    const lastCheck = lastCheckTimes[domainId] || 0;
    const remaining = RATE_LIMIT_MS - (Date.now() - lastCheck);
    return Math.max(0, Math.ceil(remaining / 1000));
  };

  // =========================================================
  // Handlers
  // =========================================================

  const handleVerifyDomain = async (domainId: string, isRetry = false) => {
    // Rate limit check for non-retry operations
    if (!isRetry && !canForceCheck(domainId)) {
      const remaining = getTimeUntilNextCheck(domainId);
      const minutes = Math.floor(remaining / 60);
      const seconds = remaining % 60;
      toast.info(
        `Please wait ${minutes > 0 ? `${minutes}m ` : ""}${seconds}s before checking again`,
      );
      return;
    }

    try {
      setVerifyingDomains((prev) => new Set(prev).add(domainId));
      setLastCheckTimes((prev) => ({ ...prev, [domainId]: Date.now() }));

      if (isRetry) {
        await retryEmailDomain(domainId);
      } else {
        await verifyEmailDomain(domainId);
      }
    } catch (error: any) {
      console.error("Error verifying domain:", error);
    } finally {
      setVerifyingDomains((prev) => {
        const newSet = new Set(prev);
        newSet.delete(domainId);
        return newSet;
      });
    }
  };

  const handleRepairDomain = async (domain: EmailDomain) => {
    if (!tenant?.id) return;

    try {
      setRepairingDomains((prev) => new Set(prev).add(domain.id));

      const records = await getDomainRecords(domain.id);

      if (!records || records.length === 0) {
        toast.error(
          "No DNS records found. Please delete and re-add this domain.",
        );
        return;
      }

      const backendRecords = records.map((r) => ({
        name: r.name,
        type: r.type,
        value: r.value,
        priority: (r as any).priority,
        purpose: r.purpose,
      }));

      const { records: entriRecords, validation } = sanitizeAndConvertRecords(
        domain.domain,
        backendRecords,
      );

      if (!validation.valid) {
        toast.error(
          `Invalid DNS configuration: ${validation.errors.join(", ")}`,
        );
        return;
      }

      await openEntriSetup(
        domain.domain,
        tenant.id,
        entriRecords,
        async () => {
          toast.success("DNS records applied! Running verification...");
          setTimeout(async () => {
            try {
              await verifyEmailDomain(domain.id);
              refetch();
            } catch (e) {
              console.error("Post-repair verification failed:", e);
            }
          }, 2000);
        },
        () => {
          toast.info("DNS repair cancelled");
        },
      );
    } catch (error: any) {
      console.error("Error repairing domain:", error);
      toast.error(error.message || "Failed to repair domain");
    } finally {
      setRepairingDomains((prev) => {
        const newSet = new Set(prev);
        newSet.delete(domain.id);
        return newSet;
      });
    }
  };

  const getLastCheckedText = (domain: EmailDomain) => {
    if (!domain.last_verify_attempt_at) return null;
    try {
      return `Checked ${formatDistanceToNow(new Date(domain.last_verify_attempt_at), { addSuffix: true })}`;
    } catch {
      return null;
    }
  };

  const getIndicatorConfig = (
    domain: EmailDomain,
    display: ReadinessDisplay,
  ) => {
    if (domain.status === "failed" || domain.status === "error") {
      return {
        color: "danger" as const,
        icon: XCircle,
      };
    }

    switch (display.status) {
      case "CONNECTED_READY":
      case "READY_TO_SEND":
      case "READY_AWAITING_PROVIDER":
        return {
          color: "success" as const,
          icon: CheckCircle,
        };
      case "ACTION_REQUIRED_DNS_MISSING":
        return {
          color: "warning" as const,
          icon: AlertTriangle,
        };
      case "ACTION_REQUIRED_DNS_CONFLICT":
        return {
          color: "danger" as const,
          icon: AlertTriangle,
        };
      case "DOMAIN_NOT_CONNECTED":
      default:
        return {
          color: "neutral" as const,
          icon: Globe,
        };
    }
  };

  const handleRetryLoad = async () => {
    setLoadError(null);

    try {
      await refetch();
    } catch (error: any) {
      setLoadError(error?.message || "Failed to load domains.");
    }
  };

  // =========================================================
  // Render
  // =========================================================

  if (loading) {
    return (
      <Stack spacing={1.5}>
        {Array.from({ length: 3 }).map((_, index) => (
          <Sheet
            key={index}
            variant="outlined"
            sx={{
              bgcolor: "background.surface",
              borderRadius: "sm",
              p: 2,
            }}
          >
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "32px minmax(0, 1fr) 72px",
                },
                alignItems: "center",
                gap: 2,
              }}
            >
              <Skeleton
                animation="wave"
                variant="circular"
                sx={{ height: 32, width: 32 }}
              />
              <Stack spacing={1} sx={{ minWidth: 0 }}>
                <Skeleton animation="wave" sx={{ height: 16, width: "35%" }} />
                <Skeleton animation="wave" sx={{ height: 14, width: "55%" }} />
              </Stack>
              <Skeleton
                animation="wave"
                sx={{
                  height: 32,
                  width: 72,
                  justifySelf: { xs: "flex-start", sm: "flex-end" },
                }}
              />
            </Box>
          </Sheet>
        ))}
      </Stack>
    );
  }

  if (loadError) {
    return (
      <Sheet
        color="danger"
        variant="soft"
        sx={{
          bgcolor: "background.surface",
          borderRadius: "sm",
          p: 3,
        }}
      >
        <Stack spacing={1.5} alignItems="center" textAlign="center">
          <AlertTriangle size={20} />
          <Typography level="title-sm">Unable to load domains</Typography>
          <Typography level="body-sm" color="neutral">
            {loadError}
          </Typography>
          <Button
            color="danger"
            size="sm"
            variant="outlined"
            onClick={handleRetryLoad}
          >
            Retry
          </Button>
        </Stack>
      </Sheet>
    );
  }

  return (
    <>
      {emailDomains.length === 0 ? (
        <Sheet
          variant="outlined"
          sx={{
            bgcolor: "background.surface",
            borderRadius: "md",
            borderStyle: "dashed",
            py: 6,
            px: 4,
          }}
        >
          <Stack spacing={2} alignItems="center" textAlign="center">
            <Globe
              size={40}
              style={{ color: "var(--joy-palette-neutral-400)" }}
            />
            <Typography level="title-md" sx={{ fontWeight: 600 }}>
              No domains configured
            </Typography>
            <Typography level="body-sm" color="neutral" sx={{ maxWidth: 420 }}>
              Adding a custom sending domain improves inbox placement and keeps
              your brand visible in every campaign.
            </Typography>
            <Button
              color="neutral"
              size="sm"
              startDecorator={<Plus size={16} />}
              variant="outlined"
              onClick={() => onAddDomainOpenChange(true)}
            >
              Add Domain
            </Button>
          </Stack>
        </Sheet>
      ) : (
        <Stack spacing={1.5}>
          {emailDomains.map((domain) => {
            const display = getReadinessDisplay(domain);
            const indicator = getIndicatorConfig(domain, display);
            const lastChecked = getLastCheckedText(domain);
            const isVerifying = verifyingDomains.has(domain.id);
            const isRepairing = repairingDomains.has(domain.id);
            const isFailed =
              domain.status === "failed" || domain.status === "error";
            const canCheck = canForceCheck(domain.id);
            const cooldownSeconds = getTimeUntilNextCheck(domain.id);
            const isOperational =
              domain.status === "active" || domain.status === "warming_up";
            const isDefault =
              !!defaultDomainId && domain.id === defaultDomainId;
            const IndicatorIcon = indicator.icon;

            return (
              <Sheet
                key={domain.id}
                variant="outlined"
                sx={{
                  bgcolor: "background.surface",
                  borderRadius: "sm",
                  p: 2,
                  transition: "border-color 160ms ease",
                  "&:hover": {
                    borderColor: "neutral.outlinedHoverBorder",
                  },
                }}
              >
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "1fr",
                      lg: "minmax(0, 1.8fr) auto auto",
                    },
                    alignItems: "center",
                    gap: 2,
                  }}
                >
                  <Stack
                    direction="row"
                    spacing={1.5}
                    alignItems="center"
                    sx={{ minWidth: 0 }}
                  >
                    <Box
                      sx={{
                        width: 32,
                        height: 32,
                        borderRadius: "999px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        bgcolor: `${indicator.color}.softBg`,
                        color: `${indicator.color}.plainColor`,
                        flexShrink: 0,
                      }}
                    >
                      <IndicatorIcon size={16} />
                    </Box>

                    <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                      <Typography
                        level="title-sm"
                        sx={{ fontFamily: "code", fontWeight: 600 }}
                      >
                        {domain.domain}
                      </Typography>
                      <Typography level="body-xs" color="neutral">
                        {display.message}
                      </Typography>
                      {display.subMessage ? (
                        <Typography level="body-xs" color="neutral">
                          {display.subMessage}
                        </Typography>
                      ) : null}
                    </Stack>
                  </Stack>

                  <Stack
                    direction="row"
                    spacing={0.5}
                    useFlexGap
                    flexWrap="wrap"
                    alignItems="center"
                  >
                    <Chip
                      color={badgeToneMap[display.badge.variant]}
                      size="sm"
                      variant="soft"
                    >
                      {display.badge.text}
                    </Chip>
                    {isDefault ? (
                      <Chip color="primary" size="sm" variant="soft">
                        Default
                      </Chip>
                    ) : null}
                    {domain.is_sandbox ? (
                      <Chip color="neutral" size="sm" variant="outlined">
                        Sandbox
                      </Chip>
                    ) : null}
                  </Stack>

                  <Stack
                    direction="row"
                    spacing={1}
                    useFlexGap
                    alignItems="center"
                    justifyContent={{ xs: "flex-start", lg: "flex-end" }}
                    flexWrap="wrap"
                  >
                    {lastChecked ? (
                      <Typography
                        level="body-xs"
                        color="neutral"
                        sx={{ whiteSpace: "nowrap" }}
                      >
                        {lastChecked}
                      </Typography>
                    ) : null}

                    <Tooltip title="Domain details">
                      <IconButton
                        color="neutral"
                        size="sm"
                        variant="plain"
                        onClick={() => setSelectedDomain(domain.id)}
                      >
                        <Settings size={16} />
                      </IconButton>
                    </Tooltip>

                    {display.showForceCheck && !isFailed ? (
                      <Tooltip
                        title={
                          canCheck || isVerifying
                            ? "Check DNS Status"
                            : `Available in ${formatCooldown(cooldownSeconds)}`
                        }
                      >
                        <span>
                          <IconButton
                            color="neutral"
                            disabled={isVerifying || !canCheck}
                            size="sm"
                            variant="plain"
                            onClick={() => handleVerifyDomain(domain.id)}
                          >
                            <Box
                              component="span"
                              sx={isVerifying ? SPIN_SX : undefined}
                            >
                              <RefreshCw size={16} />
                            </Box>
                          </IconButton>
                        </span>
                      </Tooltip>
                    ) : null}

                    {isOperational ? (
                      <Button
                        color="neutral"
                        disabled={savingDefaultDomain}
                        size="sm"
                        variant="plain"
                        onClick={() =>
                          setDefaultSendingDomain(isDefault ? null : domain.id)
                        }
                      >
                        {isDefault ? "Clear default" : "Set default"}
                      </Button>
                    ) : null}

                    {isFailed ? (
                      <Button
                        color="warning"
                        disabled={isVerifying}
                        size="sm"
                        variant="soft"
                        onClick={() => handleVerifyDomain(domain.id, true)}
                      >
                        Retry
                      </Button>
                    ) : null}

                    {display.ctaAction && domain.is_entri_managed ? (
                      <Button
                        color="warning"
                        disabled={isRepairing || entriLoading}
                        size="sm"
                        startDecorator={
                          isRepairing ? (
                            <Box component="span" sx={SPIN_SX}>
                              <RefreshCw size={16} />
                            </Box>
                          ) : (
                            <Wrench size={16} />
                          )
                        }
                        variant="soft"
                        onClick={() => {
                          if (
                            display.ctaAction === "repair" ||
                            display.ctaAction === "fix_conflict"
                          ) {
                            handleRepairDomain(domain);
                          }
                        }}
                      >
                        {isRepairing
                          ? "Fixing..."
                          : display.ctaAction === "fix_conflict"
                            ? "Fix DNS"
                            : display.ctaLabel}
                      </Button>
                    ) : null}
                  </Stack>
                </Box>
              </Sheet>
            );
          })}
        </Stack>
      )}

      <DomainConnectWizard
        open={addDomainOpen}
        onClose={() => {
          onAddDomainOpenChange(false);
          setLoadError(null);
          refetch();
        }}
      />

      {selectedDomain && (
        <EmailDomainDetails
          domainId={selectedDomain}
          open={!!selectedDomain}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedDomain(null);
              refetch();
            }
          }}
        />
      )}
    </>
  );
};
