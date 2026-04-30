import { createClient } from "npm:@supabase/supabase-js@2";

import { logActivityEvent } from "../_shared/activityLogger.ts";
import { corsHeaders } from "../_shared/cors.ts";

type DisconnectBody = {
  connectionId?: string | null;
};

type LightspeedConnectionRecord = {
  id: string;
  tenant_id: string;
  user_id: string | null;
  domain_prefix: string | null;
  retailer_name: string | null;
  status: string | null;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

async function resolveTenantId(supabaseAdmin: any, userId: string) {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("tenant_id")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to resolve tenant: ${error.message}`);
  }

  return data?.tenant_id ?? null;
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

  if (adminError) {
    throw new Error(`Failed to verify admin role: ${adminError.message}`);
  }

  if (masterAdminError) {
    throw new Error(
      `Failed to verify master admin role: ${masterAdminError.message}`,
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
        { error: true, message: "Authentication required" },
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
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const {
      data: { user },
      error: authError,
    } = await supabaseAuthed.auth.getUser();

    if (authError || !user) {
      return jsonResponse({ error: true, message: "Invalid session" }, 401);
    }

    const body = ((await req.json().catch(() => ({}))) ?? {}) as DisconnectBody;
    const tenantId = await resolveTenantId(supabaseAdmin, user.id);

    if (!tenantId) {
      return jsonResponse(
        { error: true, message: "No tenant found for user." },
        400,
      );
    }

    let query = supabaseAdmin
      .from("lightspeed_connections")
      .select("id, tenant_id, user_id, domain_prefix, retailer_name, status")
      .eq("tenant_id", tenantId)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (body.connectionId) {
      query = query.eq("id", body.connectionId);
    }

    const { data: connection, error: connectionError } =
      await query.maybeSingle<LightspeedConnectionRecord>();

    if (connectionError) {
      throw new Error(
        `Failed to load Lightspeed connection: ${connectionError.message}`,
      );
    }

    if (!connection) {
      return jsonResponse(
        { error: true, message: "Lightspeed connection not found." },
        404,
      );
    }

    const isOwner = connection.user_id === user.id;
    const isAdmin = await hasAdminRole(supabaseAdmin, user.id);

    if (!isOwner && !isAdmin) {
      return jsonResponse(
        {
          error: true,
          message: "Admin access required to disconnect Lightspeed.",
        },
        403,
      );
    }

    const { error: deleteError } = await supabaseAdmin
      .from("lightspeed_connections")
      .delete()
      .eq("id", connection.id)
      .eq("tenant_id", tenantId);

    if (deleteError) {
      throw new Error(
        `Failed to disconnect Lightspeed: ${deleteError.message}`,
      );
    }

    try {
      await logActivityEvent(supabaseAdmin, {
        tenant_id: tenantId,
        actor_type: "user",
        actor_id: user.id,
        source: "ui",
        integration_name: "lightspeed",
        activity_type: "lightspeed.connection.disconnected",
        status: "success",
        title: "Lightspeed disconnected",
        description: {
          parts: [
            {
              type: "text",
              text: `Disconnected ${connection.retailer_name || connection.domain_prefix || "Lightspeed store"}`,
            },
          ],
        },
        metadata: {
          connection_id: connection.id,
          domain_prefix: connection.domain_prefix,
          retailer_name: connection.retailer_name,
          previous_status: connection.status,
        },
        related_entities: {
          connection_id: connection.id,
        },
        links: [
          { label: "View integration", href: "/integrations/lightspeed" },
        ],
      });
    } catch (activityError: any) {
      console.error(
        "[lightspeed-disconnect] Failed to log activity event:",
        activityError?.message ?? activityError,
      );
    }

    return jsonResponse({
      success: true,
      message: "Lightspeed disconnected successfully",
    });
  } catch (error: any) {
    console.error("[lightspeed-disconnect] Error:", error);
    return jsonResponse(
      {
        error: true,
        message: error?.message ?? "Lightspeed disconnect failed.",
      },
      500,
    );
  }
});
