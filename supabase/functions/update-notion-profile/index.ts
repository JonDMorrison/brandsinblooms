import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * update-notion-profile
 *
 * Called by Supabase database webhooks when onboarding-related tables change.
 * Looks up the matching Notion CRM record by tenant_id and patches relevant fields.
 *
 * Supported trigger tables:
 *   company_profiles, square_connections, clover_connections,
 *   lightspeed_connections, crm_customers, email_domains
 */

const NOTION_API_VERSION = "2022-06-28";
const NOTION_DATABASE_ID = "344d234a0ae54f4185e19d260ac658a9";

// Canadian province mapping — normalize common variants to abbreviations
const PROVINCE_MAP: Record<string, string> = {
  "british columbia": "BC", bc: "BC",
  alberta: "AB", ab: "AB",
  saskatchewan: "SK", sk: "SK",
  manitoba: "MB", mb: "MB",
  ontario: "ON", on: "ON",
  quebec: "QC", qc: "QC", québec: "QC",
  "nova scotia": "NS", ns: "NS",
  "new brunswick": "NB", nb: "NB",
  "prince edward island": "PE", pe: "PE", pei: "PE",
  "newfoundland and labrador": "NL", nl: "NL", newfoundland: "NL",
  "northwest territories": "NT", nt: "NT",
  nunavut: "NU", nu: "NU",
  yukon: "YT", yt: "YT",
};

function normalizeProvince(raw: string | null | undefined): string {
  if (!raw) return "Other";
  const key = raw.trim().toLowerCase();
  return PROVINCE_MAP[key] ?? "Other";
}

interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  record: Record<string, unknown>;
  old_record?: Record<string, unknown>;
}

// ── Notion helpers ──────────────────────────────────────────────────

async function notionQuery(
  notionKey: string,
  tenantId: string,
): Promise<string | null> {
  const res = await fetch(
    `https://api.notion.com/v1/databases/${NOTION_DATABASE_ID}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${notionKey}`,
        "Notion-Version": NOTION_API_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filter: {
          property: "Supabase Tenant ID",
          rich_text: { equals: tenantId },
        },
      }),
    },
  );

  if (!res.ok) {
    const body = await res.text();
    console.error(`update-notion-profile: Notion query failed ${res.status}`, body);
    return null;
  }

  const data = await res.json();
  if (!data.results?.length) {
    console.warn(`update-notion-profile: no Notion page found for tenant ${tenantId}`);
    return null;
  }

  return data.results[0].id as string;
}

async function notionPatch(
  notionKey: string,
  pageId: string,
  properties: Record<string, unknown>,
): Promise<boolean> {
  const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${notionKey}`,
      "Notion-Version": NOTION_API_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ properties }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`update-notion-profile: Notion patch failed ${res.status}`, body);
    return false;
  }

  return true;
}

// ── Tenant ID resolution ────────────────────────────────────────────

async function resolveTenantId(
  record: Record<string, unknown>,
  table: string,
): Promise<string | null> {
  // Most tables have tenant_id directly
  if (record.tenant_id && typeof record.tenant_id === "string") {
    return record.tenant_id;
  }

  // company_profiles only has user_id — look up tenant_id via users table
  if (table === "company_profiles" && record.user_id) {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      console.error("update-notion-profile: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set");
      return null;
    }

    const sb = createClient(supabaseUrl, serviceKey);
    const { data, error } = await sb
      .from("users")
      .select("tenant_id")
      .eq("id", record.user_id)
      .maybeSingle();

    if (error || !data?.tenant_id) {
      console.error("update-notion-profile: failed to resolve tenant_id from user_id", error);
      return null;
    }

    return data.tenant_id;
  }

  return null;
}

// ── Property builders per table ─────────────────────────────────────

function buildCompanyProfileProps(
  record: Record<string, unknown>,
): Record<string, unknown> {
  const props: Record<string, unknown> = {};

  if (record.company_name) {
    props["Garden Center"] = {
      title: [{ text: { content: String(record.company_name) } }],
    };
  }

  if (record.city) {
    props["City"] = {
      rich_text: [{ text: { content: String(record.city) } }],
    };
  }

  props["Province"] = {
    select: { name: normalizeProvince(record.state_province as string) },
  };

  if (record.website_url) {
    props["Website"] = { url: String(record.website_url) };
  }

  if (record.company_phone) {
    props["Phone"] = {
      phone_number: String(record.company_phone),
    };
  }

  // Onboarding: Brand Setup — true if primary color is set
  props["Onboarding: Brand Setup"] = {
    checkbox: !!record.brand_primary_color,
  };

  // Onboarding: Profile Complete — true if both company_name and company_overview exist
  props["Onboarding: Profile Complete"] = {
    checkbox: !!(record.company_name && record.company_overview),
  };

  // Onboarding Completed timestamp
  if (record.onboarding_completed_at) {
    props["Onboarding Completed"] = {
      date: { start: String(record.onboarding_completed_at).substring(0, 10) },
    };
  }

  return props;
}

function buildPosProps(
  posSystem: "Square" | "Clover" | "Lightspeed",
): Record<string, unknown> {
  return {
    "POS Integrated": { checkbox: true },
    "POS System": { select: { name: posSystem } },
    "Onboarding: POS Connected": { checkbox: true },
  };
}

function buildCrmCustomerProps(): Record<string, unknown> {
  return {
    "Onboarding: Clients Imported": { checkbox: true },
  };
}

function buildEmailDomainProps(
  record: Record<string, unknown>,
): Record<string, unknown> {
  const status = String(record.status ?? "").toLowerCase();
  const verified = ["verified", "warming", "warming_up", "active"].includes(status);
  return {
    "Onboarding: Email Domain": { checkbox: verified },
  };
}

// ── Main handler ────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload: WebhookPayload = await req.json();
    const { table, record } = payload;

    if (!table || !record) {
      console.error("update-notion-profile: missing table or record in payload", payload);
      return new Response(
        JSON.stringify({ error: "Missing table or record" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const notionKey = Deno.env.get("NOTION_API_KEY");
    if (!notionKey) {
      console.error("update-notion-profile: NOTION_API_KEY not set");
      return new Response(
        JSON.stringify({ error: "Notion API key not configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Resolve tenant_id (direct on most tables, via users join for company_profiles)
    const tenantId = await resolveTenantId(record, table);
    if (!tenantId) {
      console.error("update-notion-profile: could not resolve tenant_id", { table, record });
      return new Response(
        JSON.stringify({ error: "Could not resolve tenant_id" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Find the matching Notion page
    const pageId = await notionQuery(notionKey, tenantId);
    if (!pageId) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "No Notion page for tenant" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Build the property update based on which table triggered
    let properties: Record<string, unknown> | null = null;

    switch (table) {
      case "company_profiles":
        properties = buildCompanyProfileProps(record);
        break;
      case "square_connections":
        properties = buildPosProps("Square");
        break;
      case "clover_connections":
        properties = buildPosProps("Clover");
        break;
      case "lightspeed_connections":
        properties = buildPosProps("Lightspeed");
        break;
      case "crm_customers":
        properties = buildCrmCustomerProps();
        break;
      case "email_domains":
        properties = buildEmailDomainProps(record);
        break;
      default:
        console.warn(`update-notion-profile: unhandled table "${table}"`);
        return new Response(
          JSON.stringify({ skipped: true, reason: `Unhandled table: ${table}` }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }

    const ok = await notionPatch(notionKey, pageId, properties);

    console.log(`update-notion-profile: ${table} → tenant ${tenantId} → page ${pageId} → ${ok ? "ok" : "failed"}`);

    return new Response(
      JSON.stringify({ success: ok, notion_page_id: pageId, table }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("update-notion-profile: unexpected error", err);
    return new Response(
      JSON.stringify({ error: "Internal error", message: String(err) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
