import { AnalyticsResultCard } from "@/components/bloom/content/cards/AnalyticsResultCard";
import { CampaignResultCard } from "@/components/bloom/content/cards/CampaignResultCard";
import { CustomerResultCard } from "@/components/bloom/content/cards/CustomerResultCard";
import { ExportResultCard } from "@/components/bloom/content/cards/ExportResultCard";
import { GenericResultCard } from "@/components/bloom/content/cards/GenericResultCard";
import { InventoryResultCard } from "@/components/bloom/content/cards/InventoryResultCard";
import { OrderResultCard } from "@/components/bloom/content/cards/OrderResultCard";
import {
  duplicateDisplayResult,
  exportResultMetadata,
  inferEntityFromToolName,
  isRecord,
  normalizeToolResult,
  readString,
} from "@/components/bloom/content/cards/cardUtils";
import { BloomErrorCard } from "@/components/bloom/content/BloomErrorCard";
import type { BloomErrorIssue } from "@/components/bloom/content/BloomErrorCard";

export interface BloomToolResultCardProps {
  blockType?: string | null;
  count?: number | null;
  data: unknown;
  error?: string | null;
  message?: string | null;
  onAction?: (prompt: string) => void;
  onRetry?: () => void;
  status?:
    | "success"
    | "error"
    | "pending"
    | "executing"
    | "completed"
    | "failed"
    | null;
  toolName?: string | null;
}

function extractValidationIssues(data: unknown): BloomErrorIssue[] | undefined {
  const rawIssues = Array.isArray(data)
    ? data
    : isRecord(data) && Array.isArray(data.issues)
      ? data.issues
      : null;
  if (!rawIssues) {
    return undefined;
  }

  const issues = rawIssues
    .map((entry): BloomErrorIssue | null => {
      if (!isRecord(entry)) {
        return null;
      }
      const message = readString(entry.message);
      if (!message) {
        return null;
      }
      return { path: readString(entry.path), message };
    })
    .filter((entry): entry is BloomErrorIssue => entry !== null);

  return issues.length > 0 ? issues : undefined;
}

export function BloomToolResultCard({
  blockType,
  count,
  data,
  error,
  message,
  onAction,
  onRetry,
  status,
  toolName,
}: BloomToolResultCardProps) {
  const normalizedResult = normalizeToolResult({
    blockType,
    count,
    data,
    error,
    message,
    status,
    toolName,
  });
  const result = duplicateDisplayResult(normalizedResult) ?? normalizedResult;

  if (result.status === "error") {
    return (
      <BloomErrorCard
        issues={extractValidationIssues(result.data)}
        message={
          result.error ??
          result.message ??
          "Bloom could not retrieve this result."
        }
        onRetry={onRetry}
      />
    );
  }

  if (exportResultMetadata(result)) {
    return <ExportResultCard onAction={onAction} result={result} />;
  }

  const route = inferEntityFromToolName(result.toolName);
  if (route === "customer") {
    return <CustomerResultCard result={result} />;
  }
  if (route === "campaign") {
    return <CampaignResultCard result={result} />;
  }
  if (route === "product") {
    return <InventoryResultCard result={result} />;
  }
  if (route === "order") {
    return <OrderResultCard result={result} />;
  }
  if (route === "analytics" || result.blockType === "stat_card") {
    return <AnalyticsResultCard result={result} />;
  }

  return <GenericResultCard result={result} />;
}
