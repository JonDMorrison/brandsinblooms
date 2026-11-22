import { createClient } from "npm:@supabase/supabase-js@2.117.2";
import { verifyGrowthBridge } from "../_shared/growthBridge.ts";

const headers = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers });
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return reply({ error: "method_not_allowed" }, 405);
  try {
    const raw = await req.text();
    if (raw.length > 4096) return reply({ error: "payload_too_large" }, 413);
    if (
      await verifyGrowthBridge(
        req,
        raw,
        "growth-signup-stats",
        Deno.env.get("BLOOMSITES_GROWTH_BRIDGE_SECRET"),
      ) !== "valid"
    ) return reply({ error: "unauthorized" }, 401);
    const { siteId, embedKey } = JSON.parse(raw);
    if (
      typeof siteId !== "string" || !uuid.test(siteId) ||
      typeof embedKey !== "string" || !/^[a-f0-9]{32}$/i.test(embedKey)
    ) return reply({ error: "invalid_request" }, 400);
    const asOf = new Date().toISOString();
    const service = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data: form, error: formError } = await service.from("forms").select(
      "id,tenant_id,name,status",
    )
      .eq("embed_key", embedKey.toLowerCase()).maybeSingle();
    if (formError) throw formError;
    if (!form || form.status !== "published") {
      return reply({ connection: { status: "form_unavailable" }, asOf });
    }
    const { data: link, error: linkError } = await service.from(
      "crm_connected_websites",
    ).select("id")
      .eq("cms_site_id", siteId).eq("tenant_id", form.tenant_id).eq(
        "status",
        "active",
      ).maybeSingle();
    if (linkError) throw linkError;
    if (!link) {
      return reply({ connection: { status: "site_not_connected" }, asOf });
    }
    // Exact aggregate counts: no contact information leaves CRM, and no row-limit truncation.
    const countQuery = () =>
      service.from("form_submissions").select("id", {
        count: "exact",
        head: true,
      })
        .eq("tenant_id", form.tenant_id).eq("form_id", form.id).eq(
          "result",
          "accepted",
        )
        .eq("metadata->>site_id", siteId).eq("metadata->>source", "bloomsites")
        .lte("submitted_at", asOf);
    const placements = ["footer", "popup", "checkout", "event"] as const;
    const since = (days: number) =>
      new Date(Date.parse(asOf) - days * 86400000).toISOString();
    const counts = await Promise.all([
      countQuery(),
      countQuery().gte("submitted_at", since(7)),
      countQuery().gte("submitted_at", since(30)),
      ...placements.map((p) => countQuery().eq("metadata->>placement", p)),
    ]);
    if (counts.some((r) => r.error || r.count === null)) {
      throw new Error("count_failed");
    }
    const { data: last, error: lastError } = await service.from(
      "form_submissions",
    ).select("submitted_at")
      .eq("tenant_id", form.tenant_id).eq("form_id", form.id).eq(
        "result",
        "accepted",
      )
      .eq("metadata->>site_id", siteId).eq("metadata->>source", "bloomsites")
      .lte("submitted_at", asOf).order("submitted_at", { ascending: false })
      .limit(1).maybeSingle();
    if (lastError) throw lastError;
    return reply({
      connection: { status: "ready", formName: form.name },
      stats: {
        acceptedTotal: counts[0].count,
        last7Days: counts[1].count,
        last30Days: counts[2].count,
        placements: Object.fromEntries(
          placements.map((p, i) => [p, counts[i + 3].count]),
        ),
        lastSignupAt: last?.submitted_at ?? null,
      },
      asOf,
    });
  } catch {
    return reply({
      connection: { status: "unavailable" },
      asOf: new Date().toISOString(),
    }, 503);
  }
}
if (import.meta.main) Deno.serve(handler);
