import { FlaskConical } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type {
  CloverConnectionTestHistoryRow,
  CloverConnectionTestReport,
  LightspeedPagination,
} from "@/hooks/useIntegrationDetailData";

import {
  DataTabEmptyState,
  DataTabPagination,
  formatDateTimeValue,
  formatRelativeTimestamp,
} from "@/components/integrations/shared/dataTabPrimitives";

import { CloverTestReport } from "./CloverTestReport";

function getStatusClasses(status: CloverConnectionTestReport["status"]) {
  switch (status) {
    case "success":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "partial":
      return "bg-amber-50 text-amber-800 border-amber-200";
    default:
      return "bg-rose-50 text-rose-700 border-rose-200";
  }
}

export function ConnectionTestTabView({
  rows,
  latestReport,
  latestTestedAt,
  pagination,
  isLoading,
  isFetching,
  isRunning,
  onRunTest,
  onPageChange,
}: {
  rows: CloverConnectionTestHistoryRow[];
  latestReport: CloverConnectionTestReport | null;
  latestTestedAt: string | null;
  pagination: LightspeedPagination;
  isLoading: boolean;
  isFetching: boolean;
  isRunning: boolean;
  onRunTest: () => void;
  onPageChange: (page: number) => void;
}) {
  const hasRows = rows.length > 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-foreground">
            Clover connection diagnostics
          </div>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Run the existing Clover diagnostics harness to verify merchant
            access and endpoint coverage.
          </p>
        </div>
        <Button type="button" onClick={onRunTest} disabled={isRunning}>
          <FlaskConical className="mr-2 h-4 w-4" />
          {isRunning ? "Running test..." : "Run Connection Test"}
        </Button>
      </div>

      {latestReport ? (
        <CloverTestReport
          report={latestReport}
          testedAt={latestTestedAt}
          onRerun={onRunTest}
          isRunning={isRunning}
        />
      ) : null}

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <p className="text-sm font-semibold">Recent test runs</p>
          <span className="text-xs text-muted-foreground">
            {pagination.totalCount.toLocaleString()} results
          </span>
        </div>

        {hasRows ? (
          <>
            <div className="divide-y divide-gray-50">
              {rows.map((row) => (
                <div
                  key={row.id}
                  className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={getStatusClasses(row.report.status)}>
                        {row.report.status === "partial"
                          ? "Partial"
                          : row.report.status === "success"
                            ? "Success"
                            : "Failed"}
                      </Badge>
                      <span className="font-medium text-foreground">
                        {row.report.summary}
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground">
                      Merchant {row.merchant_id} • {row.report.errors.length}{" "}
                      errors • {row.report.duration_ms}ms
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground sm:text-right">
                    <div>{formatRelativeTimestamp(row.created_at)}</div>
                    <div className="mt-1 text-xs">
                      {formatDateTimeValue(row.created_at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <DataTabPagination
              pagination={pagination}
              onPageChange={onPageChange}
            />
          </>
        ) : null}

        {isLoading || isFetching ? (
          <div className="px-5 py-10 text-sm text-muted-foreground">
            Loading Clover connection tests...
          </div>
        ) : null}

        {!isLoading && !isFetching && !hasRows ? (
          <DataTabEmptyState
            icon={FlaskConical}
            title="No Clover connection tests yet"
            description="Run the Clover diagnostics harness to capture endpoint coverage and sample results for this merchant connection."
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onRunTest}
              >
                <FlaskConical className="mr-1.5 h-3.5 w-3.5" />
                Run first test
              </Button>
            }
          />
        ) : null}
      </div>
    </div>
  );
}
