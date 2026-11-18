import { deepStrictEqual as assertEquals, throws as assertThrows } from "node:assert/strict";
import { actions } from "./service.ts";
import { BloomError, type Caller } from "./runtime.ts";
const caller: Caller = { principalId: "fa000000-0000-4000-8000-000000000001", role: "platform_admin", via: "api_key", scopes: ["write"] };
Deno.test("external response rejects nonoperators and read-only API keys before network", () => {
  for (const role of ["client", "support", "service"]) {
    assertThrows(() => actions.reconcileExternalResponse({ ...caller, role }, caller.principalId, {}), BloomError);
  }
  assertThrows(() => actions.reconcileExternalResponse({ ...caller, scopes: ["read"] }, caller.principalId, {}), BloomError);
});
Deno.test("external response binds authenticated actor and calls only evidence RPC", async () => {
  const original = fetch;
  const url = Deno.env.get("SUPABASE_URL"), key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  Deno.env.set("SUPABASE_URL", "https://fixture.invalid");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "fixture-not-a-real-secret");
  let calls = 0;
  globalThis.fetch = (input, init) => {
    calls++;
    assertEquals(String(input), "https://fixture.invalid/rest/v1/rpc/bloom_support_reconcile_external_response");
    const body = JSON.parse(String(init?.body));
    assertEquals(body.p_actor, caller.principalId);
    assertEquals(body.p_request, { version: 3 });
    return Promise.resolve(new Response(JSON.stringify({ recorded: true, delivery: "not_verified" }), { headers: { "Content-Type": "application/json" } }));
  };
  try {
    const r = await actions.reconcileExternalResponse(caller, caller.principalId, { version: 3, idempotency_key: "mcp-retry-key" });
    assertEquals(r, { recorded: true, delivery: "not_verified" });
    assertEquals(calls, 1);
  } finally {
    globalThis.fetch = original;
    if (url === undefined) Deno.env.delete("SUPABASE_URL"); else Deno.env.set("SUPABASE_URL", url);
    if (key === undefined) Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY"); else Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", key);
  }
});
