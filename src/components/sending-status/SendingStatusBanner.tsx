import { Link } from "react-router-dom";
import { useState } from "react";
import { AlertTriangle, ShieldAlert, Clock, X } from "lucide-react";
import { useTenant } from "@/hooks/useTenant";
import { useEmailDomains } from "@/hooks/useEmailDomains";
import type { EmailDomain } from "@/hooks/useEmailDomains";

type BannerVariant =
  | { kind: "paused"; domain: EmailDomain }
  | { kind: "dns_failed"; domain: EmailDomain }
  | { kind: "verifying"; domain: EmailDomain };

// Pick the worst-status domain for the active tenant. If a tenant has
// multiple domains we surface the most severe state (paused beats
// failed beats verifying) so the banner doesn't downplay an active
// block while a different domain is still warming up.
function pickRelevantDomain(domains: EmailDomain[]): BannerVariant | null {
  const severityOrder: EmailDomain["status"][] = [
    "paused",
    "blocked",
    "failed",
    "error",
    "pending",
    "pending_dns",
    "verifying",
    "warming_up",
  ];
  for (const status of severityOrder) {
    const match = domains.find((d) => d.status === status);
    if (!match) continue;
    if (status === "paused" || status === "blocked") {
      return { kind: "paused", domain: match };
    }
    if (status === "failed" || status === "error") {
      return { kind: "dns_failed", domain: match };
    }
    return { kind: "verifying", domain: match };
  }
  return null;
}

export const SendingStatusBanner = () => {
  const { tenant, loading: tenantLoading } = useTenant();
  const { emailDomains, loading: domainsLoading } = useEmailDomains();
  const [isVerifyingDismissed, setIsVerifyingDismissed] = useState(false);

  // Loading guard: render nothing while either query is still
  // resolving so the banner doesn't flash on initial mount.
  if (tenantLoading || domainsLoading) return null;
  if (!tenant?.id) return null;

  const variant = pickRelevantDomain(emailDomains);
  if (!variant) return null;

  // Dismissal applies to the informational verifying variant only.
  // The two blocking variants (paused, dns_failed) intentionally do
  // not honor dismissal — they represent active blocks the user must
  // resolve.
  if (variant.kind === "verifying" && isVerifyingDismissed) return null;

  if (variant.kind === "paused") {
    return (
      <div
        role="alert"
        className="w-full bg-red-600 text-white px-4 py-3 sticky top-0 z-40 shadow-sm"
        data-testid="sending-status-banner"
        data-variant="paused"
      >
        <div className="max-w-screen-xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <ShieldAlert
              className="h-5 w-5 flex-shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight">
                Your email sending is paused
              </p>
              <p className="text-xs sm:text-sm opacity-95 mt-0.5">
                Some addresses on your list weren't reaching real people. We
                can clean this up for you.
              </p>
            </div>
          </div>
          <Link
            to="/crm/settings/email-sending?action=recover"
            className="inline-flex items-center justify-center px-4 py-1.5 rounded-md bg-white text-red-700 text-sm font-semibold hover:bg-red-50 transition-colors flex-shrink-0"
          >
            Fix this now
          </Link>
        </div>
      </div>
    );
  }

  if (variant.kind === "dns_failed") {
    return (
      <div
        role="alert"
        className="w-full bg-amber-500 text-white px-4 py-3 sticky top-0 z-40 shadow-sm"
        data-testid="sending-status-banner"
        data-variant="dns_failed"
      >
        <div className="max-w-screen-xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="h-5 w-5 flex-shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight">
                Your sending domain isn't verified yet
              </p>
              <p className="text-xs sm:text-sm opacity-95 mt-0.5">
                We need to confirm a few DNS records before you can send.
              </p>
            </div>
          </div>
          <Link
            to="/crm/settings/email-sending"
            className="inline-flex items-center justify-center px-4 py-1.5 rounded-md bg-white text-amber-700 text-sm font-semibold hover:bg-amber-50 transition-colors flex-shrink-0"
          >
            Set up sending
          </Link>
        </div>
      </div>
    );
  }

  // Informational verifying variant — dismissible, no action button.
  return (
    <div
      aria-live="polite"
      className="w-full bg-amber-50 text-amber-900 border-b border-amber-200 px-4 py-2.5 sticky top-0 z-40"
      data-testid="sending-status-banner"
      data-variant="verifying"
    >
      <div className="max-w-screen-xl mx-auto flex items-start sm:items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <Clock
            className="h-4 w-4 flex-shrink-0 mt-0.5 text-amber-700"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="text-sm font-medium leading-tight">
              Your sending domain is being verified
            </p>
            <p className="text-xs opacity-90 mt-0.5">
              This usually takes a few minutes. We'll let you know when it's
              ready.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsVerifyingDismissed(true)}
          aria-label="Dismiss notification"
          className="text-amber-700 hover:bg-amber-100 rounded-md p-1 flex-shrink-0"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};

export default SendingStatusBanner;
