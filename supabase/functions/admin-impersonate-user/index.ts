import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  createClient,
  type SupabaseClient,
  type User,
} from "npm:@supabase/supabase-js@2";
import type { Database } from "../../../src/integrations/supabase/types.ts";

type PublicSchema = Database["public"];
type AdminSupabaseClient = SupabaseClient<Database, "public", PublicSchema>;

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

// The app origins this function may send an impersonation tab to. A caller's redirect_origin must be one of them
// (crm-r1-F12); nothing is taken from the request otherwise.
function allowedAppOrigins(): string[] {
  const configured = [
    Deno.env.get("APP_URL"),
    Deno.env.get("VITE_APP_URL"),
    Deno.env.get("APP_ORIGIN"),
    ...(Deno.env.get("IMPERSONATION_ALLOWED_ORIGINS") ?? "").split(","),
  ];
  return [...new Set(configured.map(normalizeOrigin).filter((v): v is string => Boolean(v)))];
}

function resolveRedirectOrigin(redirectOrigin: string | null | undefined): string | null {
  const allowed = allowedAppOrigins();
  if (allowed.length === 0) {
    return null;
  }
  const requested = normalizeOrigin(redirectOrigin);
  if (!requested) {
    return allowed[0];
  }
  return allowed.includes(requested) ? requested : null;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

type ServiceRpcResult = { data: unknown; error: string | null; code: string | null; hint: string | null };

// Service-role RPC through the Data API (the two impersonation functions are service-role only). A refusal keeps
// the database's error code and hint, so the caller can answer it precisely.
async function callServiceRpc(
  supabaseUrl: string,
  serviceRoleKey: string,
  name: string,
  args: Record<string, unknown>,
): Promise<ServiceRpcResult> {
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
    });
    const text = await response.text();
    if (!response.ok) {
      let code: string | null = null;
      let hint: string | null = null;
      try {
        const parsed = JSON.parse(text) as { code?: unknown; hint?: unknown };
        code = typeof parsed.code === "string" ? parsed.code : null;
        hint = typeof parsed.hint === "string" ? parsed.hint : null;
      } catch {
        // Not a Data API error body: no code to report.
      }
      return { data: null, error: text || `HTTP ${response.status}`, code, hint };
    }
    return { data: text ? JSON.parse(text) : null, error: null, code: null, hint: null };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "Unknown RPC error",
      code: null,
      hint: null,
    };
  }
}

// crm-r2-F15: admin_impersonation_start refuses some targets with 42501 and one of these hints.
function impersonationRefusal(hint: string | null): string {
  if (hint === "impersonation_target_admin") return "Impersonating another administrator is not allowed.";
  if (hint === "impersonation_target_bloomsuite") {
    return "This account signs in through BloomSuite ID only, so it can't be impersonated.";
  }
  return "Access denied. Master admin required.";
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

    // Verify the requester is a master admin with the exact check admin-manage-tenant
    // uses (allow-listed address by equality, or the master_admin role). The caller's
    // address is never used as a LIKE pattern.
    const { data: isMasterAdmin, error: adminCheckError } = await supabase.rpc(
      "is_master_admin",
      { _user_id: adminUser.id },
    );

    if (adminCheckError || isMasterAdmin !== true) {
      return new Response(
        JSON.stringify({ error: "Access denied. Master admin required." }),
        { status: 403, headers: jsonHeaders },
      );
    }

    // Parse request
    const body = (await req.json()) as Record<string, unknown>;

    // Step 2 (crm-r1-F07): the new tab redeems its grant with the SAME admin's session. Only then is the magic-link
    // token minted, so an impersonation address opened in any other browser can't start a session.
    if (body.op === "redeem") {
      const grantId = typeof body.grant_id === "string" ? body.grant_id : "";
      const nonce = typeof body.nonce === "string" ? body.nonce : "";
      if (!/^[0-9a-f-]{36}$/i.test(grantId) || nonce.length < 32) {
        return new Response(JSON.stringify({ error: "Invalid impersonation grant" }), { status: 400, headers: jsonHeaders });
      }
      const redeemed = await callServiceRpc(supabaseUrl, serviceRoleKey, "admin_impersonation_redeem", {
        p_grant_id: grantId,
        p_admin_user_id: adminUser.id,
        p_nonce_hash: await sha256Hex(nonce),
      });
      const targetUserId = typeof redeemed.data === "string" ? redeemed.data : null;
      if (redeemed.error || !targetUserId) {
        if (redeemed.error) console.error("Impersonation redeem failed:", redeemed.error);
        return new Response(
          JSON.stringify({ error: "This impersonation link is no longer valid. Start again from the admin page." }),
          { status: 403, headers: jsonHeaders },
        );
      }
      const { data: target, error: targetError } = await supabase.auth.admin.getUserById(targetUserId);
      if (targetError || !target?.user?.email) {
        return new Response(JSON.stringify({ error: "Target user not found" }), { status: 404, headers: jsonHeaders });
      }
      const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: "magiclink",
        email: target.user.email,
      });
      const tokenHash = linkData?.properties?.hashed_token;
      if (linkError || !tokenHash) {
        console.error("Failed to generate magic link:", linkError?.message ?? "missing hashed token");
        return new Response(JSON.stringify({ error: "Failed to generate login link" }), { status: 500, headers: jsonHeaders });
      }
      return new Response(
        JSON.stringify({ success: true, token_hash: tokenHash, type: "magiclink", target_email: target.user.email }),
        { status: 200, headers: jsonHeaders },
      );
    }

    // Step 1: record the audit row and a short-lived grant together (crm-r1-F11), and return the grant only.
    const targetUserEmail =
      typeof body.target_user_email === "string"
        ? body.target_user_email.trim()
        : "";
    const redirectOrigin =
      typeof body.redirect_origin === "string" ? body.redirect_origin : null;

    if (!targetUserEmail) {
      return new Response(
        JSON.stringify({ error: "target_user_email is required" }),
        { status: 400, headers: jsonHeaders },
      );
    }

    const appOrigin = resolveRedirectOrigin(redirectOrigin);
    if (!appOrigin) {
      return new Response(
        JSON.stringify({ error: "redirect_origin is not an allowed app origin" }),
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
    const nonce = randomToken();
    const started = await callServiceRpc(supabaseUrl, serviceRoleKey, "admin_impersonation_start", {
      p_admin_user_id: adminUser.id,
      p_target_user_id: resolvedAuthUser.id,
      p_nonce_hash: await sha256Hex(nonce),
      p_details: {
        target_email: targetUserEmail,
        admin_email: adminUser.email,
        resolved_auth_user_id: resolvedAuthUser.id,
      },
    });
    const grantId = typeof started.data === "string" ? started.data : null;
    if (started.error || !grantId) {
      // No audit row, no grant, no token.
      if (started.code === "42501") {
        return new Response(
          JSON.stringify({ error: impersonationRefusal(started.hint) }),
          { status: 403, headers: jsonHeaders },
        );
      }
      console.error("Impersonation could not be recorded:", started.error);
      return new Response(
        JSON.stringify({ error: "Impersonation could not be recorded" }),
        { status: 500, headers: jsonHeaders },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        grant_id: grantId,
        nonce,
        redirect_to: `${appOrigin}/admin/impersonate/callback`,
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
