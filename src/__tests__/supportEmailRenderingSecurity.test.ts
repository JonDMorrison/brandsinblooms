import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { bloomEmailEscape, renderBloomSystemEmail } from "../lib/email/premiumBotanical";

function source(name:string) {
  return readFileSync(join(process.cwd(), "supabase/functions", name, "index.ts"), "utf8");
}

describe("support and internal reporting email safeguards", () => {
  it("does not interpolate unescaped customer support data into HTML", () => {
    const ticket=source("send-support-ticket");
    expect(ticket).toContain("bloomEmailEscape(String(message))");
    expect(ticket).toContain("bloomEmailEscape(String(name))");
    expect(ticket).toContain("bloomEmailEscape(line)");
    expect(ticket).not.toContain("line.replace(/\\[");
    const intake=source("submit-support-request");
    expect(intake).toContain("bloomEmailEscape(String(message))");
    expect(intake).toContain("bloomEmailEscape(String(subject))");
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
      "send-support-ticket","submit-support-request","send-contact-form",
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
