import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { MailchimpClient } from "../_shared/mailchimp/MailchimpClient.ts";
import type { MailchimpConnectionCredentials } from "../_shared/mailchimp/types.ts";

function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export interface MailchimpValidateDependencies {
  createClient: typeof createClient;
  envGet: (key: string) => string | undefined;
  mailchimpFromConnection: (
    connection: MailchimpConnectionCredentials,
  ) => Promise<MailchimpClient>;
}

const defaultDependencies: MailchimpValidateDependencies = {
  createClient,
  envGet: (key) => Deno.env.get(key),
  mailchimpFromConnection: (connection) =>
    MailchimpClient.fromConnection(connection),
};

export async function handleMailchimpValidate(
  req: Request,
  deps: MailchimpValidateDependencies = defaultDependencies,
): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { jobId } = await req.json();

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("[mailchimp-validate] No Authorization header");
      throw new Error("No authorization header");
    }

    // Use service role key to validate JWT
    const supabase = deps.createClient(
      deps.envGet("SUPABASE_URL")!,
      deps.envGet("SUPABASE_SERVICE_ROLE_KEY")!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    // Extract JWT from Authorization header and validate
    const jwt = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);
    if (userError || !user) {
      console.error("[mailchimp-validate] Auth error:", {
        error: userError,
        hasAuthHeader: !!authHeader,
        authHeaderPreview: authHeader
          ? authHeader.substring(0, 20) + "..."
          : "none",
      });

      return new Response(
        JSON.stringify({
          error:
            "Authentication failed. Please refresh the page and try again.",
          details: userError?.message || "No user session found",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        },
      );
    }

    console.log("[mailchimp-validate] Authenticated user:", user.id);

    // Get job and tenant
    const { data: job, error: jobError } = await supabase
      .from("import_jobs")
      .select("config, provider, tenant_id")
      .eq("id", jobId)
      .eq("user_id", user.id)
      .single();

    if (jobError || !job) {
      console.error("[mailchimp-validate] Job query error:", jobError);
      throw new Error("Job not found");
    }

    console.log("[mailchimp-validate] Found job for tenant:", job.tenant_id);

    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) throw new Error("No tenant found");

    // Get connection
    const { data: connection } = await supabase
      .from("provider_connections")
      .select("*")
      .eq("tenant_id", userData.tenant_id)
      .eq("provider", "mailchimp")
      .eq("status", "connected")
      .single();

    if (!connection?.encrypted_access_token) {
      throw new Error("Mailchimp not connected");
    }

    const client = await deps.mailchimpFromConnection(
      connection as MailchimpConnectionCredentials,
    );
    const isAlive = await client.ping();
    if (!isAlive) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: "Could not connect to Mailchimp API",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        },
      );
    }

    const config = job.config as any;
    const listIds = config.listIds || [];

    const validationErrors: string[] = [];

    // Validate each list and check for duplicate emails
    for (const listId of listIds) {
      const membersData = await client.getListMembers(listId, 0, 100);

      for (const member of membersData.members || []) {
        const email = member.email_address;

        // Validate email format
        if (!validateEmail(email)) {
          validationErrors.push(`Invalid email format: ${email}`);
        }

        // Check for duplicates in existing database
        const { data: existing } = await supabase
          .from("crm_customers")
          .select("id, email")
          .eq("tenant_id", userData.tenant_id)
          .eq("email", email.toLowerCase())
          .maybeSingle();

        // Note: We allow duplicates but warn about them
        if (existing) {
          console.log(`Duplicate found: ${email} will be updated`);
        }
      }
    }

    // Limit validation errors to first 50
    const limitedErrors = validationErrors.slice(0, 50);
    if (validationErrors.length > 50) {
      limitedErrors.push(
        `... and ${validationErrors.length - 50} more validation errors`,
      );
    }

    console.log(
      `[mailchimp-validate] Validation complete. Errors: ${limitedErrors.length}`,
    );

    return new Response(
      JSON.stringify({
        valid: limitedErrors.length === 0,
        validationErrors: limitedErrors,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("[mailchimp-validate] Error:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
    });

    // Determine appropriate status code
    const statusCode =
      error.message?.includes("Auth") || error.message?.includes("Unauthorized")
        ? 401
        : error.message?.includes("not found")
          ? 404
          : 500;

    return new Response(
      JSON.stringify({
        error: error.message,
        type: error.name,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: statusCode,
      },
    );
  }
}

if (import.meta.main) {
  Deno.serve((req) => handleMailchimpValidate(req));
}
