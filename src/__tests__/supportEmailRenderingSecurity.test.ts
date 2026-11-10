import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { runInNewContext } from "node:vm";
import { bloomEmailCard, bloomEmailEscape, renderBloomSystemEmail } from "../lib/email/premiumBotanical";

function source(name:string) {
  return readFileSync(join(process.cwd(), "supabase/functions", name, "index.ts"), "utf8");
}

describe("support and internal reporting email safeguards", () => {
  it("does not interpolate unescaped customer support data into HTML", () => {
    const ticket=source("send-support-ticket");
    expect(ticket).toContain("bloomEmailEscape(String(message))");
    expect(ticket).toContain("String(name)");
    expect(ticket).not.toContain("line.replace(/\\[");
    const intake=source("submit-support-request");
    expect(intake).not.toContain("resend.emails.send");
  });
  it("keeps every trial record in the new mobile-friendly report and escapes fields",()=>{
    const report=source("send-trial-users-report");
    expect(report).toContain("const userCards = userDetails.map");
    expect(report).toContain("bloomEmailEscape(user.email)");
    expect(report).toContain("bloomEmailEscape(user.company)");
    expect(report).toContain("bloomEmailEscape(user.name)");
    expect(report).toContain("activeTrials");
    expect(report).toContain("expiredTrials");
  });
  it("uses the supported Resend SDK replyTo property on connected senders",()=>{
    for(const name of [
      "send-support-ticket","send-contact-form",
      "send-admin-notification","send-email-confirmation","send-test-email-v2",
    ]){
      const sender=source(name);
      expect(sender).toContain("replyTo:");
      expect(sender).not.toContain("reply_to:");
    }
  });
  it("escapes even hostile AI-response snippets in email body",()=>{
    const hostile='<a href="javascript:alert(1)" onclick="alert(1)">hello</a>';
    const html=renderBloomSystemEmail({
      eyebrow:"SUPPORT",title:"Support request",
      bodyHtml:'<p>'+bloomEmailEscape(hostile)+'</p>',
    });
    expect(html).not.toContain('<a href="javascript');
    expect(html).not.toContain('<a href="javascript:');
    expect(html).toContain("&lt;a href=");
  });
});

type Handler = (request: Request) => Promise<Response>;
function handlerFor(name: string, send: (input: Record<string, unknown>) => Promise<unknown>, transport: typeof fetch = async () => { throw new Error("Unexpected network"); }) {
  let handler: Handler | undefined;
  const output = ts.transpileModule(source(name), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(output, {
    exports: {}, Request, Response, Headers, AbortSignal, fetch: transport,
    console: { log() {}, warn() {}, error() {} },
    Deno: { env: { get: (key: string) => key === "SUPABASE_URL" ? "https://database.test" : "fixture-only" } },
    require: (id: string) => {
      if (id.startsWith("https://deno.land/")) return { serve: (value: Handler) => { handler = value; } };
      if (id === "npm:resend@2.1.0") return { Resend: class { emails = { send }; } };
      if (id.endsWith("premiumBotanical.ts")) return { renderBloomSystemEmail, bloomEmailCard, bloomEmailEscape };
      if (id.endsWith("cors.ts")) return {
        handleCorsPrelight: (request: Request) => request.method === "OPTIONS" ? new Response(null, { status: 204 }) : null,
        corsJsonResponse: (body: unknown, init?: ResponseInit) => Response.json(body, init),
      };
      throw new Error("Unexpected dependency: " + id);
    },
  });
  if (!handler) throw new Error("Handler did not register");
  return handler;
}
const form = { name: "<script>alert(1)</script>", email: "requester@example.test", subject: "Something broke", message: "Please help with this problem", inquiryTypes: ["support"] };
const requestFor = (body: unknown, authenticated = false) => new Request("https://functions.test/support", {
  method: "POST", headers: { "Content-Type": "application/json", ...(authenticated ? { Authorization: "Bearer fixture-session" } : {}) }, body: JSON.stringify(body),
});

describe("all support entry points reach Bloom", () => {
  for (const endpoint of ["send-contact-form", "send-support-ticket"]) {
    it(endpoint + " sends only to Bloom and preserves the unverified requester safely", async () => {
      const messages: Record<string, unknown>[] = [];
      const handler = handlerFor(endpoint, async value => { messages.push(value); return { data: { id: "accepted" }, error: null }; });
      const response = await handler(requestFor(form));
      expect(response.status).toBe(200);
      expect(messages).toHaveLength(1);
      expect(Array.from(messages[0].to as string[])).toEqual(["bloom@bloomsuite.app"]);
      expect(messages[0].replyTo).toBe(form.email);
      expect(String(messages[0].text)).toContain("Forwarded message ---------\nFrom: " + form.email);
      expect(String(messages[0].text)).toContain("not identity verification");
      expect(String(messages[0].html)).not.toContain("<script>");
      expect(String(messages[0].html)).toContain("&lt;script&gt;");
    });
    it(endpoint + " reports provider rejection instead of claiming receipt", async () => {
      const handler = handlerFor(endpoint, async () => ({ data: null, error: { message: "private provider diagnostic" } }));
      const response = await handler(requestFor(form));
      expect(response.status).toBe(502);
      expect(await response.text()).not.toContain("private provider diagnostic");
    });
  }
  it("legacy authenticated help delegates JWT identity to Bloom without trusting submitted identity", async () => {
    let call: { url: string; init?: RequestInit } | undefined;
    const transport: typeof fetch = async (url, init) => {
      call = { url: String(url), init };
      return Response.json({ number: 1042, tracking_url: "https://bloomsuite.app/support/fixture" });
    };
    const handler = handlerFor("submit-support-request", async () => { throw new Error("Must not send separate mail"); }, transport);
    const response = await handler(requestFor({ ...form, user_email: "spoof@example.test", user_name: "spoof", tenant_id: "another-client" }, true));
    expect(response.status).toBe(200);
    expect((await response.json()).success).toBe(true);
    expect(call?.url).toBe("https://database.test/functions/v1/bloom-support-intake/report");
    expect(new Headers(call?.init?.headers).get("Authorization")).toBe("Bearer fixture-session");
    expect(JSON.parse(String(call?.init?.body))).toEqual({ product: "crm", subject: form.subject, body: form.message, context: { source: "legacy_help_widget" } });
  });
  it("legacy help rejects unauthenticated requests before any network call", async () => {
    const handler = handlerFor("submit-support-request", async () => { throw new Error("Unexpected email"); });
    expect((await handler(requestFor(form))).status).toBe(401);
  });
  it("legacy help preserves upstream authentication failure and never claims success", async () => {
    const handler = handlerFor("submit-support-request", async () => { throw new Error("Unexpected email"); }, async () => Response.json({ error: "private diagnostic" }, { status: 401 }));
    const response = await handler(requestFor(form, true));
    expect(response.status).toBe(401);
    expect(await response.text()).not.toContain("private diagnostic");
  });
});
