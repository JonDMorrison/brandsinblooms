import { createClient } from "npm:@supabase/supabase-js@2";
import { decryptToken } from "../_shared/crypto/tokens.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function readNonNegativeInteger(value: unknown, field: string) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : 0;

  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`Square returned an invalid ${field}`);
  }

  return parsed;
}

async function hasAdminRole(supabaseAdmin: any, userId: string) {
  const [
    { data: isAdmin, error: adminError },
    { data: isMasterAdmin, error: masterAdminError },
  ] = await Promise.all([
    supabaseAdmin.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    }),
    supabaseAdmin.rpc("has_role", {
      _user_id: userId,
      _role: "master_admin",
    }),
  ]);

  if (adminError || masterAdminError) {
    throw new Error(
      `Failed to verify admin access: ${
        adminError?.message ?? masterAdminError?.message
      }`,
    );
  }

  return Boolean(isAdmin || isMasterAdmin);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse(
        { success: false, error: "Authentication required" },
        401,
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAuthed = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const {
      data: { user },
      error: userError,
    } = await supabaseAuthed.auth.getUser();

    if (userError || !user) {
      return jsonResponse({ success: false, error: "Invalid session" }, 401);
    }

    const { data: userData, error: tenantError } = await supabaseAdmin
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .maybeSingle();

    if (tenantError || !userData?.tenant_id) {
      return jsonResponse({ success: false, error: "Tenant not found" }, 403);
    }

    if (!(await hasAdminRole(supabaseAdmin, user.id))) {
      return jsonResponse(
        { success: false, error: "Admin access required for loyalty backfill" },
        403,
      );
    }

    const tenantId = userData.tenant_id;
    const { data: connection, error: connectionError } = await supabaseAdmin
      .from("square_connections")
      .select(
        "id, tenant_id, environment, encrypted_access_token, merchant_id, status",
      )
      .eq("tenant_id", tenantId)
      .eq("status", "connected")
      .maybeSingle();

    if (connectionError) {
      throw new Error(
        `Failed to load Square connection: ${connectionError.message}`,
      );
    }
    if (!connection) {
      return jsonResponse(
        { success: false, error: "No active Square connection found" },
        404,
      );
    }

    const accessToken = await decryptToken(connection.encrypted_access_token);
    const baseUrl =
      connection.environment === "sandbox"
        ? "https://connect.squareupsandbox.com/v2"
        : "https://connect.squareup.com/v2";

    let cursor: string | undefined;
    let totalProcessed = 0;
    let totalMatched = 0;
    let pageCount = 0;

    do {
      pageCount += 1;
      const response = await fetch(`${baseUrl}/loyalty/accounts/search`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Square-Version": "2024-01-18",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ limit: 100, cursor }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(
          errorBody?.errors?.[0]?.detail ?? "Square Loyalty API error",
        );
      }

      const data = await response.json();
      const loyaltyAccounts = Array.isArray(data?.loyalty_accounts)
        ? data.loyalty_accounts
        : [];
      cursor =
        typeof data?.cursor === "string" && data.cursor
          ? data.cursor
          : undefined;
      totalProcessed += loyaltyAccounts.length;

      for (const account of loyaltyAccounts) {
        if (
          typeof account?.id !== "string" ||
          typeof account?.customer_id !== "string"
        ) {
          throw new Error("Square loyalty account is missing its identity");
        }

        const { data: customer, error: customerError } = await supabaseAdmin
          .from("crm_customers")
          .select("id, tags, loyalty_member")
          .eq("tenant_id", tenantId)
          .eq("square_customer_id", account.customer_id)
          .maybeSingle();

        if (customerError) {
          throw new Error(
            `Square loyalty customer lookup failed: ${customerError.message}`,
          );
        }
        if (!customer) {
          continue;
        }

        const existingTags = Array.isArray(customer.tags) ? customer.tags : [];
        if (
          !existingTags.includes("Loyalty Member") ||
          customer.loyalty_member !== true
        ) {
          const { error: customerUpdateError } = await supabaseAdmin
            .from("crm_customers")
            .update({
              tags: existingTags.includes("Loyalty Member")
                ? existingTags
                : [...existingTags, "Loyalty Member"],
              loyalty_member: true,
              updated_at: new Date().toISOString(),
            })
            .eq("id", customer.id)
            .eq("tenant_id", tenantId);

          if (customerUpdateError) {
            throw new Error(
              `Square loyalty customer update failed: ${customerUpdateError.message}`,
            );
          }
        }

        const observedAt =
          typeof account.updated_at === "string"
            ? account.updated_at
            : new Date().toISOString();
        const { error: loyaltyError } = await supabaseAdmin.rpc(
          "sync_loyalty_account_snapshot",
          {
            p_tenant_id: tenantId,
            p_customer_id: customer.id,
            p_provider: "square",
            p_external_account_id: account.id,
            p_external_program_id: account.program_id ?? null,
            p_program_name: "Square Loyalty",
            p_balance: readNonNegativeInteger(account.balance, "point balance"),
            p_lifetime_value: readNonNegativeInteger(
              account.lifetime_points,
              "lifetime points",
            ),
            p_balance_unit: "points",
            p_currency: null,
            p_enrolled_at: account.enrolled_at ?? null,
            p_observed_at: observedAt,
          },
        );

        if (loyaltyError) {
          throw new Error(
            `Square loyalty snapshot failed: ${loyaltyError.message}`,
          );
        }

        totalMatched += 1;
      }

      if (cursor) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    } while (cursor);

    return jsonResponse({
      success: true,
      message: "Loyalty backfill complete",
      totalLoyaltyAccounts: totalProcessed,
      customersMatched: totalMatched,
      customersUnmatched: totalProcessed - totalMatched,
      pagesProcessed: pageCount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[SQUARE-LOYALTY-BACKFILL] Error:", message);
    return jsonResponse({ success: false, error: message }, 500);
  }
});
