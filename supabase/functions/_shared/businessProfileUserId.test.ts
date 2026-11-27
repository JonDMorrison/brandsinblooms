import { assertEquals } from "@std/assert";
import {
  resolveCampaignBusinessProfileUserId,
  type TenantProfileClient,
} from "./businessProfileUserId.ts";

type Row = Record<string, unknown>;

function fakeClient(tables: Record<string, Row[]>, profileFor: Record<string, string> = {}) {
  const calls: string[] = [];
  const client: TenantProfileClient = {
    rpc(fn: string, args?: Record<string, unknown>) {
      calls.push(`rpc:${fn}`);
      const id = String(args?.p_user_id ?? "");
      return Promise.resolve({ data: profileFor[id] ?? id, error: null });
    },
    from(table: string) {
      return {
        select() {
          let rows = [...(tables[table] ?? [])];
          const builder = {
            eq(column: string, value: string) {
              rows = rows.filter((row) => row[column] === value);
              return builder;
            },
            in(column: string, values: string[]) {
              rows = rows.filter((row) => values.includes(String(row[column])));
              return builder;
            },
            then(resolve: (value: { data: Row[]; error: null }) => unknown) {
              calls.push(`from:${table}`);
              return Promise.resolve(resolve({ data: rows, error: null }));
            },
          };
          return builder;
        },
      };
    },
  };
  return { client, calls };
}

const TENANT = "11111111-1111-4111-8111-111111111111";

Deno.test("an admin outside the tenant gets the tenant owner's profile, not their own", async () => {
  const { client } = fakeClient({
    users: [
      { id: "owner", tenant_id: TENANT, role: "owner", created_at: "2026-01-02" },
      { id: "staff", tenant_id: TENANT, role: "member", created_at: "2026-01-01" },
      { id: "admin", tenant_id: "other", role: "owner", created_at: "2025-01-01" },
    ],
    company_profiles: [
      { user_id: "staff", created_at: "2026-01-01" },
      { user_id: "owner", created_at: "2026-02-01" },
      { user_id: "admin", created_at: "2025-01-01" },
    ],
  });
  assertEquals(await resolveCampaignBusinessProfileUserId(client, { tenantId: TENANT, userId: "admin" }), "owner");
});

Deno.test("a creator who belongs to the tenant keeps profile_user_id_for", async () => {
  const { client, calls } = fakeClient(
    { users: [{ id: "staff", tenant_id: TENANT, role: "member", created_at: "2026-01-01" }], company_profiles: [] },
    { staff: "owner" },
  );
  assertEquals(await resolveCampaignBusinessProfileUserId(client, { tenantId: TENANT, userId: "staff" }), "owner");
  assertEquals(calls.includes("rpc:profile_user_id_for"), true);
});

Deno.test("a tenant with no profile row falls back to the creator", async () => {
  const { client } = fakeClient({
    users: [{ id: "owner", tenant_id: TENANT, role: "owner", created_at: "2026-01-01" }],
    company_profiles: [],
  });
  assertEquals(await resolveCampaignBusinessProfileUserId(client, { tenantId: TENANT, userId: "admin" }), "admin");
});

Deno.test("no tenant id keeps the creator-based resolution", async () => {
  const { client } = fakeClient({}, { admin: "admin" });
  assertEquals(await resolveCampaignBusinessProfileUserId(client, { tenantId: null, userId: "admin" }), "admin");
});
