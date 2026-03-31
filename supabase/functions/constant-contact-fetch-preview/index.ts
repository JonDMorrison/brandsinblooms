import { createClient } from "npm:@supabase/supabase-js@2";
import {
  decryptToken,
  assertEncryptionKeyConfigured,
} from "../_shared/crypto/tokens.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Fail fast if encryption key is not configured
if (import.meta.main) {
  try {
    assertEncryptionKeyConfigured();
  } catch (error: any) {
    console.error("[constant-contact-fetch-preview] FATAL:", error.message);
  }
}

if (import.meta.main) {
  Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const authHeader = req.headers.get("Authorization");

      if (!authHeader) {
        throw new Error("Missing Authorization header");
      }

      const { jobId } = await req.json();
      if (!jobId || typeof jobId !== "string") {
        throw new Error("jobId is required");
      }

      // Create client for auth verification
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

      if (authError || !user) {
        throw new Error("User not authenticated");
      }

      const { data: job } = await supabase
        .from("import_jobs")
        .select("config")
        .eq("id", jobId)
        .eq("user_id", user.id)
        .single();

      if (!job) {
        throw new Error("Job not found");
      }

      const config =
        job.config &&
        typeof job.config === "object" &&
        !Array.isArray(job.config)
          ? (job.config as { listIds?: unknown })
          : {};
      const listIds = Array.isArray(config.listIds)
        ? config.listIds.filter(
            (value): value is string => typeof value === "string",
          )
        : [];

      if (listIds.length === 0) {
        throw new Error("No Constant Contact lists selected for preview");
      }

      const { data: userRecord } = await supabase
        .from("users")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      const tenantId = userRecord?.tenant_id;
      if (!tenantId) {
        throw new Error("Tenant not found");
      }

      // Get connection
      const { data: connection, error: connectionError } = await supabase
        .from("provider_connections")
        .select("encrypted_access_token")
        .eq("tenant_id", tenantId)
        .eq("user_id", user.id)
        .eq("provider", "constant_contact")
        .eq("status", "connected")
        .single();

      if (connectionError || !connection?.encrypted_access_token) {
        throw new Error("Constant Contact not connected");
      }

      let accessToken: string;
      try {
        accessToken = await decryptToken(connection.encrypted_access_token);
      } catch (error: any) {
        throw new Error(
          "Failed to decrypt access token. Please reconnect Constant Contact.",
        );
      }

      const previewContacts: Array<{
        email: string;
        firstName: string | null;
        lastName: string | null;
        status: string;
        tags: string[];
      }> = [];

      let previewListInfo: {
        id: string;
        name: string;
        totalMembers: number;
      } | null = null;
      let estimatedImportCount = 0;

      for (const listId of listIds) {
        const listRes = await fetch(
          `https://api.cc.email/v3/contact_lists/${listId}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: "application/json",
            },
          },
        );

        if (!listRes.ok) {
          continue;
        }

        const listData = await listRes.json();
        const memberCount = Number(listData.membership_count || 0);
        estimatedImportCount += memberCount;

        if (!previewListInfo) {
          previewListInfo = {
            id: listId,
            name: listData.name || "Unnamed List",
            totalMembers: memberCount,
          };
        }

        if (previewContacts.length >= 10) {
          continue;
        }

        const contactsRes = await fetch(
          `https://api.cc.email/v3/contacts?lists=${listId}&limit=10&include=list_memberships`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: "application/json",
            },
          },
        );

        if (contactsRes.ok) {
          const contactsData = await contactsRes.json();
          for (const contact of contactsData.contacts || []) {
            if (previewContacts.length >= 10) break;
            previewContacts.push({
              email: contact.email_address?.address || "",
              firstName: contact.first_name || null,
              lastName: contact.last_name || null,
              status:
                contact.permission_to_send === "implicit" ||
                contact.permission_to_send === "explicit"
                  ? "subscribed"
                  : "unsubscribed",
              tags: [],
            });
          }
        }
      }

      if (!previewListInfo) {
        throw new Error("Unable to load Constant Contact preview lists");
      }

      const sampleEmails = previewContacts
        .map((contact) => contact.email.toLowerCase())
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
        previewContacts.length > 0 ? existingCount / previewContacts.length : 0;
      const alreadyInCRM = Math.round(estimatedImportCount * duplicateRate);
      const newContacts = Math.max(0, estimatedImportCount - alreadyInCRM);

      console.log(
        `[constant-contact-fetch-preview] Fetched ${previewContacts.length} preview contacts`,
      );

      return new Response(
        JSON.stringify({
          listInfo: previewListInfo,
          selectedSegments: [],
          sampleContacts: previewContacts,
          estimatedImportCount,
          estimatedDuration: formatEstimatedDuration(estimatedImportCount),
          alreadyInCRM,
          newContacts,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } catch (error: any) {
      console.error("[constant-contact-fetch-preview] Error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
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
