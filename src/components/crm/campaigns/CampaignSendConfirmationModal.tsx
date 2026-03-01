import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useTenantEmailHealthDashboard } from "@/hooks/useTenantEmailHealthDashboard";
import { useSuppressionStats } from "@/hooks/useSuppressionList";
import {
  ANALYTICS_THRESHOLDS,
  getHealthStatus,
} from "@/config/analyticsThresholds";

interface SelectedSegment {
  id: string;
  name: string;
  customerCount?: number;
}

interface SelectedPersona {
  id: string;
  name: string;
  customerCount?: number;
}

type SendScheduleSummary =
  | { type: "immediate" }
  | { type: "scheduled"; sendAt: Date; timezone?: string | null };

type DomainLookupRow = {
  id: string;
  domain: string;
  status: string | null;
};

type EmailDomainVerifyResponse = {
  ok?: boolean;
  status?: string;
  domain?: string;
  readiness?: {
    status?: string;
    message?: string;
    subMessage?: string | null;
    cta?: string | null;
  };
  provider?: {
    dkim_verified?: boolean;
    spf_verified?: boolean;
    dmarc_verified?: boolean;
    return_path_verified?: boolean;
    status?: string;
    last_checked_at?: string;
  };
  checks?: Array<{
    name: string;
    passed: boolean;
    dns_verified?: boolean;
    details?: unknown;
  }>;
  message?: string;
  error?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getErrorMessage(error: unknown): string | null {
  if (typeof error === "string" && error.trim().length > 0) return error;
  if (!isRecord(error)) return null;

  const message = error["message"];
  if (typeof message === "string" && message.trim().length > 0) return message;

  const errorField = error["error"];
  if (typeof errorField === "string" && errorField.trim().length > 0) {
    return errorField;
  }

  return null;
}

function formatPercent(value: number, fractionDigits = 2) {
  if (!Number.isFinite(value)) return "—";
  return `${value.toFixed(fractionDigits)}%`;
}

function badgeVariantFromHealth(status: "green" | "yellow" | "red") {
  if (status === "green") return "success" as const;
  if (status === "yellow") return "warning" as const;
  return "destructive" as const;
}

function badgeVariantFromReadiness(readinessStatus: string | null | undefined) {
  const value = String(readinessStatus || "").toUpperCase();
  if (value === "READY_TO_SEND" || value === "CONNECTED_READY") {
    return "success" as const;
  }
  if (value === "READY_AWAITING_PROVIDER") {
    return "info" as const;
  }
  if (value === "ACTION_REQUIRED_DNS_CONFLICT") {
    return "destructive" as const;
  }
  if (
    value === "ACTION_REQUIRED_DNS_MISSING" ||
    value === "DOMAIN_NOT_CONNECTED"
  ) {
    return "warning" as const;
  }
  return "secondary" as const;
}

function boolFromProviderOrChecks(params: {
  providerValue: boolean | null | undefined;
  checks: EmailDomainVerifyResponse["checks"] | null | undefined;
  checkName: string;
}) {
  if (typeof params.providerValue === "boolean") return params.providerValue;
  const found = params.checks?.find((c) => c.name === params.checkName);
  return typeof found?.passed === "boolean" ? found.passed : null;
}

function parseFunctionsInvokeError(error: unknown): {
  message: string;
  status?: number;
} {
  const context =
    isRecord(error) && isRecord(error["context"]) ? error["context"] : null;

  const statusFromContext = context?.["status"];
  const statusFromError = isRecord(error) ? error["status"] : undefined;
  const status =
    typeof statusFromContext === "number"
      ? statusFromContext
      : typeof statusFromError === "number"
        ? statusFromError
        : undefined;

  const body = context?.["body"];

  if (typeof body === "string" && body.length > 0) {
    try {
      const parsed = JSON.parse(body);
      const message =
        (typeof parsed?.message === "string" && parsed.message) ||
        (typeof parsed?.error === "string" && parsed.error) ||
        (typeof error?.message === "string" && error.message) ||
        "Request failed";
      return { message, status };
    } catch {
      // fall through
    }
  }

  const bodyMessage =
    isRecord(body) && typeof body["message"] === "string"
      ? body["message"]
      : null;
  const bodyError =
    isRecord(body) && typeof body["error"] === "string" ? body["error"] : null;

  return {
    message:
      bodyMessage || bodyError || getErrorMessage(error) || "Request failed",
    status,
  };
}

function VerificationRow(props: {
  label: string;
  loading: boolean;
  ok: boolean | null;
  okLabel?: string;
  badLabel?: string;
}) {
  const {
    label,
    loading,
    ok,
    okLabel = "Verified",
    badLabel = "Needs Action",
  } = props;

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="text-sm text-foreground">{label}</div>
      <div className="shrink-0">
        {loading ? (
          <Skeleton className="h-5 w-24" />
        ) : ok === true ? (
          <Badge variant="success">{okLabel}</Badge>
        ) : ok === false ? (
          <Badge variant="warning">{badLabel}</Badge>
        ) : (
          <Badge variant="secondary">Unknown</Badge>
        )}
      </div>
    </div>
  );
}

interface CampaignSendConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  campaignName: string;
  selectedSegments: SelectedSegment[];
  selectedPersonas: SelectedPersona[];
  totalRecipients: number;
  schedule: SendScheduleSummary;
  senderIdentity: {
    senderName: string;
    senderEmail: string;
    replyToEmail?: string | null;
    sendingDomain?: string | null;
  };
  loading?: boolean;
}

export const CampaignSendConfirmationModal: React.FC<
  CampaignSendConfirmationModalProps
> = ({
  isOpen,
  onClose,
  onConfirm,
  campaignName,
  selectedSegments,
  selectedPersonas,
  totalRecipients,
  schedule,
  senderIdentity,
  loading = false,
}) => {
  const formatAudienceLabel = React.useMemo(() => {
    const names = [
      ...selectedSegments.map((s) => s.name).filter(Boolean),
      ...selectedPersonas.map((p) => p.name).filter(Boolean),
    ];

    if (names.length === 0) return "All Contacts";
    if (names.length === 1) return names[0];
    if (names.length === 2) return `${names[0]}, ${names[1]}`;
    return `${names[0]}, ${names[1]} +${names.length - 2}`;
  }, [selectedSegments, selectedPersonas]);

  const scheduleLabel = React.useMemo(() => {
    if (schedule.type === "immediate") return "Send Immediately";

    const tz = schedule.timezone || undefined;
    const date = schedule.sendAt;

    try {
      const formatter = new Intl.DateTimeFormat(undefined, {
        timeZone: tz,
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "numeric",
        minute: "2-digit",
      });
      const formatted = formatter.format(date);
      return tz ? `${formatted} (${tz})` : formatted;
    } catch {
      return date.toLocaleString();
    }
  }, [schedule]);

  const replyToToShow =
    senderIdentity.replyToEmail &&
    senderIdentity.replyToEmail.trim().length > 0 &&
    senderIdentity.replyToEmail.trim().toLowerCase() !==
      senderIdentity.senderEmail.trim().toLowerCase()
      ? senderIdentity.replyToEmail.trim()
      : null;

  const shouldLoadPreflight = isOpen;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex flex-col w-[95vw] md:w-[70vw] max-w-[1100px] max-h-[85vh] overflow-hidden p-8 sm:rounded-2xl shadow-2xl">
        <DialogHeader className="text-left space-y-3">
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <DialogTitle className="flex items-center gap-2 text-xl">
                <Send className="h-5 w-5 text-primary" />
                Send Campaign
              </DialogTitle>
              <DialogDescription className="mt-1">
                Review campaign details and sender identity before continuing.
              </DialogDescription>
            </div>

            <Badge variant="info" className="shrink-0">
              Ready to Send
            </Badge>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            {/* Section 1 — Campaign Summary */}
            <section className="rounded-xl border bg-white p-6">
              <h3 className="text-base font-semibold">Campaign Summary</h3>
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-1 gap-1">
                  <div className="text-xs font-medium text-muted-foreground">
                    Campaign Name
                  </div>
                  <div className="text-sm font-semibold text-foreground break-words">
                    {campaignName || "Untitled"}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-1">
                  <div className="text-xs font-medium text-muted-foreground">
                    Target Segment
                  </div>
                  <div className="text-sm text-foreground break-words">
                    {formatAudienceLabel}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-1">
                  <div className="text-xs font-medium text-muted-foreground">
                    Total Recipients
                  </div>
                  <div className="text-2xl font-semibold text-foreground">
                    {Number.isFinite(totalRecipients)
                      ? totalRecipients.toLocaleString()
                      : "—"}
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <div className="grid grid-cols-1 gap-1">
                    <div className="text-xs font-medium text-muted-foreground">
                      Send Time
                    </div>
                    <div className="text-sm text-foreground">
                      {scheduleLabel}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Section 2 — Sender Identity */}
            <section className="rounded-xl border bg-muted/30 p-6">
              <h3 className="text-base font-semibold">Sender Identity</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                This is the identity recipients will see.
              </p>

              <div className="mt-5 space-y-5">
                <div className="rounded-lg border bg-white p-4">
                  <div className="text-xs font-semibold text-muted-foreground">
                    Sending From
                  </div>
                  <div className="mt-2">
                    <div className="text-sm font-semibold text-foreground break-words">
                      {senderIdentity.senderName || "—"}
                    </div>
                    <div className="text-sm text-muted-foreground break-words">
                      {senderIdentity.senderEmail || "—"}
                    </div>
                  </div>
                </div>

                {replyToToShow && (
                  <div className="rounded-lg border bg-white p-4">
                    <div className="text-xs font-semibold text-muted-foreground">
                      Reply-To
                    </div>
                    <div className="mt-2 text-sm text-foreground break-words">
                      {replyToToShow}
                    </div>
                  </div>
                )}

                <div className="rounded-lg border bg-white p-4">
                  <div className="text-xs font-semibold text-muted-foreground">
                    Sending Domain
                  </div>
                  <div className="mt-2 text-sm text-foreground break-words">
                    {senderIdentity.sendingDomain || "—"}
                  </div>
                </div>
              </div>
            </section>

            {shouldLoadPreflight ? (
              <PreflightPanels sendingDomain={senderIdentity.sendingDomain} />
            ) : null}
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t pt-6 mt-6 flex-row items-center justify-between gap-4 sm:space-x-0">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={loading}>
            {loading ? "Confirming..." : "Confirm & Continue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

function PreflightPanels(props: { sendingDomain?: string | null }) {
  const { sendingDomain } = props;
  const { tenant } = useTenant();
  const tenantId = tenant?.id;

  const normalizedDomain = React.useMemo(() => {
    const raw = String(sendingDomain || "").trim();
    return raw.length > 0 ? raw.toLowerCase() : "";
  }, [sendingDomain]);

  const [domainRow, setDomainRow] = React.useState<DomainLookupRow | null>(
    null,
  );
  const [domainLookupLoading, setDomainLookupLoading] = React.useState(false);
  const [domainLookupError, setDomainLookupError] = React.useState<
    string | null
  >(null);

  const [verifyLoading, setVerifyLoading] = React.useState(false);
  const [verifyError, setVerifyError] = React.useState<string | null>(null);
  const [verifyData, setVerifyData] =
    React.useState<EmailDomainVerifyResponse | null>(null);
  const lastVerifiedDomainIdRef = React.useRef<string | null>(null);

  const {
    data: healthData,
    isLoading: healthLoading,
    error: healthError,
  } = useTenantEmailHealthDashboard(tenantId, { enabled: true });

  const {
    data: suppressionStats,
    isLoading: suppressionLoading,
    error: suppressionError,
  } = useSuppressionStats({ enabled: true });

  React.useEffect(() => {
    let cancelled = false;

    const loadDomainRow = async () => {
      setDomainLookupError(null);
      setDomainRow(null);
      setVerifyData(null);
      setVerifyError(null);
      lastVerifiedDomainIdRef.current = null;

      if (!tenantId) return;
      if (!normalizedDomain) return;

      setDomainLookupLoading(true);
      try {
        const { data, error } = await supabase
          .from("email_domains")
          .select("id,domain,status")
          .eq("tenant_id", tenantId)
          .ilike("domain", normalizedDomain)
          .maybeSingle();

        if (cancelled) return;
        if (error) {
          setDomainLookupError(
            error.message || "Unable to load sending domain",
          );
          return;
        }

        setDomainRow((data || null) as DomainLookupRow | null);
      } catch (e: unknown) {
        if (cancelled) return;
        setDomainLookupError(
          getErrorMessage(e) || "Unable to load sending domain",
        );
      } finally {
        if (!cancelled) setDomainLookupLoading(false);
      }
    };

    void loadDomainRow();

    return () => {
      cancelled = true;
    };
  }, [tenantId, normalizedDomain]);

  React.useEffect(() => {
    let cancelled = false;

    const verifyDomain = async () => {
      setVerifyError(null);
      setVerifyData(null);

      const domainId = domainRow?.id;
      if (!domainId) return;
      if (lastVerifiedDomainIdRef.current === domainId) return;

      lastVerifiedDomainIdRef.current = domainId;
      setVerifyLoading(true);

      try {
        const { data, error } = await supabase.functions.invoke(
          "email-domain-verify",
          {
            body: {
              email_domain_id: domainId,
            },
          },
        );

        if (cancelled) return;

        if (error) {
          const parsed = parseFunctionsInvokeError(error);
          setVerifyError(parsed.message);
          return;
        }

        const response = (data || null) as EmailDomainVerifyResponse | null;
        setVerifyData(response);
        if (import.meta.env.DEV) {
          console.info("[Send preflight] domain verification loaded", {
            domainId,
            domain: domainRow?.domain,
            readiness: response?.readiness?.status,
          });
        }
      } catch (e: unknown) {
        if (cancelled) return;
        setVerifyError(getErrorMessage(e) || "Unable to verify domain");
      } finally {
        if (!cancelled) setVerifyLoading(false);
      }
    };

    void verifyDomain();

    return () => {
      cancelled = true;
    };
  }, [domainRow?.id, domainRow?.domain]);

  const readinessStatus = verifyData?.readiness?.status || null;
  const readinessMessage =
    verifyData?.readiness?.subMessage ||
    verifyData?.readiness?.message ||
    verifyData?.message ||
    null;

  const spfOk = boolFromProviderOrChecks({
    providerValue: verifyData?.provider?.spf_verified,
    checks: verifyData?.checks,
    checkName: "spf",
  });
  const dkimOk = boolFromProviderOrChecks({
    providerValue: verifyData?.provider?.dkim_verified,
    checks: verifyData?.checks,
    checkName: "dkim",
  });
  const dmarcOk = boolFromProviderOrChecks({
    providerValue: verifyData?.provider?.dmarc_verified,
    checks: verifyData?.checks,
    checkName: "dmarc",
  });

  const deliveryPct = React.useMemo(() => {
    const sent = Number(healthData?.sent_30d || 0);
    const delivered = Number(healthData?.delivered_30d || 0);
    if (!sent || sent <= 0) return null;
    return (delivered / sent) * 100;
  }, [healthData]);

  const bouncePct = Number(healthData?.bounce_rate_30d || 0) * 100;
  const complaintPct = Number(healthData?.complaint_rate_30d || 0) * 100;

  const bounceStatus = getHealthStatus(
    bouncePct,
    ANALYTICS_THRESHOLDS.bounceRate,
    false,
  );
  const complaintStatus = getHealthStatus(
    complaintPct,
    ANALYTICS_THRESHOLDS.complaintRate,
    false,
  );

  const healthAsOfLabel = React.useMemo(() => {
    if (!healthData?.as_of) return null;
    try {
      return new Date(healthData.as_of).toLocaleString();
    } catch {
      return healthData.as_of;
    }
  }, [healthData?.as_of]);

  return (
    <>
      {/* Section 3 — Domain Verification */}
      <section className="rounded-xl border bg-white p-6">
        <h3 className="text-base font-semibold">Domain Verification</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Checks your sending domain authentication before sending.
        </p>

        <div className="mt-5 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="text-sm font-medium text-foreground break-words">
              Domain
            </div>
            <div className="shrink-0">
              {domainLookupLoading ? (
                <Skeleton className="h-5 w-28" />
              ) : !normalizedDomain ? (
                <Badge variant="destructive">Missing</Badge>
              ) : domainLookupError ? (
                <Badge variant="destructive">Error</Badge>
              ) : !domainRow ? (
                <Badge variant="warning">Not Found</Badge>
              ) : verifyLoading ? (
                <Skeleton className="h-5 w-28" />
              ) : verifyError ? (
                <Badge variant="destructive">Error</Badge>
              ) : (
                <Badge variant={badgeVariantFromReadiness(readinessStatus)}>
                  {String(readinessStatus || "Checking").replace(/_/g, " ")}
                </Badge>
              )}
            </div>
          </div>

          <div className="text-xs text-muted-foreground">
            {domainLookupLoading || verifyLoading ? (
              <Skeleton className="h-4 w-full" />
            ) : !normalizedDomain ? (
              "No sending domain is configured for this campaign."
            ) : domainLookupError ? (
              domainLookupError
            ) : !domainRow ? (
              "This sending domain is not configured in Email Settings."
            ) : verifyError ? (
              verifyError
            ) : readinessMessage ? (
              readinessMessage
            ) : (
              ""
            )}
          </div>

          <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
            <VerificationRow
              label="SPF"
              loading={domainLookupLoading || verifyLoading}
              ok={spfOk}
            />
            <VerificationRow
              label="DKIM"
              loading={domainLookupLoading || verifyLoading}
              ok={dkimOk}
            />
            <VerificationRow
              label="DMARC"
              loading={domainLookupLoading || verifyLoading}
              ok={dmarcOk}
              okLabel="Configured"
              badLabel="Not Configured"
            />
          </div>
        </div>
      </section>

      {/* Section 4 — Email Health Overview */}
      <section className="rounded-xl border bg-muted/30 p-6">
        <h3 className="text-base font-semibold">Email Health Overview</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Delivery performance and list hygiene (30d).
        </p>

        <div className="mt-5">
          {(healthLoading || suppressionLoading) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          )}

          {!healthLoading && !suppressionLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-lg border bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium">Delivery Rate</div>
                  <Badge variant="info">30d</Badge>
                </div>
                <div className="mt-2 text-2xl font-semibold">
                  {deliveryPct === null ? "—" : formatPercent(deliveryPct, 2)}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Delivered{" "}
                  {Number(healthData?.delivered_30d || 0).toLocaleString()} of{" "}
                  {Number(healthData?.sent_30d || 0).toLocaleString()}
                </div>
              </div>

              <div className="rounded-lg border bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium">Bounce Rate</div>
                  <Badge variant={badgeVariantFromHealth(bounceStatus)}>
                    {bounceStatus.toUpperCase()}
                  </Badge>
                </div>
                <div className="mt-2 text-2xl font-semibold">
                  {formatPercent(bouncePct, 2)}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {Number(healthData?.bounced_30d || 0).toLocaleString()}{" "}
                  bounced
                </div>
              </div>

              <div className="rounded-lg border bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium">Complaint Rate</div>
                  <Badge variant={badgeVariantFromHealth(complaintStatus)}>
                    {complaintStatus.toUpperCase()}
                  </Badge>
                </div>
                <div className="mt-2 text-2xl font-semibold">
                  {formatPercent(complaintPct, 3)}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {Number(healthData?.complained_30d || 0).toLocaleString()}{" "}
                  complained
                </div>
              </div>

              <div className="rounded-lg border bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium">Suppressed Emails</div>
                  <Badge variant="secondary">Current</Badge>
                </div>
                <div className="mt-2 text-2xl font-semibold">
                  {Number(suppressionStats?.total || 0).toLocaleString()}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {suppressionStats?.byType
                    ? `Unsubscribed ${Number(suppressionStats.byType.unsubscribed || 0).toLocaleString()} • Bounced ${Number((suppressionStats.byType.bounced || 0) + (suppressionStats.byType.hard_bounce || 0)).toLocaleString()} • Complaints ${Number((suppressionStats.byType.complaint || 0) + (suppressionStats.byType.complained || 0)).toLocaleString()}`
                    : ""}
                </div>
              </div>
            </div>
          )}

          {(healthError || suppressionError) && (
            <div className="mt-4 rounded-md border bg-white p-3 text-sm text-muted-foreground">
              Unable to load some health metrics right now.
            </div>
          )}

          {healthAsOfLabel && !healthLoading && (
            <div className="mt-4 text-xs text-muted-foreground">
              Last updated: {healthAsOfLabel}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
