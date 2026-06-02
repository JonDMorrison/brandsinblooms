export type BloomBlockActionType = "download" | "link" | "navigate" | "prompt";

export type BloomBlockAction = {
  label: string;
  prompt: string;
  type?: BloomBlockActionType;
  url?: string;
  downloadFileName?: string;
  icon?: string;
};

export type JoyBlockTone =
  | "primary"
  | "neutral"
  | "success"
  | "warning"
  | "danger";

export type DataCardEntityType =
  | "customer"
  | "product"
  | "campaign"
  | "segment";

export type DataColumnType =
  | "text"
  | "currency"
  | "date"
  | "status"
  | "number"
  | "percentage";

export type SortDirection = "asc" | "desc";

export type DataTableColumn = {
  key: string;
  label: string;
  sortable?: boolean;
  type?: DataColumnType;
};

export type BloomBlockItem = {
  id: string;
  blockType: string;
  payload: unknown;
  text: string | null;
  position: number | null;
};

export type BloomBlockActionContext = Record<string, unknown>;

export type StatChangeDirection = "up" | "down" | "flat";

export type StatMetric = {
  key: string;
  label: string;
  value: string;
  rawValue?: number | null;
  changeLabel?: string | null;
  changeDirection?: StatChangeDirection | null;
  icon?: string;
};

export type ChartType = "line" | "bar" | "area" | "pie";

export type ChartSeriesKey = {
  key: string;
  label: string;
};

export type ChartDatum = Record<string, unknown>;

export type InsightSeverity = "info" | "success" | "warning" | "danger";

export type InsightItem = {
  id: string;
  severity: InsightSeverity;
  title: string;
  description: string;
  actions: BloomBlockAction[];
};

export type ConfirmationResultStatus =
  | "completed"
  | "failed"
  | "skipped"
  | "blocked"
  | "pending";

export type ConfirmationResultItem = {
  id: string;
  taskId: string | null;
  toolName: string | null;
  status: ConfirmationResultStatus;
  message: string;
  errorMessage: string | null;
  route: string | null;
  executionTimeMs: number | null;
};

export type ConfirmationSummary = {
  planId: string | null;
  completed: number;
  skipped: number;
  failed: number;
  blocked: number;
};

export type ConfirmationDetailsBlock = {
  action: string;
  affectedCount: number | null;
  reversible: boolean | null;
  riskLevel: JoyBlockTone;
  toolName: string | null;
};

export type NavigationBlockTarget = {
  label: string;
  path: string;
  target: string | null;
  entityId: string | null;
  description: string | null;
  autoNavigate: boolean;
};
