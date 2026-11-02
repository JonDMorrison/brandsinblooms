import type { SupportStatus, TicketDetail, WaitingReason } from "@/lib/bloomSupport/api";

/** Collects what each status needs; returns null if the person cancels. */
export function statusPatch(t: TicketDetail, v: SupportStatus): Record<string, unknown> | null {
  if (v === "waiting") {
    const r = window.prompt("Waiting on: customer, internal, third_party, deployment or scheduled", "customer") as WaitingReason | null;
    return r ? { status: "waiting", waiting_reason: r } : null;
  }
  if (v === "needs_owner") {
    const decision = window.prompt("What decision is needed from Jon/Jeff?");
    if (!decision) return null;
    const who = window.prompt("Who decides: jon, jeff or both?", "both") ?? "both";
    const rec = window.prompt("Your recommended next step (optional)") ?? undefined;
    return { status: "needs_owner", decision_needed: decision, accountable: who, recommendation: rec };
  }
  if (v === "resolved") {
    const summary = window.prompt(t.kind === "feature" ? "Summary for the client (it was routed for a product decision — not delivered)" : "What resolved it? (sent to the client)");
    if (!summary) return null;
    const evidence: Record<string, unknown> = {};
    if (t.kind === "change") {
      const note = window.prompt("How did you verify the saved change? (e.g. checked the live page)");
      if (!note) return null;
      evidence.verified_note = note;
    }
    if (t.kind === "bug" || t.kind === "incident") {
      const note = window.prompt("How did you verify the affected flow works now?");
      if (!note) return null;
      evidence.verification = { passed: true, note };
      if (!t.engineering_issue_id) evidence.no_deploy_reason = window.prompt("No code deployment linked — why? (e.g. configuration fix)") ?? "";
    }
    return { status: "resolved", resolution_summary: summary, resolution_evidence: evidence };
  }
  return { status: v };
}
