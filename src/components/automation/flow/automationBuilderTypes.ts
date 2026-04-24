import type { Edge, Node } from "@xyflow/react";
import type { FlowCompilationResult } from "@/lib/automation/compiler";
import type {
  TargetingPersona,
  TargetingSegment,
} from "@/hooks/usePersonaSegmentIntegration";

export type AutomationNodeType =
  | "trigger"
  | "email"
  | "sms"
  | "delay"
  | "split";

export interface TriggerNodeData {
  triggerType: string;
  label: string;
  description?: string;
  overlapBehavior?: string;
  conditions?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface EmailNodeData {
  subject?: string;
  content?: string;
  body?: string;
  message?: string;
  template?: string;
  delay?: string;
  imageUrl?: string;
  imageMetadata?: unknown;
  editable?: boolean;
  [key: string]: unknown;
}

export interface SMSNodeData {
  content?: string;
  message?: string;
  characterCount?: number;
  editable?: boolean;
  [key: string]: unknown;
}

export interface DelayNodeData {
  delayValue: number;
  delayUnit: "minutes" | "hours" | "days" | "weeks";
  description?: string;
  editable?: boolean;
  [key: string]: unknown;
}

export interface SplitCondition {
  label: string;
  condition: string;
}

export interface SplitNodeData {
  splitType: "conditional" | "ab_test" | "random";
  conditionField?: string;
  conditionOperator?: string;
  conditionValue?: string;
  description?: string;
  conditions?: SplitCondition[];
  editable?: boolean;
  [key: string]: unknown;
}

export type AutomationNodeData =
  | TriggerNodeData
  | EmailNodeData
  | SMSNodeData
  | DelayNodeData
  | SplitNodeData
  | Record<string, unknown>;

export type AutomationCanvasNode = Node<AutomationNodeData>;

export interface AutomationFlowState {
  nodes: AutomationCanvasNode[];
  edges: Edge[];
}

export interface PersistedAutomationEdge extends Partial<Edge> {
  from?: string;
  to?: string;
}

export interface AutomationLaunchPayload {
  name: string;
  triggerType: string;
  flowSteps: AutomationCanvasNode[];
  workflowSteps: FlowCompilationResult["steps"];
  selectedAudience: {
    personas: TargetingPersona[];
    segments: TargetingSegment[];
    totalContacts: number;
  };
  flowState: AutomationFlowState;
  compilation: FlowCompilationResult;
}

export interface FlowValidationSummary {
  errors: string[];
  warnings: string[];
}

export type AutomationNodeEditorHandler = (
  nodeId: string,
  nodeType: AutomationNodeType,
  nodeData: AutomationNodeData,
) => void;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isAutomationFlowState(
  value: unknown,
): value is AutomationFlowState {
  if (!isRecord(value)) {
    return false;
  }

  return Array.isArray(value.nodes) && Array.isArray(value.edges);
}
