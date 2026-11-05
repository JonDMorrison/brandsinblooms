import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  base64ByteLength,
  buildTimeline,
  displayHost,
  formatSupportHours,
  presentStatus,
  safeHttpsUrl,
  sanitizeTrackView,
  type TrackMessage,
  type TrackView,
  validateTrackReply,
} from "@/lib/bloomSupport/trackView";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const at = (minute: number) => new Date(Date.UTC(2026, 10, 5, 17, minute)).toISOString();

function message(n: number, over: Partial<TrackMessage> & Record<string, unknown> = {}): Record<string, unknown> {
  return { id: id(n), author: "team", name: "Bloom Support", automatic: false, purpose: "reply", body: `message ${n}`, created_at: at(n), attachments: [], ...over };
}

function rawView(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    state: "ok", number: 1015, subject: "Import history", product: "crm", kind: "idea", status: "in_progress", step: 2,
    progress: "We are working on this.", created_at: at(0), last_activity_at: at(3), resolved_at: null, resolution_summary: null,
    confirmed: false, merged_into_number: null, requester_name: "Jon", company: { name: "Brands in Blooms", logo_url: "https://cdn.example.test/logo.png", website: "www.brandsinblooms.com", internal: "x" }, can_reply: true,
    can_confirm: false, can_reopen: false, reply_expected_by: null,
    support_hours: { days: [1, 2, 3, 4, 5], start: "09:00", end: "17:00", timezone: "America/Toronto" },
    link_expires_at: at(59), attachments: [],
    messages: [
      message(0, { author: "customer", name: "Jon", purpose: null }),
      message(1, { automatic: true, purpose: "acknowledgement", body: "Thanks — we've received your request (#1015)." }),
      message(2, { automatic: true, purpose: "progress", body: "We've passed it to the team for a decision." }),
    ],
    ...over,
  };
}

const ok = (raw: unknown): TrackView => {
  const view = sanitizeTrackView(raw);
  if (!view || view.state !== "ok") throw new Error("expected a ticket view");
  return view;
};

describe("tracking page server filter (sanitizeTrackView)", () => {
  it("never passes through internal statuses, stages, owners or unknown fields", () => {
    const view = ok(rawView({
      status: "needs_owner", stage: "awaiting_decision", owner: { name: "Jeff" }, next_action: "Jon to decide",
      internal_notes: ["Needs Jon/Jeff"], requester: { email: "jon@example.test" }, tags: ["vip"],
    }));
    const text = JSON.stringify(view);
    expect(view.status).toBe("in_progress");
    for (const leak of ["needs_owner", "awaiting_decision", "Jeff", "Jon to decide", "Needs Jon/Jeff", "jon@example.test", "vip"]) {
      expect(text).not.toContain(leak);
    }
    expect(Object.keys(view).sort()).toEqual([
      "attachments", "can_confirm", "can_reopen", "can_reply", "company", "confirmed", "created_at", "kind", "last_activity_at",
      "link_expires_at", "merged_into_number", "messages", "number", "product", "progress", "reply_expected_by", "requester_name",
      "resolution_summary", "resolved_at", "state", "status", "step", "subject", "support_hours",
    ]);
  });

  it("drops messages that are not one of the public roles and never shows staff names", () => {
    const view = ok(rawView({
      messages: [
        message(0, { author: "customer", name: "Gail Green", purpose: "acknowledgement" }),
        message(1, { author: "staff", name: "Sam", body: "Internal: rotate SMTP creds", visibility: "internal" }),
        message(2, { author: "internal", body: "triage: engineering repair #4295" }),
        message(3, { author: "team", name: "Sam Support", body: "We restarted the send.", visibility: "internal", email: "sam@x.test" }),
        message(4, { author: "team", id: "not-a-uuid" }),
      ],
    }));
    expect(view.messages.map((m) => m.body)).toEqual(["message 0", "We restarted the send."]);
    expect(view.messages[0]).toMatchObject({ author: "customer", name: "Gail Green", purpose: null, automatic: false });
    expect(view.messages[1].name).toBe("Bloom Support");
    const text = JSON.stringify(view);
    expect(text).not.toContain("SMTP");
    expect(text).not.toContain("Sam");
    expect(text).not.toContain("visibility");
    expect(text).not.toContain("sam@x.test");
  });

  it("keeps resolution details only when resolved and refuses writes that do not match the state", () => {
    const open = ok(rawView({ resolution_summary: "draft summary", can_confirm: true, can_reopen: true, resolved_at: at(9) }));
    expect(open.resolution_summary).toBeNull();
    expect(open.resolved_at).toBeNull();
    expect(open.can_confirm || open.can_reopen).toBe(false);
    const done = ok(rawView({ status: "resolved", step: 2, resolution_summary: "Fixed", resolved_at: at(9), can_reply: true, can_confirm: true }));
    expect(done.step).toBe(4);
    expect(done.can_reply).toBe(false);
    expect(done.can_confirm).toBe(true);
  });

  it("shows only https company logo and website, upgrading a bare domain", () => {
    expect(ok(rawView()).company).toEqual({ name: "Brands in Blooms", logo_url: "https://cdn.example.test/logo.png", website: "https://www.brandsinblooms.com/" });
    for (const bad of ["javascript:alert(1)", "http://plain.example.com", "https://user:pw@evil.test", "data:image/png;base64,AAAA", "https://10.0.0.1/x", "not a url", "//evil.test/x"]) {
      expect(safeHttpsUrl(bad)).toBeNull();
      expect(ok(rawView({ company: { name: "X", logo_url: bad, website: bad } })).company).toEqual({ name: "X", logo_url: null, website: null });
    }
    expect(ok(rawView({ company: null })).company).toBeNull();
    expect(displayHost("https://www.brandsinblooms.com/")).toBe("brandsinblooms.com");
  });

  it("passes the expired state through and rejects anything else", () => {
    expect(sanitizeTrackView({ state: "expired", number: 1015, subject: "secret" })).toEqual({ state: "expired" });
    expect(sanitizeTrackView(null)).toBeNull();
    expect(sanitizeTrackView({ messages: [] })).toBeNull();
    expect(sanitizeTrackView([rawView()])).toBeNull();
  });

  it("the database projection filters visibility server-side, not in the page", () => {
    const sql = readFileSync(resolve(__dirname, "../../supabase/migrations/20261105210000_bloom_support_tracking_page.sql"), "utf8");
    expect(sql).toMatch(/m\.visibility = 'public' AND m\.direction <> 'internal' AND m\.withdrawn_at IS NULL/);
    expect(sql).toMatch(/a\.visibility = 'public'/);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.bloom_support_track\(text, text, jsonb\) FROM PUBLIC, anon, authenticated/);
    expect(sql).not.toMatch(/'status', t\.status/);
  });
});

describe("timeline", () => {
  it("collapses consecutive automatic acknowledgements into one quiet event", () => {
    const view = ok(rawView());
    const items = buildTimeline(view.messages);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ type: "message" });
    expect(items[1]).toMatchObject({ type: "event", title: "We received your request", count: 2, details: ["We've passed it to the team for a decision."] });
  });

  it("keeps written replies, questions and anything with a file as full messages", () => {
    const view = ok(rawView({
      messages: [
        message(1, { automatic: true, purpose: "acknowledgement" }),
        message(2, { automatic: true, purpose: "clarification", body: "Which page?" }),
        message(3, { automatic: true, purpose: "progress", attachments: [{ id: id(9), file_name: "log.txt", content_type: "text/plain", size_bytes: 3 }] }),
        message(4, { automatic: true, purpose: "progress", body: "Still on it" }),
        message(5, { automatic: true, purpose: "progress", body: "Still on it" }),
      ],
    }));
    const items = buildTimeline(view.messages);
    expect(items.map((i) => i.type)).toEqual(["event", "message", "message", "event"]);
    expect(items[3]).toMatchObject({ title: "Update from Bloom Support", details: ["Still on it"], count: 2 });
  });
});

describe("plain-language status", () => {
  it("maps every client status to a headline and four steps", () => {
    expect(presentStatus({ status: "received", kind: "fix", confirmed: false, merged_into_number: null }).headline).toBe("We've got your request");
    expect(presentStatus({ status: "in_progress", kind: "fix", confirmed: false, merged_into_number: null })).toMatchObject({
      headline: "We're working on it", steps: ["Received", "Looking into it", "Fixing", "Resolved"],
    });
    expect(presentStatus({ status: "waiting_on_you", kind: "help", confirmed: false, merged_into_number: null })).toMatchObject({ tone: "action" });
    expect(presentStatus({ status: "resolved", kind: "help", confirmed: false, merged_into_number: null }).tone).toBe("success");
    expect(presentStatus({ status: "in_progress", kind: "idea", confirmed: false, merged_into_number: null }).headline).toBe("We're reviewing your idea");
    expect(presentStatus({ status: "in_progress", kind: "help", confirmed: false, merged_into_number: 1020 }).headline).toContain("#1020");
  });

  it("formats support hours", () => {
    expect(formatSupportHours({ days: [1, 2, 3, 4, 5], start: "09:00", end: "17:00", timezone: "America/Toronto" }))
      .toBe("Monday to Friday, 9am to 5pm (Toronto time)");
    expect(formatSupportHours(null)).toBeNull();
  });
});

describe("reply validation", () => {
  const key = "abcdef12-3456";
  it("accepts a normal reply and trims it", () => {
    expect(validateTrackReply({ body: "  It is still stuck.  ", idempotency_key: key })).toEqual({
      ok: true, value: { body: "It is still stuck.", idempotency_key: key, attachments: [] },
    });
  });
  it("rejects empty, oversized and keyless replies", () => {
    expect(validateTrackReply({ body: " ", idempotency_key: key }).ok).toBe(false);
    expect(validateTrackReply({ body: "x".repeat(5001), idempotency_key: key }).ok).toBe(false);
    expect(validateTrackReply({ body: "hello", idempotency_key: "bad key!" }).ok).toBe(false);
    expect(validateTrackReply("hello").ok).toBe(false);
  });
  it("limits attachments by count and size", () => {
    const small = { file_name: "a.png", content_type: "image/png", data_base64: "iVBORw0KGgo=" };
    expect(validateTrackReply({ body: "see file", idempotency_key: key, attachments: [small] }).ok).toBe(true);
    expect(validateTrackReply({ body: "see file", idempotency_key: key, attachments: [small, small, small, small] }).ok).toBe(false);
    const big = { ...small, data_base64: "A".repeat(Math.ceil((8 * 1024 * 1024 + 4) / 3) * 4) };
    expect(validateTrackReply({ body: "see file", idempotency_key: key, attachments: [big] })).toEqual({ ok: false, error: "Files must be 8 MB or smaller." });
    expect(validateTrackReply({ body: "see file", idempotency_key: key, attachments: [{ file_name: "a.png" }] }).ok).toBe(false);
    expect(base64ByteLength("iVBORw0KGgo=")).toBe(8);
  });
});
