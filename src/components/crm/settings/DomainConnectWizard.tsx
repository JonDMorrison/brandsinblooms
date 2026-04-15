import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-legacy/dialog";
import { Button } from "@/components/ui-legacy/button";
import { Input } from "@/components/ui-legacy/input";
import { Label } from "@/components/ui-legacy/label";
import { Alert, AlertDescription } from "@/components/ui-legacy/alert";
import {
  Globe,
  ArrowRight,
  Loader2,
  Info,
  CheckCircle2,
  Zap,
  Settings,
  Sparkles,
  Copy,
  Check,
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

  const dnsProviderLinks = [
    { name: "Cloudflare", url: "https://dash.cloudflare.com/" },
    { name: "GoDaddy", url: "https://dcc.godaddy.com/domains" },
    { name: "Namecheap", url: "https://ap.www.namecheap.com/domains/list/" },
  ];

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

  const handleContinueToMethod = () => {
    setError(null);

    if (!domain.trim()) {
      setError("Please enter a domain");
      return;
    }

    const cleanDomain = cleanDomainInput(domain);

    if (!validateDomain(cleanDomain)) {
      setError("Please enter a valid domain (e.g., example.com)");
      return;
    }

    setDomain(cleanDomain);
    setStep("choose_method");
  };

  const handleEntriSetup = async () => {
    if (!tenant?.id) {
      setError("No workspace context");
      return;
    }

    const cleanDomain = cleanDomainInput(domain);
    setError(null);
    setLoading(true);
    try {
      // Step 1: Provision domain in Resend FIRST to get real DNS records
      const result = await provisionDomain(cleanDomain);

      if (!result.success) {
        setError(result.error || "Failed to provision domain");
        setLoading(false);
        return;
      }

      setProvisionedData(result.data);

      // Step 2: Extract DNS records from backend response
      const backendRecords = result.data?.records;

      if (
        !backendRecords ||
        !Array.isArray(backendRecords) ||
        backendRecords.length === 0
      ) {
        console.error("❌ No DNS records returned from backend");
        setError(
          "Failed to get DNS records from email service. Please try manual setup.",
        );
        setLoading(false);
        return;
      }

      // Step 3: Sanitize and convert to Entri format using new sanitizer
      const { records: entriRecords, validation } = sanitizeAndConvertRecords(
        cleanDomain,
        backendRecords,
      );

      // Step 4: STRICT validation - block if required records are missing
      if (!validation.valid) {
        const errorMsg = validation.errors.join("\n• ");
        console.error(`❌ DNS validation FAILED:`, validation.errors);
        setError(
          `DNS record validation failed:\n• ${errorMsg}\n\nPlease contact support.`,
        );
        setLoading(false);
        return;
      }

      // Log warnings but continue
      if (validation.warnings.length > 0) {
      }

      setLoading(false);

      // Step 6: Open Entri with sanitized records
      setIsEntriModalOpen(true);

      openEntriSetup(
        cleanDomain,
        tenant.id,
        entriRecords,
        // onSuccess
        () => {
          console.log(`✅ Entri setup completed for ${cleanDomain}`);
          setIsEntriModalOpen(false);
          refetch();
          setStep("entri_success");
        },
        // onCancel - fall back to manual
        () => {
          console.log(
            `⚠️ Entri setup cancelled for ${cleanDomain}, falling back to manual`,
          );
          setIsEntriModalOpen(false);
          setStep("dns_pending"); // Show manual DNS setup since domain is provisioned
        },
        // onClose - always fires when Entri overlay closes (after success or cancel)
        () => {
          console.log(`🔒 Entri overlay closed, restoring wizard`);
          setIsEntriModalOpen(false);
        },
      );
    } catch (err: any) {
      console.error("Error in Entri setup:", err);
      setError(err.message || "Failed to set up domain");
      setLoading(false);
    }
  };

  const handleManualSetup = async () => {
    setError(null);
    setLoading(true);
    setStep("provisioning");

    const cleanDomain = cleanDomainInput(domain);
    const result = await provisionDomain(cleanDomain);

    setLoading(false);

    if (result.success) {
      setProvisionedData(result.data);
      setStep("dns_pending");
    } else {
      setStep("choose_method");
      setError(result.error || "Failed to provision domain");
    }
  };

  const handleClose = () => {
    setStep("enter_domain");
    setDomain("");
    setError(null);
    setProvisionedData(null);
    setEntriProvider(null);
    setIsEntriModalOpen(false);
    onClose();
  };

  // Don't render our dialog when Entri modal is active to prevent z-index conflicts
  if (isEntriModalOpen) {
    return null;
  }

  const getStepNumber = () => {
    switch (step) {
      case "enter_domain":
        return 1;
      case "choose_method":
        return 2;
      case "provisioning":
      case "dns_pending":
      case "entri_success":
      case "complete":
        return 3;
      default:
        return 1;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[580px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between mb-1">
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              Connect Your Domain
            </DialogTitle>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">
                Step {getStepNumber()}
              </span>
              <span>/</span>
              <span>3</span>
            </div>
          </div>
          <DialogDescription>
            Send emails from your own domain for better deliverability and brand
            recognition.
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Enter Domain */}
        {step === "enter_domain" && (
          <div className="space-y-4 py-4">
            <Alert className="bg-primary/5 border-primary/20">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <AlertDescription className="text-xs">
                <span className="font-medium">Why connect your domain?</span>{" "}
                Emails sent from your own domain (like news@yourbusiness.com)
                have better deliverability than shared addresses, and recipients
                recognize and trust your brand.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="domain">Your Domain</Label>
              <Input
                id="domain"
                placeholder="example.com"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleContinueToMethod()}
              />
              <p className="text-xs text-muted-foreground">
                Enter your domain without https:// or www
              </p>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Step 2: Choose Setup Method */}
        {step === "choose_method" && (
          <div className="space-y-4 py-4">
            <div className="text-center mb-4">
              <p className="text-sm text-muted-foreground">
                Setting up{" "}
                <span className="font-medium text-foreground">{domain}</span>
              </p>
            </div>

            {/* Automatic Setup Option */}
            {isEntriConfigured && (
              <div
                className={`relative border-2 border-primary/20 rounded-lg p-4 transition-colors ${loading ? "opacity-75" : "hover:border-primary/40 cursor-pointer"} bg-primary/5`}
                onClick={() => !loading && handleEntriSetup()}
              >
                <div className="absolute -top-2.5 left-3 px-2 bg-background">
                  <span className="text-xs font-medium text-primary flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    Recommended
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Zap className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-sm">
                      Automatic Setup via Entri
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Securely connect to your DNS provider for one-click setup.
                      Works with GoDaddy, Cloudflare, Namecheap, and 50+
                      providers.
                    </p>
                    {loading && (
                      <p className="text-xs text-primary mt-2 flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Provisioning domain in Resend...
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    disabled={loading || entriLoading}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEntriSetup();
                    }}
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Set Up"
                    )}
                  </Button>
                </div>
              </div>
            )}

            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-border"></div>
              <span className="mx-3 text-xs text-muted-foreground">or</span>
              <div className="flex-grow border-t border-border"></div>
            </div>

            {/* Manual Setup Option */}
            <div
              className="border rounded-lg p-4 hover:border-primary/30 transition-colors cursor-pointer"
              onClick={handleManualSetup}
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <Settings className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-sm">Manual Setup</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Get DNS records to add manually. Best for advanced users or
                    unsupported providers.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={loading}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleManualSetup();
                  }}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Configure"
                  )}
                </Button>
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                <span className="font-medium">What's configured:</span> SPF
                (sender verification), DKIM (email signing), and DMARC (policy
                enforcement) records for email authentication.
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Step 3: Provisioning */}
        {step === "provisioning" && (
          <div className="py-8 text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
            <div>
              <p className="font-medium">Setting up your domain...</p>
              <p className="text-sm text-muted-foreground">
                This may take a few seconds
              </p>
            </div>
          </div>
        )}

        {/* Step 4: DNS Pending (Manual) */}
        {step === "dns_pending" && (
          <div className="space-y-4 py-4">
            {/* Progress checklist */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
              <span className="text-green-700 font-medium">
                Domain registered
              </span>
              <span className="mx-1">→</span>
              <span className="font-medium text-foreground">
                Add DNS records
              </span>
              <span className="mx-1">→</span>
              <span>Verified</span>
            </div>

            <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800 dark:text-blue-200 text-xs">
                <span className="font-medium">What to do:</span> Log in to your
                domain registrar (e.g., GoDaddy, Cloudflare, Namecheap), go to
                the DNS settings for{" "}
                <span className="font-semibold">{domain}</span>, and add each
                record below exactly as shown. Then come back and click "Check
                DNS".
              </AlertDescription>
            </Alert>

            {/* DNS Records Display */}
            {provisionedData?.records && provisionedData.records.length > 0 ? (
              <div className="space-y-3">
                <p className="text-sm font-medium">DNS Records to Add:</p>
                <div className="border rounded-lg divide-y">
                  {provisionedData.records.map((record: any, index: number) => {
                    const recordType =
                      record.record_type || record.type || "TXT";
                    const recordName = record.name || "@";
                    const recordValue = record.value || record.data || "";
                    const purpose = getRecordPurpose(record);

                    return (
                      <div key={`record-${index}`} className="p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 text-xs font-mono font-medium bg-muted rounded">
                            {recordType}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {purpose}
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-muted-foreground w-12 shrink-0">
                              Name:
                            </span>
                            <code className="font-mono text-foreground bg-muted px-1.5 py-0.5 rounded break-all flex-1">
                              {recordName}
                            </code>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 shrink-0"
                              onClick={() =>
                                copyToClipboard(recordName, `name-${index}`)
                              }
                            >
                              {copiedRecordId === `name-${index}` ? (
                                <Check className="h-3 w-3 text-green-600" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                          <div className="flex items-start gap-2 text-xs">
                            <span className="text-muted-foreground w-12 shrink-0 pt-0.5">
                              Value:
                            </span>
                            <code className="font-mono text-foreground bg-muted px-1.5 py-0.5 rounded break-all text-[11px] leading-relaxed flex-1">
                              {recordValue}
                            </code>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 shrink-0 mt-0.5"
                              onClick={() =>
                                copyToClipboard(recordValue, `value-${index}`)
                              }
                            >
                              {copiedRecordId === `value-${index}` ? (
                                <Check className="h-3 w-3 text-green-600" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Provider Quick Links */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground">
                    Open your DNS provider:
                  </span>
                  {dnsProviderLinks.map((provider) => (
                    <a
                      key={provider.name}
                      href={provider.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      {provider.name}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ))}
                </div>
              </div>
            ) : (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  DNS records could not be loaded. Please close this wizard and
                  click "DNS Instructions" on your domain in the list to view
                  the records.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2 pt-2 border-t">
              <p className="text-sm font-medium">What happens next:</p>
              <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
                <li>Add all the DNS records above to your domain provider</li>
                <li>Close this dialog — your domain is saved</li>
                <li>
                  Click{" "}
                  <span className="font-medium text-foreground">
                    "Check DNS"
                  </span>{" "}
                  next to your domain to verify
                </li>
                <li>
                  DNS typically propagates in 5–30 minutes (up to 48 hours max)
                </li>
              </ol>
            </div>

            <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900">
              <Info className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 dark:text-amber-200 text-xs space-y-1">
                <p className="font-medium">Common mistakes to avoid:</p>
                <ul className="space-y-0.5 mt-1">
                  <li>
                    • Copy values <span className="font-medium">exactly</span> —
                    even small typos will fail verification
                  </li>
                  <li>
                    • Cloudflare users: turn the proxy{" "}
                    <span className="font-medium">OFF</span> (grey cloud, not
                    orange)
                  </li>
                  <li>
                    • Some providers use{" "}
                    <span className="font-mono font-medium">@</span> instead of
                    your domain name for the root record
                  </li>
                </ul>
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Step 5: Entri Success */}
        {step === "entri_success" && (
          <div className="space-y-4 py-4">
            <div className="text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="font-semibold text-lg">
                DNS Configured Successfully!
              </h3>
              <p className="text-sm text-muted-foreground mt-2">
                Your DNS records have been automatically applied
                {entriProvider ? ` via ${entriProvider}` : ""}.
              </p>
            </div>

            <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800 dark:text-blue-200 text-xs">
                <span className="font-medium">What happens next:</span> DNS
                changes typically propagate within 5-30 minutes. We'll
                automatically verify your domain so you can start sending
                campaigns.
              </AlertDescription>
            </Alert>
          </div>
        )}

        <DialogFooter>
          {step === "enter_domain" && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleContinueToMethod}>
                Continue
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </>
          )}

          {step === "choose_method" && (
            <Button variant="outline" onClick={() => setStep("enter_domain")}>
              Back
            </Button>
          )}

          {(step === "dns_pending" || step === "entri_success") && (
            <Button onClick={handleClose}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
