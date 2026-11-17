/**
 * Slack action tool calling (Prompt 3).
 *
 * Staff can execute a small set of safe, ticket-scoped actions directly from
 * Slack ticket threads by mentioning @Bloom with an action phrase. This keeps
 * lightweight triage in Slack while ensuring consequential work (approvals,
 * closures, customer messages) stays in the authenticated dashboard.
 *
 * Authorization: the caller's principal_id and role are verified by the
 * conversation context RPC before this module is called. Only ticket threads
 * support actions; other routes remain read-only.
 *
 * Safe actions (reversible, audit-trailed, no customer-visible side effects):
 *   claim       — claim the ticket and pause Bloom automation
 *   hold        — pause Bloom automation without claiming
 *   resume      — resume Bloom automation (reverts a hold)
 *   waiting     — mark ticket as waiting (pauses auto-escalation)
 *
 * The dashboard remains the required path for:
 *   - Resolving / closing tickets (requires evidence confirmation)
 *   - Approving or discarding operations (requires visual review)
 *   - Sending customer-facing messages (requires human review)
 *   - Assigning tickets to other staff members
 */

export type SlackAction =
  | { kind: "claim" }
  | { kind: "hold" }
  | { kind: "resume" }
  | { kind: "waiting"; reason: string };

/** Returns the action Bloom should execute, or null for a read-only question. */
export function detectSlackAction(text: string): SlackAction | null {
  if (!text || text.length > 2000) return null;
  const t = text.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();

  // Claim / take ownership
  if (/\b(take\s+this|i.?ll\s+(?:handle|take|pick\s+up)\s+this|assign\s+(?:this\s+)?to\s+me|claim\s+this|i.?m\s+on\s+this|i.?ve\s+got\s+this)\b/.test(t)) {
    return { kind: "claim" };
  }
  // Pause automation without claiming
  if (/\b(pause\s+bloom|hold\s+(?:off|on)|stop\s+bloom|disable\s+auto(?:mation)?|pause\s+auto(?:mation)?|hold\s+bloom)\b/.test(t)) {
    return { kind: "hold" };
  }
  // Resume automation
  if (/\b(resume\s+bloom|re-?enable\s+auto(?:mation)?|unpause\s+bloom|let\s+bloom\s+(?:continue|handle|take\s+over)|bloom\s+can\s+(?:continue|handle|take\s+over))\b/.test(t)) {
    return { kind: "resume" };
  }
  // Mark waiting
  if (/\b(mark(?:ing)?\s+(?:as\s+)?waiting|waiting\s+on\s+(?:client|customer|them)|set\s+(?:to\s+)?waiting|put\s+(?:on\s+)?hold)\b/.test(t)) {
    const reasonMatch = /waiting\s+on\s+(.{3,80})/.exec(t);
    const reason = reasonMatch ? reasonMatch[1].replace(/\b(bloom|auto)\b/gi, "").trim() : "awaiting reply";
    return { kind: "waiting", reason };
  }
  return null;
}

/** Human-readable description of what an action will do — shown in the confirmation. */
export function describeAction(action: SlackAction): string {
  switch (action.kind) {
    case "claim": return "Claim this ticket and pause Bloom automation so you can handle it directly.";
    case "hold": return "Pause Bloom automation on this ticket. You can resume it any time.";
    case "resume": return "Resume Bloom automation on this ticket.";
    case "waiting": return `Mark this ticket as waiting${action.reason ? ` (${action.reason})` : ""}. Auto-escalation is paused until there is a reply.`;
  }
}

export interface ActionResult {
  ok: boolean;
  message: string;
}

export type ActionRpc = (name: string, args: Record<string, unknown>) => Promise<unknown>;

/** Execute an authorized Slack action. Returns a human-readable outcome. */
export async function executeSlackAction(
  action: SlackAction,
  context: { principalId: string; ticketId: string; jobId: string; slackUserId: string },
  rpc: ActionRpc,
): Promise<ActionResult> {
  const { principalId, ticketId, jobId } = context;
  const dedupeKey = `slack-action:${action.kind}:${ticketId}:${jobId}`;
  try {
    switch (action.kind) {
      case "claim": {
        await rpc("claim_ticket", {
          actor: principalId,
          ticket_id: ticketId,
          dedupe_key: dedupeKey,
        });
        await rpc("set_automation", {
          actor: principalId,
          ticket_id: ticketId,
          mode: "paused",
          reason: "Claimed via Slack",
        });
        return { ok: true, message: "Done — this ticket is now yours. Bloom has stepped back. The full conversation and evidence are in Bloom Support." };
      }
      case "hold": {
        await rpc("set_automation", {
          actor: principalId,
          ticket_id: ticketId,
          mode: "paused",
          reason: "Paused via Slack",
        });
        return { ok: true, message: "Bloom automation paused. The ticket stays open and all evidence is preserved. Say *resume Bloom* in this thread when you're ready." };
      }
      case "resume": {
        await rpc("set_automation", {
          actor: principalId,
          ticket_id: ticketId,
          mode: "auto",
          reason: "Resumed via Slack",
        });
        return { ok: true, message: "Bloom automation resumed. It will pick up where it left off based on the current ticket state." };
      }
      case "waiting": {
        await rpc("update_ticket", {
          actor: principalId,
          ticket_id: ticketId,
          patch: {
            status: "waiting",
            waiting_reason: action.reason.slice(0, 200),
            next_action: `Waiting: ${action.reason.slice(0, 180)}`,
          },
        });
        return { ok: true, message: `Ticket marked as waiting${action.reason ? ` — ${action.reason}` : ""}. Auto-escalation is paused. It will re-activate when the client replies.` };
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Surface auth and not-found errors clearly; wrap others generically
    if (/not_found|not found/i.test(msg)) return { ok: false, message: "That ticket couldn't be found. It may have been merged or closed." };
    if (/unauthorized|forbidden|not_allowed/i.test(msg)) return { ok: false, message: "You don't have permission to change this ticket. Use the dashboard to adjust your access." };
    return { ok: false, message: "I couldn't complete that action right now. Nothing was changed. Try again or use the dashboard." };
  }
}

/** Returns true when the route/channel and role support action execution. */
export function slackActionsAllowed(route: string, role: string): boolean {
  // Actions only run in ticket threads, not in general channels or non-staff contexts
  return route === "tickets" && /^(platform_admin|platform_operator|support)/.test(role);
}
