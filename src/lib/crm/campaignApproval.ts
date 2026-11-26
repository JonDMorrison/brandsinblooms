/**
 * Campaign approval, as the database reports it.
 *
 * The database is the gate: it refuses to schedule or send an email that
 * needs approval and does not have it. Everything here only explains that
 * state to the person and offers the next step.
 */
export type CampaignApprovalState =
  | "not_required"
  | "draft"
  | "pending"
  | "changes_requested"
  | "approved"
  | "changed";

export interface CampaignApprovalReview {
  id: string;
  state: string;
  isCurrentVersion: boolean;
  recipientEstimate: number | null;
  submittedAt: string | null;
  submittedBy: string | null;
  submitNote: string | null;
  decidedAt: string | null;
  decidedBy: string | null;
  decisionNote: string | null;
  invalidatedReason: string | null;
}

export interface CampaignApprovalEvent {
  event: string;
  at: string;
  by: string | null;
  note: string | null;
}

export interface CampaignApproval {
  required: boolean;
  state: CampaignApprovalState;
  fingerprint: string;
  canSubmit: boolean;
  canApprove: boolean;
  canSend: boolean;
  review: CampaignApprovalReview | null;
  history: CampaignApprovalEvent[];
}

export interface CampaignApprovalSetting {
  required: boolean;
  canManage: boolean;
  canApprove: boolean;
  waiting: number;
}

const STATES: readonly CampaignApprovalState[] = [
  "not_required", "draft", "pending", "changes_requested", "approved", "changed",
];

const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
const text = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value : null);

export function parseCampaignApproval(value: unknown): CampaignApproval | null {
  const data = record(value);
  if (!data || typeof data.required !== "boolean") return null;
  const state = STATES.find((item) => item === data.state);
  if (!state) return null;
  const review = record(data.review);
  return {
    required: data.required,
    state,
    fingerprint: typeof data.fingerprint === "string" ? data.fingerprint : "",
    canSubmit: data.canSubmit === true,
    canApprove: data.canApprove === true,
    canSend: data.canSend === true,
    review: review && typeof review.id === "string"
      ? {
          id: review.id,
          state: typeof review.state === "string" ? review.state : "",
          isCurrentVersion: review.isCurrentVersion === true,
          recipientEstimate: typeof review.recipientEstimate === "number" ? review.recipientEstimate : null,
          submittedAt: text(review.submittedAt),
          submittedBy: text(review.submittedBy),
          submitNote: text(review.submitNote),
          decidedAt: text(review.decidedAt),
          decidedBy: text(review.decidedBy),
          decisionNote: text(review.decisionNote),
          invalidatedReason: text(review.invalidatedReason),
        }
      : null,
    history: (Array.isArray(data.history) ? data.history : []).flatMap((item) => {
      const entry = record(item);
      if (!entry || typeof entry.event !== "string" || typeof entry.at !== "string") return [];
      const detail = record(entry.detail);
      return [{ event: entry.event, at: entry.at, by: text(entry.by), note: text(detail?.note) ?? text(detail?.reason) }];
    }),
  };
}

export function parseCampaignApprovalSetting(value: unknown): CampaignApprovalSetting | null {
  const data = record(value);
  if (!data || typeof data.required !== "boolean") return null;
  return {
    required: data.required,
    canManage: data.canManage === true,
    canApprove: data.canApprove === true,
    waiting: typeof data.waiting === "number" ? data.waiting : 0,
  };
}

/** True when the database would refuse to schedule or send this email. */
export function approvalBlocksSending(approval: CampaignApproval | null | undefined): boolean {
  return Boolean(approval && approval.required && approval.state !== "approved");
}

export const APPROVAL_STATE_LABEL: Record<CampaignApprovalState, string> = {
  not_required: "No approval needed",
  draft: "Not sent for approval yet",
  pending: "Waiting for approval",
  changes_requested: "Changes requested",
  approved: "Approved",
  changed: "Changed since it was reviewed",
};

export function approvalStateMessage(approval: CampaignApproval): string {
  switch (approval.state) {
    case "not_required":
      return "";
    case "draft":
      return "This email needs approval before it can be scheduled or sent.";
    case "pending":
      return approval.review?.submittedBy
        ? `${approval.review.submittedBy} sent this for approval. It cannot be scheduled or sent until an approver approves it.`
        : "This email is waiting for approval. It cannot be scheduled or sent until an approver approves it.";
    case "changes_requested":
      return "The approver asked for changes. Make them, then send it for approval again.";
    case "approved":
      return approval.review?.decidedBy
        ? `${approval.review.decidedBy} approved this version. If the content, sender or audience changes, it needs approval again.`
        : "This version is approved. If the content, sender or audience changes, it needs approval again.";
    case "changed":
      return "This email was changed after it was reviewed. Send it for approval again.";
  }
}

export const APPROVAL_EVENT_LABEL: Record<string, string> = {
  submitted: "Sent for approval",
  approved: "Approved",
  changes_requested: "Changes requested",
  invalidated: "Approval no longer applies",
  withdrawn: "Sent again, earlier request closed",
  scheduled: "Scheduled",
  send_started: "Sending started",
};

/** The database's refusal, in the person's words. */
export function isApprovalRequiredError(error: unknown): boolean {
  const message = record(error)?.message;
  return typeof message === "string" && /campaign approval required/i.test(message);
}
