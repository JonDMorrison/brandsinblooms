import { assert, assertEquals, assertRejects } from "@std/assert";
import { actOnTicket, type AttachmentStore, renewLink, replyToTicket, TRACK_HEADERS, type TrackRpc, viewTicket } from "./track.ts";
import { BloomError } from "./runtime.ts";

const TOKEN = "AbCdEfGhIjKlMnOpQrStUvWxYz012345";
const MSG = "00000000-0000-4000-8000-000000000001";

function fakeRpc(results: Partial<Record<string, unknown>>) {
  const calls: Array<{ op: string; hash: string; payload: Record<string, unknown> }> = [];
  const rpc: TrackRpc = (op, hash, payload) => {
    calls.push({ op, hash, payload });
    return Promise.resolve(results[op] ?? null);
  };
  return { rpc, calls };
}

const leakyView = {
  state: "ok", number: 1015, subject: "Import", product: "crm", kind: "help", status: "needs_owner", step: 2,
  progress: "A senior member of our team is reviewing this.", created_at: "2026-11-05T17:30:10Z",
  owner: { name: "Jeff" }, stage: "escalated",
  messages: [
    { id: MSG, author: "customer", name: "Jon", body: "Please help", created_at: "2026-11-05T17:30:10Z", attachments: [] },
    { id: "00000000-0000-4000-8000-000000000002", author: "staff", name: "Sam", body: "internal triage note", created_at: "2026-11-05T17:31:00Z" },
  ],
};

function post(body: unknown): Request {
  return new Request("https://x.test/track", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.9" }, body: JSON.stringify(body) });
}

Deno.test("track view is rebuilt from the allow-list before it leaves the server", async () => {
  const { rpc, calls } = fakeRpc({ view: leakyView });
  const view = await viewTicket(TOKEN, rpc);
  assertEquals(calls[0].hash.length, 64);
  assert(!calls[0].hash.includes(TOKEN), "only the hash reaches the database");
  const text = JSON.stringify(view);
  for (const leak of ["needs_owner", "Jeff", "escalated", "internal triage note", "Sam"]) assert(!text.includes(leak), leak);
  assertEquals(view.state === "ok" && view.status, "in_progress");
});

Deno.test("malformed or unknown tokens are 404 and never reach the database", async () => {
  const { rpc, calls } = fakeRpc({});
  const e = await assertRejects(() => viewTicket("../../etc", rpc), BloomError);
  assertEquals(e.status, 404);
  assertEquals(calls.length, 0);
  const missing = await assertRejects(() => viewTicket(TOKEN, rpc), BloomError);
  assertEquals(missing.status, 404);
});

Deno.test("reply is validated before any write and files are stored as the requester on that message", async () => {
  const { rpc, calls } = fakeRpc({});
  const bad = await assertRejects(() => replyToTicket(post({ body: " ", idempotency_key: "key-12345" }), TOKEN, rpc), BloomError);
  assertEquals(bad.status, 400);
  assertEquals(calls.length, 0);

  const ok = fakeRpc({ reply: { message_id: MSG, duplicate: false, ticket_id: "t-1", actor: "requester-1" }, view: leakyView });
  const stored: Array<{ actor: string; ticket: string; name: string; opts: unknown }> = [];
  const store: AttachmentStore = (actor, ticket, file, opts) => {
    stored.push({ actor, ticket, name: file.name, opts });
    return Promise.resolve({});
  };
  const out = await replyToTicket(
    post({ body: "Here is a screenshot", idempotency_key: "key-12345", attachments: [{ file_name: "a.png", content_type: "image/png", data_base64: "iVBORw0KGgo=" }] }),
    TOKEN, ok.rpc, store,
  );
  assertEquals(ok.calls[0].op, "reply");
  assertEquals(ok.calls[0].payload.body, "Here is a screenshot");
  assert(typeof ok.calls[0].payload.ip === "string" && !String(ok.calls[0].payload.ip).includes("203.0.113.9"), "IP is hashed");
  assertEquals(stored, [{ actor: "requester-1", ticket: "t-1", name: "a.png", opts: { messageId: MSG, visibility: "public" } }]);
  assertEquals(out.attachments, 1);
  assert(out.view && !JSON.stringify(out.view).includes("Jeff"));
});

Deno.test("actions accept only confirm and reopen", async () => {
  const { rpc, calls } = fakeRpc({ view: leakyView });
  await assertRejects(() => actOnTicket(post({ action: "close_all" }), TOKEN, rpc), BloomError);
  assertEquals(calls.length, 0);
  await actOnTicket(post({ action: "still_broken", message: "Again today" }), TOKEN, rpc);
  assertEquals(calls[0].payload.action, "still_broken");
});

Deno.test("renew answers the same whether or not a link was sent", async () => {
  const { rpc, calls } = fakeRpc({ renew: null });
  assertEquals(await renewLink(post({}), "nope", rpc), { ok: true });
  assertEquals(calls.length, 0);
  assertEquals(await renewLink(post({}), TOKEN, rpc), { ok: true });
  assertEquals(calls[0].op, "renew");
});

Deno.test("tracking responses are private, uncached and not indexed", () => {
  assertEquals(TRACK_HEADERS["X-Robots-Tag"], "noindex, nofollow, noarchive");
  assertEquals(TRACK_HEADERS["Referrer-Policy"], "no-referrer");
  assert(TRACK_HEADERS["Cache-Control"].includes("no-store"));
});
