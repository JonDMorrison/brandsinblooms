import { createClient } from "npm:@supabase/supabase-js@2";

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

function splitName(name: string | null) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return {
    first_name: parts.shift() || null,
    last_name: parts.join(" ") || null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const token = authHeader.slice("Bearer ".length);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();
    if (userError || !userData?.tenant_id) {
      return jsonResponse({ error: "User tenant not found" }, 403);
    }

    const { connection_id: connectionId } = await req.json();
    if (!connectionId || typeof connectionId !== "string") {
      return jsonResponse({ error: "connection_id is required" }, 400);
    }

    const { data: connection, error: connectionError } = await supabase
      .from("pos_connections")
      .select("id, tenant_id, platform")
      .eq("id", connectionId)
      .eq("tenant_id", userData.tenant_id)
      .single();
    if (connectionError || !connection) {
      return jsonResponse({ error: "POS connection not found" }, 404);
    }

    const { data: posCustomers, error: posError } = await supabase
      .from("pos_customers")
      .select("id, external_id, name, email, phone, tags, raw_data")
      .eq("pos_connection_id", connection.id)
      .order("id");
    if (posError) {
      throw new Error(`Failed to fetch POS customers: ${posError.message}`);
    }

    const customerIds = (posCustomers || []).map((customer) => customer.id);
    const existingLinks = new Set<string>();
    for (let i = 0; i < customerIds.length; i += 200) {
      const chunk = customerIds.slice(i, i + 200);
      const { data: links, error: linksError } = await supabase
        .from("crm_customer_identity_links")
        .select("pos_customer_id")
        .eq("tenant_id", userData.tenant_id)
        .in("pos_customer_id", chunk);
      if (linksError) {
        throw new Error(
          `Failed to load existing identity links: ${linksError.message}`,
        );
      }
      for (const link of links || []) {
        if (link.pos_customer_id) existingLinks.add(link.pos_customer_id);
      }
    }

    let linked = 0;
    let created = 0;
    let alreadyLinked = 0;
    let conflicts = 0;
    const errors: Array<{ pos_customer_id: string; error: string }> = [];

    for (const posCustomer of posCustomers || []) {
      if (existingLinks.has(posCustomer.id)) {
        alreadyLinked += 1;
        continue;
      }

      try {
        const names = splitName(posCustomer.name);
        const { data, error } = await supabase.rpc(
          "resolve_crm_customer_identity",
          {
            p_tenant_id: userData.tenant_id,
            p_provider: String(connection.platform || "pos").toLowerCase(),
            p_external_id: posCustomer.external_id,
            p_pos_connection_id: connection.id,
            p_pos_customer_id: posCustomer.id,
            p_email: posCustomer.email,
            p_phone: posCustomer.phone,
            p_user_id: user.id,
            p_profile: {
              ...names,
              custom_fields: {
                pos_tags: posCustomer.tags || [],
                pos_raw_data: posCustomer.raw_data || {},
              },
            },
          },
        );
        if (error) throw error;

        if (!data?.customer_id) {
          conflicts += 1;
          continue;
        }
        if (data.created) created += 1;
        else linked += 1;
        if (data.conflict_id) conflicts += 1;
      } catch (error) {
        errors.push({
          pos_customer_id: posCustomer.id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return jsonResponse({
      success: errors.length === 0,
      linked,
      created,
      already_linked: alreadyLinked,
      conflicts,
      total_processed: (posCustomers || []).length,
      errors,
    });
  } catch (error) {
    console.error("pos-link-customers failed", error);
    return jsonResponse(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});
