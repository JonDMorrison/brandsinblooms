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

interface ValidationCheck {
  name:
    | "connection_active"
    | "api_reachable"
    | "email_format"
    | "duplicate_detection";
  passed: boolean;
  details: string;
}

const defaultDependencies: MailchimpValidateDependencies = {
  createClient,
  envGet: (key) => Deno.env.get(key),
  mailchimpFromConnection: (connection) =>
    MailchimpClient.fromConnection(connection),
};

function buildJsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}

function buildSkippedCheck(
  name: ValidationCheck["name"],
  reason: string,
): ValidationCheck {
  return {
    name,
    passed: false,
    details: reason,
  };
}

function parseSegmentSelection(value: string) {
  const separatorIndex = value.indexOf(":");

  if (separatorIndex === -1) {
    return {
      listId: null,
      segmentId: value || null,
    };
  }

  return {
    listId: value.slice(0, separatorIndex),
    segmentId: value.slice(separatorIndex + 1) || null,
  };
}

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

    const checks: ValidationCheck[] = [];
    const validationErrors: string[] = [];

    // Check connection state before touching Mailchimp.
    const { data: connection } = await supabase
      .from("provider_connections")
      .select("*")
      .eq("tenant_id", userData.tenant_id)
      .eq("provider", "mailchimp")
      .single();

    if (!connection?.encrypted_access_token) {
      const details = "Mailchimp is not connected for this tenant.";
      validationErrors.push(details);
      checks.push({
        name: "connection_active",
        passed: false,
        details,
      });
      checks.push(
        buildSkippedCheck(
          "api_reachable",
          "Skipped because the Mailchimp connection is not active.",
        ),
      );
      checks.push(
        buildSkippedCheck(
          "email_format",
          "Skipped because the Mailchimp connection is not active.",
        ),
      );
      checks.push(
        buildSkippedCheck(
          "duplicate_detection",
          "Skipped because the Mailchimp connection is not active.",
        ),
      );

      return buildJsonResponse({
        valid: false,
        checks,
        validationErrors,
      });
    }

    if (connection.status !== "connected") {
      const details = `Mailchimp connection is ${connection.status}. Reconnect Mailchimp before validating this import.`;
      validationErrors.push(details);
      checks.push({
        name: "connection_active",
        passed: false,
        details,
      });
      checks.push(
        buildSkippedCheck(
          "api_reachable",
          "Skipped because the Mailchimp connection is not active.",
        ),
      );
      checks.push(
        buildSkippedCheck(
          "email_format",
          "Skipped because the Mailchimp connection is not active.",
        ),
      );
      checks.push(
        buildSkippedCheck(
          "duplicate_detection",
          "Skipped because the Mailchimp connection is not active.",
        ),
      );

      return buildJsonResponse({
        valid: false,
        checks,
        validationErrors,
      });
    }

    checks.push({
      name: "connection_active",
      passed: true,
      details: "Mailchimp connection is active.",
    });

    const client = await deps.mailchimpFromConnection(
      connection as MailchimpConnectionCredentials,
    );
    const isAlive = await client.ping();
    if (!isAlive) {
      const details = "Could not connect to the Mailchimp API.";
      checks.push({
        name: "api_reachable",
        passed: false,
        details,
      });
      checks.push(
        buildSkippedCheck(
          "email_format",
          "Skipped because the Mailchimp API is not reachable.",
        ),
      );
      checks.push(
        buildSkippedCheck(
          "duplicate_detection",
          "Skipped because the Mailchimp API is not reachable.",
        ),
      );

      return buildJsonResponse({
        valid: false,
        checks,
        validationErrors: [details],
        error: "Could not connect to Mailchimp API",
      });
    }

    checks.push({
      name: "api_reachable",
      passed: true,
      details: "Mailchimp API responded to the validation ping.",
    });

    const config = job.config as any;
    const listIds = Array.isArray(config.listIds) ? config.listIds : [];
    const segmentSelections = Array.isArray(config.segmentIds)
      ? config.segmentIds
      : [];
    const validationMembers: Array<{ email_address: string }> = [];

    // Validate each selected list and segment, then sample for duplicates.
    for (const listId of listIds) {
      const membersData = await client.getListMembers(listId, 0, 100);

      validationMembers.push(...(membersData.members || []));

      for (const selection of segmentSelections) {
        const { listId: selectedListId, segmentId } =
          parseSegmentSelection(selection);

        if (selectedListId !== listId || !segmentId) {
          continue;
        }

        const segmentMembers = await client.getSegmentMembers(
          listId,
          segmentId,
          0,
          100,
        );
        validationMembers.push(...(segmentMembers.members || []));
      }
    }

    for (const member of validationMembers) {
      const email = member.email_address;

      if (!validateEmail(email)) {
        validationErrors.push(`Invalid email format: ${email}`);
      }
    }

    checks.push({
      name: "email_format",
      passed: validationErrors.length === 0,
      details:
        validationErrors.length === 0
          ? `Validated ${validationMembers.length.toLocaleString()} Mailchimp members across selected lists and segments.`
          : `Found ${validationErrors.length.toLocaleString()} invalid email address${validationErrors.length === 1 ? "" : "es"} in the sampled Mailchimp members.`,
    });

    const normalizedEmails = Array.from(
      new Set(
        validationMembers
          .map((member) => member.email_address?.toLowerCase().trim())
          .filter((email): email is string => Boolean(email)),
      ),
    );

    let existingDuplicates = 0;
    if (normalizedEmails.length > 0) {
      const { data: existing, error: duplicateError } = await supabase
        .from("crm_customers")
        .select("id, email")
        .eq("tenant_id", userData.tenant_id)
        .in("email", normalizedEmails);

      if (duplicateError) {
        throw duplicateError;
      }

      existingDuplicates = existing?.length ?? 0;
    }

    checks.push({
      name: "duplicate_detection",
      passed: true,
      details:
        existingDuplicates > 0
          ? `${existingDuplicates.toLocaleString()} sampled contact${existingDuplicates === 1 ? " already exists" : "s already exist"} in BloomSuite and will be updated or skipped during import.`
          : "No sampled contacts already exist in BloomSuite.",
    });

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

    const valid = checks
      .filter((check) => check.name !== "duplicate_detection")
      .every((check) => check.passed);

    return buildJsonResponse({
      valid,
      checks,
      validationErrors: limitedErrors,
    });
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

    return buildJsonResponse(
      {
        error: error.message,
        type: error.name,
      },
      statusCode,
    );
  }
}

if (import.meta.main) {
  Deno.serve((req) => handleMailchimpValidate(req));
}
