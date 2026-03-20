import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
// FIX: [P14] - Replace insecure atob() with proper decryptToken
import { decryptToken, encryptToken } from "../_shared/crypto/tokens.ts";

const CUSTOMER_ENDPOINT_LIMIT = 1;
const PRODUCT_ENDPOINT_LIMIT = 1;

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
  domainPrefix: string | null;
  retailerName: string | null;
  expiresAt: string | null;
  minutesUntilExpiry: number | null;
  lastCustomerSync: string | null;
  lastCustomerVersionCursor: string | null;
  lastSalesSync: string | null;
  lastSalesVersionCursor: string | null;
  lastProductSync: string | null;
  lastProductVersionCursor: string | null;
  lastWebhookReceivedAt: string | null;
}

interface LightspeedDiagnosticsConnection {
  id: string;
  tenant_id: string;
  status: string | null;
  domain_prefix: string | null;
  retailer_name: string | null;
  expires_at: string | null;
  encrypted_access_token: string;
  last_customer_sync: string | null;
  last_customer_version_cursor: string | null;
  last_sales_sync: string | null;
  last_sales_version_cursor: string | null;
  last_product_sync: string | null;
  last_product_version_cursor: string | null;
  last_webhook_received_at: string | null;
  webhooks_subscribed: boolean | null;
  webhook_registered: boolean | null;
  webhook_last_error: string | null;
  webhook_next_retry_at: string | null;
  webhook_retry_count: number | null;
  webhooks_last_checked_at: string | null;
}

interface DiagnosticsResponse {
  timestamp: string;
  summary: DiagnosticsSummary;
  connection: DiagnosticsConnectionSummary | null;
  checks: DiagnosticResult[];
}

const CHECK_NAMES = {
  token: "token_decryption",
  customersApi: "customer_api",
  salesApi: "sales_api",
  productsApi: "product_api",
  webhookMode: "webhook_mode",
  syncQueue: "sync_queue",
  importedData: "imported_data",
} as const;

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

function appendCheck(
  checks: DiagnosticResult[],
  check: string,
  status: DiagnosticStatus,
  message: string,
  detail?: string,
) {
  checks.push({ check, status, message, detail });
}

function parseXSeriesResponse(data: unknown) {
  if (!data || typeof data !== "object") {
    return { isValid: false, count: 0, versionMax: null as number | null };
  }

  const record = data as Record<string, unknown>;
  const count = Array.isArray(record.data) ? record.data.length : -1;
  const version =
    record.version && typeof record.version === "object"
      ? (record.version as Record<string, unknown>)
      : null;
  const versionMax =
    typeof version?.max === "number"
      ? version.max
      : typeof version?.max === "string"
        ? Number.parseInt(version.max, 10)
        : null;

  return {
    isValid: count >= 0,
    count: Math.max(count, 0),
    versionMax: Number.isFinite(versionMax as number) ? versionMax : null,
  };
}

function getConnectionSummary(
  connection: LightspeedDiagnosticsConnection | null,
): DiagnosticsConnectionSummary {
  const expiresAt = connection?.expires_at
    ? new Date(connection.expires_at)
    : null;
  const now = Date.now();
  const minutesUntilExpiry =
    expiresAt && !Number.isNaN(expiresAt.getTime())
      ? Math.floor((expiresAt.getTime() - now) / 60000)
      : null;

  return {
    status: connection ? "connected" : "missing",
    domainPrefix: connection?.domain_prefix ?? null,
    retailerName: connection?.retailer_name ?? null,
    expiresAt: connection?.expires_at ?? null,
    minutesUntilExpiry,
    lastCustomerSync: connection?.last_customer_sync ?? null,
    lastCustomerVersionCursor: connection?.last_customer_version_cursor ?? null,
    lastSalesSync: connection?.last_sales_sync ?? null,
    lastSalesVersionCursor: connection?.last_sales_version_cursor ?? null,
    lastProductSync: connection?.last_product_sync ?? null,
    lastProductVersionCursor: connection?.last_product_version_cursor ?? null,
    lastWebhookReceivedAt: connection?.last_webhook_received_at ?? null,
  };
}

function getSalesSinceDate(connection: any) {
  const fallbackDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const sinceSource = connection?.last_sales_sync
    ? new Date(connection.last_sales_sync)
    : fallbackDate;

  if (Number.isNaN(sinceSource.getTime())) {
    return fallbackDate.toISOString().split("T")[0];
  }

  return sinceSource.toISOString().split("T")[0];
}

function hasFailureStatus(status: string | null | undefined) {
  return Boolean(status && /(fail|dead)/i.test(status));
}

function hasActiveStatus(status: string | null | undefined) {
  return Boolean(
    status && /(pending|queued|scheduled|retry|progress|running)/i.test(status),
  );
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
      return new Response(
        JSON.stringify({ error: "Super admin access required" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
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

    const { data: rawConnection, error: connectionError } = await supabaseAdmin
      .from("lightspeed_connections")
      .select(
        [
          "id",
          "tenant_id",
          "status",
          "domain_prefix",
          "retailer_name",
          "expires_at",
          "encrypted_access_token",
          "last_customer_sync",
          "last_customer_version_cursor",
          "last_sales_sync",
          "last_sales_version_cursor",
          "last_product_sync",
          "last_product_version_cursor",
          "last_webhook_received_at",
          "webhooks_subscribed",
          "webhook_registered",
          "webhook_last_error",
          "webhook_next_retry_at",
          "webhook_retry_count",
          "webhooks_last_checked_at",
        ].join(","),
      )
      .eq("tenant_id", tenantId)
      .maybeSingle();

    const connection = rawConnection as LightspeedDiagnosticsConnection | null;

    const diagnostics: DiagnosticsResponse = {
      timestamp: new Date().toISOString(),
      summary: {
        overallStatus: "fail",
        passCount: 0,
        warnCount: 0,
        failCount: 0,
        totalCount: 0,
      },
      connection: connection
        ? getConnectionSummary(connection)
        : {
            status: "missing",
            domainPrefix: null,
            retailerName: null,
            expiresAt: null,
            minutesUntilExpiry: null,
            lastCustomerSync: null,
            lastCustomerVersionCursor: null,
            lastSalesSync: null,
            lastSalesVersionCursor: null,
            lastProductSync: null,
            lastProductVersionCursor: null,
            lastWebhookReceivedAt: null,
          },
      checks,
    };

    let accessToken: string | null = null;
    let usedLegacyPlaintextFallback = false;
    let reEncryptedLegacyToken = false;

    if (connectionError) {
      appendCheck(
        checks,
        CHECK_NAMES.token,
        "fail",
        "Lightspeed connection lookup failed.",
        connectionError.message,
      );
    } else if (!connection) {
      appendCheck(
        checks,
        CHECK_NAMES.token,
        "fail",
        "No Lightspeed connection is configured for this tenant.",
      );
    } else {
      try {
        // FIX: [P14] - Use proper decryptToken instead of atob()
        accessToken = await decryptToken(connection.encrypted_access_token);
      } catch {
        usedLegacyPlaintextFallback = true;
        accessToken = connection.encrypted_access_token;

        if (accessToken) {
          try {
            const reEncryptedToken = await encryptToken(accessToken);
            const { error: reEncryptError } = await supabaseAdmin
              .from("lightspeed_connections")
              .update({ encrypted_access_token: reEncryptedToken })
              .eq("id", connection.id);

            if (!reEncryptError) {
              reEncryptedLegacyToken = true;
              usedLegacyPlaintextFallback = false;
            }
          } catch (reEncryptError) {
            console.error(
              "[LS-DIAGNOSTICS] Failed to re-encrypt legacy token:",
              reEncryptError,
            );
          }
        }
      }

      const minutesUntilExpiry =
        diagnostics.connection?.minutesUntilExpiry ?? null;

      if (!accessToken) {
        appendCheck(
          checks,
          CHECK_NAMES.token,
          "fail",
          "Access token could not be loaded for Lightspeed diagnostics.",
        );
      } else if (minutesUntilExpiry !== null && minutesUntilExpiry <= 0) {
        appendCheck(
          checks,
          CHECK_NAMES.token,
          "fail",
          "Lightspeed access token is expired.",
          `Expired at ${formatDateTime(connection.expires_at)}.`,
        );
      } else if (reEncryptedLegacyToken) {
        appendCheck(
          checks,
          CHECK_NAMES.token,
          "pass",
          "Legacy plaintext Lightspeed token was re-encrypted successfully.",
          "Diagnostics repaired the stored token format during this run.",
        );
      } else if (usedLegacyPlaintextFallback) {
        appendCheck(
          checks,
          CHECK_NAMES.token,
          "warn",
          "Lightspeed token still uses the legacy plain-text fallback path.",
          "Diagnostics can continue, but reauthorization or token re-encryption is still needed.",
        );
      } else {
        appendCheck(
          checks,
          CHECK_NAMES.token,
          "pass",
          "Lightspeed access token decrypted successfully.",
          minutesUntilExpiry === null
            ? undefined
            : `${minutesUntilExpiry} minutes remain before expiry.`,
        );
      }
    }

    const baseUrl = connection?.domain_prefix
      ? `https://${connection.domain_prefix}.retail.lightspeed.app`
      : null;

    const runApiCheck = async (
      checkName: string,
      endpoints: string[],
      label: string,
    ) => {
      if (!connection) {
        appendCheck(
          checks,
          checkName,
          "fail",
          `${label} check could not run because the Lightspeed connection is missing.`,
        );
        return;
      }

      if (!accessToken || !baseUrl || endpoints.length === 0) {
        appendCheck(
          checks,
          checkName,
          "fail",
          `${label} check could not run because the connection details are incomplete.`,
        );
        return;
      }

      try {
        const failures: string[] = [];

        for (const endpoint of endpoints) {
          const response = await fetch(`${baseUrl}${endpoint}`, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          });

          if (!response.ok) {
            failures.push(`${endpoint} returned HTTP ${response.status}`);
            continue;
          }

          const data = await response.json();
          const parsed = parseXSeriesResponse(data);
          if (!parsed.isValid) {
            failures.push(`${endpoint} returned a non X-Series payload shape`);
            continue;
          }

          appendCheck(
            checks,
            checkName,
            "pass",
            `${label} endpoint is reachable with the current token.`,
            `Fetched ${parsed.count} record${parsed.count === 1 ? "" : "s"} from ${endpoint}${parsed.versionMax !== null ? ` · version.max=${parsed.versionMax}` : ""}.`,
          );
          return;
        }

        appendCheck(
          checks,
          checkName,
          "fail",
          `${label} endpoint did not return a usable X-Series response.`,
          failures.join(" | "),
        );
      } catch (error) {
        appendCheck(
          checks,
          checkName,
          "fail",
          `${label} endpoint request failed.`,
          error instanceof Error ? error.message : String(error),
        );
      }
    };

    await runApiCheck(
      CHECK_NAMES.customersApi,
      ["/api/2.0/customers"],
      "Customer API",
    );

    await runApiCheck(CHECK_NAMES.salesApi, ["/api/2.0/sales"], "Sales API");

    await runApiCheck(
      CHECK_NAMES.productsApi,
      ["/api/2.0/products", "/api/3.0/products"],
      "Products API",
    );

    if (!connection) {
      appendCheck(
        checks,
        CHECK_NAMES.webhookMode,
        "fail",
        "Webhook mode could not be evaluated because the Lightspeed connection is missing.",
      );
    } else if (
      !connection.webhooks_subscribed &&
      !connection.webhook_registered
    ) {
      appendCheck(
        checks,
        CHECK_NAMES.webhookMode,
        "fail",
        "Lightspeed webhooks are not subscribed for this connection.",
        "The real-time webhook path is disabled until subscription succeeds.",
      );
    } else if (connection.webhook_last_error) {
      appendCheck(
        checks,
        CHECK_NAMES.webhookMode,
        "warn",
        "Lightspeed webhooks are registered, but the last delivery recorded an error.",
        `Last error: ${connection.webhook_last_error}${connection.webhook_next_retry_at ? ` · next retry ${formatDateTime(connection.webhook_next_retry_at)}` : ""}`,
      );
    } else if (!connection.last_webhook_received_at) {
      appendCheck(
        checks,
        CHECK_NAMES.webhookMode,
        "warn",
        "Lightspeed webhooks are registered, but no delivery has been recorded yet.",
        connection.webhooks_last_checked_at
          ? `Last checked at ${formatDateTime(connection.webhooks_last_checked_at)}.`
          : "No webhook receipt timestamp is stored yet.",
      );
    } else {
      appendCheck(
        checks,
        CHECK_NAMES.webhookMode,
        "pass",
        "Lightspeed webhook mode is active.",
        `Last webhook received at ${formatDateTime(connection.last_webhook_received_at)}.`,
      );
    }

    const { data: queueJobs, error: queueError } = await supabaseAdmin
      .from("pos_sync_jobs_v2")
      .select(
        "id,status,sync_type,scheduled_at,last_progress_at,next_retry_at,last_error,failed_rows,attempts",
      )
      .eq("tenant_id", tenantId)
      .eq("provider", "lightspeed")
      .order("scheduled_at", { ascending: false })
      .limit(10);

    if (queueError) {
      appendCheck(
        checks,
        CHECK_NAMES.syncQueue,
        "fail",
        "Sync queue state could not be loaded.",
        queueError.message,
      );
    } else {
      const failedJobs = (queueJobs ?? []).filter((job) =>
        hasFailureStatus(job.status),
      );
      const activeJobs = (queueJobs ?? []).filter((job) =>
        hasActiveStatus(job.status),
      );
      const latestJob = queueJobs?.[0] ?? null;

      if (!queueJobs || queueJobs.length === 0) {
        appendCheck(
          checks,
          CHECK_NAMES.syncQueue,
          "warn",
          "No Lightspeed sync jobs have been recorded yet.",
        );
      } else if (failedJobs.length > 0) {
        appendCheck(
          checks,
          CHECK_NAMES.syncQueue,
          "fail",
          "One or more recent Lightspeed sync jobs failed.",
          `Latest failed job status: ${failedJobs[0].status} · last error: ${failedJobs[0].last_error ?? "unknown"}`,
        );
      } else if (activeJobs.length > 0) {
        appendCheck(
          checks,
          CHECK_NAMES.syncQueue,
          "warn",
          "Lightspeed sync jobs are currently queued or in progress.",
          `Latest job status: ${latestJob?.status ?? "unknown"} · scheduled ${formatDateTime(latestJob?.scheduled_at ?? null)}.`,
        );
      } else {
        appendCheck(
          checks,
          CHECK_NAMES.syncQueue,
          "pass",
          "Recent Lightspeed sync jobs completed without active queue pressure.",
          `Latest job status: ${latestJob?.status ?? "unknown"} · scheduled ${formatDateTime(latestJob?.scheduled_at ?? null)}.`,
        );
      }
    }

    const countTables = async () => {
      const [customersResult, salesResult, productsResult, crmResult] =
        await Promise.all([
          supabaseAdmin
            .from("lightspeed_customers")
            .select("*", { count: "exact", head: true })
            .eq("tenant_id", tenantId),
          supabaseAdmin
            .from("lightspeed_sales")
            .select("*", { count: "exact", head: true })
            .eq("tenant_id", tenantId),
          supabaseAdmin
            .from("lightspeed_products")
            .select("*", { count: "exact", head: true })
            .eq("tenant_id", tenantId),
          supabaseAdmin
            .from("crm_customers")
            .select("*", { count: "exact", head: true })
            .eq("tenant_id", tenantId)
            .eq("pos_source", "lightspeed"),
        ]);

      return { customersResult, salesResult, productsResult, crmResult };
    };

    const { customersResult, salesResult, productsResult, crmResult } =
      await countTables();

    const countErrors = [
      customersResult.error,
      salesResult.error,
      productsResult.error,
      crmResult.error,
    ].filter(Boolean);

    if (countErrors.length > 0) {
      appendCheck(
        checks,
        CHECK_NAMES.importedData,
        "fail",
        "Imported Lightspeed data counts could not be loaded.",
        countErrors
          .map((error) => error?.message ?? "unknown error")
          .join(" | "),
      );
    } else {
      const customersCount = customersResult.count ?? 0;
      const salesCount = salesResult.count ?? 0;
      const productsCount = productsResult.count ?? 0;
      const crmCustomersCount = crmResult.count ?? 0;

      const detail = `Customers ${customersCount} · Sales ${salesCount} · Products ${productsCount} · CRM ${crmCustomersCount}`;

      if (
        customersCount === 0 &&
        salesCount === 0 &&
        productsCount === 0 &&
        crmCustomersCount === 0
      ) {
        appendCheck(
          checks,
          CHECK_NAMES.importedData,
          "warn",
          "No Lightspeed data has been imported yet.",
          detail,
        );
      } else if (customersCount > 0 && crmCustomersCount === 0) {
        appendCheck(
          checks,
          CHECK_NAMES.importedData,
          "warn",
          "Lightspeed customer rows exist, but no normalized CRM customers were found.",
          detail,
        );
      } else {
        appendCheck(
          checks,
          CHECK_NAMES.importedData,
          "pass",
          "Imported Lightspeed data is present in provider tables and CRM.",
          detail,
        );
      }
    }

    diagnostics.summary = createSummary(checks);

    return new Response(JSON.stringify(diagnostics, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[LS-DIAGNOSTICS] Error:", error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
