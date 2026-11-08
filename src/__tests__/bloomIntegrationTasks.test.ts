import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const runRead = vi.fn();
vi.mock("../../supabase/functions/_shared/bloom-support/runtime.ts", () => {
  class BloomError extends Error {
    constructor(public status: number, public code: string, message: string) { super(message); }
  }
  return { BloomError, rpc: (...args: unknown[]) => rpc(...args) };
});
vi.mock("../../supabase/functions/_shared/bloom-support/operations.ts", () => ({
  runRead: (...args: unknown[]) => runRead(...args),
}));

import {
  startIntegrationTask, supportTaskUrl, taskContext, taskNumberFromQuestion, taskStatusText, taskThreadFromTicket,
} from "../../supabase/functions/_shared/bloom-support/integration-tasks.ts";

const actor = { principalId:"11111111-1111-4111-8111-111111111111", role:"platform_operator", via:"service", scopes:[] } as const;
const accountId = "22222222-2222-4222-8222-222222222222";
const siteId = "33333333-3333-4333-8333-333333333333";
const ticketId = "44444444-4444-4444-8444-444444444444";
const source = {channel:"slack" as const,requestId:"55555555-5555-4555-8555-555555555555",threadTs:"1794146762.947219"};
const evidence = {
  assessment: "needs_attention", checked_at: "2026-11-08T14:06:02.000Z",
  counterpoint: { configured:true, connection_status:"active", connection_health:"healthy",catalogue_sync_status:"failed",last_success_at:"2026-11-08T14:04:00Z",recent_batches:[{status:"staged"}] },
  opd:{enabled:true,imported_links:3793,approved_links:3341,failed_links:0,latest_link_update_at:"2026-10-29T20:43:32Z"},
};

beforeEach(() => {
  rpc.mockReset(); runRead.mockReset();
  runRead.mockResolvedValue(evidence);
  rpc.mockImplementation(async (fn: string) => {
    if (fn === "get_account") return {id:accountId,name:"Lacoste Garden Centre"};
    if (fn === "create_ticket") return {ticket_id:ticketId,number:1099,duplicate_delivery:false};
    if (fn === "add_message") return {message_id:"66666666-6666-4666-8666-666666666666",duplicate:false};
    throw new Error("unexpected RPC " + fn);
  });
});

describe("Bloom investigation tasks are the existing support ticket", () => {
  it("creates a paused, idempotent internal task with safe evidence and no client mail", async () => {
    const result = await startIntegrationTask(actor as never, {accountId,siteId,source});
    expect(result).toMatchObject({ticket_id:ticketId,number:1099,duplicate:false,assessment:"needs_attention"});
    expect(runRead).toHaveBeenCalledWith(actor, {kind:"site.integration_health",account_id:accountId,inputs:{site_id:siteId}});
    const creation = rpc.mock.calls.find(([fn]) => fn === "create_ticket");
    expect(creation?.[1].actor).toBe(actor.principalId);
    expect(creation?.[1].ticket).toMatchObject({
      channel:"staff",product:"cms",kind_hint:"bug",account_id:accountId,automation:"paused",
      dedupe_key:"bloom-investigation:slack:site.integration_health:" + accountId + ":" + source.requestId,
      context:{bloom_task:{kind:"integration_health",source:"slack",thread_ts:source.threadTs,customer_verified:false,repair_authorized:false}},
    });
    const note = rpc.mock.calls.find(([fn]) => fn === "add_message")?.[1].message;
    expect(note).toMatchObject({visibility:"internal",notify_client:false,purpose:"progress"});
    expect(note.body).toContain("Catalogue synchronization: failed");
    expect(note.body).not.toContain("sk_live");
    expect(supportTaskUrl(ticketId)).toContain("ticket=" + ticketId);
  });

  it("retries do not write duplicate notes or start a model repair", async () => {
    const originalBrief = "Original diagnostic evidence, no client action authorized.";
    rpc.mockImplementation(async (fn:string) => fn === "get_account"
      ? {id:accountId,name:"Lacoste Garden Centre"} : fn === "create_ticket"
      ? {ticket_id:ticketId,number:1099,duplicate_delivery:true}
      : fn === "get_ticket"
      ? {id:ticketId,context:{bloom_task:{kind:"integration_health",brief:originalBrief}}}
      : fn === "add_message" ? {duplicate:true} : (()=>{throw Error("unexpected "+fn)})());
    const result=await startIntegrationTask(actor as never,{accountId,source});
    expect(result.duplicate).toBe(true);
    const note = rpc.mock.calls.find(([fn])=>fn==="add_message")?.[1].message;
    expect(note.body).toBe(originalBrief);
    expect(runRead).toHaveBeenCalledTimes(1);
  });

  it("denies invalid account or invalid Slack thread before remote queries", async () => {
    await expect(startIntegrationTask(actor as never,{accountId:"other",source})).rejects.toMatchObject({status:400});
    await expect(startIntegrationTask(actor as never,{accountId,source:{...source,threadTs:"1794.947219#general"}})).rejects.toMatchObject({status:400});
    expect(runRead).not.toHaveBeenCalled(); expect(rpc).not.toHaveBeenCalled();
  });

  it("never creates a task if tenant-scoped read authorization fails", async () => {
    runRead.mockRejectedValue(new Error("forbidden"));
    await expect(startIntegrationTask(actor as never,{accountId,source})).rejects.toThrow("forbidden");
    expect(rpc.mock.calls.some(([fn])=>fn==="create_ticket")).toBe(false);
  });

  it("fails closed when evidence does not declare an approved assessment", async () => {
    runRead.mockResolvedValue({assessment:"verified",notes:"not trustworthy"});
    await expect(startIntegrationTask(actor as never,{accountId,source})).rejects.toMatchObject({code:"invalid_evidence"});
    expect(rpc).not.toHaveBeenCalled();
  });

  it("dashboard uses the same task with no Slack thread metadata", async () => {
    const result=await startIntegrationTask(actor as never,{accountId,source:{channel:"dashboard",requestId:source.requestId}});
    expect(result.number).toBe(1099);
    const ctx=rpc.mock.calls.find(([fn])=>fn==="create_ticket")?.[1].ticket.context;
    expect(ctx.bloom_task.thread_ts).toBeUndefined();
    expect(ctx.bloom_task.source).toBe("dashboard");
  });
});

describe("thread status is bounded and authorization is outside the formatter",()=>{
  const ticket = {id:ticketId,number:1099,status:"needs_owner",context:taskContext(source,evidence)};
  it("links to the canonical task and does not claim the issue was fixed",()=>{
    expect(taskStatusText(ticket)).toContain("Needs an administrator");
    expect(taskStatusText(ticket)).toContain("Not verified");
    expect(taskStatusText(ticket)).toContain("ticket="+ticketId);
    expect(taskThreadFromTicket(ticket)).toBe(source.threadTs);
  });
  it("rejects unrelated tickets and forged Slack timestamps",()=>{
    expect(taskStatusText({id:ticketId,status:"working",context:{}})).toBeNull();
    expect(taskThreadFromTicket({context:{bloom_task:{kind:"integration_health",source:"slack",thread_ts:"bad"}}})).toBeNull();
  });
});

describe("Slack status requests only fetch explicitly named task numbers",()=>{
  it("accepts ordinary ways to ask about a Support investigation",()=>{
    expect(taskNumberFromQuestion("What is the status of task #1099?")).toBe(1099);
    expect(taskNumberFromQuestion("@Bloom progress on investigation 1099")).toBe(1099);
    expect(taskNumberFromQuestion("Ticket #1099 status")).toBe(1099);
  });
  it("does not interpret unrelated amounts, projects or hidden commands as task status",()=>{
    expect(taskNumberFromQuestion("Verify Lacoste integration")).toBeNull();
    expect(taskNumberFromQuestion("Please transfer 1099 dollars")).toBeNull();
    expect(taskNumberFromQuestion("Task #0 status")).toBeNull();
  });
});

describe("provider tasks stay within authorized, read-only operations",()=>{
  it("records a paused Heartland and ShipStation task with no customer email",async()=>{
    runRead.mockResolvedValue({
      assessment:"needs_attention",scope:"both",checked_at:"2026-11-08T14:00:00Z",
      heartland:{configured:true,connection_status:"configured",last_success_at:"2026-11-08T14:00:00Z",auto_sync:true,stock_publication_enabled:true,recent_runs:[{status:"failed"}]},
      shipstation:{configured:true,connection_status:"enabled",last_success_at:"2026-11-08T14:00:00Z",last_error_at:null,recent_order_events:[]},
    });
    const result=await startIntegrationTask(actor as never,{accountId,source,kind:"site.provider_health",provider:"both"});
    expect(result.message).toContain("Heartland");
    expect(result.message).toContain("ShipStation");
    expect(runRead).toHaveBeenCalledWith(actor,{kind:"site.provider_health",account_id:accountId,inputs:{provider:"both"}});
    const ticket=rpc.mock.calls.find(([fn])=>fn==="create_ticket")?.[1].ticket;
    expect(ticket.context.bloom_task.kind).toBe("provider_health");
    expect(ticket.automation).toBe("paused");
    expect(ticket.dedupe_key).toContain("site.provider_health");
    expect(ticket.body).toContain("Heartland and ShipStation");
    expect(taskThreadFromTicket({context:ticket.context})).toBe(source.threadTs);
  });
  it("rejects unknown provider and prohibited write operations before any read",async()=>{
    await expect(startIntegrationTask(actor as never,{accountId,source,kind:"site.provider_health",provider:"invalid" as never})).rejects.toMatchObject({status:400});
    await expect(startIntegrationTask(actor as never,{accountId,source,kind:"site.publish" as never})).rejects.toMatchObject({status:400});
    expect(runRead).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
});
