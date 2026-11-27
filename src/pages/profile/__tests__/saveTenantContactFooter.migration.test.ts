import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(__dirname, "../../../../supabase/migrations/20261127170000_save_tenant_contact_footer.sql"),
  "utf8",
);
const body = sql.slice(sql.indexOf("AS $function$"), sql.indexOf("$function$;"));

describe("save_tenant_contact_footer migration", () => {
  it("is a SECURITY DEFINER function with an empty search_path, not granted to anon", () => {
    expect(sql).toMatch(/SECURITY DEFINER\s+SET search_path TO ''/);
    expect(sql).toContain(
      "REVOKE EXECUTE ON FUNCTION public.save_tenant_contact_footer(uuid, jsonb) FROM PUBLIC, anon;",
    );
    expect(sql).toContain(
      "GRANT EXECUTE ON FUNCTION public.save_tenant_contact_footer(uuid, jsonb) TO authenticated, service_role;",
    );
  });

  it("does not widen company_profiles RLS", () => {
    expect(sql).not.toMatch(/CREATE POLICY|ALTER POLICY|DISABLE ROW LEVEL SECURITY/i);
  });

  it("lets a master admin write only the tenant they are actively working in", () => {
    expect(body).toMatch(
      /IF v_is_admin THEN\s+v_authorized := coalesce\(public\.admin_active_tenant_id\(\) = p_tenant_id, false\);/,
    );
  });

  it("requires a member to belong to the target tenant and hold content.design", () => {
    expect(body).toMatch(
      /WHERE app_user\.id = v_user_id\s+AND app_user\.tenant_id = p_tenant_id\s+\)\s+AND coalesce\(public\.has_tenant_permission\(p_tenant_id, 'content\.design'\), false\);/,
    );
    expect(body).toMatch(/IF NOT v_authorized THEN\s+RAISE EXCEPTION[^;]+USING ERRCODE = '42501';/);
  });

  it("checks authorization before resolving or writing any profile", () => {
    const authCheck = body.indexOf("IF NOT v_authorized THEN");
    expect(authCheck).toBeGreaterThan(-1);
    expect(body.indexOf("INSERT INTO public.company_profiles")).toBeGreaterThan(authCheck);
    expect(body.indexOf("UPDATE public.company_profiles")).toBeGreaterThan(authCheck);
  });

  it("rejects keys outside the contact/footer allowlist and writes only allowlisted columns", () => {
    expect(body).toMatch(/IF NOT \(v_key = ANY \(v_allowed\)\) THEN\s+RAISE EXCEPTION/);
    const setClause = body.slice(body.indexOf("UPDATE public.company_profiles"), body.indexOf("WHERE profile.user_id"));
    const written = [...setClause.matchAll(/^\s{4}(\w+) =/gm)].map((match) => match[1]);
    expect(written.sort()).toEqual(
      [
        "company_phone", "company_email", "website_url", "street_address", "city",
        "state_province", "postal_code", "country", "facebook_url", "instagram_url",
        "tiktok_url", "pinterest_url", "youtube_url", "linkedin_url", "footer_legal_text",
        "updated_at",
      ].sort(),
    );
  });

  it("writes the same profile tenant_profile_user_id reads", () => {
    expect(body).toMatch(
      /WHERE member\.tenant_id = p_tenant_id\s+ORDER BY \(member\.role IN \('owner', 'admin'\)\) DESC,\s+profile\.created_at ASC,\s+profile\.user_id ASC\s+LIMIT 1;/,
    );
  });
});
