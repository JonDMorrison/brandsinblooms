import { useCallback, useEffect, useMemo, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart2,
  Bell,
  Bot,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Copy,
  Database,
  ExternalLink,
  Facebook,
  FlaskConical,
  Globe,
  Instagram,
  Key,
  MailPlus,
  MapPin,
  PlugZap,
  RefreshCcw,
  Receipt,
  ShieldAlert,
  Share2,
  Store,
  TrendingUp,
  Users,
  Webhook,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { CRMMetricCard } from "@/components/crm/CRMMetricCard";
import {
  ComingSoonCard,
  DataFeedRow,
  DetailFieldRows,
  DetailHealthRows,
  DetailStatusBadge,
  DetailTimeline,
  FieldRow,
  HealthFieldRow,
  KeyValueGrid,
  LoadingShell,
  OverviewPanel,
  SectionCard,
  SyncTypeRow,
} from "@/components/integrations/shared/detailPrimitives";
import { useDebouncedValue } from "@/components/integrations/shared/dataTabPrimitives";
import { getIntegrationToneClasses as getToneClasses } from "@/components/integrations/shared/tokens";
import { CustomersTabView } from "@/components/integrations/lightspeed/CustomersTabView";
import { ProductsTabView } from "@/components/integrations/lightspeed/ProductsTabView";
import { SalesTabView } from "@/components/integrations/lightspeed/SalesTabView";
import { SyncLogsTabView } from "@/components/integrations/lightspeed/SyncLogsTabView";
import { ConnectionTestTabView as CloverConnectionTestTabView } from "@/components/integrations/clover/ConnectionTestTabView";
import { CustomersTabView as CloverCustomersTabView } from "@/components/integrations/clover/CustomersTabView";
import { ProductsTabView as CloverProductsTabView } from "@/components/integrations/clover/ProductsTabView";
import { SalesTabView as CloverSalesTabView } from "@/components/integrations/clover/SalesTabView";
import { SyncLogsTabView as CloverSyncLogsTabView } from "@/components/integrations/clover/SyncLogsTabView";
import { CustomersTabView as SquareCustomersTabView } from "@/components/integrations/square/CustomersTabView";
import { ProductsTabView as SquareProductsTabView } from "@/components/integrations/square/ProductsTabView";
import { SalesTabView as SquareSalesTabView } from "@/components/integrations/square/SalesTabView";
import { SyncLogsTabView as SquareSyncLogsTabView } from "@/components/integrations/square/SyncLogsTabView";
import { CustomersTabView as ShopifyCustomersTabView } from "@/components/integrations/shopify/CustomersTabView";
import { OrdersTabView as ShopifyOrdersTabView } from "@/components/integrations/shopify/OrdersTabView";
import { ProductsTabView as ShopifyProductsTabView } from "@/components/integrations/shopify/ProductsTabView";
import { SyncLogsTabView as ShopifySyncLogsTabView } from "@/components/integrations/shopify/SyncLogsTabView";
import {
  getUserFacingIntegrationError,
  type IntegrationDetailTone,
} from "@/components/integrations/integrationDetailModel";
import { getIntegrationSeed } from "@/components/integrations/integrationsHubConfig";
import { ConnectMailchimpDialog } from "@/components/integrations/mailchimp/ConnectMailchimpDialog";
import { MailchimpImportOnboardingDialog } from "@/components/integrations/mailchimp/MailchimpImportOnboardingDialog";
import { MailchimpIntegrationShell } from "@/components/integrations/mailchimp/MailchimpIntegrationShell";
import { useMailchimpImportProgress } from "@/hooks/useMailchimpImportProgress";
import {
  ConnectShopifyDialog,
  ConnectShopifyHint,
  getShopifyAdminUrl,
} from "@/components/integrations/shopify/ConnectShopifyDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ActionDropdown } from "@/components/ui/action-dropdown";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  type CloverCustomerTableRow,
  type LightspeedCustomerSortField,
  type LightspeedCustomerTableRow,
  type LightspeedPagination,
  type LightspeedProductsSortField,
  type LightspeedProductTableRow,
  type LightspeedSaleRow,
  type LightspeedSalesSortField,
  type LightspeedSortDirection,
  type LightspeedSyncLogRow,
  type CloverSaleRow,
  type SquareCustomerSortField,
  type SquareCustomerTableRow,
  type SquareProductsSortField,
  type SquareProductTableRow,
  type SquareSaleRow,
  type SquareSalesSortField,
  type ShopifyCustomerSortField,
  type ShopifyOrdersSortField,
  type ShopifyProductsSortField,
  useIntegrationDetailData,
} from "@/hooks/useIntegrationDetailData";
import { cn } from "@/lib/utils";
import NotFound from "@/pages/NotFound";

const REQUEST_INTEGRATION_MAILTO =
  "mailto:support@bloomsuite.app?subject=Request%20an%20Integration&body=Hi%20BloomSuite%20team%2C%0A%0AI'd%20like%20to%20request%20support%20for%20the%20following%20integration%3A%0A";

const SHOPIFY_DIAGNOSTICS_PATH = "/integrations/shopify/debug";

function formatRelativeTimestamp(timestamp?: string | null) {
  if (!timestamp) {
    return "Not available";
  }

  try {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
  } catch {
    return "Not available";
  }
}

function formatDurationLabel(durationSeconds?: number | null) {
  if (typeof durationSeconds !== "number" || Number.isNaN(durationSeconds)) {
    return null;
  }

  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;

  if (minutes <= 0) {
    return `${seconds}s`;
  }

  if (seconds === 0) {
    return `${minutes}m`;
  }

  return `${minutes}m ${seconds}s`;
}

function formatExactTimestamp(timestamp?: string | null) {
  if (!timestamp) {
    return null;
  }

  try {
    return format(new Date(timestamp), "MMM d, yyyy 'at' h:mm a");
  } catch {
    return null;
  }
}

function formatRate(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "0%";
  }

  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)}%`;
}

function formatInfrastructureHealthTone(
  status: "healthy" | "warning" | "error" | "neutral",
): IntegrationDetailTone {
  switch (status) {
    case "healthy":
      return "success";
    case "warning":
      return "warning";
    case "error":
      return "danger";
    default:
      return "neutral";
  }
}

function formatInfrastructureTrendLabel(trend: "up" | "down" | "flat" | null) {
  switch (trend) {
    case "up":
      return "Improving";
    case "down":
      return "Declining";
    case "flat":
      return "Stable";
    default:
      return "Trend unavailable";
  }
}

function MetricAppearance({ tone }: { tone: IntegrationDetailTone }) {
  const classes = getToneClasses(tone);
  return {
    iconClassName: classes.icon,
    iconWrapClassName: classes.iconWrap,
  };
}

function formatCount(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "0";
  }

  return value.toLocaleString();
}

function getEffectiveImportedCount(
  syncedCount?: number | null,
  dashboardTotalCount?: number | null,
) {
  const normalizedSyncedCount =
    typeof syncedCount === "number" && Number.isFinite(syncedCount)
      ? syncedCount
      : 0;
  const normalizedDashboardCount =
    typeof dashboardTotalCount === "number" &&
    Number.isFinite(dashboardTotalCount)
      ? dashboardTotalCount
      : 0;

  return Math.max(normalizedSyncedCount, normalizedDashboardCount);
}

function formatEnvironmentLabel(environment?: string | null) {
  if (!environment) {
    return "Environment pending";
  }

  return environment
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function formatTokenType(tokenType?: string | null) {
  if (!tokenType) {
    return "Not available";
  }

  return tokenType
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function formatRegionLabel(region?: string | null) {
  if (!region) {
    return "Not available";
  }

  return region.toUpperCase();
}

function renderCloverRegionBadge(region?: string | null) {
  const label = formatRegionLabel(region);

  if (label === "Not available") {
    return label;
  }

  const className =
    label === "US"
      ? "border-sky-200 bg-sky-50 text-sky-800"
      : label === "EU"
        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
        : label === "LA"
          ? "border-amber-200 bg-amber-50 text-amber-800"
          : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <Badge className={cn("rounded-full border px-2.5 py-0.5", className)}>
      {label}
    </Badge>
  );
}

function formatTimestampOrFallback(
  timestamp?: string | null,
  fallback = "Not available",
) {
  if (!timestamp) {
    return fallback;
  }

  return formatExactTimestamp(timestamp) ?? fallback;
}

function formatRelativePlusAbsolute(
  timestamp?: string | null,
  fallback = "Never",
) {
  if (!timestamp) {
    return {
      value: fallback,
      description: undefined,
    };
  }

  return {
    value: formatRelativeTimestamp(timestamp),
    description: formatExactTimestamp(timestamp) ?? undefined,
  };
}

function isExpiringWithinDays(timestamp?: string | null, days = 7) {
  if (!timestamp) {
    return false;
  }

  const targetTime = new Date(timestamp).getTime();

  if (Number.isNaN(targetTime) || targetTime <= Date.now()) {
    return false;
  }

  return targetTime - Date.now() <= days * 24 * 60 * 60 * 1000;
}

function getLatestTimestamp(
  timestamps: Array<string | null | undefined>,
): string | null {
  return timestamps
    .filter((value): value is string => Boolean(value))
    .reduce<string | null>((currentLatest, value) => {
      const nextTime = new Date(value).getTime();

      if (Number.isNaN(nextTime)) {
        return currentLatest;
      }

      if (!currentLatest) {
        return value;
      }

      return nextTime > new Date(currentLatest).getTime()
        ? value
        : currentLatest;
    }, null);
}

function isLightspeedJobActive(status: string) {
  return status === "in_progress";
}

function isLightspeedJobQueued(status: string) {
  return status === "pending" || status === "delayed";
}

function formatLightspeedWebhookMode(
  mode?: "real-time" | "sync-only" | "unavailable" | null,
) {
  if (mode === "real-time") {
    return {
      label: "Real-time",
      subtitle: "Webhook delivery is active for this account",
      tone: "success" as const,
      valueClassName: "text-emerald-600",
    };
  }

  if (mode === "unavailable") {
    return {
      label: "Unavailable",
      subtitle: "Webhook API is not available for this Lightspeed account",
      tone: "neutral" as const,
      valueClassName: "text-slate-600",
    };
  }

  return {
    label: "Sync only",
    subtitle: "Connected without verified real-time webhook delivery",
    tone: "warning" as const,
    valueClassName: "text-amber-600",
  };
}

function isLightspeedConnectedStatus(status?: string | null) {
  if (!status) {
    return false;
  }

  const normalizedStatus = status.trim().toLowerCase();
  return (
    normalizedStatus === "connected" ||
    normalizedStatus === "active" ||
    normalizedStatus === "authorized"
  );
}

function looksLikeLightspeedReconnectIssue(message?: string | null) {
  if (!message) {
    return false;
  }

  return /(reauthoriz|re-authoriz|reconnect|oauth|token|credential|auth)/i.test(
    message,
  );
}

function getLightspeedPageStatus({
  connectionStatus,
  syncState,
  webhookMode,
  webhookLastError,
}: {
  connectionStatus?: string | null;
  syncState: "idle" | "triggering" | "syncing";
  webhookMode?: "real-time" | "sync-only" | "unavailable" | null;
  webhookLastError?: string | null;
}) {
  if (!isLightspeedConnectedStatus(connectionStatus)) {
    return {
      label: "Reconnect required",
      tone: "danger" as const,
      summary:
        "The stored Lightspeed connection needs repair before BloomSuite can verify sync health.",
    };
  }

  if (syncState === "triggering" || syncState === "syncing") {
    return {
      label: "Syncing",
      tone: "neutral" as const,
      summary:
        "BloomSuite is currently processing Lightspeed sync jobs for this tenant.",
    };
  }

  if (webhookLastError && webhookMode !== "unavailable") {
    return {
      label: "Attention needed",
      tone: "warning" as const,
      summary:
        "The connection is live, but webhook delivery needs operator attention.",
    };
  }

  if (webhookMode === "real-time") {
    return {
      label: "Healthy",
      tone: "success" as const,
      summary:
        "Connection, sync readiness, and webhook delivery are all in a healthy state.",
    };
  }

  if (webhookMode === "sync-only") {
    return {
      label: "Sync only",
      tone: "warning" as const,
      summary:
        "The connection is operational, but this account is not using verified real-time webhook delivery.",
    };
  }

  return {
    label: "Connected",
    tone: "neutral" as const,
    summary:
      "The Lightspeed connection is present, but some capabilities are limited by account support.",
  };
}

function formatMetaAuthorizationState(
  status?: "authorized" | "expired" | "not-connected" | null,
) {
  if (status === "authorized") {
    return {
      label: "Authorized",
      subtitle: "Meta authorization is active for connected assets",
      tone: "success" as const,
      valueClassName: "text-emerald-600",
    };
  }

  if (status === "expired") {
    return {
      label: "Reconnect required",
      subtitle: "Stored assets need Meta reauthorization before publishing",
      tone: "danger" as const,
      valueClassName: "text-rose-600",
    };
  }

  return {
    label: "Not connected",
    subtitle: "Authorize Meta to connect Facebook and Instagram assets",
    tone: "neutral" as const,
    valueClassName: "text-slate-600",
  };
}

function formatGa4ConnectionState(
  status?:
    | "connected"
    | "authorizing"
    | "error"
    | "not-connected"
    | string
    | null,
) {
  if (status === "connected") {
    return {
      label: "Connected",
      subtitle: "Property access is active for website reporting",
      tone: "success" as const,
      valueClassName: "text-emerald-600",
    };
  }

  if (status === "error") {
    return {
      label: "Reconnect required",
      subtitle: "Stored settings exist, but the connection needs review",
      tone: "danger" as const,
      valueClassName: "text-rose-600",
    };
  }

  if (status === "authorizing") {
    return {
      label: "Authorizing",
      subtitle: "Authorization is in progress",
      tone: "neutral" as const,
      valueClassName: "text-slate-600",
    };
  }

  return {
    label: "Not connected",
    subtitle:
      "Add a property ID on the Website integrations page to connect GA4",
    tone: "neutral" as const,
    valueClassName: "text-slate-600",
  };
}

type LightspeedTabValue =
  | "overview"
  | "customers"
  | "sales"
  | "products"
  | "sync-logs"
  | "connection-test";

type EmailInfrastructureTabValue = "overview" | "dns-records";

function formatCurrency(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "$0.00";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDateValue(
  timestamp?: string | null,
  fallback = "Not available",
) {
  if (!timestamp) {
    return fallback;
  }

  return formatExactTimestamp(timestamp) ?? fallback;
}

function MetaAssetList({
  assets,
  emptyMessage,
  onCopy,
  onOpen,
}: {
  assets: Array<{
    id: string;
    name: string;
    externalId: string | null;
    secondaryLabel: string;
    connectedAt: string | null;
    lastActivityAt: string | null;
    active: boolean;
    platform: "facebook" | "instagram";
  }>;
  emptyMessage: string;
  onCopy: (value: string | null | undefined, label: string) => void;
  onOpen: () => void;
}) {
  if (assets.length === 0) {
    return (
      <p className="ml-4 mt-1 text-xs italic text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="divide-y divide-gray-50">
      {assets.map((asset) => (
        <div
          key={asset.id}
          className="flex items-center justify-between gap-4 py-3"
        >
          <button
            type="button"
            onClick={onOpen}
            className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
          >
            <div
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                asset.platform === "facebook" ? "bg-blue-50" : "bg-rose-50",
              )}
            >
              {asset.platform === "facebook" ? (
                <Facebook className="h-4 w-4 text-[#1877F2]" />
              ) : (
                <Instagram className="h-4 w-4 text-[#E4405F]" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                {asset.name}
              </p>
              <p className="text-xs font-mono text-muted-foreground">
                {asset.externalId ?? "—"}
              </p>
            </div>
          </button>
          <div className="flex shrink-0 items-center gap-2">
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                asset.active ? "bg-emerald-500" : "bg-gray-300",
              )}
            />
            <span
              className={cn(
                "text-xs",
                asset.active ? "text-emerald-700" : "text-muted-foreground",
              )}
            >
              {asset.active ? "Active" : "Inactive"}
            </span>
            {asset.externalId ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onCopy(asset.externalId, "Asset ID")}
                className="h-7 px-2 text-xs"
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function IntegrationDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [lightspeedResetOpen, setLightspeedResetOpen] = useState(false);
  const [shopifyDialogOpen, setShopifyDialogOpen] = useState(false);
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null);
  const [lightspeedTab, setLightspeedTab] =
    useState<LightspeedTabValue>("overview");
  const [emailInfrastructureTab, setEmailInfrastructureTab] =
    useState<EmailInfrastructureTabValue>("overview");
  const [customerSearchInput, setCustomerSearchInput] = useState("");
  const [customerPage, setCustomerPage] = useState(1);
  const [customerSortField, setCustomerSortField] =
    useState<LightspeedCustomerSortField>("last_purchase_date");
  const [customerSortDirection, setCustomerSortDirection] =
    useState<LightspeedSortDirection>("desc");
  const [selectedCustomer, setSelectedCustomer] =
    useState<LightspeedCustomerTableRow | null>(null);
  const [squareCustomerSortField, setSquareCustomerSortField] =
    useState<SquareCustomerSortField>("updated_at");
  const [selectedSquareCustomer, setSelectedSquareCustomer] =
    useState<SquareCustomerTableRow | null>(null);
  const [selectedCloverCustomer, setSelectedCloverCustomer] =
    useState<CloverCustomerTableRow | null>(null);
  const [salesSearchInput, setSalesSearchInput] = useState("");
  const [salesPage, setSalesPage] = useState(1);
  const [salesStatus, setSalesStatus] = useState("all");
  const [salesStartDate, setSalesStartDate] = useState("");
  const [salesEndDate, setSalesEndDate] = useState("");
  const [salesSortField, setSalesSortField] =
    useState<LightspeedSalesSortField>("sale_date");
  const [salesSortDirection, setSalesSortDirection] =
    useState<LightspeedSortDirection>("desc");
  const [selectedSale, setSelectedSale] = useState<LightspeedSaleRow | null>(
    null,
  );
  const [squareSalesSortField, setSquareSalesSortField] =
    useState<SquareSalesSortField>("order_date");
  const [selectedSquareSale, setSelectedSquareSale] =
    useState<SquareSaleRow | null>(null);
  const [selectedCloverSale, setSelectedCloverSale] =
    useState<CloverSaleRow | null>(null);
  const [productsSearchInput, setProductsSearchInput] = useState("");
  const [productsPage, setProductsPage] = useState(1);
  const [productsCategories, setProductsCategories] = useState<string[]>([]);
  const [productsInStockOnly, setProductsInStockOnly] = useState(false);
  const [productsSortField, setProductsSortField] =
    useState<LightspeedProductsSortField>("name");
  const [productsSortDirection, setProductsSortDirection] =
    useState<LightspeedSortDirection>("asc");
  const [squareProductsSortField, setSquareProductsSortField] =
    useState<SquareProductsSortField>("name");
  const [shopifyCustomerSortField, setShopifyCustomerSortField] =
    useState<ShopifyCustomerSortField>("last_order_date");
  const [shopifyOrdersSortField, setShopifyOrdersSortField] =
    useState<ShopifyOrdersSortField>("order_date");
  const [shopifyProductsSortField, setShopifyProductsSortField] =
    useState<ShopifyProductsSortField>("updated_at");
  const [syncLogsPage, setSyncLogsPage] = useState(1);
  const [syncLogsStatus, setSyncLogsStatus] = useState("all");
  const [mailchimpConnectDialogOpen, setMailchimpConnectDialogOpen] =
    useState(false);
  const [mailchimpImportDialogOpen, setMailchimpImportDialogOpen] =
    useState(false);
  const [mailchimpImportDialogMode, setMailchimpImportDialogMode] = useState<
    "import" | "preview"
  >("import");
  const [trackedMailchimpImportJobId, setTrackedMailchimpImportJobId] =
    useState<string | null>(null);
  const [dismissedMailchimpImportJobIds, setDismissedMailchimpImportJobIds] =
    useState<string[]>([]);
  const deferredCustomerSearch = useDebouncedValue(
    customerSearchInput.trim(),
    300,
  );
  const deferredSalesSearch = useDebouncedValue(salesSearchInput.trim(), 300);
  const deferredProductsSearch = useDebouncedValue(
    productsSearchInput.trim(),
    300,
  );
  const detail = useIntegrationDetailData(
    slug,
    slug === "lightspeed"
      ? {
          customers: {
            page: customerPage,
            search: deferredCustomerSearch,
            sortField: customerSortField,
            sortDirection: customerSortDirection,
          },
          sales: {
            page: salesPage,
            search: deferredSalesSearch,
            status: salesStatus,
            startDate: salesStartDate || null,
            endDate: salesEndDate || null,
            sortField: salesSortField,
            sortDirection: salesSortDirection,
          },
          products: {
            page: productsPage,
            search: deferredProductsSearch,
            categories: productsCategories,
            inStockOnly: productsInStockOnly,
            sortField: productsSortField,
            sortDirection: productsSortDirection,
          },
          syncLogs: {
            page: syncLogsPage,
            status: syncLogsStatus,
          },
        }
      : slug === "square"
        ? {
            customers: {
              page: customerPage,
              search: deferredCustomerSearch,
              sortField: squareCustomerSortField,
              sortDirection: customerSortDirection,
            },
            sales: {
              page: salesPage,
              search: deferredSalesSearch,
              status: salesStatus,
              startDate: salesStartDate || null,
              endDate: salesEndDate || null,
              sortField: squareSalesSortField,
              sortDirection: salesSortDirection,
            },
            products: {
              page: productsPage,
              search: deferredProductsSearch,
              categories: productsCategories,
              inStockOnly: productsInStockOnly,
              sortField: squareProductsSortField,
              sortDirection: productsSortDirection,
            },
            syncLogs: {
              page: syncLogsPage,
              status: syncLogsStatus,
            },
          }
        : slug === "clover"
          ? {
              customers: {
                page: customerPage,
                search: deferredCustomerSearch,
                sortField: squareCustomerSortField,
                sortDirection: customerSortDirection,
              },
              sales: {
                page: salesPage,
                search: deferredSalesSearch,
                status: salesStatus,
                startDate: salesStartDate || null,
                endDate: salesEndDate || null,
                sortField: squareSalesSortField,
                sortDirection: salesSortDirection,
              },
              products: {
                page: productsPage,
                search: deferredProductsSearch,
                categories: productsCategories,
                inStockOnly: productsInStockOnly,
                sortField: squareProductsSortField,
                sortDirection: productsSortDirection,
              },
              syncLogs: {
                page: syncLogsPage,
                status: syncLogsStatus,
              },
            }
          : slug === "shopify"
            ? {
                customers: {
                  page: customerPage,
                  search: deferredCustomerSearch,
                  sortField: shopifyCustomerSortField,
                  sortDirection: customerSortDirection,
                },
                sales: {
                  page: salesPage,
                  search: deferredSalesSearch,
                  status: salesStatus,
                  startDate: salesStartDate || null,
                  endDate: salesEndDate || null,
                  sortField: shopifyOrdersSortField,
                  sortDirection: salesSortDirection,
                },
                products: {
                  page: productsPage,
                  search: deferredProductsSearch,
                  categories: productsCategories,
                  inStockOnly: productsInStockOnly,
                  sortField: shopifyProductsSortField,
                  sortDirection: productsSortDirection,
                },
                syncLogs: {
                  page: syncLogsPage,
                  status: syncLogsStatus,
                },
              }
            : undefined,
  );

  const seed = useMemo(() => (slug ? getIntegrationSeed(slug) : null), [slug]);
  const isMailchimpPage = slug === "mailchimp";
  const marketingImportDetail = detail.marketingImportDetail;
  const mailchimpImportProgress = useMailchimpImportProgress(
    trackedMailchimpImportJobId,
    { enabled: isMailchimpPage },
  );

  useEffect(() => {
    if (!isMailchimpPage || !marketingImportDetail?.runningImportId) {
      return;
    }

    setTrackedMailchimpImportJobId((current) =>
      current === marketingImportDetail.runningImportId
        ? current
        : marketingImportDetail.runningImportId,
    );
  }, [isMailchimpPage, marketingImportDetail?.runningImportId]);

  const handleMailchimpConnected = useCallback(async () => {
    const result = await detail.refetch();

    return (
      result.data?.marketingImportDetail?.accountName ??
      marketingImportDetail?.accountName ??
      null
    );
  }, [detail.refetch, marketingImportDetail?.accountName]);
  const handleMailchimpImportFlowUpdated = useCallback(
    async (jobId?: string | null) => {
      if (jobId) {
        setTrackedMailchimpImportJobId(jobId);
        setDismissedMailchimpImportJobIds((current) =>
          current.filter((value) => value !== jobId),
        );
      }

      await detail.refetch();
    },
    [detail.refetch],
  );
  const handleDismissMailchimpProgressCard = useCallback((jobId: string) => {
    setDismissedMailchimpImportJobIds((current) =>
      current.includes(jobId) ? current : [...current, jobId],
    );
  }, []);
  const handleOpenMailchimpImportDialog = useCallback(() => {
    setMailchimpImportDialogMode("import");
    setMailchimpImportDialogOpen(true);
  }, []);
  const shouldHideDismissedMailchimpImportCard =
    Boolean(mailchimpImportProgress.jobId) &&
    dismissedMailchimpImportJobIds.includes(mailchimpImportProgress.jobId);

  if (!seed || !detail.isValidSlug) {
    return <NotFound />;
  }

  if (detail.isLoading) {
    return <LoadingShell />;
  }

  if (!detail.item || !detail.model) {
    return <NotFound />;
  }

  const item = detail.item;
  const model = detail.model;
  const Icon = item.icon;
  const isSquare = item.slug === "square";
  const isClover = item.slug === "clover";
  const isLightspeed = item.slug === "lightspeed";
  const isShopify = item.slug === "shopify";
  const isMeta = item.slug === "meta";
  const isGa4 = item.slug === "google-analytics";
  const isEmailInfrastructure = item.slug === "email-infrastructure";
  const isMarketingImport =
    item.slug === "mailchimp" ||
    item.slug === "klaviyo" ||
    item.slug === "constant-contact";
  const shopifyConnection = detail.shopifyConnection;
  const shopifyDashboard = detail.shopifyDashboard;
  const squareDetail = detail.squareDetail;
  const squareDashboard = detail.squareDashboard;
  const cloverDetail = detail.cloverDetail;
  const cloverDashboard = detail.cloverDashboard;
  const lightspeedDetail = detail.lightspeedDetail;
  const lightspeedDashboard = detail.lightspeedDashboard;
  const metaDetail = detail.metaDetail;
  const ga4Detail = detail.ga4Detail;
  const emailInfrastructureDetail = detail.emailInfrastructureDetail;
  const comingSoonDetail = detail.comingSoonDetail;
  const isComingSoonPage = Boolean(comingSoonDetail);

  if (item.slug === "mailchimp" && marketingImportDetail) {
    return (
      <>
        <MailchimpIntegrationShell
          item={item}
          marketingImportDetail={marketingImportDetail}
          importProgress={
            shouldHideDismissedMailchimpImportCard
              ? null
              : mailchimpImportProgress
          }
          canDisconnect={detail.canDisconnect}
          isDisconnecting={detail.isDisconnecting}
          onDisconnect={detail.disconnect}
          onOpenConnectDialog={() => setMailchimpConnectDialogOpen(true)}
          onOpenImportDialog={handleOpenMailchimpImportDialog}
          onOpenPreviewDialog={() => {
            setMailchimpImportDialogMode("preview");
            setMailchimpImportDialogOpen(true);
          }}
          onDismissImportStatusCard={handleDismissMailchimpProgressCard}
        />
        <ConnectMailchimpDialog
          open={mailchimpConnectDialogOpen}
          onOpenChange={setMailchimpConnectDialogOpen}
          onConnected={handleMailchimpConnected}
        />
        {mailchimpImportDialogOpen ? (
          <MailchimpImportOnboardingDialog
            open={mailchimpImportDialogOpen}
            mode={mailchimpImportDialogMode}
            marketingImportDetail={marketingImportDetail}
            onOpenChange={setMailchimpImportDialogOpen}
            onOpenConnectDialog={() => setMailchimpConnectDialogOpen(true)}
            onStateChanged={handleMailchimpImportFlowUpdated}
          />
        ) : null}
      </>
    );
  }

  const shopifyAdminUrl = getShopifyAdminUrl(
    shopifyConnection?.shop_domain ?? null,
  );
  const lightspeedWebhookMode = formatLightspeedWebhookMode(
    lightspeedDetail?.webhookMode,
  );
  const lightspeedCustomersCount = getEffectiveImportedCount(
    lightspeedDetail?.customersSynced,
    lightspeedDashboard?.customers.pagination.totalCount,
  );
  const lightspeedSalesCount = getEffectiveImportedCount(
    lightspeedDetail?.salesSynced,
    lightspeedDashboard?.sales.pagination.totalCount,
  );
  const lightspeedProductsCount = getEffectiveImportedCount(
    lightspeedDetail?.productsSynced,
    lightspeedDashboard?.products.pagination.totalCount,
  );
  const metaAuthorizationState = formatMetaAuthorizationState(
    metaDetail?.authorizationStatus,
  );
  const ga4ConnectionState = formatGa4ConnectionState(
    ga4Detail?.connectionStatus,
  );
  const lightspeedSyncLogRows = lightspeedDashboard?.syncLogs.rows ?? [];
  const lightspeedConnectionHealthy = isLightspeedConnectedStatus(
    lightspeedDetail?.connectionStatus ?? item.status,
  );
  const squareConnectionHealthy = isLightspeedConnectedStatus(
    squareDetail?.connectionStatus ?? item.status,
  );
  const squareNeedsWebhookAttention =
    isSquare &&
    Boolean(squareDetail) &&
    Boolean(squareDetail?.webhookLastError) &&
    ((squareDetail?.webhookRetryCount ?? 0) > 0 ||
      !squareDetail?.webhooksSubscribed);
  const squarePageStatus =
    isSquare && squareDetail
      ? !squareConnectionHealthy
        ? {
            label: "Reconnect required",
            tone: "danger" as const,
            summary:
              "The stored Square connection needs attention before sync and webhook health can be trusted.",
          }
        : detail.isSquareSyncing
          ? {
              label: "Syncing",
              tone: "neutral" as const,
              summary:
                "BloomSuite is currently running a Square sync for this tenant.",
            }
          : squareNeedsWebhookAttention
            ? {
                label: "Attention needed",
                tone: "warning" as const,
                summary:
                  "The Square connection is live, but webhook delivery or verification needs operator review.",
              }
            : {
                label: "Healthy",
                tone: "success" as const,
                summary:
                  "Connection, sync readiness, and Square webhook coverage are in a healthy state.",
              }
      : null;
  const squareStatusBanner =
    isSquare && squareDetail && squareNeedsWebhookAttention
      ? {
          tone: "warning" as const,
          title: "Verify Square webhook coverage",
          description: getUserFacingIntegrationError(
            squareDetail.webhookLastError,
            "BloomSuite needs to verify the current Square webhook subscription before relying on real-time event delivery.",
          ),
          actionLabel: detail.isVerifyingSquareWebhooks
            ? "Verifying..."
            : "Verify now",
          onAction: () => {
            void detail.verifySquareWebhooks();
          },
        }
      : null;
  const shopifyNeedsWebhookAttention =
    isShopify &&
    Boolean(shopifyConnection) &&
    (Boolean(shopifyConnection?.webhook_last_error) ||
      !shopifyConnection?.webhooks_subscribed);
  const shopifyLatestActivityAt = getLatestTimestamp([
    shopifyConnection?.last_webhook_received_at,
    shopifyConnection?.last_synced_at,
    shopifyConnection?.updated_at,
  ]);
  const shopifyAppUninstalled = /app was uninstalled/i.test(
    shopifyConnection?.webhook_last_error ?? "",
  );
  const shopifyConnected = shopifyConnection?.status === "connected";
  const shopifyScopeCount = (shopifyConnection?.scope ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean).length;
  const shopifyPageStatus =
    isShopify && shopifyConnection
      ? shopifyAppUninstalled
        ? {
            label: "App uninstalled",
            tone: "danger" as const,
            summary:
              "The Shopify app was removed from the store. Reinstall it to restore sync, webhook delivery, and automation intake.",
          }
        : !shopifyConnected
          ? {
              label: "Reconnect required",
              tone: "danger" as const,
              summary:
                "BloomSuite still has a Shopify store record for this tenant, but the active OAuth credentials are no longer available.",
            }
          : shopifyNeedsWebhookAttention
            ? {
                label: "Webhooks only",
                tone: "warning" as const,
                summary:
                  "The Shopify store is connected, but webhook coverage needs review before BloomSuite can trust real-time event delivery.",
              }
            : {
                label: "Healthy",
                tone: "success" as const,
                summary:
                  "Connection, sync readiness, and Shopify webhook coverage are healthy for this store.",
              }
      : null;
  const shopifyStatusBanner =
    isShopify && shopifyConnection
      ? shopifyAppUninstalled
        ? {
            tone: "danger" as const,
            title: "Shopify app was uninstalled",
            description:
              "Reinstall the BloomSuite Shopify app to restore credentials, webhook subscriptions, and queue-backed sync jobs for this store.",
            actionLabel: "Reinstall App",
            onAction: () => setShopifyDialogOpen(true),
          }
        : !shopifyConnected
          ? {
              tone: "danger" as const,
              title: "Reconnect Shopify",
              description:
                "This store record is still available, but BloomSuite needs a fresh OAuth install to restore token-based access.",
              actionLabel: "Reconnect",
              onAction: () => setShopifyDialogOpen(true),
            }
          : shopifyNeedsWebhookAttention
            ? {
                tone: "warning" as const,
                title: "Verify Shopify webhook coverage",
                description: getUserFacingIntegrationError(
                  shopifyConnection.webhook_last_error,
                  "BloomSuite needs to verify the current Shopify webhook subscriptions before relying on real-time order, customer, and product events.",
                ),
                actionLabel: detail.isVerifyingShopifyWebhooks
                  ? "Verifying..."
                  : "Verify Webhooks",
                onAction: () => {
                  void detail.verifyShopifyWebhooks();
                },
              }
            : null
      : null;
  const squarePrimaryAction =
    isSquare && squareDetail
      ? {
          label: detail.isSquareSyncing ? "Syncing..." : "Sync Now",
          disabled: !squareConnectionHealthy || detail.isSquareSyncing,
          onClick: () => {
            void detail.triggerSquareSync();
          },
        }
      : null;
  const squareTabItems =
    isSquare && squareDetail
      ? [
          { value: "overview" as const, label: "Overview" },
          {
            value: "customers" as const,
            label: "Customers",
            count: squareDetail.customersSynced ?? 0,
          },
          {
            value: "sales" as const,
            label: "Sales",
            count: squareDetail.salesSynced ?? 0,
          },
          {
            value: "products" as const,
            label: "Products",
            count: squareDetail.productsSynced ?? 0,
          },
          {
            value: "sync-logs" as const,
            label: "Sync Logs",
            isActive: detail.isSquareSyncing,
          },
        ]
      : [];
  const shopifyTabItems =
    isShopify && shopifyConnection
      ? [
          { value: "overview" as const, label: "Overview" },
          {
            value: "customers" as const,
            label: "Customers",
            count: shopifyConnection.customers_synced ?? 0,
          },
          {
            value: "sales" as const,
            label: "Orders",
            count: shopifyConnection.sales_synced ?? 0,
          },
          {
            value: "products" as const,
            label: "Products",
            count: shopifyConnection.products_synced ?? 0,
          },
          {
            value: "sync-logs" as const,
            label: "Sync Logs",
            isActive: detail.isShopifySyncing,
          },
        ]
      : [];
  const squareHeaderActions =
    isSquare && squareDetail
      ? [
          {
            id: "square-actions",
            items: [
              {
                label: detail.isFetching ? "Refreshing…" : "Refresh status",
                icon: RefreshCcw,
                disabled: detail.isFetching,
                onSelect: () => {
                  void detail.refetch();
                },
              },
              {
                label: detail.isVerifyingSquareWebhooks
                  ? "Verifying webhooks…"
                  : "Verify webhooks",
                icon: Webhook,
                disabled:
                  item.status !== "connected" ||
                  detail.isVerifyingSquareWebhooks,
                onSelect: () => {
                  void detail.verifySquareWebhooks();
                },
              },
              {
                label: "View sync logs",
                icon: Activity,
                onSelect: () => navigate(squareDetail.syncLogsPath),
              },
              {
                label: "View automation logs",
                icon: Bot,
                onSelect: () => navigate(squareDetail.automationLogsPath),
              },
              {
                label: "Disconnect Square",
                icon: ShieldAlert,
                disabled: !detail.canDisconnect,
                onSelect: () => setDisconnectOpen(true),
              },
            ],
          },
        ]
      : [];
  const squareLatestActivityAt = getLatestTimestamp([
    squareDetail?.lastWebhookReceivedAt,
    squareDetail?.lastCustomerSync,
    squareDetail?.lastSalesSync,
    squareDetail?.lastProductSync,
    squareDetail?.lastSyncedAt,
    squareDetail?.connectedAt,
  ]);
  const cloverConnectionHealthy = isLightspeedConnectedStatus(
    cloverDetail?.connectionStatus ?? item.status,
  );
  const cloverRealtimeEnabled = Boolean(
    cloverDetail?.appIdConfigured && cloverDetail?.webhooksSubscribed,
  );
  const cloverNeedsWebhookSetup =
    isClover &&
    Boolean(cloverDetail) &&
    cloverConnectionHealthy &&
    !cloverRealtimeEnabled;
  const cloverHasWebhookIssue =
    isClover &&
    Boolean(cloverDetail) &&
    cloverConnectionHealthy &&
    Boolean(cloverDetail?.webhookLastError);
  const cloverPageStatus =
    isClover && cloverDetail
      ? !cloverConnectionHealthy
        ? {
            label: "Reconnect required",
            tone: "danger" as const,
            summary:
              "The stored Clover connection needs repair before BloomSuite can trust sync or app-level event delivery.",
          }
        : cloverNeedsWebhookSetup
          ? {
              label: "Sync only",
              tone: "warning" as const,
              summary:
                "BloomSuite can sync Clover data for this merchant, but real-time events remain app-level and are not fully configured yet.",
            }
          : {
              label: "Connected",
              tone: "success" as const,
              summary:
                "The Clover connection is active and BloomSuite has the required app-level webhook prerequisites for real-time event intake.",
            }
      : null;
  const cloverStatusBanner =
    isClover && cloverDetail
      ? !cloverConnectionHealthy
        ? {
            tone: "danger" as const,
            title: "Reconnect Clover to resume sync health checks",
            description:
              "The stored Clover authorization is no longer in a usable state. Reconnect the integration before relying on sync or real-time status.",
            actionLabel: "Reconnect",
            onAction: () => {
              if (detail.targetPath) {
                navigate(detail.targetPath);
              }
            },
          }
        : cloverHasWebhookIssue
          ? {
              tone: "warning" as const,
              title: "Clover webhook health needs review",
              description: getUserFacingIntegrationError(
                cloverDetail.webhookLastError,
                "BloomSuite is seeing an issue with Clover app-level webhook traffic. Review the latest delivery status and connection diagnostics.",
              ),
              actionLabel: detail.isCloverConnectionTesting
                ? "Running test..."
                : "Run connection test",
              onAction: () => {
                void detail.runCloverConnectionTest();
              },
            }
          : cloverNeedsWebhookSetup
            ? {
                tone: "warning" as const,
                title: "Configure app-level Clover webhooks for real-time mode",
                description:
                  "Clover webhook provisioning is handled at the app level, not per merchant. Until the app ID and event flow are in place, this merchant stays in sync-only mode.",
                actionLabel: detail.targetPath
                  ? "Configure webhooks"
                  : undefined,
                onAction: () => {
                  if (detail.targetPath) {
                    navigate(detail.targetPath);
                  }
                },
              }
            : null
      : null;
  const cloverPrimaryAction =
    isClover && cloverDetail
      ? !cloverConnectionHealthy
        ? {
            label: "Reconnect",
            disabled: !detail.targetPath,
            onClick: () => {
              if (detail.targetPath) {
                navigate(detail.targetPath);
              }
            },
          }
        : cloverNeedsWebhookSetup
          ? {
              label: "Configure Webhooks",
              disabled: !detail.targetPath,
              onClick: () => {
                if (detail.targetPath) {
                  navigate(detail.targetPath);
                }
              },
            }
          : {
              label: detail.isCloverSyncing ? "Syncing..." : "Sync Now",
              disabled: detail.isCloverSyncing,
              onClick: () => {
                void detail.triggerCloverSync();
              },
            }
      : null;
  const cloverTabItems =
    isClover && cloverDetail
      ? [
          { value: "overview" as const, label: "Overview" },
          {
            value: "customers" as const,
            label: "Customers",
            count: cloverDetail.customersSynced ?? 0,
          },
          {
            value: "sales" as const,
            label: "Sales",
            count: cloverDetail.salesSynced ?? 0,
          },
          {
            value: "products" as const,
            label: "Products",
            count: cloverDetail.productsSynced ?? 0,
          },
          {
            value: "sync-logs" as const,
            label: "Sync Logs",
            isActive: detail.isCloverSyncing,
          },
          {
            value: "connection-test" as const,
            label: "Connection Test",
            isActive: detail.isCloverConnectionTesting,
          },
        ]
      : [];
  const cloverHeaderActions =
    isClover && cloverDetail
      ? [
          {
            id: "clover-actions",
            items: [
              {
                label: detail.isFetching ? "Refreshing…" : "Refresh status",
                icon: RefreshCcw,
                disabled: detail.isFetching,
                onSelect: () => {
                  void detail.refetch();
                },
              },
              {
                label: detail.isCloverSyncing
                  ? "Syncing…"
                  : "Trigger manual sync",
                icon: RefreshCcw,
                disabled: !cloverConnectionHealthy || detail.isCloverSyncing,
                onSelect: () => {
                  void detail.triggerCloverSync();
                },
              },
              {
                label: detail.isCloverConnectionTesting
                  ? "Running connection test…"
                  : "Run connection test",
                icon: FlaskConical,
                disabled:
                  !cloverConnectionHealthy || detail.isCloverConnectionTesting,
                onSelect: () => {
                  void detail.runCloverConnectionTest();
                },
              },
              {
                label: "View sync logs",
                icon: Activity,
                onSelect: () => navigate(cloverDetail.syncLogsPath),
              },
              {
                label: "View automation logs",
                icon: Bot,
                onSelect: () => navigate(cloverDetail.automationLogsPath),
              },
              {
                label: "Disconnect Clover",
                icon: ShieldAlert,
                disabled: !detail.canDisconnect,
                onSelect: () => setDisconnectOpen(true),
              },
            ],
          },
        ]
      : [];
  const cloverLatestActivityAt = getLatestTimestamp([
    cloverDetail?.lastWebhookReceivedAt,
    cloverDetail?.lastCustomerSync,
    cloverDetail?.lastSalesSync,
    cloverDetail?.lastProductSync,
    cloverDetail?.lastSyncedAt,
    cloverDetail?.lastTestedAt,
    cloverDetail?.connectedAt,
  ]);
  const lightspeedRecentFailureCount = (() => {
    let count = 0;

    for (const row of lightspeedSyncLogRows) {
      if (row.status === "failed" || row.status === "cancelled") {
        count += 1;
        continue;
      }

      break;
    }

    return count;
  })();
  const lightspeedRecentSuccessCount = lightspeedSyncLogRows.filter(
    (row) => row.status === "completed",
  ).length;
  const lightspeedLatestFailedLog = lightspeedSyncLogRows.find(
    (row) => row.status === "failed" || row.status === "cancelled",
  );
  const lightspeedNeedsReconnect =
    isLightspeed &&
    Boolean(lightspeedDetail) &&
    (!lightspeedConnectionHealthy ||
      looksLikeLightspeedReconnectIssue(lightspeedDetail?.webhookLastError));
  const lightspeedHasWebhookIssue =
    isLightspeed &&
    Boolean(lightspeedDetail) &&
    !lightspeedNeedsReconnect &&
    lightspeedDetail?.webhookMode !== "unavailable" &&
    Boolean(lightspeedDetail?.webhookLastError) &&
    ((lightspeedDetail?.webhookRetryCount ?? 0) >= 3 ||
      Boolean(lightspeedDetail?.webhookNextRetryAt));
  const lightspeedPageStatus = getLightspeedPageStatus({
    connectionStatus: lightspeedDetail?.connectionStatus ?? item.status,
    syncState: detail.lightspeedSyncState,
    webhookMode: lightspeedDetail?.webhookMode,
    webhookLastError: lightspeedDetail?.webhookLastError,
  });
  const lightspeedStatusBanner =
    isLightspeed && lightspeedDetail
      ? lightspeedNeedsReconnect
        ? {
            tone: "danger" as const,
            title: "Reconnect Lightspeed to restore sync access",
            description: getUserFacingIntegrationError(
              lightspeedDetail.webhookLastError,
              "The stored Lightspeed authorization is no longer in a usable state. Reconnect the integration to resume verification and sync operations.",
            ),
            actionLabel: "Reconnect",
            onAction: () => {
              if (detail.targetPath) {
                navigate(detail.targetPath);
              }
            },
          }
        : lightspeedHasWebhookIssue
          ? {
              tone: "warning" as const,
              title: "Webhook delivery needs attention",
              description: getUserFacingIntegrationError(
                lightspeedDetail.webhookLastError,
                "BloomSuite is seeing repeated webhook delivery problems for this Lightspeed account. Run diagnostics to confirm the current delivery state.",
              ),
              ...(detail.canAccessLightspeedAdminFeatures
                ? {
                    actionLabel: "Run diagnostics",
                    onAction: () => navigate(lightspeedDetail.diagnosticsPath),
                  }
                : {}),
            }
          : lightspeedRecentFailureCount >= 2
            ? {
                tone: "warning" as const,
                title: `${lightspeedRecentFailureCount} recent sync jobs failed`,
                description: getUserFacingIntegrationError(
                  lightspeedLatestFailedLog?.last_error,
                  "Recent Lightspeed sync jobs have failed. Review the latest sync logs before retrying.",
                ),
                actionLabel: "View sync logs",
                onAction: () => navigate(lightspeedDetail.syncLogsPath),
              }
            : model.errorBanner
              ? {
                  tone: "warning" as const,
                  title: model.errorBanner.title,
                  description: model.errorBanner.description,
                }
              : null
      : null;
  const lightspeedPrimaryAction =
    isLightspeed && lightspeedDetail
      ? lightspeedNeedsReconnect
        ? {
            label: "Reconnect",
            disabled: !detail.targetPath,
            onClick: () => {
              if (detail.targetPath) {
                navigate(detail.targetPath);
              }
            },
          }
        : {
            label:
              detail.lightspeedSyncState === "triggering"
                ? "Starting sync..."
                : detail.lightspeedSyncState === "syncing"
                  ? "Syncing..."
                  : "Sync Now",
            disabled:
              !lightspeedConnectionHealthy ||
              detail.lightspeedSyncState !== "idle",
            onClick: () => {
              void detail.triggerLightspeedSync();
            },
          }
      : null;
  const lightspeedTabItems =
    isLightspeed && lightspeedDetail
      ? [
          { value: "overview" as const, label: "Overview" },
          {
            value: "customers" as const,
            label: "Customers",
            count: lightspeedCustomersCount,
          },
          {
            value: "sales" as const,
            label: "Sales",
            count: lightspeedSalesCount,
          },
          {
            value: "products" as const,
            label: "Products",
            count: lightspeedProductsCount,
          },
          {
            value: "sync-logs" as const,
            label: "Sync Logs",
            isActive:
              detail.lightspeedSyncState !== "idle" ||
              detail.lightspeedActiveJobIds.length > 0,
          },
        ]
      : [];
  const lightspeedHeaderActions =
    isLightspeed && lightspeedDetail
      ? [
          {
            id: "lightspeed-actions",
            items: [
              {
                label: detail.isFetching ? "Refreshing…" : "Refresh status",
                icon: RefreshCcw,
                disabled: detail.isFetching,
                onSelect: () => {
                  void detail.refetch();
                },
              },
              ...(detail.canAccessLightspeedAdminFeatures
                ? [
                    {
                      label: "Run diagnostics",
                      icon: FlaskConical,
                      onSelect: () =>
                        navigate(lightspeedDetail.diagnosticsPath),
                    },
                  ]
                : []),
              {
                label: "View sync logs",
                icon: Activity,
                onSelect: () => navigate(lightspeedDetail.syncLogsPath),
              },
              {
                label: "Open store URL",
                icon: ExternalLink,
                disabled: !lightspeedDetail.storeUrl,
                onSelect: () => {
                  if (lightspeedDetail.storeUrl) {
                    window.open(
                      lightspeedDetail.storeUrl,
                      "_blank",
                      "noopener,noreferrer",
                    );
                  }
                },
              },
              ...(detail.canAccessLightspeedAdminFeatures
                ? [
                    {
                      label: "Disconnect Lightspeed",
                      icon: ShieldAlert,
                      disabled: !detail.canDisconnect,
                      onSelect: () => setDisconnectOpen(true),
                    },
                  ]
                : []),
            ],
          },
        ]
      : [];
  const lightspeedSanitizedWebhookError = lightspeedDetail?.webhookLastError
    ? getUserFacingIntegrationError(
        lightspeedDetail.webhookLastError,
        "BloomSuite needs operator attention to keep Lightspeed webhook delivery healthy.",
      )
    : null;
  const lightspeedLatestSyncFailureMessage =
    lightspeedLatestFailedLog?.last_error
      ? getUserFacingIntegrationError(
          lightspeedLatestFailedLog.last_error,
          "Recent Lightspeed sync work needs attention before the next retry.",
        )
      : null;
  const lightspeedLatestSuccessfulActivityAt = getLatestTimestamp([
    lightspeedDetail?.lastWebhookReceivedAt,
    lightspeedDetail?.lastCustomerSync,
    lightspeedDetail?.lastSalesSync,
    lightspeedDetail?.lastProductSync,
    lightspeedDetail?.lastSyncedAt,
    lightspeedDetail?.connectedAt,
  ]);
  const lightspeedActiveSyncJobs = detail.lightspeedSyncJobs.filter(
    (job) => isLightspeedJobActive(job.status) && !job.isStale,
  );
  const lightspeedQueuedSyncJobs = detail.lightspeedSyncJobs.filter((job) =>
    isLightspeedJobQueued(job.status),
  );
  const lightspeedStaleSyncJobs = detail.lightspeedSyncJobs.filter(
    (job) => job.isStale,
  );
  const latestLightspeedSyncLog =
    detail.lightspeedDashboard?.syncLogs.rows[0] ?? null;
  const lightspeedLatestSyncWasEmpty =
    latestLightspeedSyncLog?.status === "completed" &&
    Math.max(
      latestLightspeedSyncLog.fetched_rows ?? 0,
      latestLightspeedSyncLog.inserted_rows ?? 0,
      latestLightspeedSyncLog.processed_rows ?? 0,
    ) === 0;
  const lightspeedIdleQueueDescription = detail.lightspeedHasStaleJobs
    ? `${lightspeedStaleSyncJobs.length} stalled job${lightspeedStaleSyncJobs.length === 1 ? "" : "s"}. No records are currently being fetched.`
    : lightspeedQueuedSyncJobs.length > 0
      ? `${lightspeedQueuedSyncJobs.length} queued job${lightspeedQueuedSyncJobs.length === 1 ? "" : "s"} waiting to start or retry. No records are currently being fetched.`
      : lightspeedLatestSyncWasEmpty
        ? "No active Lightspeed sync jobs. The latest sync did not find any new records."
        : "No active Lightspeed sync jobs.";
  const hasActiveLightspeedSyncType = (
    syncType: "customers" | "sales" | "products",
  ) =>
    lightspeedActiveSyncJobs.some(
      (job) =>
        job.normalizedSyncType === syncType ||
        job.normalizedSyncType === "full",
    );
  const canResetLightspeedSyncedData =
    detail.canAccessLightspeedAdminFeatures &&
    detail.lightspeedSyncState === "idle" &&
    lightspeedActiveSyncJobs.length === 0 &&
    !detail.isResettingLightspeedData;
  const lightspeedSyncHealth = lightspeedNeedsReconnect
    ? {
        value: "Reconnect required",
        tone: "danger" as const,
        description:
          "The stored authorization must be repaired before sync health can be trusted.",
      }
    : detail.lightspeedSyncState === "triggering" ||
        detail.lightspeedSyncState === "syncing"
      ? {
          value: "Syncing",
          tone: "neutral" as const,
          description:
            lightspeedActiveSyncJobs.length > 0
              ? `${lightspeedActiveSyncJobs.length} active job${lightspeedActiveSyncJobs.length === 1 ? "" : "s"} currently fetching records.`
              : "Queue records are being created now.",
        }
      : detail.lightspeedHasStaleJobs
        ? {
            value: "Stalled",
            tone: "warning" as const,
            description: lightspeedIdleQueueDescription,
          }
        : lightspeedQueuedSyncJobs.length > 0
          ? {
              value: "Queued",
              tone: "warning" as const,
              description: lightspeedIdleQueueDescription,
            }
          : lightspeedRecentFailureCount > 0
            ? {
                value: "Attention needed",
                tone: "warning" as const,
                description:
                  lightspeedLatestSyncFailureMessage ??
                  "A recent Lightspeed sync failed and should be reviewed before the next run.",
              }
            : lightspeedRecentSuccessCount > 0
              ? {
                  value: "Healthy",
                  tone: "success" as const,
                  description:
                    lightspeedLatestSuccessfulActivityAt !== null
                      ? `Latest successful Lightspeed activity recorded ${formatRelativeTimestamp(lightspeedLatestSuccessfulActivityAt)}.`
                      : "Recent Lightspeed syncs completed successfully.",
                }
              : {
                  value: "Idle",
                  tone: "neutral" as const,
                  description:
                    lightspeedLatestSuccessfulActivityAt !== null
                      ? `No active Lightspeed sync jobs. Latest activity recorded ${formatRelativeTimestamp(lightspeedLatestSuccessfulActivityAt)}.`
                      : lightspeedIdleQueueDescription,
                };
  const lightspeedWebhookHealth = lightspeedNeedsReconnect
    ? {
        value: "Reconnect required",
        tone: "danger" as const,
        description:
          "The stored authorization must be repaired before webhook health can be trusted.",
      }
    : lightspeedDetail?.webhookMode === "unavailable"
      ? {
          value: "Unavailable",
          tone: "warning" as const,
          description:
            "This Lightspeed account does not expose the webhook APIs BloomSuite expects.",
        }
      : lightspeedHasWebhookIssue
        ? {
            value: "Attention needed",
            tone: "warning" as const,
            description:
              lightspeedSanitizedWebhookError ??
              "Webhook delivery needs operator review.",
          }
        : lightspeedDetail?.webhookMode === "real-time" &&
            lightspeedDetail.webhookRegistered
          ? {
              value: "Healthy",
              tone: "success" as const,
              description: lightspeedDetail.lastWebhookReceivedAt
                ? `Last event ${formatRelativeTimestamp(
                    lightspeedDetail.lastWebhookReceivedAt,
                  )}.`
                : "Registration is in place and waiting for the next event.",
            }
          : {
              value: lightspeedWebhookMode.label,
              tone: lightspeedWebhookMode.tone,
              description: lightspeedWebhookMode.subtitle,
            };
  const lightspeedHealthNote = lightspeedNeedsReconnect
    ? (lightspeedSanitizedWebhookError ??
      "Reconnect Lightspeed before relying on sync or webhook health signals.")
    : detail.lightspeedHasStaleJobs
      ? "At least one sync job has stopped reporting progress. Check Sync Logs before retrying."
      : lightspeedHasWebhookIssue
        ? lightspeedSanitizedWebhookError
        : lightspeedRecentFailureCount > 0
          ? lightspeedLatestSyncFailureMessage
          : lightspeedDetail?.webhookMode === "sync-only"
            ? "This account is connected in sync-only mode without verified real-time webhook delivery."
            : null;
  const lightspeedApiSetupUrl = lightspeedDetail?.domainPrefix
    ? `https://${lightspeedDetail.domainPrefix}.retail.lightspeed.app/setup/api`
    : null;
  const metaTokenExpired = Boolean(
    isMeta && metaDetail?.authorizationStatus === "expired",
  );
  const metaTokenExpiringSoon = Boolean(
    isMeta &&
    metaDetail?.authorizationStatus === "authorized" &&
    isExpiringWithinDays(metaDetail.expiresAt, 7),
  );
  const metaHasAssets = Boolean((metaDetail?.connectedAssetCount ?? 0) > 0);
  const metaPageStatus =
    isMeta && metaDetail
      ? metaTokenExpired
        ? {
            label: "Reconnect required",
            tone: "danger" as const,
            summary:
              "Your Meta authorization has expired. Re-authorize to restore publishing and analytics access.",
          }
        : metaTokenExpiringSoon
          ? {
              label: "Token expiring",
              tone: "warning" as const,
              summary:
                "Your Meta authorization is still active, but it will expire soon unless you re-authorize it.",
            }
          : metaDetail.authorizationStatus === "authorized" && metaHasAssets
            ? {
                label: "Connected",
                tone: "success" as const,
                summary:
                  "Facebook Pages and Instagram accounts are authorized and available for BloomSuite publishing and analytics workflows.",
              }
            : {
                label: "Not connected",
                tone: "neutral" as const,
                summary:
                  "Authorize Meta and select your Facebook Pages and Instagram accounts to enable publishing and analytics.",
              }
      : null;
  const metaStatusBanner =
    isMeta && metaDetail
      ? metaTokenExpired
        ? {
            tone: "danger" as const,
            title: "Meta authorization expired",
            description: `Your Meta access token has expired${formatDateValue(metaDetail.expiresAt, "") !== "" ? ` on ${formatDateValue(metaDetail.expiresAt)}` : ""}. Re-authorize to restore publishing and analytics.`,
            actionLabel: "Re-authorize",
            onAction: () => {
              void detail.triggerMetaReauthorization();
            },
          }
        : metaTokenExpiringSoon
          ? {
              tone: "warning" as const,
              title: "Meta token expiring soon",
              description: `Your access token expires on ${formatDateValue(metaDetail.expiresAt)}. Re-authorize now to avoid interruption.`,
              actionLabel: "Re-authorize",
              onAction: () => {
                void detail.triggerMetaReauthorization();
              },
            }
          : !metaHasAssets
            ? {
                tone: "warning" as const,
                title: "No Facebook or Instagram assets connected",
                description:
                  "Authorize Meta and select your Pages and accounts to enable publishing.",
                actionLabel: "Connect",
                onAction: () => {
                  void detail.triggerMetaReauthorization();
                },
              }
            : null
      : null;
  const metaPrimaryAction =
    isMeta && metaDetail
      ? metaDetail.authorizationStatus === "not-connected"
        ? {
            label: "Connect",
            variant: "default" as const,
            className: undefined,
            icon: PlugZap,
            onClick: () => {
              void detail.triggerMetaReauthorization();
            },
            disabled: detail.isMetaReauthorizing,
          }
        : {
            label: detail.isMetaReauthorizing
              ? "Opening authorization..."
              : "Re-authorize",
            variant: "outline" as const,
            className: metaTokenExpired
              ? "border-rose-200 text-rose-700 hover:border-rose-300 hover:bg-rose-50"
              : metaTokenExpiringSoon
                ? "border-amber-200 text-amber-700 hover:border-amber-300 hover:bg-amber-50"
                : undefined,
            icon: PlugZap,
            onClick: () => {
              void detail.triggerMetaReauthorization();
            },
            disabled: detail.isMetaReauthorizing,
          }
      : null;
  const metaHeaderActions =
    isMeta && metaDetail
      ? [
          {
            id: "meta-actions",
            items: [
              {
                label: detail.isMetaReauthorizing
                  ? "Opening authorization..."
                  : "Re-authorize Meta",
                icon: PlugZap,
                disabled: detail.isMetaReauthorizing,
                onSelect: () => {
                  void detail.triggerMetaReauthorization();
                },
              },
              {
                label: detail.isRefreshingMetaAssets
                  ? "Refreshing asset list..."
                  : "Refresh Asset List",
                icon: RefreshCcw,
                disabled: detail.isRefreshingMetaAssets,
                onSelect: () => {
                  void detail.refreshMetaAssets();
                },
              },
              {
                label: "View Publishing Logs",
                icon: Activity,
                onSelect: () => navigate(metaDetail.syncLogsPath),
              },
              {
                label: "Disconnect Meta",
                icon: ShieldAlert,
                destructive: true,
                disabled: !detail.canDisconnect,
                onSelect: () => setDisconnectOpen(true),
              },
            ],
          },
        ]
      : [];
  const metaLatestActivityAt = getLatestTimestamp([
    metaDetail?.lastActivityAt,
    metaDetail?.connectedAt,
  ]);
  const ga4ConnectionHealthy = Boolean(
    isGa4 && ga4Detail?.connectionStatus === "connected",
  );
  const ga4NeedsReconnect = Boolean(
    isGa4 && ga4Detail?.connectionStatus === "error",
  );
  const ga4PageStatus =
    isGa4 && ga4Detail
      ? ga4NeedsReconnect
        ? {
            label: "Reconnect required",
            tone: "danger" as const,
            summary:
              "The stored Google Analytics authorization needs attention before BloomSuite can trust reporting access.",
          }
        : ga4ConnectionHealthy
          ? {
              label: "Connected",
              tone: "success" as const,
              summary:
                "The GA4 property is connected and available for BloomSuite reporting on a daily pull cadence.",
            }
          : {
              label: "Not connected",
              tone: "neutral" as const,
              summary:
                "Connect a Google Analytics property to enable BloomSuite reporting and attribution views.",
            }
      : null;
  const ga4PrimaryAction =
    isGa4 && ga4Detail
      ? ga4NeedsReconnect
        ? {
            label: detail.isGa4Reauthorizing
              ? "Opening Google authorization..."
              : "Re-authorize",
            variant: "outline" as const,
            className:
              "border-rose-200 text-rose-700 hover:border-rose-300 hover:bg-rose-50",
            icon: PlugZap,
            onClick: () => {
              void detail.triggerGa4Reauthorization();
            },
            disabled: !ga4Detail.propertyId || detail.isGa4Reauthorizing,
          }
        : ga4ConnectionHealthy
          ? {
              label: detail.isGa4ConnectionTesting
                ? "Testing connection..."
                : "Test Connection",
              variant: "outline" as const,
              className: undefined,
              icon: FlaskConical,
              onClick: () => {
                void detail.triggerGa4ConnectionTest();
              },
              disabled: !ga4Detail.propertyId || detail.isGa4ConnectionTesting,
            }
          : {
              label: "Connect",
              variant: "default" as const,
              className: undefined,
              icon: PlugZap,
              onClick: () => {
                void detail.triggerGa4Reauthorization();
              },
              disabled: detail.isGa4Reauthorizing,
            }
      : null;
  const ga4HeaderActions =
    isGa4 && ga4Detail
      ? [
          {
            id: "ga4-actions",
            items: [
              {
                label: detail.isGa4ConnectionTesting
                  ? "Testing connection..."
                  : "Test Connection",
                icon: FlaskConical,
                disabled:
                  !ga4Detail.propertyId ||
                  !ga4ConnectionHealthy ||
                  detail.isGa4ConnectionTesting,
                onSelect: () => {
                  void detail.triggerGa4ConnectionTest();
                },
              },
              {
                label: detail.isGa4Reauthorizing
                  ? "Opening Google authorization..."
                  : "Re-authorize",
                icon: PlugZap,
                disabled: detail.isGa4Reauthorizing || !ga4Detail.propertyId,
                onSelect: () => {
                  void detail.triggerGa4Reauthorization();
                },
              },
              {
                label: "View Reporting Dashboard",
                icon: Activity,
                onSelect: () => navigate(ga4Detail.reportingPath),
              },
              {
                label: "Disconnect Google Analytics",
                icon: ShieldAlert,
                destructive: true,
                disabled: !detail.canDisconnect,
                onSelect: () => setDisconnectOpen(true),
              },
            ],
          },
        ]
      : [];
  const ga4LatestActivityAt = getLatestTimestamp([
    ga4Detail?.lastPullAt,
    ga4Detail?.lastTestAt,
    ga4Detail?.connectedAt,
  ]);

  const metadataEntries =
    isComingSoonPage && comingSoonDetail
      ? comingSoonDetail.metadata
      : isEmailInfrastructure && emailInfrastructureDetail
        ? emailInfrastructureDetail.metadata
        : isSquare && squareDetail
          ? [
              item.categoryLabel,
              item.syncScopeLabel,
              squareDetail.merchantName ?? "Square merchant",
              `${formatEnvironmentLabel(squareDetail.environment)} environment`,
              squareDetail.locationId
                ? `Location ${squareDetail.locationId}`
                : "Location pending",
            ].filter((entry): entry is string => Boolean(entry))
          : isClover && cloverDetail
            ? [
                `Category: ${item.categoryLabel}`,
                `Region: ${formatRegionLabel(cloverDetail.region)}`,
                `Merchant: ${cloverDetail.merchantName ?? "Clover merchant"}`,
                `Connected since: ${formatTimestampOrFallback(cloverDetail.connectedAt)}`,
                `Last synced: ${formatTimestampOrFallback(cloverDetail.lastSyncedAt)}`,
              ]
            : isLightspeed && lightspeedDetail
              ? [
                  `Category: ${item.categoryLabel}`,
                  `Store: ${lightspeedDetail.storeUrl?.replace("https://", "") ?? "Domain pending"}`,
                  `Retailer: ${lightspeedDetail.retailerName ?? "Lightspeed store"}`,
                  `Connected since: ${formatTimestampOrFallback(lightspeedDetail.connectedAt)}`,
                  `Last synced: ${formatTimestampOrFallback(lightspeedDetail.lastSyncedAt)}`,
                ]
              : isMeta && metaDetail
                ? [
                    `Category: ${item.categoryLabel}`,
                    `Assets: ${formatCount(metaDetail.totalAssetCount)}`,
                    `Authorization: ${metaPageStatus?.label ?? metaDetail.authorizationLabel}`,
                    `Last activity: ${formatTimestampOrFallback(metaLatestActivityAt, "—")}`,
                  ]
                : isGa4 && ga4Detail
                  ? [
                      `Category: ${item.categoryLabel}`,
                      `Property: ${ga4Detail.propertyName ?? ga4Detail.propertyId ?? "—"}`,
                      `Status: ${ga4PageStatus?.label ?? ga4Detail.connectionLabel}`,
                      `Last pull: ${formatTimestampOrFallback(ga4Detail.lastPullAt, "—")}`,
                    ]
                  : isMarketingImport && marketingImportDetail
                    ? [
                        `Category: ${item.categoryLabel}`,
                        `Mode: ${marketingImportDetail.importOnlyLabel}`,
                        `Provider: ${marketingImportDetail.providerLabel}`,
                        `Account: ${marketingImportDetail.accountName ?? "Connection pending"}`,
                      ]
                    : model.metadata;

  const squareMetricCards =
    isSquare && squareDetail
      ? [
          {
            key: "square-connection-status",
            label: "Connection Status",
            value: item.status === "connected" ? "Connected" : "Available",
            subtitle:
              item.status === "connected"
                ? squareDetail.connectedAt
                  ? `Connected ${formatRelativeTimestamp(squareDetail.connectedAt)}`
                  : "Square connection is active"
                : "Connect Square to enable syncing and webhook monitoring",
            icon: PlugZap,
            tone: model.statusTone,
          },
          {
            key: "square-customers",
            label: "Customers Synced",
            value: formatCount(squareDetail.customersSynced),
            subtitle: squareDetail.lastCustomerSync
              ? `Last customer sync ${formatRelativeTimestamp(squareDetail.lastCustomerSync)}`
              : "No customer sync recorded yet",
            icon: Users,
            tone: squareDetail.lastCustomerSync ? "success" : "neutral",
          },
          {
            key: "square-sales",
            label: "Sales Synced",
            value: formatCount(squareDetail.salesSynced),
            subtitle: squareDetail.lastSalesSync
              ? `Last sales sync ${formatRelativeTimestamp(squareDetail.lastSalesSync)}`
              : "No sales sync recorded yet",
            icon: Receipt,
            tone: squareDetail.lastSalesSync ? "success" : "neutral",
          },
          {
            key: "square-products",
            label: "Products Synced",
            value: formatCount(squareDetail.productsSynced),
            subtitle: squareDetail.lastProductSync
              ? `Last product sync ${formatRelativeTimestamp(squareDetail.lastProductSync)}`
              : "No product sync recorded yet",
            icon: Store,
            tone: squareDetail.lastProductSync ? "success" : "neutral",
          },
        ]
      : [];

  const shopifyMetricCards =
    isShopify && shopifyConnection
      ? [
          {
            key: "shopify-status",
            label: "Store Status",
            value: shopifyPageStatus?.label ?? "Available",
            subtitle: shopifyConnection.connected_at
              ? `Connected ${formatRelativeTimestamp(shopifyConnection.connected_at)}`
              : "Connect Shopify to enable BloomSuite sync and webhooks",
            icon: PlugZap,
            tone: shopifyPageStatus?.tone ?? model.statusTone,
          },
          {
            key: "shopify-customers",
            label: "Customers Synced",
            value: formatCount(shopifyConnection.customers_synced),
            subtitle: shopifyConnection.last_customer_sync
              ? `Last synced ${formatRelativeTimestamp(shopifyConnection.last_customer_sync)}`
              : "No customer sync recorded yet",
            icon: Users,
            tone: shopifyConnection.last_customer_sync ? "success" : "neutral",
          },
          {
            key: "shopify-orders",
            label: "Orders Synced",
            value: formatCount(shopifyConnection.sales_synced),
            subtitle: shopifyConnection.last_sales_sync
              ? `Last synced ${formatRelativeTimestamp(shopifyConnection.last_sales_sync)}`
              : "No order sync recorded yet",
            icon: Receipt,
            tone: shopifyConnection.last_sales_sync ? "success" : "neutral",
          },
          {
            key: "shopify-webhooks",
            label: "Webhook Topics",
            value: shopifyConnection.webhooks_subscribed
              ? "11 / 11"
              : "Needs review",
            subtitle: shopifyConnection.webhooks_subscribed
              ? "All required Shopify webhook topics are verified"
              : "One or more required Shopify webhook topics needs attention",
            icon: Webhook,
            tone: shopifyConnection.webhooks_subscribed ? "success" : "warning",
            valueClassName: shopifyConnection.webhooks_subscribed
              ? "text-emerald-600"
              : "text-amber-600",
          },
        ]
      : [];

  const cloverMetricCards =
    isClover && cloverDetail
      ? [
          {
            key: "clover-customers",
            label: "Customers Synced",
            value: formatCount(cloverDetail.customersSynced),
            subtitle: cloverDetail.lastCustomerSync
              ? `Last synced ${formatRelativeTimestamp(cloverDetail.lastCustomerSync)}`
              : "Last synced Not available",
            icon: Users,
            tone: cloverDetail.lastCustomerSync ? "success" : "neutral",
          },
          {
            key: "clover-sales",
            label: "Sales Synced",
            value: formatCount(cloverDetail.salesSynced),
            subtitle: cloverDetail.lastSalesSync
              ? `Last sync: ${formatRelativeTimestamp(cloverDetail.lastSalesSync)}`
              : "Last sync: Not available",
            icon: Receipt,
            tone: cloverDetail.lastSalesSync ? "success" : "neutral",
          },
          {
            key: "clover-products",
            label: "Products Synced",
            value: formatCount(cloverDetail.productsSynced),
            subtitle: cloverDetail.lastProductSync
              ? `Last sync: ${formatRelativeTimestamp(cloverDetail.lastProductSync)}`
              : "Last sync: Not available",
            icon: Store,
            tone: cloverDetail.lastProductSync ? "success" : "neutral",
          },
          {
            key: "clover-webhook-mode",
            label: "Webhook Mode",
            value: cloverDetail.webhooksSubscribed ? "Real-time" : "Sync only",
            subtitle: cloverDetail.webhooksSubscribed
              ? "App-level webhook traffic detected"
              : "Operating without verified app-level webhook traffic",
            icon: Webhook,
            tone: cloverDetail.webhooksSubscribed ? "success" : "warning",
            valueClassName: cloverDetail.webhooksSubscribed
              ? "text-emerald-600"
              : "text-amber-600",
          },
        ]
      : [];

  const lightspeedMetricCards =
    isLightspeed && lightspeedDetail
      ? [
          {
            key: "lightspeed-customers",
            label: "Customers Synced",
            value: formatCount(lightspeedCustomersCount),
            subtitle: lightspeedDetail.lastCustomerSync
              ? `Last synced ${formatRelativeTimestamp(lightspeedDetail.lastCustomerSync)}`
              : "Last synced —",
            icon: Users,
            tone: lightspeedDetail.lastCustomerSync ? "success" : "neutral",
          },
          {
            key: "lightspeed-sales",
            label: "Sales Synced",
            value: formatCount(lightspeedSalesCount),
            subtitle: lightspeedDetail.lastSalesSync
              ? `Last sync: ${formatRelativeTimestamp(lightspeedDetail.lastSalesSync)}`
              : "Last sync: —",
            icon: Receipt,
            tone: lightspeedDetail.lastSalesSync ? "success" : "neutral",
          },
          {
            key: "lightspeed-products",
            label: "Products Synced",
            value: formatCount(lightspeedProductsCount),
            subtitle: lightspeedDetail.lastProductSync
              ? `Last sync: ${formatRelativeTimestamp(lightspeedDetail.lastProductSync)}`
              : "Last sync: —",
            icon: Store,
            tone: lightspeedDetail.lastProductSync ? "success" : "neutral",
          },
          {
            key: "lightspeed-webhook-mode",
            label: "Webhook Mode",
            value: lightspeedWebhookMode.label,
            subtitle: lightspeedWebhookMode.subtitle,
            icon: Webhook,
            tone: lightspeedWebhookMode.tone,
            valueClassName: lightspeedWebhookMode.valueClassName,
          },
        ]
      : [];

  const metaMetricCards =
    isMeta && metaDetail
      ? [
          {
            key: "meta-facebook-pages",
            label: "Facebook Pages",
            value: formatCount(metaDetail.facebookPageCount),
            subtitle:
              metaDetail.facebookPageCount > 0
                ? `${metaDetail.facebookPageCount} page${metaDetail.facebookPageCount === 1 ? "" : "s"} connected`
                : "—",
            icon: Facebook,
            tone: metaDetail.facebookPageCount > 0 ? "success" : "neutral",
          },
          {
            key: "meta-instagram-accounts",
            label: "Instagram Accounts",
            value: formatCount(metaDetail.instagramAccountCount),
            subtitle:
              metaDetail.instagramAccountCount > 0
                ? `${metaDetail.instagramAccountCount} account${metaDetail.instagramAccountCount === 1 ? "" : "s"} connected`
                : "—",
            icon: Instagram,
            tone: metaDetail.instagramAccountCount > 0 ? "success" : "neutral",
          },
          {
            key: "meta-total-assets",
            label: "Total Assets",
            value: formatCount(metaDetail.totalAssetCount),
            subtitle:
              metaDetail.totalAssetCount > 0 ? metaDetail.platformSummary : "—",
            icon: Share2,
            tone: metaDetail.totalAssetCount > 0 ? "success" : "neutral",
          },
          {
            key: "meta-authorization",
            label: "Authorization",
            value: metaPageStatus?.label ?? metaAuthorizationState.label,
            subtitle: metaDetail.expiresAt
              ? `Expires ${formatRelativeTimestamp(metaDetail.expiresAt)}`
              : "—",
            icon: Key,
            tone: metaPageStatus?.tone ?? metaAuthorizationState.tone,
            valueClassName:
              metaPageStatus?.tone === "danger"
                ? "text-rose-600"
                : metaPageStatus?.tone === "warning"
                  ? "text-amber-600"
                  : metaPageStatus?.tone === "success"
                    ? "text-emerald-600"
                    : metaAuthorizationState.valueClassName,
          },
        ]
      : [];

  const ga4MetricCards =
    isGa4 && ga4Detail
      ? [
          {
            key: "ga4-property-name",
            label: "Property",
            value: ga4Detail.propertyName ?? "—",
            subtitle: ga4Detail.propertyId ?? "—",
            icon: BarChart2,
            tone: ga4Detail.propertyName ? "success" : "neutral",
          },
          {
            key: "ga4-connection-status",
            label: "Connection Status",
            value: ga4PageStatus?.label ?? ga4ConnectionState.label,
            subtitle: ga4PageStatus?.summary ?? ga4ConnectionState.subtitle,
            icon: CheckCircle2,
            tone: ga4PageStatus?.tone ?? ga4ConnectionState.tone,
            valueClassName: ga4ConnectionState.valueClassName,
          },
          {
            key: "ga4-reporting-status",
            label: "Reporting",
            value: ga4Detail.reportingStatus,
            subtitle: ga4Detail.reportingSummary,
            icon: TrendingUp,
            tone: ga4ConnectionHealthy ? "success" : "neutral",
          },
          {
            key: "ga4-last-pull",
            label: "Last Data Pull",
            value: ga4Detail.lastPullAt
              ? formatRelativeTimestamp(ga4Detail.lastPullAt)
              : "—",
            subtitle: formatExactTimestamp(ga4Detail.lastPullAt) ?? "—",
            icon: Clock3,
            tone: ga4Detail.lastPullAt ? "neutral" : "warning",
          },
        ]
      : [];

  const marketingImportMetricCards =
    isMarketingImport && marketingImportDetail
      ? [
          {
            key: "marketing-import-lists",
            label: "Lists Available",
            value: formatCount(marketingImportDetail.listCount),
            subtitle:
              marketingImportDetail.listCount > 0
                ? `${marketingImportDetail.listCount} saved list${marketingImportDetail.listCount === 1 ? "" : "s"} discovered`
                : "Preview lists to cache provider artifacts",
            icon: Store,
            tone: marketingImportDetail.listCount > 0 ? "success" : "neutral",
          },
          {
            key: "marketing-import-contacts",
            label: "Contacts Imported",
            value: formatCount(marketingImportDetail.contactsImportedAllTime),
            subtitle: `All-time across ${formatCount(marketingImportDetail.importJobCount)} import job${marketingImportDetail.importJobCount === 1 ? "" : "s"}`,
            icon: Users,
            tone:
              marketingImportDetail.contactsImportedAllTime > 0
                ? "success"
                : "neutral",
          },
          {
            key: "marketing-import-latest",
            label:
              marketingImportDetail.providerSlug === "mailchimp"
                ? "Last Import"
                : "Latest Import",
            value: marketingImportDetail.latestImportCompletedAt
              ? formatRelativeTimestamp(
                  marketingImportDetail.latestImportCompletedAt,
                )
              : marketingImportDetail.latestImportStartedAt
                ? formatRelativeTimestamp(
                    marketingImportDetail.latestImportStartedAt,
                  )
                : "Not started",
            subtitle: marketingImportDetail.latestImportId
              ? marketingImportDetail.providerSlug === "mailchimp"
                ? marketingImportDetail.latestCompletedImport?.durationSeconds
                  ? `${marketingImportDetail.latestImportSummary} • ${formatDurationLabel(marketingImportDetail.latestCompletedImport.durationSeconds)}`
                  : marketingImportDetail.latestImportSummary
                : marketingImportDetail.latestImportSummary
              : marketingImportDetail.latestImportLabel,
            icon:
              marketingImportDetail.providerSlug === "mailchimp"
                ? Clock3
                : Activity,
            tone: marketingImportDetail.latestImportId
              ? marketingImportDetail.latestImportTone
              : "warning",
          },
          {
            key: "marketing-import-status",
            label: "Authorization",
            value: marketingImportDetail.connectionState.label,
            subtitle: marketingImportDetail.connectionState.subtitle,
            icon:
              marketingImportDetail.providerSlug === "mailchimp"
                ? Key
                : PlugZap,
            tone: marketingImportDetail.connectionState.tone,
            valueClassName:
              marketingImportDetail.connectionState.valueClassName,
          },
        ]
      : [];

  const emailInfrastructureMetricCards =
    isEmailInfrastructure && emailInfrastructureDetail
      ? [
          {
            key: "email-infrastructure-domain",
            label: "Primary Domain",
            value: emailInfrastructureDetail.primaryDomain ?? "Setup required",
            subtitle: `${emailInfrastructureDetail.primaryStatusLabel} • ${emailInfrastructureDetail.providerModeLabel}`,
            icon: Globe,
            tone: emailInfrastructureDetail.primaryDomain
              ? "success"
              : "warning",
          },
          {
            key: "email-infrastructure-dns",
            label: "DNS Coverage",
            value: `${emailInfrastructureDetail.dnsVerifiedCount}/${emailInfrastructureDetail.dnsRecordCount}`,
            subtitle:
              emailInfrastructureDetail.dnsRecordCount > 0
                ? "Verified records currently visible from BloomSuite checks"
                : "No DNS records are loaded for the current domain yet",
            icon: Webhook,
            tone:
              emailInfrastructureDetail.dnsRecordCount > 0 &&
              emailInfrastructureDetail.dnsVerifiedCount ===
                emailInfrastructureDetail.dnsRecordCount
                ? "success"
                : emailInfrastructureDetail.dnsRecordCount > 0
                  ? "warning"
                  : "neutral",
          },
          {
            key: "email-infrastructure-volume",
            label: "Sent Last 24h",
            value: formatCount(emailInfrastructureDetail.sent24h),
            subtitle:
              emailInfrastructureDetail.dailyLimit !== null
                ? `Daily limit ${formatCount(emailInfrastructureDetail.dailyLimit)} • Delivered ${formatCount(emailInfrastructureDetail.delivered24h)}`
                : `Delivered ${formatCount(emailInfrastructureDetail.delivered24h)} in the last 24 hours`,
            icon: Activity,
            tone: emailInfrastructureDetail.sent24h > 0 ? "success" : "neutral",
          },
          {
            key: "email-infrastructure-health",
            label: "Infrastructure Health",
            value:
              emailInfrastructureDetail.reputationScore !== null
                ? `${Math.round(emailInfrastructureDetail.reputationScore)}`
                : emailInfrastructureDetail.healthCheckLabel,
            subtitle:
              emailInfrastructureDetail.reputationScore !== null
                ? `${formatRate(emailInfrastructureDetail.bounceRate24h)} bounce • ${formatRate(emailInfrastructureDetail.complaintRate24h)} complaint`
                : emailInfrastructureDetail.healthSummary,
            icon: ShieldAlert,
            tone: formatInfrastructureHealthTone(
              emailInfrastructureDetail.healthCheckStatus,
            ),
          },
        ]
      : [];
  const emailInfrastructureTabItems =
    isEmailInfrastructure && emailInfrastructureDetail
      ? [
          { value: "overview" as const, label: "Overview" },
          {
            value: "dns-records" as const,
            label: "DNS Records",
            count: emailInfrastructureDetail.dnsRecords.length,
          },
        ]
      : [];

  const copyToClipboard = async (
    value: string | null | undefined,
    label: string,
  ) => {
    if (!value) {
      toast.error(`${label} is not available for this integration.`);
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setCopiedLabel(label);
      window.setTimeout(() => {
        setCopiedLabel((currentLabel) =>
          currentLabel === label ? null : currentLabel,
        );
      }, 1200);
      toast.success(`${label} copied.`);
    } catch {
      toast.error(`Unable to copy ${label.toLowerCase()}.`);
    }
  };

  const headerActionSections =
    !isComingSoonPage && detail.canUseActions
      ? [
          {
            id: "primary",
            items: [
              {
                label: isShopify
                  ? item.status === "connected"
                    ? "Open Shopify admin"
                    : (item.detailActionLabel ?? "Connect Shopify")
                  : item.status === "coming-soon"
                    ? "Request integration"
                    : (item.detailActionLabel ?? "Open integration"),
                icon:
                  isShopify && item.status !== "connected"
                    ? PlugZap
                    : item.status === "coming-soon"
                      ? MailPlus
                      : ExternalLink,
                onSelect: () => {
                  if (isShopify) {
                    if (item.status === "connected") {
                      if (shopifyAdminUrl) {
                        window.open(
                          shopifyAdminUrl,
                          "_blank",
                          "noopener,noreferrer",
                        );
                      }
                    } else {
                      setShopifyDialogOpen(true);
                    }
                    return;
                  }

                  if (item.status === "coming-soon") {
                    window.location.href = `${REQUEST_INTEGRATION_MAILTO}${encodeURIComponent(item.name)}`;
                    return;
                  }

                  if (detail.targetPath) {
                    navigate(detail.targetPath);
                  }
                },
              },
              {
                label: detail.isFetching ? "Refreshing…" : "Refresh status",
                icon: RefreshCcw,
                disabled: detail.isFetching,
                onSelect: () => {
                  void detail.refetch();
                },
              },
            ],
          },
          ...(isSquare && squareDetail
            ? [
                {
                  id: "square-operations",
                  label: "Square Operations",
                  items: [
                    {
                      label: detail.isSquareSyncing
                        ? "Starting sync…"
                        : "Trigger manual sync",
                      icon: RefreshCcw,
                      disabled:
                        item.status !== "connected" || detail.isSquareSyncing,
                      onSelect: () => {
                        void detail.triggerSquareSync();
                      },
                    },
                    {
                      label: detail.isVerifyingSquareWebhooks
                        ? "Verifying webhooks…"
                        : "Verify webhooks",
                      icon: Webhook,
                      disabled:
                        item.status !== "connected" ||
                        detail.isVerifyingSquareWebhooks,
                      onSelect: () => {
                        void detail.verifySquareWebhooks();
                      },
                    },
                    {
                      label: "View sync logs",
                      icon: Activity,
                      onSelect: () => navigate(squareDetail.syncLogsPath),
                    },
                    {
                      label: "View automation logs",
                      icon: Bot,
                      onSelect: () => navigate(squareDetail.automationLogsPath),
                    },
                  ],
                },
                {
                  label: "Square IDs",
                  items: [
                    {
                      label: "Copy merchant ID",
                      icon: Copy,
                      disabled: !squareDetail.merchantId,
                      onSelect: () => {
                        void copyToClipboard(
                          squareDetail.merchantId,
                          "Merchant ID",
                        );
                      },
                    },
                    {
                      label: "Copy location ID",
                      icon: MapPin,
                      disabled: !squareDetail.locationId,
                      onSelect: () => {
                        void copyToClipboard(
                          squareDetail.locationId,
                          "Location ID",
                        );
                      },
                    },
                    {
                      label: "Copy webhook subscription ID",
                      icon: Webhook,
                      disabled: !squareDetail.webhookSubscriptionId,
                      onSelect: () => {
                        void copyToClipboard(
                          squareDetail.webhookSubscriptionId,
                          "Webhook subscription ID",
                        );
                      },
                    },
                  ],
                },
              ]
            : []),
          ...(isShopify && shopifyConnection
            ? [
                {
                  id: "shopify-operations",
                  label: "Shopify Operations",
                  items: [
                    {
                      label: detail.isShopifySyncing
                        ? "Starting sync…"
                        : "Trigger manual sync",
                      icon: RefreshCcw,
                      disabled:
                        item.status !== "connected" || detail.isShopifySyncing,
                      onSelect: () => {
                        void detail.triggerShopifySync();
                      },
                    },
                    {
                      label: detail.isVerifyingShopifyWebhooks
                        ? "Verifying webhooks…"
                        : "Verify webhooks",
                      icon: Webhook,
                      disabled:
                        item.status !== "connected" ||
                        detail.isVerifyingShopifyWebhooks,
                      onSelect: () => {
                        void detail.verifyShopifyWebhooks();
                      },
                    },
                    ...(detail.canAccessLightspeedAdminFeatures
                      ? [
                          {
                            label: "Run diagnostics",
                            icon: FlaskConical,
                            onSelect: () => navigate(SHOPIFY_DIAGNOSTICS_PATH),
                          },
                        ]
                      : []),
                    {
                      label: "Open Shopify admin",
                      icon: ExternalLink,
                      disabled: !shopifyAdminUrl,
                      onSelect: () => {
                        if (shopifyAdminUrl) {
                          window.open(
                            shopifyAdminUrl,
                            "_blank",
                            "noopener,noreferrer",
                          );
                        }
                      },
                    },
                    {
                      label: "Copy store domain",
                      icon: Copy,
                      disabled: !shopifyConnection.shop_domain,
                      onSelect: () => {
                        void copyToClipboard(
                          shopifyConnection.shop_domain,
                          "Store domain",
                        );
                      },
                    },
                  ],
                },
              ]
            : []),
          ...(isClover && cloverDetail
            ? [
                {
                  id: "clover-operations",
                  label: "Clover Operations",
                  items: [
                    {
                      label: detail.isCloverSyncing
                        ? "Starting sync…"
                        : "Trigger manual sync",
                      icon: RefreshCcw,
                      disabled:
                        item.status !== "connected" || detail.isCloverSyncing,
                      onSelect: () => {
                        void detail.triggerCloverSync();
                      },
                    },
                    {
                      label: detail.isCloverConnectionTesting
                        ? "Running connection test…"
                        : "Run connection test",
                      icon: FlaskConical,
                      disabled:
                        item.status !== "connected" ||
                        detail.isCloverConnectionTesting,
                      onSelect: () => {
                        void detail.runCloverConnectionTest();
                      },
                    },
                    {
                      label: "View sync logs",
                      icon: Activity,
                      onSelect: () => navigate(cloverDetail.syncLogsPath),
                    },
                    {
                      label: "Copy merchant ID",
                      icon: Copy,
                      disabled: !cloverDetail.merchantId,
                      onSelect: () => {
                        void copyToClipboard(
                          cloverDetail.merchantId,
                          "Merchant ID",
                        );
                      },
                    },
                  ],
                },
              ]
            : []),
          ...(isLightspeed && lightspeedDetail
            ? [
                {
                  id: "lightspeed-operations",
                  label: "Lightspeed Operations",
                  items: [
                    {
                      label:
                        detail.lightspeedSyncState === "triggering"
                          ? "Starting sync…"
                          : detail.lightspeedSyncState === "syncing"
                            ? "Sync in progress"
                            : "Trigger manual sync",
                      icon: RefreshCcw,
                      disabled:
                        item.status !== "connected" ||
                        detail.isLightspeedSyncing,
                      onSelect: () => {
                        void detail.triggerLightspeedSync();
                      },
                    },
                    {
                      label: "Run diagnostics",
                      icon: FlaskConical,
                      onSelect: () =>
                        navigate(lightspeedDetail.diagnosticsPath),
                    },
                    {
                      label: "View sync logs",
                      icon: Activity,
                      onSelect: () => navigate(lightspeedDetail.syncLogsPath),
                    },
                    {
                      label: "Open store URL",
                      icon: ExternalLink,
                      disabled: !lightspeedDetail.storeUrl,
                      onSelect: () => {
                        if (lightspeedDetail.storeUrl) {
                          window.open(
                            lightspeedDetail.storeUrl,
                            "_blank",
                            "noopener,noreferrer",
                          );
                        }
                      },
                    },
                  ],
                },
              ]
            : []),
          ...(isMeta && metaDetail
            ? [
                {
                  id: "meta-operations",
                  label: "Meta Operations",
                  items: [
                    {
                      label: detail.isMetaReauthorizing
                        ? "Opening authorization..."
                        : metaDetail.authorizationStatus === "not-connected"
                          ? "Authorize Meta"
                          : "Re-authorize Meta",
                      icon: PlugZap,
                      disabled: detail.isMetaReauthorizing,
                      onSelect: () => {
                        void detail.triggerMetaReauthorization();
                      },
                    },
                    {
                      label: detail.isRefreshingMetaAssets
                        ? "Refreshing asset list..."
                        : "Refresh asset list",
                      icon: RefreshCcw,
                      disabled:
                        detail.isRefreshingMetaAssets ||
                        metaDetail.connectedAssetCount === 0,
                      onSelect: () => {
                        void detail.refreshMetaAssets();
                      },
                    },
                    {
                      label: "View publishing logs",
                      icon: Activity,
                      onSelect: () => navigate(metaDetail.syncLogsPath),
                    },
                  ],
                },
              ]
            : []),
          ...(isGa4 && ga4Detail
            ? [
                {
                  id: "ga4-operations",
                  label: "Google Analytics Actions",
                  items: [
                    {
                      label: detail.isGa4ConnectionTesting
                        ? "Testing connection..."
                        : "Test Connection",
                      icon: FlaskConical,
                      disabled:
                        !ga4Detail.propertyId ||
                        ga4Detail.connectionStatus !== "connected" ||
                        detail.isGa4ConnectionTesting,
                      onSelect: () => {
                        void detail.triggerGa4ConnectionTest();
                      },
                    },
                    {
                      label: detail.isGa4Reauthorizing
                        ? "Opening Google authorization..."
                        : "Re-authorize Google Analytics",
                      icon: PlugZap,
                      disabled:
                        !ga4Detail.propertyId || detail.isGa4Reauthorizing,
                      onSelect: () => {
                        void detail.triggerGa4Reauthorization();
                      },
                    },
                    {
                      label: "View Reporting Dashboard",
                      icon: Activity,
                      onSelect: () => navigate(ga4Detail.reportingPath),
                    },
                  ],
                },
              ]
            : []),
          ...(isMarketingImport && marketingImportDetail
            ? [
                {
                  id: "marketing-import-actions",
                  label: `${marketingImportDetail.providerLabel} Import Actions`,
                  items: [
                    {
                      label: "Start Import",
                      icon: ArrowRight,
                      onSelect: () =>
                        navigate(marketingImportDetail.importFlowPath),
                    },
                    {
                      label: "Preview Lists",
                      icon: ExternalLink,
                      onSelect: () =>
                        navigate(marketingImportDetail.previewListsPath),
                    },
                    ...(marketingImportDetail.supportsValidateConnection
                      ? [
                          {
                            label: detail.isValidatingMarketingImportConnection
                              ? "Validating connection..."
                              : "Validate Connection",
                            icon: FlaskConical,
                            disabled:
                              !marketingImportDetail.connectionId ||
                              detail.isValidatingMarketingImportConnection,
                            onSelect: () => {
                              void detail.validateMarketingImportConnection();
                            },
                          },
                        ]
                      : []),
                  ],
                },
              ]
            : []),
          ...(detail.canDisconnect
            ? [
                {
                  id: "danger",
                  items: [
                    {
                      label: isMeta
                        ? "Disconnect Meta"
                        : isShopify
                          ? "Disconnect Shopify"
                          : isSquare
                            ? "Disconnect Square"
                            : isClover
                              ? "Disconnect Clover"
                              : isLightspeed
                                ? "Disconnect Lightspeed"
                                : isGa4
                                  ? "Disconnect Google Analytics"
                                  : isMarketingImport && marketingImportDetail
                                    ? `Disconnect ${marketingImportDetail.providerLabel}`
                                    : "Disconnect integration",
                      icon: ShieldAlert,
                      destructive: true,
                      onSelect: () => setDisconnectOpen(true),
                    },
                  ],
                },
              ]
            : []),
        ]
      : [];

  const displayedActionSections =
    isComingSoonPage && comingSoonDetail
      ? [
          {
            id: "coming-soon-actions",
            label: "Coming Soon Actions",
            items: [
              {
                label: "View Documentation",
                icon: BookOpen,
                onSelect: () =>
                  navigate(`/integrations/${seed.slug}/documentation`),
              },
            ],
          },
        ]
      : isEmailInfrastructure && emailInfrastructureDetail
        ? [
            {
              id: "email-infrastructure-actions",
              label: "Infrastructure Actions",
              items: [
                {
                  label: detail.isRunningEmailInfrastructureHealthCheck
                    ? "Running DNS Check..."
                    : "Run DNS Check",
                  icon: FlaskConical,
                  disabled:
                    !emailInfrastructureDetail.canRunHealthCheck ||
                    detail.isRunningEmailInfrastructureHealthCheck,
                  onSelect: () => {
                    void detail.runEmailInfrastructureHealthCheck();
                  },
                },
                {
                  label: "View DNS Records",
                  icon: Webhook,
                  onSelect: () => setEmailInfrastructureTab("dns-records"),
                },
                {
                  label: "View Sending Logs",
                  icon: Activity,
                  onSelect: () =>
                    navigate(emailInfrastructureDetail.sendingLogsPath),
                },
                {
                  label: "Contact Support",
                  icon: MailPlus,
                  onSelect: () => {
                    window.location.href =
                      emailInfrastructureDetail.supportPath;
                  },
                },
              ],
            },
          ]
        : isMeta && metaDetail
          ? metaHeaderActions
          : isGa4 && ga4Detail
            ? ga4HeaderActions
            : headerActionSections;
  const emailInfrastructurePrimaryAction =
    isEmailInfrastructure && emailInfrastructureDetail
      ? {
          label: detail.isRunningEmailInfrastructureHealthCheck
            ? "Running DNS Check..."
            : "Run DNS Check",
          disabled:
            !emailInfrastructureDetail.canRunHealthCheck ||
            detail.isRunningEmailInfrastructureHealthCheck,
          onClick: () => {
            void detail.runEmailInfrastructureHealthCheck();
          },
        }
      : null;
  const shopifyPrimaryAction = isShopify
    ? !shopifyConnection
      ? {
          label: "Connect Shopify",
          disabled: false,
          onClick: () => setShopifyDialogOpen(true),
        }
      : shopifyAppUninstalled
        ? {
            label: "Reinstall App",
            disabled: false,
            onClick: () => setShopifyDialogOpen(true),
          }
        : !shopifyConnected
          ? {
              label: "Reconnect",
              disabled: false,
              onClick: () => setShopifyDialogOpen(true),
            }
          : shopifyNeedsWebhookAttention
            ? {
                label: detail.isVerifyingShopifyWebhooks
                  ? "Verifying..."
                  : "Verify Webhooks",
                disabled: detail.isVerifyingShopifyWebhooks,
                onClick: () => {
                  void detail.verifyShopifyWebhooks();
                },
              }
            : {
                label: detail.isShopifySyncing ? "Syncing..." : "Sync Now",
                disabled: detail.isShopifySyncing,
                onClick: () => {
                  void detail.triggerShopifySync();
                },
              }
    : null;
  const comingSoonPrimaryAction =
    isComingSoonPage && comingSoonDetail
      ? {
          label: comingSoonDetail.isSubmitted
            ? "You're on the list"
            : "Notify me",
          variant: "outline" as const,
          disabled:
            comingSoonDetail.isSubmitted ||
            !comingSoonDetail.notifyEmail ||
            detail.isSubmittingComingSoonInterest,
          icon: Bell,
          onClick: () => {
            void detail.submitComingSoonInterest();
          },
        }
      : null;

  return (
    <TooltipProvider>
      <div className="container mx-auto space-y-6 p-6">
        <Breadcrumb>
          <BreadcrumbList className="flex-wrap gap-2 rounded-full border border-border/70 bg-white/90 px-4 py-2 text-sm shadow-sm shadow-brand-navy/5 backdrop-blur-sm">
            <BreadcrumbItem>
              <BreadcrumbLink
                asChild
                className="font-medium text-muted-foreground transition-colors hover:text-brand-navy"
              >
                <Link to="/dashboard">Dashboard</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="text-muted-foreground/50" />
            <BreadcrumbItem>
              <BreadcrumbLink
                asChild
                className="font-medium text-muted-foreground transition-colors hover:text-brand-navy"
              >
                <Link to="/integrations">Integrations</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="text-muted-foreground/50" />
            <BreadcrumbItem>
              <BreadcrumbPage className="font-semibold text-brand-navy">
                {item.name}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {isSquare && squareDetail && squarePageStatus ? (
          <section className="space-y-5 rounded-[1.75rem] border border-border/70 bg-white/95 p-6 shadow-sm shadow-brand-navy/5">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
              <div className="space-y-4">
                <div className="flex flex-wrap items-start gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-[1.35rem] border border-border/70 bg-slate-50 shadow-sm">
                    <Icon className="h-7 w-7 text-slate-700" />
                  </div>
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <h1 className="text-xl font-semibold text-foreground sm:text-2xl">
                        {item.name}
                      </h1>
                      <DetailStatusBadge
                        label={squarePageStatus.label}
                        tone={squarePageStatus.tone}
                      />
                      {detail.isFetching ? (
                        <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-slate-50 px-3 py-1 text-xs font-medium text-muted-foreground">
                          <RefreshCcw className="h-3.5 w-3.5" />
                          Refreshing
                        </span>
                      ) : null}
                    </div>

                    <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                      {squarePageStatus.summary}
                    </p>

                    <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                      <span>
                        Merchant {squareDetail.merchantName?.trim() || "—"}
                      </span>
                      <span>
                        Location {squareDetail.locationId?.trim() || "—"}
                      </span>
                      <span>
                        Connected{" "}
                        {squareDetail.connectedAt
                          ? formatRelativeTimestamp(squareDetail.connectedAt)
                          : "—"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 self-start">
                {squarePrimaryAction ? (
                  <Button
                    type="button"
                    onClick={squarePrimaryAction.onClick}
                    disabled={squarePrimaryAction.disabled}
                  >
                    {detail.isSquareSyncing ? (
                      <RefreshCcw className="mr-2 h-4 w-4" />
                    ) : null}
                    {squarePrimaryAction.label}
                  </Button>
                ) : null}
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/integrations/${seed.slug}/documentation`}>
                    <BookOpen className="mr-1.5 h-3.5 w-3.5" />
                    Documentation
                  </Link>
                </Button>
                {squareHeaderActions.length > 0 ? (
                  <ActionDropdown
                    label="Actions"
                    align="end"
                    sections={squareHeaderActions}
                    triggerClassName="min-w-[10rem] justify-between"
                  />
                ) : null}
              </div>
            </div>

            {detail.isError ? (
              <div className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50/80 px-4 py-4 text-sm text-rose-800 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <div className="font-semibold">
                      Unable to refresh integration details
                    </div>
                    <div className="mt-1 text-rose-700/90">
                      {getUserFacingIntegrationError(
                        detail.error,
                        "An unexpected error occurred while loading this integration.",
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void detail.refetch()}
                >
                  Retry
                </Button>
              </div>
            ) : null}

            {squareStatusBanner ? (
              <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-4 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <div className="font-semibold">
                      {squareStatusBanner.title}
                    </div>
                    <div className="mt-1 leading-6">
                      {squareStatusBanner.description}
                    </div>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={squareStatusBanner.onAction}
                >
                  {squareStatusBanner.actionLabel}
                </Button>
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {squareMetricCards.map((card) => (
                <div
                  key={card.key}
                  className="rounded-[1.35rem] border border-border/70 bg-slate-50/60 p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        {card.label}
                      </div>
                      <div
                        className={cn(
                          "mt-3 text-3xl font-semibold tracking-tight text-slate-950",
                          card.valueClassName,
                        )}
                      >
                        {card.value}
                      </div>
                    </div>
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border/70 bg-white">
                      <card.icon className="h-5 w-5 text-slate-700" />
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {card.subtitle}
                  </p>
                </div>
              ))}
            </div>

            <div className="overflow-x-auto rounded-[1.35rem] border border-border/70 bg-slate-50/60 p-2">
              <div className="flex min-w-max items-center gap-2">
                {squareTabItems.map((tab) => {
                  const isActive = lightspeedTab === tab.value;

                  return (
                    <button
                      key={tab.value}
                      type="button"
                      onClick={() => setLightspeedTab(tab.value)}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-white text-slate-950 shadow-sm"
                          : "text-muted-foreground hover:bg-white/70 hover:text-slate-900",
                      )}
                    >
                      <span>{tab.label}</span>
                      {"count" in tab &&
                      typeof tab.count === "number" &&
                      tab.count > 0 ? (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                          {formatCount(tab.count)}
                        </span>
                      ) : null}
                      {"isActive" in tab && tab.isActive ? (
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-teal/50" />
                          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand-teal" />
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        ) : null}

        {isClover && cloverDetail && cloverPageStatus ? (
          <section className="space-y-5 rounded-[1.75rem] border border-border/70 bg-white/95 p-6 shadow-sm shadow-brand-navy/5">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
              <div className="space-y-4">
                <div className="flex flex-wrap items-start gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-[1.35rem] border border-border/70 bg-slate-50 shadow-sm">
                    <Icon className="h-7 w-7 text-slate-700" />
                  </div>
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <h1 className="text-xl font-semibold text-foreground sm:text-2xl">
                        {item.name}
                      </h1>
                      <DetailStatusBadge
                        label={cloverPageStatus.label}
                        tone={cloverPageStatus.tone}
                      />
                      {detail.isFetching ? (
                        <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-slate-50 px-3 py-1 text-xs font-medium text-muted-foreground">
                          <RefreshCcw className="h-3.5 w-3.5" />
                          Refreshing
                        </span>
                      ) : null}
                    </div>

                    <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                      {cloverPageStatus.summary}
                    </p>

                    <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                      <span>
                        Merchant {cloverDetail.merchantName?.trim() || "—"}
                      </span>
                      <span>
                        Region {formatRegionLabel(cloverDetail.region)}
                      </span>
                      <span>
                        Connected{" "}
                        {cloverDetail.connectedAt
                          ? formatRelativeTimestamp(cloverDetail.connectedAt)
                          : "—"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 self-start">
                {cloverPrimaryAction ? (
                  <Button
                    type="button"
                    onClick={cloverPrimaryAction.onClick}
                    disabled={cloverPrimaryAction.disabled}
                  >
                    {detail.isCloverSyncing && !cloverNeedsWebhookSetup ? (
                      <RefreshCcw className="mr-2 h-4 w-4" />
                    ) : null}
                    {cloverPrimaryAction.label}
                  </Button>
                ) : null}
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/integrations/${seed.slug}/documentation`}>
                    <BookOpen className="mr-1.5 h-3.5 w-3.5" />
                    Documentation
                  </Link>
                </Button>
                {cloverHeaderActions.length > 0 ? (
                  <ActionDropdown
                    label="Actions"
                    align="end"
                    sections={cloverHeaderActions}
                    triggerClassName="min-w-[10rem] justify-between"
                  />
                ) : null}
              </div>
            </div>

            {detail.isError ? (
              <div className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50/80 px-4 py-4 text-sm text-rose-800 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <div className="font-semibold">
                      Unable to refresh integration details
                    </div>
                    <div className="mt-1 text-rose-700/90">
                      {getUserFacingIntegrationError(
                        detail.error,
                        "An unexpected error occurred while loading this integration.",
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void detail.refetch()}
                >
                  Retry
                </Button>
              </div>
            ) : null}

            {cloverStatusBanner ? (
              <div
                className={cn(
                  "flex flex-col gap-3 rounded-2xl px-4 py-4 text-sm sm:flex-row sm:items-center sm:justify-between",
                  cloverStatusBanner.tone === "danger"
                    ? "border border-rose-200 bg-rose-50/90 text-rose-900"
                    : "border border-amber-200 bg-amber-50/90 text-amber-900",
                )}
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <div className="font-semibold">
                      {cloverStatusBanner.title}
                    </div>
                    <div className="mt-1 leading-6">
                      {cloverStatusBanner.description}
                    </div>
                  </div>
                </div>
                {cloverStatusBanner.actionLabel ? (
                  <Button
                    type="button"
                    variant={
                      cloverStatusBanner.tone === "danger"
                        ? "destructive"
                        : "outline"
                    }
                    onClick={cloverStatusBanner.onAction}
                  >
                    {cloverStatusBanner.actionLabel}
                  </Button>
                ) : null}
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {cloverMetricCards.map((card) => (
                <div
                  key={card.key}
                  className="rounded-[1.35rem] border border-border/70 bg-slate-50/60 p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        {card.label}
                      </div>
                      <div
                        className={cn(
                          "mt-3 text-3xl font-semibold tracking-tight text-slate-950",
                          card.valueClassName,
                        )}
                      >
                        {card.value}
                      </div>
                    </div>
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border/70 bg-white">
                      <card.icon className="h-5 w-5 text-slate-700" />
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {card.subtitle}
                  </p>
                </div>
              ))}
            </div>

            <div className="overflow-x-auto rounded-[1.35rem] border border-border/70 bg-slate-50/60 p-2">
              <div className="flex min-w-max items-center gap-2">
                {cloverTabItems.map((tab) => {
                  const isActive = lightspeedTab === tab.value;

                  return (
                    <button
                      key={tab.value}
                      type="button"
                      onClick={() => setLightspeedTab(tab.value)}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-white text-slate-950 shadow-sm"
                          : "text-muted-foreground hover:bg-white/70 hover:text-slate-900",
                      )}
                    >
                      <span>{tab.label}</span>
                      {"count" in tab &&
                      typeof tab.count === "number" &&
                      tab.count > 0 ? (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                          {formatCount(tab.count)}
                        </span>
                      ) : null}
                      {"isActive" in tab && tab.isActive ? (
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-teal/50" />
                          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand-teal" />
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        ) : null}

        {isLightspeed && lightspeedDetail ? (
          <section className="space-y-5 rounded-[1.75rem] border border-border/70 bg-white/95 p-6 shadow-sm shadow-brand-navy/5">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
              <div className="space-y-4">
                <div className="flex flex-wrap items-start gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-[1.35rem] border border-border/70 bg-slate-50 shadow-sm">
                    <Icon className="h-7 w-7 text-slate-700" />
                  </div>
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <h1 className="text-xl font-semibold text-foreground sm:text-2xl">
                        {item.name}
                      </h1>
                      <DetailStatusBadge
                        label={lightspeedPageStatus.label}
                        tone={lightspeedPageStatus.tone}
                      />
                      {detail.isFetching ? (
                        <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-slate-50 px-3 py-1 text-xs font-medium text-muted-foreground">
                          <RefreshCcw className="h-3.5 w-3.5" />
                          Refreshing
                        </span>
                      ) : null}
                    </div>

                    <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                      {lightspeedPageStatus.summary}
                    </p>

                    <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                      <span>
                        Retailer {lightspeedDetail.retailerName?.trim() || "—"}
                      </span>
                      <span>
                        Domain {lightspeedDetail.domainPrefix?.trim() || "—"}
                      </span>
                      <span>
                        Connected{" "}
                        {lightspeedDetail.connectedAt
                          ? formatRelativeTimestamp(
                              lightspeedDetail.connectedAt,
                            )
                          : "—"}
                      </span>
                    </div>

                    {lightspeedDetail.storeUrl ? (
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <a
                          href={lightspeedDetail.storeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-brand-navy underline-offset-4 hover:underline"
                        >
                          {lightspeedDetail.storeUrl.replace("https://", "")}
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 self-start">
                {lightspeedPrimaryAction ? (
                  <Button
                    type="button"
                    onClick={lightspeedPrimaryAction.onClick}
                    disabled={lightspeedPrimaryAction.disabled}
                  >
                    {detail.lightspeedSyncState !== "idle" &&
                    !lightspeedNeedsReconnect ? (
                      <RefreshCcw className="mr-2 h-4 w-4" />
                    ) : null}
                    {lightspeedPrimaryAction.label}
                  </Button>
                ) : null}
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/integrations/${seed.slug}/documentation`}>
                    <BookOpen className="mr-1.5 h-3.5 w-3.5" />
                    Documentation
                  </Link>
                </Button>
                {lightspeedHeaderActions.length > 0 ? (
                  <ActionDropdown
                    label="Actions"
                    align="end"
                    sections={lightspeedHeaderActions}
                    triggerClassName="min-w-[10rem] justify-between"
                  />
                ) : null}
              </div>
            </div>

            {detail.isError ? (
              <div className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50/80 px-4 py-4 text-sm text-rose-800 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <div className="font-semibold">
                      Unable to refresh integration details
                    </div>
                    <div className="mt-1 text-rose-700/90">
                      {getUserFacingIntegrationError(
                        detail.error,
                        "An unexpected error occurred while loading this integration.",
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void detail.refetch()}
                >
                  Retry
                </Button>
              </div>
            ) : null}

            {lightspeedStatusBanner ? (
              <div
                className={cn(
                  "flex flex-col gap-3 rounded-2xl px-4 py-4 text-sm sm:flex-row sm:items-center sm:justify-between",
                  lightspeedStatusBanner.tone === "danger"
                    ? "border border-rose-200 bg-rose-50/90 text-rose-900"
                    : "border border-amber-200 bg-amber-50/90 text-amber-900",
                )}
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <div className="font-semibold">
                      {lightspeedStatusBanner.title}
                    </div>
                    <div className="mt-1 leading-6">
                      {lightspeedStatusBanner.description}
                    </div>
                  </div>
                </div>
                {"actionLabel" in lightspeedStatusBanner &&
                lightspeedStatusBanner.actionLabel ? (
                  <Button
                    type="button"
                    variant={
                      lightspeedStatusBanner.tone === "danger"
                        ? "destructive"
                        : "outline"
                    }
                    onClick={lightspeedStatusBanner.onAction}
                  >
                    {lightspeedStatusBanner.actionLabel}
                  </Button>
                ) : null}
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  key: "customers",
                  label: "Customers",
                  value: formatCount(lightspeedCustomersCount),
                  description: lightspeedDetail.lastCustomerSync
                    ? `Last synced ${formatRelativeTimestamp(lightspeedDetail.lastCustomerSync)}`
                    : "No customer sync recorded yet",
                  icon: Users,
                },
                {
                  key: "sales",
                  label: "Sales",
                  value: formatCount(lightspeedSalesCount),
                  description: lightspeedDetail.lastSalesSync
                    ? `Last synced ${formatRelativeTimestamp(lightspeedDetail.lastSalesSync)}`
                    : "No sales sync recorded yet",
                  icon: Receipt,
                },
                {
                  key: "products",
                  label: "Products",
                  value: formatCount(lightspeedProductsCount),
                  description: lightspeedDetail.lastProductSync
                    ? `Last synced ${formatRelativeTimestamp(lightspeedDetail.lastProductSync)}`
                    : "No product sync recorded yet",
                  icon: Store,
                },
                {
                  key: "webhooks",
                  label: "Webhook Mode",
                  value: lightspeedWebhookMode.label,
                  description: lightspeedWebhookMode.subtitle,
                  icon: Webhook,
                  valueClassName: lightspeedWebhookMode.valueClassName,
                },
              ].map((card) => (
                <div
                  key={card.key}
                  className="rounded-[1.35rem] border border-border/70 bg-slate-50/60 p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        {card.label}
                      </div>
                      <div
                        className={cn(
                          "mt-3 text-3xl font-semibold tracking-tight text-slate-950",
                          card.valueClassName,
                        )}
                      >
                        {card.value}
                      </div>
                    </div>
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border/70 bg-white">
                      <card.icon className="h-5 w-5 text-slate-700" />
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {card.description}
                  </p>
                </div>
              ))}
            </div>

            <div className="overflow-x-auto rounded-[1.35rem] border border-border/70 bg-slate-50/60 p-2">
              <div className="flex min-w-max items-center gap-2">
                {lightspeedTabItems.map((tab) => {
                  const isActive = lightspeedTab === tab.value;

                  return (
                    <button
                      key={tab.value}
                      type="button"
                      onClick={() => setLightspeedTab(tab.value)}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-white text-slate-950 shadow-sm"
                          : "text-muted-foreground hover:bg-white/70 hover:text-slate-900",
                      )}
                    >
                      <span>{tab.label}</span>
                      {"count" in tab &&
                      typeof tab.count === "number" &&
                      tab.count > 0 ? (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                          {formatCount(tab.count)}
                        </span>
                      ) : null}
                      {"isActive" in tab && tab.isActive ? (
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-teal/50" />
                          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand-teal" />
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        ) : null}

        {isShopify && shopifyConnection && shopifyPageStatus ? (
          <section className="space-y-5 rounded-[1.75rem] border border-border/70 bg-white/95 p-6 shadow-sm shadow-brand-navy/5">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
              <div className="space-y-4">
                <div className="flex flex-wrap items-start gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-[1.35rem] border border-border/70 bg-slate-50 shadow-sm">
                    <Icon className="h-7 w-7 text-slate-700" />
                  </div>
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <h1 className="text-xl font-semibold text-foreground sm:text-2xl">
                        {item.name}
                      </h1>
                      <DetailStatusBadge
                        label={shopifyPageStatus.label}
                        tone={shopifyPageStatus.tone}
                      />
                      {detail.isFetching ? (
                        <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-slate-50 px-3 py-1 text-xs font-medium text-muted-foreground">
                          <RefreshCcw className="h-3.5 w-3.5" />
                          Refreshing
                        </span>
                      ) : null}
                    </div>

                    <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                      {shopifyPageStatus.summary}
                    </p>

                    <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                      <span>
                        Store{" "}
                        {shopifyConnection.shop_name?.trim() ||
                          shopifyConnection.shop_domain}
                      </span>
                      <span>Domain {shopifyConnection.shop_domain}</span>
                      <span>
                        Connected{" "}
                        {shopifyConnection.connected_at
                          ? formatRelativeTimestamp(
                              shopifyConnection.connected_at,
                            )
                          : "—"}
                      </span>
                    </div>

                    {shopifyAdminUrl && shopifyConnected ? (
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <a
                          href={shopifyAdminUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-brand-navy underline-offset-4 hover:underline"
                        >
                          {shopifyConnection.shop_domain}
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 self-start">
                {shopifyPrimaryAction ? (
                  <Button
                    type="button"
                    onClick={shopifyPrimaryAction.onClick}
                    disabled={shopifyPrimaryAction.disabled}
                  >
                    {detail.isShopifySyncing &&
                    shopifyConnected &&
                    !shopifyNeedsWebhookAttention ? (
                      <RefreshCcw className="mr-2 h-4 w-4" />
                    ) : null}
                    {shopifyPrimaryAction.label}
                  </Button>
                ) : null}
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/integrations/${seed.slug}/documentation`}>
                    <BookOpen className="mr-1.5 h-3.5 w-3.5" />
                    Documentation
                  </Link>
                </Button>
                {headerActionSections.length > 0 ? (
                  <ActionDropdown
                    label="Actions"
                    align="end"
                    sections={headerActionSections}
                    triggerClassName="min-w-[10rem] justify-between"
                  />
                ) : null}
              </div>
            </div>

            {detail.isError ? (
              <div className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50/80 px-4 py-4 text-sm text-rose-800 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <div className="font-semibold">
                      Unable to refresh integration details
                    </div>
                    <div className="mt-1 text-rose-700/90">
                      {getUserFacingIntegrationError(
                        detail.error,
                        "An unexpected error occurred while loading this integration.",
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void detail.refetch()}
                >
                  Retry
                </Button>
              </div>
            ) : null}

            {shopifyStatusBanner ? (
              <div
                className={cn(
                  "flex flex-col gap-3 rounded-2xl px-4 py-4 text-sm sm:flex-row sm:items-center sm:justify-between",
                  shopifyStatusBanner.tone === "danger"
                    ? "border border-rose-200 bg-rose-50/90 text-rose-900"
                    : "border border-amber-200 bg-amber-50/90 text-amber-900",
                )}
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <div className="font-semibold">
                      {shopifyStatusBanner.title}
                    </div>
                    <div className="mt-1 leading-6">
                      {shopifyStatusBanner.description}
                    </div>
                  </div>
                </div>
                <Button
                  type="button"
                  variant={
                    shopifyStatusBanner.tone === "danger"
                      ? "destructive"
                      : "outline"
                  }
                  onClick={shopifyStatusBanner.onAction}
                >
                  {shopifyStatusBanner.actionLabel}
                </Button>
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {shopifyMetricCards.map((card) => (
                <div
                  key={card.key}
                  className="rounded-[1.35rem] border border-border/70 bg-slate-50/60 p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        {card.label}
                      </div>
                      <div
                        className={cn(
                          "mt-3 text-3xl font-semibold tracking-tight text-slate-950",
                          card.valueClassName,
                        )}
                      >
                        {card.value}
                      </div>
                    </div>
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border/70 bg-white">
                      <card.icon className="h-5 w-5 text-slate-700" />
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {card.subtitle}
                  </p>
                </div>
              ))}
            </div>

            <div className="overflow-x-auto rounded-[1.35rem] border border-border/70 bg-slate-50/60 p-2">
              <div className="flex min-w-max items-center gap-2">
                {shopifyTabItems.map((tab) => {
                  const isActive = lightspeedTab === tab.value;

                  return (
                    <button
                      key={tab.value}
                      type="button"
                      onClick={() => setLightspeedTab(tab.value)}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-white text-slate-950 shadow-sm"
                          : "text-muted-foreground hover:bg-white/70 hover:text-slate-900",
                      )}
                    >
                      <span>{tab.label}</span>
                      {"count" in tab &&
                      typeof tab.count === "number" &&
                      tab.count > 0 ? (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                          {formatCount(tab.count)}
                        </span>
                      ) : null}
                      {"isActive" in tab && tab.isActive ? (
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-teal/50" />
                          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand-teal" />
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        ) : null}

        {!(
          (isLightspeed && lightspeedDetail) ||
          (isSquare && squareDetail) ||
          (isClover && cloverDetail) ||
          (isShopify && shopifyConnection)
        ) ? (
          <section className="rounded-[1.75rem] border border-border/70 bg-gradient-to-br from-white via-white to-brand-teal/5 p-6 shadow-sm shadow-brand-navy/5">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
              <div className="space-y-4">
                <div className="flex flex-wrap items-start gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border/70 bg-white shadow-sm">
                    <Icon className="h-6 w-6 text-slate-700" />
                  </div>
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
                        {item.name}
                      </h1>
                      <DetailStatusBadge
                        label={
                          comingSoonDetail?.statusLabel ??
                          emailInfrastructureDetail?.badgeLabel ??
                          (isMeta
                            ? (metaPageStatus?.label ?? model.statusLabel)
                            : isGa4
                              ? (ga4PageStatus?.label ?? model.statusLabel)
                              : model.statusLabel)
                        }
                        tone={
                          comingSoonDetail?.statusTone ??
                          emailInfrastructureDetail?.badgeTone ??
                          (isMeta
                            ? (metaPageStatus?.tone ?? model.statusTone)
                            : isGa4
                              ? (ga4PageStatus?.tone ?? model.statusTone)
                              : model.statusTone)
                        }
                      />
                      {detail.isFetching ? (
                        <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-white px-3 py-1 text-xs font-medium text-muted-foreground">
                          <RefreshCcw className="h-3.5 w-3.5" />
                          Refreshing
                        </span>
                      ) : null}
                    </div>
                    <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                      {isMeta
                        ? (metaPageStatus?.summary ??
                          item.detailSummary ??
                          item.description)
                        : isGa4
                          ? (ga4PageStatus?.summary ??
                            item.detailSummary ??
                            item.description)
                          : (item.detailSummary ?? item.description)}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      {metadataEntries.map((entry, index) => (
                        <div
                          key={`${entry}-${index}`}
                          className="inline-flex items-center gap-2"
                        >
                          {index > 0 ? (
                            <span className="text-border">&middot;</span>
                          ) : null}
                          <span>{entry}</span>
                        </div>
                      ))}
                    </div>
                    {isMarketingImport && marketingImportDetail ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-50">
                          {marketingImportDetail.importOnlyLabel}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="border-slate-200 text-slate-600"
                        >
                          Live Sync: {marketingImportDetail.liveSyncLabel}
                        </Badge>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              {isShopify ? <ConnectShopifyHint /> : null}

              <div className="flex flex-wrap items-center gap-2 self-start">
                {(isComingSoonPage && comingSoonPrimaryAction) ||
                (isShopify && shopifyPrimaryAction) ||
                (isEmailInfrastructure && emailInfrastructurePrimaryAction) ||
                (isMeta && metaPrimaryAction) ||
                (isGa4 && ga4PrimaryAction) ? (
                  <Button
                    type="button"
                    variant={
                      isComingSoonPage && comingSoonPrimaryAction
                        ? comingSoonPrimaryAction.variant
                        : isShopify && shopifyPrimaryAction
                          ? "default"
                          : isMeta && metaPrimaryAction
                            ? metaPrimaryAction.variant
                            : ga4PrimaryAction?.variant
                    }
                    className={cn(
                      isMeta && metaPrimaryAction
                        ? metaPrimaryAction.className
                        : ga4PrimaryAction?.className,
                    )}
                    disabled={
                      isComingSoonPage && comingSoonPrimaryAction
                        ? comingSoonPrimaryAction.disabled
                        : isShopify && shopifyPrimaryAction
                          ? shopifyPrimaryAction.disabled
                          : isEmailInfrastructure &&
                              emailInfrastructurePrimaryAction
                            ? emailInfrastructurePrimaryAction.disabled
                            : isMeta && metaPrimaryAction
                              ? metaPrimaryAction.disabled
                              : ga4PrimaryAction?.disabled
                    }
                    onClick={() => {
                      if (isComingSoonPage && comingSoonPrimaryAction) {
                        comingSoonPrimaryAction.onClick();
                        return;
                      }

                      if (isShopify && shopifyPrimaryAction) {
                        shopifyPrimaryAction.onClick();
                        return;
                      }

                      if (
                        isEmailInfrastructure &&
                        emailInfrastructurePrimaryAction
                      ) {
                        emailInfrastructurePrimaryAction.onClick();
                        return;
                      }

                      if (isMeta && metaPrimaryAction) {
                        metaPrimaryAction.onClick();
                        return;
                      }

                      ga4PrimaryAction?.onClick();
                    }}
                  >
                    {(isComingSoonPage && comingSoonPrimaryAction?.icon) ||
                    (isMeta && metaPrimaryAction?.icon) ||
                    (isGa4 && ga4PrimaryAction?.icon) ? (
                      (() => {
                        const ActionIcon = isComingSoonPage
                          ? comingSoonPrimaryAction?.icon
                          : isMeta
                            ? metaPrimaryAction?.icon
                            : ga4PrimaryAction?.icon;

                        return ActionIcon ? (
                          <ActionIcon className="mr-2 h-4 w-4" />
                        ) : null;
                      })()
                    ) : isEmailInfrastructure &&
                      emailInfrastructurePrimaryAction ? (
                      <FlaskConical className="mr-2 h-4 w-4" />
                    ) : isShopify && item.status !== "connected" ? (
                      <PlugZap className="mr-2 h-4 w-4" />
                    ) : null}
                    {isComingSoonPage && comingSoonPrimaryAction
                      ? comingSoonPrimaryAction.label
                      : isShopify && shopifyPrimaryAction
                        ? shopifyPrimaryAction.label
                        : isEmailInfrastructure &&
                            emailInfrastructurePrimaryAction
                          ? emailInfrastructurePrimaryAction.label
                          : isMeta && metaPrimaryAction
                            ? metaPrimaryAction.label
                            : ga4PrimaryAction?.label}
                  </Button>
                ) : null}
                {!isComingSoonPage ? (
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/integrations/${seed.slug}/documentation`}>
                      <BookOpen className="mr-1.5 h-3.5 w-3.5" />
                      Documentation
                    </Link>
                  </Button>
                ) : null}
                {displayedActionSections.length > 0 ? (
                  <ActionDropdown
                    label="Actions"
                    align="end"
                    sections={displayedActionSections}
                    triggerClassName="min-w-[10rem] justify-between"
                  />
                ) : null}
              </div>
            </div>

            {detail.isError ? (
              <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50/80 px-4 py-4 text-sm text-rose-800 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <div className="font-semibold">
                      Unable to refresh integration details
                    </div>
                    <div className="mt-1 text-rose-700/90">
                      {getUserFacingIntegrationError(
                        detail.error,
                        "An unexpected error occurred while loading this integration.",
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void detail.refetch()}
                >
                  Retry
                </Button>
              </div>
            ) : null}

            {model.errorBanner ? (
              <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-4 text-sm text-amber-900">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <div className="font-semibold">{model.errorBanner.title}</div>
                  <div className="mt-1 text-amber-800/90">
                    {model.errorBanner.description}
                  </div>
                </div>
              </div>
            ) : null}

            {isMeta && metaStatusBanner ? (
              <div
                className={cn(
                  "mt-6 flex flex-col gap-3 rounded-2xl px-4 py-4 text-sm sm:flex-row sm:items-center sm:justify-between",
                  metaStatusBanner.tone === "danger"
                    ? "border border-rose-200 bg-rose-50/90 text-rose-900"
                    : "border border-amber-200 bg-amber-50/90 text-amber-900",
                )}
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <div className="font-semibold">
                      {metaStatusBanner.title}
                    </div>
                    <div className="mt-1 leading-6">
                      {metaStatusBanner.description}
                    </div>
                  </div>
                </div>
                <Button
                  type="button"
                  variant={
                    metaStatusBanner.tone === "danger"
                      ? "destructive"
                      : "outline"
                  }
                  onClick={metaStatusBanner.onAction}
                >
                  {metaStatusBanner.actionLabel}
                </Button>
              </div>
            ) : null}

            {!isComingSoonPage ? (
              <div
                className={cn(
                  "mt-6 grid gap-4",
                  isSquare ||
                    isClover ||
                    isLightspeed ||
                    isMeta ||
                    isGa4 ||
                    isEmailInfrastructure ||
                    isMarketingImport
                    ? "md:grid-cols-2 xl:grid-cols-4"
                    : "md:grid-cols-3",
                )}
              >
                {(isSquare
                  ? squareMetricCards
                  : isClover
                    ? cloverMetricCards
                    : isLightspeed
                      ? lightspeedMetricCards
                      : isMeta
                        ? metaMetricCards
                        : isGa4
                          ? ga4MetricCards
                          : isEmailInfrastructure
                            ? emailInfrastructureMetricCards
                            : isMarketingImport
                              ? marketingImportMetricCards
                              : model.metrics
                ).map((metric) => {
                  const appearance = MetricAppearance({ tone: metric.tone });

                  return (
                    <CRMMetricCard
                      key={metric.key}
                      label={metric.label}
                      value={metric.value}
                      subtitle={
                        "timestamp" in metric && metric.timestamp
                          ? `${formatRelativeTimestamp(metric.timestamp)}${formatExactTimestamp(metric.timestamp) ? ` • ${formatExactTimestamp(metric.timestamp)}` : ""}`
                          : metric.subtitle
                      }
                      icon={
                        "icon" in metric
                          ? metric.icon
                          : metric.key === "connection"
                            ? PlugZap
                            : metric.key === "latest-signal"
                              ? Clock3
                              : Activity
                      }
                      iconClassName={appearance.iconClassName}
                      iconWrapClassName={appearance.iconWrapClassName}
                      valueClassName={
                        "valueClassName" in metric
                          ? metric.valueClassName
                          : undefined
                      }
                      appearance="flat"
                    />
                  );
                })}
              </div>
            ) : null}
          </section>
        ) : null}

        {isComingSoonPage && comingSoonDetail ? (
          <ComingSoonCard
            capabilities={comingSoonDetail.capabilities}
            callout={comingSoonDetail.callout}
            integrationName={comingSoonDetail.integrationName}
            notifyEmail={comingSoonDetail.notifyEmail}
            isSubmitted={comingSoonDetail.isSubmitted}
            isSubmitting={detail.isSubmittingComingSoonInterest}
            onSubmit={() => {
              void detail.submitComingSoonInterest();
            }}
            requestPath={comingSoonDetail.requestPath}
            notifyLabel={comingSoonDetail.notifyLabel}
            notifyConfirmation={comingSoonDetail.notifyConfirmation}
            requestLabel={comingSoonDetail.requestLabel}
            payloadPreview={comingSoonDetail.payloadPreview}
          />
        ) : isEmailInfrastructure && emailInfrastructureDetail ? (
          <div className="space-y-6">
            <div className="overflow-x-auto rounded-[1.35rem] border border-border/70 bg-slate-50/60 p-2">
              <div className="flex min-w-max items-center gap-2">
                {emailInfrastructureTabItems.map((tab) => {
                  const isActive = emailInfrastructureTab === tab.value;

                  return (
                    <button
                      key={tab.value}
                      type="button"
                      onClick={() => setEmailInfrastructureTab(tab.value)}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-white text-slate-950 shadow-sm"
                          : "text-muted-foreground hover:bg-white/70 hover:text-slate-900",
                      )}
                    >
                      <span>{tab.label}</span>
                      {"count" in tab && typeof tab.count === "number" ? (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                          {formatCount(tab.count)}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>

            {emailInfrastructureTab === "overview" ? (
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,1fr)]">
                <div className="space-y-6">
                  <SectionCard
                    title="Domain"
                    description="Current primary-domain state, environment, and setup readiness for BloomSuite email sending."
                  >
                    <OverviewPanel
                      title="Domain Status"
                      description={emailInfrastructureDetail.readinessSummary}
                      contextNote={
                        emailInfrastructureDetail.banner
                          ? {
                              tone: emailInfrastructureDetail.banner.tone,
                              content: (
                                <>
                                  <span className="font-semibold">
                                    {emailInfrastructureDetail.banner.title}
                                  </span>
                                  <span className="ml-2">
                                    {
                                      emailInfrastructureDetail.banner
                                        .description
                                    }
                                  </span>
                                </>
                              ),
                            }
                          : undefined
                      }
                    >
                      <DetailHealthRows
                        rows={emailInfrastructureDetail.healthRows.domain}
                      />
                    </OverviewPanel>
                  </SectionCard>

                  <SectionCard
                    title="DNS Health"
                    description="Public DNS verification state for the required records BloomSuite expects on the primary sending domain."
                  >
                    <OverviewPanel
                      title="Record Verification"
                      description="SPF, DKIM, and DMARC are evaluated from the currently stored DNS evidence for the primary domain."
                    >
                      <DetailHealthRows
                        rows={emailInfrastructureDetail.healthRows.dnsHealth}
                      />
                    </OverviewPanel>
                  </SectionCard>

                  <SectionCard
                    title="Sending Health"
                    description="Tenant-level deliverability and reputation signals already available from BloomSuite’s email health surfaces."
                  >
                    <OverviewPanel
                      title="Sending Overview"
                      description={emailInfrastructureDetail.healthSummary}
                    >
                      <DetailHealthRows
                        rows={
                          emailInfrastructureDetail.healthRows.sendingHealth
                        }
                      />
                    </OverviewPanel>
                  </SectionCard>
                </div>

                <div className="space-y-6">
                  <SectionCard
                    title="Domain Configuration"
                    description="Current provider mode, environment, and verification state for the primary sending domain."
                  >
                    <DetailFieldRows
                      rows={emailInfrastructureDetail.configurationRows}
                      onCopy={copyToClipboard}
                    />
                  </SectionCard>

                  <SectionCard
                    title="SPF, DKIM, DMARC Status"
                    description="Protocol-specific status for the records BloomSuite expects to see on the primary domain."
                  >
                    <DetailFieldRows
                      rows={emailInfrastructureDetail.protocolRows}
                    />
                  </SectionCard>

                  <SectionCard
                    title="Setup Tools"
                    description="Open the existing setup and troubleshooting flows already used by BloomSuite’s email infrastructure surfaces."
                  >
                    <div className="space-y-3">
                      {emailInfrastructureDetail.setupToolRows.map((tool) => (
                        <div
                          key={tool.label}
                          className="rounded-2xl border border-border/70 bg-slate-50/70 p-4"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0 flex-1">
                              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                {tool.label}
                              </div>
                              <div className="mt-2 text-sm text-muted-foreground">
                                {tool.description}
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => navigate(tool.path)}
                            >
                              Open
                            </Button>
                          </div>
                        </div>
                      ))}
                      <div className="flex flex-wrap gap-3 pt-1">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            window.location.href =
                              emailInfrastructureDetail.supportPath;
                          }}
                        >
                          Contact Support
                        </Button>
                      </div>
                    </div>
                  </SectionCard>
                </div>
              </div>
            ) : (
              <SectionCard
                title="DNS Records"
                description="The full set of DNS records currently stored for the primary sending domain, with copy actions for host names and values."
              >
                {emailInfrastructureDetail.dnsRecords.length > 0 ? (
                  <div className="overflow-hidden rounded-[1.25rem] border border-border/70 bg-white">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Purpose</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Host</TableHead>
                          <TableHead>Value</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Last Checked</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {emailInfrastructureDetail.dnsRecords.map((record) => {
                          const statusClasses = getToneClasses(
                            record.statusTone,
                          );
                          const hostCopyLabel = `DNS host ${record.id}`;
                          const valueCopyLabel = `DNS value ${record.id}`;

                          return (
                            <TableRow key={record.id}>
                              <TableCell className="font-medium text-slate-900">
                                {record.purpose.toUpperCase()}
                              </TableCell>
                              <TableCell>{record.type}</TableCell>
                              <TableCell>
                                <div className="flex items-start justify-between gap-2">
                                  <span className="min-w-0 break-all text-sm text-slate-900">
                                    {record.name}
                                  </span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 px-2"
                                    onClick={() =>
                                      copyToClipboard(
                                        record.name,
                                        hostCopyLabel,
                                      )
                                    }
                                    aria-label={
                                      copiedLabel === hostCopyLabel
                                        ? `${hostCopyLabel} copied`
                                        : `Copy ${hostCopyLabel}`
                                    }
                                  >
                                    {copiedLabel === hostCopyLabel ? (
                                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                                    ) : (
                                      <Copy className="h-3.5 w-3.5" />
                                    )}
                                  </Button>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-start justify-between gap-2">
                                  <span className="min-w-0 break-all text-sm text-slate-900">
                                    {record.value}
                                  </span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 px-2"
                                    onClick={() =>
                                      copyToClipboard(
                                        record.value,
                                        valueCopyLabel,
                                      )
                                    }
                                    aria-label={
                                      copiedLabel === valueCopyLabel
                                        ? `${valueCopyLabel} copied`
                                        : `Copy ${valueCopyLabel}`
                                    }
                                  >
                                    {copiedLabel === valueCopyLabel ? (
                                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                                    ) : (
                                      <Copy className="h-3.5 w-3.5" />
                                    )}
                                  </Button>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="space-y-1">
                                  <span
                                    className={cn(
                                      "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.14em]",
                                      statusClasses.badge,
                                    )}
                                  >
                                    {record.statusLabel}
                                  </span>
                                  <div className="text-xs text-muted-foreground">
                                    {record.statusReason}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                {formatTimestampOrFallback(
                                  record.lastCheckedAt,
                                  "No check recorded",
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border/80 bg-slate-50/70 p-4 text-sm leading-6 text-muted-foreground">
                    No DNS records are available yet for the current primary
                    domain. Add a sending domain first, then rerun the DNS check
                    to populate this table.
                  </div>
                )}
              </SectionCard>
            )}
          </div>
        ) : (
          <div
            className={cn(
              "grid gap-6",
              isLightspeed && lightspeedDetail
                ? "lg:grid-cols-[380px_minmax(0,1fr)]"
                : "xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]",
            )}
          >
            <div className="space-y-6">
              {isLightspeed && lightspeedDetail ? (
                <OverviewPanel
                  title="Integration Health"
                  description="A single operator view of connection, sync, and webhook readiness for this Lightspeed account."
                  action={
                    <DetailStatusBadge
                      label={lightspeedPageStatus.label}
                      tone={lightspeedPageStatus.tone}
                    />
                  }
                >
                  <div>
                    <HealthFieldRow
                      label="Connection"
                      value={
                        lightspeedNeedsReconnect
                          ? "Reconnect required"
                          : lightspeedConnectionHealthy
                            ? "Connected"
                            : (lightspeedDetail.connectionStatus ?? null)
                      }
                      tone={
                        lightspeedNeedsReconnect
                          ? "danger"
                          : lightspeedConnectionHealthy
                            ? "success"
                            : "neutral"
                      }
                      description={
                        lightspeedDetail.connectedAt
                          ? `Connected ${formatRelativeTimestamp(lightspeedDetail.connectedAt)}.`
                          : "No connection timestamp is available yet."
                      }
                    />
                    <HealthFieldRow
                      label="Sync status"
                      value={lightspeedSyncHealth.value}
                      tone={lightspeedSyncHealth.tone}
                      description={lightspeedSyncHealth.description}
                    />
                    <HealthFieldRow
                      label="Webhook mode"
                      value={lightspeedWebhookHealth.value}
                      tone={lightspeedWebhookHealth.tone}
                      description={lightspeedWebhookHealth.description}
                    />
                    <HealthFieldRow
                      label="Latest activity"
                      value={
                        lightspeedLatestSuccessfulActivityAt
                          ? formatRelativeTimestamp(
                              lightspeedLatestSuccessfulActivityAt,
                            )
                          : null
                      }
                      tone={
                        lightspeedLatestSuccessfulActivityAt
                          ? "success"
                          : "neutral"
                      }
                      description={
                        formatExactTimestamp(
                          lightspeedLatestSuccessfulActivityAt,
                        ) ??
                        "BloomSuite has not recorded a successful Lightspeed event yet."
                      }
                    />
                  </div>

                  {lightspeedHealthNote ? (
                    <div className="mt-4 rounded-lg border border-amber-100 bg-amber-50/70 p-3 text-sm leading-6 text-amber-900">
                      {lightspeedHealthNote}
                    </div>
                  ) : null}
                </OverviewPanel>
              ) : isShopify && shopifyConnection ? (
                <Tabs
                  value={lightspeedTab}
                  onValueChange={(value) =>
                    setLightspeedTab(value as LightspeedTabValue)
                  }
                  className="space-y-6"
                >
                  <TabsContent value="overview" className="space-y-5">
                    <OverviewPanel
                      title="Integration Health"
                      description="A single operator view of connection, queue-backed sync, webhook coverage, and automation readiness for this Shopify store."
                      action={
                        <DetailStatusBadge
                          label={shopifyPageStatus?.label ?? "Available"}
                          tone={shopifyPageStatus?.tone ?? "neutral"}
                        />
                      }
                    >
                      <div>
                        <FieldRow
                          label="Connection"
                          value={
                            shopifyAppUninstalled
                              ? "App uninstalled"
                              : shopifyConnected
                                ? "Connected"
                                : "Reconnect required"
                          }
                          tone={
                            shopifyAppUninstalled || !shopifyConnected
                              ? "danger"
                              : "success"
                          }
                          description={
                            shopifyConnection.connected_at
                              ? `Connected ${formatRelativeTimestamp(shopifyConnection.connected_at)}.`
                              : "No connection timestamp is available yet."
                          }
                        />
                        <FieldRow
                          label="Sync status"
                          value={
                            detail.shopifySyncState === "triggering"
                              ? "Creating jobs"
                              : detail.shopifySyncState === "syncing"
                                ? "In progress"
                                : "Idle"
                          }
                          tone={
                            detail.shopifySyncState === "idle"
                              ? "neutral"
                              : "success"
                          }
                          description={
                            detail.shopifySyncState === "idle"
                              ? "No active Shopify sync jobs."
                              : `${detail.shopifyActiveJobIds.length} active job${detail.shopifyActiveJobIds.length === 1 ? "" : "s"} currently running.`
                          }
                        />
                        <FieldRow
                          label="Webhook subscription"
                          value={
                            shopifyConnection.webhooks_subscribed
                              ? "Verified"
                              : "Needs verification"
                          }
                          tone={
                            shopifyConnection.webhooks_subscribed
                              ? "success"
                              : "warning"
                          }
                          description={
                            shopifyConnection.webhooks_last_checked_at
                              ? `Last checked ${formatRelativeTimestamp(shopifyConnection.webhooks_last_checked_at)}.`
                              : "Shopify webhook coverage has not been verified yet."
                          }
                        />
                        <FieldRow
                          label="Latest activity"
                          value={
                            shopifyLatestActivityAt
                              ? formatRelativeTimestamp(shopifyLatestActivityAt)
                              : null
                          }
                          description={
                            formatExactTimestamp(shopifyLatestActivityAt) ??
                            "BloomSuite has not recorded Shopify activity yet."
                          }
                          tone={shopifyLatestActivityAt ? "success" : "neutral"}
                        />
                        <FieldRow
                          label="Automation pipeline"
                          value="payment.completed"
                          tone="success"
                          description="Shopify paid orders flow into the existing BloomSuite payment automation contract."
                        />
                      </div>

                      {shopifyConnection.webhook_last_error ? (
                        <div className="mt-4 rounded-lg border border-amber-100 bg-amber-50/70 p-3 text-sm leading-6 text-amber-900">
                          {getUserFacingIntegrationError(
                            shopifyConnection.webhook_last_error,
                            "Shopify webhook verification needs operator review.",
                          )}
                        </div>
                      ) : null}
                    </OverviewPanel>

                    <OverviewPanel
                      title="Data Feeds"
                      description="BloomSuite reads synced Shopify customer, order, and product records from the tenant-scoped Shopify storage layer."
                      action={
                        <div className="flex items-center gap-1">
                          {detail.canAccessLightspeedAdminFeatures ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-muted-foreground hover:bg-gray-50 hover:text-slate-900"
                              onClick={() => navigate(SHOPIFY_DIAGNOSTICS_PATH)}
                            >
                              Diagnostics
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-muted-foreground hover:bg-gray-50 hover:text-slate-900"
                            onClick={() => setLightspeedTab("sync-logs")}
                          >
                            Sync Logs
                          </Button>
                        </div>
                      }
                    >
                      <div>
                        <DataFeedRow
                          label="Customer feed"
                          status={
                            shopifyConnection.last_customer_sync
                              ? "Active"
                              : "Pending"
                          }
                          tone={
                            shopifyConnection.last_customer_sync
                              ? "success"
                              : "warning"
                          }
                          description={
                            shopifyConnection.last_customer_sync
                              ? `Last synced ${formatRelativeTimestamp(shopifyConnection.last_customer_sync)} • ${formatCount(shopifyConnection.customers_synced)} records`
                              : `${formatCount(shopifyConnection.customers_synced)} records available`
                          }
                        />
                        <DataFeedRow
                          label="Order feed"
                          status={
                            shopifyConnection.last_sales_sync
                              ? "Active"
                              : "Pending"
                          }
                          tone={
                            shopifyConnection.last_sales_sync
                              ? "success"
                              : "warning"
                          }
                          description={
                            shopifyConnection.last_sales_sync
                              ? `Last synced ${formatRelativeTimestamp(shopifyConnection.last_sales_sync)} • ${formatCount(shopifyConnection.sales_synced)} records`
                              : `${formatCount(shopifyConnection.sales_synced)} records available`
                          }
                        />
                        <DataFeedRow
                          label="Product feed"
                          status={
                            shopifyConnection.last_product_sync
                              ? "Active"
                              : "Pending"
                          }
                          tone={
                            shopifyConnection.last_product_sync
                              ? "success"
                              : "warning"
                          }
                          description={
                            shopifyConnection.last_product_sync
                              ? `Last synced ${formatRelativeTimestamp(shopifyConnection.last_product_sync)} • ${formatCount(shopifyConnection.products_synced)} records`
                              : `${formatCount(shopifyConnection.products_synced)} records available`
                          }
                        />
                      </div>

                      <div className="mt-4 rounded-lg border border-gray-100 bg-slate-50/70 p-3 text-sm leading-6 text-muted-foreground">
                        Diagnostics and Sync Logs remain the operator tools for
                        verifying Shopify feed health when webhook coverage, API
                        access, or recent job failures need review.
                      </div>
                    </OverviewPanel>
                  </TabsContent>

                  <TabsContent value="customers" className="mt-0">
                    <ShopifyCustomersTabView
                      rows={shopifyDashboard?.customers.rows ?? []}
                      pagination={
                        shopifyDashboard?.customers.pagination ?? {
                          page: 1,
                          pageSize: 50,
                          totalCount: 0,
                          totalPages: 1,
                        }
                      }
                      isLoading={Boolean(shopifyDashboard?.customers.isLoading)}
                      isFetching={Boolean(
                        shopifyDashboard?.customers.isFetching,
                      )}
                      customersSynced={shopifyConnection.customers_synced ?? 0}
                      searchQuery={customerSearchInput}
                      onSearchQueryChange={(value) => {
                        setCustomerSearchInput(value);
                        setCustomerPage(1);
                      }}
                      sortField={shopifyCustomerSortField}
                      sortDirection={customerSortDirection}
                      onSortChange={(field, direction) => {
                        setShopifyCustomerSortField(field);
                        setCustomerSortDirection(direction);
                        setCustomerPage(1);
                      }}
                      onPageChange={setCustomerPage}
                      onTriggerSync={() => {
                        void detail.triggerShopifySync();
                      }}
                    />
                  </TabsContent>

                  <TabsContent value="sales" className="mt-0">
                    <ShopifyOrdersTabView
                      rows={shopifyDashboard?.orders.rows ?? []}
                      pagination={
                        shopifyDashboard?.orders.pagination ?? {
                          page: 1,
                          pageSize: 50,
                          totalCount: 0,
                          totalPages: 1,
                        }
                      }
                      summary={
                        shopifyDashboard?.orders.summary ?? {
                          revenue: 0,
                          averageOrderValue: 0,
                          saleCount: 0,
                        }
                      }
                      isLoading={Boolean(shopifyDashboard?.orders.isLoading)}
                      isFetching={Boolean(shopifyDashboard?.orders.isFetching)}
                      searchQuery={salesSearchInput}
                      onSearchQueryChange={(value) => {
                        setSalesSearchInput(value);
                        setSalesPage(1);
                      }}
                      status={salesStatus}
                      onStatusChange={(value) => {
                        setSalesStatus(value);
                        setSalesPage(1);
                      }}
                      startDate={salesStartDate}
                      endDate={salesEndDate}
                      onDateRangeChange={(startDate, endDate) => {
                        setSalesStartDate(startDate);
                        setSalesEndDate(endDate);
                        setSalesPage(1);
                      }}
                      sortField={shopifyOrdersSortField}
                      sortDirection={salesSortDirection}
                      onSortChange={(field, direction) => {
                        setShopifyOrdersSortField(field);
                        setSalesSortDirection(direction);
                        setSalesPage(1);
                      }}
                      onPageChange={setSalesPage}
                    />
                  </TabsContent>

                  <TabsContent value="products" className="mt-0">
                    <ShopifyProductsTabView
                      rows={shopifyDashboard?.products.rows ?? []}
                      pagination={
                        shopifyDashboard?.products.pagination ?? {
                          page: 1,
                          pageSize: 50,
                          totalCount: 0,
                          totalPages: 1,
                        }
                      }
                      categories={shopifyDashboard?.products.categories ?? []}
                      isLoading={Boolean(shopifyDashboard?.products.isLoading)}
                      isFetching={Boolean(
                        shopifyDashboard?.products.isFetching,
                      )}
                      searchQuery={productsSearchInput}
                      onSearchQueryChange={(value) => {
                        setProductsSearchInput(value);
                        setProductsPage(1);
                      }}
                      selectedCategories={productsCategories}
                      onSelectedCategoriesChange={(value) => {
                        setProductsCategories(value);
                        setProductsPage(1);
                      }}
                      inStockOnly={productsInStockOnly}
                      onInStockOnlyChange={(value) => {
                        setProductsInStockOnly(value);
                        setProductsPage(1);
                      }}
                      sortField={shopifyProductsSortField}
                      sortDirection={productsSortDirection}
                      onSortChange={(field, direction) => {
                        setShopifyProductsSortField(field);
                        setProductsSortDirection(direction);
                        setProductsPage(1);
                      }}
                      onPageChange={setProductsPage}
                      onTriggerSync={() => {
                        void detail.triggerShopifySync();
                      }}
                    />
                  </TabsContent>

                  <TabsContent value="sync-logs" className="mt-0">
                    <ShopifySyncLogsTabView
                      rows={shopifyDashboard?.syncLogs.rows ?? []}
                      pagination={
                        shopifyDashboard?.syncLogs.pagination ?? {
                          page: 1,
                          pageSize: 50,
                          totalCount: 0,
                          totalPages: 1,
                        }
                      }
                      isLoading={Boolean(shopifyDashboard?.syncLogs.isLoading)}
                      isFetching={Boolean(
                        shopifyDashboard?.syncLogs.isFetching,
                      )}
                      statusFilter={syncLogsStatus}
                      onStatusFilterChange={(value) => {
                        setSyncLogsStatus(value);
                        setSyncLogsPage(1);
                      }}
                      onPageChange={setSyncLogsPage}
                      onRetrySync={() => {
                        void detail.triggerShopifySync();
                      }}
                      onRefresh={() => {
                        void detail.refetch();
                      }}
                      trackedJobIds={detail.shopifyActiveJobIds}
                    />
                  </TabsContent>
                </Tabs>
              ) : isSquare && squareDetail ? (
                <>
                  <Tabs
                    value={lightspeedTab}
                    onValueChange={(value) =>
                      setLightspeedTab(value as LightspeedTabValue)
                    }
                    className="space-y-6"
                  >
                    <TabsContent value="overview" className="space-y-5">
                      <OverviewPanel
                        title="Integration Health"
                        description="A single operator view of connection, sync, webhook coverage, and automation readiness for this Square account."
                        action={
                          <DetailStatusBadge
                            label={squarePageStatus?.label ?? "Connected"}
                            tone={squarePageStatus?.tone ?? "neutral"}
                          />
                        }
                      >
                        <div>
                          <FieldRow
                            label="Connection"
                            value={
                              squareConnectionHealthy
                                ? "Connected"
                                : (squareDetail.connectionStatus ?? null)
                            }
                            tone={
                              squareConnectionHealthy ? "success" : "warning"
                            }
                            description={
                              squareDetail.connectedAt
                                ? `Connected ${formatRelativeTimestamp(squareDetail.connectedAt)}.`
                                : "No connection timestamp is available yet."
                            }
                          />
                          <FieldRow
                            label="Webhook subscription"
                            value={
                              squareDetail.webhooksSubscribed
                                ? "Verified"
                                : "Needs verification"
                            }
                            tone={
                              squareDetail.webhooksSubscribed
                                ? "success"
                                : "warning"
                            }
                            description={
                              squareDetail.webhooksLastCheckedAt
                                ? `Last checked ${formatRelativeTimestamp(squareDetail.webhooksLastCheckedAt)}.`
                                : "Square webhook coverage has not been verified yet."
                            }
                          />
                          <FieldRow
                            label="Latest activity"
                            value={
                              squareLatestActivityAt
                                ? formatRelativeTimestamp(
                                    squareLatestActivityAt,
                                  )
                                : null
                            }
                            description={
                              formatExactTimestamp(squareLatestActivityAt) ??
                              "BloomSuite has not recorded Square activity yet."
                            }
                            tone={
                              squareLatestActivityAt ? "success" : "neutral"
                            }
                          />
                          <FieldRow
                            label="Automation pipeline"
                            value="Active"
                            tone="success"
                            description="Square order and customer activity can flow into existing BloomSuite automations and activity logs."
                          />
                        </div>

                        {squareDetail.webhookLastError ? (
                          <div className="mt-4 rounded-lg border border-amber-100 bg-amber-50/70 p-3 text-sm leading-6 text-amber-900">
                            {getUserFacingIntegrationError(
                              squareDetail.webhookLastError,
                              "Square webhook verification needs operator review.",
                            )}
                          </div>
                        ) : null}
                      </OverviewPanel>

                      <OverviewPanel
                        title="Data Feeds"
                        description="BloomSuite currently reads synced Square customer, order, and catalog records from the shared POS storage layer."
                        action={
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-muted-foreground hover:bg-gray-50 hover:text-slate-900"
                              onClick={() =>
                                navigate(squareDetail.automationLogsPath)
                              }
                            >
                              Automation Logs
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-muted-foreground hover:bg-gray-50 hover:text-slate-900"
                              onClick={() => setLightspeedTab("sync-logs")}
                            >
                              Sync Logs
                            </Button>
                          </div>
                        }
                      >
                        <div>
                          <DataFeedRow
                            label="Customer feed"
                            status={
                              squareDetail.lastCustomerSync
                                ? "Active"
                                : "Pending"
                            }
                            tone={
                              squareDetail.lastCustomerSync
                                ? "success"
                                : "warning"
                            }
                            description={
                              squareDetail.lastCustomerSync
                                ? `Last synced ${formatRelativeTimestamp(squareDetail.lastCustomerSync)} • ${formatCount(squareDetail.customersSynced)} records`
                                : `${formatCount(squareDetail.customersSynced)} records available`
                            }
                          />
                          <DataFeedRow
                            label="Order feed"
                            status={
                              squareDetail.lastSalesSync ? "Active" : "Pending"
                            }
                            tone={
                              squareDetail.lastSalesSync ? "success" : "warning"
                            }
                            description={
                              squareDetail.lastSalesSync
                                ? `Last synced ${formatRelativeTimestamp(squareDetail.lastSalesSync)} • ${formatCount(squareDetail.salesSynced)} orders`
                                : `${formatCount(squareDetail.salesSynced)} orders available`
                            }
                          />
                          <DataFeedRow
                            label="Catalog feed"
                            status={
                              squareDetail.lastProductSync
                                ? "Active"
                                : "Pending"
                            }
                            tone={
                              squareDetail.lastProductSync
                                ? "success"
                                : "warning"
                            }
                            description={
                              squareDetail.lastProductSync
                                ? `Last synced ${formatRelativeTimestamp(squareDetail.lastProductSync)} • ${formatCount(squareDetail.productsSynced)} products`
                                : `${formatCount(squareDetail.productsSynced)} products available`
                            }
                          />
                        </div>
                      </OverviewPanel>
                    </TabsContent>

                    <TabsContent value="customers" className="mt-0">
                      <SquareCustomersTabView
                        connectionId={squareDetail.connectionId}
                        rows={squareDashboard?.customers.rows ?? []}
                        pagination={
                          squareDashboard?.customers.pagination ?? {
                            page: 1,
                            pageSize: 50,
                            totalCount: 0,
                            totalPages: 1,
                          }
                        }
                        isLoading={Boolean(
                          squareDashboard?.customers.isLoading,
                        )}
                        isFetching={Boolean(
                          squareDashboard?.customers.isFetching,
                        )}
                        customersSynced={squareDetail.customersSynced ?? 0}
                        searchQuery={customerSearchInput}
                        onSearchQueryChange={(value) => {
                          setCustomerSearchInput(value);
                          setCustomerPage(1);
                        }}
                        sortField={squareCustomerSortField}
                        sortDirection={customerSortDirection}
                        onSortChange={(field, direction) => {
                          setSquareCustomerSortField(field);
                          setCustomerSortDirection(direction);
                          setCustomerPage(1);
                        }}
                        selectedCustomer={selectedSquareCustomer}
                        onSelectedCustomerChange={setSelectedSquareCustomer}
                        onPageChange={setCustomerPage}
                        onTriggerSync={() => {
                          void detail.triggerSquareSync();
                        }}
                      />
                    </TabsContent>

                    <TabsContent value="sales" className="mt-0">
                      <SquareSalesTabView
                        connectionId={squareDetail.connectionId}
                        rows={squareDashboard?.sales.rows ?? []}
                        pagination={
                          squareDashboard?.sales.pagination ?? {
                            page: 1,
                            pageSize: 50,
                            totalCount: 0,
                            totalPages: 1,
                          }
                        }
                        summary={
                          squareDashboard?.sales.summary ?? {
                            revenue: 0,
                            averageOrderValue: 0,
                            saleCount: 0,
                          }
                        }
                        isLoading={Boolean(squareDashboard?.sales.isLoading)}
                        isFetching={Boolean(squareDashboard?.sales.isFetching)}
                        searchQuery={salesSearchInput}
                        onSearchQueryChange={(value) => {
                          setSalesSearchInput(value);
                          setSalesPage(1);
                        }}
                        status={salesStatus as "all" | "completed" | "open"}
                        onStatusChange={(value) => {
                          setSalesStatus(value);
                          setSalesPage(1);
                        }}
                        startDate={salesStartDate}
                        endDate={salesEndDate}
                        onDateRangeChange={(startDate, endDate) => {
                          setSalesStartDate(startDate);
                          setSalesEndDate(endDate);
                          setSalesPage(1);
                        }}
                        sortField={squareSalesSortField}
                        sortDirection={salesSortDirection}
                        onSortChange={(field, direction) => {
                          setSquareSalesSortField(field);
                          setSalesSortDirection(direction);
                          setSalesPage(1);
                        }}
                        selectedSale={selectedSquareSale}
                        onSelectedSaleChange={setSelectedSquareSale}
                        onPageChange={setSalesPage}
                      />
                    </TabsContent>

                    <TabsContent value="products" className="mt-0">
                      <SquareProductsTabView
                        connectionId={squareDetail.connectionId}
                        rows={squareDashboard?.products.rows ?? []}
                        pagination={
                          squareDashboard?.products.pagination ?? {
                            page: 1,
                            pageSize: 50,
                            totalCount: 0,
                            totalPages: 1,
                          }
                        }
                        categories={squareDashboard?.products.categories ?? []}
                        isLoading={Boolean(squareDashboard?.products.isLoading)}
                        isFetching={Boolean(
                          squareDashboard?.products.isFetching,
                        )}
                        searchQuery={productsSearchInput}
                        onSearchQueryChange={(value) => {
                          setProductsSearchInput(value);
                          setProductsPage(1);
                        }}
                        selectedCategories={productsCategories}
                        onSelectedCategoriesChange={(value) => {
                          setProductsCategories(value);
                          setProductsPage(1);
                        }}
                        inStockOnly={productsInStockOnly}
                        onInStockOnlyChange={(value) => {
                          setProductsInStockOnly(value);
                          setProductsPage(1);
                        }}
                        sortField={squareProductsSortField}
                        sortDirection={productsSortDirection}
                        onSortChange={(field, direction) => {
                          setSquareProductsSortField(field);
                          setProductsSortDirection(direction);
                          setProductsPage(1);
                        }}
                        onPageChange={setProductsPage}
                      />
                    </TabsContent>

                    <TabsContent value="sync-logs" className="mt-0">
                      <SquareSyncLogsTabView
                        connectionId={squareDetail.connectionId}
                        rows={squareDashboard?.syncLogs.rows ?? []}
                        pagination={
                          squareDashboard?.syncLogs.pagination ?? {
                            page: 1,
                            pageSize: 50,
                            totalCount: 0,
                            totalPages: 1,
                          }
                        }
                        isLoading={Boolean(squareDashboard?.syncLogs.isLoading)}
                        isFetching={Boolean(
                          squareDashboard?.syncLogs.isFetching,
                        )}
                        statusFilter={
                          syncLogsStatus as
                            | "all"
                            | "completed"
                            | "failed"
                            | "in_progress"
                        }
                        onStatusFilterChange={(value) => {
                          setSyncLogsStatus(value);
                          setSyncLogsPage(1);
                        }}
                        onPageChange={setSyncLogsPage}
                        onRetrySync={() => {
                          void detail.triggerSquareSync();
                        }}
                        onRefresh={() => {
                          void detail.refetch();
                        }}
                      />
                    </TabsContent>
                  </Tabs>
                </>
              ) : isClover && cloverDetail ? (
                <>
                  <Tabs
                    value={lightspeedTab}
                    onValueChange={(value) =>
                      setLightspeedTab(value as LightspeedTabValue)
                    }
                    className="space-y-6"
                  >
                    <TabsContent value="overview" className="space-y-5">
                      <OverviewPanel
                        title="Integration Health"
                        description="A single operator view of connection, sync coverage, app-level webhook readiness, and automation maturity for this Clover merchant."
                        action={
                          <DetailStatusBadge
                            label={cloverPageStatus?.label ?? "Connected"}
                            tone={cloverPageStatus?.tone ?? "neutral"}
                          />
                        }
                        contextNote={{
                          tone: cloverNeedsWebhookSetup ? "warning" : "info",
                          content:
                            "Clover webhook delivery is configured at the app level, not per merchant. BloomSuite reports real-time readiness based on app-level setup and observed event traffic.",
                        }}
                      >
                        <div>
                          <FieldRow
                            label="Connection"
                            value={
                              cloverConnectionHealthy
                                ? "Connected"
                                : (cloverDetail.connectionStatus ?? null)
                            }
                            tone={
                              cloverConnectionHealthy ? "success" : "warning"
                            }
                            description={
                              cloverDetail.connectedAt
                                ? `Connected ${formatRelativeTimestamp(cloverDetail.connectedAt)}.`
                                : "No connection timestamp is available yet."
                            }
                          />
                          <FieldRow
                            label="Webhook mode"
                            value={
                              cloverRealtimeEnabled ? "Real-time" : "Sync only"
                            }
                            tone={cloverRealtimeEnabled ? "success" : "warning"}
                            description={
                              cloverRealtimeEnabled
                                ? cloverDetail.lastWebhookReceivedAt
                                  ? `Last Clover webhook received ${formatRelativeTimestamp(cloverDetail.lastWebhookReceivedAt)}.`
                                  : "App-level webhook setup is present, but no recent Clover event has been recorded yet."
                                : "This merchant remains in sync-only mode until the shared Clover app webhook setup is complete."
                            }
                          />
                          <FieldRow
                            label="Latest activity"
                            value={
                              cloverLatestActivityAt
                                ? formatRelativeTimestamp(
                                    cloverLatestActivityAt,
                                  )
                                : null
                            }
                            description={
                              formatExactTimestamp(cloverLatestActivityAt) ??
                              "BloomSuite has not recorded Clover activity yet."
                            }
                            tone={
                              cloverLatestActivityAt ? "success" : "neutral"
                            }
                          />
                          <FieldRow
                            label="Automation pipeline"
                            value="Partial"
                            tone="warning"
                            description="Customer and messaging paths are active, while some Clover order and refund workflows remain partially implemented."
                          />
                        </div>

                        {cloverDetail.webhookLastError ? (
                          <div className="mt-4 rounded-lg border border-amber-100 bg-amber-50/70 p-3 text-sm leading-6 text-amber-900">
                            {getUserFacingIntegrationError(
                              cloverDetail.webhookLastError,
                              "Clover webhook monitoring needs operator review.",
                            )}
                          </div>
                        ) : null}
                      </OverviewPanel>

                      <OverviewPanel
                        title="Data Feeds"
                        description="BloomSuite reads synced Clover customers, orders, products, and sync jobs from the shared POS storage layer."
                        action={
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-muted-foreground hover:bg-gray-50 hover:text-slate-900"
                              onClick={() =>
                                navigate(cloverDetail.automationLogsPath)
                              }
                            >
                              Automation Logs
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-muted-foreground hover:bg-gray-50 hover:text-slate-900"
                              onClick={() => setLightspeedTab("sync-logs")}
                            >
                              Sync Logs
                            </Button>
                          </div>
                        }
                      >
                        <div>
                          <DataFeedRow
                            label="Customer feed"
                            status={
                              cloverDetail.lastCustomerSync
                                ? "Active"
                                : "Pending"
                            }
                            tone={
                              cloverDetail.lastCustomerSync
                                ? "success"
                                : "warning"
                            }
                            description={
                              cloverDetail.lastCustomerSync
                                ? `Last synced ${formatRelativeTimestamp(cloverDetail.lastCustomerSync)} • ${formatCount(cloverDetail.customersSynced)} records`
                                : `${formatCount(cloverDetail.customersSynced)} records available`
                            }
                          />
                          <DataFeedRow
                            label="Order feed"
                            status={
                              cloverDetail.lastSalesSync ? "Active" : "Pending"
                            }
                            tone={
                              cloverDetail.lastSalesSync ? "success" : "warning"
                            }
                            description={
                              cloverDetail.lastSalesSync
                                ? `Last synced ${formatRelativeTimestamp(cloverDetail.lastSalesSync)} • ${formatCount(cloverDetail.salesSynced)} orders`
                                : `${formatCount(cloverDetail.salesSynced)} orders available`
                            }
                          />
                          <DataFeedRow
                            label="Catalog feed"
                            status={
                              cloverDetail.lastProductSync
                                ? "Active"
                                : "Pending"
                            }
                            tone={
                              cloverDetail.lastProductSync
                                ? "success"
                                : "warning"
                            }
                            description={
                              cloverDetail.lastProductSync
                                ? `Last synced ${formatRelativeTimestamp(cloverDetail.lastProductSync)} • ${formatCount(cloverDetail.productsSynced)} products`
                                : `${formatCount(cloverDetail.productsSynced)} products available`
                            }
                          />
                        </div>
                      </OverviewPanel>
                    </TabsContent>

                    <TabsContent value="customers" className="mt-0">
                      <CloverCustomersTabView
                        connectionId={cloverDetail.connectionId}
                        rows={cloverDashboard?.customers.rows ?? []}
                        pagination={
                          cloverDashboard?.customers.pagination ?? {
                            page: 1,
                            pageSize: 50,
                            totalCount: 0,
                            totalPages: 1,
                          }
                        }
                        isLoading={Boolean(
                          cloverDashboard?.customers.isLoading,
                        )}
                        isFetching={Boolean(
                          cloverDashboard?.customers.isFetching,
                        )}
                        customersSynced={cloverDetail.customersSynced ?? 0}
                        searchQuery={customerSearchInput}
                        onSearchQueryChange={(value) => {
                          setCustomerSearchInput(value);
                          setCustomerPage(1);
                        }}
                        sortField={squareCustomerSortField}
                        sortDirection={customerSortDirection}
                        onSortChange={(field, direction) => {
                          setSquareCustomerSortField(field);
                          setCustomerSortDirection(direction);
                          setCustomerPage(1);
                        }}
                        selectedCustomer={selectedCloverCustomer}
                        onSelectedCustomerChange={setSelectedCloverCustomer}
                        onPageChange={setCustomerPage}
                        onTriggerSync={() => {
                          void detail.triggerCloverSync();
                        }}
                      />
                    </TabsContent>

                    <TabsContent value="sales" className="mt-0">
                      <CloverSalesTabView
                        connectionId={cloverDetail.connectionId}
                        rows={cloverDashboard?.sales.rows ?? []}
                        pagination={
                          cloverDashboard?.sales.pagination ?? {
                            page: 1,
                            pageSize: 50,
                            totalCount: 0,
                            totalPages: 1,
                          }
                        }
                        summary={
                          cloverDashboard?.sales.summary ?? {
                            revenue: 0,
                            averageOrderValue: 0,
                            saleCount: 0,
                          }
                        }
                        isLoading={Boolean(cloverDashboard?.sales.isLoading)}
                        isFetching={Boolean(cloverDashboard?.sales.isFetching)}
                        searchQuery={salesSearchInput}
                        onSearchQueryChange={(value) => {
                          setSalesSearchInput(value);
                          setSalesPage(1);
                        }}
                        status={salesStatus as "all" | "completed" | "open"}
                        onStatusChange={(value) => {
                          setSalesStatus(value);
                          setSalesPage(1);
                        }}
                        startDate={salesStartDate}
                        endDate={salesEndDate}
                        onDateRangeChange={(startDate, endDate) => {
                          setSalesStartDate(startDate);
                          setSalesEndDate(endDate);
                          setSalesPage(1);
                        }}
                        sortField={squareSalesSortField}
                        sortDirection={salesSortDirection}
                        onSortChange={(field, direction) => {
                          setSquareSalesSortField(field);
                          setSalesSortDirection(direction);
                          setSalesPage(1);
                        }}
                        selectedSale={selectedCloverSale}
                        onSelectedSaleChange={setSelectedCloverSale}
                        onPageChange={setSalesPage}
                      />
                    </TabsContent>

                    <TabsContent value="products" className="mt-0">
                      <CloverProductsTabView
                        connectionId={cloverDetail.connectionId}
                        rows={cloverDashboard?.products.rows ?? []}
                        pagination={
                          cloverDashboard?.products.pagination ?? {
                            page: 1,
                            pageSize: 50,
                            totalCount: 0,
                            totalPages: 1,
                          }
                        }
                        categories={cloverDashboard?.products.categories ?? []}
                        isLoading={Boolean(cloverDashboard?.products.isLoading)}
                        isFetching={Boolean(
                          cloverDashboard?.products.isFetching,
                        )}
                        searchQuery={productsSearchInput}
                        onSearchQueryChange={(value) => {
                          setProductsSearchInput(value);
                          setProductsPage(1);
                        }}
                        selectedCategories={productsCategories}
                        onSelectedCategoriesChange={(value) => {
                          setProductsCategories(value);
                          setProductsPage(1);
                        }}
                        inStockOnly={productsInStockOnly}
                        onInStockOnlyChange={(value) => {
                          setProductsInStockOnly(value);
                          setProductsPage(1);
                        }}
                        sortField={squareProductsSortField}
                        sortDirection={productsSortDirection}
                        onSortChange={(field, direction) => {
                          setSquareProductsSortField(field);
                          setProductsSortDirection(direction);
                          setProductsPage(1);
                        }}
                        onPageChange={setProductsPage}
                      />
                    </TabsContent>

                    <TabsContent value="sync-logs" className="mt-0">
                      <CloverSyncLogsTabView
                        connectionId={cloverDetail.connectionId}
                        rows={cloverDashboard?.syncLogs.rows ?? []}
                        pagination={
                          cloverDashboard?.syncLogs.pagination ?? {
                            page: 1,
                            pageSize: 50,
                            totalCount: 0,
                            totalPages: 1,
                          }
                        }
                        isLoading={Boolean(cloverDashboard?.syncLogs.isLoading)}
                        isFetching={Boolean(
                          cloverDashboard?.syncLogs.isFetching,
                        )}
                        statusFilter={
                          syncLogsStatus as
                            | "all"
                            | "completed"
                            | "failed"
                            | "in_progress"
                        }
                        onStatusFilterChange={(value) => {
                          setSyncLogsStatus(value);
                          setSyncLogsPage(1);
                        }}
                        onPageChange={setSyncLogsPage}
                        onRetrySync={() => {
                          void detail.triggerCloverSync();
                        }}
                        onRefresh={() => {
                          void detail.refetch();
                        }}
                      />
                    </TabsContent>

                    <TabsContent value="connection-test" className="mt-0">
                      <CloverConnectionTestTabView
                        rows={cloverDashboard?.connectionTests.rows ?? []}
                        latestReport={
                          cloverDashboard?.connectionTests.latestReport ?? null
                        }
                        latestTestedAt={
                          cloverDashboard?.connectionTests.latestTestedAt ??
                          null
                        }
                        pagination={
                          cloverDashboard?.connectionTests.pagination ?? {
                            page: 1,
                            pageSize: 50,
                            totalCount: 0,
                            totalPages: 1,
                          }
                        }
                        isLoading={Boolean(
                          cloverDashboard?.connectionTests.isLoading,
                        )}
                        isFetching={Boolean(
                          cloverDashboard?.connectionTests.isFetching,
                        )}
                        isRunning={detail.isCloverConnectionTesting}
                        onRunTest={() => {
                          void detail.runCloverConnectionTest();
                        }}
                        onPageChange={setSyncLogsPage}
                      />
                    </TabsContent>
                  </Tabs>
                </>
              ) : isMeta && metaDetail ? (
                <OverviewPanel
                  title="Integration Health"
                  description="Authorization, connected social assets, and publishing readiness for the shared Meta connection."
                  action={
                    <DetailStatusBadge
                      label={metaPageStatus?.label ?? "Not connected"}
                      tone={metaPageStatus?.tone ?? "neutral"}
                    />
                  }
                >
                  <div className="space-y-5">
                    <div className="space-y-3">
                      <div className="text-sm font-semibold text-slate-950">
                        Authorization
                      </div>
                      <div>
                        <FieldRow
                          label="Status"
                          value={
                            metaTokenExpired
                              ? "Expired"
                              : metaTokenExpiringSoon
                                ? "Expiring soon"
                                : metaDetail.authorizationStatus ===
                                    "authorized"
                                  ? "Authorized"
                                  : "Not connected"
                          }
                          tone={
                            metaTokenExpired
                              ? "danger"
                              : metaTokenExpiringSoon
                                ? "warning"
                                : metaDetail.authorizationStatus ===
                                    "authorized"
                                  ? "success"
                                  : "neutral"
                          }
                        />
                        <FieldRow
                          label="Token expires"
                          value={
                            formatRelativePlusAbsolute(
                              metaDetail.expiresAt,
                              "—",
                            ).value
                          }
                          description={
                            formatRelativePlusAbsolute(
                              metaDetail.expiresAt,
                              "—",
                            ).description
                          }
                          tone={
                            metaTokenExpired
                              ? "danger"
                              : metaTokenExpiringSoon
                                ? "warning"
                                : "neutral"
                          }
                        />
                        <FieldRow
                          label="Connected since"
                          value={
                            formatRelativePlusAbsolute(
                              metaDetail.connectedAt,
                              "—",
                            ).value
                          }
                          description={
                            formatRelativePlusAbsolute(
                              metaDetail.connectedAt,
                              "—",
                            ).description
                          }
                        />
                      </div>
                      {metaTokenExpired ? (
                        <div className="rounded-lg border border-rose-200 bg-rose-50/80 p-3 text-sm leading-6 text-rose-900">
                          Access token expired on{" "}
                          {formatDateValue(metaDetail.expiresAt)}. Re-authorize
                          to restore access.
                        </div>
                      ) : null}
                    </div>

                    <div className="space-y-3 border-t border-border/60 pt-4">
                      <div className="text-sm font-semibold text-slate-950">
                        Facebook Pages
                      </div>
                      <FieldRow
                        label="Status"
                        value={`${metaDetail.facebookPages.filter((asset) => asset.active).length} pages connected`}
                        tone={
                          metaDetail.facebookPageCount > 0
                            ? "success"
                            : "neutral"
                        }
                      />
                      <MetaAssetList
                        assets={metaDetail.facebookPages}
                        emptyMessage="No pages connected"
                        onCopy={copyToClipboard}
                        onOpen={() => navigate(metaDetail.managementPath)}
                      />
                    </div>

                    <div className="space-y-3 border-t border-border/60 pt-4">
                      <div className="text-sm font-semibold text-slate-950">
                        Instagram Accounts
                      </div>
                      <FieldRow
                        label="Status"
                        value={`${metaDetail.instagramAccounts.filter((asset) => asset.active).length} accounts connected`}
                        tone={
                          metaDetail.instagramAccountCount > 0
                            ? "success"
                            : "neutral"
                        }
                      />
                      <MetaAssetList
                        assets={metaDetail.instagramAccounts}
                        emptyMessage="No accounts connected"
                        onCopy={copyToClipboard}
                        onOpen={() => navigate(metaDetail.managementPath)}
                      />
                    </div>
                  </div>
                </OverviewPanel>
              ) : isGa4 && ga4Detail ? (
                <OverviewPanel
                  title="Integration Health"
                  description="Authorization, property access, and reporting readiness for the connected GA4 property."
                  action={
                    <DetailStatusBadge
                      label={ga4PageStatus?.label ?? "Not connected"}
                      tone={ga4PageStatus?.tone ?? "neutral"}
                    />
                  }
                >
                  <div className="space-y-5">
                    <div className="space-y-3">
                      <div className="text-sm font-semibold text-slate-950">
                        Authorization
                      </div>
                      <div>
                        <FieldRow
                          label="Status"
                          value={
                            ga4ConnectionHealthy
                              ? "Authorized"
                              : ga4NeedsReconnect
                                ? "Reconnect required"
                                : "Not connected"
                          }
                          tone={
                            ga4ConnectionHealthy
                              ? "success"
                              : ga4NeedsReconnect
                                ? "danger"
                                : "neutral"
                          }
                        />
                        <FieldRow
                          label="Connected since"
                          value={
                            formatRelativePlusAbsolute(
                              ga4Detail.connectedAt,
                              "—",
                            ).value
                          }
                          description={
                            formatRelativePlusAbsolute(
                              ga4Detail.connectedAt,
                              "—",
                            ).description
                          }
                        />
                        <FieldRow
                          label="Google account"
                          value={ga4Detail.googleAccountEmail ?? "—"}
                        />
                      </div>
                    </div>

                    <div className="space-y-3 border-t border-border/60 pt-4">
                      <div className="text-sm font-semibold text-slate-950">
                        Property
                      </div>
                      <div>
                        <FieldRow
                          label="Property name"
                          value={ga4Detail.propertyName ?? "—"}
                        />
                        <FieldRow
                          label="Measurement ID"
                          value={ga4Detail.measurementId ?? "—"}
                          copyValue={ga4Detail.measurementId ?? undefined}
                          copyLabel="Measurement ID"
                          copiedLabel={copiedLabel}
                          onCopy={copyToClipboard}
                        />
                        <FieldRow
                          label="Last data pull"
                          value={
                            formatRelativePlusAbsolute(
                              ga4Detail.lastPullAt,
                              "—",
                            ).value
                          }
                          description={
                            formatRelativePlusAbsolute(
                              ga4Detail.lastPullAt,
                              "—",
                            ).description
                          }
                        />
                        <FieldRow label="Pull cadence" value="Daily" />
                      </div>
                    </div>

                    <div className="space-y-3 border-t border-border/60 pt-4">
                      <div className="text-sm font-semibold text-slate-950">
                        Data Access
                      </div>
                      <div>
                        <FieldRow
                          label="Status"
                          value={
                            ga4ConnectionHealthy ? "Active" : "Unavailable"
                          }
                          tone={ga4ConnectionHealthy ? "success" : "neutral"}
                        />
                        <FieldRow
                          label="Historical data"
                          value="Last 90 days on connection"
                        />
                        <FieldRow
                          label="Read permissions"
                          value={
                            ga4Detail.readPermissionsConfirmed
                              ? "Confirmed"
                              : "Not confirmed"
                          }
                          tone={
                            ga4Detail.readPermissionsConfirmed
                              ? "success"
                              : "warning"
                          }
                          description={
                            ga4Detail.readPermissionsConfirmed
                              ? "analytics.readonly access is available for reporting pulls."
                              : "Re-authorize to confirm the GA4 reporting permission set."
                          }
                        />
                      </div>
                    </div>
                  </div>
                </OverviewPanel>
              ) : isMarketingImport && marketingImportDetail ? (
                <>
                  <SectionCard
                    title="Authorization"
                    description="Current provider authorization state and the last recorded connection update for this tenant."
                  >
                    <DetailHealthRows
                      rows={marketingImportDetail.healthRows.authorization}
                    />
                  </SectionCard>

                  <SectionCard
                    title="Import History"
                    description="Latest import activity and all-time import volume recorded for this provider."
                  >
                    <DetailHealthRows
                      rows={marketingImportDetail.healthRows.importHistory}
                    />
                  </SectionCard>

                  <SectionCard
                    title={
                      marketingImportDetail.providerSlug === "mailchimp"
                        ? "Recent Imports"
                        : "Import Timeline"
                    }
                    description={
                      marketingImportDetail.providerSlug === "mailchimp"
                        ? "Recent completed Mailchimp imports recorded for this provider."
                        : "Connection and recent import milestones recorded for this provider."
                    }
                  >
                    <DetailTimeline entries={marketingImportDetail.timeline} />
                  </SectionCard>
                </>
              ) : (
                <>
                  <SectionCard
                    title="Connection Health"
                    description="Connection lifecycle and provider events for this integration."
                  >
                    <DetailTimeline entries={model.timeline} />
                  </SectionCard>

                  <SectionCard
                    title="Webhook Health"
                    description="Subscription, retry, and delivery state based on existing provider telemetry."
                  >
                    <DetailHealthRows rows={model.webhookRows} />
                  </SectionCard>

                  <SectionCard
                    title="Sync Health"
                    description="Last sync or verification state and the display-safe counters available today."
                  >
                    <DetailHealthRows rows={model.syncRows} />
                  </SectionCard>
                </>
              )}
            </div>

            <div className="space-y-6">
              {isShopify && shopifyConnection ? (
                <>
                  <SectionCard
                    title="Store Details"
                    description="Store identity and OAuth metadata stored for this tenant's Shopify connection."
                  >
                    <div>
                      <FieldRow
                        label="Store name"
                        value={
                          shopifyConnection.shop_name ??
                          shopifyConnection.shop_domain
                        }
                      />
                      <FieldRow
                        label="Store domain"
                        value={shopifyConnection.shop_domain}
                        copyValue={shopifyConnection.shop_domain}
                        copyLabel="Store domain"
                        copiedLabel={copiedLabel}
                        onCopy={copyToClipboard}
                      />
                      <FieldRow
                        label="Store owner"
                        value={shopifyConnection.shop_owner ?? "—"}
                      />
                      <FieldRow
                        label="Store email"
                        value={shopifyConnection.shop_email ?? "—"}
                      />
                      <FieldRow
                        label="Scopes granted"
                        value={
                          shopifyScopeCount > 0
                            ? String(shopifyScopeCount)
                            : null
                        }
                        description={
                          shopifyScopeCount > 0
                            ? `${shopifyScopeCount} OAuth scope${shopifyScopeCount === 1 ? "" : "s"} stored for this installation.`
                            : "OAuth scope metadata is not available for this store."
                        }
                        tone={shopifyScopeCount > 0 ? "success" : "neutral"}
                      />
                      <FieldRow
                        label="Connected"
                        value={
                          shopifyConnection.connected_at
                            ? formatRelativeTimestamp(
                                shopifyConnection.connected_at,
                              )
                            : null
                        }
                        description={formatExactTimestamp(
                          shopifyConnection.connected_at,
                        )}
                      />
                    </div>
                  </SectionCard>

                  <SectionCard
                    title="Sync Status"
                    description="Current Shopify sync coverage and last recorded telemetry per data domain."
                  >
                    <div>
                      <SyncTypeRow
                        label="Customers"
                        lastSyncedAt={shopifyConnection.last_customer_sync}
                        syncedCount={shopifyConnection.customers_synced}
                        isSyncing={detail.shopifySyncState !== "idle"}
                      />
                      <SyncTypeRow
                        label="Orders"
                        lastSyncedAt={shopifyConnection.last_sales_sync}
                        syncedCount={shopifyConnection.sales_synced}
                        isSyncing={detail.shopifySyncState !== "idle"}
                      />
                      <SyncTypeRow
                        label="Products"
                        lastSyncedAt={shopifyConnection.last_product_sync}
                        syncedCount={shopifyConnection.products_synced}
                        isSyncing={detail.shopifySyncState !== "idle"}
                      />
                    </div>
                  </SectionCard>

                  <SectionCard
                    title="Webhook Subscription"
                    description="Subscription state, retry telemetry, and required topic coverage for BloomSuite's Shopify webhook intake."
                  >
                    <div>
                      <FieldRow
                        label="Subscription state"
                        value={
                          shopifyConnection.webhooks_subscribed
                            ? "Verified"
                            : "Needs verification"
                        }
                        tone={
                          shopifyConnection.webhooks_subscribed
                            ? "success"
                            : "warning"
                        }
                      />
                      <FieldRow
                        label="Required topics"
                        value="11"
                        description="BloomSuite verifies 11 required Shopify webhook topics, including app/uninstalled."
                      />
                      <FieldRow
                        label="Subscription IDs"
                        value={
                          Array.isArray(
                            shopifyConnection.webhook_subscription_ids,
                          )
                            ? String(
                                shopifyConnection.webhook_subscription_ids
                                  .length,
                              )
                            : null
                        }
                        description="Stored webhook subscription references currently tracked for this store."
                      />
                      <FieldRow
                        label="Last checked"
                        value={
                          shopifyConnection.webhooks_last_checked_at
                            ? formatRelativeTimestamp(
                                shopifyConnection.webhooks_last_checked_at,
                              )
                            : null
                        }
                        description={formatExactTimestamp(
                          shopifyConnection.webhooks_last_checked_at,
                        )}
                      />
                      <FieldRow
                        label="Last event"
                        value={
                          shopifyConnection.last_webhook_received_at
                            ? formatRelativeTimestamp(
                                shopifyConnection.last_webhook_received_at,
                              )
                            : null
                        }
                        description={formatExactTimestamp(
                          shopifyConnection.last_webhook_received_at,
                        )}
                      />
                      <FieldRow
                        label="Retry queue"
                        value={
                          (shopifyConnection.webhook_retry_count ?? 0) > 0
                            ? `${shopifyConnection.webhook_retry_count} pending`
                            : "No retries pending"
                        }
                        tone={
                          (shopifyConnection.webhook_retry_count ?? 0) > 0
                            ? "warning"
                            : "neutral"
                        }
                      />
                      <FieldRow
                        label="Next retry"
                        value={
                          shopifyConnection.webhook_next_retry_at
                            ? formatRelativeTimestamp(
                                shopifyConnection.webhook_next_retry_at,
                              )
                            : null
                        }
                        description={formatExactTimestamp(
                          shopifyConnection.webhook_next_retry_at,
                        )}
                      />
                    </div>

                    {shopifyConnection.webhook_last_error ? (
                      <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900">
                        <div className="font-semibold">Last webhook error</div>
                        <div className="mt-1 leading-6 text-amber-800/90">
                          {getUserFacingIntegrationError(
                            shopifyConnection.webhook_last_error,
                            "Shopify webhook coverage needs operator review.",
                          )}
                        </div>
                      </div>
                    ) : null}
                  </SectionCard>

                  <SectionCard
                    title="Automation Pipeline"
                    description="How Shopify store events currently map into BloomSuite CRM and automation flows."
                  >
                    <div>
                      <HealthFieldRow
                        label="Payment trigger"
                        value="payment.completed"
                        tone="success"
                        description="Paid Shopify orders route into the existing BloomSuite payment automation contract."
                      />
                      <HealthFieldRow
                        label="Customer writes"
                        value="Active"
                        tone="success"
                        description="Shopify customer events can update CRM customer records for this tenant."
                      />
                      <HealthFieldRow
                        label="Refund handling"
                        value="Active"
                        tone="success"
                        description="Refund creation events are part of the required Shopify webhook set and feed the current event pipeline."
                      />
                      <HealthFieldRow
                        label="Product updates"
                        value="Active"
                        tone="success"
                        description="Product create and update webhooks keep BloomSuite's synced Shopify catalog current."
                      />
                    </div>
                  </SectionCard>
                </>
              ) : isSquare && squareDetail ? (
                <>
                  <SectionCard
                    title="Merchant Details"
                    description="Identifiers and connection metadata stored for this Square merchant."
                  >
                    <KeyValueGrid
                      entries={[
                        {
                          label: "Merchant Name",
                          value: squareDetail.merchantName ?? "Not available",
                        },
                        {
                          label: "Merchant ID",
                          value: squareDetail.merchantId ?? "Not available",
                        },
                        {
                          label: "Location ID",
                          value: squareDetail.locationId ?? "Not available",
                        },
                        {
                          label: "Environment",
                          value: formatEnvironmentLabel(
                            squareDetail.environment,
                          ),
                        },
                        {
                          label: "Token Type",
                          value: formatTokenType(squareDetail.tokenType),
                        },
                        {
                          label: "Connected",
                          value:
                            formatExactTimestamp(squareDetail.connectedAt) ??
                            "Not connected yet",
                        },
                      ]}
                    />
                  </SectionCard>

                  <SectionCard
                    title="Sync Configuration"
                    description="Current Square sync coverage and the last recorded timestamp per domain."
                  >
                    <div className="space-y-3">
                      {[
                        {
                          label: "Customers",
                          value: squareDetail.lastCustomerSync
                            ? `Last synced ${formatRelativeTimestamp(squareDetail.lastCustomerSync)}`
                            : "Not synced yet",
                          description: `${formatCount(squareDetail.customersSynced)} customer records synced`,
                        },
                        {
                          label: "Sales",
                          value: squareDetail.lastSalesSync
                            ? `Last synced ${formatRelativeTimestamp(squareDetail.lastSalesSync)}`
                            : "Not synced yet",
                          description: `${formatCount(squareDetail.salesSynced)} sales records synced`,
                        },
                        {
                          label: "Products",
                          value: squareDetail.lastProductSync
                            ? `Last synced ${formatRelativeTimestamp(squareDetail.lastProductSync)}`
                            : "Not synced yet",
                          description: `${formatCount(squareDetail.productsSynced)} product records synced`,
                        },
                      ].map((entry) => (
                        <div
                          key={entry.label}
                          className="rounded-2xl border border-border/70 bg-slate-50/70 p-4"
                        >
                          <div className="text-sm font-semibold text-slate-950">
                            {entry.label}
                          </div>
                          <div className="mt-1 text-sm text-muted-foreground">
                            {entry.value}
                          </div>
                          <div className="mt-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                            {entry.description}
                          </div>
                        </div>
                      ))}
                    </div>
                  </SectionCard>

                  <SectionCard
                    title="Webhook Subscription Status"
                    description="Square webhook subscription health and the required event coverage BloomSuite expects."
                  >
                    <KeyValueGrid
                      entries={[
                        {
                          label: "Subscription State",
                          value: squareDetail.webhooksSubscribed
                            ? "Subscribed"
                            : "Attention needed",
                        },
                        {
                          label: "Subscription ID",
                          value:
                            squareDetail.webhookSubscriptionId ??
                            "Not available",
                        },
                        {
                          label: "Last Checked",
                          value:
                            formatExactTimestamp(
                              squareDetail.webhooksLastCheckedAt,
                            ) ?? "Not yet checked",
                        },
                        {
                          label: "Last Event",
                          value:
                            formatExactTimestamp(
                              squareDetail.lastWebhookReceivedAt,
                            ) ?? "Not yet received",
                        },
                        {
                          label: "Retry Queue",
                          value: squareDetail.webhookRetryCount
                            ? `${squareDetail.webhookRetryCount} pending`
                            : "No retries pending",
                        },
                        {
                          label: "Next Retry",
                          value:
                            formatExactTimestamp(
                              squareDetail.webhookNextRetryAt,
                            ) ?? "Not scheduled",
                        },
                      ]}
                    />
                    {squareDetail.webhookLastError ? (
                      <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900">
                        <div className="font-semibold">Last webhook error</div>
                        <div className="mt-1 leading-6 text-amber-800/90">
                          {getUserFacingIntegrationError(
                            squareDetail.webhookLastError,
                            "This integration needs attention. Please try again or reconnect the integration.",
                          )}
                        </div>
                      </div>
                    ) : null}
                    <div className="mt-4">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Required event types
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {squareDetail.requiredWebhookEvents.map((eventType) => (
                          <span
                            key={eventType}
                            className="inline-flex items-center rounded-full border border-border/70 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700"
                          >
                            {eventType}
                          </span>
                        ))}
                      </div>
                    </div>
                  </SectionCard>

                  <SectionCard
                    title="Automation Integration"
                    description="Square activity feeds BloomSuite automation and activity workflows through existing CRM surfaces."
                  >
                    <div className="rounded-2xl border border-border/70 bg-slate-50/70 p-4">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl border border-border/70 bg-white">
                          <Bot className="h-4.5 w-4.5 text-slate-700" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-950">
                            Existing automation routing
                          </div>
                          <p className="mt-1 text-sm leading-6 text-muted-foreground">
                            Use CRM Automations to review triggers and rules
                            that react to Square customer, order, and catalog
                            activity. Use Activity Center for the latest
                            automation and sync events tied to Square.
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-3">
                        <Button
                          type="button"
                          onClick={() => navigate(squareDetail.automationPath)}
                        >
                          Open automations
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() =>
                            navigate(squareDetail.automationLogsPath)
                          }
                        >
                          View automation logs
                        </Button>
                      </div>
                    </div>
                  </SectionCard>
                </>
              ) : isClover && cloverDetail ? (
                <>
                  <SectionCard
                    title="Merchant Details"
                    description="Merchant identifiers and Clover connection metadata stored for this tenant."
                  >
                    <div>
                      <FieldRow
                        label="Merchant name"
                        value={cloverDetail.merchantName}
                      />
                      <FieldRow
                        label="Merchant ID"
                        value={cloverDetail.merchantId}
                        copyValue={cloverDetail.merchantId}
                        copyLabel="Merchant ID"
                        copiedLabel={copiedLabel}
                        onCopy={copyToClipboard}
                      />
                      <FieldRow
                        label="Employee ID"
                        value={cloverDetail.employeeId}
                        copyValue={cloverDetail.employeeId}
                        copyLabel="Employee ID"
                        copiedLabel={copiedLabel}
                        onCopy={copyToClipboard}
                      />
                      <FieldRow
                        label="Region"
                        value={renderCloverRegionBadge(cloverDetail.region)}
                      />
                      <FieldRow
                        label="Environment"
                        value={formatEnvironmentLabel(cloverDetail.environment)}
                      />
                      <FieldRow
                        label="Connected"
                        value={
                          cloverDetail.connectedAt
                            ? formatRelativeTimestamp(cloverDetail.connectedAt)
                            : null
                        }
                        description={formatExactTimestamp(
                          cloverDetail.connectedAt,
                        )}
                      />
                      <FieldRow
                        label="Setup wizard"
                        value={
                          cloverDetail.setupWizardCompletedAt
                            ? formatRelativeTimestamp(
                                cloverDetail.setupWizardCompletedAt,
                              )
                            : "Not completed"
                        }
                        description={
                          formatExactTimestamp(
                            cloverDetail.setupWizardCompletedAt,
                          ) ?? "Setup has not been completed yet."
                        }
                        tone={
                          cloverDetail.setupWizardCompletedAt
                            ? "success"
                            : "warning"
                        }
                      />
                    </div>
                  </SectionCard>

                  <SectionCard
                    title="Sync Status"
                    description="Current Clover sync coverage and last known telemetry per domain."
                  >
                    <div>
                      <SyncTypeRow
                        label="Customers"
                        lastSyncedAt={cloverDetail.lastCustomerSync}
                        syncedCount={cloverDetail.customersSynced}
                        isSyncing={detail.isCloverSyncing}
                      />
                      <SyncTypeRow
                        label="Sales"
                        lastSyncedAt={cloverDetail.lastSalesSync}
                        syncedCount={cloverDetail.salesSynced}
                        isSyncing={detail.isCloverSyncing}
                      />
                      <SyncTypeRow
                        label="Products"
                        lastSyncedAt={cloverDetail.lastProductSync}
                        syncedCount={cloverDetail.productsSynced}
                        isSyncing={detail.isCloverSyncing}
                      />
                    </div>
                  </SectionCard>

                  <SectionCard
                    title="Webhook Mode"
                    description="App-level Clover webhook readiness and the latest delivery telemetry available to BloomSuite."
                  >
                    <div className="space-y-4">
                      <div className="rounded-2xl border border-border/70 bg-slate-50/70 p-4 text-sm leading-6 text-muted-foreground">
                        {cloverRealtimeEnabled
                          ? "Clover is operating in real-time mode for this tenant because the shared app-level webhook configuration is present and BloomSuite has recorded Clover event traffic."
                          : "Clover is operating in sync-only mode for this tenant. Merchant-level webhook provisioning is not supported here; real-time events depend on shared app-level setup."}
                      </div>
                      <div>
                        <FieldRow
                          label="App ID"
                          value={
                            cloverDetail.appIdConfigured
                              ? "Configured"
                              : "Not configured"
                          }
                          tone={
                            cloverDetail.appIdConfigured ? "success" : "warning"
                          }
                        />
                        <FieldRow
                          label="Webhook status"
                          value={
                            cloverRealtimeEnabled
                              ? "Receiving events"
                              : "Sync only"
                          }
                          tone={cloverRealtimeEnabled ? "success" : "warning"}
                        />
                        <FieldRow
                          label="Last webhook"
                          value={
                            cloverDetail.lastWebhookReceivedAt
                              ? formatRelativeTimestamp(
                                  cloverDetail.lastWebhookReceivedAt,
                                )
                              : null
                          }
                          description={
                            formatExactTimestamp(
                              cloverDetail.lastWebhookReceivedAt,
                            ) ??
                            "No Clover webhook event has been recorded yet."
                          }
                          tone={
                            cloverDetail.lastWebhookReceivedAt
                              ? "success"
                              : "neutral"
                          }
                        />
                        <FieldRow
                          label="Last health check"
                          value={
                            cloverDetail.webhooksLastCheckedAt
                              ? formatRelativeTimestamp(
                                  cloverDetail.webhooksLastCheckedAt,
                                )
                              : null
                          }
                          description={
                            formatExactTimestamp(
                              cloverDetail.webhooksLastCheckedAt,
                            ) ??
                            "No Clover webhook health check has been recorded yet."
                          }
                          tone={
                            cloverDetail.webhooksLastCheckedAt
                              ? "neutral"
                              : "warning"
                          }
                        />
                        <FieldRow
                          label="Last error"
                          value={
                            cloverDetail.webhookLastError
                              ? getUserFacingIntegrationError(
                                  cloverDetail.webhookLastError,
                                  "Clover webhook health needs review.",
                                )
                              : "None"
                          }
                          tone={
                            cloverDetail.webhookLastError ? "danger" : "success"
                          }
                          valueClassName={
                            cloverDetail.webhookLastError
                              ? "text-rose-700"
                              : undefined
                          }
                        />
                      </div>
                    </div>
                  </SectionCard>

                  <SectionCard
                    title="Automation Pipeline"
                    description="Current Clover automation maturity based on the existing CRM and event routing implementation."
                  >
                    <div>
                      <HealthFieldRow
                        label="CRM customer writes"
                        value="Active"
                        tone="success"
                        description="Clover customers can flow into the existing BloomSuite CRM pipeline."
                      />
                      <HealthFieldRow
                        label="Order pipeline"
                        value="Partial"
                        tone="warning"
                        description="Clover order-driven automations are available, but parity is still below Square and Lightspeed."
                      />
                      <HealthFieldRow
                        label="Automation triggers"
                        value="Active"
                        tone="success"
                        description="Existing Clover activity can trigger BloomSuite automation and logging flows."
                      />
                      <HealthFieldRow
                        label="Loyalty events"
                        value="Not available"
                        tone="neutral"
                        description="Clover loyalty events are not currently part of the supported integration contract."
                      />
                      <HealthFieldRow
                        label="Refund handling"
                        value="Partial"
                        tone="warning"
                        description="Refund-related Clover automation is available in limited form and still needs hardening."
                      />
                    </div>
                    <div className="mt-4 rounded-2xl border border-border/70 bg-slate-50/70 p-4 text-sm leading-6 text-muted-foreground">
                      Some Clover automation behaviors are provisionally
                      implemented. Order and refund pipeline maturity is lower
                      than Square.
                    </div>
                  </SectionCard>
                </>
              ) : isLightspeed && lightspeedDetail ? (
                <>
                  <Tabs
                    value={lightspeedTab}
                    onValueChange={(value) =>
                      setLightspeedTab(value as LightspeedTabValue)
                    }
                    className="space-y-6"
                  >
                    <TabsContent value="overview" className="space-y-5">
                      <OverviewPanel
                        title="Store Details"
                        description="Domain-based store identity and connection metadata stored for this Lightspeed account."
                      >
                        <div>
                          <FieldRow
                            label="Retailer"
                            value={lightspeedDetail.retailerName}
                          />
                          <FieldRow
                            label="Domain"
                            value={lightspeedDetail.domainPrefix}
                            copyValue={lightspeedDetail.domainPrefix}
                            copyLabel="Domain prefix"
                            copiedLabel={copiedLabel}
                            onCopy={copyToClipboard}
                          />
                          <FieldRow
                            label="Store URL"
                            value={
                              lightspeedDetail.storeUrl ? (
                                <a
                                  href={lightspeedDetail.storeUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-brand-navy underline-offset-4 hover:underline"
                                >
                                  {lightspeedDetail.storeUrl.replace(
                                    "https://",
                                    "",
                                  )}
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              ) : null
                            }
                          />
                          <FieldRow
                            label="Connected"
                            value={
                              lightspeedDetail.connectedAt
                                ? formatRelativeTimestamp(
                                    lightspeedDetail.connectedAt,
                                  )
                                : null
                            }
                            description={formatExactTimestamp(
                              lightspeedDetail.connectedAt,
                            )}
                          />
                        </div>
                      </OverviewPanel>

                      <OverviewPanel
                        title="Sync Configuration"
                        description="Actual Lightspeed sync telemetry per domain, using the connection timestamps already stored today."
                        action={
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              void detail.triggerLightspeedSync();
                            }}
                            disabled={
                              item.status !== "connected" ||
                              detail.isLightspeedSyncing
                            }
                          >
                            {detail.lightspeedSyncState === "triggering"
                              ? "Starting sync..."
                              : detail.lightspeedSyncState === "syncing"
                                ? "Syncing..."
                                : "Sync now"}
                          </Button>
                        }
                      >
                        <div>
                          <SyncTypeRow
                            label="Customers"
                            lastSyncedAt={lightspeedDetail.lastCustomerSync}
                            syncedCount={lightspeedCustomersCount}
                            isSyncing={hasActiveLightspeedSyncType("customers")}
                          />
                          <SyncTypeRow
                            label="Sales"
                            lastSyncedAt={lightspeedDetail.lastSalesSync}
                            syncedCount={lightspeedSalesCount}
                            isSyncing={hasActiveLightspeedSyncType("sales")}
                          />
                          <SyncTypeRow
                            label="Products"
                            lastSyncedAt={lightspeedDetail.lastProductSync}
                            syncedCount={lightspeedProductsCount}
                            isSyncing={hasActiveLightspeedSyncType("products")}
                          />
                          <FieldRow
                            label="Queue state"
                            value={
                              detail.lightspeedSyncState === "triggering"
                                ? "Creating jobs"
                                : detail.lightspeedSyncState === "syncing"
                                  ? "In progress"
                                  : "Idle"
                            }
                            description={
                              detail.lightspeedSyncState === "triggering"
                                ? "Queue records are being created now."
                                : detail.lightspeedSyncState === "idle"
                                  ? lightspeedIdleQueueDescription
                                  : `${lightspeedActiveSyncJobs.length} active job${lightspeedActiveSyncJobs.length === 1 ? "" : "s"} currently fetching records.`
                            }
                            tone={
                              detail.lightspeedSyncState === "syncing"
                                ? "success"
                                : detail.lightspeedHasStaleJobs ||
                                    lightspeedQueuedSyncJobs.length > 0
                                  ? "warning"
                                  : "neutral"
                            }
                          />
                        </div>
                      </OverviewPanel>

                      <OverviewPanel
                        title="Webhook Configuration"
                        description="Lightspeed webhook state as observed from the current account capabilities and delivery telemetry."
                      >
                        <div>
                          <FieldRow
                            label="Webhook mode"
                            value={lightspeedWebhookMode.label}
                            tone={lightspeedWebhookMode.tone}
                            valueClassName={
                              lightspeedWebhookMode.valueClassName
                            }
                            description={lightspeedWebhookMode.subtitle}
                          />
                          <FieldRow
                            label="Registration"
                            value={
                              lightspeedDetail.webhookRegistered
                                ? "Registered"
                                : lightspeedDetail.webhookMode === "unavailable"
                                  ? null
                                  : "Not registered"
                            }
                            tone={
                              lightspeedDetail.webhookRegistered
                                ? "success"
                                : lightspeedDetail.webhookMode === "unavailable"
                                  ? "neutral"
                                  : "warning"
                            }
                          />
                          <FieldRow
                            label="Last event"
                            value={
                              lightspeedDetail.lastWebhookReceivedAt
                                ? formatRelativeTimestamp(
                                    lightspeedDetail.lastWebhookReceivedAt,
                                  )
                                : null
                            }
                            description={formatExactTimestamp(
                              lightspeedDetail.lastWebhookReceivedAt,
                            )}
                            tone={
                              lightspeedDetail.lastWebhookReceivedAt
                                ? "success"
                                : "neutral"
                            }
                          />
                          <FieldRow
                            label="Last check"
                            value={
                              lightspeedDetail.webhooksLastCheckedAt
                                ? formatRelativeTimestamp(
                                    lightspeedDetail.webhooksLastCheckedAt,
                                  )
                                : null
                            }
                            description={formatExactTimestamp(
                              lightspeedDetail.webhooksLastCheckedAt,
                            )}
                            tone={
                              lightspeedDetail.webhooksLastCheckedAt
                                ? "neutral"
                                : "warning"
                            }
                          />
                          <FieldRow
                            label="Retry count"
                            value={
                              (lightspeedDetail.webhookRetryCount ?? 0) > 0
                                ? String(
                                    lightspeedDetail.webhookRetryCount ?? 0,
                                  )
                                : null
                            }
                            description={
                              (lightspeedDetail.webhookRetryCount ?? 0) > 0
                                ? "Pending webhook retries are waiting for delivery recovery."
                                : undefined
                            }
                            tone={
                              (lightspeedDetail.webhookRetryCount ?? 0) > 0
                                ? "warning"
                                : "neutral"
                            }
                          />
                          <FieldRow
                            label="Next retry"
                            value={
                              lightspeedDetail.webhookNextRetryAt
                                ? formatRelativeTimestamp(
                                    lightspeedDetail.webhookNextRetryAt,
                                  )
                                : null
                            }
                            description={formatExactTimestamp(
                              lightspeedDetail.webhookNextRetryAt,
                            )}
                            tone={
                              lightspeedDetail.webhookNextRetryAt
                                ? "warning"
                                : "neutral"
                            }
                          />
                        </div>

                        {lightspeedDetail.webhookMode === "sync-only" &&
                        lightspeedApiSetupUrl ? (
                          <div className="mt-4 rounded-lg border border-amber-100 bg-amber-50/70 p-3 text-sm leading-6 text-amber-900">
                            This account is running in sync-only mode. To check
                            Lightspeed API access, open{" "}
                            <a
                              href={lightspeedApiSetupUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium underline underline-offset-4"
                            >
                              API setup
                            </a>
                            .
                          </div>
                        ) : null}
                      </OverviewPanel>

                      <OverviewPanel
                        title="Data Feeds"
                        description="BloomSuite uses the Lightspeed customer, sales, and product feeds that are available for this account today."
                        action={
                          <div className="flex items-center gap-1">
                            {detail.canAccessLightspeedAdminFeatures ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 text-muted-foreground hover:bg-gray-50 hover:text-slate-900"
                                onClick={() =>
                                  navigate(lightspeedDetail.diagnosticsPath)
                                }
                              >
                                Diagnostics
                              </Button>
                            ) : null}
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-muted-foreground hover:bg-gray-50 hover:text-slate-900"
                              onClick={() => setLightspeedTab("sync-logs")}
                            >
                              Sync Logs
                            </Button>
                          </div>
                        }
                      >
                        <div>
                          <DataFeedRow
                            label="Customer feed"
                            status={
                              hasActiveLightspeedSyncType("customers")
                                ? "Syncing"
                                : lightspeedDetail.lastCustomerSync
                                  ? "Active"
                                  : "Pending"
                            }
                            tone={
                              hasActiveLightspeedSyncType("customers") ||
                              lightspeedDetail.lastCustomerSync
                                ? "success"
                                : "warning"
                            }
                            description={
                              lightspeedDetail.lastCustomerSync
                                ? `Last synced ${formatRelativeTimestamp(lightspeedDetail.lastCustomerSync)} • ${formatCount(lightspeedCustomersCount)} records`
                                : `${formatCount(lightspeedCustomersCount)} records available`
                            }
                          />
                          <DataFeedRow
                            label="Sales feed"
                            status={
                              hasActiveLightspeedSyncType("sales")
                                ? "Syncing"
                                : lightspeedDetail.lastSalesSync
                                  ? "Active"
                                  : "Pending"
                            }
                            tone={
                              hasActiveLightspeedSyncType("sales") ||
                              lightspeedDetail.lastSalesSync
                                ? "success"
                                : "warning"
                            }
                            description={
                              lightspeedDetail.lastSalesSync
                                ? `Last synced ${formatRelativeTimestamp(lightspeedDetail.lastSalesSync)} • ${formatCount(lightspeedSalesCount)} records`
                                : `${formatCount(lightspeedSalesCount)} records available`
                            }
                          />
                          <DataFeedRow
                            label="Product feed"
                            status={
                              hasActiveLightspeedSyncType("products")
                                ? "Syncing"
                                : lightspeedDetail.lastProductSync
                                  ? "Active"
                                  : "Pending"
                            }
                            tone={
                              hasActiveLightspeedSyncType("products") ||
                              lightspeedDetail.lastProductSync
                                ? "success"
                                : "warning"
                            }
                            description={
                              lightspeedDetail.lastProductSync
                                ? `Last synced ${formatRelativeTimestamp(lightspeedDetail.lastProductSync)} • ${formatCount(lightspeedProductsCount)} records`
                                : `${formatCount(lightspeedProductsCount)} records available`
                            }
                          />
                        </div>

                        <div className="mt-4 rounded-lg border border-gray-100 bg-slate-50/70 p-3 text-sm leading-6 text-muted-foreground">
                          Diagnostics and Sync Logs remain the operator tools
                          for verifying feed health when Lightspeed account
                          capabilities or recent job failures need review.
                        </div>
                      </OverviewPanel>
                    </TabsContent>

                    <TabsContent value="customers" className="mt-0">
                      <CustomersTabView
                        connectionId={lightspeedDetail.connectionId}
                        rows={lightspeedDashboard?.customers.rows ?? []}
                        pagination={
                          lightspeedDashboard?.customers.pagination ?? {
                            page: 1,
                            pageSize: 50,
                            totalCount: 0,
                            totalPages: 1,
                          }
                        }
                        isLoading={Boolean(
                          lightspeedDashboard?.customers.isLoading,
                        )}
                        isFetching={Boolean(
                          lightspeedDashboard?.customers.isFetching,
                        )}
                        customersSynced={lightspeedCustomersCount}
                        searchQuery={customerSearchInput}
                        onSearchQueryChange={(value) => {
                          setCustomerSearchInput(value);
                          setCustomerPage(1);
                        }}
                        sortField={customerSortField}
                        sortDirection={customerSortDirection}
                        onSortChange={(field, direction) => {
                          setCustomerSortField(field);
                          setCustomerSortDirection(direction);
                          setCustomerPage(1);
                        }}
                        selectedCustomer={selectedCustomer}
                        onSelectedCustomerChange={setSelectedCustomer}
                        onPageChange={setCustomerPage}
                        onTriggerSync={() => {
                          void detail.triggerLightspeedSync();
                        }}
                      />
                    </TabsContent>

                    <TabsContent value="sales" className="mt-0">
                      <SalesTabView
                        connectionId={lightspeedDetail.connectionId}
                        rows={lightspeedDashboard?.sales.rows ?? []}
                        pagination={
                          lightspeedDashboard?.sales.pagination ?? {
                            page: 1,
                            pageSize: 50,
                            totalCount: 0,
                            totalPages: 1,
                          }
                        }
                        summary={
                          lightspeedDashboard?.sales.summary ?? {
                            revenue: 0,
                            averageOrderValue: 0,
                            saleCount: 0,
                          }
                        }
                        isLoading={Boolean(
                          lightspeedDashboard?.sales.isLoading,
                        )}
                        isFetching={Boolean(
                          lightspeedDashboard?.sales.isFetching,
                        )}
                        searchQuery={salesSearchInput}
                        onSearchQueryChange={(value) => {
                          setSalesSearchInput(value);
                          setSalesPage(1);
                        }}
                        status={salesStatus as "all" | "completed" | "open"}
                        onStatusChange={(value) => {
                          setSalesStatus(value);
                          setSalesPage(1);
                        }}
                        startDate={salesStartDate}
                        endDate={salesEndDate}
                        onDateRangeChange={(startDate, endDate) => {
                          setSalesStartDate(startDate);
                          setSalesEndDate(endDate);
                          setSalesPage(1);
                        }}
                        sortField={salesSortField}
                        sortDirection={salesSortDirection}
                        onSortChange={(field, direction) => {
                          setSalesSortField(field);
                          setSalesSortDirection(direction);
                          setSalesPage(1);
                        }}
                        selectedSale={selectedSale}
                        onSelectedSaleChange={setSelectedSale}
                        onPageChange={setSalesPage}
                      />
                    </TabsContent>

                    <TabsContent value="products" className="mt-0">
                      <ProductsTabView
                        connectionId={lightspeedDetail.connectionId}
                        rows={lightspeedDashboard?.products.rows ?? []}
                        pagination={
                          lightspeedDashboard?.products.pagination ?? {
                            page: 1,
                            pageSize: 50,
                            totalCount: 0,
                            totalPages: 1,
                          }
                        }
                        categories={
                          lightspeedDashboard?.products.categories ?? []
                        }
                        isLoading={Boolean(
                          lightspeedDashboard?.products.isLoading,
                        )}
                        isFetching={Boolean(
                          lightspeedDashboard?.products.isFetching,
                        )}
                        searchQuery={productsSearchInput}
                        onSearchQueryChange={(value) => {
                          setProductsSearchInput(value);
                          setProductsPage(1);
                        }}
                        selectedCategories={productsCategories}
                        onSelectedCategoriesChange={(value) => {
                          setProductsCategories(value);
                          setProductsPage(1);
                        }}
                        inStockOnly={productsInStockOnly}
                        onInStockOnlyChange={(value) => {
                          setProductsInStockOnly(value);
                          setProductsPage(1);
                        }}
                        sortField={productsSortField}
                        sortDirection={productsSortDirection}
                        onSortChange={(field, direction) => {
                          setProductsSortField(field);
                          setProductsSortDirection(direction);
                          setProductsPage(1);
                        }}
                        onPageChange={setProductsPage}
                      />
                    </TabsContent>

                    <TabsContent value="sync-logs" className="mt-0">
                      <SyncLogsTabView
                        connectionId={lightspeedDetail.connectionId}
                        rows={lightspeedDashboard?.syncLogs.rows ?? []}
                        pagination={
                          lightspeedDashboard?.syncLogs.pagination ?? {
                            page: 1,
                            pageSize: 50,
                            totalCount: 0,
                            totalPages: 1,
                          }
                        }
                        isLoading={Boolean(
                          lightspeedDashboard?.syncLogs.isLoading,
                        )}
                        isFetching={Boolean(
                          lightspeedDashboard?.syncLogs.isFetching,
                        )}
                        statusFilter={
                          syncLogsStatus as
                            | "all"
                            | "completed"
                            | "failed"
                            | "in_progress"
                        }
                        onStatusFilterChange={(value) => {
                          setSyncLogsStatus(value);
                          setSyncLogsPage(1);
                        }}
                        onPageChange={setSyncLogsPage}
                        onRetrySync={() => {
                          void detail.triggerLightspeedSync();
                        }}
                        onRefresh={() => {
                          void detail.refetch();
                        }}
                        trackedJobIds={detail.lightspeedTrackedJobIds ?? []}
                        realtimeActive={Boolean(
                          detail.lightspeedRealtimeActive,
                        )}
                      />
                    </TabsContent>
                  </Tabs>
                </>
              ) : isMeta && metaDetail ? (
                <>
                  <SectionCard
                    title="Meta Authorization"
                    description="Shared Meta OAuth status, scopes, and account-level readiness for publishing and insights access."
                  >
                    <div className="space-y-4">
                      <div className="flex flex-wrap justify-end gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => navigate(metaDetail.managementPath)}
                        >
                          Open Social Accounts
                        </Button>
                        <Button
                          type="button"
                          onClick={() => {
                            void detail.triggerMetaReauthorization();
                          }}
                          disabled={detail.isMetaReauthorizing}
                        >
                          {detail.isMetaReauthorizing
                            ? "Opening authorization..."
                            : metaDetail.authorizationStatus === "not-connected"
                              ? "Authorize Meta"
                              : "Re-authorize Meta"}
                        </Button>
                      </div>
                      <div>
                        <FieldRow
                          label="Status"
                          value={metaDetail.authorizationLabel}
                          tone={metaAuthorizationState.tone}
                          valueClassName={metaAuthorizationState.valueClassName}
                        />
                        <FieldRow
                          label="Connected assets"
                          value={String(metaDetail.totalAssetCount)}
                          description={`${metaDetail.facebookPageCount} Facebook Pages • ${metaDetail.instagramAccountCount} Instagram accounts`}
                          tone={
                            metaDetail.totalAssetCount > 0
                              ? "success"
                              : "neutral"
                          }
                        />
                        <FieldRow
                          label="Connected since"
                          value={
                            formatRelativePlusAbsolute(
                              metaDetail.connectedAt,
                              "—",
                            ).value
                          }
                          description={
                            formatRelativePlusAbsolute(
                              metaDetail.connectedAt,
                              "—",
                            ).description
                          }
                        />
                        <FieldRow
                          label="Token expires"
                          value={
                            formatRelativePlusAbsolute(
                              metaDetail.expiresAt,
                              "—",
                            ).value
                          }
                          description={
                            formatRelativePlusAbsolute(
                              metaDetail.expiresAt,
                              "—",
                            ).description
                          }
                          tone={
                            metaTokenExpired
                              ? "danger"
                              : metaTokenExpiringSoon
                                ? "warning"
                                : "neutral"
                          }
                        />
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-slate-50/70 p-4">
                        <div className="text-sm font-semibold text-slate-950">
                          Granted scopes
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {metaDetail.scopes.map((scope) => (
                            <span
                              key={scope}
                              className="inline-flex items-center rounded-full border border-border/70 bg-white px-3 py-1 text-xs font-medium text-slate-700"
                            >
                              {scope}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </SectionCard>

                  <SectionCard
                    title="Facebook Pages"
                    description="Connected Facebook Pages available through the shared Meta authorization."
                  >
                    <MetaAssetList
                      assets={metaDetail.facebookPages}
                      emptyMessage="No Facebook Pages connected"
                      onCopy={copyToClipboard}
                      onOpen={() => navigate(metaDetail.managementPath)}
                    />
                  </SectionCard>

                  <SectionCard
                    title="Instagram Accounts"
                    description="Connected Instagram business accounts available through the shared Meta authorization."
                  >
                    <MetaAssetList
                      assets={metaDetail.instagramAccounts}
                      emptyMessage="No Instagram accounts connected"
                      onCopy={copyToClipboard}
                      onOpen={() => navigate(metaDetail.managementPath)}
                    />
                  </SectionCard>

                  <SectionCard
                    title="Publishing & Analytics Capabilities"
                    description="Operational surfaces available today through the current Meta connection and BloomSuite activity tooling."
                  >
                    <div>
                      <FieldRow
                        label="Publishing access"
                        value={
                          metaDetail.authorizationStatus === "authorized"
                            ? "Available"
                            : metaDetail.authorizationStatus === "expired"
                              ? "Reconnect required"
                              : "Not connected"
                        }
                        tone={
                          metaDetail.authorizationStatus === "authorized"
                            ? "success"
                            : metaDetail.authorizationStatus === "expired"
                              ? "danger"
                              : "neutral"
                        }
                      />
                      <FieldRow
                        label="Insights access"
                        value={
                          metaDetail.authorizationStatus === "authorized"
                            ? "Available"
                            : "Unavailable"
                        }
                        description="Meta insights require active authorization with the stored read_insights scope."
                        tone={
                          metaDetail.authorizationStatus === "authorized"
                            ? "success"
                            : "warning"
                        }
                      />
                      <FieldRow
                        label="Publishing logs"
                        value="Activity Center"
                        description="Review publishing and social activity history through the shared BloomSuite activity surfaces."
                        tone="success"
                      />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <Button
                        type="button"
                        onClick={() => navigate(metaDetail.syncLogsPath)}
                      >
                        View Publishing Logs
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => navigate(metaDetail.managementPath)}
                      >
                        Manage Social Accounts
                      </Button>
                    </div>
                  </SectionCard>
                </>
              ) : isGa4 && ga4Detail ? (
                <>
                  <SectionCard
                    title="Property Details"
                    description="Stored GA4 property metadata and the current tenant-scoped connection state."
                  >
                    <div className="space-y-4">
                      <div className="flex flex-wrap justify-end gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={
                            !ga4Detail.propertyId || detail.isGa4Reauthorizing
                          }
                          onClick={() => {
                            void detail.triggerGa4Reauthorization();
                          }}
                        >
                          {detail.isGa4Reauthorizing
                            ? "Opening authorization..."
                            : "Re-authorize"}
                        </Button>
                      </div>
                      <div>
                        <FieldRow
                          label="Property name"
                          value={ga4Detail.propertyName ?? "—"}
                        />
                        <FieldRow
                          label="Property ID"
                          value={ga4Detail.propertyId ?? "—"}
                          copyValue={ga4Detail.propertyId ?? undefined}
                          copyLabel="Property ID"
                          copiedLabel={copiedLabel}
                          onCopy={copyToClipboard}
                        />
                        <FieldRow
                          label="Measurement ID"
                          value={ga4Detail.measurementId ?? "—"}
                          copyValue={ga4Detail.measurementId ?? undefined}
                          copyLabel="Measurement ID"
                          copiedLabel={copiedLabel}
                          onCopy={copyToClipboard}
                        />
                        <FieldRow
                          label="Google account"
                          value={ga4Detail.googleAccountEmail ?? "—"}
                        />
                        <FieldRow
                          label="Connected since"
                          value={
                            formatRelativePlusAbsolute(
                              ga4Detail.connectedAt,
                              "—",
                            ).value
                          }
                          description={
                            formatRelativePlusAbsolute(
                              ga4Detail.connectedAt,
                              "—",
                            ).description
                          }
                        />
                      </div>
                    </div>
                  </SectionCard>

                  <SectionCard
                    title="Reporting Capabilities"
                    description="Reporting surfaces and access guarantees available through the connected GA4 property."
                  >
                    <div>
                      <FieldRow
                        label="Website dashboard"
                        value={
                          ga4Detail.propertyId ? "Available" : "Setup required"
                        }
                        description={ga4Detail.reportingStatus}
                        tone={ga4Detail.propertyId ? "success" : "warning"}
                      />
                      <FieldRow
                        label="Traffic metrics"
                        value={
                          ga4ConnectionHealthy ? "Available" : "Unavailable"
                        }
                        description="Sessions, users, page views, countries, and device types are exposed through the existing reporting dashboard."
                        tone={ga4ConnectionHealthy ? "success" : "neutral"}
                      />
                      <FieldRow
                        label="Read permissions"
                        value={
                          ga4Detail.readPermissionsConfirmed
                            ? "Confirmed"
                            : "Needs review"
                        }
                        description={
                          ga4Detail.readPermissionsConfirmed
                            ? "analytics.readonly access has been confirmed during connection or testing."
                            : "Re-authorize if reporting access has changed or the connection test fails."
                        }
                        tone={
                          ga4Detail.readPermissionsConfirmed
                            ? "success"
                            : "warning"
                        }
                      />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <Button
                        type="button"
                        onClick={() => navigate(ga4Detail.reportingPath)}
                      >
                        View Reporting Dashboard
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => navigate(ga4Detail.managementPath)}
                      >
                        Open Website Integrations
                      </Button>
                      {ga4Detail.analyticsUrl ? (
                        <Button type="button" variant="outline" asChild>
                          <a
                            href={ga4Detail.analyticsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Open Google Analytics
                            <ExternalLink className="ml-2 h-4 w-4" />
                          </a>
                        </Button>
                      ) : null}
                    </div>
                  </SectionCard>

                  <SectionCard
                    title="Connection Test"
                    description="Run the existing GA4 verification flow and review the latest recorded result for this property."
                  >
                    <div className="space-y-4">
                      <div className="flex flex-wrap justify-end gap-3">
                        <Button
                          type="button"
                          disabled={
                            !ga4Detail.propertyId ||
                            ga4Detail.connectionStatus !== "connected" ||
                            detail.isGa4ConnectionTesting
                          }
                          onClick={() => {
                            void detail.triggerGa4ConnectionTest();
                          }}
                        >
                          {detail.isGa4ConnectionTesting
                            ? "Running connection test..."
                            : "Run connection test"}
                          <FlaskConical className="ml-2 h-4 w-4" />
                        </Button>
                      </div>
                      <div>
                        <FieldRow
                          label="Latest result"
                          value={
                            ga4Detail.lastTestStatus === "success"
                              ? "Passed"
                              : ga4Detail.lastTestStatus === "error"
                                ? "Failed"
                                : "Not run"
                          }
                          tone={
                            ga4Detail.lastTestStatus === "success"
                              ? "success"
                              : ga4Detail.lastTestStatus === "error"
                                ? "danger"
                                : "neutral"
                          }
                        />
                        <FieldRow
                          label="Last tested"
                          value={
                            formatRelativePlusAbsolute(
                              ga4Detail.lastTestAt,
                              "Not tested",
                            ).value
                          }
                          description={
                            formatRelativePlusAbsolute(
                              ga4Detail.lastTestAt,
                              "Not tested",
                            ).description
                          }
                          tone={ga4Detail.lastTestAt ? "neutral" : "warning"}
                        />
                        <FieldRow
                          label="Last data pull"
                          value={
                            formatRelativePlusAbsolute(
                              ga4Detail.lastPullAt,
                              "Not pulled yet",
                            ).value
                          }
                          description={
                            formatRelativePlusAbsolute(
                              ga4Detail.lastPullAt,
                              "Not pulled yet",
                            ).description
                          }
                        />
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-slate-50/70 p-4 text-sm leading-6 text-muted-foreground">
                        {ga4Detail.lastTestMessage ??
                          "Run a connection test to verify that this GA4 property is still accessible from BloomSuite."}
                      </div>
                    </div>
                  </SectionCard>
                </>
              ) : isMarketingImport && marketingImportDetail ? (
                <>
                  <SectionCard
                    title="Connection Details"
                    description="Provider account metadata and import-scoped connection state stored for this marketing source."
                  >
                    <DetailFieldRows
                      onCopy={copyToClipboard}
                      rows={marketingImportDetail.connectionDetailsRows.map(
                        (row) => {
                          if (row.label === "Connected Since") {
                            return {
                              ...row,
                              value: formatRelativePlusAbsolute(
                                marketingImportDetail.connectedAt,
                                "Not connected",
                              ).value,
                              description: formatRelativePlusAbsolute(
                                marketingImportDetail.connectedAt,
                                "Not connected",
                              ).description,
                            };
                          }

                          if (row.label === "Token Expiry") {
                            return {
                              ...row,
                              value: formatRelativePlusAbsolute(
                                marketingImportDetail.tokenExpiresAt,
                                "No expiry reported",
                              ).value,
                              description: formatRelativePlusAbsolute(
                                marketingImportDetail.tokenExpiresAt,
                                "No expiry reported",
                              ).description,
                            };
                          }

                          return row;
                        },
                      )}
                    />
                    {marketingImportDetail.supportsRevokeToken ? (
                      <div className="mt-4 flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-auto px-0 py-0 text-sm font-medium text-muted-foreground hover:bg-transparent hover:text-foreground"
                          disabled={
                            !detail.canDisconnect || detail.isDisconnecting
                          }
                          onClick={() => setDisconnectOpen(true)}
                        >
                          {detail.isDisconnecting
                            ? "Revoking token..."
                            : "Revoke Token"}
                        </Button>
                      </div>
                    ) : null}
                  </SectionCard>

                  <SectionCard
                    title="Import Capabilities"
                    description="This integration supports one-time contact imports and intentionally does not enable live CRM sync."
                  >
                    <DetailFieldRows
                      rows={marketingImportDetail.capabilityRows}
                    />
                    {marketingImportDetail.providerSlug === "mailchimp" ? (
                      marketingImportDetail.capabilitiesNote ? (
                        <div className="mt-4 rounded-2xl border border-border/70 bg-slate-50/70 p-4 text-sm text-muted-foreground">
                          {marketingImportDetail.capabilitiesNote}
                        </div>
                      ) : null
                    ) : (
                      <div className="mt-4 rounded-2xl border border-border/70 bg-slate-50/70 p-4">
                        <div className="text-sm font-semibold text-slate-950">
                          Available capabilities
                        </div>
                        <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                          {marketingImportDetail.capabilities.map(
                            (capability) => (
                              <div
                                key={capability}
                                className="flex items-start gap-2"
                              >
                                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                                <span>{capability}</span>
                              </div>
                            ),
                          )}
                        </div>
                      </div>
                    )}
                  </SectionCard>

                  <SectionCard
                    title="Import Actions"
                    description="Use the existing migration wizard to preview provider data and start one-time imports."
                  >
                    <div className="space-y-3 rounded-2xl border border-border/70 bg-slate-50/70 p-4">
                      <Button
                        type="button"
                        className="w-full justify-between"
                        onClick={() =>
                          navigate(marketingImportDetail.importFlowPath)
                        }
                      >
                        Start Import
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-between"
                        onClick={() =>
                          navigate(marketingImportDetail.previewListsPath)
                        }
                      >
                        Preview Lists
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                      {marketingImportDetail.supportsValidateConnection ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full justify-between"
                          disabled={
                            !marketingImportDetail.connectionId ||
                            detail.isValidatingMarketingImportConnection
                          }
                          onClick={() => {
                            void detail.validateMarketingImportConnection();
                          }}
                        >
                          {detail.isValidatingMarketingImportConnection
                            ? "Validating connection..."
                            : "Validate Connection"}
                          <FlaskConical className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                    {marketingImportDetail.providerSlug === "mailchimp" ? (
                      marketingImportDetail.latestCompletedImport ? (
                        <div className="mt-4 border-t border-border/70 pt-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-foreground">
                                {marketingImportDetail.latestCompletedImport.contactsImported.toLocaleString()}{" "}
                                contacts imported
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatRelativeTimestamp(
                                  marketingImportDetail.latestCompletedImport
                                    .completedAt,
                                )}
                                {marketingImportDetail.latestCompletedImport
                                  .durationSeconds
                                  ? ` · ${formatDurationLabel(marketingImportDetail.latestCompletedImport.durationSeconds)}`
                                  : ""}
                                {marketingImportDetail.latestCompletedImport
                                  .segmentsCreated > 0
                                  ? ` · ${marketingImportDetail.latestCompletedImport.segmentsCreated} segments created`
                                  : ""}
                                {marketingImportDetail.latestCompletedImport
                                  .errorCount > 0
                                  ? ` · ${marketingImportDetail.latestCompletedImport.errorCount} error${marketingImportDetail.latestCompletedImport.errorCount === 1 ? "" : "s"}`
                                  : ""}
                              </p>
                            </div>
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                          </div>
                        </div>
                      ) : (
                        <p className="mt-4 border-t border-border/70 pt-4 text-sm italic text-muted-foreground">
                          No import history yet
                        </p>
                      )
                    ) : null}
                  </SectionCard>
                </>
              ) : (
                <>
                  <SectionCard
                    title="Configuration"
                    description="Provider-specific controls will plug into this shared shell in later milestones."
                  >
                    <div className="rounded-2xl border border-dashed border-border/80 bg-slate-50/70 p-4">
                      <p className="text-sm leading-6 text-muted-foreground">
                        {model.configurationHint}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-3">
                        {item.status === "coming-soon" ? (
                          <Button
                            type="button"
                            onClick={() => {
                              window.location.href = `${REQUEST_INTEGRATION_MAILTO}${encodeURIComponent(item.name)}`;
                            }}
                          >
                            <MailPlus className="mr-2 h-4 w-4" />
                            Request integration
                          </Button>
                        ) : detail.targetPath ? (
                          <Button
                            type="button"
                            onClick={() => navigate(detail.targetPath)}
                          >
                            {item.detailActionLabel ?? "Open integration"}
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => navigate("/integrations")}
                        >
                          Return to hub
                        </Button>
                      </div>
                    </div>
                  </SectionCard>

                  <SectionCard
                    title="Activity Placeholder"
                    description="This panel reserves space for provider-specific activity and diagnostics."
                  >
                    <div className="rounded-2xl border border-dashed border-border/80 bg-slate-50/70 p-4">
                      <p className="text-sm leading-6 text-muted-foreground">
                        {model.activityHint}
                      </p>
                    </div>
                  </SectionCard>
                </>
              )}

              {isLightspeed ? (
                detail.canAccessLightspeedAdminFeatures ? (
                  <section className="mt-12 border-t border-gray-100 pt-8">
                    <div className="space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-red-600">
                        Danger Zone
                      </p>
                      <div className="space-y-4">
                        <div className="rounded-xl border border-red-100 bg-white p-5">
                          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                            <div className="max-w-2xl space-y-2">
                              <h3 className="text-sm font-semibold text-foreground">
                                Reset synced Lightspeed data
                              </h3>
                              <p className="text-sm leading-6 text-muted-foreground">
                                Delete imported Lightspeed customers, sales,
                                products, and sync logs for this tenant only,
                                then clear the stored Lightspeed counters and
                                resume cursors so you can rerun internal tests
                                from a clean sync state.
                              </p>
                              <p className="text-sm leading-6 text-muted-foreground">
                                Existing CRM customer records and the Lightspeed
                                connection stay intact.
                                {canResetLightspeedSyncedData
                                  ? " You can fire a fresh sync again immediately after the reset completes."
                                  : detail.isResettingLightspeedData
                                    ? " A reset is already in progress."
                                    : " Wait for active Lightspeed sync jobs to finish before resetting tenant data."}
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 disabled:border-red-100 disabled:text-red-300"
                              disabled={!canResetLightspeedSyncedData}
                              onClick={() => setLightspeedResetOpen(true)}
                            >
                              {detail.isResettingLightspeedData
                                ? "Resetting..."
                                : "Reset synced data"}
                            </Button>
                          </div>
                        </div>

                        <div className="rounded-xl border border-red-100 bg-white p-5">
                          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                            <div className="max-w-2xl space-y-2">
                              <h3 className="text-sm font-semibold text-foreground">
                                Disconnect Lightspeed X-Series
                              </h3>
                              <p className="text-sm leading-6 text-muted-foreground">
                                Remove the stored Lightspeed connection from
                                BloomSuite, stop customer, sales, and product
                                sync, and clear the credentials used for this
                                account.
                              </p>
                              <p className="text-sm leading-6 text-muted-foreground">
                                {detail.canDisconnect
                                  ? "Imported CRM data is not deleted. You can reconnect this Lightspeed account later if syncing needs to be restored."
                                  : "Only site admins can remove the stored Lightspeed connection from this page."}
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 disabled:border-red-100 disabled:text-red-300"
                              disabled={!detail.canDisconnect}
                              onClick={() => setDisconnectOpen(true)}
                            >
                              Disconnect Lightspeed
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>
                ) : null
              ) : (
                <SectionCard
                  title="Danger Zone"
                  description={
                    isSquare
                      ? "Disconnect Square using the current repo-supported flow for removing the stored connection."
                      : isShopify
                        ? "Remove the stored Shopify OAuth connection, webhook subscriptions, and BloomSuite access tokens for this tenant."
                        : isMeta
                          ? "Remove the shared Meta authorization and disconnect the stored Facebook Page and Instagram account access for this tenant."
                          : isClover
                            ? "Disconnect Clover using the existing repo-supported flow for removing the stored connection."
                            : isGa4
                              ? "Remove the stored GA4 property connection for this tenant and stop future reporting pulls until the property is connected again."
                              : isMarketingImport && marketingImportDetail
                                ? marketingImportDetail.dangerZone.description
                                : "Destructive actions are gated until provider-specific controls are available."
                  }
                >
                  <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="text-sm font-semibold text-rose-900">
                          {isMeta
                            ? "Disconnect Meta"
                            : isShopify
                              ? "Disconnect Shopify"
                              : isClover
                                ? "Disconnect Clover"
                                : isGa4
                                  ? "Disconnect Google Analytics"
                                  : isMarketingImport && marketingImportDetail
                                    ? marketingImportDetail.dangerZone.title
                                    : (model.disconnectTitle ??
                                      "No destructive action available")}
                        </div>
                        <p className="mt-1 text-sm leading-6 text-rose-800/80">
                          {isMeta
                            ? detail.canDisconnect
                              ? "Disconnecting Meta removes the shared authorization for this tenant, clears the stored Facebook Page and Instagram account links, and stops publishing or analytics access until Meta is authorized again. Existing CRM data is not deleted."
                              : "No stored Meta authorization is currently available to remove from this page."
                            : isShopify
                              ? "Disconnecting Shopify removes BloomSuite's stored Shopify credentials, clears webhook subscription references, and stops future Shopify sync and automation intake until the app is reinstalled. Existing CRM data is not deleted."
                              : isClover
                                ? "Disconnecting Clover will stop all sync and real-time event processing and remove your Clover credentials from BloomSuite. Your existing CRM data is not deleted."
                                : isGa4
                                  ? "Disconnecting Google Analytics removes the stored GA4 property settings for this tenant and stops future reporting pulls until the property is connected again. Historical CRM data is not deleted."
                                  : isMarketingImport && marketingImportDetail
                                    ? marketingImportDetail.dangerZone
                                        .confirmDescription
                                    : model.canDisconnect
                                      ? model.disconnectDescription
                                      : isSquare
                                        ? "Only site admins can remove the stored Square connection from this page."
                                        : item.isManagedInfrastructure
                                          ? "This integration is managed through settings and cannot be disconnected from the shell."
                                          : "Disconnect actions will appear here when this integration supports them."}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="destructive"
                        disabled={!detail.canDisconnect}
                        onClick={() => setDisconnectOpen(true)}
                      >
                        {isMeta
                          ? "Disconnect Meta"
                          : isShopify
                            ? "Disconnect Shopify"
                            : isClover
                              ? "Disconnect Clover"
                              : isGa4
                                ? "Disconnect Google Analytics"
                                : isMarketingImport && marketingImportDetail
                                  ? marketingImportDetail.dangerZone.title
                                  : "Disconnect"}
                      </Button>
                    </div>
                    {isMarketingImport && marketingImportDetail ? (
                      <ul className="mt-4 space-y-2 rounded-xl border border-red-100 bg-red-50/40 p-4 text-sm text-slate-900">
                        {marketingImportDetail.dangerZone.bullets.map(
                          (bullet) => (
                            <li key={bullet} className="flex items-start gap-3">
                              <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700">
                                <X className="h-3.5 w-3.5" />
                              </span>
                              <span>{bullet}</span>
                            </li>
                          ),
                        )}
                      </ul>
                    ) : null}
                  </div>
                </SectionCard>
              )}
            </div>
          </div>
        )}

        {isShopify ? (
          <ConnectShopifyDialog
            open={shopifyDialogOpen}
            onOpenChange={setShopifyDialogOpen}
            initialDomain={shopifyConnection?.shop_domain ?? null}
          />
        ) : null}

        <AlertDialog
          open={lightspeedResetOpen}
          onOpenChange={setLightspeedResetOpen}
        >
          <AlertDialogContent className="sm:max-w-lg">
            <AlertDialogHeader>
              <AlertDialogTitle>Reset Lightspeed synced data?</AlertDialogTitle>
              <AlertDialogDescription>
                This clears only the current tenant&apos;s imported Lightspeed
                data and sync history so super admins can rerun internal test
                syncs from a clean state.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-4">
              <ul className="space-y-3 rounded-xl border border-red-100 bg-red-50/40 p-4 text-sm text-slate-900">
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700">
                    <X className="h-3.5 w-3.5" />
                  </span>
                  <span>
                    Imported Lightspeed customers, sales, products, and sync
                    logs for this tenant will be deleted.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700">
                    <X className="h-3.5 w-3.5" />
                  </span>
                  <span>
                    Lightspeed sync counters and version cursors will be reset
                    so the next run behaves like a fresh import.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700">
                    <X className="h-3.5 w-3.5" />
                  </span>
                  <span>
                    The Lightspeed connection stays connected, and existing CRM
                    customer records are not deleted.
                  </span>
                </li>
              </ul>
              <p className="text-sm leading-6 text-muted-foreground">
                This action is scoped to the current super admin tenant only.
              </p>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={detail.isResettingLightspeedData}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500"
                onClick={(event) => {
                  event.preventDefault();
                  void detail.resetLightspeedData().then(() => {
                    setLightspeedResetOpen(false);
                  });
                }}
                disabled={detail.isResettingLightspeedData}
              >
                {detail.isResettingLightspeedData
                  ? "Resetting..."
                  : "Reset Lightspeed data"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={disconnectOpen} onOpenChange={setDisconnectOpen}>
          <AlertDialogContent
            className={isLightspeed ? "sm:max-w-lg" : undefined}
          >
            <AlertDialogHeader>
              <AlertDialogTitle>
                {isMeta
                  ? "Disconnect Meta?"
                  : isShopify
                    ? "Disconnect Shopify?"
                    : isSquare
                      ? "Disconnect Square?"
                      : isClover
                        ? "Disconnect Clover?"
                        : isLightspeed
                          ? "Disconnect Lightspeed X-Series?"
                          : isGa4
                            ? "Disconnect Google Analytics?"
                            : isMarketingImport && marketingImportDetail
                              ? `Disconnect ${marketingImportDetail.providerLabel}?`
                              : (model.disconnectTitle ??
                                "Disconnect integration?")}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {isLightspeed
                  ? "This removes the current Lightspeed X-Series connection from BloomSuite and immediately stops its active integration workflows."
                  : isShopify
                    ? "Disconnecting Shopify removes the stored OAuth credentials for this tenant, clears webhook subscriptions, and stops Shopify sync and automation intake until the app is installed again."
                    : isSquare
                      ? "Disconnecting Square removes the stored merchant connection from BloomSuite and stops future Square syncs, webhook processing, and automation-trigger intake until the integration is connected again."
                      : isMeta
                        ? "Disconnecting Meta removes the shared authorization for this tenant, clears the stored Facebook Page and Instagram account links, and stops publishing or analytics access until Meta is authorized again. Existing CRM data is not deleted."
                        : isClover
                          ? "Disconnecting Clover will stop all sync and real-time event processing and remove your Clover credentials from BloomSuite. Your existing CRM data is not deleted."
                          : isGa4
                            ? "Disconnecting Google Analytics removes the stored GA4 property settings for this tenant and stops future reporting pulls until the property is connected again. Historical CRM data is not deleted."
                            : isMarketingImport && marketingImportDetail
                              ? marketingImportDetail.dangerZone
                                  .confirmDescription
                              : (model.disconnectDescription ??
                                `Disconnecting ${item.name} will stop future syncing until it is connected again.`)}
              </AlertDialogDescription>
            </AlertDialogHeader>
            {isLightspeed || isSquare || isClover || isShopify ? (
              <div className="space-y-4">
                <ul className="space-y-3 rounded-xl border border-red-100 bg-red-50/40 p-4 text-sm text-slate-900">
                  <li className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700">
                      <X className="h-3.5 w-3.5" />
                    </span>
                    <span>
                      {isSquare
                        ? "Customer, sales, and product sync will stop until Square is connected again."
                        : isShopify
                          ? "Customer, order, and product sync will stop until Shopify is reconnected."
                          : isClover
                            ? "Customer, sales, and product sync will stop until Clover is connected again."
                            : "Customer, sales, and product sync will stop until Lightspeed is connected again."}
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700">
                      <X className="h-3.5 w-3.5" />
                    </span>
                    <span>
                      {isSquare
                        ? "Stored Square merchant credentials and webhook subscription references will be removed from this BloomSuite account."
                        : isShopify
                          ? "Stored Shopify access tokens and webhook subscription references will be removed from this BloomSuite account."
                          : isClover
                            ? "Stored Clover merchant credentials and app-level webhook health references will be removed from this BloomSuite account."
                            : "Stored Lightspeed credentials will be removed from this BloomSuite account."}
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700">
                      <X className="h-3.5 w-3.5" />
                    </span>
                    <span>
                      {isSquare
                        ? "Webhook-driven automation intake will pause, and any new Square events will be ignored until the connection is restored."
                        : isShopify
                          ? "Webhook-driven Shopify automation intake will pause, and new order, customer, refund, and product events will be ignored until the app is reinstalled."
                          : isClover
                            ? "Any new Clover events and connection-test diagnostics will be ignored until the connection is restored and app-level webhook health can be verified again."
                            : "Any active sync jobs for this connection will be canceled and need to be restarted after reconnection."}
                    </span>
                  </li>
                </ul>
                <p className="text-sm leading-6 text-muted-foreground">
                  Imported CRM data is not deleted. You can reconnect{" "}
                  {isSquare
                    ? "Square"
                    : isShopify
                      ? "Shopify"
                      : isClover
                        ? "Clover"
                        : "Lightspeed"}{" "}
                  later to restore syncing.
                </p>
              </div>
            ) : isMarketingImport && marketingImportDetail ? (
              <div className="space-y-4">
                <ul className="space-y-3 rounded-xl border border-red-100 bg-red-50/40 p-4 text-sm text-slate-900">
                  {marketingImportDetail.dangerZone.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-3">
                      <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700">
                        <X className="h-3.5 w-3.5" />
                      </span>
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-sm leading-6 text-muted-foreground">
                  Imported CRM data is not deleted. You can reconnect{" "}
                  {marketingImportDetail.providerLabel} later to restore
                  previews and imports.
                </p>
              </div>
            ) : null}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={detail.isDisconnecting}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                className={
                  isLightspeed || isSquare || isClover || isShopify
                    ? "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500"
                    : undefined
                }
                onClick={(event) => {
                  event.preventDefault();
                  void detail.disconnect().then(() => {
                    setDisconnectOpen(false);
                    if (
                      isShopify ||
                      (isMarketingImport &&
                        marketingImportDetail?.providerSlug === "mailchimp")
                    ) {
                      navigate("/integrations");
                    }
                  });
                }}
                disabled={detail.isDisconnecting}
              >
                {detail.isDisconnecting
                  ? "Disconnecting..."
                  : isShopify
                    ? "Disconnect Shopify"
                    : isSquare
                      ? "Remove Square connection"
                      : isMeta
                        ? "Remove Meta connection"
                        : isClover
                          ? "Remove Clover connection"
                          : isLightspeed
                            ? "Disconnect Lightspeed"
                            : isGa4
                              ? "Remove Google Analytics connection"
                              : isMarketingImport && marketingImportDetail
                                ? `Remove ${marketingImportDetail.providerLabel} connection`
                                : "Confirm disconnect"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
