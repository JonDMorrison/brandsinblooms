import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization")!;
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { data: userRecord } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    const tenantId = userRecord?.tenant_id;
    if (!tenantId) throw new Error("Tenant not found");

    // Get connection
    const { data: connection } = await supabase
      .from("provider_connections")
      .select("*")
      .eq("user_id", user.id)
      .eq("provider", "klaviyo")
      .eq("status", "connected")
      .single();

    if (!connection) {
      throw new Error("Klaviyo not connected");
    }

    const baseUrl = "https://a.klaviyo.com/api";
    const headers = {
      Authorization: `Klaviyo-OAuth ${connection.access_token}`,
      revision: "2024-10-15",
      Accept: "application/json",
    };

    // Fetch lists
    const listsRes = await fetch(`${baseUrl}/lists/`, {
      headers,
    });
    const listsData = await listsRes.json();

    // Fetch segments
    const segmentsRes = await fetch(`${baseUrl}/segments/`, {
      headers,
    });
    const segmentsData = await segmentsRes.json();

    // Format for UI
    const listsWithSegments = (listsData.data || []).map((list: any) => ({
      id: list.id,
      name: list.attributes.name,
      member_count: list.attributes.profile_count || 0,
      segments: [],
    }));

    // Add segments as a separate "list" for selection
    if (segmentsData.data && segmentsData.data.length > 0) {
      listsWithSegments.push({
        id: "segments",
        name: "Klaviyo Segments",
        member_count: 0,
        segments: segmentsData.data.map((seg: any) => ({
          id: seg.id,
          name: seg.attributes.name,
          member_count: seg.attributes.profile_count || 0,
          type: "segment",
        })),
      });
    }

    const { data: existingCacheJob } = await supabase
      .from("import_jobs")
      .select("id, config")
      .eq("tenant_id", tenantId)
      .eq("user_id", user.id)
      .eq("provider", "klaviyo")
      .order("created_at", { ascending: false })
      .limit(20);

    const cacheJobId = existingCacheJob?.find(
      (job: any) => job?.config?.artifact_cache === true,
    )?.id;
    let importJobId = cacheJobId;

    if (!importJobId) {
      const hiddenTimestamp = new Date(0).toISOString();
      const { data: insertedCacheJob } = await supabase
        .from("import_jobs")
        .insert({
          tenant_id: tenantId,
          user_id: user.id,
          provider: "klaviyo",
          status: "completed",
          config: {
            artifact_cache: true,
            hidden: true,
            generated_by: "klaviyo-fetch-lists",
          },
          report: null,
          completed_at: hiddenTimestamp,
          created_at: hiddenTimestamp,
          updated_at: hiddenTimestamp,
        })
        .select("id")
        .single();

      importJobId = insertedCacheJob?.id;
    }

    if (importJobId) {
      const artifactRows = [
        ...(listsData.data || []).map((list: any) => ({
          import_job_id: importJobId,
          tenant_id: tenantId,
          provider: "klaviyo",
          artifact_type: "list",
          external_id: list.id,
          name: list.attributes.name,
          member_count: list.attributes.profile_count || 0,
          data: list,
        })),
        ...(segmentsData.data || []).map((segment: any) => ({
          import_job_id: importJobId,
          tenant_id: tenantId,
          provider: "klaviyo",
          artifact_type: "segment",
          external_id: segment.id,
          name: segment.attributes.name,
          member_count: segment.attributes.profile_count || 0,
          data: segment,
        })),
      ];

      if (artifactRows.length > 0) {
        await supabase.from("provider_artifacts").upsert(artifactRows, {
          onConflict: "tenant_id,provider,artifact_type,external_id",
        });
      }
    }

    console.log(
      `[klaviyo-fetch-lists] Fetched ${listsWithSegments.length} lists`,
    );

    return new Response(
      JSON.stringify({
        lists: listsWithSegments,
        totalLists: (listsData.data || []).length,
        totalSegments: (segmentsData.data || []).length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[klaviyo-fetch-lists] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
