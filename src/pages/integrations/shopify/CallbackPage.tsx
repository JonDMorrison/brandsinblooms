import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle, Clock, Loader2, XCircle } from "lucide-react";

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
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="max-w-md space-y-4 p-8 text-center">
        {status === "loading" ? (
          <>
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
            <h2 className="text-xl font-semibold">{message}</h2>
            <p className="text-sm text-muted-foreground">{step}</p>
          </>
        ) : null}

        {status === "success" ? (
          <>
            <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
            <h2 className="text-xl font-semibold text-green-600">{message}</h2>
            <p className="text-sm text-muted-foreground">{step}</p>
          </>
        ) : null}

        {status === "error" ? (
          <>
            <XCircle className="mx-auto h-12 w-12 text-red-500" />
            <h2 className="text-xl font-semibold text-red-600">{message}</h2>
            <p className="text-sm text-muted-foreground">{step}</p>
          </>
        ) : null}

        {status === "timeout" ? (
          <>
            <Clock className="mx-auto h-12 w-12 text-yellow-500" />
            <h2 className="text-xl font-semibold text-yellow-600">{message}</h2>
            <p className="text-sm text-muted-foreground">{step}</p>
          </>
        ) : null}
      </div>
    </div>
  );
}
