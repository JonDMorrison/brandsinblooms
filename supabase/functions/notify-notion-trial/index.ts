import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * notify-notion-trial
 *
 * Called by a Supabase database webhook (pg_net) after a new user signs up.
 * Creates a row in the Notion CRM pipeline database so Jon can follow up.
 */

const NOTION_API_VERSION = "2022-06-28";
const NOTION_DATABASE_ID = "344d234a0ae54f4185e19d260ac658a9";

interface UserPayload {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
  tenant_id?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = await req.json();

    // Support both direct POST and Supabase webhook format (record nested under .record)
    const user: UserPayload = payload.record ?? payload;

    if (!user.email) {
      console.error("notify-notion-trial: missing email in payload", payload);
      return new Response(
        JSON.stringify({ error: "Missing email in payload" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const notionKey = Deno.env.get("NOTION_API_KEY");
    if (!notionKey) {
      console.error("notify-notion-trial: NOTION_API_KEY not set");
      return new Response(
        JSON.stringify({ error: "Notion API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract date-only portion of created_at (Notion date property expects YYYY-MM-DD)
    const trialStartDate = user.created_at
      ? user.created_at.substring(0, 10)
      : new Date().toISOString().substring(0, 10);

    const gardenCenterName = user.name && user.name !== user.email
      ? user.name
      : user.email;

    // Resolve tenant_id so update-notion-profile can match this record later
    let tenantId = user.tenant_id || "";
    if (!tenantId && user.id) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (supabaseUrl && serviceKey) {
          const sb = createClient(supabaseUrl, serviceKey);
          const { data } = await sb
            .from("users")
            .select("tenant_id")
            .eq("id", user.id)
            .maybeSingle();
          tenantId = data?.tenant_id ?? "";
        }
      } catch (e) {
        console.warn("notify-notion-trial: could not resolve tenant_id", e);
      }
    }

    const notionBody = {
      parent: { database_id: NOTION_DATABASE_ID },
      properties: {
        "Garden Center": {
          title: [{ text: { content: gardenCenterName } }],
        },
        "Email": {
          email: user.email,
        },
        "Primary Contact": {
          rich_text: [{ text: { content: user.name || "" } }],
        },
        "Stage": {
          select: { name: "Trial" },
        },
        "Trial Start Date": {
          date: { start: trialStartDate },
        },
        "Next Action": {
          rich_text: [
            { text: { content: "Trial started — follow up within 48 hours" } },
          ],
        },
        "Assigned To": {
          select: { name: "Jon" },
        },
        ...(tenantId
          ? {
              "Supabase Tenant ID": {
                rich_text: [{ text: { content: tenantId } }],
              },
            }
          : {}),
      },
    };

    const notionRes = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${notionKey}`,
        "Notion-Version": NOTION_API_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(notionBody),
    });

    if (!notionRes.ok) {
      const errorBody = await notionRes.text();
      console.error(
        `notify-notion-trial: Notion API error ${notionRes.status}`,
        errorBody
      );
      return new Response(
        JSON.stringify({ error: "Notion API error", status: notionRes.status, detail: errorBody }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const notionPage = await notionRes.json();
    console.log("notify-notion-trial: created Notion page", notionPage.id);

    return new Response(
      JSON.stringify({ success: true, notion_page_id: notionPage.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("notify-notion-trial: unexpected error", err);
    return new Response(
      JSON.stringify({ error: "Internal error", message: String(err) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
