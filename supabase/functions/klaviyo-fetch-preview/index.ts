import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

if (import.meta.main) {
  Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const { jobId } = await req.json();

      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        throw new Error("Missing Authorization header");
      }

      const supabaseAuth = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        { global: { headers: { Authorization: authHeader } } },
      );

      const token = authHeader.replace("Bearer ", "");

      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      );

      const {
        data: { user },
        error: authError,
      } = await supabaseAuth.auth.getUser(token);
      if (authError || !user) throw new Error("Unauthorized");

      // Get job and tenant
      const { data: job } = await supabase
        .from("import_jobs")
        .select("config")
        .eq("id", jobId)
        .eq("user_id", user.id)
        .single();

      if (!job) throw new Error("Job not found");

      const { data: userData } = await supabase
        .from("users")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!userData?.tenant_id) throw new Error("No tenant found");
      const tenantId = userData.tenant_id;

      // Get connection
      const { data: connection } = await supabase
        .from("provider_connections")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("user_id", user.id)
        .eq("provider", "klaviyo")
        .eq("status", "connected")
        .single();

      if (!connection?.access_token) {
        throw new Error("Klaviyo not connected");
      }

      const baseUrl = "https://a.klaviyo.com/api";
      const headers = {
        Authorization: `Klaviyo-OAuth ${connection.access_token}`,
        revision: "2024-10-15",
        Accept: "application/json",
      };

      const config = job.config as any;
      const listIds = config.listIds || [];
      const segmentIds = config.segmentIds || [];

      const lists = [];
      const selectedSegments = [];
      const sampleContacts = [];
      let estimatedImportCount = 0;
      let previewListInfo: {
        id: string;
        name: string;
        totalMembers: number;
      } | null = null;

      // Fetch list info
      for (const listId of listIds) {
        if (listId === "segments") continue;

        const listRes = await fetch(`${baseUrl}/lists/${listId}/`, { headers });
        const listData = await listRes.json();

        // Get profile count for this list
        const profilesRes = await fetch(
          `${baseUrl}/lists/${listId}/profiles/?page[size]=1`,
          { headers },
        );
        const profilesData = await profilesRes.json();
        const memberCount = profilesData.meta?.total || 0;

        const normalizedList = {
          id: listId,
          name: listData.data?.attributes?.name || "Unnamed List",
          memberCount,
        };

        lists.push(normalizedList);

        if (!previewListInfo) {
          previewListInfo = {
            id: listId,
            name: normalizedList.name,
            totalMembers: memberCount,
          };
        }

        estimatedImportCount += memberCount;

        // Fetch sample contacts (first 10)
        if (sampleContacts.length < 10) {
          const samplesRes = await fetch(
            `${baseUrl}/lists/${listId}/profiles/?page[size]=10`,
            { headers },
          );
          const samplesData = await samplesRes.json();

          for (const profile of samplesData.data || []) {
            if (sampleContacts.length >= 10) break;
            const attrs = profile.attributes;
            sampleContacts.push({
              email: attrs.email,
              firstName: attrs.first_name ?? null,
              lastName: attrs.last_name ?? null,
              status:
                attrs.subscriptions?.email?.marketing?.consent || "unknown",
              tags: [],
            });
          }
        }
      }

      // Fetch segment info
      for (const segmentId of segmentIds) {
        const segRes = await fetch(`${baseUrl}/segments/${segmentId}/`, {
          headers,
        });
        const segData = await segRes.json();

        // Get profile count for this segment
        const profilesRes = await fetch(
          `${baseUrl}/segments/${segmentId}/profiles/?page[size]=1`,
          { headers },
        );
        const profilesData = await profilesRes.json();

        const memberCount = profilesData.meta?.total || 0;
        const normalizedSegment = {
          id: segmentId,
          name: segData.data?.attributes?.name || "Unnamed Segment",
          memberCount,
        };

        selectedSegments.push(normalizedSegment);

        if (!previewListInfo) {
          previewListInfo = {
            id: segmentId,
            name: normalizedSegment.name,
            totalMembers: memberCount,
          };
        }

        if (listIds.length === 0) {
          estimatedImportCount += memberCount;
        }

        if (sampleContacts.length < 10 && listIds.length === 0) {
          const samplesRes = await fetch(
            `${baseUrl}/segments/${segmentId}/profiles/?page[size]=10`,
            { headers },
          );
          const samplesData = await samplesRes.json();

          for (const profile of samplesData.data || []) {
            if (sampleContacts.length >= 10) break;
            const attrs = profile.attributes;
            sampleContacts.push({
              email: attrs.email,
              firstName: attrs.first_name ?? null,
              lastName: attrs.last_name ?? null,
              status:
                attrs.subscriptions?.email?.marketing?.consent || "unknown",
              tags: [],
            });
          }
        }
      }

      if (!previewListInfo) {
        throw new Error("No Klaviyo lists or segments selected for preview");
      }

      const sampleEmails = sampleContacts
        .map((contact) => String(contact.email || "").toLowerCase())
        .filter(
          (email, index, all) =>
            email.length > 0 && all.indexOf(email) === index,
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
        sampleContacts.length > 0 ? existingCount / sampleContacts.length : 0;
      const alreadyInCRM = Math.round(estimatedImportCount * duplicateRate);
      const newContacts = Math.max(0, estimatedImportCount - alreadyInCRM);
      const estimatedDuration = formatEstimatedDuration(estimatedImportCount);

      return new Response(
        JSON.stringify({
          listInfo: previewListInfo,
          selectedSegments,
          sampleContacts,
          estimatedImportCount,
          estimatedDuration,
          alreadyInCRM,
          newContacts,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } catch (error) {
      console.error("Preview error:", error);
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : "Unknown error",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
  });
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
