import { FlaskConical } from "lucide-react";
import { Chip, Typography } from "@mui/joy";

import { Button } from "@/components/ui-legacy/button";
import type {
  CloverConnectionTestHistoryRow,
  CloverConnectionTestReport,
  LightspeedPagination,
} from "@/hooks/useIntegrationDetailData";

import {
  DataTabEmptyState,
  DataTabLoadingState,
  DataTabPagination,
  JoyDataTable,
  formatDateTimeValue,
  formatRelativeTimestamp,
} from "@/components/integrations/shared/dataTabPrimitives";

import { CloverTestReport } from "./CloverTestReport";

function StatusChip({ status }: { status: CloverConnectionTestReport["status"] }) {
  if (status === "success") {
    return <Chip size="sm" color="success" variant="soft">Success</Chip>;
  }

  if (status === "partial") {
    return <Chip size="sm" color="warning" variant="soft">Partial</Chip>;
  }

  return <Chip size="sm" color="danger" variant="soft">Failed</Chip>;
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
            Run the existing Clover diagnostics harness to verify merchant access and endpoint coverage.
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
            <div className="overflow-x-auto">
              <JoyDataTable>
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Summary</th>
                    <th>Merchant</th>
                    <th>Errors</th>
                    <th>Duration</th>
                    <th>Tested</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <StatusChip status={row.report.status} />
                      </td>
                      <td>
                        <Typography level="body-sm" sx={{ maxWidth: 360 }}>
                          {row.report.summary}
                        </Typography>
                      </td>
                      <td>
                        <Typography level="body-sm" sx={{ fontFamily: "var(--joy-fontFamily-code)" }}>
                          {row.merchant_id}
                        </Typography>
                      </td>
                      <td>
                        <Typography level="body-sm" color={row.report.errors.length > 0 ? "danger" : "neutral"}>
                          {row.report.errors.length}
                        </Typography>
                      </td>
                      <td>
                        <Typography level="body-sm">{row.report.duration_ms}ms</Typography>
                      </td>
                      <td>
                        <Typography level="body-sm">{formatRelativeTimestamp(row.created_at)}</Typography>
                        <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
                          {formatDateTimeValue(row.created_at)}
                        </Typography>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </JoyDataTable>
            </div>
            <DataTabPagination
              pagination={pagination}
              onPageChange={onPageChange}
            />
          </>
        ) : null}

        {isLoading || isFetching ? <DataTabLoadingState /> : null}

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
