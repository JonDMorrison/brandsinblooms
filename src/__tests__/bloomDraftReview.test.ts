import { describe, expect, it } from "vitest";
import {
  mapCampaign,
  reviewDraft,
  toReviewableBlock,
} from "../../supabase/functions/bloom-assist/tools/implementations/query-campaigns";
import { resolveTenantSendingReadiness } from "@/lib/crm/senderSeverity";
import {
  assessSendReadiness,
  getSendReadiness,
  parseReachabilityRow,
} from "../../supabase/functions/bloom-assist/tools/implementations/send-readiness";
import {
  correctSendReadinessReply,
  toolOutcomeFrom,
} from "../../supabase/functions/bloom-assist/reply-guard";
import { isSendReadinessQuestion } from "../../supabase/functions/bloom-assist/tools/tool-routing";
import { getRegisteredTool } from "../../supabase/functions/bloom-assist/tools/registry";
import { BASE_SYSTEM_PROMPT } from "../../supabase/functions/bloom-assist/prompts/base-system-prompt";
import type { ToolExecutionContext } from "../../supabase/functions/bloom-assist/tools/types";

// Shapes taken from Northfield in production (2026-11-26): one verified
// domain with a default From address, set as the tenant default.
const northfieldDomain = {
  id: "e80290a9-7f39-4564-8c8a-91798764dbdf",
  domain: "northfieldgardens.ca",
  default_from_email: "mail@northfieldgardens.ca",
  default_from_name: "Northfield Garden Center",
  status: "active" as const,
  verified_at: "2026-11-22T12:30:07.343+00:00",
  manual_pause: false,
  investigation_mode: false,
  resend_status: {
    status: "verified",
    spf_verified: true,
    dkim_verified: true,
    return_path_verified: true,
    dmarc_verified: true,
  },
};
const northfieldReadiness = resolveTenantSendingReadiness({
  domains: [northfieldDomain],
  defaultDomainId: northfieldDomain.id,
});

const draftRow = {
  id: "0d004c63-9ded-4167-acb5-1249cc2cd3c6",
  name: "Untitled Campaign",
  subject_line: "",
  status: "draft",
  scheduled_at: null,
  sent_at: null,
  created_at: "2026-11-20T10:00:00Z",
  segment_id: null,
  metrics: null,
  open_rate: null,
  click_rate: null,
  total_sent: null,
  total_recipients: 9500,
  messages_sent: null,
  sender_email: "",
  sender_name: "",
};

describe("Bloom 'Review my draft campaigns'", () => {
  it("labels drafts as drafts and never reports a send count", () => {
    const mapped = mapCampaign(draftRow, [], null);
    expect(mapped.status_label).toBe("Draft (not sent)");
    expect(mapped.has_been_sent).toBe(false);
    expect(mapped.metrics_summary).toBeNull();
    // Shared display-name rule: placeholder name falls back to "Draft, <date>".
    expect(String(mapped.name)).toMatch(/^Draft, /);
  });

  it("keeps delivered counts for sent campaigns", () => {
    const mapped = mapCampaign(
      { ...draftRow, name: "Spring Perennial Sale", status: "sent", total_sent: 2146 },
      [],
      null,
    );
    expect(mapped.status_label).toBe("Sent");
    expect(mapped.metrics_summary).toMatchObject({ delivered_count: 2146 });
  });

  it("runs the Review & Send subject, empty-block and sender checks", () => {
    const review = reviewDraft({
      subjectLine: "",
      senderEmail: "",
      senderName: "",
      blocks: [
        toReviewableBlock({
          campaign_id: draftRow.id,
          order_index: 0,
          block_type: "image",
          content: { id: "b1", type: "image", visible: true, imageUrl: "" },
          image_url: null,
        }),
      ],
      emailDomains: [northfieldDomain],
      readiness: northfieldReadiness,
    });
    const checks = review.checks as Array<{ check: string; ok: boolean; detail: string }>;
    expect(checks.find((c) => c.check === "Subject line")?.ok).toBe(false);
    expect(checks.find((c) => c.check === "Content")?.detail).toMatch(/Add an image or remove this image block/);
    expect(review.recommendation).toMatch(/subject line/i);
  });

  it("recommends sending when every check passes", () => {
    const review = reviewDraft({
      subjectLine: "Your 2026 garden, in review",
      senderEmail: "mail@northfieldgardens.ca",
      senderName: "Northfield Garden Center",
      blocks: [{ id: "b1", type: "text", visible: true }],
      emailDomains: [northfieldDomain],
      readiness: northfieldReadiness,
    });
    expect((review.checks as Array<{ ok: boolean }>).every((c) => c.ok)).toBe(true);
    expect(review.recommendation).toMatch(/Looks ready/);
  });

  it("treats a draft with no sender of its own as sending from the tenant default", () => {
    const review = reviewDraft({
      subjectLine: "Year-End Garden Review",
      senderEmail: "",
      senderName: "",
      blocks: [{ id: "b1", type: "text", visible: true }],
      emailDomains: [northfieldDomain],
      readiness: northfieldReadiness,
    });
    const sender = (review.checks as Array<{ check: string; ok: boolean; detail: string }>).find(
      (c) => c.check === "Sender",
    );
    expect(sender).toEqual({
      check: "Sender",
      ok: true,
      detail: "Sends from your default sender, mail@northfieldgardens.ca.",
    });
    expect(review.recommendation).not.toMatch(/Set up the sender/);
  });

  it("blocks every draft when the tenant cannot send", () => {
    const unverified = { ...northfieldDomain, resend_status: { status: "pending" } };
    const review = reviewDraft({
      subjectLine: "Year-End Garden Review",
      senderEmail: "mail@northfieldgardens.ca",
      senderName: "Northfield Garden Center",
      blocks: [{ id: "b1", type: "text", visible: true }],
      emailDomains: [unverified],
      readiness: resolveTenantSendingReadiness({
        domains: [unverified],
        defaultDomainId: unverified.id,
      }),
    });
    const sender = (review.checks as Array<{ check: string; ok: boolean; detail: string }>).find(
      (c) => c.check === "Sender",
    );
    expect(sender?.ok).toBe(false);
    expect(sender?.detail).toMatch(/not fully verified/);
    expect(review.recommendation).toMatch(/Set up the sender/);
  });
});

// email_reachability_summary for Northfield in production (2026-11-26).
const northfieldReachability = {
  total: 9500,
  reachable: 0,
  waiting: 0,
  stopped: 1900,
  unsendable: 7600,
  asked_to_stop: 0,
  never_opted_in: 1900,
};

/** Supabase-like client: tables resolve to their rows, rpc to the given row. */
function sendingClient(reachability: unknown, rpcError: { message: string } | null = null) {
  const rpcCalls: Array<{ name: string; args: unknown }> = [];
  const eqCalls: Array<{ table: string; args: unknown[] }> = [];
  const tables: Record<string, unknown[]> = {
    email_domains: [northfieldDomain],
    tenants: [{ default_from_email_domain_id: northfieldDomain.id }],
  };
  return {
    rpcCalls,
    eqCalls,
    rpc: async (name: string, args: unknown) => {
      rpcCalls.push({ name, args });
      return { data: rpcError ? null : [reachability], error: rpcError };
    },
    from(table: string) {
      const rows = tables[table] ?? [];
      const builder: Record<string, unknown> = {};
      for (const method of ["select", "in", "order", "is"]) builder[method] = () => builder;
      builder.eq = (...args: unknown[]) => {
        eqCalls.push({ table, args });
        return builder;
      };
      builder.maybeSingle = async () => ({ data: rows[0] ?? null, error: null });
      builder.then = (resolve: (value: unknown) => unknown) =>
        Promise.resolve({ data: rows, error: null }).then(resolve);
      return builder;
    },
  };
}

function sendingContext(client: ReturnType<typeof sendingClient>): ToolExecutionContext {
  return {
    tenantId: "3eade43c-2e5a-4ad0-80fb-500e3d7afbd4",
    authenticatedTenantId: "3eade43c-2e5a-4ad0-80fb-500e3d7afbd4",
    userId: "user",
    conversationId: "conversation",
    messageId: "message",
    timezone: "America/Vancouver",
    dataClient: client,
    serviceClient: client,
  } as unknown as ToolExecutionContext;
}

describe("Bloom answers 'can I send campaigns' from sender AND reachability", () => {
  it("says Northfield's sender is set up but nobody can receive email", async () => {
    const client = sendingClient(northfieldReachability);
    const result = await getSendReadiness({}, sendingContext(client));
    expect(client.rpcCalls).toEqual([
      { name: "email_reachability_summary", args: { p_tenant_id: "3eade43c-2e5a-4ad0-80fb-500e3d7afbd4" } },
    ]);
    expect(client.eqCalls).toContainEqual({ table: "email_domains", args: ["tenant_id", "3eade43c-2e5a-4ad0-80fb-500e3d7afbd4"] });
    const data = result.data as Record<string, unknown>;
    expect(data.verdict).toBe("not_ready");
    expect(data.can_send_campaigns).toBe(false);
    expect(data.reason).toBe("NO_REACHABLE_CUSTOMERS");
    expect(data.sender).toMatchObject({
      status: "ready",
      domain: "northfieldgardens.ca",
      from_email: "mail@northfieldgardens.ca",
      domain_verified: true,
    });
    expect(data.reachability).toMatchObject({ total: 9500, reachable: 0, unsendable: 7600, waiting: 0, stopped: 1900, never_opted_in: 1900 });
    expect(result.message).toContain("northfieldgardens.ca");
    expect(result.message).toContain("mail@northfieldgardens.ca");
    expect(result.message).toContain("0 of 9,500 addresses can receive campaign email");
    expect(result.message).toContain("7,600 addresses can't receive email (invalid, bounced, suppressed or test addresses)");
    expect(result.message).toContain("1,900 addresses never opted in");
    expect(result.message).toContain("Verdict: NOT READY");
  });

  it("is ready only with a ready sender and someone reachable", () => {
    const counts = parseReachabilityRow({ ...northfieldReachability, reachable: 100, total: 9600 });
    expect(counts).not.toBeNull();
    expect(assessSendReadiness(northfieldReadiness, counts).verdict).toBe("ready");
    const noSender = resolveTenantSendingReadiness({ domains: [], defaultDomainId: null });
    expect(assessSendReadiness(noSender, counts)).toMatchObject({ verdict: "not_ready", reason: "SENDER_NOT_READY" });
    expect(assessSendReadiness(northfieldReadiness, null)).toMatchObject({ verdict: "unknown", canSendCampaigns: null });
  });

  it("never trusts counts that do not add up, and a failed check is unknown", async () => {
    expect(parseReachabilityRow({ ...northfieldReachability, unsendable: 1 })).toBeNull();
    const result = await getSendReadiness({}, sendingContext(sendingClient(null, { message: "denied" })));
    expect((result.data as Record<string, unknown>).verdict).toBe("unknown");
    expect(result.message).toContain("Do not say sending will work");
  });

  it("routes send-readiness questions to the tool", () => {
    expect(isSendReadinessQuestion("Is my email sender set up so I can send campaigns? And how many customers are in my VIP Buyers segment?")).toBe(true);
    expect(isSendReadinessQuestion("Can I send campaigns yet?")).toBe(true);
    expect(isSendReadinessQuestion("Will my newsletter reach anyone?")).toBe(true);
    expect(isSendReadinessQuestion("How many customers can I email?")).toBe(true);
    expect(isSendReadinessQuestion("How many customers are in my VIP Buyers segment?")).toBe(false);
    expect(isSendReadinessQuestion("What is my bounce rate?")).toBe(false);
    expect(getRegisteredTool("get_send_readiness")?.category).toBe("query");
    expect(BASE_SYSTEM_PROMPT).toContain("Never say sending will work, or that the user can send campaigns, unless get_send_readiness returned verdict ready");
  });

  it("removes a 'you can send' claim when nobody is reachable", async () => {
    const result = await getSendReadiness({}, sendingContext(sendingClient(northfieldReachability)));
    const outcome = toolOutcomeFrom("completed", result);
    const reply = correctSendReadinessReply(
      "Your email sender setup is in good condition, with a deliverability score of 100%. There have been no bounces or complaints in the last 30 days, so you should be able to send campaigns without issues.\n\nRegarding your \"VIP Buyers\" segment, it currently includes 900 customers.",
      [outcome],
    );
    expect(reply).not.toMatch(/should be able to send/);
    expect(reply).not.toMatch(/in good condition/);
    expect(reply).toContain("0 of 9,500 addresses can receive campaign email");
    expect(reply).toContain("900 customers");
    const honest = "Your sender is set up, but 0 of 9,500 customers can receive email, so a campaign would reach no one.";
    expect(correctSendReadinessReply(honest, [outcome])).toBe(honest);
  });
});
