import { Link } from "react-router-dom";
import { RefreshCw, UserCheck, Users } from "lucide-react";
import Button from "@mui/joy/Button";

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
  RawDataPre,
  SlideOverField,
  TableSearchInput,
  TableSkeleton,
  ToolbarSelect,
  formatCurrency,
  formatDateValue,
  formatRelativeTimestamp,
  getInitials,
  JoyDataTable,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
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

      <Sheet
        open={Boolean(selectedCustomer)}
        onOpenChange={() => onSelectedCustomerChange(null)}
      >
        <SheetContent className="w-[420px] overflow-y-auto sm:w-[480px]">
          {selectedCustomer ? (
            <>
              <SheetHeader className="border-b border-gray-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                    <span className="text-base font-semibold text-gray-600">
                      {getInitials(
                        selectedCustomer.first_name,
                        selectedCustomer.last_name,
                        selectedCustomer.email,
                      )}
                    </span>
                  </div>
                  <div className="min-w-0 text-left">
                    <SheetTitle className="text-base">
                      {selectedCustomer.displayName}
                    </SheetTitle>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Lightspeed ID: {selectedCustomer.lightspeed_customer_id}
                    </p>
                  </div>
                </div>
                <SheetDescription className="sr-only">
                  Customer details and raw Lightspeed payload for{" "}
                  {selectedCustomer.displayName}.
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-0">
                <div className="space-y-2.5 border-b border-gray-100 py-4">
                  <SlideOverField
                    label="Email"
                    value={selectedCustomer.email}
                    copyable
                  />
                  <SlideOverField
                    label="Phone"
                    value={formatPhoneNumber(selectedCustomer.phone)}
                  />
                </div>

                <div className="space-y-2.5 border-b border-gray-100 py-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Purchase history
                  </p>
                  <SlideOverField
                    label="Total spend"
                    value={formatCurrency(selectedCustomer.total_spend)}
                  />
                  <SlideOverField
                    label="Total purchases"
                    value={(
                      selectedCustomer.purchase_count ?? 0
                    ).toLocaleString()}
                  />
                  <SlideOverField
                    label="First purchase"
                    value={
                      selectedCustomer.first_purchase_date
                        ? formatDateValue(selectedCustomer.first_purchase_date)
                        : null
                    }
                  />
                  <SlideOverField
                    label="Last purchase"
                    value={
                      selectedCustomer.last_purchase_date
                        ? formatDateValue(selectedCustomer.last_purchase_date)
                        : null
                    }
                  />
                </div>

                {selectedCustomer.loyalty_balance !== null ? (
                  <div className="space-y-2.5 border-b border-gray-100 py-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Loyalty
                    </p>
                    <SlideOverField
                      label="Points balance"
                      value={selectedCustomer.loyalty_balance.toLocaleString()}
                    />
                    <SlideOverField
                      label="Group"
                      value={selectedCustomer.customer_group_id}
                    />
                  </div>
                ) : null}

                <div className="border-b border-gray-100 py-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    CRM record
                  </p>
                  {selectedCustomer.email ? (
                    <Link
                      to={`/crm/customers?email=${encodeURIComponent(selectedCustomer.email)}`}
                      className="flex items-center gap-2 text-sm text-foreground hover:underline"
                    >
                      <UserCheck className="h-4 w-4 text-emerald-500" />
                      View in CRM →
                    </Link>
                  ) : (
                    <p className="text-sm italic text-muted-foreground">
                      No email address — cannot link to CRM record
                    </p>
                  )}
                </div>

                <details className="py-4">
                  <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground">
                    Raw Lightspeed data
                  </summary>
                  <RawDataPre value={selectedCustomer.raw_data} />
                </details>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
