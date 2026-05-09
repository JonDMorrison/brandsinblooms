import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  createClient,
  type SupabaseClient,
  type User,
} from "npm:@supabase/supabase-js@2";
import type { Database } from "../../../src/integrations/supabase/types.ts";

type PublicSchema = Database["public"];
type AdminSupabaseClient = SupabaseClient<Database, "public", PublicSchema>;
type AdminAuditLogInsert =
  Database["public"]["Tables"]["admin_audit_log"]["Insert"];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, content-type, x-client-info, apikey",
};

const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json",
};

const USER_LOOKUP_PAGE_SIZE = 200;

function normalizeOrigin(value: string | null | undefined): string | null {
  if (!value?.trim()) {
    return null;
  }

  try {
    return new URL(value.trim()).origin;
  } catch {
    return null;
  }
}

function resolveRedirectOrigin(
  redirectOrigin: string | null | undefined,
  supabaseUrl: string,
): string {
  const candidates = [
    redirectOrigin,
    Deno.env.get("VITE_APP_URL"),
    Deno.env.get("APP_URL"),
    supabaseUrl,
  ];

  for (const candidate of candidates) {
    const normalizedOrigin = normalizeOrigin(candidate);
    if (normalizedOrigin) {
      return normalizedOrigin;
    }
  }

  throw new Error("Failed to resolve redirect origin");
}

async function findAuthUsersByEmail(
  supabase: AdminSupabaseClient,
  email: string,
): Promise<User[]> {
  const normalizedEmail = email.trim().toLowerCase();
  const matches: User[] = [];
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: USER_LOOKUP_PAGE_SIZE,
    });

    if (error) {
      throw new Error(error.message);
    }

    const users = Array.isArray(data?.users) ? data.users : [];
    matches.push(
      ...users.filter(
        (user) => user.email?.trim().toLowerCase() === normalizedEmail,
      ),
    );

    if (users.length < USER_LOOKUP_PAGE_SIZE) {
      return matches;
    }

    page += 1;
  }
}

async function insertAdminAuditLog(
  supabaseUrl: string,
  serviceRoleKey: string,
  entry: AdminAuditLogInsert,
): Promise<string | null> {
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/admin_audit_log`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(entry),
    });

    if (response.ok) {
      return null;
    }

    const errorText = await response.text();
    return errorText || `HTTP ${response.status}`;
  } catch (error) {
    return error instanceof Error ? error.message : "Unknown audit log error";
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient<Database, "public", PublicSchema>(
      supabaseUrl,
      serviceRoleKey,
    );

    // Authenticate the requesting admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization required" }), {
        status: 401,
        headers: jsonHeaders,
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user: adminUser },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !adminUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: jsonHeaders,
      });
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
        { status: 403, headers: jsonHeaders },
      );
    }

    // Parse request
    const body = (await req.json()) as Record<string, unknown>;
    const targetUserEmail =
      typeof body.target_user_email === "string"
        ? body.target_user_email.trim()
        : "";
    const targetTenantId =
      typeof body.target_tenant_id === "string" ? body.target_tenant_id : null;
    const redirectOrigin =
      typeof body.redirect_origin === "string" ? body.redirect_origin : null;

    if (!targetUserEmail) {
      return new Response(
        JSON.stringify({ error: "target_user_email is required" }),
        { status: 400, headers: jsonHeaders },
      );
    }

    const matchedAuthUsers = await findAuthUsersByEmail(
      supabase,
      targetUserEmail,
    );

    if (matchedAuthUsers.length === 0) {
      return new Response(
        JSON.stringify({
          error:
            "Target user not found in auth system. This email may not have a valid login.",
        }),
        { status: 404, headers: jsonHeaders },
      );
    }

    if (matchedAuthUsers.length > 1) {
      return new Response(
        JSON.stringify({
          error:
            "Multiple auth users found for this email. Cannot determine impersonation target.",
        }),
        { status: 409, headers: jsonHeaders },
      );
    }

    const resolvedAuthUser = matchedAuthUsers[0];
    const redirectTo = `${resolveRedirectOrigin(redirectOrigin, supabaseUrl)}/admin/impersonate/callback`;

    // Generate a magic link for the target user
    const { data: linkData, error: linkError } =
      await supabase.auth.admin.generateLink({
        type: "magiclink",
        email: resolvedAuthUser.email ?? targetUserEmail,
        options: {
          redirectTo,
        },
      });

    if (linkError || !linkData) {
      console.error("Failed to generate magic link:", linkError);
      return new Response(
        JSON.stringify({
          error: linkError?.message || "Failed to generate login link",
        }),
        { status: 500, headers: jsonHeaders },
      );
    }

    const tokenHash = linkData.properties?.hashed_token;

    if (!tokenHash) {
      console.error("Magic link response missing hashed token:", linkData);
      return new Response(
        JSON.stringify({ error: "Failed to generate login link" }),
        { status: 500, headers: jsonHeaders },
      );
    }

    // Log the impersonation to admin_audit_log
    const auditError = await insertAdminAuditLog(supabaseUrl, serviceRoleKey, {
      admin_user_id: adminUser.id,
      target_tenant_id: targetTenantId || null,
      target_user_id: resolvedAuthUser.id,
      action_type: "impersonate_user",
      action_details: {
        target_email: targetUserEmail,
        admin_email: adminUser.email,
        resolved_auth_user_id: resolvedAuthUser.id,
      },
    });

    if (auditError) {
      console.error("Audit log insert failed:", auditError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        token_hash: tokenHash,
        type: "magiclink",
        redirect_to: redirectTo,
        target_email: targetUserEmail,
        target_user_id: resolvedAuthUser.id,
      }),
      {
        status: 200,
        headers: jsonHeaders,
      },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error("admin-impersonate-user error:", err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});
