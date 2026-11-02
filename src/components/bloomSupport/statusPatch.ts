import type { SupportStatus, TicketDetail } from "@/lib/bloomSupport/api";
import type { AskField, AskOptions, AskValues } from "./useAskDialog";

type Ask = (opts: AskOptions) => Promise<AskValues | null>;

export const WAITING_OPTIONS = [
  { value: "customer", label: "Waiting on the client" },
  { value: "internal", label: "Waiting on our team" },
  { value: "third_party", label: "Waiting on another company", hint: "e.g. a payment or POS provider" },
  { value: "deployment", label: "Waiting for a fix to go live" },
  { value: "scheduled", label: "Scheduled for later" },
];

const str = (v: unknown) => String(v ?? "").trim();

/** Collects what each status needs in one friendly form; resolves null if the person cancels. */
export async function statusPatch(ask: Ask, t: TicketDetail, v: SupportStatus): Promise<Record<string, unknown> | null> {
  if (v === "waiting") {
    const r = await ask({ title: "Waiting on whom?", fields: [{ name: "reason", label: "Waiting on", kind: "select", required: true, initial: "customer", options: WAITING_OPTIONS }], confirmLabel: "Set to waiting" });
    return r ? { status: "waiting", waiting_reason: str(r.reason) } : null;
  }
  if (v === "needs_owner") {
    const r = await ask({
      title: "Ask Jon or Jeff to decide",
      fields: [
        { name: "decision", label: "What needs deciding?", kind: "textarea", required: true },
        { name: "who", label: "Who decides?", kind: "select", required: true, initial: "both", options: [{ value: "jon", label: "Jon" }, { value: "jeff", label: "Jeff" }, { value: "both", label: "Either of them" }] },
        { name: "rec", label: "What do you recommend? (optional)", kind: "textarea" },
      ],
      confirmLabel: "Send for a decision",
    });
    if (!r) return null;
    return { status: "needs_owner", decision_needed: str(r.decision), accountable: str(r.who) || "both", recommendation: str(r.rec) || undefined };
  }
  if (v === "resolved") {
    const fields: AskField[] = [
      { name: "summary", label: t.kind === "feature" ? "What should the client know?" : "What fixed it?", kind: "textarea", required: true, helper: t.kind === "feature" ? "It was passed on for a product decision, not built yet." : "This is sent to the client." },
    ];
    if (t.kind === "change") fields.push({ name: "verified", label: "How did you check the change is saved?", kind: "text", required: true, placeholder: "e.g. Checked the live page" });
    if (t.kind === "bug" || t.kind === "incident") {
      fields.push({ name: "verified", label: "How did you check it works now?", kind: "text", required: true, placeholder: "e.g. Placed a test order on the live site" });
      if (!t.engineering_issue_id) fields.push({ name: "no_deploy", label: "No code fix is linked. Why? (optional)", kind: "text", placeholder: "e.g. It was a settings change" });
    }
    const r = await ask({ title: "Mark as solved", fields, confirmLabel: "Mark solved" });
    if (!r) return null;
    const evidence: Record<string, unknown> = {};
    if (t.kind === "change") evidence.verified_note = str(r.verified);
    if (t.kind === "bug" || t.kind === "incident") {
      evidence.verification = { passed: true, note: str(r.verified) };
      if (!t.engineering_issue_id) evidence.no_deploy_reason = str(r.no_deploy);
    }
    return { status: "resolved", resolution_summary: str(r.summary), resolution_evidence: evidence };
  }
  return { status: v };
}
