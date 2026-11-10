import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd());
const migration = readFileSync(
  resolve(
    root,
    "supabase/migrations/20260903130447_restrict_users_and_tenants.sql",
  ),
  "utf8",
);
const onboarding = readFileSync(
  resolve(root, "src/components/onboarding/CompanyProfileCreator.ts"),
  "utf8",
);

describe("user and tenant isolation release gate", () => {
  it("removes anonymous table access and the allow-all user policy", () => {
    expect(migration).toContain(
      'DROP POLICY IF EXISTS "Allow all operations on users" ON public.users;',
    );
    expect(migration).toContain(
      "REVOKE ALL ON TABLE public.users FROM anon, authenticated;",
    );
    expect(migration).toContain(
      "REVOKE ALL ON TABLE public.tenants FROM anon, authenticated;",
    );
    expect(migration).not.toMatch(/CREATE POLICY[\s\S]{0,160}USING \(true\)/i);
  });

  it("limits user records to the principal or a guarded master admin", () => {
    expect(migration).toContain('CREATE POLICY "Users can view their own record"');
    expect(migration).toContain("id = (SELECT auth.uid())");
    expect(migration).toContain(
      "public.is_master_admin((SELECT auth.uid()))",
    );
    expect(migration).toContain("GRANT SELECT ON TABLE public.users TO authenticated;");
    expect(migration).not.toMatch(
      /GRANT (?:INSERT|UPDATE|DELETE|ALL).*public\.users TO authenticated/i,
    );
  });

  it("makes tenant creation atomic and authenticated-only", () => {
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION public.create_current_user_tenant(p_name text)",
    );
    expect(migration).toContain("v_user_id uuid := auth.uid();");
    expect(migration).toContain("FROM auth.users AS auth_user");
    expect(migration).toContain("FOR UPDATE;");
    expect(migration).toContain("SET search_path = ''");
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION public.create_current_user_tenant(text)\nTO authenticated, service_role;",
    );
  });

  it("routes onboarding through the guarded RPC", () => {
    expect(onboarding).toContain('.rpc("create_current_user_tenant"');
    expect(onboarding).not.toContain('.from("tenants")\n          .insert(');
    expect(onboarding).not.toContain('supabase.from("users").upsert(');
  });
});
