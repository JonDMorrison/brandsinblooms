import { describe, expect, it, vi } from "vitest";
import {
  generateConversationTitle,
  resolveConversationTitleSubject,
  sanitizeGeneratedTitle,
  subjectTitle,
} from "../../supabase/functions/bloom-assist/conversation-title";

const REVIEW_PROMPT =
  "Review this campaign's performance and suggest what to improve next time.";

const modelReply = (title: string) =>
  vi.fn(
    async () =>
      new Response(
        JSON.stringify({ choices: [{ message: { content: title } }] }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
  );

describe("Bloom conversation titles", () => {
  it("names the focused campaign, so two campaigns never share a title", async () => {
    const titles = await Promise.all(
      ["Spring Sale", "Mother's Day Roses"].map((name) =>
        generateConversationTitle({
          message: REVIEW_PROMPT,
          subject: resolveConversationTitleSubject(
            { entityType: "campaign", name },
            REVIEW_PROMPT,
          ),
          openAiApiKey: null,
        }),
      ),
    );

    expect(titles).toEqual([
      "Spring Sale: Performance Review",
      "Mother's Day Roses: Performance Review",
    ]);
    expect(new Set(titles).size).toBe(2);
  });

  it("keeps a model title that carries the record's name", async () => {
    const fetchImpl = modelReply("Spring Sale campaign results review");
    const title = await generateConversationTitle({
      message: REVIEW_PROMPT,
      subject: { entityType: "campaign", name: "Spring Sale" },
      openAiApiKey: "synthetic-key",
      fetchImpl,
    });

    expect(title).toBe("Spring Sale campaign results review");
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as {
      messages: Array<{ role: string; content: string }>;
    };
    expect(body.messages[0].content).toContain('"Spring Sale"');
  });

  it("replaces a generic model title that drops the name with a grounded one", async () => {
    const title = await generateConversationTitle({
      message: REVIEW_PROMPT,
      subject: { entityType: "campaign", name: "Spring Sale" },
      openAiApiKey: "synthetic-key",
      fetchImpl: modelReply("Campaign Performance Review and Improvements"),
    });

    expect(title).toBe("Spring Sale: Performance Review");
  });

  it("falls back to the grounded title when the model call fails", async () => {
    const title = await generateConversationTitle({
      message: "Who is in this segment?",
      subject: { entityType: "segment", name: "Lapsed VIPs" },
      openAiApiKey: "synthetic-key",
      fetchImpl: vi.fn(async () => new Response("down", { status: 503 })),
    });

    expect(title).toBe("Lapsed VIPs: Audience");
  });

  it("uses a record the first message names when nothing is on screen", () => {
    const message =
      "Explain the purchase behavior of customer Ada Lovelace using Customer Intelligence.";
    const subject = resolveConversationTitleSubject(null, message);

    expect(subject).toEqual({ entityType: "customer", name: "Ada Lovelace" });
    expect(subjectTitle(subject!, message)).toBe(
      "Ada Lovelace: Purchase Behavior",
    );
  });

  it("prefers the on-screen record over a name in the message", () => {
    expect(
      resolveConversationTitleSubject(
        { entityType: "campaign", name: "Spring Sale" },
        'How does the "Fall Bulbs" campaign compare?',
      ),
    ).toEqual({ entityType: "campaign", name: "Spring Sale" });
  });

  it("keeps the old behaviour when no record is involved", async () => {
    expect(
      await generateConversationTitle({
        message: "how do I import customers from a spreadsheet",
        openAiApiKey: null,
      }),
    ).toBe("How Do I Import Customers From");
    expect(sanitizeGeneratedTitle("  ", "hello there")).toBe("Hello There");
  });
});
