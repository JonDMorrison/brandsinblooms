export type CreateFlowMode = "seasonal" | "holiday" | "custom";

export type CreateFlowGoal = "traffic" | "sales" | "awareness" | "none";

export type CreateFlowChannelKey = "newsletter";

export interface CreateFlowRetryDraft {
  path: CreateFlowMode;
  sourceId: string | null;
  title: string;
  goal?: CreateFlowGoal;
  tone?: string;
  notes?: string;
  channels: Record<CreateFlowChannelKey, boolean>;
}
