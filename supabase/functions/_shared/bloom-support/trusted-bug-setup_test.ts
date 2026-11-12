import { assertEquals, assertRejects } from "@std/assert";
import { configureTrustedBug } from "./trusted-bug-setup.ts";
import { BloomError, type Caller } from "./runtime.ts";
const actor: Caller = { principalId: "00000000-0000-4000-8000-000000000001", role: "platform_admin", via: "crm_session", scopes: [] };
const input = { issue_id: "00000000-0000-4000-8000-000000000002", github_issue: 42, ticket_ids: ["00000000-0000-4000-8000-000000000003"], expected_policy: { preserve: true } };
Deno.test("trusted bug setup rejects API keys, service callers and nonadmins before any RPC", async () => {
  for (const caller of [{ ...actor, via: "api_key" as const }, { ...actor, via: "service" as const }, { ...actor, role: "support" }, { ...actor, via: "public" as const }]) await assertRejects(() => configureTrustedBug(caller, input), BloomError, "signed-in administrator");
});
Deno.test("trusted bug setup accepts only bounded fixed bindings and forwards CAS unchanged", async () => {
  for (const bad of [{ ...input, extra: true }, { ...input, github_issue: -1 }, { ...input, github_issue: "42" }, { ...input, ticket_ids: [] }, { ...input, ticket_ids: [input.ticket_ids[0], input.ticket_ids[0]] }, { ...input, expected_policy: [] }, { ...input, issue_id: "bad" }]) await assertRejects(() => configureTrustedBug(actor, bad), BloomError);
  const before = globalThis.fetch;
  const env = { SUPABASE_URL: Deno.env.get("SUPABASE_URL"), SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") };
  Deno.env.set("SUPABASE_URL", "https://setup.test"); Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-only");
  try {
    globalThis.fetch = (url, init) => Promise.resolve().then(() => {
      assertEquals(String(url), "https://setup.test/rest/v1/rpc/bloom_support_configure_trusted_bug");
      assertEquals(JSON.parse(String(init?.body)), { p_actor: actor.principalId, p_issue_id: input.issue_id, p_github_issue: 42, p_ticket_ids: input.ticket_ids, p_expected_policy: input.expected_policy });
      return Response.json({ configured: true });
    });
    assertEquals(await configureTrustedBug(actor, input), { configured: true });
    globalThis.fetch = () => Promise.resolve(Response.json({ code: "40001", message: "conflict: release policy changed" }, { status: 409 }));
    await assertRejects(() => configureTrustedBug(actor, input), BloomError, "release policy changed");
  } finally {
    globalThis.fetch = before;
    for (const [key,value] of Object.entries(env)) { if (value === undefined) Deno.env.delete(key); else Deno.env.set(key,value); }
  }
});
