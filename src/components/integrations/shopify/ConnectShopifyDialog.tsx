import { useEffect, useState } from "react";
import { ArrowRight, ExternalLink, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

const SHOPIFY_OAUTH_RESULT_KEY = "shopify_oauth_result";
const SHOPIFY_OAUTH_CHANNEL = "shopify_oauth";

function normalizeShopDomain(value: string) {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return "";
  }

  const withoutProtocol = trimmed
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
  if (withoutProtocol.endsWith(".myshopify.com")) {
    return withoutProtocol;
  }

  return `${withoutProtocol}.myshopify.com`;
}

function stripShopDomainPrefix(value: string) {
  return normalizeShopDomain(value).replace(/\.myshopify\.com$/, "");
}

function isValidShopifyDomain(value: string) {
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(value);
}

type ShopifyOAuthResult = {
  status?: "success" | "error";
  message?: string;
  shopName?: string;
  timestamp?: number;
};

interface ConnectShopifyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDomain?: string | null;
}

export function ConnectShopifyDialog({
  open,
  onOpenChange,
  initialDomain,
}: ConnectShopifyDialogProps) {
  const [storeDomain, setStoreDomain] = useState("");
  const [domainError, setDomainError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open) {
      setStoreDomain(stripShopDomainPrefix(initialDomain ?? ""));
      setDomainError(null);
      setIsLoading(false);
      localStorage.removeItem(SHOPIFY_OAUTH_RESULT_KEY);
    }
  }, [open, initialDomain]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleOAuthResult = async (result: ShopifyOAuthResult) => {
      if (!result?.timestamp || Date.now() - result.timestamp > 30_000) {
        return;
      }

      setIsLoading(false);
      localStorage.removeItem(SHOPIFY_OAUTH_RESULT_KEY);

      if (result.status === "success") {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["shopify-connection"] }),
          queryClient.invalidateQueries({ queryKey: ["integration-detail"] }),
          queryClient.invalidateQueries({ queryKey: ["integrations-hub"] }),
        ]);

        onOpenChange(false);
        toast.success("Shopify connected successfully!");
        return;
      }

      if (result.status === "error") {
        setDomainError(
          getUserFacingIntegrationError(
            result.message,
            "Could not complete Shopify authorization. Please try again.",
          ),
        );
      }
    };

    const checkLocalStorage = () => {
      const result = localStorage.getItem(SHOPIFY_OAUTH_RESULT_KEY);
      if (!result) {
        return;
      }

      try {
        void handleOAuthResult(JSON.parse(result) as ShopifyOAuthResult);
      } catch (error) {
        console.error("[SHOPIFY-Dialog] Failed to parse OAuth result:", error);
      }
    };

    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(SHOPIFY_OAUTH_CHANNEL);
      channel.onmessage = (event) => {
        void handleOAuthResult(event.data as ShopifyOAuthResult);
      };
    } catch {
      // Ignore browsers without BroadcastChannel support.
    }

    const handleMessage = (event: MessageEvent) => {
      if (
        event.origin === window.location.origin &&
        event.data?.type === "shopify_oauth_result"
      ) {
        void handleOAuthResult(event.data.data as ShopifyOAuthResult);
      }
    };

    window.addEventListener("message", handleMessage);
    window.addEventListener("storage", checkLocalStorage);

    checkLocalStorage();
    const interval = window.setInterval(checkLocalStorage, 500);

    return () => {
      window.removeEventListener("message", handleMessage);
      window.removeEventListener("storage", checkLocalStorage);
      window.clearInterval(interval);
      channel?.close();
    };
  }, [open, onOpenChange, queryClient]);

  const handleConnect = async () => {
    const normalizedDomain = normalizeShopDomain(storeDomain);
    if (!isValidShopifyDomain(normalizedDomain)) {
      setDomainError(
        "Please enter a valid Shopify store domain (for example, mystore.myshopify.com).",
      );
      return;
    }

    setDomainError(null);
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke(
        "shopify-oauth-start",
        {
          body: { shop_domain: normalizedDomain },
        },
      );

      if (error || !data?.auth_url) {
        throw new Error(
          error?.message || "Could not start Shopify authorization.",
        );
      }

      const popup = window.open(
        data.auth_url as string,
        "shopify_oauth",
        "width=720,height=720,noopener,noreferrer",
      );

      if (!popup) {
        throw new Error(
          "The Shopify authorization popup was blocked. Please allow popups and try again.",
        );
      }
    } catch (error) {
      setDomainError(
        getUserFacingIntegrationError(
          error,
          "Could not start Shopify authorization. Please try again.",
        ),
      );
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Connect your Shopify store</DialogTitle>
          <DialogDescription>
            Enter your Shopify store domain to begin.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="shopify-store-domain">Store domain</Label>
            <div className="flex items-center gap-2">
              <Input
                id="shopify-store-domain"
                type="text"
                placeholder="your-store"
                value={storeDomain}
                onChange={(event) => {
                  setStoreDomain(event.target.value);
                  if (domainError) {
                    setDomainError(null);
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void handleConnect();
                  }
                }}
                className="flex-1"
                autoComplete="off"
              />
              <span className="shrink-0 text-sm text-muted-foreground">
                .myshopify.com
              </span>
            </div>
            {domainError ? (
              <p className="text-xs text-red-600">{domainError}</p>
            ) : null}
          </div>

          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">
              You&apos;ll be redirected to Shopify to authorize BloomSuite. No
              password or Shopify admin credentials are shared with BloomSuite.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleConnect()}
            disabled={!storeDomain || isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                Connect Shopify
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function getShopifyAdminUrl(shopDomain?: string | null) {
  const normalizedDomain = normalizeShopDomain(shopDomain ?? "");
  return isValidShopifyDomain(normalizedDomain)
    ? `https://${normalizedDomain}/admin`
    : null;
}

export function ConnectShopifyHint() {
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
      <p className="flex items-start gap-2">
        <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Shopify authorizes BloomSuite in a popup. Keep this page open while the
        connection completes and BloomSuite will refresh automatically.
      </p>
    </div>
  );
}
