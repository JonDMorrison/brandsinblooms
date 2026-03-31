import { useEffect, useRef, useState } from "react";
import { ArrowRight, CheckCircle2, Loader2, RotateCcw } from "lucide-react";

import mailchimpLogo from "@/assets/logos/mailchimp-new.png";
import { getUserFacingIntegrationError } from "@/components/integrations/integrationDetailModel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

type ConnectMailchimpDialogPhase =
  | "idle"
  | "starting"
  | "waiting"
  | "cancelled"
  | "success"
  | "error";

export function ConnectMailchimpDialog({
  open,
  onOpenChange,
  onConnected,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnected: () => Promise<string | null>;
}) {
  const [phase, setPhase] = useState<ConnectMailchimpDialogPhase>("idle");
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [successAccountName, setSuccessAccountName] = useState<string | null>(
    null,
  );
  const authorizationTabRef = useRef<Window | null>(null);
  const authorizationTabCheckIntervalRef = useRef<number | null>(null);
  const autoDismissTimeoutRef = useRef<number | null>(null);

  const clearAuthorizationTabTracking = (closeTab: boolean) => {
    if (authorizationTabCheckIntervalRef.current !== null) {
      window.clearInterval(authorizationTabCheckIntervalRef.current);
      authorizationTabCheckIntervalRef.current = null;
    }

    if (autoDismissTimeoutRef.current !== null) {
      window.clearTimeout(autoDismissTimeoutRef.current);
      autoDismissTimeoutRef.current = null;
    }

    if (closeTab && authorizationTabRef.current && !authorizationTabRef.current.closed) {
      try {
        authorizationTabRef.current.close();
      } catch {
        // Ignore tab close failures.
      }
    }

    authorizationTabRef.current = null;
  };

  useEffect(() => {
    if (!open) {
      clearAuthorizationTabTracking(true);
      setPhase("idle");
      setFeedbackMessage(null);
      setSuccessAccountName(null);
      return;
    }

    setPhase("idle");
    setFeedbackMessage(null);
    setSuccessAccountName(null);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) {
        return;
      }

      const message = event.data as
        | {
            type?: string;
            provider?: string;
            message?: string;
            error?: string;
          }
        | undefined;

      if (message?.provider !== "mailchimp") {
        return;
      }

      if (message.type === "oauth-error") {
        clearAuthorizationTabTracking(true);
        setSuccessAccountName(null);
        setFeedbackMessage(
          getUserFacingIntegrationError(
            message.error ?? message.message,
            "The connection could not be completed. Please try connecting again.",
          ),
        );
        setPhase("error");
        return;
      }

      if (message.type === "oauth-success") {
        clearAuthorizationTabTracking(true);

        void (async () => {
          let accountName: string | null = null;

          try {
            accountName = await onConnected();
          } catch {
            // Keep the success path non-blocking even if refetch stalls.
          }

          setFeedbackMessage(null);
          setSuccessAccountName(accountName);
          setPhase("success");
        })();
      }
    };

    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [onConnected, open]);

  useEffect(() => {
    if (!open || phase !== "success") {
      return;
    }

    autoDismissTimeoutRef.current = window.setTimeout(() => {
      onOpenChange(false);
    }, 2000);

    return () => {
      if (autoDismissTimeoutRef.current !== null) {
        window.clearTimeout(autoDismissTimeoutRef.current);
        autoDismissTimeoutRef.current = null;
      }
    };
  }, [onOpenChange, open, phase]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      clearAuthorizationTabTracking(true);
    }

    onOpenChange(nextOpen);
  };

  const startAuthorization = async () => {
    clearAuthorizationTabTracking(true);
    setFeedbackMessage(null);
    setSuccessAccountName(null);
    setPhase("starting");

    try {
      const { data, error } = await supabase.functions.invoke(
        "oauth-authorize",
        {
          body: { provider: "mailchimp" },
        },
      );

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.message ?? data.error);
      }

      if (!data?.authUrl) {
        throw new Error("No Mailchimp authorization URL was returned.");
      }

      const authorizationTab = window.open(data.authUrl as string, "_blank");

      if (!authorizationTab || authorizationTab.closed) {
        throw new Error(
          "The Mailchimp authorization tab could not be opened. Allow new tabs and try again.",
        );
      }

      authorizationTabRef.current = authorizationTab;
      setPhase("waiting");

      authorizationTabCheckIntervalRef.current = window.setInterval(() => {
        if (authorizationTabRef.current?.closed) {
          clearAuthorizationTabTracking(false);
          setSuccessAccountName(null);
          setFeedbackMessage(
            "The Mailchimp authorization tab was closed before the connection completed.",
          );
          setPhase("cancelled");
        }
      }, 500);
    } catch (error) {
      clearAuthorizationTabTracking(true);
      setFeedbackMessage(
        getUserFacingIntegrationError(
          error,
          "The connection could not be started. Please try again.",
        ),
      );
      setPhase("error");
    }
  };

  const showPermissions =
    phase === "idle" || phase === "cancelled" || phase === "error";
  const showWaiting = phase === "starting" || phase === "waiting";
  const showSuccess = phase === "success";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader className="space-y-4 text-left">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50">
              <img
                src={mailchimpLogo}
                alt="Mailchimp logo"
                className="h-8 w-8 object-contain"
              />
            </div>
            <div>
              <DialogTitle>
                {showSuccess ? "Mailchimp Connected" : "Connect Mailchimp"}
              </DialogTitle>
              <DialogDescription className="mt-2">
                {showSuccess
                  ? "BloomSuite can now refresh your Mailchimp audiences and connection details from this page."
                  : "Authorize BloomSuite to view your Mailchimp account and cache audience metadata without leaving this integration page."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {showPermissions ? (
            <div className="rounded-2xl border border-border bg-slate-50/80 p-4 text-sm text-slate-900">
              <p className="font-medium">
                Mailchimp will grant BloomSuite permission to:
              </p>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li>Read your connected Mailchimp account details</li>
                <li>Cache list and segment metadata for import setup</li>
                <li>Refresh access later from this same integration page</li>
              </ul>
            </div>
          ) : null}

          {feedbackMessage ? (
            <div
              className={`rounded-2xl border p-4 text-sm ${phase === "cancelled" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-rose-200 bg-rose-50 text-rose-900"}`}
            >
              {feedbackMessage}
            </div>
          ) : null}

          {showWaiting ? (
            <div className="flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
              <Loader2 className="mt-0.5 h-5 w-5 animate-spin" />
              <div>
                <p className="font-medium">
                  Waiting for Mailchimp authorization…
                </p>
                <p className="mt-1 text-sky-800/80">
                  Finish the Mailchimp authorization in the new tab to connect
                  this account. If you close the tab without completing
                  authorization, you can try again from here.
                </p>
              </div>
            </div>
          ) : null}

          {showSuccess ? (
            <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              <CheckCircle2 className="mt-0.5 h-5 w-5" />
              <div>
                <p className="font-medium">Mailchimp authorization complete</p>
                <p className="mt-1 text-emerald-800/80">
                  {successAccountName
                    ? `Connected as ${successAccountName}.`
                    : "Your Mailchimp account is now connected."}
                </p>
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          {showSuccess ? (
            <Button type="button" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={showWaiting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void startAuthorization()}
                disabled={showWaiting}
              >
                {showWaiting ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Waiting for Mailchimp authorization…
                  </>
                ) : phase === "cancelled" ? (
                  <>
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                    Try Again
                  </>
                ) : (
                  <>
                    Connect with Mailchimp
                    <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
