import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Authenticate the requesting admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user: adminUser },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !adminUser) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Verify admin is in app_admin_emails
    const { data: adminCheck } = await supabase
      .from("app_admin_emails")
      .select("email")
      .ilike("email", adminUser.email ?? "")
      .limit(1)
      .single();

    if (!adminCheck) {
      return new Response(
        JSON.stringify({ error: "Access denied. Master admin required." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Parse request
    const { target_user_email, target_tenant_id } = await req.json();

    if (!target_user_email) {
      return new Response(
        JSON.stringify({ error: "target_user_email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Generate a magic link for the target user
    const { data: linkData, error: linkError } =
      await supabase.auth.admin.generateLink({
        type: "magiclink",
        email: target_user_email,
      });

    if (linkError || !linkData) {
      console.error("Failed to generate magic link:", linkError);
      return new Response(
        JSON.stringify({
          error: linkError?.message || "Failed to generate login link",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Log the impersonation to admin_audit_log
    await supabase.from("admin_audit_log").insert({
      admin_user_id: adminUser.id,
      target_tenant_id: target_tenant_id || null,
      action_type: "impersonate_user",
      action_details: {
        target_email: target_user_email,
        admin_email: adminUser.email,
      },
    });

    // Return the action link (contains the OTP token)
    const actionLink = linkData.properties?.action_link;

    return new Response(
      JSON.stringify({
        success: true,
        login_url: actionLink,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error("admin-impersonate-user error:", err);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
