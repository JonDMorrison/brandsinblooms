/**
 * An automation can only run when its flow has a trigger node. The database
 * enforces this too (public.crm_automations_require_trigger); this mirrors it
 * so the list can say "Needs setup" and refuse to activate before saving.
 */
type FlowNodeLike = { type?: unknown };

export const AUTOMATION_NEEDS_TRIGGER_MESSAGE =
  "Add a trigger to this automation before turning it on.";

export function flowHasTrigger(flowState: unknown): boolean {
  if (!flowState || typeof flowState !== "object" || Array.isArray(flowState)) {
    return false;
  }
  const nodes = (flowState as { nodes?: unknown }).nodes;
  return (
    Array.isArray(nodes) &&
    nodes.some(
      (node) =>
        Boolean(node) &&
        typeof node === "object" &&
        (node as FlowNodeLike).type === "trigger",
    )
  );
}

export type ActivationCheck =
  | { canActivate: true }
  | { canActivate: false; reason: string };

export function checkAutomationActivation(flowState: unknown): ActivationCheck {
  return flowHasTrigger(flowState)
    ? { canActivate: true }
    : {
        canActivate: false,
        reason: AUTOMATION_NEEDS_TRIGGER_MESSAGE,
      };
}
