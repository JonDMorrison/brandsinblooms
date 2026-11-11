import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20261107011102_enterprise_bloom_support_reliability_v2.sql",
  "utf8",
);
const addMessage = migration.slice(migration.indexOf("CREATE OR REPLACE FUNCTION bloom_support.add_message"));

describe("human-owned Bloom Support replies", () => {
  it("moves an active human conversation to Needs You and alerts its owner", () => {
    expect(addMessage).toContain("ELSIF t.automation = 'auto' AND t.executor = 'bloom' THEN");
    expect(addMessage).toContain("status = 'needs_owner', stage = 'escalated', pending_review = 'client_reply_human'");
    expect(addMessage).toContain("waiting_reason = NULL, waiting_since = NULL");
    expect(addMessage).toContain("next_action = 'Reply to the client'");
    expect(addMessage).toContain("'ticket.client_reply_needs_owner'");
    expect(addMessage).toContain("'client-reply-needs-owner:' || m.id::text");
  });

  it("clears Needs You only after a public staff reply", () => {
    expect(addMessage).toContain("IF v_kind = 'staff' AND v_vis = 'public' THEN");
    expect(addMessage).toContain("IF t.pending_review = 'client_reply_human' THEN");
    expect(addMessage).toContain("status = 'working', stage = 'answering', pending_review = NULL");
    expect(addMessage).toContain("'ticket.client_reply_answered'");
  });

  it("keeps Bloom-owned replies on the automated triage lane", () => {
    const automated = addMessage.slice(
      addMessage.indexOf("ELSIF t.automation = 'auto' AND t.executor = 'bloom' THEN"),
      addMessage.indexOf("ELSE\n      UPDATE bloom_support.tickets", addMessage.indexOf("ELSIF t.automation = 'auto' AND t.executor = 'bloom' THEN")),
    );
    expect(automated).toContain("bloom_support.enqueue_job('triage'");
    expect(automated).not.toContain("pending_review = 'client_reply_human'");
  });
});
