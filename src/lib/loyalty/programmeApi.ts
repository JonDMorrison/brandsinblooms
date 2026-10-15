import { supabase } from "@/integrations/supabase/client";
import { toSafeCsvValue } from "@/lib/crm/customerExport";
import type { ProgrammeDraft } from "../../../supabase/functions/_shared/loyalty/programme-planning";
import type {
  ProgrammeResult,
  ProgrammeBaseline,
  CustomerPeriod,
} from "../../../supabase/functions/_shared/loyalty/programme-measurement";
import type { CalendarImportPreview } from "../../../supabase/functions/_shared/loyalty/calendar-import";

export interface ProgrammeSummary {
  id: string;
  name: string;
  status: string;
  current_version_id: string;
  created_at: string;
  updated_at: string;
}
export interface ProgrammeDetail {
  programme: ProgrammeSummary;
  version: {
    id: string;
    programme_id: string;
    version_number: number;
    definition: ProgrammeDraft;
    definition_hash: string;
  };
  baselines: {
    id: string;
    programme_version_id: string;
    source_cutoff: string;
    created_at: string;
    audience: { name: string; count: number | null };
  }[];
  baselineLimit: number;
}
export interface BaselinePreview {
  previewId: string;
  digest: string;
  expiresAt: string;
  versionId: string;
  baseline: ProgrammeBaseline;
  audience: {
    name: string;
    customerCount: number;
    excludedCount: number;
    unknownCount: number;
    definition: unknown;
    notes: string[];
  };
  page: number;
  hasMore: boolean;
}
export interface ProgrammeResultPage {
  runId: string;
  baselineId?: string;
  result: ProgrammeResult & { page: number; count: number; hasMore: boolean };
}
export interface CalendarReview {
  previewId: string;
  digest: string;
  expiresAt: string;
  preview: CalendarImportPreview & { page: number; hasMore: boolean };
}
export interface PreviewPage<T> {
  previewId: string;
  rows: T[];
  count: number;
  page: number;
  hasMore: boolean;
  digest: string;
  expiresAt: string;
}
export type BaselinePreviewPage = PreviewPage<CustomerPeriod>;
export async function programmeCommand<T>(
  tenantId: string,
  command: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(
    "loyalty-programmes",
    { body: { ...command, expectedTenantId: tenantId } },
  );
  if (error) {
    let message = "The programme operation could not be completed.";
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      const payload: unknown = await context
        .clone()
        .json()
        .catch(() => null);
      if (
        payload &&
        typeof payload === "object" &&
        "error" in payload &&
        typeof payload.error === "string"
      )
        message = payload.error;
    } else if (error.message) message = error.message;
    throw new Error(message);
  }
  if (!data || data.tenantId !== tenantId)
    throw new Error("The workspace changed. Reload before continuing.");
  return data as T;
}
export function downloadProgrammeData(
  filename: string,
  content: string,
  type = "application/json",
): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function programmeResultCsv(
  rows: ProgrammeResult["rows"],
  currency: string,
): string {
  const columns: (keyof ProgrammeResult["rows"][number])[] = [
    "customerId",
    "state",
    "baselineSpendMinor",
    "currentSpendMinor",
    "baselineTransactions",
    "currentTransactions",
    "spendChangePercent",
    "transactionChangePercent",
    "growthChangePercent",
    "growthIndex",
    "reason",
    "baselineEvidenceIds",
    "currentEvidenceIds",
    "missingOrderIds",
    "otherCurrencyOrders",
    "receivedCampaign",
    "purchasedAfterMessage",
    "postMessageSpendMinor",
  ];
  const header = [...columns, "currency", "moneyUnit"];
  return (
    "\uFEFF" +
    [
      header.map(toSafeCsvValue).join(","),
      ...rows.map((row) =>
        [...columns.map((key) => row[key]), currency, "integer minor units"]
          .map(toSafeCsvValue)
          .join(","),
      ),
    ].join("\r\n")
  );
}
