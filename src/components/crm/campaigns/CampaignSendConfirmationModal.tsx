import React from "react";
import { Link } from "react-router-dom";
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
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Minus,
  TrendingDown,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import {
  type TenantEmailHealthDashboard,
  useTenantEmailHealthDashboard,
} from "@/hooks/useTenantEmailHealthDashboard";
import { useQuery } from "@tanstack/react-query";
import {
  useBlockedEmailCount,
  useSuppressionStats,
} from "@/hooks/useSuppressionList";
import {
  ANALYTICS_THRESHOLDS,
  getHealthStatus,
} from "@/config/analyticsThresholds";
import {
  governanceRiskFromPolicy,
  governanceRiskLabel,
  governanceSendingStatusLabel,
} from "@/lib/email/governanceRisk";

type PreflightRowState = "ok" | "warn" | "block" | "unknown";

type FinalPreflightCheck = {
  id: "domain" | "governance" | "quota" | "bounce" | "complaint" | "audience";
  label: string;
  loading: boolean;
  state: PreflightRowState;
  detail?: string;
  actionHref?: string;
  actionLabel?: string;
};

type PreflightSummary = {
  checking: boolean;
  blocked: boolean;
  hasWarnings: boolean;
  blockReasons: string[];
  warningReasons: string[];
  score: number | null;
  scoreLabel: string;
  sendingStatusLabel: string;
  checks: FinalPreflightCheck[];
};

type TenantReputationPolicy = {
  score: number;
  tier: string;
  action: string;
  recipient_cap: number | null;
  job_batch_size: number | null;
  send_pacing_multiplier: number | null;
} | null;

type TenantUnderReviewOverrideState = {
  under_review_override_enabled?: boolean;
  under_review_override_active?: boolean;
  under_review_override_final?: boolean;
  under_review_override_until?: string | null;
  under_review_override_precedence?: string | null;
  under_review_override_reason?: string | null;
} | null;

type SendQuotaCheckResult = {
  allowed?: boolean;
  reason?: string;
  message?: string;
  warnings?: unknown;
  compliance?: unknown;
  domain?: unknown;
} | null;

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

function coerceRateToPercent(value: unknown): number | null {
  if (value === null || value === undefined) return null;

  const toNumber = (v: unknown): number => {
    if (typeof v === "number") return v;
    if (typeof v === "string") {
      const trimmed = v.trim();
      if (!trimmed) return Number.NaN;
      return Number(trimmed.endsWith("%") ? trimmed.slice(0, -1) : trimmed);
    }
    return Number(v);
  };

  const n = toNumber(value);
  if (!Number.isFinite(n)) return null;

  // Most of the pipeline stores rates as fractions (0..1). If we ever get a
  // percent (0..100), keep it as-is.
  if (n > 1 && n <= 100) return n;
  return n * 100;
}

function percentFromCounts(
  numerator: unknown,
  denominator: unknown,
): number | null {
  const num = Number(numerator);
  const den = Number(denominator);
  if (!Number.isFinite(num) || !Number.isFinite(den)) return null;
  if (den <= 0) return num === 0 ? 0 : null;
  return (num / den) * 100;
}

function formatDateTime(value: number | string | Date): string {
  try {
    const date =
      typeof value === "number"
        ? new Date(value)
        : typeof value === "string"
          ? new Date(value)
          : value;
    return date.toLocaleString();
  } catch {
    return "";
  }
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    const onChange = () => setReduced(Boolean(mediaQuery.matches));
    onChange();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", onChange);
      return () => mediaQuery.removeEventListener("change", onChange);
    }

    // Safari
    mediaQuery.addListener(onChange);
    return () => mediaQuery.removeListener(onChange);
  }, []);

  return reduced;
}

function useCountUp(params: {
  target: number | null;
  durationMs?: number;
  format: (value: number) => string;
}) {
  const { target, durationMs = 650, format } = params;
  const prefersReducedMotion = usePrefersReducedMotion();

  const formatRef = React.useRef(format);
  React.useEffect(() => {
    formatRef.current = format;
  }, [format]);

  const [display, setDisplay] = React.useState(() =>
    target === null || !Number.isFinite(target)
      ? "—"
      : formatRef.current(target),
  );

  React.useEffect(() => {
    if (target === null || !Number.isFinite(target)) {
      setDisplay("—");
      return;
    }

    if (prefersReducedMotion) {
      setDisplay(formatRef.current(target));
      return;
    }

    let raf = 0;
    const start = performance.now();
    const from = 0;
    const to = target;

    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = from + (to - from) * eased;
      setDisplay(formatRef.current(current));
      if (t < 1) raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs, prefersReducedMotion]);

  return display;
}

type HealthStatus = "green" | "yellow" | "red";

function worstHealthStatus(a: HealthStatus, b: HealthStatus): HealthStatus {
  const weight = (s: HealthStatus) =>
    s === "red" ? 2 : s === "yellow" ? 1 : 0;
  return weight(a) >= weight(b) ? a : b;
}

function healthStatusCardClasses(status: HealthStatus) {
  switch (status) {
    case "green":
      return "border-green-200 bg-green-500/10";
    case "yellow":
      return "border-yellow-200 bg-yellow-500/10";
    case "red":
      return "border-red-200 bg-red-500/10";
  }
}

function healthValueTextClass(status: HealthStatus) {
  switch (status) {
    case "green":
      return "text-green-700";
    case "yellow":
      return "text-yellow-700";
    case "red":
      return "text-red-700";
  }
}

function trendDirection(delta: number, epsilon: number) {
  if (!Number.isFinite(delta)) return "flat" as const;
  if (delta > epsilon) return "up" as const;
  if (delta < -epsilon) return "down" as const;
  return "flat" as const;
}

function TrendIndicator(props: {
  delta: number | null;
  higherIsBetter: boolean;
  suffix: string;
  fractionDigits: number;
}) {
  const { delta, higherIsBetter, suffix, fractionDigits } = props;
  if (delta === null || !Number.isFinite(delta)) return null;

  const direction = trendDirection(delta, 0.01);
  const Icon =
    direction === "up"
      ? TrendingUp
      : direction === "down"
        ? TrendingDown
        : Minus;

  const isImproving =
    direction === "flat" ? null : higherIsBetter ? delta > 0 : delta < 0;

  const colorClass =
    isImproving === null
      ? "text-muted-foreground"
      : isImproving
        ? "text-green-700"
        : "text-red-700";

  const sign = delta > 0 ? "+" : "";

  return (
    <div
      className={`flex items-center gap-1 text-xs font-medium ${colorClass}`}
    >
      <Icon className="h-3 w-3" />
      <span>
        {sign}
        {delta.toFixed(fractionDigits)}
        {suffix}
      </span>
    </div>
  );
}

function badgeVariantFromHealth(status: "green" | "yellow" | "red") {
  if (status === "green") return "success" as const;
  if (status === "yellow") return "warning" as const;
  return "destructive" as const;
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
        (typeof (error as any)?.message === "string" && (error as any).message) ||
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

function useEmailDomainReadiness(params: {
  enabled: boolean;
  tenantId: string | null | undefined;
  sendingDomain: string | null | undefined;
  senderEmail?: string | null | undefined;
}) {
  const { enabled, tenantId, sendingDomain, senderEmail } = params;

  const domainCandidates = React.useMemo(() => {
    const candidates: string[] = [];

    const normalizeHost = (value: string): string => {
      let raw = String(value || "").trim();
      if (!raw) return "";

      raw = raw.replace(/^mailto:/i, "");

      if (raw.includes("@")) {
        const at = raw.lastIndexOf("@");
        raw = raw.slice(at + 1);
      }

      // If it looks like a URL, parse the hostname.
      if (raw.includes("://")) {
        try {
          const url = new URL(raw);
          raw = url.hostname;
        } catch {
          // fall through
        }
      }

      // Strip any path/query/fragment if present.
      raw = raw.split("/")[0] || raw;
      raw = raw.split("?")[0] || raw;
      raw = raw.split("#")[0] || raw;

      // Strip port.
      raw = raw.split(":")[0] || raw;

      raw = raw.trim().toLowerCase();
      raw = raw.replace(/\.+$/, "");

      return raw;
    };

    const addCandidate = (value: string) => {
      const host = normalizeHost(value);
      if (!host) return;
      candidates.push(host);

      const prefixes = ["www.", "mail.", "smtp.", "email."];
      for (const prefix of prefixes) {
        if (host.startsWith(prefix) && host.length > prefix.length) {
          candidates.push(host.slice(prefix.length));
        }
      }
    };

    if (sendingDomain) addCandidate(sendingDomain);
    if (senderEmail) addCandidate(senderEmail);

    // De-dupe while preserving order.
    return candidates.filter(
      (candidate, index) => candidates.indexOf(candidate) === index,
    );
  }, [sendingDomain, senderEmail]);

  const normalizedDomain = domainCandidates[0] || "";

  const domainLookupQuery = useQuery({
    queryKey: ["email-domain-row", tenantId, domainCandidates.join("|")],
    enabled: Boolean(enabled && tenantId && domainCandidates.length > 0),
    staleTime: 60_000,
    queryFn: async (): Promise<DomainLookupRow | null> => {
      // Prefer an active/warming_up domain if multiple rows exist.
      for (const candidate of domainCandidates) {
        const preferred = await supabase
          .from("email_domains")
          .select("id, domain, status")
          .eq("tenant_id", tenantId)
          .ilike("domain", candidate)
          .in("status", ["active", "warming_up"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (preferred.error) throw preferred.error;
        if (preferred.data) return (preferred.data as any) || null;
      }

      for (const candidate of domainCandidates) {
        const fallback = await supabase
          .from("email_domains")
          .select("id, domain, status")
          .eq("tenant_id", tenantId)
          .ilike("domain", candidate)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (fallback.error) throw fallback.error;
        if (fallback.data) return (fallback.data as any) || null;
      }

      return null;
    },
  });

  const domainRow = domainLookupQuery.data || null;
  const domainId = domainRow?.id || null;

  const verifyQuery = useQuery({
    queryKey: ["email-domain-verify", tenantId, domainId],
    enabled: Boolean(enabled && tenantId && domainId),
    staleTime: 60_000,
    queryFn: async (): Promise<EmailDomainVerifyResponse | null> => {
      const { data, error } = await supabase.functions.invoke(
        "email-domain-verify",
        {
          body: {
            email_domain_id: domainId,
          },
        },
      );

      if (error) {
        const parsed = parseFunctionsInvokeError(error);
        throw new Error(parsed.message);
      }

      return (data as any) || null;
    },
  });

  const readinessStatus = String(verifyQuery.data?.readiness?.status || "")
    .trim()
    .toUpperCase();

  const isReadyStatus =
    // Legacy + current readiness statuses.
    readinessStatus === "READY_TO_SEND" ||
    readinessStatus === "CONNECTED_READY";

  const checksLoading =
    domainLookupQuery.isLoading || (Boolean(domainId) && verifyQuery.isLoading);

  const domainStatus = String(domainRow?.status || "")
    .trim()
    .toLowerCase();
  const domainStatusReady =
    domainStatus === "active" || domainStatus === "warming_up";

  const verifyStatus = String(verifyQuery.data?.status || "")
    .trim()
    .toLowerCase();
  const verifyStatusReady =
    verifyStatus === "active" || verifyStatus === "warming_up";

  const domainConfigured = Boolean(normalizedDomain && domainId);
  const domainReady: boolean | null = checksLoading
    ? null
    : domainConfigured
      ? // IMPORTANT: elsewhere in the app, a domain with status=active/warming_up is
        // considered send-ready. The readiness.status can be DOMAIN_NOT_CONNECTED for
        // non-Entri/manual domains even when DNS is verified and status is active.
        // To avoid false negatives, treat active/warming_up as ready.
        domainStatusReady || verifyStatusReady || isReadyStatus
      : false;

  return {
    normalizedDomain,
    domainCandidates,
    domainId,
    domainStatus: domainStatus || null,
    domainLookupLoading: domainLookupQuery.isLoading,
    domainLookupError: domainLookupQuery.error
      ? getErrorMessage(domainLookupQuery.error) || "Failed to load domain"
      : null,
    verifyLoading: verifyQuery.isLoading,
    verifyError: verifyQuery.error
      ? getErrorMessage(verifyQuery.error) || "Failed to verify domain"
      : null,
    readinessStatus: readinessStatus || null,
    readinessMessage:
      verifyQuery.data?.readiness?.subMessage ||
      verifyQuery.data?.readiness?.message ||
      null,
    domainReady,
    domainConfigured,
  };
}

function ComplianceRow(props: {
  label: string;
  loading: boolean;
  state: PreflightRowState;
  detail?: string;
  okLabel?: string;
  warnLabel?: string;
  blockLabel?: string;
}) {
  const {
    label,
    loading,
    state,
    detail,
    okLabel = "OK",
    warnLabel = "Warning",
    blockLabel = "Blocked",
  } = props;

  const badge =
    state === "ok"
      ? { variant: "success" as const, prefix: "✔", text: okLabel }
      : state === "warn"
        ? { variant: "warning" as const, prefix: "⚠", text: warnLabel }
        : state === "block"
          ? { variant: "destructive" as const, prefix: "✖", text: blockLabel }
          : { variant: "secondary" as const, prefix: "?", text: "Unknown" };

  return (
    <div
      className={`flex items-start justify-between gap-4 rounded-lg px-3 py-2 ${
        state === "block"
          ? "border border-destructive/30 bg-destructive/10"
          : ""
      }`}
    >
      <div className="min-w-0">
        <div className="text-sm text-foreground">{label}</div>
        {!loading && detail ? (
          <div
            className={`mt-0.5 text-xs ${
              state === "block"
                ? "text-destructive/90"
                : "text-muted-foreground"
            }`}
          >
            {detail}
          </div>
        ) : null}
      </div>
      <div className="shrink-0">
        {loading ? (
          <Skeleton className="h-5 w-28" />
        ) : (
          <Badge variant={badge.variant}>
            {badge.prefix} {badge.text}
          </Badge>
        )}
      </div>
    </div>
  );
}

function FinalPreflightCheckRow(props: { check: FinalPreflightCheck }) {
  const { check } = props;

  const Icon = check.loading
    ? Loader2
    : check.state === "ok"
      ? CheckCircle2
      : check.state === "warn"
        ? AlertTriangle
        : check.state === "block"
          ? XCircle
          : Minus;

  const iconClassName = check.loading
    ? "text-blue-700"
    : check.state === "ok"
      ? "text-green-700"
      : check.state === "warn"
        ? "text-yellow-700"
        : check.state === "block"
          ? "text-destructive"
          : "text-muted-foreground";

  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-blue-200/60 bg-white/60 px-3 py-2">
      <div className="flex min-w-0 items-start gap-2">
        <Icon
          className={`mt-0.5 h-4 w-4 shrink-0 ${iconClassName} ${
            check.loading ? "animate-spin" : ""
          }`}
        />
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground">
            {check.label}
          </div>
          {check.loading ? (
            <div className="mt-0.5 text-xs text-muted-foreground">
              Checking…
            </div>
          ) : check.detail ? (
            <div className="mt-0.5 text-xs text-muted-foreground">
              {check.detail}
            </div>
          ) : null}
        </div>
      </div>

      {!check.loading && check.actionHref ? (
        <Link
          to={check.actionHref}
          className="shrink-0 text-xs font-medium text-primary underline underline-offset-2"
        >
          {check.actionLabel || "Fix Now"}
        </Link>
      ) : null}
    </div>
  );
}

function HealthSnapshotStat(props: {
  label: string;
  value: string;
  status: HealthStatus;
  trend?: React.ReactNode;
}) {
  const { label, value, status, trend } = props;
  return (
    <div className="flex-1 px-4 py-3 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-medium text-muted-foreground truncate">
          {label}
        </div>
        {trend ? <div className="shrink-0">{trend}</div> : null}
      </div>
      <div
        className={`mt-1 text-2xl font-semibold tabular-nums ${healthValueTextClass(
          status,
        )}`}
      >
        {value}
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
  const { tenant } = useTenant();
  const tenantId = tenant?.id;

  const [preflightSummary, setPreflightSummary] =
    React.useState<PreflightSummary | null>(null);
  const preflightRevalidateRef = React.useRef<
    null | (() => Promise<PreflightSummary | null>)
  >(null);
  const [preflightSubmitting, setPreflightSubmitting] = React.useState(false);

  const shouldLoadPreflight = isOpen;

  const domainReadiness = useEmailDomainReadiness({
    enabled: shouldLoadPreflight,
    tenantId,
    sendingDomain: senderIdentity.sendingDomain,
    senderEmail: senderIdentity.senderEmail,
  });

  const buildDomainCheck = React.useCallback((): FinalPreflightCheck => {
    const isLoading = domainReadiness.domainReady === null;
    if (isLoading) {
      return {
        id: "domain",
        label: "Sending domain ready",
        loading: true,
        state: "unknown",
      };
    }

    if (domainReadiness.domainReady) {
      return {
        id: "domain",
        label: "Sending domain ready",
        loading: false,
        state: "ok",
      };
    }

    const statusSuffix = domainReadiness.domainStatus
      ? ` (status: ${domainReadiness.domainStatus})`
      : "";

    const detail =
      domainReadiness.readinessMessage ||
      (senderIdentity.sendingDomain
        ? `Sending domain is not ready to send.${statusSuffix}`
        : "No sending domain configured.");

    return {
      id: "domain",
      label: "Sending domain ready",
      loading: false,
      state: "block",
      detail,
      actionHref: "/crm/settings/email-sending",
      actionLabel: "Fix Now",
    };
  }, [
    domainReadiness.domainReady,
    domainReadiness.readinessMessage,
    domainReadiness.domainStatus,
    senderIdentity.sendingDomain,
  ]);

  const finalPreflightChecks = React.useMemo(() => {
    const domainCheck = buildDomainCheck();

    const fallbackPreflightChecks: FinalPreflightCheck[] = [
      {
        id: "governance",
        label: "Governance policy / under-review",
        loading: shouldLoadPreflight,
        state: "unknown",
      },
      {
        id: "quota",
        label: "Send quota",
        loading: shouldLoadPreflight,
        state: "unknown",
      },
      {
        id: "bounce",
        label: "Bounce threshold (30d)",
        loading: shouldLoadPreflight,
        state: "unknown",
      },
      {
        id: "complaint",
        label: "Complaint threshold (30d)",
        loading: shouldLoadPreflight,
        state: "unknown",
      },
      {
        id: "audience",
        label: "Audience size > 0",
        loading: false,
        state: "unknown",
      },
    ];

    const preflightChecks =
      preflightSummary?.checks?.length && shouldLoadPreflight
        ? preflightSummary.checks
        : fallbackPreflightChecks;

    // Audience targeting check — warn if sending to all contacts with no segments
    const hasAudience = selectedSegments.length > 0 || selectedPersonas.length > 0;
    const audienceCheck: FinalPreflightCheck = {
      id: "audience",
      label: "Audience targeted",
      loading: false,
      state: hasAudience ? "ok" : "warn",
      detail: hasAudience
        ? `${selectedSegments.length + selectedPersonas.length} segment(s) selected`
        : `No segments selected — sending to ALL contacts. Targeted campaigns perform better and reduce unsubscribes.`,
    };

    return [domainCheck, audienceCheck, ...preflightChecks];
  }, [buildDomainCheck, preflightSummary?.checks, shouldLoadPreflight, selectedSegments, selectedPersonas]);

  const finalPreflightChecking =
    shouldLoadPreflight && finalPreflightChecks.some((c) => c.loading);
  const finalPreflightBlocked = finalPreflightChecks.some(
    (c) => c.state === "block",
  );

  const handleSend = React.useCallback(async () => {
    if (loading || preflightSubmitting) return;
    setPreflightSubmitting(true);

    try {
      const revalidate = preflightRevalidateRef.current;
      const summary = revalidate ? await revalidate() : preflightSummary;
      if (summary) setPreflightSummary(summary);

      // Domain readiness is a hard gate.
      const domainCheck = buildDomainCheck();
      if (domainCheck.loading) return;
      if (domainCheck.state === "block") return;

      const checks = [domainCheck, ...(summary?.checks || [])];
      const stillChecking = checks.some((c) => c.loading);
      const blocked = checks.some((c) => c.state === "block");

      if (stillChecking) return;
      if (blocked) return;

      onConfirm();
    } finally {
      setPreflightSubmitting(false);
    }
  }, [
    buildDomainCheck,
    loading,
    onConfirm,
    preflightSubmitting,
    preflightSummary,
  ]);

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

    if (!date) return "Scheduled";

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

  const {
    data: healthData,
    isLoading: healthLoading,
    error: healthError,
    refetch: refetchHealth,
  } = useTenantEmailHealthDashboard(tenantId, { enabled: shouldLoadPreflight });

  const { data: suppressionStats, isLoading: suppressionLoading } =
    useSuppressionStats({
      enabled: shouldLoadPreflight,
    });

  const { data: blockedEmailCount, isLoading: blockedLoading } =
    useBlockedEmailCount({
      enabled: shouldLoadPreflight,
    });

  const deliveryPct30d = React.useMemo(() => {
    const sent = Number(healthData?.sent_30d || 0);
    const delivered = Number(healthData?.delivered_30d || 0);
    if (!sent || sent <= 0) return null;
    return (delivered / sent) * 100;
  }, [healthData]);

  const bouncePct30d = React.useMemo(() => {
    const fromRate = coerceRateToPercent(healthData?.bounce_rate_30d);
    if (fromRate !== null) return fromRate;
    return percentFromCounts(healthData?.bounced_30d, healthData?.sent_30d);
  }, [healthData]);

  const complaintPct30d = React.useMemo(() => {
    const fromRate = coerceRateToPercent(healthData?.complaint_rate_30d);
    if (fromRate !== null) return fromRate;
    return percentFromCounts(healthData?.complained_30d, healthData?.sent_30d);
  }, [healthData]);

  const bounceStatus: HealthStatus =
    bouncePct30d === null
      ? "green"
      : getHealthStatus(bouncePct30d, ANALYTICS_THRESHOLDS.bounceRate);
  const complaintStatus: HealthStatus =
    complaintPct30d === null
      ? "green"
      : getHealthStatus(complaintPct30d, ANALYTICS_THRESHOLDS.complaintRate);
  const overallStatus = worstHealthStatus(bounceStatus, complaintStatus);

  const deliveryRate24h = React.useMemo(() => {
    const sent = Number(healthData?.sent_24h || 0);
    const delivered = Number(healthData?.delivered_24h || 0);
    if (!sent || sent <= 0) return null;
    return (delivered / sent) * 100;
  }, [healthData]);

  const bouncePct24h = React.useMemo(() => {
    const fromRate = coerceRateToPercent(healthData?.bounce_rate_24h);
    if (fromRate !== null) return fromRate;
    return percentFromCounts(healthData?.bounced_24h, healthData?.sent_24h);
  }, [healthData]);

  const complaintPct24h = React.useMemo(() => {
    const fromRate = coerceRateToPercent(healthData?.complaint_rate_24h);
    if (fromRate !== null) return fromRate;
    return percentFromCounts(healthData?.complained_24h, healthData?.sent_24h);
  }, [healthData]);

  const deliveryTrendDelta =
    deliveryRate24h === null || deliveryPct30d === null
      ? null
      : deliveryRate24h - deliveryPct30d;
  const bounceTrendDelta =
    bouncePct24h === null || bouncePct30d === null
      ? null
      : bouncePct24h - bouncePct30d;
  const complaintTrendDelta =
    complaintPct24h === null || complaintPct30d === null
      ? null
      : complaintPct24h - complaintPct30d;

  const deliveryDisplay = useCountUp({
    target: deliveryPct30d,
    format: (v) => `${v.toFixed(2)}%`,
  });
  const bounceDisplay = useCountUp({
    target: bouncePct30d,
    format: (v) => `${v.toFixed(2)}%`,
  });
  const complaintDisplay = useCountUp({
    target: complaintPct30d,
    format: (v) => `${v.toFixed(3)}%`,
  });
  const suppressedDisplay = useCountUp({
    target: Number(suppressionStats?.total ?? 0),
    format: (v) => Math.round(v).toLocaleString(),
  });
  const blockedDisplay = useCountUp({
    target: typeof blockedEmailCount === "number" ? blockedEmailCount : 0,
    format: (v) => Math.round(v).toLocaleString(),
  });

  const preflightWarn = Boolean(preflightSummary?.hasWarnings);
  const sendDisabled =
    loading ||
    preflightSubmitting ||
    finalPreflightChecking ||
    finalPreflightBlocked;

  const governanceBadge = (() => {
    if (!shouldLoadPreflight) return null;

    const checking = Boolean(preflightSummary?.checking ?? true);
    if (checking) {
      return (
        <Badge variant="secondary" className="shrink-0">
          Checking…
        </Badge>
      );
    }

    const scoreText =
      typeof preflightSummary?.score === "number" &&
      Number.isFinite(preflightSummary.score)
        ? String(preflightSummary.score)
        : "—";

    const preflightBlocked = Boolean(preflightSummary?.blocked);
    if (preflightBlocked) {
      return (
        <Badge variant="destructive" className="shrink-0">
          ✖ Governance Score: {scoreText} – Critical
        </Badge>
      );
    }

    if (preflightWarn) {
      return (
        <Badge variant="warning" className="shrink-0">
          ⚠ Governance Score: {scoreText} – At Risk
        </Badge>
      );
    }

    return (
      <Badge variant="success" className="shrink-0">
        ✔ Governance Score: {scoreText} – Healthy
      </Badge>
    );
  })();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex flex-col w-[95vw] md:w-[70vw] max-w-[1100px] max-h-[85vh] overflow-hidden p-8 rounded-2xl shadow-2xl">
        <DialogHeader className="text-left space-y-3">
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <DialogTitle className="text-xl truncate">
                {campaignName || "Untitled"}
              </DialogTitle>
              <DialogDescription className="mt-1">
                Review campaign details and sender identity before continuing.
              </DialogDescription>
            </div>

            {governanceBadge}
          </div>
        </DialogHeader>

        {/* Milestone 1 — Health Snapshot Bar (top) */}
        <div className="mt-4 rounded-xl border bg-white">
          {healthLoading || suppressionLoading || blockedLoading ? (
            <div className="flex divide-x">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex-1 px-4 py-3">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="mt-2 h-7 w-24" />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex divide-x">
              <HealthSnapshotStat
                label="Delivery Rate"
                value={deliveryDisplay}
                status={overallStatus}
                trend={
                  <TrendIndicator
                    delta={deliveryTrendDelta}
                    higherIsBetter={true}
                    suffix="%"
                    fractionDigits={2}
                  />
                }
              />
              <HealthSnapshotStat
                label="Bounce Rate"
                value={bounceDisplay}
                status={bounceStatus}
                trend={
                  <TrendIndicator
                    delta={bounceTrendDelta}
                    higherIsBetter={false}
                    suffix="%"
                    fractionDigits={2}
                  />
                }
              />
              <HealthSnapshotStat
                label="Complaint Rate"
                value={complaintDisplay}
                status={complaintStatus}
                trend={
                  <TrendIndicator
                    delta={complaintTrendDelta}
                    higherIsBetter={false}
                    suffix="%"
                    fractionDigits={3}
                  />
                }
              />
              <HealthSnapshotStat
                label="Suppression"
                value={suppressedDisplay}
                status={overallStatus}
              />
              <HealthSnapshotStat
                label="Blocked"
                value={blockedDisplay}
                status={overallStatus}
              />
            </div>
          )}

          {healthError ? (
            <div className="border-t px-4 py-2 text-xs text-muted-foreground">
              Unable to load some health metrics right now.
            </div>
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto pt-6">
          <div className="space-y-6">
            {/* Milestone 1 — Campaign & Sender Overview (unified) */}
            <section className="rounded-xl border bg-white p-6">
              <h3 className="text-base font-semibold">
                Campaign &amp; Sender Overview
              </h3>

              <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-4">
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
                    <div className="text-2xl font-semibold text-foreground tabular-nums">
                      {Number.isFinite(totalRecipients)
                        ? totalRecipients.toLocaleString()
                        : "—"}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-1">
                    <div className="text-xs font-medium text-muted-foreground">
                      Send Time
                    </div>
                    <div className="text-sm text-foreground">
                      {scheduleLabel}
                    </div>
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-1">
                    <div className="text-xs font-medium text-muted-foreground">
                      Sending From
                    </div>
                    <div className="text-sm font-semibold text-foreground break-words">
                      {senderIdentity.senderName || "—"}
                    </div>
                    <div className="text-sm font-medium text-foreground break-words">
                      {senderIdentity.senderEmail || "—"}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-1">
                    <div className="text-xs font-medium text-muted-foreground">
                      Reply-To
                    </div>
                    <div className="text-sm text-foreground break-words">
                      {replyToToShow || "—"}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    <div>
                      <div className="text-xs font-medium text-muted-foreground">
                        Sending Domain
                      </div>
                      <div className="text-sm text-foreground break-words">
                        {senderIdentity.sendingDomain || "—"}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs font-medium text-muted-foreground">
                        Domain Status
                      </div>
                      <div className="flex items-center gap-2">
                        {domainReadiness.domainReady === null ? (
                          <Skeleton className="h-5 w-28" />
                        ) : domainReadiness.domainReady ? (
                          <Badge variant="success">✔ Domain Ready</Badge>
                        ) : (
                          <>
                            <Badge variant="warning">⚠ Domain Not Ready</Badge>
                            <Link
                              to="/crm/settings/email-sending"
                              className="text-xs font-medium text-primary underline underline-offset-2"
                            >
                              Fix Now
                            </Link>
                          </>
                        )}
                      </div>
                    </div>

                    {!domainReadiness.domainReady &&
                    domainReadiness.domainReady !== null &&
                    domainReadiness.readinessMessage ? (
                      <div className="text-xs text-muted-foreground">
                        {domainReadiness.readinessMessage}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </section>

            {/* Governance Score & Compliance (kept, moved below overview) */}
            {shouldLoadPreflight ? (
              <PreflightPanels
                tenantId={tenantId}
                tenantUnderReview={Boolean((tenant as any)?.email_under_review)}
                totalRecipients={totalRecipients}
                domainId={domainReadiness.domainId}
                domainLookupLoading={domainReadiness.domainLookupLoading}
                healthData={healthData}
                healthLoading={healthLoading}
                onRefetchHealth={refetchHealth}
                onPreflightSummaryChange={setPreflightSummary}
                onRegisterRevalidate={(fn) => {
                  preflightRevalidateRef.current = fn;
                }}
              />
            ) : null}
          </div>
        </div>

        {shouldLoadPreflight ? (
          <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-4">
            <div className="text-sm font-semibold text-blue-900">
              Final Preflight Checks
            </div>
            <div className="mt-3 space-y-2">
              {finalPreflightChecks.map((check) => (
                <FinalPreflightCheckRow key={check.id} check={check} />
              ))}
            </div>
          </div>
        ) : null}

        <DialogFooter className="shrink-0 border-t pt-6 mt-6 flex-row items-center justify-between gap-4 sm:space-x-0">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <div className="flex items-center gap-3">
            <Button
              onClick={handleSend}
              disabled={sendDisabled}
              variant={finalPreflightBlocked ? "destructive" : "default"}
            >
              {loading || preflightSubmitting
                ? "Sending..."
                : finalPreflightChecking
                  ? "Checking..."
                  : finalPreflightBlocked
                    ? "Sending Disabled – Review Issues"
                    : "Send Campaign"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

function PreflightPanels(props: {
  tenantId: string | null | undefined;
  tenantUnderReview: boolean;
  totalRecipients: number;
  domainId: string | null;
  domainLookupLoading: boolean;
  healthData: TenantEmailHealthDashboard | null | undefined;
  healthLoading: boolean;
  onRefetchHealth?: () => Promise<unknown>;
  onPreflightSummaryChange?: (summary: PreflightSummary) => void;
  onRegisterRevalidate?: (fn: () => Promise<PreflightSummary | null>) => void;
}) {
  const {
    tenantId,
    tenantUnderReview,
    totalRecipients,
    domainId,
    domainLookupLoading,
    healthData,
    healthLoading,
    onRefetchHealth,
    onPreflightSummaryChange,
    onRegisterRevalidate,
  } = props;

  const policyQuery = useQuery({
    queryKey: ["tenant-reputation-policy", tenantId],
    enabled: Boolean(tenantId),
    queryFn: async (): Promise<TenantReputationPolicy> => {
      const { data, error } = await supabase.rpc(
        "get_tenant_reputation_policy" as never,
        { p_tenant_id: tenantId } as never,
      );
      if (error) throw error;
      const row = (Array.isArray(data as any) ? (data as any)[0] : data) as any;
      if (!row) return null;
      return {
        score: Number(row.score ?? 100),
        tier: String(row.tier ?? "normal"),
        action: String(row.action ?? "allow"),
        recipient_cap:
          row.recipient_cap === null || row.recipient_cap === undefined
            ? null
            : Number(row.recipient_cap),
        job_batch_size:
          row.job_batch_size === null || row.job_batch_size === undefined
            ? null
            : Number(row.job_batch_size),
        send_pacing_multiplier:
          row.send_pacing_multiplier === null ||
          row.send_pacing_multiplier === undefined
            ? null
            : Number(row.send_pacing_multiplier),
      };
    },
  });

  const underReviewOverrideQuery = useQuery({
    queryKey: ["tenant-under-review-override", tenantId],
    enabled: Boolean(tenantId),
    queryFn: async (): Promise<TenantUnderReviewOverrideState> => {
      const { data, error } = await supabase.rpc(
        "get_tenant_under_review_override_state" as never,
        { p_tenant_id: tenantId } as never,
      );
      if (error) throw error;
      const row = (Array.isArray(data as any) ? (data as any)[0] : data) as any;
      return row || null;
    },
  });

  const quotaQuery = useQuery({
    queryKey: ["check-send-quota", tenantId, domainId, totalRecipients],
    enabled:
      Boolean(tenantId) &&
      Boolean(domainId) &&
      Number.isFinite(totalRecipients) &&
      totalRecipients >= 0,
    queryFn: async (): Promise<SendQuotaCheckResult> => {
      const recipientCount = Math.max(1, Math.floor(Number(totalRecipients)));
      const { data, error } = await supabase.rpc(
        "check_send_quota" as never,
        {
          p_tenant_id: tenantId,
          p_domain_id: domainId,
          p_recipient_count: recipientCount,
        } as never,
      );
      if (error) throw error;
      return (data as any) || null;
    },
  });

  const computePreflightSummary = React.useCallback((): PreflightSummary => {
    const policy = policyQuery.data;
    const override = underReviewOverrideQuery.data;
    const quota = quotaQuery.data;

    const checking =
      domainLookupLoading ||
      healthLoading ||
      policyQuery.isLoading ||
      underReviewOverrideQuery.isLoading ||
      quotaQuery.isLoading;

    const overrideFinal = Boolean(
      (override as any)?.under_review_override_final,
    );
    const overrideActive = Boolean(
      (override as any)?.under_review_override_active,
    );

    const effectivePolicyActionRaw = String(policy?.action || "").toLowerCase();
    const effectivePolicyTier = String(policy?.tier || "").toLowerCase();

    const bouncePct30d = healthData
      ? (coerceRateToPercent(healthData.bounce_rate_30d) ??
        percentFromCounts(healthData.bounced_30d, healthData.sent_30d))
      : null;
    const complaintPct30d = healthData
      ? (coerceRateToPercent(healthData.complaint_rate_30d) ??
        percentFromCounts(healthData.complained_30d, healthData.sent_30d))
      : null;

    const bounceStatus =
      bouncePct30d === null
        ? ("unknown" as const)
        : getHealthStatus(bouncePct30d, ANALYTICS_THRESHOLDS.bounceRate);
    const complaintStatus =
      complaintPct30d === null
        ? ("unknown" as const)
        : getHealthStatus(complaintPct30d, ANALYTICS_THRESHOLDS.complaintRate);

    const bounceState: PreflightRowState =
      bounceStatus === "unknown"
        ? "unknown"
        : bounceStatus === "red"
          ? "block"
          : bounceStatus === "yellow"
            ? "warn"
            : "ok";

    const complaintState: PreflightRowState =
      complaintStatus === "unknown"
        ? "unknown"
        : complaintStatus === "red"
          ? "block"
          : complaintStatus === "yellow"
            ? "warn"
            : "ok";

    const accountState: PreflightRowState = tenantUnderReview
      ? overrideFinal
        ? "warn"
        : "block"
      : "ok";

    const overridesState: PreflightRowState = overrideActive ? "warn" : "ok";

    const policyState: PreflightRowState = (() => {
      if (!policy) return "unknown";

      const action = effectivePolicyActionRaw;
      if (action === "allow") return "ok";
      if (action === "throttle") return "warn";
      if (action === "restrict") return "block";
      if (action === "pause" || action === "block") {
        if (tenantUnderReview && overrideFinal) return "warn";
        return "block";
      }
      return "warn";
    })();

    const audienceState: PreflightRowState =
      Number.isFinite(Number(totalRecipients)) && Number(totalRecipients) > 0
        ? "ok"
        : "block";

    const quotaState: PreflightRowState = (() => {
      if (!domainId) return "block";
      if (!quota) return quotaQuery.isLoading ? "unknown" : "block";
      const allowed = Boolean((quota as any)?.allowed);
      const warnings = (quota as any)?.warnings;
      const warningsCount = Array.isArray(warnings) ? warnings.length : 0;
      if (!allowed) return "block";
      if (warningsCount > 0) return "warn";
      return "ok";
    })();

    const governanceRowLoading =
      policyQuery.isLoading || underReviewOverrideQuery.isLoading;
    const governanceRowState: PreflightRowState =
      accountState === "block" || policyState === "block"
        ? "block"
        : accountState === "warn" ||
            policyState === "warn" ||
            overridesState === "warn"
          ? "warn"
          : "ok";

    const governanceDetail = (() => {
      const action = effectivePolicyActionRaw;
      if (tenantUnderReview) {
        return overrideFinal
          ? "Tenant is under review (override active)."
          : "Tenant is under review.";
      }
      if (action === "pause" || action === "block") {
        return "Sending is paused by governance policy.";
      }
      if (action === "restrict") {
        return "Governance policy currently blocks sending.";
      }
      if (action === "throttle") {
        return "Governance policy may throttle sending.";
      }
      if (overrideActive) {
        const reason =
          typeof (override as any)?.under_review_override_reason === "string" &&
          (override as any)?.under_review_override_reason
            ? String((override as any).under_review_override_reason)
            : null;
        return reason || "Tenant override is active.";
      }
      return undefined;
    })();

    const quotaRowLoading = domainLookupLoading || quotaQuery.isLoading;
    const quotaDetail = (() => {
      if (quotaState === "block") {
        const msg =
          typeof (quota as any)?.message === "string" && (quota as any).message
            ? String((quota as any).message)
            : !domainId
              ? "Sending domain is required for quota validation."
              : "Quota check failed or blocked.";
        return msg;
      }

      if (quotaState === "warn") {
        const warnings = (quota as any)?.warnings;
        if (Array.isArray(warnings) && warnings.length > 0) {
          return String(warnings[0]);
        }
        return "Quota check returned warnings.";
      }

      return undefined;
    })();

    const bounceRowLoading = healthLoading;
    const bounceDetail = (() => {
      if (bounceRowLoading) return undefined;
      if (bounceState === "block")
        return "Bounce rate is above the hard-stop threshold.";
      if (bounceState === "warn") return "Bounce rate is elevated.";
      return undefined;
    })();

    const complaintRowLoading = healthLoading;
    const complaintDetail = (() => {
      if (complaintRowLoading) return undefined;
      if (complaintState === "block")
        return "Complaint rate is above the hard-stop threshold.";
      if (complaintState === "warn") return "Complaint rate is elevated.";
      return undefined;
    })();

    const audienceDetail =
      audienceState === "block"
        ? "Audience size is empty or invalid."
        : undefined;

    const checks: FinalPreflightCheck[] = [
      {
        id: "governance",
        label: "Governance policy / under-review",
        loading: governanceRowLoading,
        state: governanceRowState,
        detail: governanceDetail,
      },
      {
        id: "quota",
        label: "Send quota",
        loading: quotaRowLoading,
        state: quotaState,
        detail: quotaDetail,
      },
      {
        id: "bounce",
        label: "Bounce threshold (30d)",
        loading: bounceRowLoading,
        state: bounceState,
        detail: bounceDetail,
      },
      {
        id: "complaint",
        label: "Complaint threshold (30d)",
        loading: complaintRowLoading,
        state: complaintState,
        detail: complaintDetail,
      },
      {
        id: "audience",
        label: "Audience size > 0",
        loading: false,
        state: audienceState,
        detail: audienceDetail,
      },
    ];

    const blockReasons: string[] = [];
    const warningReasons: string[] = [];

    if (accountState === "block") {
      blockReasons.push("Account is under review.");
    } else if (accountState === "warn") {
      warningReasons.push("Account is under review (override active).");
    }

    if (overridesState === "warn") {
      warningReasons.push("Tenant override is active.");
    }

    if (policyState === "block") {
      blockReasons.push("Governance policy currently blocks sending.");
    } else if (policyState === "warn") {
      warningReasons.push("Governance policy may throttle sending.");
    }

    if (bounceState === "block") {
      blockReasons.push("Bounce rate is above the hard-stop threshold.");
    } else if (bounceState === "warn") {
      warningReasons.push("Bounce rate is elevated.");
    }

    if (complaintState === "block") {
      blockReasons.push("Complaint rate is above the hard-stop threshold.");
    } else if (complaintState === "warn") {
      warningReasons.push("Complaint rate is elevated.");
    }

    if (audienceState === "block") {
      blockReasons.push("Audience size is empty or invalid.");
    }

    if (quotaState === "block") {
      const quotaMsg =
        typeof (quota as any)?.message === "string" && (quota as any).message
          ? String((quota as any).message)
          : !domainId
            ? "Sending domain is required for quota validation."
            : "Quota check failed or blocked.";
      blockReasons.push(quotaMsg);
    } else if (quotaState === "warn") {
      const warnings = (quota as any)?.warnings;
      if (Array.isArray(warnings) && warnings.length > 0) {
        warningReasons.push(String(warnings[0]));
      } else {
        warningReasons.push("Quota check returned warnings.");
      }
    }

    const hardStopThreshold =
      bounceState === "block" || complaintState === "block";

    const risk = governanceRiskFromPolicy({
      reputationTier: effectivePolicyTier || null,
      reputationAction: effectivePolicyActionRaw || null,
      hasHardStopThreshold: hardStopThreshold,
    });

    const score =
      policy && Number.isFinite(Number(policy.score))
        ? Number(policy.score)
        : healthData && Number.isFinite(Number(healthData.reputation_score))
          ? Number(healthData.reputation_score)
          : null;

    const scoreLabel = governanceRiskLabel(risk);
    const sendingStatusLabel = governanceSendingStatusLabel(risk);

    const blocked = blockReasons.length > 0;
    const hasWarnings = warningReasons.length > 0;

    return {
      checking,
      blocked,
      hasWarnings,
      blockReasons,
      warningReasons,
      score,
      scoreLabel,
      sendingStatusLabel,
      checks,
    };
  }, [
    domainLookupLoading,
    healthLoading,
    policyQuery.data,
    policyQuery.isLoading,
    underReviewOverrideQuery.data,
    underReviewOverrideQuery.isLoading,
    quotaQuery.data,
    quotaQuery.isLoading,
    healthData,
    tenantUnderReview,
    totalRecipients,
    domainId,
  ]);

  React.useEffect(() => {
    onPreflightSummaryChange?.(computePreflightSummary());
  }, [computePreflightSummary, onPreflightSummaryChange]);

  React.useEffect(() => {
    if (!onRegisterRevalidate) return;

    onRegisterRevalidate(async () => {
      await Promise.all([
        policyQuery.refetch(),
        underReviewOverrideQuery.refetch(),
        quotaQuery.refetch(),
        typeof onRefetchHealth === "function" ? onRefetchHealth() : undefined,
      ]);

      const next = computePreflightSummary();
      onPreflightSummaryChange?.(next);
      return next;
    });
  }, [
    computePreflightSummary,
    onPreflightSummaryChange,
    onRegisterRevalidate,
    policyQuery,
    quotaQuery,
    onRefetchHealth,
    underReviewOverrideQuery,
  ]);

  const issueRows = React.useMemo(() => {
    const policy = policyQuery.data;
    const override = underReviewOverrideQuery.data;
    const quota = quotaQuery.data;

    const checking =
      domainLookupLoading ||
      healthLoading ||
      policyQuery.isLoading ||
      underReviewOverrideQuery.isLoading ||
      quotaQuery.isLoading;

    if (checking) return [] as React.ReactNode[];

    const overrideFinal = Boolean(
      (override as any)?.under_review_override_final,
    );
    const overrideActive = Boolean(
      (override as any)?.under_review_override_active,
    );

    const action = String(policy?.action || "").toLowerCase();

    const bouncePct30d = healthData
      ? (coerceRateToPercent(healthData.bounce_rate_30d) ??
        percentFromCounts(healthData.bounced_30d, healthData.sent_30d))
      : null;
    const complaintPct30d = healthData
      ? (coerceRateToPercent(healthData.complaint_rate_30d) ??
        percentFromCounts(healthData.complained_30d, healthData.sent_30d))
      : null;

    const bounceStatus =
      bouncePct30d === null
        ? ("unknown" as const)
        : getHealthStatus(bouncePct30d, ANALYTICS_THRESHOLDS.bounceRate);
    const complaintStatus =
      complaintPct30d === null
        ? ("unknown" as const)
        : getHealthStatus(complaintPct30d, ANALYTICS_THRESHOLDS.complaintRate);

    const bounceState: PreflightRowState =
      bounceStatus === "unknown"
        ? "unknown"
        : bounceStatus === "red"
          ? "block"
          : bounceStatus === "yellow"
            ? "warn"
            : "ok";

    const complaintState: PreflightRowState =
      complaintStatus === "unknown"
        ? "unknown"
        : complaintStatus === "red"
          ? "block"
          : complaintStatus === "yellow"
            ? "warn"
            : "ok";

    const accountState: PreflightRowState = tenantUnderReview
      ? overrideFinal
        ? "warn"
        : "block"
      : "ok";

    const overridesState: PreflightRowState = overrideActive ? "warn" : "ok";

    const policyState: PreflightRowState = (() => {
      if (!policy) return "unknown";
      if (action === "allow") return "ok";
      if (action === "throttle") return "warn";
      if (action === "restrict") return "block";
      if (action === "pause" || action === "block") {
        if (tenantUnderReview && overrideFinal) return "warn";
        return "block";
      }
      return "warn";
    })();

    const audienceState: PreflightRowState =
      Number.isFinite(Number(totalRecipients)) && Number(totalRecipients) > 0
        ? "ok"
        : "block";

    const quotaState: PreflightRowState = (() => {
      if (!domainId) return "block";
      if (!quota) return quotaQuery.isLoading ? "unknown" : "block";
      const allowed = Boolean((quota as any)?.allowed);
      const warnings = (quota as any)?.warnings;
      const warningsCount = Array.isArray(warnings) ? warnings.length : 0;
      if (!allowed) return "block";
      if (warningsCount > 0) return "warn";
      return "ok";
    })();

    const rows: React.ReactNode[] = [];

    const showManualReview =
      tenantUnderReview || action === "pause" || action === "block";
    if (showManualReview) {
      const detail = tenantUnderReview
        ? overrideFinal
          ? "Tenant is under review (override active)."
          : "Tenant is under review."
        : "Sending is paused by governance policy.";

      rows.push(
        <ComplianceRow
          key="manual-review"
          label="Suspension / Manual Review"
          loading={underReviewOverrideQuery.isLoading || policyQuery.isLoading}
          state={accountState === "ok" ? policyState : accountState}
          detail={detail}
          warnLabel="At risk"
          blockLabel="Critical"
        />,
      );
    }

    if (policyState === "warn" || policyState === "block") {
      rows.push(
        <ComplianceRow
          key="gov-limits"
          label="Governance Limits"
          loading={policyQuery.isLoading}
          state={policyState}
          detail={
            policyState === "block"
              ? "Governance policy currently blocks sending."
              : "Governance policy may throttle sending."
          }
          warnLabel="At risk"
          blockLabel="Critical"
        />,
      );
    }

    if ((overridesState as string) === "warn" || (overridesState as string) === "block") {
      const reason =
        typeof (override as any)?.under_review_override_reason === "string" &&
        (override as any)?.under_review_override_reason
          ? String((override as any).under_review_override_reason)
          : "Tenant override is active.";
      rows.push(
        <ComplianceRow
          key="tenant-overrides"
          label="Tenant Overrides"
          loading={underReviewOverrideQuery.isLoading}
          state={overridesState}
          detail={reason}
          warnLabel="At risk"
          blockLabel="Critical"
        />,
      );
    }

    if (bounceState === "warn" || bounceState === "block") {
      const detail =
        bouncePct30d === null
          ? ""
          : bounceState === "block"
            ? `Bounce Rate (30d) exceeded (${bouncePct30d.toFixed(2)}% / ${ANALYTICS_THRESHOLDS.bounceRate.red}% limit)`
            : `Bounce Rate (30d) elevated (${bouncePct30d.toFixed(2)}% / ${ANALYTICS_THRESHOLDS.bounceRate.green}% target)`;
      rows.push(
        <ComplianceRow
          key="bounce"
          label="Bounce Threshold (30d)"
          loading={healthLoading}
          state={bounceState}
          detail={detail}
          warnLabel="At risk"
          blockLabel="Critical"
        />,
      );
    }

    if (complaintState === "warn" || complaintState === "block") {
      const detail =
        complaintPct30d === null
          ? ""
          : complaintState === "block"
            ? `Complaint Rate (30d) exceeded (${complaintPct30d.toFixed(3)}% / ${ANALYTICS_THRESHOLDS.complaintRate.red}% limit)`
            : `Complaint Rate (30d) elevated (${complaintPct30d.toFixed(3)}% / ${ANALYTICS_THRESHOLDS.complaintRate.green}% target)`;
      rows.push(
        <ComplianceRow
          key="complaint"
          label="Complaint Threshold (30d)"
          loading={healthLoading}
          state={complaintState}
          detail={detail}
          warnLabel="At risk"
          blockLabel="Critical"
        />,
      );
    }

    if (quotaState === "warn" || quotaState === "block") {
      const detail = (() => {
        if (quotaState === "block") {
          const msg =
            typeof (quota as any)?.message === "string" &&
            (quota as any).message
              ? String((quota as any).message)
              : !domainId
                ? "Sending domain is required for quota validation."
                : "Quota check failed or blocked.";
          return msg;
        }

        const warnings = (quota as any)?.warnings;
        if (Array.isArray(warnings) && warnings.length > 0) {
          return String(warnings[0]);
        }
        return "Quota check returned warnings.";
      })();

      rows.push(
        <ComplianceRow
          key="quota"
          label="Send Quota"
          loading={quotaQuery.isLoading || domainLookupLoading}
          state={quotaState}
          detail={detail}
          warnLabel="At risk"
          blockLabel="Critical"
        />,
      );
    }

    if ((audienceState as string) === "warn" || (audienceState as string) === "block") {
      rows.push(
        <ComplianceRow
          key="audience"
          label="Audience Size"
          loading={false}
          state={audienceState}
          detail="Audience size is empty or invalid."
          warnLabel="At risk"
          blockLabel="Critical"
        />,
      );
    }

    return rows;
  }, [
    domainId,
    domainLookupLoading,
    healthData,
    healthLoading,
    policyQuery.data,
    policyQuery.isLoading,
    quotaQuery.data,
    quotaQuery.isLoading,
    tenantUnderReview,
    totalRecipients,
    underReviewOverrideQuery.data,
    underReviewOverrideQuery.isLoading,
  ]);

  if (issueRows.length === 0) return null;

  return (
    <section className="rounded-xl border bg-white p-6">
      <div className="space-y-2">{issueRows}</div>
    </section>
  );
}
