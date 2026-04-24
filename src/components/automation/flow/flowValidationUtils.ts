import type { Edge, Node } from "@xyflow/react";
import { getTriggerById } from "@/lib/automation/triggerCatalog";
import type { FlowValidationSummary } from "@/components/automation/flow/automationBuilderTypes";

type AudienceSelection = Array<{ id: string | number }>;

export type FlowValidationResult = FlowValidationSummary;

export type LaunchChecklistItem = {
  id: string;
  label: string;
  completed: boolean;
};

export function validateFlow(
  nodes: Node[],
  edges: Edge[],
  selectedSegments: AudienceSelection = [],
  selectedPersonas: AudienceSelection = [],
): FlowValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const triggerNodes = nodes.filter((node) => node.type === "trigger");
  const actionNodes = nodes.filter((node) =>
    ["email", "sms"].includes(node.type ?? ""),
  );

  if (triggerNodes.length === 0) {
    errors.push("Add a trigger to start the automation.");
  }

  if (triggerNodes.length > 1) {
    errors.push("Use only one trigger per automation.");
  }

  if (actionNodes.length === 0) {
    errors.push("Add at least one message action.");
  }

  if (nodes.length > 1 && edges.length === 0) {
    errors.push("Connect your steps before launching.");
  }

  const triggerNode = triggerNodes[0];
  const triggerType = (
    triggerNode?.data as { triggerType?: string } | undefined
  )?.triggerType;
  const triggerMeta = triggerType ? getTriggerById(triggerType) : null;
  const requiresAudience = triggerMeta?.audienceType === "batch";

  if (
    requiresAudience &&
    selectedSegments.length === 0 &&
    selectedPersonas.length === 0
  ) {
    errors.push(
      "Select at least one audience filter before launching this automation.",
    );
  }
  if (triggerType === "segment.added" && selectedSegments.length === 0) {
    errors.push("Pick a segment for the selected segment trigger.");
  }
  if (triggerType === "persona.assigned" && selectedPersonas.length === 0) {
    errors.push("Pick a persona for the selected persona trigger.");
  }

  nodes.forEach((node) => {
    if (node.type === "email") {
      const data = node.data as
        | { subject?: string; content?: string }
        | undefined;
      if (!data?.subject?.trim()) {
        warnings.push("An email step is missing a subject line.");
      }
      if (!data?.content?.trim()) {
        warnings.push("An email step is missing message content.");
      }
    }
    if (node.type === "sms") {
      const data = node.data as
        | { content?: string; message?: string }
        | undefined;
      if (!(data?.message?.trim() || data?.content?.trim())) {
        warnings.push("An SMS step is missing message content.");
      }
    }
  });

  return { errors, warnings };
}

export function getLaunchChecklistItems(
  nodes: Node[],
  edges: Edge[],
  selectedSegments: AudienceSelection = [],
  selectedPersonas: AudienceSelection = [],
): LaunchChecklistItem[] {
  const triggerNodes = nodes.filter((node) => node.type === "trigger");
  const actionNodes = nodes.filter((node) =>
    ["email", "sms"].includes(node.type ?? ""),
  );
  const triggerNode = triggerNodes[0];
  const triggerType = (
    triggerNode?.data as { triggerType?: string } | undefined
  )?.triggerType;
  const triggerMeta = triggerType ? getTriggerById(triggerType) : null;
  const requiresAudience = triggerMeta?.audienceType === "batch";
  const hasAudience =
    selectedSegments.length > 0 || selectedPersonas.length > 0;
  const allNodesConnected =
    nodes.length > 1 &&
    nodes.every((node) => {
      const hasInbound = edges.some((edge) => edge.target === node.id);
      const outboundEdges = edges.filter((edge) => edge.source === node.id);

      if (node.type === "trigger") {
        return outboundEdges.length > 0;
      }

      if (node.type === "split") {
        return hasInbound && outboundEdges.length > 0;
      }

      return hasInbound;
    });

  return [
    {
      id: "trigger",
      label: "Trigger configured",
      completed: triggerNodes.length === 1,
    },
    {
      id: "actions",
      label: "At least one action",
      completed: actionNodes.length > 0,
    },
    {
      id: "connections",
      label: "All nodes connected",
      completed: allNodesConnected,
    },
    {
      id: "audience",
      label: "Audience configured",
      completed:
        triggerNodes.length === 1 && (!requiresAudience || hasAudience),
    },
  ];
}
