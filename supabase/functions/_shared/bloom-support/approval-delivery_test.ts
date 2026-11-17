import { assertEquals, assertThrows } from "@std/assert";
import { bindApprovedReply, type ApprovedReply } from "./approval-delivery.ts";
import type { SendRequest } from "./email.ts";
const id = "00000000-0000-4000-8000-000000000001";
const entry: ApprovedReply = { id, ticket_id: "ticket", message_id: "message", to_email: "primary@example.test", subject: "Reviewed subject", text_body: "Reviewed text", html_body: null, status: "approved", sent_at: null, reviewer_active: true, ticket_valid: true, source_current: true };
const request: SendRequest = { ticketId: "ticket", messageId: "message", to: "primary@example.test", subject: "Changed subject", text: "Unreviewed new text", html: "<p>Changed</p>", cc: ["new-person@example.test"], coveredMessageIds: ["later-message"], purpose: "reply", idempotencyKey: `approved:${id}`, bloomInitiated: true, toClient: true };
Deno.test("approved delivery uses exactly the reviewed subject, body and primary recipient", () => {
  const result = bindApprovedReply(request, entry);
  assertEquals(result.subject, "Reviewed subject"); assertEquals(result.text, "Reviewed text"); assertEquals(result.html, null);
  assertEquals(result.cc, []); assertEquals(result.coveredMessageIds, []);
  assertEquals(result.bloomInitiated, false); assertEquals(result.humanAuthored, false);
  assertEquals(result.idempotencyKey, `approved:${id}`);
});
Deno.test("approval delivery rejects wrong identity, state, ticket, message, recipient or stale evidence", () => {
  for (const patch of [
    { id: "other" }, { status: "pending" }, { status: "rejected" }, { status: "sent" }, { sent_at: "2026-11-17" },
    { ticket_id: "other" }, { message_id: "other" }, { to_email: "another@example.test" }, { reviewer_active: false },
    { ticket_valid: false }, { source_current: false }, { subject: "Header\r\nInjected" }, { text_body: " " },
  ]) assertThrows(() => bindApprovedReply(request, { ...entry, ...patch }));
  assertThrows(() => bindApprovedReply(request, null));
});
