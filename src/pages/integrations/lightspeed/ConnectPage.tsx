import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plug, ArrowLeft } from "lucide-react";
import { LightspeedOAuthOverlay } from "@/components/integrations/LightspeedOAuthOverlay";
import { getUserFacingIntegrationError } from "@/components/integrations/integrationDetailModel";
import { Link, useNavigate } from "react-router-dom";

export default function LightspeedConnectPage() {
  const [domainPrefix, setDomainPrefix] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<
    "preparing" | "redirecting" | "completing"
  >("preparing");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Listen for OAuth completion via multiple channels (from callback tab)
  useEffect(() => {
    const handleOAuthResult = (data: any) => {
      // Only process recent results (within 30 seconds)
      if (Date.now() - data.timestamp < 30000) {
        setLoading(false);
        localStorage.removeItem("lightspeed_oauth_result");

        if (data.status === "success") {
          queryClient.invalidateQueries({
            queryKey: ["lightspeed-connection"],
          });
          queryClient.invalidateQueries({
            queryKey: ["lightspeed-connection-status"],
          });
          toast({
            title: "✓ Lightspeed connected successfully",
            description: data.retailerName
              ? `Connected to ${data.retailerName}`
              : undefined,
          });
          navigate("/integrations/pos");
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

    // Method 1: Check localStorage
    const checkLocalStorage = () => {
      const result = localStorage.getItem("lightspeed_oauth_result");
      if (result) {
        try {
          const data = JSON.parse(result);
          handleOAuthResult(data);
        } catch (error) {
          console.error("[LS-Connect] Error processing OAuth result:", error);
        }
      }
    };

    // Method 2: Listen to BroadcastChannel
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel("lightspeed_oauth");
      channel.onmessage = (event) => {
        handleOAuthResult(event.data);
      };
    } catch (e) {
      console.log("[LS-Connect] BroadcastChannel not supported");
    }

    // Method 3: Listen to postMessage
    const handleMessage = (event: MessageEvent) => {
      if (
        event.origin === window.location.origin &&
        event.data?.type === "lightspeed_oauth_result"
      ) {
        handleOAuthResult(event.data.data);
      }
    };
    window.addEventListener("message", handleMessage);

    // Check immediately
    checkLocalStorage();

    // Listen for storage events from other tabs
    window.addEventListener("storage", checkLocalStorage);

    // Poll more frequently while loading (every 500ms)
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
  }, [queryClient, toast, loading, navigate]);

  const initiateOAuthFlow = async (prefix: string) => {
    setLoading(true);
    setLoadingStep("preparing");

    try {
      // Clean up old pending connections first
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        const { data: user } = await supabase
          .from("users")
          .select("tenant_id")
          .eq("id", userData.user.id)
          .single();

        if (user?.tenant_id) {
          await supabase
            .from("lightspeed_connections")
            .delete()
            .eq("tenant_id", user.tenant_id)
            .eq("encrypted_access_token", "pending");
        }
      }

      const redirectOrigin = window.location.origin;

      const { data, error } = await supabase.functions.invoke(
        "lightspeed-oauth-start",
        {
          body: { domainPrefix: prefix, redirectOrigin },
        },
      );

      if (error) {
        throw new Error(error.message || "Failed to initiate OAuth");
      }

      if (!data?.authUrl) {
        throw new Error("No authorization URL received");
      }

      setLoadingStep("redirecting");

      // Clear any old OAuth results
      localStorage.removeItem("lightspeed_oauth_result");

      // Open OAuth in a new tab
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
          "Failed to start the connection. Please try again.",
        ),
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const handleConnect = () => {
    const prefix = domainPrefix.trim();
    if (!prefix) {
      toast({ title: "Please enter a domain prefix", variant: "destructive" });
      return;
    }
    if (!/^[a-z0-9-]+$/i.test(prefix)) {
      toast({
        title: "Invalid format",
        description: "Use only letters, numbers, and dashes",
        variant: "destructive",
      });
      return;
    }
    if (prefix.length < 3 || prefix.length > 50) {
      toast({
        title: "Invalid length",
        description: "Domain prefix must be 3-50 characters",
        variant: "destructive",
      });
      return;
    }
    initiateOAuthFlow(prefix);
  };

  return (
    <>
      <LightspeedOAuthOverlay
        isVisible={loading}
        step={loadingStep}
        onCancel={() => setLoading(false)}
      />

      <div className="p-6 max-w-lg mx-auto space-y-6">
        <Link
          to="/integrations/pos"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to POS Integrations
        </Link>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <Plug className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-xl font-semibold">
                Connect Lightspeed X-Series
              </h1>
              <p className="text-sm text-muted-foreground">
                Enter your store domain to get started
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="domain">Domain Prefix</Label>
              <div className="flex items-center gap-1">
                <Input
                  id="domain"
                  placeholder="yourstore"
                  value={domainPrefix}
                  onChange={(e) => setDomainPrefix(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleConnect()}
                  disabled={loading}
                />
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  .retail.lightspeed.app
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Find this in your Lightspeed back-office URL
              </p>
            </div>

            <Button
              onClick={handleConnect}
              disabled={loading || !domainPrefix.trim()}
              className="w-full"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {loading ? "Connecting..." : "Connect to Lightspeed"}
            </Button>
          </div>
        </Card>
      </div>
    </>
  );
}
