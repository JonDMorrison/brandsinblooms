import { describe, expect, it } from "vitest";
import {
  mapCampaign,
  reviewDraft,
  toReviewableBlock,
} from "../../supabase/functions/bloom-assist/tools/implementations/query-campaigns";

// Shapes taken from Northfield drafts in production (2026-11-24).
const northfieldDomain = {
  domain: "northfieldgardens.ca",
  default_from_email: null,
  status: "active" as const,
};

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
    });
    const checks = review.checks as Array<{ check: string; ok: boolean; detail: string }>;
    expect(checks.find((c) => c.check === "Subject line")?.ok).toBe(false);
    expect(checks.find((c) => c.check === "Content")?.detail).toMatch(/Add an image or remove this image block/);
    expect(checks.find((c) => c.check === "Sender")?.ok).toBe(false);
    expect(review.recommendation).toMatch(/subject line/i);
  });

  it("recommends sending when every check passes", () => {
    const review = reviewDraft({
      subjectLine: "Your 2026 garden, in review",
      senderEmail: "mail@northfieldgardens.ca",
      senderName: "Northfield Garden Center",
      blocks: [{ id: "b1", type: "text", visible: true }],
      emailDomains: [northfieldDomain],
    });
    expect((review.checks as Array<{ ok: boolean }>).every((c) => c.ok)).toBe(true);
    expect(review.recommendation).toMatch(/Looks ready/);
  });
});
