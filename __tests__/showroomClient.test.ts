import { beforeEach, describe, expect, it } from "vitest";
import { supabase, resetShowroomDatabase } from "../showroom/fake/client";
import { isDemoAllowedUrl } from "../showroom/networkGuard";

describe("CRM showroom in-memory client", () => {
  beforeEach(() => { sessionStorage.clear(); resetShowroomDatabase(); });

  it("serves synthetic customers with PostgREST-style filters, counts and ranges", async () => {
    const { data, count } = await supabase.from("crm_customers").select("id, first_name, email", { count: "exact" }).ilike("first_name", "sarah%").order("first_name").range(0, 4);
    expect(count).toBeGreaterThan(0);
    expect((data as { first_name: string }[]).every(row => row.first_name.toLowerCase().startsWith("sarah"))).toBe(true);
    const sarah = await supabase.from("crm_customers").select("*").or("email.eq.sarah@bloom.example,email.eq.nobody@example.com").single();
    expect((sarah.data as { last_name: string }).last_name).toBe("Bloom");
    const all = await supabase.from("crm_customers").select("*", { count: "exact", head: true });
    expect(all.count).toBe(1200);
    expect(all.data).toBeNull();
  });

  it("keeps a visitor's edits in this tab and forgets them on reset", async () => {
    await supabase.from("crm_segments").insert({ name: "My workshop fans", tenant_id: "t" });
    expect((await supabase.from("crm_segments").select("*").eq("name", "My workshop fans")).data).toHaveLength(1);
    resetShowroomDatabase();
    expect((await supabase.from("crm_segments").select("*").eq("name", "My workshop fans")).data).toHaveLength(1);
    sessionStorage.clear(); resetShowroomDatabase();
    expect((await supabase.from("crm_segments").select("*").eq("name", "My workshop fans")).data).toHaveLength(0);
  });

  it("never sends, publishes, uploads or calls AI", async () => {
    for (const name of ["send-email-campaign", "send-test-email", "care-guide-test-send", "generate-ai-image", "regenerate-crm-content"]) {
      const result = await supabase.functions.invoke(name, { body: {} });
      expect(result.error).not.toBeNull();
      expect(result.data).toBeNull();
    }
    expect((await supabase.rpc("claim_campaign_for_send", {})).error).not.toBeNull();
    expect((await supabase.rpc("publish_care_guide_design", {})).error).not.toBeNull();
    expect((await supabase.storage.from("assets").upload("x.png", new Blob())).error).not.toBeNull();
  });

  it("gives the dashboard internally consistent metrics", async () => {
    const { data } = await supabase.rpc("get_crm_dashboard_snapshot", {});
    const snapshot = (data as Record<string, number>[])[0];
    expect(snapshot.total_customers).toBe(1200);
    expect(snapshot.avg_open_rate).toBeGreaterThan(0);
    const access = (await supabase.rpc("get_current_crm_access", {})).data as { role: string };
    expect(access.role).toBe("owner_admin");
  });

  it("blocks every request that would leave the demo site", () => {
    const origin = "https://demo.bloomsuite.app";
    expect(isDemoAllowedUrl("/crm/assets/app.js", origin)).toBe(true);
    expect(isDemoAllowedUrl("https://udldmkqwnxhdeztyqcau.supabase.co/rest/v1/crm_customers", origin)).toBe(false);
  });
});
