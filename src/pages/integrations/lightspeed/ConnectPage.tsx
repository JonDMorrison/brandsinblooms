import { useEffect, useState } from "react";
import { ArrowLeft, Plug } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import { getUserFacingIntegrationError } from "@/components/integrations/integrationDetailModel";
import { LightspeedOAuthOverlay } from "@/components/integrations/LightspeedOAuthOverlay";
import {
  Box,
  Button,
  CircularProgress,
  FormHelperText,
  Input,
  Sheet,
  Stack,
  Typography,
} from "@mui/joy";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const FIRST_PARTY_LIGHTSPEED_CALLBACK_ORIGINS = new Set([
  "https://bloomsuite.app",
  "https://www.bloomsuite.app",
]);

export default function LightspeedConnectPage() {
  const [domainPrefix, setDomainPrefix] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<
    "preparing" | "redirecting" | "completing"
  >("preparing");
  const [domainError, setDomainError] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleOAuthResult = (data: any) => {
      if (Date.now() - data.timestamp < 30000) {
        setLoading(false);
        localStorage.removeItem("lightspeed_oauth_result");

        if (data.status === "success") {
          void queryClient.invalidateQueries({
            queryKey: ["lightspeed-connection"],
          });
          void queryClient.invalidateQueries({
            queryKey: ["lightspeed-connection-status"],
          });
          toast({
            title: "✓ Lightspeed connected successfully",
            description: data.retailerName
              ? `Connected to ${data.retailerName}`
              : undefined,
          });
          void navigate("/integrations/lightspeed", { replace: true });
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
      const result = localStorage.getItem("lightspeed_oauth_result");
      if (result) {
        try {
          handleOAuthResult(JSON.parse(result));
        } catch {
          /* ignore */
        }
      }
    };

    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel("lightspeed_oauth");
      channel.onmessage = (event) => handleOAuthResult(event.data);
    } catch {
      /* ignore */
    }

    const handleMessage = (event: MessageEvent) => {
      const allowedOrigins = new Set([
        window.location.origin,
        ...FIRST_PARTY_LIGHTSPEED_CALLBACK_ORIGINS,
      ]);

      if (
        allowedOrigins.has(event.origin) &&
        event.data?.type === "lightspeed_oauth_result"
      ) {
        handleOAuthResult(event.data.data);
      }
    };
    window.addEventListener("message", handleMessage);
    checkLocalStorage();
    window.addEventListener("storage", checkLocalStorage);
    let interval: ReturnType<typeof setInterval> | null = null;
    if (loading) interval = setInterval(checkLocalStorage, 500);

    return () => {
      window.removeEventListener("storage", checkLocalStorage);
      window.removeEventListener("message", handleMessage);
      channel?.close();
      if (interval) clearInterval(interval);
    };
  }, [queryClient, toast, loading, navigate]);

  const initiateOAuthFlow = async (prefix: string) => {
    setLoading(true);
    setLoadingStep("preparing");
    try {
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

      const { data, error } = await supabase.functions.invoke(
        "lightspeed-oauth-start",
        {
          body: {
            domainPrefix: prefix,
            redirectOrigin: window.location.origin,
          },
        },
      );

      if (error || !data?.authUrl) {
        throw new Error(error?.message || "No authorization URL received");
      }

      setLoadingStep("redirecting");
      localStorage.removeItem("lightspeed_oauth_result");

      const link = document.createElement("a");
      link.href = data.authUrl as string;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setLoadingStep("completing");
    } catch (error: unknown) {
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
    setDomainError(null);
    if (!prefix) {
      setDomainError("Please enter a domain prefix.");
      return;
    }
    if (!/^[a-z0-9-]+$/i.test(prefix)) {
      setDomainError("Use only letters, numbers, and dashes.");
      return;
    }
    if (prefix.length < 3 || prefix.length > 50) {
      setDomainError("Domain prefix must be 3–50 characters.");
      return;
    }
    void initiateOAuthFlow(prefix);
  };

  return (
    <>
      <LightspeedOAuthOverlay
        isVisible={loading}
        step={loadingStep}
        onCancel={() => setLoading(false)}
      />

      <Box sx={{ p: 3, maxWidth: 480, mx: "auto" }}>
        <Link to="/integrations/pos" style={{ textDecoration: "none" }}>
          <Stack direction="row" spacing={0.75} alignItems="center" mb={2.5}>
            <ArrowLeft style={{ width: 14, height: 14 }} />
            <Typography level="body-sm" textColor="text.tertiary">
              Back to POS Integrations
            </Typography>
          </Stack>
        </Link>

        <Sheet
          variant="outlined"
          sx={{ borderRadius: "lg", p: 3, bgcolor: "background.surface" }}
        >
          <Stack direction="row" spacing={2} alignItems="flex-start" mb={3}>
            <Box
              sx={{
                flexShrink: 0,
                width: 48,
                height: 48,
                borderRadius: "xl",
                bgcolor: "neutral.softBg",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Plug style={{ width: 22, height: 22 }} />
            </Box>
            <Box>
              <Typography level="title-md" fontWeight="xl">
                Connect Lightspeed X-Series
              </Typography>
              <Typography level="body-sm" textColor="text.tertiary">
                Enter your store domain to get started
              </Typography>
            </Box>
          </Stack>

          <Stack spacing={2}>
            <Box>
              <Typography level="body-sm" fontWeight="md" mb={0.75}>
                Domain Prefix
              </Typography>
              <Input
                id="domain"
                placeholder="yourstore"
                value={domainPrefix}
                disabled={loading}
                endDecorator={
                  <Typography level="body-xs" textColor="text.tertiary">
                    .retail.lightspeed.app
                  </Typography>
                }
                onChange={(e) => {
                  setDomainPrefix(e.target.value);
                  setDomainError(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && handleConnect()}
              />
              {domainError ? (
                <FormHelperText sx={{ color: "danger.500", mt: 0.5 }}>
                  {domainError}
                </FormHelperText>
              ) : (
                <FormHelperText sx={{ mt: 0.5 }}>
                  Find this in your Lightspeed back-office URL
                </FormHelperText>
              )}
            </Box>

            <Button
              variant="solid"
              color="neutral"
              onClick={handleConnect}
              disabled={loading || !domainPrefix.trim()}
              startDecorator={loading ? <CircularProgress size="sm" /> : null}
              sx={{ width: "100%" }}
            >
              {loading ? "Connecting..." : "Connect to Lightspeed"}
            </Button>
          </Stack>
        </Sheet>
      </Box>
    </>
  );
}
