import { useEffect, useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Code2, Copy, ExternalLink, RefreshCw, Users, X } from "lucide-react";
import Alert from "@mui/joy/Alert";
import Avatar from "@mui/joy/Avatar";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Chip from "@mui/joy/Chip";
import Divider from "@mui/joy/Divider";
import Drawer from "@mui/joy/Drawer";
import IconButton from "@mui/joy/IconButton";
import Link from "@mui/joy/Link";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Tooltip from "@mui/joy/Tooltip";
import Typography from "@mui/joy/Typography";

import type {
  LightspeedCustomerSortField,
  LightspeedCustomerTableRow,
  LightspeedPagination,
  LightspeedSortDirection,
} from "@/hooks/useIntegrationDetailData";
import { cn } from "@/lib/utils";

import {
  CopyValueButton,
  DataTabCard,
  DataTabEmptyState,
  DataTabPagination,
  EmptyValue,
  TableSearchInput,
  TableSkeleton,
  ToolbarSelect,
  formatCurrency,
  formatDateValue,
  formatRelativeTimestamp,
  getInitials,
  JoyDataTable,
} from "@/components/integrations/shared/dataTabPrimitives";

type CustomerSortValue =
  | "name:asc"
  | "total_spend:desc"
  | "last_purchase_date:desc"
  | "synced_at:desc";

const CUSTOMER_SORT_OPTIONS = [
  { label: "Name A–Z", value: "name:asc" },
  { label: "Total Spend (high–low)", value: "total_spend:desc" },
  { label: "Last Purchase (newest)", value: "last_purchase_date:desc" },
  { label: "Synced At (newest)", value: "synced_at:desc" },
] satisfies Array<{ label: string; value: CustomerSortValue }>;

function formatPhoneNumber(phone?: string | null) {
  if (!phone) {
    return null;
  }

  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  return phone;
}

function getSortValue(
  field: LightspeedCustomerSortField,
  direction: LightspeedSortDirection,
) {
  return `${field}:${direction}` as CustomerSortValue;
}

function getDisplayValue(value?: string | null) {
  return value && value.trim().length > 0 ? value : "\u2014";
}

function formatLightspeedId(value?: string | null) {
  if (!value) {
    return "\u2014";
  }

  const normalized = value.replace(/[^a-zA-Z0-9]/g, "");
  if (normalized.length <= 10) {
    return `LS-${normalized}`;
  }

  return `LS-${normalized.slice(0, 6)}\u2026${normalized.slice(-4)}`;
}

function formatMetricCurrency(value?: number | null) {
  return formatCurrency(typeof value === "number" ? value : 0);
}

function formatPoints(value?: number | null) {
  return typeof value === "number" ? value.toLocaleString() : "0";
}

function getAverageOrderValue(
  totalSpend?: number | null,
  purchaseCount?: number | null,
) {
  if (!purchaseCount || purchaseCount <= 0) {
    return null;
  }

  return (totalSpend ?? 0) / purchaseCount;
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

function getProfileImageUrl(rawData: unknown) {
  if (!rawData || typeof rawData !== "object") {
    return null;
  }

  const record = rawData as Record<string, unknown>;
  const candidates = [
    record.profile_image_url,
    record.profileImageUrl,
    record.avatar_url,
    record.avatarUrl,
    record.image_url,
    record.imageUrl,
    record.picture_url,
    record.pictureUrl,
  ];

  const profileImage = candidates.find(
    (candidate): candidate is string =>
      typeof candidate === "string" && candidate.trim().length > 0,
  );

  return profileImage ?? null;
}

function DetailLabel({ children }: { children: string }) {
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
  value?: string;
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

function MetricCell({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <Stack spacing={0.25}>
      <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
        {label}
      </Typography>
      <Typography
        level="body-md"
        sx={{
          fontWeight: "lg",
          color: muted ? "text.tertiary" : "text.primary",
          opacity: muted ? 0.75 : 1,
        }}
      >
        {value}
      </Typography>
    </Stack>
  );
}

function DetailCardSkeleton({ height = 120 }: { height?: number }) {
  return (
    <Skeleton
      variant="rectangular"
      animation="wave"
      sx={{ borderRadius: "md", height }}
    />
  );
}

export function CustomersTabView({
  connectionId: _connectionId,
  rows,
  pagination,
  isLoading,
  isFetching,
  customersSynced,
  searchQuery,
  onSearchQueryChange,
  sortField,
  sortDirection,
  onSortChange,
  selectedCustomer,
  selectedCustomerDetail,
  isSelectedCustomerDetailLoading,
  selectedCustomerDetailError,
  onRetrySelectedCustomerDetail,
  onSelectedCustomerChange,
  onPageChange,
  onTriggerSync,
}: {
  connectionId: string;
  rows: LightspeedCustomerTableRow[];
  pagination: LightspeedPagination;
  isLoading: boolean;
  isFetching: boolean;
  customersSynced: number;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  sortField: LightspeedCustomerSortField;
  sortDirection: LightspeedSortDirection;
  onSortChange: (
    field: LightspeedCustomerSortField,
    direction: LightspeedSortDirection,
  ) => void;
  selectedCustomer: LightspeedCustomerTableRow | null;
  selectedCustomerDetail: LightspeedCustomerTableRow | null;
  isSelectedCustomerDetailLoading: boolean;
  selectedCustomerDetailError: string | null;
  onRetrySelectedCustomerDetail: () => void;
  onSelectedCustomerChange: (
    customer: LightspeedCustomerTableRow | null,
  ) => void;
  onPageChange: (page: number) => void;
  onTriggerSync: () => void;
}) {
  const sortValue = getSortValue(sortField, sortDirection);
  const showEmptySyncState =
    customersSynced === 0 && rows.length === 0 && !isLoading && !isFetching;
  const showFilteredEmptyState =
    rows.length === 0 && !showEmptySyncState && !isLoading && !isFetching;
  const [isRawDataOpen, setIsRawDataOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedCustomer) {
      setIsRawDataOpen(false);
    }
  }, [selectedCustomer]);

  useEffect(() => {
    if (!copiedKey) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setCopiedKey(null);
    }, 1200);

    return () => window.clearTimeout(timeout);
  }, [copiedKey]);

  const detailCustomer = selectedCustomerDetail ?? selectedCustomer;
  const headerCustomer = selectedCustomerDetailError
    ? selectedCustomer
    : detailCustomer;
  const profileImageUrl = useMemo(
    () => getProfileImageUrl(headerCustomer?.raw_data),
    [headerCustomer?.raw_data],
  );
  const purchaseCount = detailCustomer?.purchase_count ?? 0;
  const totalSpend = detailCustomer?.total_spend ?? 0;
  const averageOrderValue = getAverageOrderValue(totalSpend, purchaseCount);
  const hasPurchaseHistory =
    totalSpend > 0 ||
    purchaseCount > 0 ||
    Boolean(detailCustomer?.first_purchase_date) ||
    Boolean(detailCustomer?.last_purchase_date);
  const hasLoyaltyData =
    detailCustomer?.loyalty_balance !== null ||
    Boolean(detailCustomer?.customer_group_id);
  const crmHref = detailCustomer?.contact_id
    ? `/crm/customers/${detailCustomer.contact_id}`
    : null;
  const rawJson = useMemo(
    () =>
      formatRawJson(detailCustomer?.raw_data ?? headerCustomer?.raw_data ?? {}),
    [detailCustomer?.raw_data, headerCustomer?.raw_data],
  );

  const copyToClipboard = async (value: string, key: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedKey(key);
  };

  if (isLoading || (isFetching && rows.length === 0)) {
    return <TableSkeleton columns={5} rows={8} />;
  }

  return (
    <>
      <DataTabCard>
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-3">
          <TableSearchInput
            placeholder="Search customers..."
            value={searchQuery}
            onChange={onSearchQueryChange}
          />
          <div className="flex items-center gap-3">
            <ToolbarSelect
              ariaLabel="Sort customers"
              value={sortValue}
              onChange={(value) => {
                const [field, direction] = value.split(":") as [
                  LightspeedCustomerSortField,
                  LightspeedSortDirection,
                ];
                onSortChange(field, direction);
              }}
              options={CUSTOMER_SORT_OPTIONS}
            />
            <span className="text-xs tabular-nums text-muted-foreground">
              {pagination.totalCount.toLocaleString()} records
            </span>
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
                      style={{ width: "240px" }}
                    >
                      Customer
                    </th>
                    <th
                      className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                      style={{ width: "140px" }}
                    >
                      Phone
                    </th>
                    <th
                      className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                      style={{ width: "120px" }}
                    >
                      Total Spend
                    </th>
                    <th
                      className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                      style={{ width: "80px" }}
                    >
                      Purchases
                    </th>
                    <th
                      className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                      style={{ width: "140px" }}
                    >
                      Last Purchase
                    </th>
                    <th
                      className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                      style={{ width: "100px" }}
                    >
                      Loyalty
                    </th>
                    <th
                      className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                      style={{ width: "120px" }}
                    >
                      Synced
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((customer) => (
                    <tr
                      key={customer.id}
                      className="cursor-pointer border-b border-gray-50 transition-colors hover:bg-gray-50"
                      onClick={() => onSelectedCustomerChange(customer)}
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-100">
                            <span className="text-xs font-semibold text-gray-600">
                              {getInitials(
                                customer.first_name,
                                customer.last_name,
                                customer.email,
                              )}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-foreground">
                              {customer.displayName}
                            </div>
                            <div className="truncate text-xs text-muted-foreground">
                              {customer.email ?? "No email"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-sm text-foreground">
                        {customer.phone ? (
                          formatPhoneNumber(customer.phone)
                        ) : (
                          <EmptyValue />
                        )}
                      </td>
                      <td className="px-5 py-3 text-right text-sm font-semibold text-foreground">
                        {formatCurrency(customer.total_spend)}
                      </td>
                      <td className="px-5 py-3 text-center text-sm text-foreground">
                        {(customer.purchase_count ?? 0).toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-sm text-foreground">
                        {customer.last_purchase_date ? (
                          formatRelativeTimestamp(customer.last_purchase_date)
                        ) : (
                          <EmptyValue />
                        )}
                      </td>
                      <td className="px-5 py-3 text-sm text-muted-foreground">
                        {customer.loyalty_balance !== null ? (
                          customer.loyalty_balance.toLocaleString()
                        ) : (
                          <EmptyValue />
                        )}
                      </td>
                      <td className="px-5 py-3 text-sm text-muted-foreground">
                        {customer.synced_at ? (
                          formatRelativeTimestamp(customer.synced_at)
                        ) : (
                          <EmptyValue />
                        )}
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

        {showEmptySyncState ? (
          <DataTabEmptyState
            icon={Users}
            title="No customers synced yet"
            description="Trigger a manual sync to import your Lightspeed customers."
            action={
              <Button
                variant="outlined"
                color="neutral"
                size="sm"
                startDecorator={<RefreshCw size={14} />}
                onClick={onTriggerSync}
              >
                Sync now
              </Button>
            }
          />
        ) : null}

        {showFilteredEmptyState ? (
          <DataTabEmptyState
            icon={Users}
            title="No customers match this view"
            description="Adjust the search or sort to see a different slice of synced customer data."
          />
        ) : null}
      </DataTabCard>

      <Drawer
        open={Boolean(selectedCustomer)}
        onClose={() => onSelectedCustomerChange(null)}
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
        {selectedCustomer ? (
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
              {isSelectedCustomerDetailLoading ? (
                <Stack direction="row" spacing={2} alignItems="center">
                  <Skeleton variant="circular" width={48} height={48} />
                  <Stack spacing={0.75} sx={{ flex: 1 }}>
                    <Skeleton
                      variant="text"
                      sx={{ width: "62%", height: 24 }}
                    />
                    <Skeleton
                      variant="text"
                      sx={{ width: "44%", height: 16 }}
                    />
                  </Stack>
                  <IconButton
                    variant="plain"
                    color="neutral"
                    size="sm"
                    onClick={() => onSelectedCustomerChange(null)}
                  >
                    <X size={16} />
                  </IconButton>
                </Stack>
              ) : (
                <Stack direction="row" spacing={2} alignItems="center">
                  <Avatar
                    size="lg"
                    variant="soft"
                    color="neutral"
                    src={profileImageUrl ?? undefined}
                  >
                    {getInitials(
                      headerCustomer?.first_name,
                      headerCustomer?.last_name,
                      headerCustomer?.email,
                    )}
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
                      {headerCustomer?.displayName ??
                        selectedCustomer.displayName}
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
                        {formatLightspeedId(
                          headerCustomer?.lightspeed_customer_id ??
                            selectedCustomer.lightspeed_customer_id,
                        )}
                      </Typography>
                      <Tooltip
                        title={
                          copiedKey === "lightspeed-id"
                            ? "Copied"
                            : "Copy Lightspeed ID"
                        }
                      >
                        <IconButton
                          variant="plain"
                          color="neutral"
                          size="sm"
                          onClick={() =>
                            void copyToClipboard(
                              headerCustomer?.lightspeed_customer_id ??
                                selectedCustomer.lightspeed_customer_id,
                              "lightspeed-id",
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
                    onClick={() => onSelectedCustomerChange(null)}
                  >
                    <X size={16} />
                  </IconButton>
                </Stack>
              )}
            </Box>

            <Stack spacing={2.5} sx={{ p: 3, overflowY: "auto", minHeight: 0 }}>
              {isSelectedCustomerDetailLoading ? (
                <>
                  <DetailCardSkeleton height={126} />
                  <DetailCardSkeleton height={150} />
                  <DetailCardSkeleton height={112} />
                  <Skeleton
                    variant="rectangular"
                    sx={{ height: 36, borderRadius: "md" }}
                  />
                  <Skeleton
                    variant="rectangular"
                    sx={{ height: 36, borderRadius: "md" }}
                  />
                </>
              ) : selectedCustomerDetailError ? (
                <Alert
                  variant="soft"
                  color="danger"
                  size="sm"
                  endDecorator={
                    <Button
                      size="sm"
                      variant="plain"
                      color="danger"
                      onClick={onRetrySelectedCustomerDetail}
                    >
                      Retry
                    </Button>
                  }
                >
                  Failed to load customer details
                </Alert>
              ) : (
                <>
                  <Sheet variant="outlined" sx={{ borderRadius: "md", p: 2 }}>
                    <DetailLabel>Contact</DetailLabel>
                    <Stack spacing={1}>
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 2,
                          "&:hover .customer-email-copy": {
                            opacity: 1,
                          },
                        }}
                      >
                        <Typography
                          level="body-sm"
                          sx={{ color: "text.tertiary" }}
                        >
                          Email
                        </Typography>
                        <Stack
                          direction="row"
                          spacing={0.5}
                          alignItems="center"
                          sx={{ minWidth: 0 }}
                        >
                          {detailCustomer?.email ? (
                            <Link
                              href={`mailto:${detailCustomer.email}`}
                              underline="hover"
                              color="neutral"
                              level="body-sm"
                              sx={{
                                fontWeight: "md",
                                minWidth: 0,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {detailCustomer.email}
                            </Link>
                          ) : (
                            <Typography
                              level="body-sm"
                              sx={{ color: "text.tertiary", opacity: 0.7 }}
                            >
                              \u2014
                            </Typography>
                          )}
                          {detailCustomer?.email ? (
                            <Tooltip
                              title={
                                copiedKey === "email" ? "Copied" : "Copy email"
                              }
                            >
                              <IconButton
                                className="customer-email-copy"
                                size="sm"
                                variant="plain"
                                color="neutral"
                                sx={{
                                  opacity: 0,
                                  transition: "opacity 200ms ease-in-out",
                                }}
                                onClick={() =>
                                  void copyToClipboard(
                                    detailCustomer.email!,
                                    "email",
                                  )
                                }
                              >
                                <Copy size={14} />
                              </IconButton>
                            </Tooltip>
                          ) : null}
                        </Stack>
                      </Box>
                      <Divider sx={{ mx: -2, opacity: 0.5 }} />
                      <DetailRow
                        label="Phone"
                        valueNode={
                          detailCustomer?.phone ? (
                            <Link
                              href={`tel:${detailCustomer.phone}`}
                              underline="hover"
                              color="neutral"
                              level="body-sm"
                              sx={{ fontWeight: "md" }}
                            >
                              {formatPhoneNumber(detailCustomer.phone)}
                            </Link>
                          ) : undefined
                        }
                        value={getDisplayValue(
                          formatPhoneNumber(detailCustomer?.phone),
                        )}
                      />
                    </Stack>
                  </Sheet>

                  <Sheet variant="outlined" sx={{ borderRadius: "md", p: 2 }}>
                    <DetailLabel>Purchase History</DetailLabel>
                    <Stack spacing={1}>
                      <Typography
                        level="h4"
                        sx={{
                          fontWeight: "lg",
                          color:
                            totalSpend > 0 ? "text.primary" : "text.tertiary",
                          opacity: totalSpend > 0 ? 1 : 0.7,
                        }}
                      >
                        {formatMetricCurrency(totalSpend)}
                      </Typography>
                      {hasPurchaseHistory ? (
                        <Box
                          sx={{
                            display: "grid",
                            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                            gap: 1.5,
                          }}
                        >
                          <MetricCell
                            label="Total Purchases"
                            value={purchaseCount.toLocaleString()}
                            muted={purchaseCount === 0}
                          />
                          <MetricCell
                            label="Avg. Order Value"
                            value={
                              averageOrderValue === null
                                ? "\u2014"
                                : formatMetricCurrency(averageOrderValue)
                            }
                            muted={averageOrderValue === null}
                          />
                          <MetricCell
                            label="First Purchase"
                            value={
                              detailCustomer?.first_purchase_date
                                ? formatDateValue(
                                    detailCustomer.first_purchase_date,
                                  )
                                : "\u2014"
                            }
                            muted={!detailCustomer?.first_purchase_date}
                          />
                          <MetricCell
                            label="Last Purchase"
                            value={
                              detailCustomer?.last_purchase_date
                                ? formatDateValue(
                                    detailCustomer.last_purchase_date,
                                  )
                                : "\u2014"
                            }
                            muted={!detailCustomer?.last_purchase_date}
                          />
                        </Box>
                      ) : (
                        <Typography
                          level="body-sm"
                          sx={{
                            color: "text.tertiary",
                            textAlign: "center",
                            py: 1,
                          }}
                        >
                          No purchase history synced
                        </Typography>
                      )}
                    </Stack>
                  </Sheet>

                  <Sheet variant="outlined" sx={{ borderRadius: "md", p: 2 }}>
                    <DetailLabel>Loyalty</DetailLabel>
                    {hasLoyaltyData ? (
                      <Stack spacing={1}>
                        <DetailRow
                          label="Points Balance"
                          valueNode={
                            <Stack
                              direction="row"
                              spacing={0.75}
                              alignItems="center"
                            >
                              <Typography
                                level="body-md"
                                sx={{
                                  fontWeight: "lg",
                                  color:
                                    (detailCustomer?.loyalty_balance ?? 0) > 0
                                      ? "text.primary"
                                      : "text.tertiary",
                                }}
                              >
                                {formatPoints(detailCustomer?.loyalty_balance)}
                              </Typography>
                              {(detailCustomer?.loyalty_balance ?? 0) > 0 ? (
                                <Chip variant="soft" color="success" size="sm">
                                  {formatPoints(
                                    detailCustomer?.loyalty_balance,
                                  )}
                                </Chip>
                              ) : null}
                            </Stack>
                          }
                          value={formatPoints(detailCustomer?.loyalty_balance)}
                        />
                        <Divider sx={{ mx: -2, opacity: 0.5 }} />
                        <DetailRow
                          label="Customer Group"
                          valueNode={
                            detailCustomer?.customer_group_id ? (
                              <Chip
                                variant="outlined"
                                color="neutral"
                                size="sm"
                              >
                                {detailCustomer.customer_group_id}
                              </Chip>
                            ) : undefined
                          }
                          value={getDisplayValue(
                            detailCustomer?.customer_group_id,
                          )}
                        />
                      </Stack>
                    ) : (
                      <Typography
                        level="body-sm"
                        sx={{
                          color: "text.tertiary",
                          textAlign: "center",
                          py: 1,
                        }}
                      >
                        No loyalty data
                      </Typography>
                    )}
                  </Sheet>

                  <Stack spacing={1}>
                    {crmHref ? (
                      <Button
                        component={RouterLink}
                        to={crmHref}
                        fullWidth
                        size="sm"
                        variant="outlined"
                        color="neutral"
                        endDecorator={<ExternalLink size={14} />}
                      >
                        View in CRM
                      </Button>
                    ) : (
                      <Tooltip title="No linked CRM record">
                        <Box>
                          <Button
                            fullWidth
                            size="sm"
                            variant="outlined"
                            color="neutral"
                            disabled
                            endDecorator={<ExternalLink size={14} />}
                          >
                            View in CRM
                          </Button>
                        </Box>
                      </Tooltip>
                    )}
                  </Stack>
                </>
              )}
            </Stack>
          </Stack>
        ) : null}
      </Drawer>
    </>
  );
}
