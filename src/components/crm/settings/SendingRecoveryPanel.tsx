import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui-legacy/card";
import { Button } from "@/components/ui-legacy/button";
import { Loader2, ShieldAlert, CheckCircle2, Clock, XCircle } from "lucide-react";
import { useTenant } from "@/hooks/useTenant";
import { useEmailDomains } from "@/hooks/useEmailDomains";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const SUPPORT_EMAIL = "support@bloomsuite.app";

interface RecoveryRpcResult {
  addresses_suppressed: number;
  status_before: string;
  status_after: string;
  recovered: boolean;
  bounce_rate_30d: number;
  complaint_rate_30d: number;
  sent_30d: number;
  message: string;
}

type PanelState =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "recovered"; result: RecoveryRpcResult }
  | { kind: "cooldown"; result: RecoveryRpcResult }
  | { kind: "error"; message: string };

// Renders the self-serve list cleanup panel on the email-sending
// settings page. Visible only when the current tenant has at least
// one domain in the "paused" or "blocked" state — those are the
// states that the SendingStatusBanner classifies as red blocks.
// When ?action=recover is present in the URL the panel auto-scrolls
// itself into view and flashes a subtle highlight, so the "Fix this
// now" CTA in the banner deep-links straight to the recovery action.
export const SendingRecoveryPanel = () => {
  const { tenant } = useTenant();
  const { emailDomains, loading: domainsLoading, refetch } = useEmailDomains();
  const [searchParams, setSearchParams] = useSearchParams();
  const [panelState, setPanelState] = useState<PanelState>({ kind: "idle" });
  const [isHighlighted, setIsHighlighted] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const pausedDomain = useMemo(
    () =>
      emailDomains.find(
        (domain) => domain.status === "paused" || domain.status === "blocked",
      ),
    [emailDomains],
  );

  const shouldRender = !domainsLoading && Boolean(pausedDomain);

  // Auto-scroll + flash highlight when the deep-link query param is
  // present. Strip the param after firing so refreshing the page
  // doesn't keep re-flashing on every render.
  useEffect(() => {
    if (!shouldRender) return;
    if (searchParams.get("action") !== "recover") return;
    if (!panelRef.current) return;

    panelRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    setIsHighlighted(true);
    const timer = window.setTimeout(() => setIsHighlighted(false), 2000);

    const next = new URLSearchParams(searchParams);
    next.delete("action");
    setSearchParams(next, { replace: true });

    return () => window.clearTimeout(timer);
  }, [shouldRender, searchParams, setSearchParams]);

  if (!shouldRender) return null;

  const handleRecover = async () => {
    if (!tenant?.id) {
      setPanelState({
        kind: "error",
        message:
          "We couldn't identify your organization. Please refresh and try again.",
      });
      return;
    }
    setPanelState({ kind: "running" });
    try {
      // RPC isn't in the generated Supabase types yet (it's a new
      // SECURITY DEFINER function), so cast the rpc name. Same
      // pattern used elsewhere in CRMCampaignRecipientsPage.
      const { data, error } = await supabase.rpc(
        "clean_list_and_recover" as never,
        { target_tenant_id: tenant.id } as never,
      );
      if (error) throw error;
      const result = data as RecoveryRpcResult;

      // Refresh email_domains so the platform-wide
      // SendingStatusBanner picks up the new status and clears
      // (or stays put if the cooldown still applies).
      await refetch();

      if (result.recovered) {
        setPanelState({ kind: "recovered", result });
        toast.success("Sending restored");
      } else if ((result.addresses_suppressed ?? 0) > 0) {
        setPanelState({ kind: "cooldown", result });
        toast.info("List cleaned — sending will resume after cooldown");
      } else {
        // Cleanup ran but nothing was suppressed and recovered is
        // still false: surface as an error so the user contacts
        // support rather than waiting indefinitely.
        setPanelState({
          kind: "error",
          message:
            result.message ||
            "We couldn't recover sending automatically. Please contact support.",
        });
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.";
      console.error("clean_list_and_recover failed:", err);
      setPanelState({ kind: "error", message });
    }
  };

  return (
    <Card
      ref={panelRef}
      data-testid="sending-recovery-panel"
      className={`border-2 ${
        panelState.kind === "recovered"
          ? "border-emerald-300 bg-emerald-50"
          : panelState.kind === "cooldown"
            ? "border-amber-300 bg-amber-50"
            : panelState.kind === "error"
              ? "border-red-300 bg-red-50"
              : "border-red-300 bg-red-50"
      } transition-shadow ${
        isHighlighted ? "ring-4 ring-amber-300 ring-offset-2" : ""
      }`}
    >
      {panelState.kind === "recovered" ? (
        <>
          <CardHeader className="flex flex-row items-center gap-3">
            <CheckCircle2
              className="h-6 w-6 text-emerald-700 flex-shrink-0"
              aria-hidden="true"
            />
            <CardTitle className="text-emerald-900">
              Sending is restored
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-emerald-900">
              {panelState.result.message}
            </p>
            <p className="text-xs text-emerald-800">
              {panelState.result.addresses_suppressed.toLocaleString()}{" "}
              address
              {panelState.result.addresses_suppressed === 1 ? "" : "es"}{" "}
              removed from your list. Status:{" "}
              {panelState.result.status_before} → {panelState.result.status_after}.
            </p>
            <Button asChild>
              <Link to="/dashboard">Back to dashboard</Link>
            </Button>
          </CardContent>
        </>
      ) : panelState.kind === "cooldown" ? (
        <>
          <CardHeader className="flex flex-row items-center gap-3">
            <Clock
              className="h-6 w-6 text-amber-700 flex-shrink-0"
              aria-hidden="true"
            />
            <CardTitle className="text-amber-900">
              List cleaned — cooldown in progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-amber-900">{panelState.result.message}</p>
            <p className="text-xs text-amber-800">
              We removed{" "}
              {panelState.result.addresses_suppressed.toLocaleString()}{" "}
              address
              {panelState.result.addresses_suppressed === 1 ? "" : "es"} that
              weren't reaching real inboxes. Sending will reopen automatically
              once the cooldown window passes — check back in a few days.
            </p>
          </CardContent>
        </>
      ) : panelState.kind === "error" ? (
        <>
          <CardHeader className="flex flex-row items-center gap-3">
            <XCircle
              className="h-6 w-6 text-red-700 flex-shrink-0"
              aria-hidden="true"
            />
            <CardTitle className="text-red-900">
              Something went wrong
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-red-900">{panelState.message}</p>
            <p className="text-sm text-red-900">
              Please contact{" "}
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="font-semibold underline"
              >
                {SUPPORT_EMAIL}
              </a>{" "}
              and we'll get this sorted.
            </p>
            <Button onClick={() => setPanelState({ kind: "idle" })}>
              Try again
            </Button>
          </CardContent>
        </>
      ) : (
        <>
          <CardHeader className="flex flex-row items-center gap-3">
            <ShieldAlert
              className="h-6 w-6 text-red-700 flex-shrink-0"
              aria-hidden="true"
            />
            <CardTitle className="text-red-900">
              Your sending is paused right now
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-sm text-red-900 leading-relaxed">
              Over the last few weeks, too many emails on your list bounced
              back instead of reaching real inboxes. To protect your
              reputation as a sender, we paused your campaigns until your
              list is cleaned up.
            </p>
            <p className="text-sm text-red-900 leading-relaxed">
              When you click below, we'll automatically remove the addresses
              that aren't working anymore from your contact list. You won't
              lose any of your real customers — just the ones that no longer
              have valid email addresses.
            </p>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
              <Button
                size="lg"
                onClick={handleRecover}
                disabled={panelState.kind === "running" || !tenant?.id}
                className="bg-red-700 hover:bg-red-800 text-white"
              >
                {panelState.kind === "running" ? (
                  <>
                    <Loader2
                      className="h-4 w-4 mr-2 animate-spin"
                      aria-hidden="true"
                    />
                    Cleaning up your list...
                  </>
                ) : (
                  "Clean my list and recover sending"
                )}
              </Button>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="text-sm text-red-800 underline hover:text-red-900"
              >
                Get help instead
              </a>
            </div>
          </CardContent>
        </>
      )}
    </Card>
  );
};

export default SendingRecoveryPanel;
