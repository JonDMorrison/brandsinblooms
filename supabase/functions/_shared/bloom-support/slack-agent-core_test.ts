import { assertEquals, assert, assertThrows, assertStringIncludes } from "@std/assert";
import { AGENT_SYSTEM, ToolPermissionError, toolFailure, availableTools, composeSlackAgentReply, explicitIntent, openAiTools, runAgent, safeAgentAnswer, scrub, TOOL_SPECS, validateArguments, type AgentContext, type AgentDependencies, type ChatMessage } from "./slack-agent-core.ts";
const context = (patch: Partial<AgentContext> = {}): AgentContext => ({
  jobId: "job", principalId: "staff", role: "platform_admin", channel: "private", route: "tickets", rootTs: "1.000001",
  ticketId: null, question: "What needs attention?", history: [], privateChannel: true, ...patch,
});
const call = (name: string, args = "{}", id = "call1"): ChatMessage => ({ role: "assistant", content: null, tool_calls: [{ id, type: "function", function: { name, arguments: args } }] });
const answer = (content = "The source shows one request waiting for review."): ChatMessage => ({ role: "assistant", content });
function harness(replies: ChatMessage[], overrides: Partial<AgentDependencies> = {}) {
  const executed: string[] = [], audited: string[] = [], requests: ChatMessage[][] = [];
  let index = 0;
  const deps: AgentDependencies = {
    authorize: () => Promise.resolve(true),
    model: (messages) => { requests.push([...messages]); return Promise.resolve(replies[index++] ?? answer()); },
    execute: (name) => { executed.push(name); return Promise.resolve({ data: { count: 1 }, source: "Support record" }); },
    audit: (name, outcome) => { audited.push(name + ":" + outcome); return Promise.resolve(); },
    ...overrides,
  };
  return { executed, audited, requests, deps };
}
Deno.test("public or unverified channels have product knowledge only", () => {
  assertEquals(availableTools(context({ privateChannel: false })).map(t => t.name), ["product_knowledge"]);
  assertEquals(availableTools(context({ role: "client" })), []);
  assertEquals(availableTools(context({ role: "platform_admin_evil" })), []);
});
Deno.test("public model requests exclude history and ticket bindings from previously private conversations", async () => {
  const h = harness([answer("Please ask the product question again in this channel.")]);
  await runAgent(context({ privateChannel: false, ticketId: "private-ticket-sentinel", history: [{
    question: "Which client needs help?", answer: "Confidential client and support issue sentinel",
  }] }), h.deps);
  const sent = JSON.stringify(h.requests);
  assert(!sent.includes("Confidential client"));
  assert(!sent.includes("private-ticket-sentinel"));
  const user = JSON.parse(h.requests[0][1].content!);
  assertEquals(user.history, []);
  assertEquals(user.bound_ticket_id, null);
});
Deno.test("bound threads cannot enumerate other clients or the global inbox", () => {
  const tools = availableTools(context({ ticketId: "bound" })).map(t => t.name);
  for (const name of ["find_clients", "find_tickets", "support_overview", "pending_replies", "release_status", "process_support_inbox"]) assert(!tools.includes(name));
  assert(tools.includes("ticket_evidence"));
});
Deno.test("current explicit intent is required for workflow writes", () => {
  assert(!explicitIntent("Please investigate this checkout issue", "repair"));
  assert(explicitIntent("Can you fix this and deploy it?", "repair"));
  assert(explicitIntent("Please answer all our support emails", "inbox"));
  assert(explicitIntent("Get a human to help with this", "human"));
  for (const q of ["Don't repair this", "How would you fix this?", "Please investigate but do not change anything", "What if you answer support emails?", "Example: fix this", "Never ask a human"]) {
    assert(!explicitIntent(q, "repair")); assert(!explicitIntent(q, "inbox")); assert(!explicitIntent(q, "human"));
  }
});
Deno.test("only owners may request inbox processing; ticket writes stay bound", () => {
  assert(!availableTools(context({ role: "support", question: "Answer our support emails" })).some(t => t.name === "process_support_inbox"));
  assert(availableTools(context({ question: "Answer our support emails" })).some(t => t.name === "process_support_inbox"));
  assert(!availableTools(context({ question: "Fix this" })).some(t => t.name === "request_repair"));
  assert(availableTools(context({ ticketId: "bound", question: "Fix this" })).some(t => t.name === "request_repair"));
  assert(!availableTools(context({ ticketId: "bound", question: "What is the status?", history: [{ question: "Fix this", answer: "old" }] })).some(t => t.intent));
});
Deno.test("schemas are strict, fully required and contain no generic execution tool", () => {
  const defs = openAiTools(TOOL_SPECS) as Array<{ function: { name: string; strict: boolean; parameters: { additionalProperties: boolean; required: string[]; properties: Record<string, unknown> } } }>;
  for (const d of defs) {
    assertEquals(d.function.strict, true); assertEquals(d.function.parameters.additionalProperties, false);
    assertEquals(d.function.parameters.required.sort(), Object.keys(d.function.parameters.properties).sort());
    assert(!/execute_sql|shell|send_email|approve|deploy_code/.test(d.function.name));
  }
});
Deno.test("arguments reject extra keys, prototype keys, missing fields, wrong types and unsupported enums", () => {
  const knowledge = TOOL_SPECS.find(t => t.name === "product_knowledge")!;
  for (const raw of ['[]', 'null', '{}', '{"query":7,"product":"all"}', '{"query":"q","product":"anything"}', '{"query":"q","product":"all","actor":"admin"}', '{"query":"q","product":"all","constructor":"bad"}']) assertThrows(() => validateArguments(knowledge, raw));
  assertEquals(validateArguments(knowledge, '{"query":"newsletter","product":"crm"}'), { query: "newsletter", product: "crm" });
});
Deno.test("sensitive fields and credential-bearing text are removed before the model", () => {
  const data = scrub({ email: "test@example.com", requester: { name: "private" }, token: "secret", note: "Contact x@example.com or https://evil.test and Bearer topsecret", count: 4 });
  const json = JSON.stringify(data);
  assert(!json.includes("test@example.com")); assert(!json.includes("private")); assert(!json.includes("topsecret")); assert(!json.includes("evil.test")); assertStringIncludes(json, '"count":4');
  assertEquals(scrub("2026-11-17T20:00:00Z"), "2026-11-17T20:00:00Z");
  assertEquals(scrub("01234567-abcd-1234-9876-abcdef123456"), "01234567-abcd-1234-9876-abcdef123456");
});
Deno.test("generated completion claims and arbitrary links are rejected", () => {
  for (const s of ["I sent the reply", "We've deployed it", "I queued every request", "I saved that", "Visit https://evil.test", "Email x@example.com", "<@U123> hi"]) assertEquals(safeAgentAnswer(s), null);
  assertEquals(safeAgentAnswer("A deployment is recorded; customer verification is missing."), "A deployment is recorded; customer verification is missing.");
});
Deno.test("long Slack replies fit durable storage while preserving complete receipts and source links",()=>{
  const receipt="Recorded: A reply draft is recorded in Reply approvals. It has not been sent. Review its exact recipient and text before approving.";
  const links="Checked sources: <https://bloomsuite.app/admin/bloom-support?view=approvals|Reply approvals>";
  const reply=composeSlackAgentReply("Verified context. ".repeat(200),[receipt,links]);
  assert(reply.length<=2400);
  assertStringIncludes(reply,receipt);
  assert(reply.endsWith(links));
  assertStringIncludes(reply,"…\n\nRecorded:");
  assertEquals(composeSlackAgentReply("Short answer",["",links,""]),"Short answer\n\n"+links);
  const unicode=composeSlackAgentReply("🌱".repeat(2000),[receipt,links]);
  assert(unicode.length<=2400);
  assertEquals([...unicode].some(char=>char.length===1&&/[\uD800-\uDFFF]/.test(char)),false);
});
Deno.test("native function results are returned to the model with source and audit", async () => {
  const h = harness([call("support_overview"), answer()]);
  const out = await runAgent(context(), h.deps);
  assertEquals(out.calls, 1); assertEquals(h.executed, ["support_overview"]); assertEquals(out.sources, ["Support record"]);
  assertEquals(h.audited, ["support_overview:succeeded"]);
  assert(h.requests[1].some(m => m.role === "tool" && m.tool_call_id === "call1" && m.content?.includes("observed_at")));
});
Deno.test("a hallucinated or public-channel operational tool never runs", async () => {
  for (const c of [context(), context({ privateChannel: false })]) {
    const h = harness([call(c.privateChannel ? "send_email" : "support_overview")]);
    await runAgent(c, h.deps); assertEquals(h.executed.length, 0);
  }
});
Deno.test("multiple calls in one model message are rejected", async () => {
  const r = call("support_overview"); r.tool_calls!.push(call("release_status", "{}", "call2").tool_calls![0]);
  const h = harness([r]); await runAgent(context(), h.deps); assertEquals(h.executed.length, 0);
});
Deno.test("equivalent duplicate calls execute once", async () => {
  const h = harness([call("support_overview"), call("support_overview", "{ }", "call2"), answer()]);
  const out = await runAgent(context(), h.deps); assertEquals(out.calls, 1); assertEquals(h.executed.length, 1);
});
Deno.test("revoked authorization prevents execution and strips sources", async () => {
  let checks = 0;
  const h = harness([call("support_overview")], { authorize: () => Promise.resolve(++checks < 3) });
  const out = await runAgent(context(), h.deps); assertEquals(h.executed.length, 0); assertEquals(out.sources, []);
});
Deno.test("tool failures are not converted into success receipts", async () => {
  const h = harness([call("support_overview"), answer("The lookup was not confirmed.")], { execute: () => Promise.reject(Error("private diagnostic secret")) });
  const out = await runAgent(context(), h.deps); assertEquals(out.receipts, []); assertEquals(out.calls, 0);
  assert(!JSON.stringify(h.requests).includes("private diagnostic secret")); assertEquals(h.audited, ["support_overview:not_confirmed"]);
});
Deno.test("confirmed receipts survive a later model failure", async () => {
  let i = 0;
  const h = harness([], { model: () => ++i === 1 ? Promise.resolve(call("request_human")) : Promise.reject(Error("model down")), execute: () => Promise.resolve({ data: {}, source: "Ticket", receipt: "Escalation recorded; notification not confirmed." }) });
  const out = await runAgent(context({ ticketId: "bound", question: "Get a human to help" }), h.deps);
  assertEquals(out.receipts, ["Escalation recorded; notification not confirmed."]);
});
Deno.test("tool loops are bounded and no fresh tool runs on final synthesis", async () => {
  let models = 0;
  const h = harness([], { model: () => { models++; return Promise.resolve(call("product_knowledge", JSON.stringify({ query: "q" + models, product: "all" }))); } });
  const out = await runAgent(context(), h.deps); assertEquals(out.calls, 4); assertEquals(models, 5);
});
Deno.test("reply drafting requires current explicit intent and a bound private ticket", () => {
  assert(explicitIntent("Please prepare a reply to the customer", "draft"));
  assert(!explicitIntent("How would you draft a reply?", "draft"));
  assert(!availableTools(context({ question: "Draft a reply" })).some(t => t.name === "draft_support_reply"));
  assert(availableTools(context({ ticketId: "bound", question: "Draft a reply" })).some(t => t.name === "draft_support_reply"));
  assert(!availableTools(context({ ticketId: "bound", privateChannel: false, question: "Draft a reply" })).some(t => t.name === "draft_support_reply"));
});
Deno.test("personal customer intelligence is owner-only and never available in public", () => {
  for (const c of [context({ role: "support" }), context({ privateChannel: false })])
    assert(!availableTools(c).some(t => ["client_customer_overview", "find_client_customer", "client_customer_profile"].includes(t.name)));
  assert(availableTools(context()).some(t => t.name === "client_customer_overview"));
});
Deno.test("safe draft-only instructions are accepted while negative repair instructions remain denied", () => {
  assert(explicitIntent("Please draft a reply but do not send it", "draft"));
  assert(explicitIntent("Prepare a response without sending it", "draft"));
  assert(!explicitIntent("Do not draft a reply", "draft"));
  assert(!explicitIntent("Fix this without changing anything", "repair"));
  assert(!explicitIntent("Investigate this issue", "repair"));
  assert(explicitIntent("Resume this release", "release"));
  assert(!availableTools(context({ role: "support", ticketId: "bound", question: "Deploy this" })).some(t => t.name === "resume_release"));
});
Deno.test("revenue_by_client is owner-only and needs a channel Slack reports as private", () => {
  const has = (patch: Partial<AgentContext>) => availableTools(context(patch)).some(t => t.name === "revenue_by_client");
  assert(has({ confirmedPrivate: true }));
  assert(has({ role: "platform_operator", confirmedPrivate: true }));
  assertEquals(has({ role: "support", confirmedPrivate: true }), false);
  assertEquals(has({ confirmedPrivate: false }), false);
  assertEquals(has({}), false);
  assertEquals(has({ privateChannel: false, confirmedPrivate: true }), false);
  const spec = TOOL_SPECS.find(t => t.name === "revenue_by_client")!;
  assertEquals(validateArguments(spec, JSON.stringify({ from: null, to: null, category: "event" })).category, "event");
  assertThrows(() => validateArguments(spec, JSON.stringify({ from: null, to: null, category: "x".repeat(61) })));
  assertThrows(() => validateArguments(spec, JSON.stringify({ from: null, to: null, category: null, tenant_id: "other" })));
});
Deno.test("prompt reports recorded revenue and forbids a false restriction claim", () => {
  assertEquals(AGENT_SYSTEM.includes("financial outcomes"), false);
  assertStringIncludes(AGENT_SYSTEM, "Report recorded revenue from revenue_by_client. Never state a figure that tool did not return. If a category is not recorded, say so and give the totals that are.");
  assertStringIncludes(AGENT_SYSTEM, "unless a tool actually returned a permission_denied error");
});
Deno.test("tool failures name a permission refusal only when the server refused", async () => {
  assertEquals(toolFailure(new ToolPermissionError("no")).error, "permission_denied");
  const other = toolFailure(Error("timeout"));
  assertEquals(other.error, "unavailable");
  assertStringIncludes(other.guidance, "not a permission refusal");
  const h = harness([call("support_overview"), answer()], { execute: () => Promise.reject(Error("network")) });
  await runAgent(context(), h.deps);
  const tool = h.requests[1].find(m => m.role === "tool")?.content ?? "";
  assertStringIncludes(tool, '"error":"unavailable"');
  assertEquals(/outside your permissions/.test(tool), false);
  assertEquals(h.audited, ["support_overview:not_confirmed"]);
});
Deno.test("the model knows today's date and that all-sales totals are not category figures", async () => {
  const h = harness([answer()], { now: () => Date.parse("2026-11-25T14:00:00Z") });
  await runAgent(context(), h.deps);
  const user = JSON.parse(String(h.requests[0][1].content));
  assertEquals(user.today, "2026-11-25");
  assertStringIncludes(AGENT_SYSTEM, "all_sales_total is total sales, never an events, fundraising or plant figure");
  const spec = TOOL_SPECS.find(t => t.name === "revenue_by_client")!;
  assertStringIncludes(spec.description, "must be null unless the staff member named a period");
  assertStringIncludes(spec.description, "comma-separated");
});
