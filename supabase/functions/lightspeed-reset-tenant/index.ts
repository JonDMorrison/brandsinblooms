import { createClient } from "npm:@supabase/supabase-js@2";
import { logActivityEvent } from "../_shared/activityLogger.ts";

import { corsHeaders } from "../_shared/cors.ts";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

async function resetLightspeedConnectionState(
  supabaseAdmin: any,
  tenantId: string,
) {
  const basePayload = {
    last_synced_at: null,
    last_customer_sync: null,
    last_sales_sync: null,
    last_product_sync: null,
    customers_synced: 0,
    sales_synced: 0,
    products_synced: 0,
    sync_errors: [],
  };

  const extendedPayload = {
    ...basePayload,
    last_customer_version_cursor: null,
    last_sales_version_cursor: null,
    last_product_version_cursor: null,
  };

  const attemptUpdate = async (
    payload: typeof extendedPayload | typeof basePayload,
  ) =>
    supabaseAdmin
      .from("lightspeed_connections")
      .update(payload, { count: "exact" })
      .eq("tenant_id", tenantId);

  const firstAttempt = await attemptUpdate(extendedPayload);

  if (!firstAttempt.error) {
    return firstAttempt;
  }

  const missingVersionCursorColumn =
    /last_(customer|sales|product)_version_cursor/i.test(
      firstAttempt.error.message,
    );

  if (!missingVersionCursorColumn) {
    return firstAttempt;
  }

  console.warn(
    "[lightspeed-reset-tenant] Version cursor columns missing from schema cache, retrying without them.",
  );

  return attemptUpdate(basePayload);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse(
        { error: true, message: "Authentication required." },
        401,
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const supabaseAuthed = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const {
      data: { user },
      error: authError,
    } = await supabaseAuthed.auth.getUser();

    if (authError || !user) {
      return jsonResponse({ error: true, message: "Invalid session." }, 401);
    }

    if (!user.email) {
      return jsonResponse(
        { error: true, message: "User email is required." },
        403,
      );
    }

    const { data: adminCheck, error: adminError } = await supabaseAdmin
      .from("app_admin_emails")
      .select("email")
      .eq("email", user.email)
      .maybeSingle();

    if (adminError || !adminCheck) {
      return jsonResponse(
        { error: true, message: "Super admin access required." },
        403,
      );
    }

    const { data: userRecord, error: userError } = await supabaseAuthed
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (userError || !userRecord?.tenant_id) {
      return jsonResponse(
        { error: true, message: "No tenant found for this user." },
        400,
      );
    }

    const tenantId = userRecord.tenant_id;

    const { data: connection } = await supabaseAdmin
      .from("lightspeed_connections")
      .select("id, domain_prefix, retailer_name")
      .eq("tenant_id", tenantId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { count: activeJobCount, error: activeJobsError } =
      await supabaseAdmin
        .from("pos_sync_jobs_v2")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("provider", "lightspeed")
        .eq("status", "in_progress");

    if (activeJobsError) {
      throw new Error(
        `Failed to inspect active Lightspeed jobs: ${activeJobsError.message}`,
      );
    }

    if ((activeJobCount ?? 0) > 0) {
      return jsonResponse(
        {
          error: true,
          message:
            "Wait for active Lightspeed sync jobs to finish before resetting synced data.",
          activeJobCount,
        },
        409,
      );
    }

    const { count: deletedCustomerCount, error: deleteCustomersError } =
      await supabaseAdmin
        .from("lightspeed_customers")
        .delete({ count: "exact" })
        .eq("tenant_id", tenantId);

    if (deleteCustomersError) {
      throw new Error(
        `Failed to delete Lightspeed customers: ${deleteCustomersError.message}`,
      );
    }

    const { count: deletedSalesCount, error: deleteSalesError } =
      await supabaseAdmin
        .from("lightspeed_sales")
        .delete({ count: "exact" })
        .eq("tenant_id", tenantId);

    if (deleteSalesError) {
      throw new Error(
        `Failed to delete Lightspeed sales: ${deleteSalesError.message}`,
      );
    }

    const { count: deletedProductsCount, error: deleteProductsError } =
      await supabaseAdmin
        .from("lightspeed_products")
        .delete({ count: "exact" })
        .eq("tenant_id", tenantId);

    if (deleteProductsError) {
      throw new Error(
        `Failed to delete Lightspeed products: ${deleteProductsError.message}`,
      );
    }

    const {
      count: deletedCatalogProductsCount,
      error: deleteCatalogProductsError,
    } = await supabaseAdmin
      .from("products")
      .delete({ count: "exact" })
      .eq("tenant_id", tenantId)
      .eq("source", "lightspeed");

    if (deleteCatalogProductsError) {
      throw new Error(
        `Failed to delete mirrored Lightspeed catalog products: ${deleteCatalogProductsError.message}`,
      );
    }

    const { count: deletedSyncJobCount, error: deleteSyncJobsError } =
      await supabaseAdmin
        .from("pos_sync_jobs_v2")
        .delete({ count: "exact" })
        .eq("tenant_id", tenantId)
        .eq("provider", "lightspeed");

    if (deleteSyncJobsError) {
      throw new Error(
        `Failed to delete Lightspeed sync jobs: ${deleteSyncJobsError.message}`,
      );
    }

    const { count: resetConnectionCount, error: resetConnectionsError } =
      await resetLightspeedConnectionState(supabaseAdmin, tenantId);

    if (resetConnectionsError) {
      throw new Error(
        `Failed to reset Lightspeed connection state: ${resetConnectionsError.message}`,
      );
    }

    const counts = {
      customers: deletedCustomerCount ?? 0,
      sales: deletedSalesCount ?? 0,
      products: deletedProductsCount ?? 0,
      catalogProducts: deletedCatalogProductsCount ?? 0,
      syncJobs: deletedSyncJobCount ?? 0,
      connections: resetConnectionCount ?? 0,
    };

    const { error: auditError } = await supabaseAdmin
      .from("admin_audit_log")
      .insert({
        admin_user_id: user.id,
        target_tenant_id: tenantId,
        action_type: "reset_lightspeed_synced_data",
        action_details: {
          counts,
          triggered_at: new Date().toISOString(),
        },
      });

    if (auditError) {
      console.error(
        "[lightspeed-reset-tenant] Failed to write admin audit log:",
        auditError,
      );
    }

    try {
      await logActivityEvent(supabaseAdmin, {
        tenant_id: tenantId,
        actor_type: "user",
        actor_id: user.id,
        source: "ui",
        integration_name: "lightspeed",
        activity_type: "lightspeed.connection.reset",
        status: "success",
        title: "Lightspeed synced data reset",
        description: {
          parts: [
            {
              type: "text",
              text: `Reset synced Lightspeed data for ${connection?.retailer_name || connection?.domain_prefix || "Lightspeed store"} while preserving the connection`,
            },
          ],
        },
        metadata: {
          connection_id: connection?.id ?? null,
          domain_prefix: connection?.domain_prefix ?? null,
          retailer_name: connection?.retailer_name ?? null,
          counts,
        },
        related_entities: {
          connection_id: connection?.id ?? null,
        },
        links: [
          { label: "View integration", href: "/integrations/lightspeed" },
        ],
      });
    } catch (activityError: any) {
      console.error(
        "[lightspeed-reset-tenant] Failed to log activity event:",
        activityError?.message ?? activityError,
      );
    }

    return jsonResponse({
      success: true,
      tenantId,
      counts,
      message:
        "Lightspeed synced data was reset for the current tenant. The connection remains connected.",
    });
  } catch (error: any) {
    console.error("[lightspeed-reset-tenant] Error:", error);
    return jsonResponse(
      {
        error: true,
        message:
          error?.message ??
          "Unable to reset Lightspeed synced data for this tenant.",
      },
      500,
    );
  }
});
