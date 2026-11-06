import { assert, assertEquals, assertNotEquals } from "@std/assert";
import {
  deriveMcpIdempotencyKey,
  legacyMcpRequestScope,
  normalizeMcpSessionId,
  withMcpIdempotency,
} from "./mcp-idempotency.ts";

Deno.test("MCP retries derive one stable key without requiring OAuth clients to add a field", async () => {
  const call = {
    callerId: "principal-1",
    requestScope: "session-1234567890abcdef",
    requestId: 42,
    toolName: "create_ticket",
    arguments: { product: "crm", body: "The save button is stuck" },
  };
  const first = await withMcpIdempotency(call);
  const afterLostResponse = await withMcpIdempotency(call);
  assertEquals(first.idempotency_key, afterLostResponse.idempotency_key);
  assert(String(first.idempotency_key).startsWith("mcp:"));
  assertEquals(String(first.idempotency_key).length, 68);

  const nextCall = await withMcpIdempotency({ ...call, requestId: 43 });
  assertNotEquals(nextCall.idempotency_key, first.idempotency_key, "a later intentional call is not swallowed");
  const editedCall = await withMcpIdempotency({ ...call, arguments: { ...call.arguments, body: "A different request" } });
  assertNotEquals(editedCall.idempotency_key, first.idempotency_key, "request content participates in the key");
});

Deno.test("MCP preserves explicit idempotency and does not add keys to read-only calls", async () => {
  const base = { callerId: "p", requestScope: "session-1234567890abcdef", requestId: "r1" };
  const explicit = await withMcpIdempotency({ ...base, toolName: "reply_to_ticket", arguments: { body: "Hello", idempotency_key: "client-key" } });
  assertEquals(explicit.idempotency_key, "client-key");
  const read = await withMcpIdempotency({ ...base, toolName: "get_ticket", arguments: { ticket_id: "t" } });
  assertEquals(read, { ticket_id: "t" });
});

Deno.test("MCP session and legacy scopes are safe and deterministic", async () => {
  assertEquals(normalizeMcpSessionId("session-1234567890abcdef"), "session-1234567890abcdef");
  assertEquals(normalizeMcpSessionId("short"), null);
  const scope = await legacyMcpRequestScope("Bearer secret-never-returned", "test-client", new Date("2026-11-05T12:00:00Z"));
  assertEquals(scope, await legacyMcpRequestScope("Bearer secret-never-returned", "test-client", new Date("2026-11-05T23:59:00Z")));
  assert(!scope.includes("secret-never-returned"));
});

Deno.test("derived MCP keys are canonical across object property order", async () => {
  const base = { callerId: "p", requestScope: "session-1234567890abcdef", requestId: 1, toolName: "preview_change" };
  assertEquals(
    await deriveMcpIdempotencyKey({ ...base, arguments: { kind: "site.page.update", inputs: { b: 2, a: 1 } } }),
    await deriveMcpIdempotencyKey({ ...base, arguments: { inputs: { a: 1, b: 2 }, kind: "site.page.update" } }),
  );
});
