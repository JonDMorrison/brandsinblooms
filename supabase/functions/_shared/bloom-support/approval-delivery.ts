import { BloomError, directRpc } from "./runtime.ts";
import type { SendRequest } from "./email.ts";
export interface ApprovedReply {
  id: string; ticket_id: string; message_id: string | null; to_email: string;
  subject: string; text_body: string; html_body: string | null; status: string;
  sent_at: string | null; reviewer_active: boolean; ticket_valid: boolean; source_current: boolean;
}
/** A person approves a frozen primary-recipient payload, not a general send permission. */
export function bindApprovedReply(req: SendRequest, entry: ApprovedReply | null): SendRequest {
  const queueId = req.idempotencyKey.slice("approved:".length);
  if (!entry || entry.id !== queueId || entry.status !== "approved" || entry.sent_at
    || entry.reviewer_active !== true || entry.ticket_valid !== true || entry.source_current !== true
    || entry.ticket_id !== req.ticketId || entry.message_id !== (req.messageId ?? null)
    || entry.to_email.trim().toLowerCase() !== req.to.trim().toLowerCase()
    || !/^[^\s@,<>]+@[^\s@,<>]+\.[^\s@,<>]+$/.test(entry.to_email)
    || !entry.subject.trim() || /[\r\n]/.test(entry.subject) || !entry.text_body.trim()) {
    throw new BloomError(409, "approval_invalid", "The approved reply is no longer valid. Review the current ticket before sending.");
  }
  return { ...req, to: entry.to_email, subject: entry.subject, text: entry.text_body,
    html: entry.html_body, messageId: entry.message_id,
    // Never append recipients or mark later, unreviewed messages as delivered.
    cc: [], coveredMessageIds: [],
    // Explicit human review authorizes this one delivery even after takeover.
    // AI-authored content retains its automated-reply marker.
    bloomInitiated: false, humanAuthored: false,
  };
}
export async function prepareApprovedEmail(req: SendRequest): Promise<SendRequest> {
  if (!req.idempotencyKey.startsWith("approved:")) return req;
  const queueId = req.idempotencyKey.slice("approved:".length);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(queueId)) {
    throw new BloomError(400, "invalid", "Invalid reply approval identifier");
  }
  return bindApprovedReply(req, await directRpc<ApprovedReply | null>("bloom_support_fetch_approval_entry", { p_entry_id: queueId }));
}
