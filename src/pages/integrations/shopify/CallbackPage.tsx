import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle, Clock, XCircle } from "lucide-react";
import { Box, CircularProgress, Stack, Typography } from "@mui/joy";

const SHOPIFY_OAUTH_RESULT_KEY = "shopify_oauth_result";
const SHOPIFY_OAUTH_CHANNEL = "shopify_oauth";

type CallbackStatus = "loading" | "success" | "error" | "timeout";

export default function ShopifyCallbackPage() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<CallbackStatus>("loading");
  const [message, setMessage] = useState(
    "Completing your Shopify connection...",
  );
  const [step, setStep] = useState("Finalizing your Shopify authorization...");

  useEffect(() => {
    const broadcastResult = (result: Record<string, unknown>) => {
      localStorage.setItem(SHOPIFY_OAUTH_RESULT_KEY, JSON.stringify(result));

      try {
        const channel = new BroadcastChannel(SHOPIFY_OAUTH_CHANNEL);
        channel.postMessage(result);
        channel.close();
      } catch {
        // Ignore browsers without BroadcastChannel support.
      }

      if (window.opener && !window.opener.closed) {
        try {
          window.opener.postMessage(
            { type: "shopify_oauth_result", data: result },
            window.location.origin,
          );
        } catch {
          // Ignore popup-opener messaging failures.
        }
      }
    };

    const timeoutId = window.setTimeout(() => {
      setStatus("timeout");
      setMessage("Connection timeout - please try again");
      setStep("The request took too long to complete.");
      broadcastResult({
        status: "error",
        message: "Connection timeout",
        timestamp: Date.now(),
      });
    }, 30_000);

    const resultStatus = searchParams.get("status");
    const resultMessage = searchParams.get("message");
    const shopName = searchParams.get("shop_name") ?? searchParams.get("shop");

    if (resultStatus === "success") {
      window.clearTimeout(timeoutId);
      setStatus("success");
      setMessage("Connected Successfully!");
      setStep(`Connected to ${shopName || "Shopify"}`);
      broadcastResult({
        status: "success",
        message: "Shopify connected successfully!",
        shopName,
        timestamp: Date.now(),
      });
      window.setTimeout(() => window.close(), 2000);
      return () => window.clearTimeout(timeoutId);
    }

    if (resultStatus === "error") {
      window.clearTimeout(timeoutId);
      setStatus("error");
      setMessage("Connection Failed");
      setStep(
        resultMessage ||
          "The Shopify authorization flow could not be completed.",
      );
      broadcastResult({
        status: "error",
        message:
          resultMessage ||
          "The Shopify authorization flow could not be completed.",
        timestamp: Date.now(),
      });
      window.setTimeout(() => window.close(), 3000);
      return () => window.clearTimeout(timeoutId);
    }

    return () => window.clearTimeout(timeoutId);
  }, [searchParams]);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "background.surface",
        p: 4,
      }}
    >
      <Stack
        spacing={2}
        alignItems="center"
        sx={{ maxWidth: 400, textAlign: "center" }}
      >
        {status === "loading" ? (
          <>
            <CircularProgress size="lg" color="neutral" />
            <Typography level="title-md" fontWeight="xl">
              {message}
            </Typography>
            <Typography level="body-sm" textColor="text.tertiary">
              {step}
            </Typography>
          </>
        ) : null}
        {status === "success" ? (
          <>
            <CheckCircle
              style={{
                width: 48,
                height: 48,
                color: "var(--joy-palette-success-500)",
              }}
            />
            <Typography
              level="title-md"
              fontWeight="xl"
              textColor="success.600"
            >
              {message}
            </Typography>
            <Typography level="body-sm" textColor="text.tertiary">
              {step}
            </Typography>
          </>
        ) : null}
        {status === "error" ? (
          <>
            <XCircle
              style={{
                width: 48,
                height: 48,
                color: "var(--joy-palette-danger-500)",
              }}
            />
            <Typography level="title-md" fontWeight="xl" textColor="danger.600">
              {message}
            </Typography>
            <Typography level="body-sm" textColor="text.tertiary">
              {step}
            </Typography>
          </>
        ) : null}
        {status === "timeout" ? (
          <>
            <Clock
              style={{
                width: 48,
                height: 48,
                color: "var(--joy-palette-warning-500)",
              }}
            />
            <Typography
              level="title-md"
              fontWeight="xl"
              textColor="warning.600"
            >
              {message}
            </Typography>
            <Typography level="body-sm" textColor="text.tertiary">
              {step}
            </Typography>
          </>
        ) : null}
      </Stack>
    </Box>
  );
}
