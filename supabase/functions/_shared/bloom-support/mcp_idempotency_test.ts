import { assert, assertEquals, assertNotEquals, assertRejects } from "@std/assert";
import { mutationInputSchema, normalizeMcpSessionId, prepareMcpMutation } from "./mcp-idempotency.ts";
import { BloomError } from "./runtime.ts";

const base = {
  callerId: "principal-1",
  sessionId: "session-1234567890abcdef",
  requestId: 42,
  toolName: "create_problem",
  arguments: { title: "Checkout outage", kind: "incident" },
};

Deno.test("implicit MCP retries use session/request identity and compare arguments separately", async () => {
  const first = await prepareMcpMutation(base);
  const afterLostResponse = await prepareMcpMutation(base);
  assertEquals(first, afterLostResponse);
  assert(first.requestKey.startsWith("mcp:"));
  assertEquals(first.requestKey.length, 68);

  const edited = await prepareMcpMutation({ ...base, arguments: { ...base.arguments, title: "Different incident" } });
  assertEquals(edited.requestKey, first.requestKey, "changed payload reuses the request identity so the database can reject it");
  assertNotEquals(edited.argumentsHash, first.argumentsHash, "payload mismatch is persisted separately");

  const nextCall = await prepareMcpMutation({ ...base, requestId: 43 });
  assertNotEquals(nextCall.requestKey, first.requestKey, "a later request in the session is new");
  const reconnected = await prepareMcpMutation({ ...base, sessionId: "session-fedcba0987654321" });
  assertNotEquals(reconnected.requestKey, first.requestKey, "a reused JSON-RPC id after reconnect is new");
});

Deno.test("explicit keys survive sessions and token refresh while changed payloads conflict", async () => {
  const explicit = { ...base, arguments: { ...base.arguments, idempotency_key: "operator-retry-17" } };
  const first = await prepareMcpMutation(explicit);
  const afterReconnect = await prepareMcpMutation({ ...explicit, sessionId: "session-fedcba0987654321", requestId: 999 });
  assertEquals(afterReconnect.requestKey, first.requestKey);
  assertEquals(afterReconnect.arguments.idempotency_key, "operator-retry-17", "generic handlers do not consume the transport retry key");

  const edited = await prepareMcpMutation({
    ...explicit,
    arguments: { ...explicit.arguments, title: "Changed under the same explicit key" },
  });
  assertEquals(edited.requestKey, first.requestKey);
  assertNotEquals(edited.argumentsHash, first.argumentsHash);
});

Deno.test("implicit mutations fail closed without a server session", async () => {
  await assertRejects(
    () => prepareMcpMutation({ ...base, sessionId: null }),
    BloomError,
    "Reinitialize the MCP connection",
  );
  const explicit = await prepareMcpMutation({
    ...base,
    sessionId: null,
    arguments: { ...base.arguments, idempotency_key: "legacy-explicit-key" },
  });
  assert(explicit.requestKey.startsWith("mcp:"));
});

Deno.test("native durable handlers receive exactly the outer receipt key", async () => {
  for (const toolName of ["create_ticket", "reply_to_ticket", "preview_change"]) {
    const prepared = await prepareMcpMutation({ ...base, toolName });
    assertEquals(prepared.arguments.idempotency_key, prepared.requestKey);
    const explicitOne = await prepareMcpMutation({
      ...base,
      callerId: "principal-1",
      toolName,
      arguments: { ...base.arguments, idempotency_key: "shared-by-two-users" },
    });
    const explicitTwo = await prepareMcpMutation({
      ...base,
      callerId: "principal-2",
      toolName,
      arguments: { ...base.arguments, idempotency_key: "shared-by-two-users" },
    });
    assertEquals(explicitOne.arguments.idempotency_key, explicitOne.requestKey, "raw explicit keys never reach a global native ledger");
    assertEquals(explicitTwo.arguments.idempotency_key, explicitTwo.requestKey);
    assertNotEquals(explicitTwo.requestKey, explicitOne.requestKey, "the same explicit key remains caller scoped");
  }
  const generic = await prepareMcpMutation(base);
  assertEquals(generic.arguments.idempotency_key, undefined);
});

Deno.test("explicit retry keys are validated without silent normalization", async () => {
  for (const idempotency_key of ["", "   ", "x".repeat(201)]) {
    const error = await assertRejects(
      () => prepareMcpMutation({ ...base, arguments: { ...base.arguments, idempotency_key } }),
      BloomError,
      "idempotency_key must be a nonblank string",
    );
    assertEquals(error.code, "invalid");
    assertEquals(error.status, 400);
  }
  const spaced = await prepareMcpMutation({ ...base, arguments: { ...base.arguments, idempotency_key: " exact key " } });
  const trimmed = await prepareMcpMutation({ ...base, arguments: { ...base.arguments, idempotency_key: "exact key" } });
  assertNotEquals(spaced.requestKey, trimmed.requestKey);
});

Deno.test("session ids and write schemas are bounded", () => {
  assertEquals(normalizeMcpSessionId("session-1234567890abcdef"), "session-1234567890abcdef");
  assertEquals(normalizeMcpSessionId("short"), null);
  const schema = mutationInputSchema({ type: "object", properties: { title: { type: "string" } }, additionalProperties: false });
  assertEquals((schema.properties as Record<string, unknown>).idempotency_key, {
    type: "string",
    maxLength: 200,
    description: "Optional stable retry key, retained for 30 days. Reuse only for the exact same mutation.",
  });
});
