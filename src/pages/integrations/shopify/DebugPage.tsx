import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";
import { supabase } from "@/integrations/supabase/client";

type DiagnosticStatus = "pass" | "warn" | "fail";

interface DiagnosticResult {
  check: string;
  status: DiagnosticStatus;
  message: string;
  detail?: string;
}

interface DiagnosticsSummary {
  overallStatus: DiagnosticStatus;
  passCount: number;
  warnCount: number;
  failCount: number;
  totalCount: number;
}

interface DiagnosticsConnectionSummary {
  status: "connected" | "missing";
  shopDomain: string | null;
  shopName: string | null;
  scopeCount: number;
  lastCustomerSync: string | null;
  lastOrderSync: string | null;
  lastProductSync: string | null;
  lastWebhookReceivedAt: string | null;
  webhookSubscriptionCount: number;
}

interface ShopifyDiagnosticsResponse {
  timestamp: string;
  summary: DiagnosticsSummary;
  connection: DiagnosticsConnectionSummary | null;
  checks: DiagnosticResult[];
}

const EMPTY_DIAGNOSTICS_SUMMARY: DiagnosticsSummary = {
  overallStatus: "fail",
  passCount: 0,
  warnCount: 0,
  failCount: 0,
  totalCount: 0,
};

const CHECK_LABELS: Record<string, string> = {
  token_decryption: "Token Decryption",
  customers_api: "Customers API",
  orders_api: "Orders API",
  products_api: "Products API",
  webhook_health: "Webhook Health",
  sync_queue: "Sync Queue",
  imported_data: "Imported Data",
};

const STATUS_STYLES: Record<DiagnosticStatus, string> = {
  pass: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warn: "border-amber-200 bg-amber-50 text-amber-700",
  fail: "border-rose-200 bg-rose-50 text-rose-700",
};

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "Not recorded";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

function getStatusIcon(status: DiagnosticStatus) {
  if (status === "pass") {
    return <CheckCircle2 className="h-5 w-5 text-emerald-600" />;
  }

  if (status === "warn") {
    return <AlertTriangle className="h-5 w-5 text-amber-600" />;
  }

  return <XCircle className="h-5 w-5 text-rose-600" />;
}

export default function ShopifyDebugPage() {
  const { data: isSuperAdmin, isLoading: isCheckingSuperAdmin } =
    useIsSuperAdmin();
  const [diagnostics, setDiagnostics] =
    useState<ShopifyDiagnosticsResponse | null>(null);
  const [diagnosticsError, setDiagnosticsError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const runDiagnostics = async () => {
    setIsLoading(true);
    setDiagnosticsError(null);

    try {
      const { data, error } =
        await supabase.functions.invoke<ShopifyDiagnosticsResponse>(
          "shopify-diagnostics",
        );

      if (error) {
        setDiagnostics(null);
        setDiagnosticsError(error.message);
        toast({
          title: "Diagnostics failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        setDiagnostics(data ?? null);
        toast({ title: "Diagnostics completed" });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown diagnostics error";
      setDiagnostics(null);
      setDiagnosticsError(message);
      toast({
        title: "Diagnostics failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async () => {
    const payload =
      diagnostics ?? (diagnosticsError ? { error: diagnosticsError } : null);
    if (!payload) {
      return;
    }

    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopied(true);
    toast({ title: "Copied to clipboard" });
    window.setTimeout(() => setCopied(false), 2000);
  };

  const summary = diagnostics?.summary ?? EMPTY_DIAGNOSTICS_SUMMARY;
  const connection = diagnostics?.connection ?? null;
  const checks = diagnostics?.checks ?? [];
  const overallStatus = summary.overallStatus;
  const summaryStyle = STATUS_STYLES[overallStatus];

  if (isCheckingSuperAdmin) {
    return (
      <div className="container mx-auto max-w-5xl space-y-6 px-4 py-8">
        <Card className="p-6">
          <h1 className="text-xl font-semibold">Checking permissions...</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Verifying admin access for Shopify diagnostics.
          </p>
        </Card>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="container mx-auto max-w-5xl space-y-6 px-4 py-8">
        <Card className="p-6">
          <h1 className="text-xl font-semibold">Access Denied</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Shopify diagnostics are available to admins only.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Shopify Diagnostics</h1>
        <p className="text-muted-foreground">
          Verify the real Shopify customer, order, product, webhook, and sync
          queue paths for this tenant.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={runDiagnostics} disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Running diagnostics...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Run Diagnostics
            </>
          )}
        </Button>

        {(diagnostics || diagnosticsError) && (
          <Button onClick={copyToClipboard} variant="outline">
            {copied ? (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Copied
              </>
            ) : (
              <>
                <Copy className="mr-2 h-4 w-4" />
                Copy Results
              </>
            )}
          </Button>
        )}
      </div>

      {diagnosticsError ? (
        <Card className="border-rose-200 bg-rose-50 p-6 text-rose-700">
          <div className="flex items-start gap-3">
            <XCircle className="mt-0.5 h-5 w-5" />
            <div>
              <h2 className="font-semibold">Diagnostics request failed</h2>
              <p className="mt-1 text-sm">{diagnosticsError}</p>
            </div>
          </div>
        </Card>
      ) : null}

      {diagnostics ? (
        <div className="space-y-4">
          <Card className={`border p-6 ${summaryStyle}`}>
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="flex items-start gap-3">
                {getStatusIcon(overallStatus)}
                <div>
                  <h2 className="text-xl font-semibold">
                    {overallStatus === "pass"
                      ? "All diagnostic checks passed"
                      : overallStatus === "warn"
                        ? "Diagnostics completed with warnings"
                        : "Diagnostics found blocking issues"}
                  </h2>
                  <p className="mt-1 text-sm">
                    Last run: {formatDateTime(diagnostics.timestamp)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                <div>
                  <div className="text-xs uppercase tracking-wide text-current/70">
                    Passed
                  </div>
                  <div className="text-2xl font-semibold">
                    {summary.passCount}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-current/70">
                    Warnings
                  </div>
                  <div className="text-2xl font-semibold">
                    {summary.warnCount}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-current/70">
                    Failures
                  </div>
                  <div className="text-2xl font-semibold">
                    {summary.failCount}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-current/70">
                    Total
                  </div>
                  <div className="text-2xl font-semibold">
                    {summary.totalCount}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="mb-4 text-xl font-semibold">Connection Snapshot</h2>
            <div className="grid gap-4 text-sm md:grid-cols-2">
              <div>
                <div className="text-muted-foreground">Connection Status</div>
                <div className="font-medium capitalize">
                  {connection?.status ?? "missing"}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Store</div>
                <div className="font-medium">
                  {connection?.shopName ?? "Not recorded"}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Domain</div>
                <div className="font-medium">
                  {connection?.shopDomain ?? "Not recorded"}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Scopes</div>
                <div className="font-medium">{connection?.scopeCount ?? 0}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Last customer sync</div>
                <div className="font-medium">
                  {formatDateTime(connection?.lastCustomerSync)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Last order sync</div>
                <div className="font-medium">
                  {formatDateTime(connection?.lastOrderSync)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Last product sync</div>
                <div className="font-medium">
                  {formatDateTime(connection?.lastProductSync)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Last webhook</div>
                <div className="font-medium">
                  {formatDateTime(connection?.lastWebhookReceivedAt)}
                </div>
              </div>
            </div>
          </Card>

          <div className="space-y-3">
            {checks.map((check) => (
              <Card key={check.check} className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    {getStatusIcon(check.status)}
                    <div>
                      <h3 className="font-semibold">
                        {CHECK_LABELS[check.check] ?? check.check}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {check.message}
                      </p>
                      {check.detail ? (
                        <p className="mt-2 text-sm text-muted-foreground">
                          {check.detail}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
