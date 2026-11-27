import { assertEquals } from "@std/assert";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  formatFromAddress,
  pickSenderDisplayName,
  resolveTenantSenderName,
  type SenderNameClient,
} from "./senderDisplayName.ts";
import { buildFromAddress, resolveSender } from "./senderResolver.ts";

// In-memory stand-in for the Supabase client: answers the queries the
// resolver makes from fixed rows and records them. Nothing leaves the
// process and no email is sent.
interface Fixture {
  domains?: Record<string, unknown>[];
  tenant?: Record<string, unknown> | null;
  tenantUserId?: string | null;
  profileUserId?: string;
  profileName?: string | null;
}

function fakeClient(fixture: Fixture) {
  const queries: string[] = [];
  const rowsFor = (table: string, filters: Record<string, unknown>): unknown => {
    switch (table) {
      case "email_domains":
        return fixture.domains ?? [];
      case "tenants":
        return fixture.tenant ?? null;
      case "users":
        return fixture.tenantUserId ? { id: fixture.tenantUserId } : null;
      case "company_profiles":
        return filters.user_id === (fixture.profileUserId ?? fixture.tenantUserId) &&
            fixture.profileName !== undefined
          ? { company_name: fixture.profileName }
          : null;
      default:
        throw new Error(`unexpected table ${table}`);
    }
  };

  const client = {
    from(table: string) {
      queries.push(table);
      const filters: Record<string, unknown> = {};
      const chain = {
        select: () => chain,
        eq: (column: string, value: unknown) => {
          filters[column] = value;
          return chain;
        },
        in: () => chain,
        order: () => chain,
        limit: () => chain,
        maybeSingle: () => {
          const rows = rowsFor(table, filters);
          return Promise.resolve({ data: Array.isArray(rows) ? rows[0] ?? null : rows, error: null });
        },
        single: () => chain.maybeSingle(),
        then: (resolve: (value: { data: unknown; error: null }) => unknown) =>
          resolve({ data: rowsFor(table, filters), error: null }),
      };
      return chain;
    },
    rpc(fn: string, args?: Record<string, unknown>) {
      queries.push(`rpc:${fn}`);
      return Promise.resolve({
        data: fn === "profile_user_id_for" ? fixture.profileUserId ?? args?.p_user_id : null,
        error: null,
      });
    },
  };
  return { client: client as SenderNameClient, supabase: client as unknown as SupabaseClient, queries };
}

const domain = (default_from_name: string | null) => ({
  id: "dom-1",
  domain: "mail.greenleaf.example",
  status: "active",
  default_from_email: "hello@mail.greenleaf.example",
  default_from_name,
  default_reply_to: null,
  manual_pause: false,
  investigation_mode: false,
});

Deno.test("picks the first real name in campaign order", () => {
  assertEquals(
    pickSenderDisplayName({
      domainFromName: "Greenleaf Mail",
      companyProfileName: "Greenleaf Garden Centre",
      tenantName: "Greenleaf",
    }),
    "Greenleaf Mail",
  );
  assertEquals(
    pickSenderDisplayName({ domainFromName: " ", companyProfileName: "Greenleaf Garden Centre" }),
    "Greenleaf Garden Centre",
  );
  assertEquals(
    pickSenderDisplayName({ tenantName: null, tenantFallbackFromName: "Greenleaf" }),
    "Greenleaf",
  );
});

Deno.test("placeholder names count as unset at every level", () => {
  assertEquals(
    pickSenderDisplayName({
      domainFromName: "Your Business",
      companyProfileName: "your company",
      tenantName: "Your Garden Center",
      tenantFallbackFromName: "Greenleaf",
    }),
    "Greenleaf",
  );
  assertEquals(
    pickSenderDisplayName({
      domainFromName: "Your Business",
      companyProfileName: "Your Company Name",
      tenantName: "My Business",
      tenantFallbackFromName: "Business Name",
    }),
    "",
  );
});

Deno.test("a real domain name returns without any lookup", async () => {
  const { client, queries } = fakeClient({ tenantUserId: "u1", profileName: "Ignored" });
  assertEquals(
    await resolveTenantSenderName(client, "t1", { domainFromName: "Greenleaf Mail" }),
    "Greenleaf Mail",
  );
  assertEquals(queries, []);
});

Deno.test("looks up the tenant's business profile via its owner", async () => {
  const { client, queries } = fakeClient({
    tenantUserId: "teammate",
    profileUserId: "owner",
    profileName: "Greenleaf Garden Centre",
  });
  assertEquals(
    await resolveTenantSenderName(client, "t1", { domainFromName: "Your Business" }),
    "Greenleaf Garden Centre",
  );
  assertEquals(queries, ["users", "rpc:profile_user_id_for", "company_profiles"]);
});

Deno.test("falls back to tenants.name, then fallback_from_name", async () => {
  const named = fakeClient({
    tenantUserId: "u1",
    profileName: "Your Company",
    tenant: { name: "Greenleaf", fallback_from_name: "Greenleaf Team" },
  });
  assertEquals(await resolveTenantSenderName(named.client, "t1"), "Greenleaf");

  const fallback = fakeClient({
    tenantUserId: null,
    tenant: { name: "Your Business", fallback_from_name: "Greenleaf Team" },
  });
  assertEquals(await resolveTenantSenderName(fallback.client, "t1"), "Greenleaf Team");
});

Deno.test("a profile name the caller already loaded skips the profile lookup", async () => {
  const { client, queries } = fakeClient({ tenant: { name: "Greenleaf", fallback_from_name: null } });
  assertEquals(
    await resolveTenantSenderName(client, "t1", { companyProfileName: "Greenleaf Garden Centre" }),
    "Greenleaf Garden Centre",
  );
  assertEquals(queries, []);

  assertEquals(await resolveTenantSenderName(client, "t1", { companyProfileName: null }), "Greenleaf");
  assertEquals(queries, ["tenants"]);
});

Deno.test("nothing real configured resolves to empty, never a placeholder", async () => {
  const { client } = fakeClient({
    tenantUserId: "u1",
    profileName: "Your Business",
    tenant: { name: "Your Company", fallback_from_name: null },
  });
  assertEquals(await resolveTenantSenderName(client, "t1", { domainFromName: "Your Business" }), "");
});

Deno.test("formatFromAddress omits empty and placeholder names", () => {
  assertEquals(formatFromAddress("Greenleaf", "hello@x.example"), "Greenleaf <hello@x.example>");
  assertEquals(formatFromAddress("Your Business", "hello@x.example"), "hello@x.example");
  assertEquals(formatFromAddress("", "hello@x.example"), "hello@x.example");
  assertEquals(formatFromAddress('Green "leaf" <x>', "hello@x.example"), "Green leaf x <hello@x.example>");
});

Deno.test("resolveSender keeps a real domain default_from_name", async () => {
  const { supabase } = fakeClient({ domains: [domain("Greenleaf Mail")] });
  const sender = await resolveSender(supabase, "t1");
  assertEquals(sender.fromName, "Greenleaf Mail");
  assertEquals(buildFromAddress(sender), "Greenleaf Mail <hello@mail.greenleaf.example>");
});

Deno.test("resolveSender replaces a missing or placeholder domain name with the business name", async () => {
  for (const name of [null, "", "Your Business"]) {
    const { supabase } = fakeClient({
      domains: [domain(name)],
      tenantUserId: "u1",
      profileName: "Greenleaf Garden Centre",
    });
    const sender = await resolveSender(supabase, "t1");
    assertEquals(sender.fromName, "Greenleaf Garden Centre");
  }
});

Deno.test("resolveSender never emits Your Business when no name is configured", async () => {
  const { supabase } = fakeClient({
    domains: [domain(null)],
    tenant: { name: "", fallback_from_name: null },
  });
  const sender = await resolveSender(supabase, "t1");
  assertEquals(sender.fromName, "");
  assertEquals(buildFromAddress(sender), "hello@mail.greenleaf.example");
});
