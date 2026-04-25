import { Receipt } from "lucide-react";

import type {
  LightspeedPagination,
  LightspeedSaleRow,
  LightspeedSalesSortField,
  LightspeedSalesSummary,
  LightspeedSortDirection,
} from "@/hooks/useIntegrationDetailData";

import {
  CopyValueButton,
  DataTabCard,
  DataTabEmptyState,
  DataTabPagination,
  EmptyValue,
  RawDataPre,
  SaleStatusBadge,
  SlideOverField,
  StatusFilterPills,
  TableSearchInput,
  TableSkeleton,
  ToolbarSelect,
  formatCurrency,
  formatDateTimeValue,
  formatDateValue,
  parseSaleLineItems,
  JoyDataTable,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/integrations/shared/dataTabPrimitives";

type SalesSortValue = "sale_date:desc" | "total_amount:desc" | "status:asc";
type SalesStatusValue = "all" | "completed" | "open";
type SalesDatePreset = "7d" | "30d" | "90d" | "all";

const SALES_SORT_OPTIONS = [
  { label: "Date (newest)", value: "sale_date:desc" },
  { label: "Total (high–low)", value: "total_amount:desc" },
  { label: "Status (A–Z)", value: "status:asc" },
] satisfies Array<{ label: string; value: SalesSortValue }>;

const SALES_STATUS_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Completed", value: "completed" },
  { label: "Open", value: "open" },
] satisfies Array<{ label: string; value: SalesStatusValue }>;

const SALES_DATE_PRESETS = [
  { label: "Last 7 days", value: "7d" },
  { label: "Last 30 days", value: "30d" },
  { label: "Last 90 days", value: "90d" },
  { label: "All time", value: "all" },
] satisfies Array<{ label: string; value: SalesDatePreset }>;

function getSortValue(
  field: LightspeedSalesSortField,
  direction: LightspeedSortDirection,
) {
  return `${field}:${direction}` as SalesSortValue;
}

function getPresetRange(preset: SalesDatePreset) {
  if (preset === "all") {
    return { startDate: null, endDate: null };
  }

  const today = new Date();
  const endDate = today.toISOString().slice(0, 10);
  const offset = preset === "7d" ? 6 : preset === "30d" ? 29 : 89;
  const start = new Date(today);
  start.setDate(today.getDate() - offset);

  return {
    startDate: start.toISOString().slice(0, 10),
    endDate,
  };
}

function getActivePreset(startDate: string, endDate: string) {
  for (const preset of SALES_DATE_PRESETS) {
    const range = getPresetRange(preset.value);
    if (
      (range.startDate ?? "") === startDate &&
      (range.endDate ?? "") === endDate
    ) {
      return preset.value;
    }
  }

  return null;
}

export function SalesTabView({
  connectionId: _connectionId,
  rows,
  pagination,
  summary,
  isLoading,
  isFetching,
  searchQuery,
  onSearchQueryChange,
  status,
  onStatusChange,
  startDate,
  endDate,
  onDateRangeChange,
  sortField,
  sortDirection,
  onSortChange,
  selectedSale,
  onSelectedSaleChange,
  onPageChange,
}: {
  connectionId: string;
  rows: LightspeedSaleRow[];
  pagination: LightspeedPagination;
  summary: LightspeedSalesSummary;
  isLoading: boolean;
  isFetching: boolean;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  status: SalesStatusValue;
  onStatusChange: (value: SalesStatusValue) => void;
  startDate: string;
  endDate: string;
  onDateRangeChange: (startDate: string, endDate: string) => void;
  sortField: LightspeedSalesSortField;
  sortDirection: LightspeedSortDirection;
  onSortChange: (
    field: LightspeedSalesSortField,
    direction: LightspeedSortDirection,
  ) => void;
  selectedSale: LightspeedSaleRow | null;
  onSelectedSaleChange: (sale: LightspeedSaleRow | null) => void;
  onPageChange: (page: number) => void;
}) {
  const sortValue = getSortValue(sortField, sortDirection);
  const activePreset = getActivePreset(startDate, endDate);
  const lineItems = parseSaleLineItems(selectedSale?.line_items);
  const showLoadingState = isLoading || (isFetching && rows.length === 0);

  if (showLoadingState) {
    return <TableSkeleton columns={6} rows={8} />;
  }

  return (
    <>
      <DataTabCard>
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-3">
          <TableSearchInput
            placeholder="Search sales..."
            value={searchQuery}
            onChange={onSearchQueryChange}
          />
          <div className="flex items-center gap-3">
            <StatusFilterPills
              options={SALES_STATUS_OPTIONS}
              value={status}
              onChange={onStatusChange}
            />
            <ToolbarSelect
              ariaLabel="Sort sales"
              value={sortValue}
              onChange={(value) => {
                const [field, direction] = value.split(":") as [
                  LightspeedSalesSortField,
                  LightspeedSortDirection,
                ];
                onSortChange(field, direction);
              }}
              options={SALES_SORT_OPTIONS}
            />
            <span className="text-xs tabular-nums text-muted-foreground">
              {pagination.totalCount.toLocaleString()} records
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-5 py-3">
          {SALES_DATE_PRESETS.map((preset) => {
            const isActive = activePreset === preset.value;
            return (
              <button
                key={preset.value}
                type="button"
                onClick={() => {
                  const nextRange = getPresetRange(preset.value);
                  onDateRangeChange(
                    nextRange.startDate ?? "",
                    nextRange.endDate ?? "",
                  );
                }}
                className={
                  isActive
                    ? "rounded-full bg-gray-900 px-3 py-1 text-xs font-medium text-white"
                    : "rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200"
                }
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-6 border-b border-gray-100 bg-gray-50 px-5 py-3">
          <div>
            <p className="text-xs text-muted-foreground">Total revenue</p>
            <p className="text-sm font-semibold tabular-nums">
              {formatCurrency(summary.revenue)}
            </p>
          </div>
          <div className="h-8 w-px bg-gray-200" />
          <div>
            <p className="text-xs text-muted-foreground">Avg. sale</p>
            <p className="text-sm font-semibold tabular-nums">
              {formatCurrency(summary.averageOrderValue)}
            </p>
          </div>
          <div className="h-8 w-px bg-gray-200" />
          <div>
            <p className="text-xs text-muted-foreground">Sales</p>
            <p className="text-sm font-semibold tabular-nums">
              {summary.saleCount.toLocaleString()}
            </p>
          </div>
        </div>

        {rows.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <JoyDataTable>
                <thead>
                  <tr className="border-b border-gray-100">
                    <th
                      className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                      style={{ width: "140px" }}
                    >
                      Sale ID
                    </th>
                    <th
                      className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                      style={{ width: "140px" }}
                    >
                      Date
                    </th>
                    <th
                      className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                      style={{ width: "120px" }}
                    >
                      Total
                    </th>
                    <th
                      className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                      style={{ width: "100px" }}
                    >
                      Status
                    </th>
                    <th
                      className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                      style={{ width: "200px" }}
                    >
                      Customer
                    </th>
                    <th
                      className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                      style={{ width: "80px" }}
                    >
                      Items
                    </th>
                    <th
                      className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                      style={{ width: "140px" }}
                    >
                      Payment
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((sale) => (
                    <tr
                      key={sale.id}
                      className="group cursor-pointer border-b border-gray-50 transition-colors hover:bg-gray-50"
                      onClick={() => onSelectedSaleChange(sale)}
                    >
                      <td className="px-5 py-3 text-sm text-foreground">
                        <div className="flex items-center gap-1.5 font-mono text-xs text-foreground">
                          <span className="max-w-[90px] truncate">
                            {sale.lightspeed_sale_id}
                          </span>
                          <span className="opacity-0 transition-opacity group-hover:opacity-100">
                            <CopyValueButton
                              value={sale.lightspeed_sale_id}
                              label="Sale ID"
                            />
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-sm text-foreground">
                        <div>{formatDateValue(sale.sale_date)}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatDateValue(sale.sale_date, "—", "h:mm a")}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right text-sm font-medium text-foreground">
                        {formatCurrency(sale.total_amount)}
                      </td>
                      <td className="px-5 py-3 text-sm text-foreground">
                        <SaleStatusBadge status={sale.status} />
                      </td>
                      <td className="px-5 py-3 text-sm text-foreground">
                        {sale.customerDisplayName ? (
                          sale.customerDisplayName
                        ) : (
                          <EmptyValue />
                        )}
                      </td>
                      <td className="px-5 py-3 text-center text-sm text-foreground">
                        {sale.lineItemCount}
                      </td>
                      <td className="px-5 py-3 text-sm text-foreground">
                        {sale.payment_method ?? <EmptyValue />}
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

        {!isLoading && !isFetching && rows.length === 0 ? (
          <DataTabEmptyState
            icon={Receipt}
            title="No sales match this view"
            description="Adjust the status, date range, or search term to see synced Lightspeed sales."
          />
        ) : null}
      </DataTabCard>

      <Sheet
        open={Boolean(selectedSale)}
        onOpenChange={() => onSelectedSaleChange(null)}
      >
        <SheetContent className="w-[420px] overflow-y-auto sm:w-[480px]">
          {selectedSale ? (
            <div className="space-y-4">
              <SheetHeader className="border-b border-gray-100 pb-4 text-left">
                <SheetTitle>Sale {selectedSale.lightspeed_sale_id}</SheetTitle>
                <SheetDescription className="sr-only">
                  Sale details, line items, and raw Lightspeed payload for{" "}
                  {selectedSale.lightspeed_sale_id}.
                </SheetDescription>
                <div className="mt-1 flex items-center gap-2">
                  <SaleStatusBadge status={selectedSale.status} />
                  <span className="text-xs text-muted-foreground">
                    {formatDateTimeValue(selectedSale.sale_date)}
                  </span>
                </div>
              </SheetHeader>

              <div className="space-y-2.5 border-b border-gray-100 py-4">
                <SlideOverField
                  label="Total"
                  value={formatCurrency(selectedSale.total_amount)}
                />
                <SlideOverField
                  label="Payment"
                  value={selectedSale.payment_method}
                />
                <SlideOverField
                  label="Customer ID"
                  value={selectedSale.lightspeed_customer_id}
                />
                <SlideOverField
                  label="Synced"
                  value={
                    selectedSale.synced_at
                      ? formatDateTimeValue(selectedSale.synced_at)
                      : null
                  }
                />
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Line items
                </p>
                {lineItems.length > 0 ? (
                  <div className="overflow-hidden rounded-lg border border-gray-100">
                    {lineItems.map((item, index) => (
                      <div
                        key={`${item.productId ?? item.name ?? "item"}-${index}`}
                        className="flex items-center justify-between border-b border-gray-50 px-3 py-2 last:border-0"
                      >
                        <span className="text-sm text-foreground">
                          {item.name ?? item.productId ?? "Unnamed item"}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground">
                            ×{item.quantity ?? 0}
                          </span>
                          <span className="text-sm font-medium">
                            {formatCurrency(item.unitPrice)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm italic text-muted-foreground">
                    No line items available
                  </p>
                )}
              </div>

              {selectedSale.note ? (
                <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm text-gray-700">
                  {selectedSale.note}
                </div>
              ) : null}

              <details className="py-2">
                <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground">
                  Raw Lightspeed data
                </summary>
                <RawDataPre value={selectedSale.raw_data} />
              </details>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
