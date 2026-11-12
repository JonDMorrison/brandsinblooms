import "@testing-library/jest-dom/vitest";
import { readFileSync } from "node:fs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BloomSupportError, type TicketDetail } from "@/lib/bloomSupport/api";
import { classifyForHandoff, planHandoff, plainFailure, runHandoffItem, type HandoffApi, type HandoffItem } from "@/components/bloomSupport/desk/handoff";

const ALL = ["tickets.write", "tickets.read_all"];

function ticket(id: string, extra: Partial<TicketDetail> = {}): TicketDetail {
  return {
    id, number: Number(id.replace(/\D/g, "")) || 1, subject: `Subject ${id}`, status: "working", product: "cms", kind: "bug", priority: "normal",
    created_at: "2026-11-01T00:00:00Z", updated_at: "2026-11-08T00:00:00Z", resolved_at: null, conversation_id: "c",
    account: { id: "a", name: `Client ${id}` }, requester: { id: "r", name: "Dana Whitfield", email: "dana@example.test" },
    resolution_summary: null, automation: "auto", executor: "bloom", version: 3, merged_into: null, pending_review: null,
    engineering: null, operations: [], escalations: [], feature_request: null,
    summary: "", messages: [], attachments: [], conversation_tickets: [], ...extra,
    ...(extra.engineering === verifiedFix ? { engineering: { ...verifiedFix,
      verification: { passed: true, scope: "ticket_flow", started_at: "2026-11-08T00:00:00Z", ticket_ids: [id] },
    } } : {}),
  } as TicketDetail;
}
const notReproduced = { id: "eng-1", version: 4, status: "not_reproduced", reproduction: { result: "not_reproduced", checked_at: "2026-11-08T00:00:00Z" } };
const verifiedFix = { id: "eng-2", version: 7, status: "verified", deployment: { state: "success" }, verification: { passed: true } };

describe("what Bloom may take", () => {
  it("offers settled requests, preselected, with the stored draft", () => {
    const c = classifyForHandoff(ticket("t1", { automation: "human", executor: "person", engineering: notReproduced }), ALL);
    expect(c?.item).toMatchObject({ kind: "send-and-solve", preselected: true });
    expect(c?.item?.draft).toMatch(/^Hi Dana,/);
    expect(classifyForHandoff(ticket("t2", { engineering: verifiedFix }), ALL)?.item?.action).toBe("Tell the client it's fixed, then mark it solved");
  });

  it.each([
    { status: "verified", verification: undefined },
    { status: "verified", verification: { passed: false } },
    { status: "reproduced", verification: undefined },
    { status: "in_review", verification: undefined },
    { status: "failed", verification: undefined },
    { status: "escalated", verification: undefined },
    { status: "rolled_back", verification: undefined },
  ])("does not close $status work using an old not-reproduced note", ({ status, verification }) => {
    const t = ticket("t-stale", { engineering: { ...notReproduced, status, verification } });
    expect(classifyForHandoff(t, ALL)?.item?.kind).not.toBe("send-and-solve");
  });

  it.each([
    { passed: true, scope: "release_smoke" },
    { passed: true, scope: "ticket_flow", ticket_ids: ["another-ticket"] },
    { passed: true },
  ])("never offers a fixed reply without affected-ticket proof: %j", (verification) => {
    const t = ticket("unverified", { engineering: { ...verifiedFix, verification } });
    expect(classifyForHandoff(t, ALL)?.item?.kind).not.toBe("send-and-solve");
  });

  it("includes stored production and affected-flow evidence in a fixed closure", async () => {
    const t = ticket("bound", { engineering: verifiedFix });
    const { api } = fakeApi({ bound: t });
    await runHandoffItem(api, itemFor(t), { idempotencyKey: "k", permissions: ALL });
    expect(api.sendAndSolve).toHaveBeenCalledWith("bound", expect.objectContaining({
      resolution_evidence: expect.objectContaining({
        deployment: { state: "success" },
        engineering_issue_id: "eng-2", engineering_version: 7,
        verification: { passed: true, scope: "ticket_flow", started_at: "2026-11-08T00:00:00Z", ticket_ids: ["bound"] },
      }),
    }));
  });

  it("offers person-owned work back to Bloom, never preselected", () => {
    expect(classifyForHandoff(ticket("t3", { automation: "human", executor: "person" }), ALL)?.item).toMatchObject({ kind: "hand-back", preselected: false });
    expect(classifyForHandoff(ticket("t4", { automation: "paused", executor: "person" }), ALL)?.item?.kind).toBe("hand-back");
  });

  it("holds release, repair, account changes, product decisions, admin decisions and escalations for a person", () => {
    const held = (extra: Partial<TicketDetail>) => classifyForHandoff(ticket("t", { automation: "human", ...extra }), ALL)?.held?.reason;
    expect(held({ engineering: { id: "e", status: "awaiting_approval" } })).toMatch(/Releases always need a person/);
    expect(held({ engineering: { id: "e", status: "open" }, escalations: [{ reason: "engineering_start_requested", status: "open" }] })).toMatch(/automatic repair/);
    expect(held({ operations: [{ id: "o", status: "previewed" }] })).toMatch(/account/);
    expect(held({ feature_request: { id: "f", status: "awaiting_decision" } })).toMatch(/product decision/);
    expect(held({ pending_review: "reply_after_resolution" })).toMatch(/wrote again/);
    expect(held({ status: "needs_owner" })).toMatch(/admin's decision/);
    expect(held({ escalations: [{ reason: "engineering_escalated", status: "open" }] })).toMatch(/asked for a person/);
  });

  it("leaves Bloom's own, resolved, merged and in-repair requests alone", () => {
    expect(classifyForHandoff(ticket("t5"), ALL)).toBeNull();
    expect(classifyForHandoff(ticket("t6", { status: "resolved", automation: "human" }), ALL)).toBeNull();
    expect(classifyForHandoff(ticket("t7", { merged_into: "t1", automation: "human" }), ALL)).toBeNull();
    expect(classifyForHandoff(ticket("t8", { automation: "human", engineering: { id: "e", status: "fixing" } }), ALL)).toBeNull();
  });

  it("blocks approval for people without write permission", () => {
    expect(classifyForHandoff(ticket("t9", { automation: "human" }), ["tickets.read_all"])?.item?.blocked).toBe("Your role can't approve this. An admin can.");
  });

  it("lists settled requests first", () => {
    const plan = planHandoff([ticket("t10", { automation: "human" }), ticket("t11", { engineering: verifiedFix })], ALL);
    expect(plan.items.map((i) => i.kind)).toEqual(["send-and-solve", "hand-back"]);
  });
});

function fakeApi(tickets: Record<string, TicketDetail>, fail: Partial<Record<"get" | "message" | "update" | "automation", unknown>> = {}) {
  const calls: string[] = [];
  const api: HandoffApi = {
    getTicket: vi.fn(async (id: string) => { calls.push(`get:${id}`); if (fail.get) throw fail.get; return structuredClone(tickets[id]); }),
    addMessage: vi.fn(async (id: string, input) => { calls.push(`message:${id}:${input.visibility}:${input.idempotency_key}`); if (fail.message) throw fail.message; return { message_id: "m1", duplicate: false }; }),
    sendAndSolve: vi.fn(async (id: string, input) => { calls.push(`solve:${id}:${String(input.idempotency_key)}`); if (fail.update || fail.message) throw fail.update || fail.message; return {}; }),
    updateTicket: vi.fn(async (id: string, patch) => { calls.push(`update:${id}:${String(patch.status)}:${String(patch.version)}`); if (fail.update) throw fail.update; return {}; }),
    setAutomation: vi.fn(async (id: string, mode) => { calls.push(`automation:${id}:${mode}`); if (fail.automation) throw fail.automation; return {}; }),
  };
  return { api, calls };
}
const itemFor = (t: TicketDetail) => classifyForHandoff(t, ALL)!.item!;

describe("running approved work", () => {
  it("sends the edited reply, then resolves with the evidence contract that suppresses a second email", async () => {
    const t = ticket("t20", { automation: "human", engineering: notReproduced });
    const { api, calls } = fakeApi({ t20: t });
    const result = await runHandoffItem(api, itemFor(t), { body: "Hi Dana, edited.", idempotencyKey: "rk:solve:t20", permissions: ALL });
    expect(result).toEqual({ status: "done", message: "Reply sent. Marked solved with the evidence on file." });
    expect(calls).toEqual(["get:t20", "solve:t20:rk:solve:t20"]);
    expect(api.sendAndSolve).toHaveBeenCalledWith("t20", expect.objectContaining({ body: "Hi Dana, edited.", version: 3 }));
    expect(api.addMessage).not.toHaveBeenCalled();
    expect(api.updateTicket).not.toHaveBeenCalled();
    expect(api.sendAndSolve).toHaveBeenCalledWith("t20", expect.objectContaining({
      resolution_evidence: expect.objectContaining({ via: "send-and-solve", verification: expect.objectContaining({ passed: true }) }),
    }));
  });

  it("does not send a reviewed reply after its resolution evidence changes", async () => {
    const reviewed = ticket("t30", { engineering: notReproduced });
    const { api } = fakeApi({ t30: ticket("t30", { engineering: verifiedFix }) });
    const result = await runHandoffItem(api, itemFor(reviewed), { idempotencyKey: "k", permissions: ALL });
    expect(result.status).toBe("skipped");
    expect(api.addMessage).not.toHaveBeenCalled();
    expect(api.updateTicket).not.toHaveBeenCalled();
  });

  it("uses one atomic operation so rejected closure cannot leave a separate reply", async () => {
    const t = ticket("t31", { engineering: verifiedFix });
    const { api } = fakeApi({ t31: t }, { update: new BloomSupportError(409, "conflict", "evidence changed") });
    const result = await runHandoffItem(api, itemFor(t), { idempotencyKey: "k", permissions: ALL });
    expect(result.status).toBe("failed");
    expect(api.sendAndSolve).toHaveBeenCalledTimes(1);
    expect(api.addMessage).not.toHaveBeenCalled();
    expect(api.updateTicket).not.toHaveBeenCalled();
  });

  it("uses the same idempotency key on retry, so a reply is never sent twice", async () => {
    const t = ticket("t21", { engineering: verifiedFix });
    const { api } = fakeApi({ t21: t }, { update: new BloomSupportError(409, "conflict", "conflict: version") });
    const first = await runHandoffItem(api, itemFor(t), { idempotencyKey: "rk:x", permissions: ALL });
    expect(first.status).toBe("failed");
    expect(first.message).toBe("The combined reply and closure could not be confirmed. Someone changed this request while Bloom was working. Open it to review.");
    await runHandoffItem(api, itemFor(t), { idempotencyKey: "rk:x", permissions: ALL });
    const keys = vi.mocked(api.sendAndSolve).mock.calls.map((c) => c[1].idempotency_key);
    expect(new Set(keys).size).toBe(1);
  });

  it("never resolves when the reply fails", async () => {
    const t = ticket("t22", { engineering: verifiedFix });
    const { api } = fakeApi({ t22: t }, { message: new BloomSupportError(502, "error", "provider said no <html>") });
    const result = await runHandoffItem(api, itemFor(t), { idempotencyKey: "k", permissions: ALL });
    expect(result).toEqual({ status: "failed", message: "The combined reply and closure could not be confirmed. Bloom couldn't finish this step. Try again, or open the request." });
    expect(api.updateTicket).not.toHaveBeenCalled();
  });

  it("skips a request that changed after the review", async () => {
    const reviewed = ticket("t23", { automation: "human" });
    const { api } = fakeApi({ t23: ticket("t23", { automation: "human", status: "needs_owner" }) });
    const result = await runHandoffItem(api, itemFor(reviewed), { idempotencyKey: "k", permissions: ALL });
    expect(result.status).toBe("skipped");
    expect(api.setAutomation).not.toHaveBeenCalled();
  });

  it("hands back with instructions saved as an internal note first", async () => {
    const t = ticket("t24", { automation: "human" });
    const { api, calls } = fakeApi({ t24: t });
    const result = await runHandoffItem(api, itemFor(t), { instructions: "Check the footer block.", idempotencyKey: "k", permissions: ALL });
    expect(result.status).toBe("done");
    expect(calls).toEqual(["get:t24", "message:t24:internal:k:note", "automation:t24:auto"]);
  });

  it("reports permission failures plainly and does nothing for blocked items", async () => {
    const t = ticket("t25", { automation: "human" });
    const { api } = fakeApi({ t25: t }, { automation: new BloomSupportError(403, "forbidden", "forbidden: missing permission tickets.write") });
    expect(await runHandoffItem(api, itemFor(t), { idempotencyKey: "k", permissions: ALL })).toEqual({ status: "failed", message: "Bloom didn't take it back. Your role can't do this. An admin can." });
    const blocked: HandoffItem = { ...itemFor(t), blocked: "Your role can't approve this. An admin can." };
    const second = fakeApi({ t25: t });
    expect((await runHandoffItem(second.api, blocked, { idempotencyKey: "k", permissions: [] })).status).toBe("skipped");
    expect(second.api.getTicket).not.toHaveBeenCalled();
  });

  it("never shows raw server text", () => {
    expect(plainFailure(new Error("TypeError: cannot read 'x' of undefined at sql line 4"))).toBe("Bloom couldn't finish this step. Try again, or open the request.");
  });
});

const api = vi.hoisted(() => ({ pageTickets: vi.fn(), getTicket: vi.fn(), addMessage: vi.fn(), sendAndSolve: vi.fn(), updateTicket: vi.fn(), setAutomation: vi.fn() }));
vi.mock("@/lib/bloomSupport/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/bloomSupport/api")>();
  return { ...actual, bloomSupport: { ...actual.bloomSupport, ...api } };
});
import { BloomRecommends } from "@/components/bloomSupport/BloomRecommends";
import { LetBloomHandle } from "@/components/bloomSupport/desk/LetBloomHandle";

describe("Let Bloom handle it review", () => {
  beforeEach(() => vi.clearAllMocks());
  it("reviews, runs only approved work, and reports partial failure honestly", async () => {
    const store: Record<string, TicketDetail> = {
      s1: ticket("s1", { automation: "human", engineering: notReproduced }),
      h1: ticket("h1", { automation: "human" }),
      h2: ticket("h2", { automation: "paused" }),
      x1: ticket("x1", { status: "needs_owner" }),
    };
    api.pageTickets.mockResolvedValue({ items: Object.values(store), total: 4, next_cursor: null });
    api.getTicket.mockImplementation(async (id: string) => structuredClone(store[id]));
    api.addMessage.mockResolvedValue({ message_id: "m1", duplicate: false });
    api.sendAndSolve.mockImplementation(async (id: string) => { store[id] = { ...store[id], status: "resolved" }; return {}; });
    api.setAutomation.mockImplementation(async (id: string) => {
      if (id === "h2") throw new BloomSupportError(409, "conflict", "conflict");
      store[id] = { ...store[id], automation: "auto" }; return {};
    });
    const me = { id: "admin", permissions: ALL } as unknown as Parameters<typeof LetBloomHandle>[0]["me"];
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><LetBloomHandle me={me} onOpenTicket={() => undefined} /></QueryClientProvider>);

    fireEvent.click(screen.getByRole("button", { name: "Let Bloom handle it" }));
    const approve = await screen.findByRole("button", { name: "Approve and let Bloom work (1)" });
    const held = screen.getByRole("region", { name: "A person needs to handle these" });
    expect(held).toHaveTextContent("Client x1");
    expect(screen.getByRole("checkbox", { name: /Hand back to Bloom: Client h1/ })).not.toBeChecked();
    expect(api.addMessage).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("checkbox", { name: /Hand back to Bloom: Client h1/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Hand back to Bloom: Client h2/ }));
    expect(screen.getByRole("button", { name: "Approve and let Bloom work (3)" })).toBe(approve);
    fireEvent.click(approve);

    const status = await screen.findByText("2 done, 1 didn't finish.");
    expect(status).toBeInTheDocument();
    const did = screen.getByRole("region", { name: "Bloom will do this" });
    expect(within(did).getByText("Reply sent. Marked solved with the evidence on file.")).toBeInTheDocument();
    expect(within(did).getByText("Bloom has it again. It will look at the request and update the client.")).toBeInTheDocument();
    expect(within(did).getByText(/Bloom didn't take it back\. Someone changed this request/)).toBeInTheDocument();
    expect(api.setAutomation).not.toHaveBeenCalledWith("x1", expect.anything(), expect.anything());

    api.setAutomation.mockResolvedValue({});
    fireEvent.click(screen.getByRole("button", { name: "Try the unfinished ones again" }));
    await waitFor(() => expect(screen.getByText("3 done.")).toBeInTheDocument());
    expect(api.sendAndSolve).toHaveBeenCalledTimes(1);
    expect(api.addMessage).not.toHaveBeenCalled();
  });
});


describe("single-ticket recommendation closure parity", () => {
  beforeEach(() => vi.clearAllMocks());
  it("rereads the reviewed evidence before sending from the recommendation", async () => {
    const t = ticket("recommend", { engineering: notReproduced });
    api.getTicket.mockResolvedValue({ ...t, engineering: { ...notReproduced, status: "rolled_back" } });
    const me = { permissions: ALL } as Parameters<typeof BloomRecommends>[0]["me"];
    let outcome: Promise<unknown> | undefined;
    render(<BloomRecommends t={t} me={me} hint={null} busy={false}
      run={(fn) => { outcome = fn().catch((error: Error) => error.message); }} onReply={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "Send this reply and mark solved" }));
    expect(await outcome).toMatch(/changed since you reviewed/);
    expect(api.getTicket).toHaveBeenCalledWith("recommend");
    expect(api.addMessage).not.toHaveBeenCalled();
    expect(api.updateTicket).not.toHaveBeenCalled();
  });
});


describe("reviewed closure server contract", () => {
  it("queues the reply and guarded closure in one service-only transaction", () => {
    const sql = readFileSync("supabase/migrations/20261112184000_bloom_support_atomic_closure.sql", "utf8");
    expect(sql).toContain("bloom_support.require_permission(p_actor, 'tickets.write')");
    expect(sql).toContain("bloom_support.require_ticket(p_actor,p_ticket)");
    expect(sql).toContain("receipt.request IS DISTINCT FROM p_request");
    expect(sql).toContain("jsonb_typeof(p_request->'idempotency_key') IS DISTINCT FROM 'string'");
    expect(readFileSync("supabase/functions/_shared/bloom-support/runtime.ts", "utf8")).toContain('fn: "bloom_support_send_and_solve"');
    expect(sql.indexOf("'message:reviewed-close:'")).toBeLessThan(sql.indexOf("FOR UPDATE"));
    expect(sql.indexOf("sent := bloom_support.add_message")).toBeLessThan(sql.indexOf("PERFORM bloom_support.update_ticket"));
    expect(sql).toContain("FROM PUBLIC,anon,authenticated");
    expect(sql).not.toMatch(/EXCEPTION WHEN OTHERS/);
  });
  it("scopes the guard to suggested closures and locks exact engineering evidence", () => {
    const sql = readFileSync("supabase/migrations/20261112180000_bloom_support_reviewed_closure.sql", "utf8");
    expect(sql).toContain("IS DISTINCT FROM 'send-and-solve'");
    expect(sql).toContain("FOR SHARE NOWAIT");
    expect(sql).toContain("checked > statement_timestamp()");
    expect(sql).toContain("e.verification->'passed' IS DISTINCT FROM 'true'::jsonb");
    expect(sql).toContain("jsonb_typeof(e.verification->'started_at') IS DISTINCT FROM 'string'");
    expect(sql).toContain("jsonb_typeof(e.reproduction->'checked_at') IS DISTINCT FROM 'string'");
    expect(sql).toContain("'engineering_version' IS DISTINCT FROM e.version::text");
    expect(sql).toContain("WITH RECURSIVE sources");
    expect(sql).toContain("e.reproduction->>'checked_at'");
    expect(sql).not.toContain("checked := e.updated_at");
    expect(sql).toContain("NEW.resolution_evidence->'verification' IS DISTINCT FROM e.verification");
  });
  it.each([
    { ...notReproduced, version: undefined },
    { ...notReproduced, reproduction: { result: "not_reproduced" } },
    { ...notReproduced, reproduction: { checked_at: "invalid" } },
    { ...notReproduced, reproduction: { checked_at: "2999-01-01T00:00:00Z" } },
    { ...verifiedFix, verification: { passed: true, scope: "ticket_flow", ticket_ids: ["missing-proof"], started_at: "2999-01-01T00:00:00Z" } },
  ])("does not offer a closing reply with missing server-required proof", (engineering) => {
    expect(classifyForHandoff(ticket("missing-proof", { engineering }), ALL)?.held?.reason).toContain("verify the current client report");
  });
});


describe("client reply serialization migration", () => {
  it("preserves the function contract and rereads ticket state only after advisory and row locks", () => {
    const sql = readFileSync("supabase/migrations/20261112183000_bloom_support_message_ticket_lock.sql", "utf8");
    expect(sql).toContain("pg_get_functiondef('bloom_support.add_message(uuid,uuid,jsonb)'::regprocedure)");
    const replacement = sql.split("$replacement$")[1];
    expect(replacement.indexOf("pg_advisory_xact_lock")).toBeLessThan(replacement.indexOf("FOR UPDATE"));
    expect(replacement.indexOf("FOR UPDATE")).toBeLessThan(replacement.indexOf("t := bloom_support.require_ticket"));
    expect(sql).toContain("initial ticket-read anchor not found");
    const runner = readFileSync("scripts/tests/run-bloom-support-tests.sh", "utf8");
    expect(runner).toContain("-f scripts/tests/bloom-support-message-closure-race.sql");
  });
});
