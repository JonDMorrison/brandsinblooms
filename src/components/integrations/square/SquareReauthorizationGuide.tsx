import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-legacy/dialog";
import { Button } from "@/components/ui-legacy/button";
import { Progress } from "@/components/ui-legacy/progress";
import {
  Shield,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  RefreshCw,
  Lock,
  Loader2,
  XCircle,
  Heart,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { detectEnvironment } from "@/utils/environmentUtils";
import { getUserFacingIntegrationError } from "@/components/integrations/integrationDetailModel";

type ReauthStep = "intro" | "explain" | "authorizing" | "success" | "error";

interface SquareReauthorizationGuideProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionId?: string;
  onSuccess?: () => void;
}

const STEPS = [
  { id: "intro", label: "Why Update?" },
  { id: "explain", label: "What Happens" },
  { id: "authorizing", label: "Authorize" },
  { id: "success", label: "Done" },
];

const NEW_PERMISSIONS = [
  {
    name: "Loyalty Program Access",
    description: "Sync loyalty members and point balances",
  },
];

export const SquareReauthorizationGuide = ({
  open,
  onOpenChange,
  connectionId,
  onSuccess,
}: SquareReauthorizationGuideProps) => {
  const [currentStep, setCurrentStep] = useState<ReauthStep>("intro");
  const [authProgress, setAuthProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { toast } = useToast();

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setCurrentStep("intro");
      setAuthProgress(0);
      setErrorMessage(null);
    }
  }, [open]);

  // Listen for OAuth completion during authorization
  useEffect(() => {
    if (currentStep !== "authorizing") return;

    const handleOAuthResult = (data: any) => {
      if (Date.now() - data.timestamp < 30000) {
        localStorage.removeItem("square_oauth_result");

        if (data.status === "success") {
          setAuthProgress(100);
          setTimeout(() => setCurrentStep("success"), 500);
        } else if (data.status === "error") {
          setErrorMessage(
            getUserFacingIntegrationError(
              data.message,
              "The connection could not be completed. Please try again.",
            ),
          );
          setCurrentStep("error");
        }
      }
    };

    const checkLocalStorage = () => {
      const result = localStorage.getItem("square_oauth_result");
      if (result) {
        try {
          handleOAuthResult(JSON.parse(result));
        } catch (e) {
          console.error("[REAUTH] Error parsing OAuth result:", e);
        }
      }
    };

    // Set up listeners
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel("square_oauth");
      channel.onmessage = (event) => handleOAuthResult(event.data);
    } catch (e) {}

    const handleMessage = (event: MessageEvent) => {
      if (
        event.origin === window.location.origin &&
        event.data?.type === "square_oauth_result"
      ) {
        handleOAuthResult(event.data.data);
      }
    };
    window.addEventListener("message", handleMessage);
    window.addEventListener("storage", checkLocalStorage);

    const interval = setInterval(checkLocalStorage, 500);

    return () => {
      window.removeEventListener("storage", checkLocalStorage);
      window.removeEventListener("message", handleMessage);
      if (channel) channel.close();
      clearInterval(interval);
    };
  }, [currentStep]);

  const startReauthorization = async () => {
    setCurrentStep("authorizing");
    setAuthProgress(20);

    try {
      // Step 1: Delete existing connection (silently)
      if (connectionId) {
        setAuthProgress(30);
        await supabase
          .from("square_connections")
          .delete()
          .eq("id", connectionId);
      }

      setAuthProgress(50);

      // Step 2: Start OAuth flow
      const state = crypto.randomUUID();
      const { data, error } = await supabase.functions.invoke(
        "square-oauth-start",
        {
          body: { state },
        },
      );

      if (error || !data?.authUrl) {
        throw new Error(error?.message || "Failed to initiate authorization");
      }

      setAuthProgress(70);
      localStorage.removeItem("square_oauth_result");

      // Open authorization window
      const link = document.createElement("a");
      link.href = data.authUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error: any) {
      console.error("[REAUTH] Error:", error);
      setErrorMessage(
        getUserFacingIntegrationError(
          error,
          "Failed to start authorization. Please try again.",
        ),
      );
      setCurrentStep("error");
    }
  };

  const handleSuccess = () => {
    onSuccess?.();
    onOpenChange(false);
    toast({
      title: "✓ Permissions updated successfully",
      description:
        "Your Square connection now has access to Loyalty Program data.",
    });
  };

  const triggerLoyaltyBackfill = async () => {
    try {
      toast({
        title: "Starting loyalty sync...",
        description: "This may take a moment.",
      });

      const { error } = await supabase.functions.invoke(
        "square-loyalty-backfill",
      );

      if (error) throw error;

      toast({
        title: "✓ Loyalty sync complete",
        description: "Your loyalty members have been synced.",
      });
    } catch (error: any) {
      toast({
        title: "Loyalty sync failed",
        description: getUserFacingIntegrationError(
          error,
          "Square loyalty sync could not be completed.",
        ),
        variant: "destructive",
      });
    }
    handleSuccess();
  };

  const getStepIndex = () => {
    const idx = STEPS.findIndex((s) => s.id === currentStep);
    return idx === -1 ? 0 : idx;
  };

  const progressPercent = ((getStepIndex() + 1) / STEPS.length) * 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Update Square Permissions
          </DialogTitle>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="mb-6">
          <Progress value={progressPercent} className="h-1.5 mb-3" />
          <div className="flex justify-between">
            {STEPS.map((step, idx) => (
              <div
                key={step.id}
                className={`text-xs font-medium transition-colors ${
                  idx <= getStepIndex()
                    ? "text-primary"
                    : "text-muted-foreground"
                }`}
              >
                {step.label}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="min-h-[280px] flex flex-col">
          {currentStep === "intro" && (
            <div className="flex-1 flex flex-col">
              <div className="flex justify-center mb-6">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sparkles className="h-8 w-8 text-primary" />
                </div>
              </div>

              <h3 className="text-lg font-semibold text-center mb-2">
                New Capabilities Available!
              </h3>
              <p className="text-sm text-muted-foreground text-center mb-6">
                We've added new features to your Square integration. Update your
                permissions to unlock them.
              </p>

              <div className="space-y-3 mb-6">
                {NEW_PERMISSIONS.map((perm, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                  >
                    <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-sm">{perm.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {perm.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-auto flex gap-3">
                <Button
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                  className="flex-1"
                >
                  Maybe Later
                </Button>
                <Button
                  onClick={() => setCurrentStep("explain")}
                  className="flex-1"
                >
                  Continue
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {currentStep === "explain" && (
            <div className="flex-1 flex flex-col">
              <div className="flex justify-center mb-6">
                <div className="h-16 w-16 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <RefreshCw className="h-8 w-8 text-blue-500" />
                </div>
              </div>

              <h3 className="text-lg font-semibold text-center mb-2">
                Here's What Will Happen
              </h3>

              <div className="space-y-3 mb-6">
                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                    1
                  </div>
                  <p className="text-sm">
                    A Square authorization window will open
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                    2
                  </div>
                  <p className="text-sm">
                    You'll see the updated permissions list
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                    3
                  </div>
                  <p className="text-sm">Click "Allow" to grant access</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                    4
                  </div>
                  <p className="text-sm">The window will close automatically</p>
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20 mb-6">
                <Lock className="h-4 w-4 text-green-600 shrink-0" />
                <p className="text-xs text-green-700 dark:text-green-400">
                  Your existing data is safe — customers, sales, and products
                  will not be affected.
                </p>
              </div>

              <div className="mt-auto flex gap-3">
                <Button
                  variant="ghost"
                  onClick={() => setCurrentStep("intro")}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button onClick={startReauthorization} className="flex-1">
                  Update Permissions
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {currentStep === "authorizing" && (
            <div className="flex-1 flex flex-col items-center justify-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-6" />

              <h3 className="text-lg font-semibold text-center mb-2">
                Authorizing...
              </h3>
              <p className="text-sm text-muted-foreground text-center mb-6">
                Complete the authorization in the Square window that opened.
              </p>

              <Progress
                value={authProgress}
                className="w-full max-w-xs h-2 mb-4"
              />

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  {authProgress >= 30 ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                  <span
                    className={
                      authProgress >= 30
                        ? "text-green-600"
                        : "text-muted-foreground"
                    }
                  >
                    Preparing connection
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {authProgress >= 70 ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : authProgress >= 50 ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : (
                    <div className="h-4 w-4" />
                  )}
                  <span
                    className={
                      authProgress >= 70
                        ? "text-green-600"
                        : "text-muted-foreground"
                    }
                  >
                    Opening Square
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {authProgress >= 100 ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : authProgress >= 70 ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : (
                    <div className="h-4 w-4" />
                  )}
                  <span
                    className={
                      authProgress >= 100
                        ? "text-green-600"
                        : "text-muted-foreground"
                    }
                  >
                    Waiting for authorization
                  </span>
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="mt-8"
              >
                Cancel
              </Button>
            </div>
          )}

          {currentStep === "success" && (
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center mb-6">
                <CheckCircle2 className="h-10 w-10 text-green-500" />
              </div>

              <h3 className="text-lg font-semibold text-center mb-2">
                Permissions Updated!
              </h3>
              <p className="text-sm text-muted-foreground text-center mb-6">
                Your Square connection now has access to new features.
              </p>

              <div className="w-full space-y-2 mb-6">
                {NEW_PERMISSIONS.map((perm, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span>{perm.name}</span>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 w-full mt-auto">
                <Button
                  variant="outline"
                  onClick={handleSuccess}
                  className="flex-1"
                >
                  Close
                </Button>
                <Button onClick={triggerLoyaltyBackfill} className="flex-1">
                  <Heart className="h-4 w-4 mr-2" />
                  Sync Loyalty Now
                </Button>
              </div>
            </div>
          )}

          {currentStep === "error" && (
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
                <XCircle className="h-10 w-10 text-destructive" />
              </div>

              <h3 className="text-lg font-semibold text-center mb-2">
                Authorization Failed
              </h3>
              <p className="text-sm text-muted-foreground text-center mb-6">
                {errorMessage || "Something went wrong. Please try again."}
              </p>

              <div className="flex gap-3 w-full mt-auto">
                <Button
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => setCurrentStep("explain")}
                  className="flex-1"
                >
                  Try Again
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
