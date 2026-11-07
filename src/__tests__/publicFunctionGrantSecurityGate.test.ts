import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20261107010156_harden_public_function_execute_grants.sql",
  ),
  "utf8",
).toLowerCase();

const expectServiceRoleOnly = (signature: string) => {
  expect(migration).toContain(
    `revoke execute on function ${signature}\n  from public, anon, authenticated;`,
  );
  expect(migration).toContain(
    `grant execute on function ${signature}\n  to service_role;`,
  );
};

describe("public function grant security gate", () => {
  it("keeps privileged trigger and consent functions off public API roles", () => {
    expectServiceRoleOnly("public.apply_pos_checkout_sms_consent()");
    expectServiceRoleOnly(
      "public.configure_pos_sms_checkout_policy(uuid, uuid, text)",
    );
    expectServiceRoleOnly("public.crm_customers_identity_generation_row()");
    expectServiceRoleOnly("public.crm_customers_identity_generation_stmt()");
    expectServiceRoleOnly(
      "public.customer_intelligence_events_generation_trigger()",
    );
  });

  it("keeps Bloom RLS helpers available only to signed-in and service roles", () => {
    for (const signature of [
      "public.bloom_can_access_tenant(uuid)",
      "public.bloom_can_access_tenant_folder(text)",
    ]) {
      expect(migration).toContain(
        `revoke execute on function ${signature}\n  from public, anon;`,
      );
      expect(migration).toContain(
        `grant execute on function ${signature}\n  to authenticated, service_role;`,
      );
    }
  });
});
