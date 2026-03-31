import { createClient } from "npm:@supabase/supabase-js@2";

import { corsHeaders } from "../_shared/cors.ts";
import { decryptToken } from "../_shared/crypto/tokens.ts";

const SHOPIFY_API_VERSION = "2024-10";
const ENDPOINT_LIMIT = 1;

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

interface DiagnosticsResponse {
  timestamp: string;
  summary: DiagnosticsSummary;
  connection: DiagnosticsConnectionSummary | null;
  checks: DiagnosticResult[];
}

const CHECK_NAMES = {
  token: "token_decryption",
  customersApi: "customers_api",
  ordersApi: "orders_api",
  productsApi: "products_api",
  webhookHealth: "webhook_health",
  syncQueue: "sync_queue",
  importedData: "imported_data",
} as const;

function appendCheck(
  checks: DiagnosticResult[],
  check: string,
  status: DiagnosticStatus,
  message: string,
  detail?: string,
) {
  checks.push({ check, status, message, detail });
}

function createSummary(checks: DiagnosticResult[]): DiagnosticsSummary {
  const passCount = checks.filter((check) => check.status === "pass").length;
  const warnCount = checks.filter((check) => check.status === "warn").length;
  const failCount = checks.filter((check) => check.status === "fail").length;

  return {
    overallStatus: failCount > 0 ? "fail" : warnCount > 0 ? "warn" : "pass",
    passCount,
    warnCount,
    failCount,
    totalCount: checks.length,
  };
}

function getConnectionSummary(
  connection: Record<string, unknown> | null,
): DiagnosticsConnectionSummary {
  const scopes =
    typeof connection?.scope === "string"
      ? connection.scope
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
      : [];
  const subscriptionIds = Array.isArray(connection?.webhook_subscription_ids)
    ? connection.webhook_subscription_ids.filter(
        (value) => typeof value === "string",
      )
    : [];

  return {
    status: connection ? "connected" : "missing",
    shopDomain:
      typeof connection?.shop_domain === "string"
        ? connection.shop_domain
        : null,
    shopName:
      typeof connection?.shop_name === "string" ? connection.shop_name : null,
    scopeCount: scopes.length,
    lastCustomerSync:
      typeof connection?.last_customer_sync === "string"
        ? connection.last_customer_sync
        : null,
    lastOrderSync:
      typeof connection?.last_sales_sync === "string"
        ? connection.last_sales_sync
        : null,
    lastProductSync:
      typeof connection?.last_product_sync === "string"
        ? connection.last_product_sync
        : null,
    lastWebhookReceivedAt:
      typeof connection?.last_webhook_received_at === "string"
        ? connection.last_webhook_received_at
        : null,
    webhookSubscriptionCount: subscriptionIds.length,
  };
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "never";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toISOString();
}

function hasFailureStatus(status: string | null | undefined) {
  return Boolean(status && /(fail|dead|cancel)/i.test(status));
}

function hasActiveStatus(status: string | null | undefined) {
  return Boolean(
    status && /(pending|queued|scheduled|retry|progress|running)/i.test(status),
  );
}

async function callShopifyAdmin(
  shopDomain: string,
  accessToken: string,
  endpoint: string,
) {
  const response = await fetch(
    `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/${endpoint}`,
    {
      headers: {
        "X-Shopify-Access-Token": accessToken,
        Accept: "application/json",
      },
    },
  );

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      data && typeof data === "object" && "errors" in data
        ? JSON.stringify((data as Record<string, unknown>).errors)
        : `HTTP ${response.status}`;
    throw new Error(message);
  }

  return data;
}

function getImportedCountDetail(counts: Record<string, number>) {
  return `Customers ${counts.customers.toLocaleString()} • Orders ${counts.orders.toLocaleString()} • Products ${counts.products.toLocaleString()}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: adminCheck, error: adminError } = await supabaseAdmin
      .from("app_admin_emails")
      .select("email")
      .eq("email", user.email)
      .maybeSingle();

    if (adminError || !adminCheck) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: userData, error: userDataError } = await supabaseClient
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (userDataError || !userData?.tenant_id) {
      return new Response(JSON.stringify({ error: "No tenant found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tenantId = userData.tenant_id;
    const checks: DiagnosticResult[] = [];

    const { data: connection, error: connectionError } = await supabaseAdmin
      .from("shopify_connections")
      .select(
        [
          "id",
          "tenant_id",
          "shop_domain",
          "shop_name",
          "scope",
          "status",
          "encrypted_access_token",
          "last_customer_sync",
          "last_sales_sync",
          "last_product_sync",
          "last_webhook_received_at",
          "webhooks_subscribed",
          "webhook_subscription_ids",
          "webhooks_last_checked_at",
          "webhook_last_error",
          "webhook_retry_count",
          "webhook_next_retry_at",
        ].join(","),
      )
      .eq("tenant_id", tenantId)
      .maybeSingle();

    const diagnostics: DiagnosticsResponse = {
      timestamp: new Date().toISOString(),
      summary: {
        overallStatus: "fail",
        passCount: 0,
        warnCount: 0,
        failCount: 0,
        totalCount: 0,
      },
      connection: getConnectionSummary(
        connection as Record<string, unknown> | null,
      ),
      checks,
    };

    let accessToken: string | null = null;

    if (connectionError) {
      appendCheck(
        checks,
        CHECK_NAMES.token,
        "fail",
        "Shopify connection lookup failed.",
        connectionError.message,
      );
    } else if (!connection) {
      appendCheck(
        checks,
        CHECK_NAMES.token,
        "fail",
        "No Shopify connection is configured for this tenant.",
      );
    } else {
      try {
        accessToken = await decryptToken(connection.encrypted_access_token);
      } catch (error) {
        appendCheck(
          checks,
          CHECK_NAMES.token,
          "fail",
          "Shopify access token could not be decrypted.",
          error instanceof Error ? error.message : "Unknown token error",
        );
      }

      if (accessToken) {
        appendCheck(
          checks,
          CHECK_NAMES.token,
          "pass",
          "Shopify access token decrypted successfully.",
          typeof connection.scope === "string" && connection.scope.length > 0
            ? `${connection.scope.split(",").filter(Boolean).length} OAuth scopes recorded.`
            : undefined,
        );
      }
    }

    if (connection?.shop_domain && accessToken) {
      const apiChecks = [
        {
          name: CHECK_NAMES.customersApi,
          endpoint: `customers.json?limit=${ENDPOINT_LIMIT}`,
          label: "Shopify customers API responded successfully.",
          detailKey: "customers",
        },
        {
          name: CHECK_NAMES.ordersApi,
          endpoint: `orders.json?status=any&limit=${ENDPOINT_LIMIT}`,
          label: "Shopify orders API responded successfully.",
          detailKey: "orders",
        },
        {
          name: CHECK_NAMES.productsApi,
          endpoint: `products.json?limit=${ENDPOINT_LIMIT}`,
          label: "Shopify products API responded successfully.",
          detailKey: "products",
        },
      ] as const;

      for (const apiCheck of apiChecks) {
        try {
          const data = await callShopifyAdmin(
            connection.shop_domain,
            accessToken,
            apiCheck.endpoint,
          );
          const collection =
            data && typeof data === "object"
              ? (data as Record<string, unknown>)[apiCheck.detailKey]
              : null;
          const count = Array.isArray(collection) ? collection.length : 0;
          appendCheck(
            checks,
            apiCheck.name,
            "pass",
            apiCheck.label,
            `Fetched ${count} sample record${count === 1 ? "" : "s"} from ${apiCheck.detailKey}.`,
          );
        } catch (error) {
          appendCheck(
            checks,
            apiCheck.name,
            "fail",
            `${apiCheck.detailKey} API request failed.`,
            error instanceof Error
              ? error.message
              : "Unknown Shopify API error",
          );
        }
      }
    } else {
      appendCheck(
        checks,
        CHECK_NAMES.customersApi,
        "fail",
        "Customers API check could not run without a valid connection and token.",
      );
      appendCheck(
        checks,
        CHECK_NAMES.ordersApi,
        "fail",
        "Orders API check could not run without a valid connection and token.",
      );
      appendCheck(
        checks,
        CHECK_NAMES.productsApi,
        "fail",
        "Products API check could not run without a valid connection and token.",
      );
    }

    if (!connection) {
      appendCheck(
        checks,
        CHECK_NAMES.webhookHealth,
        "fail",
        "Webhook health could not be verified without a Shopify connection.",
      );
    } else if (
      connection.webhooks_subscribed &&
      !connection.webhook_last_error
    ) {
      appendCheck(
        checks,
        CHECK_NAMES.webhookHealth,
        "pass",
        "Shopify webhook coverage is currently verified.",
        `Last checked ${formatDateTime(connection.webhooks_last_checked_at)}.`,
      );
    } else if (connection.webhook_last_error) {
      appendCheck(
        checks,
        CHECK_NAMES.webhookHealth,
        "warn",
        "Shopify webhook coverage needs operator review.",
        connection.webhook_last_error,
      );
    } else {
      appendCheck(
        checks,
        CHECK_NAMES.webhookHealth,
        "warn",
        "Shopify webhooks are not fully verified yet.",
        `Last checked ${formatDateTime(connection.webhooks_last_checked_at)}.`,
      );
    }

    const { data: recentJobs, error: jobsError } = await supabaseAdmin
      .from("pos_sync_jobs_v2")
      .select("id, status, sync_type, created_at, updated_at, last_error")
      .eq("tenant_id", tenantId)
      .eq("provider", "shopify")
      .order("created_at", { ascending: false })
      .limit(20);

    if (jobsError) {
      appendCheck(
        checks,
        CHECK_NAMES.syncQueue,
        "fail",
        "Shopify sync queue could not be inspected.",
        jobsError.message,
      );
    } else {
      const failedJobs = (recentJobs ?? []).filter((job) =>
        hasFailureStatus(job.status),
      );
      const activeJobs = (recentJobs ?? []).filter((job) =>
        hasActiveStatus(job.status),
      );

      if (failedJobs.length > 0) {
        appendCheck(
          checks,
          CHECK_NAMES.syncQueue,
          "warn",
          "Recent Shopify sync jobs include failures.",
          `${failedJobs.length} failed or cancelled job${failedJobs.length === 1 ? "" : "s"} in the most recent queue history.`,
        );
      } else if (activeJobs.length > 0) {
        appendCheck(
          checks,
          CHECK_NAMES.syncQueue,
          "pass",
          "Shopify sync queue is active and processing jobs.",
          `${activeJobs.length} active job${activeJobs.length === 1 ? "" : "s"} currently running.`,
        );
      } else {
        appendCheck(
          checks,
          CHECK_NAMES.syncQueue,
          "pass",
          "Shopify sync queue is idle with no recent failures.",
          `${(recentJobs ?? []).length} recent job${(recentJobs ?? []).length === 1 ? "" : "s"} inspected.`,
        );
      }
    }

    const [customerCounts, orderCounts, productCounts] = await Promise.all([
      supabaseAdmin
        .from("shopify_customers")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId),
      supabaseAdmin
        .from("shopify_orders")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId),
      supabaseAdmin
        .from("shopify_products")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId),
    ]);

    const importErrors = [
      customerCounts.error,
      orderCounts.error,
      productCounts.error,
    ].filter(Boolean);

    if (importErrors.length > 0) {
      appendCheck(
        checks,
        CHECK_NAMES.importedData,
        "fail",
        "Imported Shopify data counts could not be loaded.",
        importErrors.map((error) => error?.message).join(" | "),
      );
    } else {
      const counts = {
        customers: customerCounts.count ?? 0,
        orders: orderCounts.count ?? 0,
        products: productCounts.count ?? 0,
      };
      const totalImported = counts.customers + counts.orders + counts.products;

      appendCheck(
        checks,
        CHECK_NAMES.importedData,
        totalImported > 0 ? "pass" : "warn",
        totalImported > 0
          ? "BloomSuite has imported Shopify data for this tenant."
          : "No Shopify records have been imported yet.",
        getImportedCountDetail(counts),
      );
    }

    diagnostics.summary = createSummary(checks);

    return new Response(JSON.stringify(diagnostics), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[SHOPIFY-DIAGNOSTICS] Unexpected failure", error);
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "Unexpected diagnostics error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
