import { createClient } from "npm:@supabase/supabase-js@2";
import { assertEncryptionKeyConfigured } from "../_shared/crypto/tokens.ts";
import { corsJsonResponse, handleCorsPrelight } from "../_shared/cors.ts";
import { MailchimpClient } from "../_shared/mailchimp/MailchimpClient.ts";
import type {
  MailchimpConnectionCredentials,
  MailchimpList,
  MailchimpSegment,
} from "../_shared/mailchimp/types.ts";

// Fail fast if encryption key is not configured
if (import.meta.main) {
  try {
    assertEncryptionKeyConfigured();
  } catch (error: any) {
    console.error("[mailchimp-fetch-lists] FATAL:", error.message);
  }
}

export interface MailchimpFetchListsDependencies {
  createClient: typeof createClient;
  envGet: (key: string) => string | undefined;
  mailchimpFromConnection: (
    connection: MailchimpConnectionCredentials,
  ) => Promise<MailchimpClient>;
}

const defaultDependencies: MailchimpFetchListsDependencies = {
  createClient,
  envGet: (key) => Deno.env.get(key),
  mailchimpFromConnection: (connection) =>
    MailchimpClient.fromConnection(connection),
};

export async function handleMailchimpFetchLists(
  req: Request,
  deps: MailchimpFetchListsDependencies = defaultDependencies,
): Promise<Response> {
  const corsResponse = handleCorsPrelight(req);
  if (corsResponse) {
    return corsResponse;
  }

  try {
    const requestBody = await req.json().catch(() => ({}));
    const preCache = requestBody?.preCache === true;
    const tenantIdFromBody = requestBody?.tenant_id;
    const userIdFromBody = requestBody?.user_id;
    const authHeader = req.headers.get("Authorization");

    if (!authHeader && !preCache) {
      console.error("[mailchimp-fetch-lists] No Authorization header found");
      throw new Error("Missing Authorization header");
    }

    const serviceRoleKey = deps.envGet("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const bearerToken = authHeader?.replace("Bearer ", "") ?? "";
    const apiKey = req.headers.get("apikey") ?? "";
    const isInternalPreCache = Boolean(
      preCache &&
      tenantIdFromBody &&
      userIdFromBody &&
      serviceRoleKey &&
      (bearerToken === serviceRoleKey || apiKey === serviceRoleKey),
    );

    const supabase = deps.createClient(
      deps.envGet("SUPABASE_URL") ?? "",
      deps.envGet("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    let tenantId = tenantIdFromBody as string | undefined;
    let userId = userIdFromBody as string | undefined;

    if (!isInternalPreCache) {
      console.log("[mailchimp-fetch-lists] Auth header present");

      const supabaseAuth = deps.createClient(
        deps.envGet("SUPABASE_URL") ?? "",
        deps.envGet("SUPABASE_ANON_KEY") ?? "",
        { global: { headers: { Authorization: authHeader ?? "" } } },
      );

      const token = authHeader?.replace("Bearer ", "") ?? "";
      const {
        data: { user },
        error: authError,
      } = await supabaseAuth.auth.getUser(token);

      if (authError) {
        console.error("[mailchimp-fetch-lists] Auth error:", authError);
        throw new Error(`Authentication failed: ${authError.message}`);
      }

      if (!user) {
        console.error("[mailchimp-fetch-lists] No user found after auth check");
        throw new Error("User not authenticated");
      }

      console.log("[mailchimp-fetch-lists] User authenticated:", user.id);
      userId = user.id;

      const { data: userRecord, error: userError } = await supabase
        .from("users")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (userError || !userRecord?.tenant_id) {
        throw new Error("Tenant not found for user");
      }

      tenantId = userRecord.tenant_id;
    }

    if (!tenantId || !userId) {
      throw new Error("Mailchimp pre-cache requires tenant_id and user_id");
    }

    // Get connection using service role
    const { data: connection, error: connectionError } = await supabase
      .from("provider_connections")
      .select("id, encrypted_access_token, metadata")
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .eq("provider", "mailchimp")
      .eq("status", "connected")
      .single();

    if (connectionError) {
      console.error(
        "[mailchimp-fetch-lists] Connection query error:",
        connectionError,
      );
      throw new Error(`Failed to fetch connection: ${connectionError.message}`);
    }

    if (!connection?.encrypted_access_token) {
      throw new Error("Mailchimp not connected or token missing");
    }

    const client = await deps.mailchimpFromConnection(
      connection as MailchimpConnectionCredentials,
    );
    const lists = await client.getLists();

    const listsWithSegments = await Promise.all(
      lists.map(async (list: MailchimpList) => {
        const segments = await client.getSegments(list.id);
        return {
          id: list.id,
          name: list.name,
          memberCount: list.stats?.member_count || 0,
          data: list,
          segments: segments.map((segment: MailchimpSegment) => ({
            id: segment.id,
            name: segment.name,
            memberCount: segment.member_count || 0,
            type: segment.type,
            options: segment.options,
            data: segment,
          })),
        };
      }),
    );

    await syncProviderArtifacts(supabase, tenantId, null, listsWithSegments);

    console.log(
      `[mailchimp-fetch-lists] Fetched ${listsWithSegments.length} lists`,
    );

    const normalizedLists = listsWithSegments.map((list) => ({
      id: list.id,
      name: list.name,
      memberCount: list.memberCount,
      segments: list.segments.map((segment) => ({
        id: segment.id,
        name: segment.name,
        memberCount: segment.memberCount,
        type: segment.type,
      })),
    }));

    return corsJsonResponse({
      lists: normalizedLists,
      totalLists: normalizedLists.length,
      totalSegments: normalizedLists.reduce(
        (sum, list) => sum + list.segments.length,
        0,
      ),
    });
  } catch (error: any) {
    console.error("[mailchimp-fetch-lists] Error:", error);
    return corsJsonResponse({ error: error.message }, { status: 400 });
  }
}

if (import.meta.main) {
  Deno.serve((req) => handleMailchimpFetchLists(req));
}

export async function syncProviderArtifacts(
  supabase: any,
  tenantId: string,
  importJobId: string | null,
  listsWithSegments: Array<{
    id: string;
    name: string;
    memberCount: number;
    data: MailchimpList;
    segments: Array<{
      id: number;
      name: string;
      memberCount: number;
      type: string;
      options?: Record<string, unknown>;
      data: MailchimpSegment;
    }>;
  }>,
) {
  const artifactRows = listsWithSegments.flatMap((list) => {
    const listRow = {
      import_job_id: importJobId,
      tenant_id: tenantId,
      provider: "mailchimp",
      artifact_type: "list",
      external_id: list.id,
      name: list.name,
      member_count: list.memberCount,
      data: list.data,
    };

    const segmentRows = list.segments.map((segment) => ({
      import_job_id: importJobId,
      tenant_id: tenantId,
      provider: "mailchimp",
      artifact_type: "segment",
      external_id: `${list.id}:${segment.id}`,
      name: segment.name,
      member_count: segment.memberCount,
      data: {
        ...segment.data,
        parent_list_id: list.id,
      },
    }));

    return [listRow, ...segmentRows];
  });

  if (artifactRows.length === 0) {
    return;
  }

  const { error: insertError } = await supabase
    .from("provider_artifacts")
    .upsert(artifactRows, {
      onConflict: "tenant_id,provider,artifact_type,external_id",
    });

  if (insertError) {
    throw new Error(
      `Failed to cache Mailchimp artifacts: ${insertError.message}`,
    );
  }
}
