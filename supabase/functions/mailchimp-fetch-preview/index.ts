import { createClient } from "npm:@supabase/supabase-js@2";
import { assertEncryptionKeyConfigured } from "../_shared/crypto/tokens.ts";
import { corsJsonResponse, handleCorsPrelight } from "../_shared/cors.ts";
import { MailchimpClient } from "../_shared/mailchimp/MailchimpClient.ts";
import type {
  MailchimpConnectionCredentials,
  MailchimpMember,
} from "../_shared/mailchimp/types.ts";

if (import.meta.main) {
  try {
    assertEncryptionKeyConfigured();
  } catch (error: any) {
    console.error("[mailchimp-fetch-preview] FATAL:", error.message);
  }
}

export interface MailchimpFetchPreviewDependencies {
  createClient: typeof createClient;
  envGet: (key: string) => string | undefined;
  mailchimpFromConnection: (
    connection: MailchimpConnectionCredentials,
  ) => Promise<MailchimpClient>;
}

interface PreviewListSummary {
  id: string;
  name: string;
  totalMembers: number;
}

const defaultDependencies: MailchimpFetchPreviewDependencies = {
  createClient,
  envGet: (key) => Deno.env.get(key),
  mailchimpFromConnection: (connection) =>
    MailchimpClient.fromConnection(connection),
};

export async function handleMailchimpFetchPreview(
  req: Request,
  deps: MailchimpFetchPreviewDependencies = defaultDependencies,
): Promise<Response> {
  const corsResponse = handleCorsPrelight(req);
  if (corsResponse) {
    return corsResponse;
  }

  try {
    const { jobId } = await req.json();
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      throw new Error("Missing Authorization header");
    }

    const supabaseAuth = deps.createClient(
      deps.envGet("SUPABASE_URL") ?? "",
      deps.envGet("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace("Bearer ", "");

    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser(token);
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const supabase = deps.createClient(
      deps.envGet("SUPABASE_URL") ?? "",
      deps.envGet("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (userError || !userData?.tenant_id) {
      throw new Error("No tenant found");
    }

    const tenantId = userData.tenant_id;

    const { data: job, error: jobError } = await supabase
      .from("import_jobs")
      .select("config")
      .eq("id", jobId)
      .eq("user_id", user.id)
      .eq("tenant_id", tenantId)
      .single();

    if (jobError || !job) {
      throw new Error("Job not found");
    }

    const { data: connection, error: connectionError } = await supabase
      .from("provider_connections")
      .select("encrypted_access_token, metadata")
      .eq("tenant_id", tenantId)
      .eq("user_id", user.id)
      .eq("provider", "mailchimp")
      .eq("status", "connected")
      .single();

    if (connectionError) {
      throw new Error(
        `Failed to load Mailchimp connection: ${connectionError.message}`,
      );
    }

    if (!connection?.encrypted_access_token) {
      throw new Error("Mailchimp not connected");
    }

    const client = await deps.mailchimpFromConnection(
      connection as MailchimpConnectionCredentials,
    );

    const config = asObject(job.config);
    const listIds = asStringArray(config?.listIds);
    const segmentIds = asStringArray(config?.segmentIds);
    const listId = listIds[0] ?? extractListId(segmentIds[0]);

    if (!listId) {
      throw new Error("No Mailchimp list selected for preview");
    }

    const listInfo = await client.getList(listId);

    let resolvedListInfo: PreviewListSummary = {
      id: listInfo.id,
      name: listInfo.name,
      totalMembers: listInfo.stats?.member_count ?? 0,
    };
    let resolvedListInfos: PreviewListSummary[] = [resolvedListInfo];
    let estimatedImportCount = listInfo.stats?.member_count ?? 0;
    let selectedSegments: Array<{
      id: string;
      name: string;
      memberCount: number;
    }> = [];
    let previewMembers: MailchimpMember[] = [];

    if (segmentIds.length > 0) {
      const segmentArtifacts = await loadSelectedSegmentArtifacts(
        supabase,
        client,
        tenantId,
        segmentIds,
      );

      selectedSegments = segmentArtifacts.map((segment) => ({
        id: segment.id,
        name: segment.name,
        memberCount: segment.memberCount,
      }));

      estimatedImportCount = selectedSegments.reduce(
        (sum, segment) => sum + segment.memberCount,
        0,
      );
      resolvedListInfos = [resolvedListInfo];
      previewMembers = (
        await client.getSegmentMembers(
          listId,
          extractSegmentId(segmentIds[0]) ?? "",
          0,
          10,
        )
      ).members;
    } else {
      const sampleSizePerList = getListPreviewSampleSize(listIds.length);
      const resolvedLists = await Promise.all(
        listIds.map(async (selectedListId) => {
          const [selectedList, membersResponse] = await Promise.all([
            client.getList(selectedListId),
            client.getListMembers(selectedListId, 0, sampleSizePerList),
          ]);

          return {
            list: selectedList,
            members: membersResponse.members,
          };
        }),
      );

      estimatedImportCount = resolvedLists.reduce(
        (sum, entry) => sum + (entry.list.stats?.member_count ?? 0),
        0,
      );
      resolvedListInfos = resolvedLists.map((entry) => ({
        id: entry.list.id,
        name: entry.list.name,
        totalMembers: entry.list.stats?.member_count ?? 0,
      }));
      previewMembers = dedupePreviewMembersByEmail(
        resolvedLists.flatMap((entry) => entry.members),
      );
      resolvedListInfo =
        resolvedLists.length === 1
          ? resolvedListInfos[0]
          : {
              id: "multiple",
              name: `${resolvedLists.length} selected lists`,
              totalMembers: estimatedImportCount,
            };
    }

    const normalizedContacts = previewMembers.map(normalizePreviewContact);
    const sampleEmails = normalizedContacts
      .map((contact) => contact.email.toLowerCase())
      .filter(
        (email, index, all) => email.length > 0 && all.indexOf(email) === index,
      );

    let existingCount = 0;
    if (sampleEmails.length > 0) {
      const { data: existing, error: existingError } = await supabase
        .from("crm_customers")
        .select("email")
        .eq("tenant_id", tenantId)
        .in("email", sampleEmails);

      if (existingError) {
        throw new Error(
          `Failed to estimate duplicates: ${existingError.message}`,
        );
      }

      existingCount = existing?.length ?? 0;
    }

    const duplicateRate =
      normalizedContacts.length > 0
        ? existingCount / normalizedContacts.length
        : 0;
    const alreadyInCRM = Math.round(estimatedImportCount * duplicateRate);
    const newContacts = Math.max(0, estimatedImportCount - alreadyInCRM);
    const estimatedDuration = formatEstimatedDuration(estimatedImportCount);

    return corsJsonResponse({
      listInfo: resolvedListInfo,
      listInfos: resolvedListInfos,
      selectedSegments,
      sampleContacts: normalizedContacts,
      estimatedImportCount,
      estimatedDuration,
      alreadyInCRM,
      newContacts,
    });
  } catch (error: any) {
    console.error("[mailchimp-fetch-preview] Error:", error);
    return corsJsonResponse({ error: error.message }, { status: 500 });
  }
}

if (import.meta.main) {
  Deno.serve((req) => handleMailchimpFetchPreview(req));
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

function extractListId(segmentSelection?: string): string | null {
  if (!segmentSelection) {
    return null;
  }

  const separatorIndex = segmentSelection.indexOf(":");
  return separatorIndex === -1
    ? null
    : segmentSelection.slice(0, separatorIndex);
}

function extractSegmentId(segmentSelection?: string): string | null {
  if (!segmentSelection) {
    return null;
  }

  const separatorIndex = segmentSelection.indexOf(":");
  return separatorIndex === -1
    ? segmentSelection
    : segmentSelection.slice(separatorIndex + 1);
}

export async function loadSelectedSegmentArtifacts(
  supabase: any,
  client: MailchimpClient,
  tenantId: string,
  segmentSelections: string[],
): Promise<Array<{ id: string; name: string; memberCount: number }>> {
  if (segmentSelections.length === 0) {
    return [];
  }

  const { data: artifacts, error } = await supabase
    .from("provider_artifacts")
    .select("external_id, name, member_count")
    .eq("tenant_id", tenantId)
    .eq("provider", "mailchimp")
    .eq("artifact_type", "segment")
    .in("external_id", segmentSelections);

  if (error) {
    throw new Error(
      `Failed to load Mailchimp segment artifacts: ${error.message}`,
    );
  }

  const artifactMap = new Map(
    (artifacts ?? []).map((artifact: any) => [artifact.external_id, artifact]),
  );

  return await Promise.all(
    segmentSelections.map(async (selection) => {
      const artifact = artifactMap.get(selection) as any;
      if (artifact) {
        return {
          id: selection,
          name: String(artifact.name),
          memberCount: Number(artifact.member_count ?? 0),
        };
      }

      const listId = extractListId(selection);
      const segmentId = extractSegmentId(selection) ?? selection;
      if (!listId) {
        return {
          id: selection,
          name: `Segment ${segmentId}`,
          memberCount: 0,
        };
      }

      const liveSegments = await client.getSegments(listId);
      const liveSegment = liveSegments.find(
        (segment) => String(segment.id) === segmentId,
      );

      return {
        id: selection,
        name: liveSegment?.name ?? `Segment ${segmentId}`,
        memberCount: liveSegment?.member_count ?? 0,
      };
    }),
  );
}

function normalizePreviewContact(member: MailchimpMember) {
  return {
    email: member.email_address,
    firstName: member.merge_fields?.FNAME ?? null,
    lastName: member.merge_fields?.LNAME ?? null,
    status: member.status,
    tags: Array.isArray(member.tags) ? member.tags.map((tag) => tag.name) : [],
  };
}

function getListPreviewSampleSize(selectedListCount: number) {
  if (selectedListCount <= 0) {
    return 20;
  }

  return Math.max(3, Math.floor(20 / selectedListCount));
}

function dedupePreviewMembersByEmail(members: MailchimpMember[]) {
  const seenEmails = new Set<string>();
  const dedupedMembers: MailchimpMember[] = [];

  for (const member of members) {
    const email = member.email_address.trim().toLowerCase();

    if (!email || seenEmails.has(email)) {
      continue;
    }

    seenEmails.add(email);
    dedupedMembers.push(member);
  }

  return dedupedMembers;
}

function formatEstimatedDuration(estimatedImportCount: number): string {
  const pagesEstimate = Math.ceil(estimatedImportCount / 100);
  const minutesEstimate = Math.max(1, Math.ceil(pagesEstimate * 0.05));

  if (minutesEstimate <= 2) {
    return "Under 2 minutes";
  }

  if (minutesEstimate <= 10) {
    return `${minutesEstimate}-${minutesEstimate + 2} minutes`;
  }

  const hoursEstimate = Math.max(1, Math.floor(minutesEstimate / 60));
  return `${hoursEstimate} hour${hoursEstimate > 1 ? "s" : ""}`;
}
