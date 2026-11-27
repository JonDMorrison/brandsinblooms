import {
  buildFromAddress,
  resolveSender,
  resolveTenantSenderName,
  type SenderConfig,
  type SenderNameClient,
} from "./senderResolver.ts";
import { resolveCampaignSenderDisplayName } from "./campaignFromHeader.ts";

function assertEquals(actual: unknown, expected: unknown, message?: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(message ?? `Expected ${e}, received ${a}`);
}

interface Fixture {
  domain?: Record<string, unknown> | null;
  memberId?: string | null;
  profileUserId?: string;
  companyName?: string | null;
  tenantName?: string | null;
  fallbackFromName?: string | null;
}

const TENANT_ID = "tenant-1";

// In-memory stand-in for the Supabase client: no network, no sends.
function fakeClient(fixture: Fixture) {
  const queries: string[] = [];

  function rowFor(table: string, filters: Record<string, unknown>): unknown {
    if (table === "users") {
      return fixture.memberId ? { id: fixture.memberId } : null;
    }
    if (table === "company_profiles") {
      const expected = fixture.profileUserId ?? fixture.memberId;
      return filters.user_id === expected && fixture.companyName !== undefined
        ? { company_name: fixture.companyName }
        : null;
    }
    if (table === "tenants") {
      return filters.id === TENANT_ID
        ? { name: fixture.tenantName ?? null, fallback_from_name: fixture.fallbackFromName ?? null }
        : null;
    }
    return null;
  }

  const client = {
    queries,
    rpc(fn: string, args?: Record<string, unknown>) {
      queries.push(`rpc:${fn}`);
      return Promise.resolve({
        data: fn === "profile_user_id_for" ? fixture.profileUserId ?? args?.p_user_id : null,
        error: null,
      });
    },
    from(table: string) {
      queries.push(table);
      const filters: Record<string, unknown> = {};
      const builder = {
        select: (_columns: string) => builder,
        eq: (column: string, value: unknown) => {
          filters[column] = value;
          return builder;
        },
        in: (_column: string, _values: unknown[]) => builder,
        order: (_column: string, _opts?: unknown) => builder,
        limit: (_count: number) => {
          if (table === "email_domains") {
            return Promise.resolve({
              data: fixture.domain ? [fixture.domain] : [],
              error: null,
            });
          }
          return builder;
        },
        maybeSingle: () => Promise.resolve({ data: rowFor(table, filters), error: null }),
        single: () => Promise.resolve({ data: fixture.domain ?? null, error: fixture.domain ? null : { message: "none" } }),
      };
      return builder;
    },
  };
  return client;
}

function asClient(client: ReturnType<typeof fakeClient>): SenderNameClient {
  return client as unknown as SenderNameClient;
}

const domain = (defaultFromName: string | null) => ({
  id: "domain-1",
  domain: "mail.example-garden.com",
  status: "active",
  default_from_email: "hello@mail.example-garden.com",
  default_from_name: defaultFromName,
  default_reply_to: null,
  manual_pause: false,
  investigation_mode: false,
});

Deno.test("real domain default name wins without extra lookups", async () => {
  const client = fakeClient({ companyName: "Profile Name", tenantName: "Tenant Name" });
  const name = await resolveTenantSenderName(asClient(client), TENANT_ID, "Northfield Garden Center");
  assertEquals(name, "Northfield Garden Center");
  assertEquals(client.queries, []);
});

Deno.test("placeholder domain name is unset; business profile name is used", async () => {
  for (const placeholder of ["Your Business", "your company", " Your Business Name "]) {
    const client = fakeClient({
      memberId: "member-2",
      profileUserId: "owner-1",
      companyName: "Northfield Garden Center",
      tenantName: "Tenant Name",
    });
    const name = await resolveTenantSenderName(asClient(client), TENANT_ID, placeholder);
    assertEquals(name, "Northfield Garden Center", `placeholder ${placeholder}`);
    // Teammate rows resolve to the tenant's business profile.
    assertEquals(client.queries.includes("rpc:profile_user_id_for"), true);
  }
});

Deno.test("placeholder profile name falls back to tenants.name", async () => {
  const client = fakeClient({ memberId: "u1", companyName: "Your Company", tenantName: "Lacoste Garden Centre" });
  assertEquals(await resolveTenantSenderName(asClient(client), TENANT_ID, null), "Lacoste Garden Centre");
});

Deno.test("no profile and placeholder tenant name fall back to fallback_from_name", async () => {
  const client = fakeClient({ memberId: null, tenantName: "My Business", fallbackFromName: "Lacoste's Nursery" });
  assertEquals(await resolveTenantSenderName(asClient(client), TENANT_ID, ""), "Lacoste's Nursery");
});

Deno.test("nothing real resolves to an empty name, never a placeholder", async () => {
  const client = fakeClient({
    memberId: "u1",
    companyName: "Your Business",
    tenantName: "Your Company",
    fallbackFromName: "  ",
  });
  assertEquals(await resolveTenantSenderName(asClient(client), TENANT_ID, "Your Business"), "");
});

Deno.test("resolveSender: domain without a name uses the business profile", async () => {
  const client = fakeClient({ domain: domain(null), memberId: "u1", companyName: "Northfield Garden Center" });
  const config = await resolveSender(asClient(client) as unknown as Parameters<typeof resolveSender>[0], TENANT_ID, {});
  assertEquals(config.fromName, "Northfield Garden Center");
  assertEquals(buildFromAddress(config), "Northfield Garden Center <hello@mail.example-garden.com>");
});

Deno.test("resolveSender: nothing real sends from the bare verified address", async () => {
  const client = fakeClient({ domain: domain("Your Business"), memberId: null, tenantName: "Your Business" });
  const config = await resolveSender(asClient(client) as unknown as Parameters<typeof resolveSender>[0], TENANT_ID, {});
  assertEquals(config.fromName, "");
  assertEquals(buildFromAddress(config), "hello@mail.example-garden.com");
});

Deno.test("buildFromAddress never emits a placeholder handed to it", () => {
  const config: SenderConfig = {
    fromEmail: "hello@mail.example-garden.com",
    fromName: "Your Business",
    deliveryMethod: "custom_domain",
  };
  assertEquals(buildFromAddress(config), "hello@mail.example-garden.com");
  assertEquals(buildFromAddress({ ...config, fromName: "Northfield" }), "Northfield <hello@mail.example-garden.com>");
});

Deno.test("campaign display name skips placeholders at every step", () => {
  assertEquals(
    resolveCampaignSenderDisplayName({
      campaignSenderName: "Your Business",
      domainFromName: "Your Company",
      companyProfileName: "Northfield Garden Center",
    }),
    "Northfield Garden Center",
  );
  assertEquals(
    resolveCampaignSenderDisplayName({ campaignSenderName: "Spring Sale Team", domainFromName: "Northfield" }),
    "Spring Sale Team",
  );
  assertEquals(resolveCampaignSenderDisplayName({ domainFromName: "Your Business" }), "BloomSuite");
});
