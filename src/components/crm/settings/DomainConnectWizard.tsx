import React, { useEffect, useMemo, useState } from "react";
import Alert from "@mui/joy/Alert";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Chip from "@mui/joy/Chip";
import CircularProgress from "@mui/joy/CircularProgress";
import FormControl from "@mui/joy/FormControl";
import FormHelperText from "@mui/joy/FormHelperText";
import FormLabel from "@mui/joy/FormLabel";
import IconButton from "@mui/joy/IconButton";
import Input from "@mui/joy/Input";
import LinearProgress from "@mui/joy/LinearProgress";
import Link from "@mui/joy/Link";
import Modal from "@mui/joy/Modal";
import ModalClose from "@mui/joy/ModalClose";
import ModalDialog from "@mui/joy/ModalDialog";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Tooltip from "@mui/joy/Tooltip";
import Typography from "@mui/joy/Typography";
import {
  ArrowRight,
  Check,
  CheckCircle,
  Copy,
  ExternalLink,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useEmailDomainManagement } from "@/hooks/useEmailDomainManagement";
import { useEntriConnect } from "@/hooks/useEntriConnect";
import { useTenant } from "@/hooks/useTenant";

interface DomainConnectWizardProps {
  open: boolean;
  onClose: () => void;
}

type WizardStep =
  | "enter_domain"
  | "choose_method"
  | "provisioning"
  | "dns_pending"
  | "entri_success"
  | "complete";

type SetupMethod = "automatic" | "manual";

const STEP_PROGRESS: Record<WizardStep, number> = {
  enter_domain: 16,
  choose_method: 33,
  provisioning: 50,
  dns_pending: 75,
  entri_success: 90,
  complete: 100,
};

const STEP_COPY: Record<WizardStep, { title: string; subtitle: string }> = {
  enter_domain: {
    title: "Enter your domain",
    subtitle:
      "Send emails from your own domain for better deliverability and brand recognition.",
  },
  choose_method: {
    title: "Choose setup method",
    subtitle: "Select how you'd like to configure your DNS records.",
  },
  provisioning: {
    title: "Configuring...",
    subtitle: "Setting up your domain with our email infrastructure.",
  },
  dns_pending: {
    title: "Configure DNS records",
    subtitle: "Add these records at your domain registrar to verify ownership.",
  },
  entri_success: {
    title: "DNS configured",
    subtitle: "Your DNS records have been set up automatically.",
  },
  complete: {
    title: "Domain connected",
    subtitle: "Your sending domain is ready.",
  },
};

const STEP_TRANSITION_SX = {
  animation: "domain-connect-fade-up 200ms ease-out",
  "@keyframes domain-connect-fade-up": {
    from: {
      opacity: 0,
      transform: "translateY(4px)",
    },
    to: {
      opacity: 1,
      transform: "translateY(0)",
    },
  },
} as const;

const dnsProviderLinks = [
  { name: "Cloudflare", url: "https://dash.cloudflare.com/" },
  { name: "GoDaddy", url: "https://dcc.godaddy.com/domains" },
  { name: "Namecheap", url: "https://ap.www.namecheap.com/domains/list/" },
  {
    name: "Google Domains",
    url: "https://support.google.com/domains/answer/3290309",
  },
];

export const DomainConnectWizard: React.FC<DomainConnectWizardProps> = ({
  open,
  onClose,
}) => {
  const { provisionDomain, refetch } = useEmailDomainManagement();
  const {
    openEntriSetup,
    sanitizeAndConvertRecords,
    isEntriConfigured,
    isLoading: entriLoading,
    scriptError,
    clearScriptError,
  } = useEntriConnect();
  const { tenant } = useTenant();
  const { toast } = useToast();

  const [step, setStep] = useState<WizardStep>("enter_domain");
  const [domain, setDomain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [provisionedData, setProvisionedData] = useState<any>(null);
  const [entriProvider, setEntriProvider] = useState<string | null>(null);
  const [isEntriModalOpen, setIsEntriModalOpen] = useState(false);
  const [copiedRecordId, setCopiedRecordId] = useState<string | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<SetupMethod | null>(
    null,
  );
  const [provisioningError, setProvisioningError] = useState<string | null>(
    null,
  );

  const validateDomain = (value: string): boolean => {
    const domainRegex =
      /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$/;
    return domainRegex.test(value);
  };

  const cleanDomainInput = (value: string): string => {
    return value
      .trim()
      .toLowerCase()
      .replace(/^(https?:\/\/)?(www\.)?/, "");
  };

  const cleanedDomain = useMemo(() => cleanDomainInput(domain), [domain]);
  const hasDomainInput = domain.trim().length > 0;
  const domainFormatError =
    hasDomainInput && !validateDomain(cleanedDomain)
      ? "Enter a valid root domain such as yourdomain.com."
      : null;
  const stepOneError =
    step === "enter_domain" ? error || domainFormatError : null;
  const canContinueFromDomain =
    Boolean(cleanedDomain) && !domainFormatError && !loading;

  const resetWizardState = React.useCallback(() => {
    clearScriptError();
    setStep("enter_domain");
    setDomain("");
    setError(null);
    setLoading(false);
    setProvisionedData(null);
    setEntriProvider(null);
    setIsEntriModalOpen(false);
    setCopiedRecordId(null);
    setSelectedMethod(null);
    setProvisioningError(null);
  }, [clearScriptError]);

  useEffect(() => {
    if (!open) {
      resetWizardState();
    }
  }, [open, resetWizardState]);

  const copyToClipboard = async (text: string, fieldKey: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedRecordId(fieldKey);
      setTimeout(() => setCopiedRecordId(null), 2000);
    } catch (err) {
      toast({
        title: "Copy failed",
        description: "Please copy manually",
        variant: "destructive",
      });
    }
  };

  const getRecordPurpose = (record: any): string => {
    const name = record.name?.toLowerCase() || "";
    const recordType = record.record_type || record.type || "";

    if (name.includes("_dmarc")) return "DMARC (Policy)";
    if (name.includes("domainkey") || name.includes("dkim"))
      return "DKIM (Email Signing)";
    if (recordType === "MX") return "MX (Mail Exchange)";
    if (
      recordType === "TXT" &&
      !name.includes("dmarc") &&
      !name.includes("domainkey")
    )
      return "SPF (Sender Policy)";
    return "DNS Record";
  };

  const handleContinueToMethod = () => {
    setError(null);

    if (!domain.trim()) {
      setError("Please enter a domain");
      return;
    }

    const cleanDomain = cleanDomainInput(domain);

    if (!validateDomain(cleanDomain)) {
      setError("Enter a valid root domain such as yourdomain.com.");
      return;
    }

    setDomain(cleanDomain);
    setStep("choose_method");
  };

  const captureEntriProvider = () => {
    const eventNames = ["onSuccess", "onEntriClose"] as const;

    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        provider?: string;
        setupType?: string;
      };
      const provider = detail?.provider || detail?.setupType || null;

      if (provider) {
        setEntriProvider(provider);
      }

      cleanup();
    };

    const cleanup = () => {
      eventNames.forEach((eventName) => {
        window.removeEventListener(eventName, handler as EventListener);
      });
    };

    eventNames.forEach((eventName) => {
      window.addEventListener(eventName, handler as EventListener);
    });

    return cleanup;
  };

  const handleAutomaticSetup = async () => {
    if (!tenant?.id) {
      setProvisioningError("No workspace context");
      return;
    }

    const cleanDomain = cleanDomainInput(domain);
    setError(null);
    setProvisioningError(null);
    setLoading(true);

    try {
      const result = await provisionDomain(cleanDomain);

      if (!result.success) {
        setProvisioningError(result.error || "Failed to provision domain");
        setLoading(false);
        return;
      }

      setProvisionedData(result.data);

      const backendRecords = result.data?.records;

      if (
        !backendRecords ||
        !Array.isArray(backendRecords) ||
        backendRecords.length === 0
      ) {
        setProvisioningError(
          "Failed to get DNS records from email service. Please try manual setup.",
        );
        setLoading(false);
        return;
      }

      const { records: entriRecords, validation } = sanitizeAndConvertRecords(
        cleanDomain,
        backendRecords,
      );

      if (!validation.valid) {
        const errorMsg = validation.errors.join("\n• ");
        setProvisioningError(
          `DNS record validation failed:\n• ${errorMsg}\n\nPlease contact support.`,
        );
        setLoading(false);
        return;
      }

      setLoading(false);
      setIsEntriModalOpen(true);

      const cleanupProviderCapture = captureEntriProvider();

      const entriResult = await openEntriSetup(
        cleanDomain,
        tenant.id,
        entriRecords,
        () => {
          cleanupProviderCapture();
          setIsEntriModalOpen(false);
          refetch();
          setStep("entri_success");
        },
        () => {
          cleanupProviderCapture();
          setIsEntriModalOpen(false);
          setStep("dns_pending");
        },
        () => {
          cleanupProviderCapture();
          setIsEntriModalOpen(false);
        },
      );

      if (!entriResult.opened) {
        cleanupProviderCapture();
        setIsEntriModalOpen(false);
        setSelectedMethod(null);
        setStep("choose_method");
        setError(
          entriResult.errorMessage ||
            scriptError ||
            "Domain verification tool unavailable — try again later.",
        );
      }
    } catch (err: any) {
      setProvisioningError(err.message || "Failed to set up domain");
      setLoading(false);
    }
  };

  const handleManualSetup = async () => {
    setError(null);
    setProvisioningError(null);
    setLoading(true);

    const cleanDomain = cleanDomainInput(domain);
    const result = await provisionDomain(cleanDomain);

    setLoading(false);

    if (result.success) {
      setProvisionedData(result.data);
      setStep("dns_pending");
    } else {
      setProvisioningError(result.error || "Failed to provision domain");
    }
  };

  const handleSelectMethod = async (method: SetupMethod) => {
    if (loading || entriLoading) {
      return;
    }

    if (method === "automatic" && !isEntriConfigured) {
      return;
    }

    setSelectedMethod(method);
    setError(null);
    setProvisioningError(null);
    clearScriptError();

    await new Promise((resolve) => window.setTimeout(resolve, 140));

    setStep("provisioning");

    if (method === "automatic") {
      await handleAutomaticSetup();
      return;
    }

    await handleManualSetup();
  };

  const handleRetryProvisioning = async () => {
    if (!selectedMethod) {
      setStep("choose_method");
      return;
    }

    setProvisioningError(null);
    setStep("provisioning");

    if (selectedMethod === "automatic") {
      await handleAutomaticSetup();
      return;
    }

    await handleManualSetup();
  };

  const handleClose = () => {
    resetWizardState();
    onClose();
  };

  if (isEntriModalOpen) {
    return null;
  }

  const currentStepCopy = STEP_COPY[step];

  const renderStepHeader = () => (
    <Box sx={{ px: 3, pt: 3, pb: 0 }}>
      <Stack spacing={0.5}>
        <Typography level="title-lg" sx={{ fontWeight: 700 }}>
          {currentStepCopy.title}
        </Typography>
        <Typography level="body-sm" color="neutral">
          {currentStepCopy.subtitle}
        </Typography>
      </Stack>
    </Box>
  );

  const renderRecordInput = ({
    label,
    value,
    fieldKey,
    displayValue,
    tooltip,
  }: {
    label: string;
    value: string;
    fieldKey: string;
    displayValue?: string;
    tooltip?: string;
  }) => (
    <FormControl>
      <FormLabel>{label}</FormLabel>
      <Tooltip title={tooltip || value}>
        <Input
          endDecorator={
            <IconButton
              color="neutral"
              size="sm"
              variant="plain"
              onClick={() => copyToClipboard(value, fieldKey)}
            >
              {copiedRecordId === fieldKey ? (
                <Check size={14} />
              ) : (
                <Copy size={14} />
              )}
            </IconButton>
          }
          readOnly
          size="sm"
          value={displayValue || value}
          variant="soft"
          sx={{
            bgcolor: "background.surface",
            "& input": {
              fontFamily: "code",
              fontSize: "0.75rem",
              textOverflow: "ellipsis",
            },
          }}
        />
      </Tooltip>
    </FormControl>
  );

  const renderStepBody = () => {
    if (step === "enter_domain") {
      return (
        <>
          {renderStepHeader()}
          <Box sx={{ px: 3, pt: 2.5, pb: 3 }}>
            <Stack spacing={1.5}>
              <FormControl>
                <FormLabel sx={{ fontWeight: 600, fontSize: "sm" }}>
                  Domain
                </FormLabel>
                <Input
                  autoFocus
                  placeholder="yourdomain.com"
                  size="md"
                  value={domain}
                  variant="outlined"
                  onChange={(event) => {
                    setDomain(event.target.value);
                    if (error) {
                      setError(null);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && canContinueFromDomain) {
                      handleContinueToMethod();
                    }
                  }}
                  sx={{
                    bgcolor: "background.surface",
                    "& input": {
                      fontFamily: "code",
                    },
                  }}
                />
                <FormHelperText>
                  Enter your root domain without https:// or www
                </FormHelperText>
              </FormControl>

              {stepOneError ? (
                <Alert color="danger" size="sm" variant="soft">
                  {stepOneError}
                </Alert>
              ) : null}
            </Stack>
          </Box>
          <Box
            sx={{
              px: 3,
              pb: 3,
              pt: 1,
              display: "flex",
              justifyContent: "flex-end",
              gap: 1,
            }}
          >
            <Button
              color="neutral"
              size="sm"
              variant="plain"
              onClick={handleClose}
            >
              Cancel
            </Button>
            <Button
              color="primary"
              disabled={!canContinueFromDomain}
              endDecorator={<ArrowRight size={14} />}
              loading={false}
              size="sm"
              variant="solid"
              onClick={handleContinueToMethod}
            >
              Continue
            </Button>
          </Box>
        </>
      );
    }

    if (step === "choose_method") {
      return (
        <>
          {renderStepHeader()}
          <Box sx={{ px: 3, pt: 2, pb: 3 }}>
            <Stack spacing={1.5}>
              <Sheet
                variant="outlined"
                onClick={() => void handleSelectMethod("automatic")}
                sx={{
                  borderRadius: "sm",
                  p: 2,
                  cursor: isEntriConfigured ? "pointer" : "default",
                  opacity: isEntriConfigured ? 1 : 0.5,
                  pointerEvents: isEntriConfigured ? "auto" : "none",
                  borderColor:
                    selectedMethod === "automatic"
                      ? "primary.outlinedActiveBorder"
                      : undefined,
                  bgcolor:
                    selectedMethod === "automatic"
                      ? "primary.softBg"
                      : "background.surface",
                  "&:hover": isEntriConfigured
                    ? {
                        borderColor: "primary.outlinedHoverBorder",
                      }
                    : undefined,
                }}
              >
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  spacing={2}
                >
                  <Stack spacing={0.5}>
                    <Typography level="title-sm" sx={{ fontWeight: 600 }}>
                      Automatic setup
                    </Typography>
                    <Typography level="body-xs" color="neutral">
                      We'll configure your DNS records automatically through
                      your provider
                    </Typography>
                  </Stack>
                  <Chip color="success" size="sm" variant="soft">
                    Recommended
                  </Chip>
                </Stack>
              </Sheet>

              {!isEntriConfigured ? (
                <Typography level="body-xs" color="neutral">
                  Automatic setup is not available for your configuration.
                </Typography>
              ) : null}

              <Sheet
                variant="outlined"
                onClick={() => void handleSelectMethod("manual")}
                sx={{
                  borderRadius: "sm",
                  p: 2,
                  cursor: "pointer",
                  borderColor:
                    selectedMethod === "manual"
                      ? "primary.outlinedActiveBorder"
                      : undefined,
                  bgcolor:
                    selectedMethod === "manual"
                      ? "primary.softBg"
                      : "background.surface",
                  "&:hover": {
                    borderColor: "primary.outlinedHoverBorder",
                  },
                }}
              >
                <Stack spacing={0.5}>
                  <Typography level="title-sm" sx={{ fontWeight: 600 }}>
                    Manual setup
                  </Typography>
                  <Typography level="body-xs" color="neutral">
                    We'll provide the DNS records for you to add at your domain
                    registrar
                  </Typography>
                </Stack>
              </Sheet>

              {error ? (
                <Alert color="danger" size="sm" variant="soft">
                  {error}
                </Alert>
              ) : null}

              {!error && scriptError ? (
                <Alert color="danger" size="sm" variant="soft">
                  {scriptError}
                </Alert>
              ) : null}
            </Stack>
          </Box>
          <Box
            sx={{
              px: 3,
              pb: 3,
              pt: 0,
              display: "flex",
              justifyContent: "flex-start",
              gap: 1,
            }}
          >
            <Button
              color="neutral"
              size="sm"
              variant="plain"
              onClick={() => {
                setError(null);
                setSelectedMethod(null);
                setStep("enter_domain");
              }}
            >
              Back
            </Button>
          </Box>
        </>
      );
    }

    if (step === "provisioning") {
      return (
        <>
          {renderStepHeader()}
          <Box sx={{ px: 3, pt: 3, pb: 4, textAlign: "center" }}>
            {provisioningError ? (
              <Stack spacing={2} alignItems="center">
                <Alert
                  color="danger"
                  size="sm"
                  variant="soft"
                  sx={{ width: "100%", textAlign: "left" }}
                >
                  {provisioningError}
                </Alert>
                <Stack direction="row" spacing={1}>
                  <Button
                    color="neutral"
                    size="sm"
                    variant="outlined"
                    onClick={() => void handleRetryProvisioning()}
                  >
                    Try Again
                  </Button>
                  <Button
                    color="neutral"
                    size="sm"
                    variant="plain"
                    onClick={handleClose}
                  >
                    Cancel
                  </Button>
                </Stack>
              </Stack>
            ) : (
              <Stack spacing={2} alignItems="center">
                <CircularProgress color="neutral" size="md" variant="soft" />
                <Stack spacing={0.5} alignItems="center">
                  <Typography level="body-sm" color="neutral">
                    Provisioning email infrastructure for{" "}
                    <Box
                      component="span"
                      sx={{ fontFamily: "code", fontWeight: 600 }}
                    >
                      {cleanedDomain}
                    </Box>
                  </Typography>
                  <Typography level="body-xs" color="neutral">
                    This usually takes a few seconds
                  </Typography>
                </Stack>
              </Stack>
            )}
          </Box>
        </>
      );
    }

    if (step === "dns_pending") {
      return (
        <>
          {renderStepHeader()}
          <Box sx={{ px: 3, pt: 2, pb: 3 }}>
            <Stack spacing={1.5}>
              {provisionedData?.records &&
              provisionedData.records.length > 0 ? (
                <Stack spacing={1.5}>
                  {provisionedData.records.map((record: any, index: number) => {
                    const recordType =
                      record.record_type || record.type || "TXT";
                    const recordName = record.name || "@";
                    const recordValue = record.value || record.data || "";
                    const purpose = getRecordPurpose(record);
                    const priority = record.priority;
                    const displayValue =
                      recordValue.length > 88
                        ? `${recordValue.slice(0, 88)}...`
                        : recordValue;

                    return (
                      <Sheet
                        key={`record-${index}`}
                        variant="outlined"
                        sx={{
                          bgcolor: "background.surface",
                          borderRadius: "sm",
                          p: 2,
                        }}
                      >
                        <Stack spacing={1.25}>
                          <Stack
                            direction="row"
                            spacing={1}
                            alignItems="center"
                            useFlexGap
                            flexWrap="wrap"
                          >
                            <Typography level="body-xs" color="neutral">
                              {index + 1}
                            </Typography>
                            <Chip color="neutral" size="sm" variant="soft">
                              {recordType}
                            </Chip>
                            <Chip color="neutral" size="sm" variant="outlined">
                              {purpose}
                            </Chip>
                          </Stack>

                          {renderRecordInput({
                            label: "Host / Name",
                            value: recordName,
                            fieldKey: `name-${index}`,
                          })}

                          {renderRecordInput({
                            label: "Value / Points to",
                            value: recordValue,
                            displayValue,
                            fieldKey: `value-${index}`,
                            tooltip: recordValue,
                          })}

                          {priority !== undefined
                            ? renderRecordInput({
                                label: "Priority",
                                value: String(priority),
                                fieldKey: `priority-${index}`,
                              })
                            : null}

                          {displayValue !== recordValue ? (
                            <Typography level="body-xs" color="neutral">
                              Hover the value field to inspect the full record.
                            </Typography>
                          ) : null}
                        </Stack>
                      </Sheet>
                    );
                  })}
                </Stack>
              ) : (
                <Alert color="warning" size="sm" variant="soft">
                  DNS records could not be loaded. Close this wizard and open
                  the domain details modal to inspect the saved records.
                </Alert>
              )}

              <Stack
                direction="row"
                spacing={0.75}
                useFlexGap
                flexWrap="wrap"
                alignItems="center"
              >
                <Typography level="body-xs" color="neutral">
                  DNS provider guides:
                </Typography>
                {dnsProviderLinks.map((provider) => (
                  <Link
                    key={provider.name}
                    color="neutral"
                    href={provider.url}
                    level="body-xs"
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 0.5,
                    }}
                  >
                    {provider.name}
                    <ExternalLink size={12} />
                  </Link>
                ))}
              </Stack>

              <Alert color="warning" size="sm" variant="soft" sx={{ mt: 0.5 }}>
                <Stack spacing={0.5}>
                  <Typography level="body-xs" sx={{ fontWeight: 600 }}>
                    Common mistakes to avoid
                  </Typography>
                  <Typography level="body-xs">
                    Copy values exactly as shown. Cloudflare users should keep
                    proxies off for these records. Some registrars use @ for the
                    root host, some flatten CNAMEs automatically, and some add
                    trailing dots for you, so avoid editing the target value
                    unless your provider explicitly requires it.
                  </Typography>
                </Stack>
              </Alert>

              <Typography level="body-xs" color="neutral" sx={{ mt: 0.5 }}>
                Verification will continue automatically in the background after
                these records propagate. You can also use Check DNS from the
                domains list if you want to confirm sooner.
              </Typography>
            </Stack>
          </Box>
          <Box
            sx={{
              px: 3,
              pb: 3,
              pt: 0,
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            <Button
              color="primary"
              size="sm"
              variant="solid"
              onClick={handleClose}
            >
              Done
            </Button>
          </Box>
        </>
      );
    }

    if (step === "entri_success") {
      return (
        <>
          {renderStepHeader()}
          <Box sx={{ px: 3, pt: 2, pb: 3, textAlign: "center" }}>
            <Stack spacing={1.5} alignItems="center">
              <CheckCircle
                size={40}
                style={{ color: "var(--joy-palette-success-500)" }}
              />
              <Typography level="body-sm">
                {entriProvider
                  ? `${entriProvider} has been configured automatically for ${cleanedDomain}.`
                  : "Your DNS records have been configured automatically."}
              </Typography>
              <Typography level="body-xs" color="neutral">
                Verification will continue in the background. Your domain will
                be ready to use once DNS propagation completes.
              </Typography>
            </Stack>
          </Box>
          <Box
            sx={{
              px: 3,
              pb: 3,
              pt: 0,
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            <Button
              color="primary"
              size="sm"
              variant="solid"
              onClick={handleClose}
            >
              Done
            </Button>
          </Box>
        </>
      );
    }

    return (
      <>
        {renderStepHeader()}
        <Box sx={{ px: 3, pt: 2, pb: 3, textAlign: "center" }}>
          <Stack spacing={1.5} alignItems="center">
            <CheckCircle
              size={40}
              style={{ color: "var(--joy-palette-success-500)" }}
            />
            <Typography level="body-sm">
              {cleanedDomain || "Your domain"} is connected and ready to send.
            </Typography>
            <Typography level="body-xs" color="neutral">
              You can start using this sending domain as soon as traffic begins
              flowing through it.
            </Typography>
          </Stack>
        </Box>
        <Box
          sx={{
            px: 3,
            pb: 3,
            pt: 0,
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <Button
            color="primary"
            size="sm"
            variant="solid"
            onClick={handleClose}
          >
            Done
          </Button>
        </Box>
      </>
    );
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        // Dismissal is controlled by explicit buttons only.
      }}
    >
      <ModalDialog
        variant="outlined"
        sx={{
          maxWidth: 520,
          width: "100%",
          p: 0,
          overflow: "hidden",
          bgcolor: "background.surface",
          borderRadius: "lg",
        }}
      >
        <LinearProgress
          color="primary"
          determinate
          size="sm"
          value={STEP_PROGRESS[step]}
          sx={{
            borderRadius: 0,
            height: 3,
            "--LinearProgress-radius": "0px",
          }}
        />
        {step !== "provisioning" ? (
          <ModalClose onClick={handleClose} sx={{ top: 12, right: 12 }} />
        ) : null}
        <Box key={step} sx={STEP_TRANSITION_SX}>
          {renderStepBody()}
        </Box>
      </ModalDialog>
    </Modal>
  );
};
