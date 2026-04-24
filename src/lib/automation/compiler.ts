import { Node, Edge } from "@xyflow/react";

export interface WorkflowStep {
  type: "email" | "sms";
  delayMin: number;
  subject?: string;
  text: string;
}

export interface FlowCompilationResult {
  steps: WorkflowStep[];
  warnings: string[];
  hasEmailSteps: boolean;
  hasSMSSteps: boolean;
}

function parseDelayToMinutes(delay: unknown): number {
  if (delay == null) return 0;
  if (typeof delay === "number" && !Number.isNaN(delay)) return delay;

  const raw = String(delay).trim();
  if (!raw) return 0;
  const s = raw.toLowerCase();

  if (s === "immediate" || s === "now" || s === "0") return 0;

  // Common compact formats from UI: 1h, 2h, 24h, 2d, 7d
  const compact = s.match(/^(-?\d+)\s*([mhd])$/);
  if (compact) {
    const value = Number(compact[1]);
    const unit = compact[2];
    if (Number.isNaN(value)) return 0;
    if (unit === "m") return value;
    if (unit === "h") return value * 60;
    if (unit === "d") return value * 60 * 24;
  }

  // Natural formats: "24 hours", "2 days", "15 minutes"
  const natural = s.match(
    /^(-?\d+)\s*(minute|minutes|min|m|hour|hours|hr|h|day|days|d)$/,
  );
  if (natural) {
    const value = Number(natural[1]);
    const unit = natural[2];
    if (Number.isNaN(value)) return 0;
    if (unit.startsWith("m")) return value;
    if (unit.startsWith("h")) return value * 60;
    if (unit.startsWith("d")) return value * 60 * 24;
  }

  return 0;
}

function parseDelayNodeMinutes(node: Node): number {
  const delayValue = Number(node.data?.delayValue) || 0;
  const delayUnit = String(node.data?.delayUnit || "hours");

  switch (delayUnit) {
    case "minutes":
      return delayValue;
    case "hours":
      return delayValue * 60;
    case "days":
      return delayValue * 60 * 24;
    case "weeks":
      return delayValue * 60 * 24 * 7;
    default:
      return delayValue * 60;
  }
}

/**
 * Compiles a React Flow graph into a linear sequence of workflow steps
 * @param flowState - The React Flow state with nodes and edges
 * @returns Compiled workflow steps with metadata
 */
export function compileFlow(flowState: {
  nodes: Node[];
  edges: Edge[];
}): FlowCompilationResult {
  const { nodes, edges } = flowState;
  const warnings: string[] = [];
  const steps: WorkflowStep[] = [];

  if (!nodes || nodes.length === 0) {
    warnings.push("No nodes found in flow");
    return { steps: [], warnings, hasEmailSteps: false, hasSMSSteps: false };
  }

  // Find trigger node (starting point)
  const triggerNode = nodes.find((node) => node.type === "trigger");
  if (!triggerNode) {
    warnings.push("No trigger node found - flow must start with a trigger");
    return { steps: [], warnings, hasEmailSteps: false, hasSMSSteps: false };
  }

  // Build adjacency map from edges
  const adjacencyMap = new Map<string, string[]>();
  edges.forEach((edge) => {
    if (!adjacencyMap.has(edge.source)) {
      adjacencyMap.set(edge.source, []);
    }
    adjacencyMap.get(edge.source)!.push(edge.target);
  });

  // Prefer a linear traversal: per-step delays are delta from the previous action.
  // If there are branches, pick the first path and warn.
  const visited = new Set<string>();
  let currentId: string | null = triggerNode.id;
  let delaySinceLastAction = 0;

  while (currentId) {
    if (visited.has(currentId)) break;
    visited.add(currentId);

    const node = nodes.find((n) => n.id === currentId);
    if (!node) break;

    if (node.type === "delay") {
      delaySinceLastAction += parseDelayNodeMinutes(node);
    } else if (node.type === "email") {
      const subject = String(
        node.data?.subject || node.data?.title || "Untitled Email",
      );
      const text = String(
        node.data?.body || node.data?.content || node.data?.message || "",
      );
      const nodeDelay = parseDelayToMinutes(node.data?.delay);

      if (!text.trim()) warnings.push(`Email node "${subject}" has no content`);

      steps.push({
        type: "email",
        delayMin: delaySinceLastAction + nodeDelay,
        subject,
        text,
      });

      delaySinceLastAction = 0;
    } else if (node.type === "sms") {
      const text = String(
        node.data?.content || node.data?.message || node.data?.text || "",
      );
      const nodeDelay = parseDelayToMinutes(node.data?.delay);

      if (!text.trim()) warnings.push(`SMS node has no content`);
      if (text.length > 160)
        warnings.push(`SMS message exceeds 160 characters (${text.length})`);

      steps.push({
        type: "sms",
        delayMin: delaySinceLastAction + nodeDelay,
        text,
      });

      delaySinceLastAction = 0;
    }

    const outgoing = adjacencyMap.get(currentId) || [];
    if (outgoing.length > 1) {
      warnings.push(
        `Node ${currentId} has ${outgoing.length} outgoing paths; compiler will follow the first path only`,
      );
    }
    currentId = outgoing[0] ?? null;
  }

  // Check for unvisited action nodes (disconnected nodes)
  const unvisitedActionNodes = nodes.filter(
    (node) =>
      !visited.has(node.id) && (node.type === "email" || node.type === "sms"),
  );

  if (unvisitedActionNodes.length > 0) {
    warnings.push(
      `${unvisitedActionNodes.length} action node(s) are not connected to the flow`,
    );
  }

  const hasEmailSteps = steps.some((step) => step.type === "email");
  const hasSMSSteps = steps.some((step) => step.type === "sms");

  if (steps.length === 0) {
    warnings.push("No email or SMS steps found in flow");
  }

  return {
    steps,
    warnings,
    hasEmailSteps,
    hasSMSSteps,
  };
}

/**
 * Validates that a compiled workflow meets basic requirements
 * @param compilation - The compilation result to validate
 * @returns Validation result with any blocking errors
 */
export function validateCompiledWorkflow(compilation: FlowCompilationResult): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (compilation.steps.length === 0) {
    errors.push("Workflow must contain at least one email or SMS step");
  }

  // Check for steps with empty content
  compilation.steps.forEach((step, index) => {
    if (!step.text.trim()) {
      errors.push(`Step ${index + 1} (${step.type}) has no content`);
    }

    if (step.type === "email" && !step.subject?.trim()) {
      errors.push(`Email step ${index + 1} has no subject`);
    }
  });

  // Check for negative delays (only allowed for birthday triggers)
  const hasNegativeDelays = compilation.steps.some((step) => step.delayMin < 0);
  if (hasNegativeDelays) {
    // This will be handled by the executor for birthday triggers
    // For now, just warn but don't block
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Creates a simple flow state for starter pack templates
 */
export function createStarterFlowState(
  triggerId: string,
  steps: WorkflowStep[],
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Create trigger node
  const triggerNode: Node = {
    id: "trigger-1",
    type: "trigger",
    position: { x: 100, y: 100 },
    data: {
      triggerType: triggerId,
      label: `Trigger: ${triggerId}`,
    },
  };
  nodes.push(triggerNode);

  let lastNodeId = triggerNode.id;
  let yPosition = 200;

  // Create nodes for each step
  steps.forEach((step, index) => {
    const stepNodeId = `${step.type}-${index + 1}`;

    // Add delay node if there's a delay
    if (step.delayMin > 0) {
      const delayNodeId = `delay-${index + 1}`;
      const delayNode: Node = {
        id: delayNodeId,
        type: "delay",
        position: { x: 100, y: yPosition },
        data: {
          delayValue: Math.floor(step.delayMin / 60), // Convert to hours for display
          delayUnit: "hours",
        },
      };
      nodes.push(delayNode);

      // Connect last node to delay
      edges.push({
        id: `${lastNodeId}-${delayNodeId}`,
        source: lastNodeId,
        target: delayNodeId,
      });

      lastNodeId = delayNodeId;
      yPosition += 100;
    }

    // Create step node
    const stepNode: Node = {
      id: stepNodeId,
      type: step.type,
      position: { x: 100, y: yPosition },
      data:
        step.type === "email"
          ? {
              subject: step.subject,
              body: step.text,
            }
          : {
              content: step.text,
            },
    };
    nodes.push(stepNode);

    // Connect to step
    edges.push({
      id: `${lastNodeId}-${stepNodeId}`,
      source: lastNodeId,
      target: stepNodeId,
    });

    lastNodeId = stepNodeId;
    yPosition += 100;
  });

  return { nodes, edges };
}
