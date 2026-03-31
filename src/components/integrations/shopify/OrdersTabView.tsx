import { useState } from "react";
import { Receipt } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type {
  LightspeedPagination,
  LightspeedSortDirection,
  ShopifyOrderTableRow,
  ShopifyOrdersSortField,
  ShopifySalesSummary,
} from "@/hooks/useIntegrationDetailData";

import {
  CopyValueButton,
  DataTabEmptyState,
  DataTabPagination,
  EmptyValue,
  RawDataPre,
  SlideOverField,
  StatusFilterPills,
  TableSearchInput,
  ToolbarSelect,
  formatCurrency,
  formatDateTimeValue,
  formatDateValue,
  parseSaleLineItems,
} from "@/components/integrations/shared/dataTabPrimitives";

type OrdersSortValue =
  | "order_date:desc"
  | "total_price:desc"
  | "financial_status:asc"
  | "fulfillment_status:asc";
type OrdersStatusValue = "all" | "paid" | "pending" | "refunded";
type OrdersDatePreset = "7d" | "30d" | "90d" | "all";

const ORDER_SORT_OPTIONS = [
  { label: "Newest first", value: "order_date:desc" },
  { label: "Highest total", value: "total_price:desc" },
  { label: "Financial status", value: "financial_status:asc" },
  { label: "Fulfillment status", value: "fulfillment_status:asc" },
] satisfies Array<{ label: string; value: OrdersSortValue }>;

const ORDER_STATUS_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Paid", value: "paid" },
  { label: "Pending", value: "pending" },
  { label: "Refunded", value: "refunded" },
] satisfies Array<{ label: string; value: OrdersStatusValue }>;

const ORDER_DATE_PRESETS = [
  { label: "Last 7 days", value: "7d" },
  { label: "Last 30 days", value: "30d" },
  { label: "Last 90 days", value: "90d" },
  { label: "All time", value: "all" },
] satisfies Array<{ label: string; value: OrdersDatePreset }>;

function getSortValue(
  field: ShopifyOrdersSortField,
  direction: LightspeedSortDirection,
) {
  return `${field}:${direction}` as OrdersSortValue;
}

function getPresetRange(preset: OrdersDatePreset) {
  if (preset === "all") {
    return { startDate: "", endDate: "" };
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
  for (const preset of ORDER_DATE_PRESETS) {
    const range = getPresetRange(preset.value);
    if (range.startDate === startDate && range.endDate === endDate) {
      return preset.value;
    }
  }

  return null;
}

function getStatusBadgeClass(status?: string | null) {
  const normalized = (status ?? "unknown").toLowerCase();

  if (normalized === "paid" || normalized === "fulfilled") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (normalized === "pending" || normalized === "partially_fulfilled") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (normalized === "refunded" || normalized === "cancelled") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

export function OrdersTabView({
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
  onPageChange,
}: {
  rows: ShopifyOrderTableRow[];
  pagination: LightspeedPagination;
  summary: ShopifySalesSummary;
  isLoading: boolean;
  isFetching: boolean;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  startDate: string;
  endDate: string;
  onDateRangeChange: (startDate: string, endDate: string) => void;
  sortField: ShopifyOrdersSortField;
  sortDirection: LightspeedSortDirection;
  onSortChange: (
    field: ShopifyOrdersSortField,
    direction: LightspeedSortDirection,
  ) => void;
  onPageChange: (page: number) => void;
}) {
  const [selectedOrder, setSelectedOrder] =
    useState<ShopifyOrderTableRow | null>(null);
  const sortValue = getSortValue(sortField, sortDirection);
  const activePreset = getActivePreset(startDate, endDate);
  const lineItems = parseSaleLineItems(selectedOrder?.line_items);

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-3">
          <TableSearchInput
            placeholder="Search orders..."
            value={searchQuery}
            onChange={onSearchQueryChange}
          />
          <div className="flex flex-wrap items-center gap-3">
            <StatusFilterPills
              options={ORDER_STATUS_OPTIONS}
              value={status as OrdersStatusValue}
              onChange={(value) => onStatusChange(value)}
            />
            <ToolbarSelect
              ariaLabel="Sort Shopify orders"
              value={sortValue}
              onChange={(value) => {
                const [field, direction] = value.split(":") as [
                  ShopifyOrdersSortField,
                  LightspeedSortDirection,
                ];
                onSortChange(field, direction);
              }}
              options={ORDER_SORT_OPTIONS}
            />
            <span className="text-xs tabular-nums text-muted-foreground">
              {pagination.totalCount.toLocaleString()} records
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-5 py-3">
          {ORDER_DATE_PRESETS.map((preset) => {
            const isActive = activePreset === preset.value;
            return (
              <button
                key={preset.value}
                type="button"
                onClick={() => {
                  const nextRange = getPresetRange(preset.value);
                  onDateRangeChange(nextRange.startDate, nextRange.endDate);
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
            <p className="text-xs text-muted-foreground">Avg. order</p>
            <p className="text-sm font-semibold tabular-nums">
              {formatCurrency(summary.averageOrderValue)}
            </p>
          </div>
          <div className="h-8 w-px bg-gray-200" />
          <div>
            <p className="text-xs text-muted-foreground">Orders</p>
            <p className="text-sm font-semibold tabular-nums">
              {summary.saleCount.toLocaleString()}
            </p>
          </div>
        </div>

        {rows.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] border-collapse">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Order
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Date
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Total
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Financial
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Fulfillment
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Customer
                    </th>
                    <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Items
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((order) => (
                    <tr
                      key={order.id}
                      className="cursor-pointer border-b border-gray-50 transition-colors hover:bg-gray-50"
                      onClick={() => setSelectedOrder(order)}
                    >
                      <td className="px-5 py-3 text-sm text-foreground">
                        <div className="font-medium">
                          #{order.order_number ?? order.shopify_order_id}
                        </div>
                        <div className="font-mono text-xs text-muted-foreground">
                          {order.shopify_order_id}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-sm text-foreground">
                        <div>{formatDateValue(order.order_date)}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatDateValue(order.order_date, "-", "h:mm a")}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right text-sm font-medium text-foreground">
                        {formatCurrency(Number(order.total_price ?? 0))}
                      </td>
                      <td className="px-5 py-3 text-sm text-foreground">
                        <Badge
                          className={getStatusBadgeClass(
                            order.financial_status,
                          )}
                        >
                          {order.financial_status ?? "unknown"}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-sm text-foreground">
                        <Badge
                          className={getStatusBadgeClass(
                            order.fulfillment_status,
                          )}
                        >
                          {order.fulfillment_status ?? "unfulfilled"}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-sm text-foreground">
                        {order.customerDisplayName ?? order.email ?? (
                          <EmptyValue />
                        )}
                      </td>
                      <td className="px-5 py-3 text-center text-sm text-foreground">
                        {order.lineItemCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <DataTabPagination
              pagination={pagination}
              onPageChange={onPageChange}
            />
          </>
        ) : null}

        {isLoading || isFetching ? (
          <div className="px-5 py-10 text-sm text-muted-foreground">
            Loading orders...
          </div>
        ) : null}

        {!isLoading && !isFetching && rows.length === 0 ? (
          <DataTabEmptyState
            icon={Receipt}
            title="No Shopify orders match this view"
            description="Adjust the status, date range, or search term to inspect a different slice of synced Shopify orders."
          />
        ) : null}
      </div>

      <Sheet
        open={Boolean(selectedOrder)}
        onOpenChange={() => setSelectedOrder(null)}
      >
        <SheetContent className="w-[440px] overflow-y-auto sm:w-[520px]">
          {selectedOrder ? (
            <div className="space-y-4">
              <SheetHeader className="border-b border-gray-100 pb-4 text-left">
                <SheetTitle>
                  Order #
                  {selectedOrder.order_number ?? selectedOrder.shopify_order_id}
                </SheetTitle>
                <SheetDescription className="sr-only">
                  Shopify order details, line items, and raw payload for
                  {` ${selectedOrder.shopify_order_id}`}.
                </SheetDescription>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-mono">
                    {selectedOrder.shopify_order_id}
                  </span>
                  <CopyValueButton
                    value={selectedOrder.shopify_order_id}
                    label="Shopify order ID"
                  />
                </div>
              </SheetHeader>

              <div className="space-y-3 rounded-xl border border-gray-100 bg-white p-4">
                <SlideOverField
                  label="Customer"
                  value={
                    selectedOrder.customerDisplayName ??
                    selectedOrder.email ??
                    null
                  }
                />
                <SlideOverField
                  label="Email"
                  value={selectedOrder.email ?? null}
                />
                <SlideOverField
                  label="Date"
                  value={formatDateTimeValue(selectedOrder.order_date)}
                />
                <SlideOverField
                  label="Total"
                  value={formatCurrency(Number(selectedOrder.total_price ?? 0))}
                />
                <SlideOverField
                  label="Subtotal"
                  value={formatCurrency(
                    Number(selectedOrder.subtotal_price ?? 0),
                  )}
                />
                <SlideOverField
                  label="Tax"
                  value={formatCurrency(Number(selectedOrder.total_tax ?? 0))}
                />
                <SlideOverField
                  label="Currency"
                  value={selectedOrder.currency ?? null}
                />
                <SlideOverField
                  label="Financial"
                  value={selectedOrder.financial_status ?? null}
                />
                <SlideOverField
                  label="Fulfillment"
                  value={selectedOrder.fulfillment_status ?? null}
                />
                <SlideOverField
                  label="CRM contact"
                  value={selectedOrder.contact_id ?? null}
                  copyable={Boolean(selectedOrder.contact_id)}
                />
                <SlideOverField
                  label="Synced"
                  value={formatDateTimeValue(selectedOrder.synced_at)}
                />
              </div>

              <div className="space-y-2 rounded-xl border border-gray-100 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Line Items
                </p>
                {lineItems.length > 0 ? (
                  <div className="space-y-2">
                    {lineItems.map((item, index) => (
                      <div
                        key={`${item.productId ?? item.name ?? "line-item"}-${index}`}
                        className="rounded-lg border border-gray-100 p-3"
                      >
                        <div className="text-sm font-medium text-foreground">
                          {item.name ?? "Unnamed item"}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                          <span>Qty {item.quantity ?? 0}</span>
                          <span>
                            Unit {formatCurrency(Number(item.unitPrice ?? 0))}
                          </span>
                          {item.productId ? (
                            <span>ID {item.productId}</span>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyValue />
                )}
              </div>

              <div className="space-y-2 rounded-xl border border-gray-100 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Discounts
                </p>
                <RawDataPre value={selectedOrder.discount_codes} />
              </div>

              <div className="space-y-2 rounded-xl border border-gray-100 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Shipping Address
                </p>
                <RawDataPre value={selectedOrder.shipping_address} />
              </div>

              <div className="space-y-2 rounded-xl border border-gray-100 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Raw Shopify Payload
                </p>
                <RawDataPre value={selectedOrder.raw_data} />
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
