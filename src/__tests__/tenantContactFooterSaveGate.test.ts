import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// SQL cannot run in this suite; these checks pin the security-relevant shape
// of public.save_tenant_contact_footer so a later edit cannot quietly widen it.
const migration = readFileSync(
  "supabase/migrations/20261127170000_save_tenant_contact_footer.sql",
  "utf8",
);
const body = migration.slice(
  migration.indexOf("AS $function$"),
  migration.lastIndexOf("$function$;"),
);

const EDITED_COLUMNS = [
  "company_phone",
  "company_email",
  "website_url",
  "street_address",
  "city",
  "state_province",
  "postal_code",
  "country",
  "facebook_url",
  "instagram_url",
  "tiktok_url",
  "pinterest_url",
  "youtube_url",
  "linkedin_url",
  "footer_legal_text",
];

describe("save_tenant_contact_footer", () => {
  it("is SECURITY DEFINER with an empty search_path", () => {
    expect(migration).toContain("VOLATILE SECURITY DEFINER");
    expect(migration).toContain("SET search_path TO ''");
  });

  it("refuses anonymous callers and is granted to authenticated only", () => {
    expect(body).toContain("IF v_user_id IS NULL THEN");
    expect(migration).toMatch(
      /REVOKE EXECUTE ON FUNCTION public\.save_tenant_contact_footer\([^)]*\) FROM PUBLIC, anon;/,
    );
    expect(migration).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.save_tenant_contact_footer\([^)]*\) TO authenticated, service_role;/,
    );
  });

  it("lets a master admin write only the tenant they are actively working in", () => {
    expect(body).toContain(
      "coalesce(public.is_master_admin(v_user_id), false)\n        AND coalesce(public.has_tenant_permission(p_tenant_id, 'content.design'), false)",
    );
  });

  it("holds members to the same rule as the company_profiles UPDATE policies", () => {
    expect(body).toContain("v_target_user_id := coalesce(public.current_profile_user_id(), v_user_id);");
    expect(body).toContain(
      "IF v_target_user_id IS DISTINCT FROM v_user_id\n       AND NOT coalesce(public.current_user_can_edit_business_profile(), false) THEN",
    );
  });

  it("refuses everyone else", () => {
    const elseBranch = body.slice(body.lastIndexOf("  ELSE\n"), body.indexOf("END IF;\n\n  INSERT"));
    expect(elseBranch).toContain("RAISE EXCEPTION");
    expect(elseBranch).toContain("ERRCODE = '42501'");
  });

  it("resolves the admin's target row with tenant_profile_user_id's ordering", () => {
    expect(body).toContain(
      "ORDER BY (member.role IN ('owner', 'admin')) DESC,\n             profile.created_at ASC,\n             profile.user_id ASC",
    );
  });

  it("writes only the contact/footer columns the page edits", () => {
    const insertColumns = body
      .slice(body.indexOf("INSERT INTO public.company_profiles AS profile ("), body.indexOf("VALUES ("))
      .match(/^\s{4}([a-z_]+),?$/gm)
      ?.map((line) => line.trim().replace(/,$/, ""));
    expect(insertColumns).toEqual(["user_id", ...EDITED_COLUMNS]);

    const setClause = body.slice(body.indexOf("ON CONFLICT (user_id) DO UPDATE"), body.indexOf("RETURNING"));
    const updatedColumns = [...setClause.matchAll(/([a-z_]+) = (?:EXCLUDED\.\1|now\(\))/g)].map((m) => m[1]);
    expect(updatedColumns).toEqual([...EDITED_COLUMNS, "updated_at"]);
    expect(setClause).not.toContain("user_id =");
    expect(setClause).not.toContain("onboarding_completed_at");
  });

  it("does not change company_profiles RLS", () => {
    expect(migration).not.toMatch(/CREATE POLICY|ALTER POLICY|DROP POLICY|DISABLE ROW LEVEL SECURITY/);
  });
});
