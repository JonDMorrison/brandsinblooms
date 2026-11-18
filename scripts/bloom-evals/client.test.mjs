import assert from "node:assert/strict";
import { test } from "node:test";

import { askBloom, signIn } from "./client.mjs";

const sseResponse = (body) =>
  new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });

test("sends the bloom-assist chat body with the user's token and reads the stream", async () => {
  /** @type {{ url: string, init: RequestInit } | null} */
  let seen = null;
  const request = async (url, init) => {
    seen = { url: String(url), init };
    return sseResponse(
      'event: token\ndata: {"text":"Hi"}\n\nevent: done\ndata: {"conversation_id":"c1"}\n\n',
    );
  };

  const turn = await askBloom({
    url: "https://example.supabase.co/",
    anonKey: "anon",
    accessToken: "jwt",
    message: "Who are my best customers?",
    request,
  });

  assert.equal(seen?.url, "https://example.supabase.co/functions/v1/bloom-assist");
  const headers = /** @type {Record<string, string>} */ (seen?.init.headers);
  assert.equal(headers.Authorization, "Bearer jwt");
  assert.equal(headers.apikey, "anon");
  const body = JSON.parse(String(seen?.init.body));
  assert.equal(body.message, "Who are my best customers?");
  assert.equal(body.mode, "standard");
  assert.equal(body.session_type, "standard");
  assert.ok(body.timezone);
  assert.equal("plan_id" in body, false, "a plan_id would route the turn to task approval");
  assert.equal("execute_action" in body, false, "execute_action would route the turn to action execution");

  assert.equal(turn.status, 200);
  assert.equal(turn.transcript.text, "Hi");
  assert.equal(turn.transcript.done?.conversation_id, "c1");
});

test("marks resource-focused turns and keeps JSON rejections", async () => {
  /** @type {Record<string, unknown> | null} */
  let body = null;
  const request = async (_url, init) => {
    body = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ error: "Tenant membership required" }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });
  };

  const turn = await askBloom({
    url: "https://example.supabase.co",
    anonKey: "anon",
    accessToken: "jwt",
    message: "Tell me about this customer",
    resourceFocus: { resourceType: "customer", resourceId: "id", resourceSummary: "summary" },
    request,
  });

  assert.equal(body?.session_type, "resource_focused");
  assert.equal(turn.status, 403);
  assert.deepEqual(turn.json, { error: "Tenant membership required" });
  assert.equal(turn.transcript.toolCalls.length, 0);
});

test("sign-in returns the access token and fails loudly without a session", async () => {
  const fakeFactory = (session) => () => ({
    auth: {
      signInWithPassword: async () =>
        session
          ? { data: { session, user: { id: "u1" } }, error: null }
          : { data: { session: null, user: null }, error: { message: "Invalid login credentials" } },
    },
  });

  const ok = await signIn({
    url: "https://x",
    anonKey: "anon",
    email: "a@example.com",
    password: "pw",
    clientFactory: /** @type {never} */ (fakeFactory({ access_token: "jwt" })),
  });
  assert.deepEqual(ok, { accessToken: "jwt", userId: "u1" });

  await assert.rejects(
    signIn({
      url: "https://x",
      anonKey: "anon",
      email: "a@example.com",
      password: "bad",
      clientFactory: /** @type {never} */ (fakeFactory(null)),
    }),
    /Invalid login credentials/,
  );
});
