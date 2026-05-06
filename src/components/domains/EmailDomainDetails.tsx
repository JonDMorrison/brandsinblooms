import React, { useEffect, useMemo, useState } from "react";
import Accordion from "@mui/joy/Accordion";
import AccordionDetails from "@mui/joy/AccordionDetails";
import AccordionGroup from "@mui/joy/AccordionGroup";
import AccordionSummary from "@mui/joy/AccordionSummary";
import Alert from "@mui/joy/Alert";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Chip from "@mui/joy/Chip";
import DialogActions from "@mui/joy/DialogActions";
import DialogContent from "@mui/joy/DialogContent";
import DialogTitle from "@mui/joy/DialogTitle";
import Divider from "@mui/joy/Divider";
import IconButton from "@mui/joy/IconButton";
import Input from "@mui/joy/Input";
import Modal from "@mui/joy/Modal";
import ModalClose from "@mui/joy/ModalClose";
import ModalDialog from "@mui/joy/ModalDialog";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Tooltip from "@mui/joy/Tooltip";
import Typography from "@mui/joy/Typography";
import { Check, Copy, Edit2, RefreshCw, Trash2, X } from "lucide-react";
import {
  useEmailDomains,
  EmailDomain,
  EmailDnsRecord,
  EmailDnsCheck,
} from "@/hooks/useEmailDomains";
import useMediaQuery from "@/hooks/use-media-query";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface EmailDomainDetailsProps {
  domainId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ReadinessStatus =
  | "CONNECTED_READY"
  | "ACTION_REQUIRED_DNS_MISSING"
  | "ACTION_REQUIRED_DNS_CONFLICT"
  | "DOMAIN_NOT_CONNECTED"
  | "READY_TO_SEND"
  | "READY_AWAITING_PROVIDER";

interface ReadinessDisplay {
  status: ReadinessStatus;
  badge: { text: string; variant: "green" | "amber" | "red" | "gray" };
  message: string;
  subMessage?: string;
  showForceCheck: boolean;
}

const RATE_LIMIT_MS = 5 * 60 * 1000;

const badgeToneMap = {
  green: "success",
  amber: "warning",
  red: "danger",
  gray: "neutral",
} as const;

const purposeLabelMap: Record<string, string> = {
  dkim: "DKIM",
  spf: "SPF",
  return_path: "Return Path",
  verification: "Verification",
  dmarc: "DMARC",
};

const formatCooldown = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return minutes > 0
    ? `${minutes}m ${String(remainingSeconds).padStart(2, "0")}s`
    : `${remainingSeconds}s`;
};

const formatDate = (value?: string | null) => {
  if (!value) return "Unknown";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Unknown";
  }

  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const formatCheckTime = (value?: string | null) => {
  if (!value) return null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return formatDistanceToNow(parsed, { addSuffix: true });
};

const formatPurposeLabel = (purpose?: string | null) => {
  if (!purpose) return "Record";
  return purposeLabelMap[purpose] || purpose.replace(/_/g, " ");
};

const mapReadinessToDisplay = (
  status: ReadinessStatus,
  message: string,
  subMessage?: string | null,
): ReadinessDisplay => {
  switch (status) {
    case "CONNECTED_READY":
    case "READY_TO_SEND":
    case "READY_AWAITING_PROVIDER":
      return {
        status: "CONNECTED_READY",
        badge: { text: "Connected", variant: "green" },
        message:
          status === "READY_AWAITING_PROVIDER"
            ? "Your email domain is connected and ready to use."
            : message || "Your email domain is connected and ready to use.",
        subMessage:
          status === "READY_AWAITING_PROVIDER"
            ? undefined
            : subMessage || undefined,
        showForceCheck: false,
      };
    case "ACTION_REQUIRED_DNS_MISSING":
      return {
        status,
        badge: { text: "Action Required", variant: "red" },
        message,
        subMessage: subMessage || undefined,
        showForceCheck: false,
      };
    case "ACTION_REQUIRED_DNS_CONFLICT":
      return {
        status,
        badge: { text: "DNS Conflict", variant: "red" },
        message,
        subMessage: subMessage || undefined,
        showForceCheck: false,
      };
    case "DOMAIN_NOT_CONNECTED":
    default:
      return {
        status,
        badge: { text: "Not Connected", variant: "gray" },
        message: message || "Domain isn't connected to BloomSuite yet.",
        subMessage: subMessage || undefined,
        showForceCheck: false,
      };
  }
};

const computeReadinessFromLegacy = (
  domain: EmailDomain,
  resendStatus: any,
): ReadinessDisplay => {
  const records = resendStatus?.records || [];
  const allDnsVerified =
    records.length > 0 &&
    records.every(
      (record: any) => record.dns_verified || record.status === "verified",
    );
  const resendVerified =
    resendStatus?.status === "verified" || resendStatus?.dkim_verified;

  if (domain.status === "paused") {
    return {
      status: "CONNECTED_READY",
      badge: { text: "Paused", variant: "amber" },
      message: "Your domain is connected, but sending is currently paused.",
      subMessage:
        domain.error || "Resolve the provider issue to resume sending.",
      showForceCheck: false,
    };
  }

  if (allDnsVerified && resendVerified) {
    return {
      status: "CONNECTED_READY",
      badge: { text: "Connected", variant: "green" },
      message: "Your email domain is connected and ready to use.",
      showForceCheck: false,
    };
  }

  if (domain.status === "failed" || domain.status === "error") {
    return {
      status: "ACTION_REQUIRED_DNS_MISSING",
      badge: { text: "Action Required", variant: "red" },
      message: domain.error || "Domain verification failed.",
      subMessage: "Review the DNS records below and retry verification.",
      showForceCheck: false,
    };
  }

  if (domain.status === "pending_dns" || domain.status === "verifying") {
    return {
      status: "CONNECTED_READY",
      badge: { text: "Verifying", variant: "amber" },
      message: "DNS verification is in progress.",
      subMessage: "This may take a few minutes depending on propagation.",
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

  return {
    status: "DOMAIN_NOT_CONNECTED",
    badge: { text: "Not Connected", variant: "gray" },
    message: "DNS records are not visible yet.",
    subMessage: domain.is_entri_managed
      ? "Automatic repair may still resolve this."
      : "Please review the DNS record values below.",
    showForceCheck: false,
  };
};

const getReadinessDisplay = (domain: EmailDomain): ReadinessDisplay => {
  const resendStatus = domain.resend_status as any;

  if (resendStatus?.readiness?.status) {
    const readiness = resendStatus.readiness;
    return mapReadinessToDisplay(
      readiness.status,
      readiness.message,
      readiness.subMessage,
    );
  }

  return computeReadinessFromLegacy(domain, resendStatus);
};

export const EmailDomainDetails = ({
  domainId,
  open,
  onOpenChange,
}: EmailDomainDetailsProps) => {
  const {
    emailDomains,
    getDomainRecords,
    getDomainChecks,
    verifyEmailDomain,
    updateEmailDomain,
    deleteEmailDomain,
    refetch,
  } = useEmailDomains();

  const isMobile = useMediaQuery("(max-width: 767.95px)");
  const domain = useMemo(
    () => emailDomains.find((item) => item.id === domainId) ?? null,
    [domainId, emailDomains],
  );

  const [records, setRecords] = useState<EmailDnsRecord[]>([]);
  const [checks, setChecks] = useState<EmailDnsCheck[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [checksLoading, setChecksLoading] = useState(false);
  const [recordsError, setRecordsError] = useState<string | null>(null);
  const [checksError, setChecksError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editingReportEmail, setEditingReportEmail] = useState(false);
  const [reportEmail, setReportEmail] = useState("");
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [lastCheckTimes, setLastCheckTimes] = useState<Record<string, number>>(
    {},
  );

  const readiness = domain ? getReadinessDisplay(domain) : null;
  const canVerify = domain
    ? Date.now() - (lastCheckTimes[domain.id] || 0) > RATE_LIMIT_MS
    : false;
  const cooldownSeconds = domain
    ? Math.max(
        0,
        Math.ceil(
          (RATE_LIMIT_MS - (Date.now() - (lastCheckTimes[domain.id] || 0))) /
            1000,
        ),
      )
    : 0;
  const evidence = useMemo(() => {
    const resendStatus = domain?.resend_status as any;

    return {
      directDns: resendStatus?.direct_dns || {
        verified: false,
        checks: [],
      },
      provider: resendStatus?.provider || {
        status: resendStatus?.status || "unknown",
        dkim_verified: resendStatus?.dkim_verified || false,
        spf_verified: resendStatus?.spf_verified || false,
        return_path_verified: resendStatus?.return_path_verified || false,
        last_checked_at: domain?.last_verify_attempt_at,
      },
      conflicts: resendStatus?.conflicts || {
        detected: resendStatus?.dns_conflict_detected || false,
        details: resendStatus?.dns_conflict_details || [],
      },
      records: resendStatus?.records || [],
    };
  }, [domain]);

  useEffect(() => {
    if (domain && !editingReportEmail) {
      setReportEmail(domain.report_email || "");
    }
  }, [domain, editingReportEmail]);

  useEffect(() => {
    if (!open || !domainId) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      setRecords([]);
      setChecks([]);
      setRecordsError(null);
      setChecksError(null);
      setRecordsLoading(true);
      setChecksLoading(true);

      try {
        const [recordsData, checksData] = await Promise.all([
          getDomainRecords(domainId),
          getDomainChecks(domainId),
        ]);

        if (cancelled) {
          return;
        }

        setRecords(recordsData);
        setChecks(checksData);
      } catch (error: any) {
        if (cancelled) {
          return;
        }

        const message = error?.message || "Failed to load domain details";
        setRecordsError(message);
        setChecksError(message);
        toast.error("Failed to load domain details");
      } finally {
        if (!cancelled) {
          setRecordsLoading(false);
          setChecksLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [domainId, open]);

  useEffect(() => {
    if (!open) {
      setConfirmDeleteOpen(false);
      setEditingReportEmail(false);
    }
  }, [open]);

  const loadDomainData = async () => {
    if (!domainId) {
      return;
    }

    try {
      setRecordsError(null);
      setChecksError(null);
      setRecordsLoading(true);
      setChecksLoading(true);

      const [recordsData, checksData] = await Promise.all([
        getDomainRecords(domainId),
        getDomainChecks(domainId),
      ]);

      setRecords(recordsData);
      setChecks(checksData);
    } catch (error: any) {
      const message = error?.message || "Failed to load domain details";
      setRecordsError(message);
      setChecksError(message);
      toast.error("Failed to load domain details");
    } finally {
      setRecordsLoading(false);
      setChecksLoading(false);
    }
  };

  const handleCopyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  const handleVerify = async () => {
    if (!domain) {
      return;
    }

    if (!canVerify) {
      toast.info(
        `Checked recently, try again in ${formatCooldown(cooldownSeconds)}`,
      );
      return;
    }

    try {
      setVerifying(true);
      setLastCheckTimes((prev) => ({ ...prev, [domain.id]: Date.now() }));
      const result = await verifyEmailDomain(domainId);

      if ((result as any)?.rate_limited) {
        return;
      }

      if ((result as any)?.allVerified) {
        toast.success("Domain verification completed successfully!");
      } else {
        toast.warning("Some DNS records are not yet configured correctly.");
      }

      await loadDomainData();
    } catch (error: any) {
      toast.error(error?.message || "Failed to verify domain");
    } finally {
      setVerifying(false);
    }
  };

  const handleSaveReportEmail = async () => {
    if (!domain) {
      return;
    }

    try {
      await updateEmailDomain(domainId, {
        report_email: reportEmail.trim() || null,
      });

      setEditingReportEmail(false);
      toast.success("Report email updated successfully");
    } catch (error: any) {
      toast.error(error?.message || "Failed to update report email");
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await deleteEmailDomain(domainId);
      toast.success("Domain deleted successfully");
      setConfirmDeleteOpen(false);
      onOpenChange(false);
      refetch();
    } catch (error: any) {
      toast.error(error?.message || "Failed to delete domain");
    } finally {
      setDeleting(false);
    }
  };

  const getRecordStatus = (record: EmailDnsRecord) => {
    const latestCheck = checks.find(
      (check) => check.check_name === record.purpose,
    );
    return latestCheck?.ok;
  };

  const getStatusDotColor = (status: boolean | undefined) => {
    if (status === true) {
      return "success.solidBg";
    }

    if (status === false) {
      return "danger.solidBg";
    }

    return "warning.solidBg";
  };

  const renderSkeletonRows = () => (
    <Stack spacing={1}>
      {Array.from({ length: 3 }).map((_, index) => (
        <Sheet
          key={index}
          variant="outlined"
          sx={{
            bgcolor: "background.surface",
            borderRadius: "sm",
            p: 1.5,
          }}
        >
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "25% minmax(0, 1fr) 28px",
              alignItems: "center",
              gap: 1.5,
            }}
          >
            <Skeleton animation="wave" sx={{ height: 16, width: "100%" }} />
            <Skeleton animation="wave" sx={{ height: 16, width: "60%" }} />
            <Skeleton
              animation="wave"
              variant="rectangular"
              sx={{ width: 28, height: 28 }}
            />
          </Box>
        </Sheet>
      ))}
    </Stack>
  );

  return (
    <>
      <Modal
        open={open}
        onClose={() => {
          if (!deleting) {
            onOpenChange(false);
          }
        }}
      >
        <ModalDialog
          layout={isMobile ? "fullscreen" : "center"}
          size={isMobile ? undefined : "lg"}
          variant="outlined"
          sx={{
            bgcolor: "background.surface",
            width: { xs: "100vw", sm: "100%" },
            maxWidth: { xs: "100vw", sm: 640 },
            maxHeight: { xs: "100vh", sm: "85vh" },
            overflow: "auto",
            borderRadius: { xs: 0, sm: "md" },
            p: { xs: 2, sm: 3 },
            boxShadow: "lg",
          }}
        >
          <ModalClose />
          <Stack spacing={3}>
            <Stack spacing={1.5} sx={{ pr: 4 }}>
              <DialogTitle sx={{ p: 0 }}>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1}
                  alignItems={{ xs: "flex-start", sm: "center" }}
                  useFlexGap
                >
                  <Typography
                    level="title-lg"
                    sx={{ fontFamily: "code", fontWeight: 700 }}
                  >
                    {domain?.domain || "Domain details"}
                  </Typography>
                  {readiness ? (
                    <Chip
                      color={badgeToneMap[readiness.badge.variant]}
                      size="sm"
                      variant="soft"
                    >
                      {readiness.badge.text}
                    </Chip>
                  ) : null}
                </Stack>
              </DialogTitle>

              {domain ? (
                <Sheet
                  color="neutral"
                  variant="soft"
                  sx={{ borderRadius: "sm", p: 2 }}
                >
                  <Stack spacing={1.75}>
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 1.5,
                      }}
                    >
                      <Stack spacing={0.5}>
                        <Typography level="body-xs" color="neutral">
                          Domain
                        </Typography>
                        <Typography level="body-sm" sx={{ fontFamily: "code" }}>
                          {domain.domain}
                        </Typography>
                      </Stack>

                      <Stack spacing={0.5}>
                        <Typography level="body-xs" color="neutral">
                          Status
                        </Typography>
                        <Box>
                          <Chip
                            color={
                              badgeToneMap[readiness?.badge.variant || "gray"]
                            }
                            size="sm"
                            variant="soft"
                          >
                            {readiness?.badge.text || "Unknown"}
                          </Chip>
                        </Box>
                      </Stack>

                      <Stack spacing={0.5}>
                        <Typography level="body-xs" color="neutral">
                          Environment
                        </Typography>
                        {domain.is_sandbox ? (
                          <Box>
                            <Chip color="neutral" size="sm" variant="outlined">
                              Sandbox
                            </Chip>
                          </Box>
                        ) : (
                          <Typography level="body-sm">Production</Typography>
                        )}
                      </Stack>

                      <Stack spacing={0.5}>
                        <Typography level="body-xs" color="neutral">
                          Added
                        </Typography>
                        <Typography level="body-sm">
                          {formatDate(domain.created_at)}
                        </Typography>
                      </Stack>
                    </Box>

                    {domain.is_sandbox ? (
                      <Typography level="body-xs" color="neutral">
                        Sandbox domains auto-apply DNS and stay limited to
                        testing workflows.
                      </Typography>
                    ) : null}

                    {domain.status !== "active" && !domain.is_sandbox ? (
                      <Alert color="warning" size="sm" variant="soft">
                        <Stack spacing={0.25}>
                          <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                            Setup in progress
                          </Typography>
                          <Typography level="body-xs">
                            Verification is still running and DNS propagation
                            can take up to 72 hours.
                          </Typography>
                        </Stack>
                      </Alert>
                    ) : null}

                    <Divider />

                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={1}
                      justifyContent="space-between"
                      alignItems={{ xs: "flex-start", sm: "center" }}
                      useFlexGap
                    >
                      <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                        <Typography level="body-xs" color="neutral">
                          DMARC Reports
                        </Typography>
                        {editingReportEmail ? (
                          <Stack
                            direction="row"
                            spacing={0.5}
                            alignItems="center"
                          >
                            <Input
                              placeholder="reports@yourdomain.com"
                              size="sm"
                              sx={{ minWidth: { xs: "100%", sm: 260 } }}
                              value={reportEmail}
                              onChange={(event) =>
                                setReportEmail(event.target.value)
                              }
                            />
                            <IconButton
                              color="neutral"
                              size="sm"
                              variant="plain"
                              onClick={handleSaveReportEmail}
                            >
                              <Check size={16} />
                            </IconButton>
                            <IconButton
                              color="neutral"
                              size="sm"
                              variant="plain"
                              onClick={() => {
                                setEditingReportEmail(false);
                                setReportEmail(domain.report_email || "");
                              }}
                            >
                              <X size={16} />
                            </IconButton>
                          </Stack>
                        ) : (
                          <Typography
                            level="body-sm"
                            sx={{
                              fontFamily: reportEmail ? "code" : "inherit",
                            }}
                          >
                            {domain.report_email || "Not configured"}
                          </Typography>
                        )}
                      </Stack>

                      {!editingReportEmail ? (
                        <IconButton
                          color="neutral"
                          size="sm"
                          variant="plain"
                          onClick={() => setEditingReportEmail(true)}
                        >
                          <Edit2 size={16} />
                        </IconButton>
                      ) : null}
                    </Stack>
                  </Stack>
                </Sheet>
              ) : (
                <Sheet
                  color="neutral"
                  variant="soft"
                  sx={{ borderRadius: "sm", p: 2 }}
                >
                  <Typography level="body-sm" color="neutral">
                    Loading domain summary...
                  </Typography>
                </Sheet>
              )}
            </Stack>

            <Stack spacing={1.5}>
              <Typography level="title-sm" sx={{ fontWeight: 600 }}>
                DNS Records
              </Typography>

              {recordsError ? (
                <Alert color="danger" size="sm" variant="soft">
                  <Stack spacing={1}>
                    <Typography level="body-sm">
                      Unable to load DNS records.
                    </Typography>
                    <Button
                      color="danger"
                      size="sm"
                      variant="outlined"
                      onClick={loadDomainData}
                    >
                      Retry
                    </Button>
                  </Stack>
                </Alert>
              ) : recordsLoading ? (
                renderSkeletonRows()
              ) : records.length > 0 ? (
                <Stack spacing={1}>
                  {records.map((record) => {
                    const recordStatus = checksLoading
                      ? undefined
                      : getRecordStatus(record);
                    const statusLabel =
                      recordStatus === true
                        ? "Verified"
                        : recordStatus === false
                          ? "Check failed"
                          : checksLoading
                            ? "Loading checks"
                            : "Pending check";
                    const rawType = (
                      record as EmailDnsRecord & { type: string }
                    ).type;
                    const priority = (
                      record as EmailDnsRecord & { priority?: number }
                    ).priority;
                    const isLongValue = record.value.length > 72;

                    return (
                      <Sheet
                        key={record.id}
                        variant="outlined"
                        sx={{
                          bgcolor: "background.surface",
                          borderRadius: "sm",
                          p: 1.5,
                        }}
                      >
                        <Stack spacing={1}>
                          <Stack
                            direction="row"
                            spacing={1}
                            justifyContent="space-between"
                            alignItems="center"
                            useFlexGap
                            flexWrap="wrap"
                          >
                            <Stack
                              direction="row"
                              spacing={0.75}
                              useFlexGap
                              flexWrap="wrap"
                            >
                              <Chip color="neutral" size="sm" variant="soft">
                                {rawType}
                              </Chip>
                              <Chip
                                color="neutral"
                                size="sm"
                                variant="outlined"
                              >
                                {formatPurposeLabel(record.purpose)}
                              </Chip>
                            </Stack>

                            <Stack
                              direction="row"
                              spacing={0.75}
                              alignItems="center"
                              useFlexGap
                            >
                              <Tooltip title={statusLabel}>
                                <Box
                                  sx={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: "50%",
                                    bgcolor: getStatusDotColor(recordStatus),
                                    flexShrink: 0,
                                  }}
                                />
                              </Tooltip>
                              {record.applied_automatically ? (
                                <Chip color="primary" size="sm" variant="soft">
                                  Auto-applied
                                </Chip>
                              ) : null}
                            </Stack>
                          </Stack>

                          <Stack spacing={1} sx={{ mt: 1 }}>
                            <Box
                              sx={{
                                display: "grid",
                                gridTemplateColumns: "56px minmax(0, 1fr) auto",
                                gap: 1,
                                alignItems: "start",
                              }}
                            >
                              <Typography level="body-xs" color="neutral">
                                Host
                              </Typography>
                              <Tooltip title={record.name}>
                                <Typography
                                  level="body-xs"
                                  sx={{
                                    fontFamily: "code",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    maxWidth: "100%",
                                  }}
                                >
                                  {record.name}
                                </Typography>
                              </Tooltip>
                              <IconButton
                                color="neutral"
                                size="sm"
                                variant="plain"
                                onClick={() =>
                                  handleCopyToClipboard(record.name)
                                }
                              >
                                <Copy size={14} />
                              </IconButton>
                            </Box>

                            <Box
                              sx={{
                                display: "grid",
                                gridTemplateColumns: "56px minmax(0, 1fr) auto",
                                gap: 1,
                                alignItems: "start",
                              }}
                            >
                              <Typography level="body-xs" color="neutral">
                                Value
                              </Typography>
                              <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                                <Tooltip title={record.value}>
                                  <Typography
                                    level="body-xs"
                                    sx={{
                                      fontFamily: "code",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                      maxWidth: "100%",
                                    }}
                                  >
                                    {record.value}
                                  </Typography>
                                </Tooltip>
                                {priority !== undefined || rawType === "MX" ? (
                                  <Typography level="body-xs" color="neutral">
                                    Priority {priority ?? "Required"}
                                  </Typography>
                                ) : null}
                                {isLongValue ? (
                                  <Typography level="body-xs" color="neutral">
                                    Hover to inspect the full value.
                                  </Typography>
                                ) : null}
                              </Stack>
                              <IconButton
                                color="neutral"
                                size="sm"
                                variant="plain"
                                onClick={() =>
                                  handleCopyToClipboard(record.value)
                                }
                              >
                                <Copy size={14} />
                              </IconButton>
                            </Box>
                          </Stack>
                        </Stack>
                      </Sheet>
                    );
                  })}
                </Stack>
              ) : (
                <Sheet
                  variant="outlined"
                  sx={{
                    bgcolor: "background.surface",
                    borderRadius: "sm",
                    p: 2,
                  }}
                >
                  <Typography level="body-sm" color="neutral">
                    No DNS records are available for this domain yet.
                  </Typography>
                </Sheet>
              )}

              <Tooltip
                title={
                  canVerify
                    ? "Verify DNS"
                    : `Checked recently, try again in ${formatCooldown(cooldownSeconds)}`
                }
              >
                <span>
                  <Button
                    color="neutral"
                    disabled={verifying || !canVerify}
                    loading={verifying}
                    loadingPosition="start"
                    size="sm"
                    startDecorator={!verifying ? <RefreshCw size={14} /> : null}
                    variant="outlined"
                    onClick={handleVerify}
                  >
                    Verify DNS
                  </Button>
                </span>
              </Tooltip>
            </Stack>

            <AccordionGroup>
              <Accordion>
                <AccordionSummary>
                  <Typography level="body-sm" color="neutral">
                    Technical Details
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  {checksError ? (
                    <Alert color="danger" size="sm" variant="soft">
                      <Stack spacing={1}>
                        <Typography level="body-sm">
                          Unable to load verification evidence.
                        </Typography>
                        <Button
                          color="danger"
                          size="sm"
                          variant="outlined"
                          onClick={loadDomainData}
                        >
                          Retry
                        </Button>
                      </Stack>
                    </Alert>
                  ) : checksLoading ? (
                    <Skeleton
                      animation="wave"
                      variant="rectangular"
                      sx={{ height: 80, borderRadius: "sm" }}
                    />
                  ) : (
                    <Sheet
                      color="neutral"
                      variant="soft"
                      sx={{ borderRadius: "sm", p: 2 }}
                    >
                      <Stack spacing={1.5}>
                        {evidence.directDns?.checks?.length > 0 ? (
                          <Stack spacing={0.75}>
                            <Typography level="body-xs" color="neutral">
                              Public DNS checks
                            </Typography>
                            {evidence.directDns.checks.map(
                              (check: any, index: number) => (
                                <Box
                                  key={`${check.record_type}-${index}`}
                                  sx={{
                                    display: "grid",
                                    gridTemplateColumns:
                                      "minmax(0, 132px) auto minmax(0, 1fr)",
                                    gap: 1,
                                    alignItems: "start",
                                  }}
                                >
                                  <Typography
                                    level="body-xs"
                                    sx={{ fontFamily: "code" }}
                                  >
                                    {check.record_type}
                                  </Typography>
                                  <Box
                                    sx={{
                                      width: 8,
                                      height: 8,
                                      borderRadius: "50%",
                                      bgcolor: check.found
                                        ? "success.solidBg"
                                        : "danger.solidBg",
                                      mt: 0.5,
                                    }}
                                  />
                                  <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                                    <Typography
                                      level="body-xs"
                                      sx={{ fontFamily: "code" }}
                                    >
                                      {check.fqdn}
                                    </Typography>
                                    <Typography level="body-xs" color="neutral">
                                      {check.found
                                        ? "Expected value was found in public DNS."
                                        : "Expected value was not found in public DNS."}
                                    </Typography>
                                    <Typography
                                      level="body-xs"
                                      sx={{ fontFamily: "code" }}
                                    >
                                      Expected: {check.expected}
                                    </Typography>
                                    {check.actual_values?.length ? (
                                      <Typography
                                        level="body-xs"
                                        sx={{ fontFamily: "code" }}
                                      >
                                        Actual: {check.actual_values.join(", ")}
                                      </Typography>
                                    ) : null}
                                  </Stack>
                                </Box>
                              ),
                            )}
                          </Stack>
                        ) : evidence.records.length > 0 ? (
                          <Stack spacing={0.75}>
                            <Typography level="body-xs" color="neutral">
                              Public DNS checks
                            </Typography>
                            {evidence.records.map(
                              (record: any, index: number) => (
                                <Box
                                  key={`${record.type || record.record}-${index}`}
                                  sx={{
                                    display: "grid",
                                    gridTemplateColumns:
                                      "minmax(0, 132px) auto minmax(0, 1fr)",
                                    gap: 1,
                                    alignItems: "start",
                                  }}
                                >
                                  <Typography
                                    level="body-xs"
                                    sx={{ fontFamily: "code" }}
                                  >
                                    {record.type || record.record}
                                  </Typography>
                                  <Box
                                    sx={{
                                      width: 8,
                                      height: 8,
                                      borderRadius: "50%",
                                      bgcolor:
                                        record.dns_verified ||
                                        record.status === "verified"
                                          ? "success.solidBg"
                                          : "warning.solidBg",
                                      mt: 0.5,
                                    }}
                                  />
                                  <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                                    <Typography
                                      level="body-xs"
                                      sx={{ fontFamily: "code" }}
                                    >
                                      {record.fqdn_queried || record.name}
                                    </Typography>
                                    <Typography level="body-xs" color="neutral">
                                      {record.status || "pending"}
                                    </Typography>
                                    {record.value ? (
                                      <Typography
                                        level="body-xs"
                                        sx={{ fontFamily: "code" }}
                                      >
                                        Expected: {record.value}
                                      </Typography>
                                    ) : null}
                                  </Stack>
                                </Box>
                              ),
                            )}
                          </Stack>
                        ) : null}

                        {evidence.provider?.status ||
                        evidence.provider?.dkim_verified !== undefined ||
                        evidence.provider?.spf_verified !== undefined ||
                        evidence.provider?.return_path_verified !==
                          undefined ? (
                          <Stack spacing={0.75}>
                            <Typography level="body-xs" color="neutral">
                              Provider verification
                            </Typography>
                            <Box
                              sx={{
                                display: "grid",
                                gridTemplateColumns: "minmax(0, 1fr) auto",
                                gap: 0.75,
                              }}
                            >
                              <Typography level="body-xs" color="neutral">
                                Provider status
                              </Typography>
                              <Typography
                                level="body-xs"
                                sx={{ fontFamily: "code" }}
                              >
                                {evidence.provider.status || "unknown"}
                              </Typography>
                              <Typography level="body-xs" color="neutral">
                                DKIM
                              </Typography>
                              <Typography level="body-xs">
                                {evidence.provider.dkim_verified
                                  ? "Verified"
                                  : "Pending"}
                              </Typography>
                              <Typography level="body-xs" color="neutral">
                                SPF
                              </Typography>
                              <Typography level="body-xs">
                                {evidence.provider.spf_verified
                                  ? "Verified"
                                  : "Pending"}
                              </Typography>
                              <Typography level="body-xs" color="neutral">
                                Return path
                              </Typography>
                              <Typography level="body-xs">
                                {evidence.provider.return_path_verified
                                  ? "Verified"
                                  : "Pending"}
                              </Typography>
                            </Box>
                            {formatCheckTime(
                              evidence.provider.last_checked_at ||
                                domain?.last_verify_attempt_at,
                            ) ? (
                              <Typography level="body-xs" color="neutral">
                                Last checked{" "}
                                {formatCheckTime(
                                  evidence.provider.last_checked_at ||
                                    domain?.last_verify_attempt_at,
                                )}
                              </Typography>
                            ) : null}
                          </Stack>
                        ) : null}

                        {evidence.conflicts?.detected ? (
                          <Stack spacing={0.75}>
                            <Typography level="body-xs" color="neutral">
                              Conflict details
                            </Typography>
                            {evidence.conflicts.details.map(
                              (conflict: any, index: number) => (
                                <Typography
                                  key={`${conflict.hostname}-${index}`}
                                  level="body-xs"
                                >
                                  {conflict.conflictType} on
                                  <Box
                                    component="span"
                                    sx={{ fontFamily: "code" }}
                                  >
                                    {conflict.hostname}
                                  </Box>
                                  {conflict.cnameTarget ? (
                                    <>
                                      {" "}
                                      pointing to
                                      <Box
                                        component="span"
                                        sx={{ fontFamily: "code" }}
                                      >
                                        {conflict.cnameTarget}
                                      </Box>
                                    </>
                                  ) : null}
                                  . Update the conflicting record before
                                  retrying verification.
                                </Typography>
                              ),
                            )}
                          </Stack>
                        ) : null}

                        {evidence.directDns?.checks?.length === 0 &&
                        evidence.records.length === 0 &&
                        !evidence.conflicts?.detected ? (
                          <Typography level="body-xs" color="neutral">
                            No additional technical evidence is available yet.
                          </Typography>
                        ) : null}
                      </Stack>
                    </Sheet>
                  )}
                </AccordionDetails>
              </Accordion>
            </AccordionGroup>

            <Divider sx={{ my: 0 }} />

            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.5}
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", sm: "center" }}
              useFlexGap
            >
              <Typography level="body-xs" color="danger">
                Permanently remove this domain and all associated DNS records
              </Typography>
              <Button
                color="danger"
                size="sm"
                startDecorator={<Trash2 size={14} />}
                variant="soft"
                onClick={() => setConfirmDeleteOpen(true)}
              >
                Delete Domain
              </Button>
            </Stack>
          </Stack>
        </ModalDialog>
      </Modal>

      <Modal
        open={confirmDeleteOpen}
        onClose={() => {
          if (!deleting) {
            setConfirmDeleteOpen(false);
          }
        }}
      >
        <ModalDialog
          color="danger"
          size="sm"
          variant="outlined"
          sx={{
            bgcolor: "background.surface",
            minWidth: { xs: "calc(100vw - 32px)", sm: 420 },
            borderRadius: "md",
          }}
        >
          <DialogTitle>Delete Domain</DialogTitle>
          <DialogContent>
            <Typography level="body-sm" color="neutral">
              Delete
              <Box component="span" sx={{ fontFamily: "code" }}>
                {domain?.domain || "this domain"}
              </Box>
              ? This action is irreversible and removes all associated DNS
              records.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ pt: 1.5 }}>
            <Button
              color="neutral"
              disabled={deleting}
              size="sm"
              variant="soft"
              onClick={() => setConfirmDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              color="danger"
              loading={deleting}
              loadingPosition="start"
              size="sm"
              variant="solid"
              onClick={handleDelete}
            >
              Delete
            </Button>
          </DialogActions>
        </ModalDialog>
      </Modal>
    </>
  );
};
