import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  CheckCircle,
  XCircle,
  Plug,
  Clock,
  BookOpen,
  Sparkles,
  RefreshCw,
  Users,
  FlaskConical,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";
import { detectEnvironment } from "@/utils/environmentUtils";
import { getUserFacingIntegrationError } from "@/components/integrations/integrationDetailModel";
import { CloverSetupWizard } from "./clover/CloverSetupWizard";
import { CloverTestReport } from "./clover/CloverTestReport";
import { usePOSSyncJob } from "@/hooks/usePOSSyncJob";

export const CloverIntegration = () => {
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<
    "preparing" | "redirecting" | "completing"
  >("preparing");
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [testReport, setTestReport] = useState<any>(null);
  const previousConnectionRef = useRef<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: connection, isLoading } = useQuery({
    queryKey: ["clover-connection"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      const { data: user } = await supabase
        .from("users")
        .select("tenant_id")
        .eq("id", userData.user.id)
        .single();

      if (!user?.tenant_id) return null;

      const { data, error } = await supabase
        .from("clover_connections")
        .select("*")
        .eq("tenant_id", user.tenant_id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  // Use the sync job hook
  const { activeJob, isSyncing, isCompleted, startSync, progress } =
    usePOSSyncJob({
      connectionId: connection?.id,
      connectionType: "clover",
      syncType: "customers",
    });

  // Listen for OAuth completion
  useEffect(() => {
    const handleOAuthResult = (data: any) => {
      if (Date.now() - data.timestamp < 30000) {
        setLoading(false);
        localStorage.removeItem("clover_oauth_result");

        if (data.status === "success") {
          queryClient.invalidateQueries({ queryKey: ["clover-connection"] });
          if (data.showSetupWizard) {
            setShowSetupWizard(true);
          } else {
            toast({
              title: "✓ Clover connected successfully",
              description: data.merchantName
                ? `Connected to ${data.merchantName}`
                : undefined,
            });
          }
        } else if (data.status === "error") {
          toast({
            title: "Connection failed",
            description: getUserFacingIntegrationError(
              data.message,
              "The connection could not be completed. Please try again.",
            ),
            variant: "destructive",
          });
        }
      }
    };

    const checkLocalStorage = () => {
      const result = localStorage.getItem("clover_oauth_result");
      if (result) {
        try {
          const data = JSON.parse(result);
          handleOAuthResult(data);
        } catch (error) {
          console.error(
            "[CLOVER-Integration] Error processing OAuth result:",
            error,
          );
        }
      }
    };

    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel("clover_oauth");
      channel.onmessage = (event) => {
        handleOAuthResult(event.data);
      };
    } catch (e) {}

    const handleMessage = (event: MessageEvent) => {
      if (
        event.origin === window.location.origin &&
        event.data?.type === "clover_oauth_result"
      ) {
        handleOAuthResult(event.data.data);
      }
    };
    window.addEventListener("message", handleMessage);

    checkLocalStorage();
    window.addEventListener("storage", checkLocalStorage);

    let interval: NodeJS.Timeout | null = null;
    if (loading) {
      interval = setInterval(checkLocalStorage, 500);
    }

    return () => {
      window.removeEventListener("storage", checkLocalStorage);
      window.removeEventListener("message", handleMessage);
      if (channel) channel.close();
      if (interval) clearInterval(interval);
    };
  }, [queryClient, toast, loading]);

  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["clover-connection"] });
    }, 1500);
    return () => clearInterval(interval);
  }, [loading, queryClient]);

  // Detect new connection and trigger setup wizard
  useEffect(() => {
    const prev = previousConnectionRef.current;
    const curr = connection;

    const wasNotConnected = !prev || prev.encrypted_access_token === "pending";
    const isNowConnected =
      curr &&
      curr.encrypted_access_token &&
      curr.encrypted_access_token !== "pending";
    const wizardNotCompleted = !curr?.setup_wizard_completed_at;

    if (wasNotConnected && isNowConnected && wizardNotCompleted && loading) {
      setLoading(false);
      setShowSetupWizard(true);
      queryClient.invalidateQueries({ queryKey: ["clover-connection-status"] });
    } else if (loading && isNowConnected && !wizardNotCompleted) {
      setLoading(false);
      toast({ title: "✓ Clover connected successfully" });
      queryClient.invalidateQueries({ queryKey: ["clover-connection-status"] });
    }

    previousConnectionRef.current = curr;
  }, [loading, connection, toast, queryClient]);

  // Show toast when sync completes
  useEffect(() => {
    if (isCompleted && activeJob) {
      queryClient.invalidateQueries({ queryKey: ["clover-connection"] });
      toast({
        title: "Sync completed",
        description: `Synced ${activeJob.total_synced.toLocaleString()} customers`,
      });
    }
  }, [isCompleted, activeJob, toast, queryClient]);

  const syncMutation = useMutation({
    mutationFn: async () => {
      await startSync();
    },
    onError: (error: Error) => {
      toast({
        title: "Sync failed",
        description: getUserFacingIntegrationError(
          error,
          "Clover sync could not be started.",
        ),
        variant: "destructive",
      });
    },
  });

  const initiateOAuthFlow = async () => {
    setLoading(true);
    setLoadingStep("preparing");

    try {
      const appEnv = detectEnvironment();
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        const { data: user } = await supabase
          .from("users")
          .select("tenant_id")
          .eq("id", userData.user.id)
          .single();

        if (user?.tenant_id) {
          await supabase
            .from("clover_connections")
            .delete()
            .eq("tenant_id", user.tenant_id)
            .eq("encrypted_access_token", "pending");
        }
      }

      const state = crypto.randomUUID();
      const { data, error } = await supabase.functions.invoke(
        "clover-oauth-start",
        {
          body: { state, region: "na" },
        },
      );

      if (error || !data?.authUrl) {
        throw new Error(error?.message || "Failed to initiate OAuth");
      }

      setLoadingStep("redirecting");
      localStorage.removeItem("clover_oauth_result");

      const link = document.createElement("a");
      link.href = data.authUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setLoadingStep("completing");
    } catch (error: any) {
      toast({
        title: "Connection failed",
        description: getUserFacingIntegrationError(
          error,
          "The connection could not be started. Please try again.",
        ),
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  // Query for latest test result
  const { data: latestTestResult } = useQuery({
    queryKey: ["clover-test-result", connection?.id],
    queryFn: async () => {
      if (!connection?.id) return null;
      const { data, error } = await supabase
        .from("clover_connection_tests")
        .select("*")
        .eq("connection_id", connection.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!connection?.id,
  });

  // Load latest test result into state
  useEffect(() => {
    if (latestTestResult && !testReport) {
      setTestReport({
        status: latestTestResult.status,
        summary: latestTestResult.summary,
        duration_ms: latestTestResult.duration_ms,
        results: latestTestResult.raw_results,
        counts: latestTestResult.counts,
        errors: latestTestResult.errors,
        testedAt: latestTestResult.created_at,
      });
    }
  }, [latestTestResult, testReport]);

  // Data model test harness mutation
  const testHarnessMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "clover-test-harness",
        {
          body: { date_range_days: 30 },
        },
      );
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setTestReport({ ...data, testedAt: new Date().toISOString() });
      queryClient.invalidateQueries({
        queryKey: ["clover-test-result", connection?.id],
      });
      toast({
        title:
          data.status === "success"
            ? "Test completed successfully"
            : "Test completed with issues",
        description: data.summary,
        variant: data.status === "failed" ? "destructive" : "default",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Test failed",
        description: getUserFacingIntegrationError(
          error,
          "Clover connection test could not be completed.",
        ),
        variant: "destructive",
      });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      if (!connection) throw new Error("No connection found");
      const { error } = await supabase
        .from("clover_connections")
        .delete()
        .eq("id", connection.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clover-connection"] });
      toast({ title: "Clover disconnected" });
    },
    onError: (error: Error) => {
      toast({
        title: "Disconnect failed",
        description: getUserFacingIntegrationError(
          error,
          "Clover could not be disconnected.",
        ),
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <Card className="p-6">
        <Loader2 className="h-6 w-6 animate-spin" />
      </Card>
    );
  }

  const isConnected =
    connection && connection.encrypted_access_token !== "pending";

  const getTokenExpiryInfo = () => {
    if (!connection?.expires_at) return null;
    const expiresAt = new Date(connection.expires_at);
    const now = new Date();
    const daysRemaining = Math.floor(
      (expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
    );

    let color = "text-green-600";
    if (daysRemaining < 7) color = "text-red-600";
    else if (daysRemaining < 14) color = "text-yellow-600";

    return { text: `${daysRemaining} days`, color, expired: daysRemaining < 0 };
  };

  const tokenExpiry = getTokenExpiryInfo();

  return (
    <>
      {loading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="p-8 max-w-md">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <div className="text-center">
                <h3 className="font-semibold mb-2">Connecting to Clover</h3>
                <p className="text-sm text-muted-foreground">
                  {loadingStep === "preparing" && "Preparing connection..."}
                  {loadingStep === "redirecting" &&
                    "Opening Clover authorization..."}
                  {loadingStep === "completing" && "Completing connection..."}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLoading(false)}
              >
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      )}

      <Card className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <Plug className="h-8 w-8 text-primary" />
            <div>
              <h3 className="text-lg font-semibold">Clover</h3>
              <p className="text-sm text-muted-foreground">POS Integration</p>
            </div>
          </div>
          {isConnected ? (
            <CheckCircle className="h-6 w-6 text-green-600" />
          ) : (
            <XCircle className="h-6 w-6 text-muted-foreground" />
          )}
        </div>

        {isConnected ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Merchant</p>
                <p className="font-medium">{connection.merchant_name}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Environment</p>
                <p className="font-medium capitalize">
                  {connection.environment}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Status</p>
                <p className="font-medium text-green-600">✓ Connected</p>
              </div>
              {tokenExpiry && (
                <div>
                  <p className="text-muted-foreground">
                    Connection Valid Until
                  </p>
                  <p className={`font-medium ${tokenExpiry.color}`}>
                    <Clock className="h-3 w-3 inline mr-1" />
                    {tokenExpiry.text}
                  </p>
                </div>
              )}
              {connection.last_synced_at && (
                <div>
                  <p className="text-muted-foreground">Last Synced</p>
                  <p className="font-medium">
                    {formatDistanceToNow(new Date(connection.last_synced_at), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
              )}
            </div>

            {/* Sync Progress Indicator */}
            {isSyncing && activeJob && (
              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
                  <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    Syncing customers in background...
                  </span>
                </div>
                <Progress value={progress} className="h-2 mb-2" />
                <div className="flex items-center justify-between text-xs text-blue-600 dark:text-blue-300">
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {activeJob.total_synced.toLocaleString()} synced
                  </span>
                  <span>Page {activeJob.current_page}</span>
                </div>
              </div>
            )}

            <div className="flex gap-2 flex-wrap">
              <Button
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending || loading || isSyncing}
                size="sm"
                variant="default"
              >
                {isSyncing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Syncing...
                  </>
                ) : (
                  "Sync Now"
                )}
              </Button>
              <Button
                onClick={() => testHarnessMutation.mutate()}
                disabled={testHarnessMutation.isPending || loading || isSyncing}
                size="sm"
                variant="outline"
              >
                {testHarnessMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <FlaskConical className="h-4 w-4 mr-2" />
                )}
                Run Data Test
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/integrations/clover/guide">
                  <BookOpen className="h-4 w-4 mr-2" />
                  View Guide
                </Link>
              </Button>
              {!connection.setup_wizard_completed_at && (
                <Button
                  onClick={() => setShowSetupWizard(true)}
                  size="sm"
                  variant="secondary"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Run Setup Wizard
                </Button>
              )}
              <Button
                onClick={() => disconnectMutation.mutate()}
                disabled={disconnectMutation.isPending || loading || isSyncing}
                size="sm"
                variant="destructive"
              >
                {disconnectMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Disconnect
              </Button>
            </div>

            {/* Test Report Display */}
            {testReport && (
              <CloverTestReport
                report={testReport}
                testedAt={testReport.testedAt}
                onRerun={() => testHarnessMutation.mutate()}
                isRunning={testHarnessMutation.isPending}
              />
            )}
          </div>
        ) : (
          <Button onClick={initiateOAuthFlow} className="w-full">
            <Plug className="h-4 w-4 mr-2" />
            Connect Clover
          </Button>
        )}
      </Card>

      <CloverSetupWizard
        open={showSetupWizard}
        onOpenChange={setShowSetupWizard}
        merchantName={connection?.merchant_name}
        connectionId={connection?.id}
      />
    </>
  );
};
