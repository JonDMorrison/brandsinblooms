import { useEffect, useMemo, useState } from "react";
import { Copy, Receipt, X } from "lucide-react";
import Avatar from "@mui/joy/Avatar";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Chip from "@mui/joy/Chip";
import Drawer from "@mui/joy/Drawer";
import IconButton from "@mui/joy/IconButton";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Tooltip from "@mui/joy/Tooltip";
import Typography from "@mui/joy/Typography";

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
  SaleStatusBadge,
  StatusFilterPills,
  TableSearchInput,
  TableSkeleton,
  ToolbarSelect,
  formatCurrency,
  formatDateTimeValue,
  formatDateValue,
  parseSaleLineItems,
  JoyDataTable,
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

function formatSaleId(value?: string | null) {
  if (!value) {
    return "\u2014";
  }

  const normalized = value.replace(/[^a-zA-Z0-9]/g, "");
  if (normalized.length <= 12) {
    return `LS-${normalized}`;
  }

  return `LS-${normalized.slice(0, 6)}\u2026${normalized.slice(-4)}`;
}

function getDisplayValue(value?: string | null) {
  return value && value.trim().length > 0 ? value : "\u2014";
}

function truncateProductId(value: string) {
  const normalized = value.replace(/[^a-zA-Z0-9]/g, "");
  if (normalized.length <= 12) {
    return `Product-${normalized}`;
  }

  return `Product-${normalized.slice(0, 6)}\u2026${normalized.slice(-4)}`;
}

function extractPaymentFromRawData(rawData: unknown): string | null {
  if (!rawData || typeof rawData !== "object") {
    return null;
  }

  const data = rawData as Record<string, unknown>;

  if (Array.isArray(data.payments) && data.payments.length > 0) {
    const p = data.payments[0] as Record<string, unknown>;
    const name =
      (typeof p.payment_type_name === "string" ? p.payment_type_name : null) ??
      (typeof p.name === "string" ? p.name : null);
    if (name && name.trim().length > 0) {
      return name.trim();
    }
  }

  const sp = (data.SalePayments as Record<string, unknown> | undefined)
    ?.SalePayment;
  const salePayment = Array.isArray(sp) ? sp[0] : sp;
  if (salePayment && typeof salePayment === "object") {
    const pt = (salePayment as Record<string, unknown>).PaymentType as
      | Record<string, unknown>
      | undefined;
    const name = typeof pt?.name === "string" ? pt.name : null;
    if (name && name.trim().length > 0) {
      return name.trim();
    }
  }

  return null;
}

function formatLineItemQuantity(value?: number | null) {
  return typeof value === "number" ? value.toLocaleString() : "0";
}

function getLineItemTotal(unitPrice?: number | null, quantity?: number | null) {
  if (typeof unitPrice !== "number" || !Number.isFinite(unitPrice)) {
    return null;
  }

  const normalizedQuantity = typeof quantity === "number" ? quantity : 0;
  return unitPrice * normalizedQuantity;
}

function escapeHtmlEntities(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function sanitizeJsonValue(value: unknown): unknown {
  if (typeof value === "string") {
    return escapeHtmlEntities(value);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeJsonValue(entry));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        sanitizeJsonValue(entry),
      ]),
    );
  }

  return value;
}

function formatRawJson(value: unknown) {
  try {
    return JSON.stringify(sanitizeJsonValue(value), null, 2);
  } catch {
    return "{}";
  }
}

function SectionLabel({ children }: { children: string }) {
  return (
    <Typography
      level="body-xs"
      sx={{
        fontWeight: "lg",
        textTransform: "uppercase",
        letterSpacing: "0.1em",
        color: "text.tertiary",
        mb: 1.5,
      }}
    >
      {children}
    </Typography>
  );
}

function DetailRow({
  label,
  value,
  valueNode,
}: {
  label: string;
  value: string;
  valueNode?: React.ReactNode;
}) {
  const isEmpty = value === "\u2014";

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 2,
      }}
    >
      <Typography level="body-sm" sx={{ color: "text.tertiary" }}>
        {label}
      </Typography>
      {valueNode ?? (
        <Typography
          level="body-sm"
          sx={{
            fontWeight: "md",
            color: isEmpty ? "text.tertiary" : "text.primary",
            opacity: isEmpty ? 0.7 : 1,
            textAlign: "right",
          }}
        >
          {value}
        </Typography>
      )}
    </Box>
  );
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
  const [isRawDataOpen, setIsRawDataOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const lineItemCount = lineItems.length;
  const lineItemQuantity = lineItems.reduce(
    (total, item) =>
      total + (typeof item.quantity === "number" ? item.quantity : 0),
    0,
  );
  const rawJson = useMemo(
    () => formatRawJson(selectedSale?.raw_data ?? {}),
    [selectedSale?.raw_data],
  );

  useEffect(() => {
    if (!selectedSale) {
      setIsRawDataOpen(false);
    }
  }, [selectedSale]);

  useEffect(() => {
    if (!copiedKey) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setCopiedKey(null);
    }, 1200);

    return () => window.clearTimeout(timeout);
  }, [copiedKey]);

  const copyToClipboard = async (value: string, key: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedKey(key);
  };

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

      <Drawer
        open={Boolean(selectedSale)}
        onClose={() => onSelectedSaleChange(null)}
        anchor="right"
        size="md"
        slotProps={{
          content: {
            sx: {
              width: { xs: "100vw", sm: 420 },
              maxWidth: "100vw",
              bgcolor: "background.surface",
              boxShadow: "lg",
              borderLeft: "none",
              transition: "transform 300ms ease-in-out",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            },
          },
        }}
      >
        {selectedSale ? (
          <Stack sx={{ height: "100%", minHeight: 0 }}>
            <Box
              sx={{
                position: "sticky",
                top: 0,
                zIndex: 1,
                px: 3,
                py: 2.5,
                bgcolor: "background.surface",
                borderBottom: "1px solid",
                borderColor: "divider",
                flexShrink: 0,
              }}
            >
              <Stack direction="row" spacing={2} alignItems="center">
                <Avatar size="lg" variant="soft" color="neutral">
                  <Receipt size={20} />
                </Avatar>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography
                    level="title-lg"
                    sx={{
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    Sale
                  </Typography>
                  <Stack
                    direction="row"
                    spacing={0.75}
                    alignItems="center"
                    sx={{ minWidth: 0, mt: 0.5 }}
                  >
                    <Typography
                      level="body-xs"
                      sx={{
                        color: "text.tertiary",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {formatSaleId(selectedSale.lightspeed_sale_id)}
                    </Typography>
                    <Tooltip
                      title={
                        copiedKey === "sale-id" ? "Copied" : "Copy sale ID"
                      }
                    >
                      <IconButton
                        variant="plain"
                        color="neutral"
                        size="sm"
                        onClick={() =>
                          void copyToClipboard(
                            selectedSale.lightspeed_sale_id,
                            "sale-id",
                          )
                        }
                      >
                        <Copy size={14} />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Box>
                <IconButton
                  variant="plain"
                  color="neutral"
                  size="sm"
                  onClick={() => onSelectedSaleChange(null)}
                >
                  <X size={16} />
                </IconButton>
              </Stack>
            </Box>

            <Stack spacing={2.5} sx={{ p: 3, overflowY: "auto", minHeight: 0 }}>
              <Sheet variant="outlined" sx={{ borderRadius: "md", p: 2 }}>
                <SectionLabel>Summary</SectionLabel>
                <Stack spacing={1.5}>
                  <Typography level="h3" sx={{ fontWeight: "lg" }}>
                    {formatCurrency(selectedSale.total_amount)}
                  </Typography>
                  <Stack
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    flexWrap="wrap"
                    useFlexGap
                  >
                    <SaleStatusBadge status={selectedSale.status} />
                    <Typography level="body-sm" sx={{ color: "text.tertiary" }}>
                      {formatDateTimeValue(selectedSale.sale_date)}
                    </Typography>
                  </Stack>
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                      gap: 1.5,
                    }}
                  >
                    <DetailRow
                      label="Payment"
                      value={getDisplayValue(
                        selectedSale.payment_method ??
                          extractPaymentFromRawData(selectedSale.raw_data),
                      )}
                    />
                    <DetailRow
                      label="Items"
                      value={lineItemCount.toLocaleString()}
                    />
                    <DetailRow
                      label="Quantity"
                      value={lineItemQuantity.toLocaleString()}
                    />
                    <DetailRow
                      label="Synced"
                      value={
                        selectedSale.synced_at
                          ? formatDateTimeValue(selectedSale.synced_at)
                          : "\u2014"
                      }
                    />
                  </Box>
                </Stack>
              </Sheet>

              <Sheet variant="outlined" sx={{ borderRadius: "md", p: 2 }}>
                <SectionLabel>Customer</SectionLabel>
                <Stack spacing={1}>
                  <DetailRow
                    label="Customer"
                    value={getDisplayValue(selectedSale.customerDisplayName)}
                  />
                </Stack>
              </Sheet>

              <Sheet variant="outlined" sx={{ borderRadius: "md", p: 2 }}>
                <SectionLabel>Line Items</SectionLabel>
                {lineItems.length > 0 ? (
                  <Stack spacing={1}>
                    {lineItems.map((item, index) => {
                      const lineTotal = getLineItemTotal(
                        item.unitPrice,
                        item.quantity,
                      );

                      return (
                        <Sheet
                          key={`${item.productId ?? item.name ?? "item"}-${index}`}
                          variant="soft"
                          color="neutral"
                          sx={{ borderRadius: "sm", p: 1.5 }}
                        >
                          <Stack spacing={1}>
                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "flex-start",
                                justifyContent: "space-between",
                                gap: 2,
                              }}
                            >
                              <Box sx={{ minWidth: 0 }}>
                                <Typography
                                  level="body-md"
                                  sx={{ fontWeight: "lg" }}
                                >
                                  {item.name ??
                                    (item.productId
                                      ? truncateProductId(item.productId)
                                      : "Unnamed item")}
                                </Typography>
                                {item.sku ? (
                                  <Typography
                                    level="body-xs"
                                    sx={{ color: "text.tertiary", mt: 0.25 }}
                                  >
                                    {item.sku}
                                  </Typography>
                                ) : null}
                              </Box>
                              {lineTotal !== null ? (
                                <Typography
                                  level="body-md"
                                  sx={{
                                    fontWeight: "lg",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {formatCurrency(lineTotal)}
                                </Typography>
                              ) : null}
                            </Box>
                            <Stack
                              direction="row"
                              spacing={0.75}
                              flexWrap="wrap"
                              useFlexGap
                            >
                              <Chip variant="soft" color="neutral" size="sm">
                                Qty {formatLineItemQuantity(item.quantity)}
                              </Chip>
                              <Chip
                                variant="outlined"
                                color="neutral"
                                size="sm"
                              >
                                Unit {formatCurrency(item.unitPrice)}
                              </Chip>
                            </Stack>
                          </Stack>
                        </Sheet>
                      );
                    })}
                  </Stack>
                ) : (
                  <Typography
                    level="body-sm"
                    sx={{ color: "text.tertiary", textAlign: "center", py: 1 }}
                  >
                    No line items available
                  </Typography>
                )}
              </Sheet>

              {selectedSale.note ? (
                <Sheet variant="outlined" sx={{ borderRadius: "md", p: 2 }}>
                  <SectionLabel>Notes</SectionLabel>
                  <Typography
                    level="body-sm"
                    sx={{ color: "text.secondary", whiteSpace: "pre-wrap" }}
                  >
                    {selectedSale.note}
                  </Typography>
                </Sheet>
              ) : null}
            </Stack>
          </Stack>
        ) : null}
      </Drawer>
    </>
  );
}
