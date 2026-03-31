import { useState } from "react";
import { RefreshCw, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
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
  ShopifyCustomerSortField,
  ShopifyCustomerTableRow,
} from "@/hooks/useIntegrationDetailData";

import {
  CopyValueButton,
  DataTabEmptyState,
  DataTabPagination,
  EmptyValue,
  RawDataPre,
  SlideOverField,
  TableSearchInput,
  TagList,
  ToolbarSelect,
  formatCurrency,
  formatDateTimeValue,
  formatRelativeTimestamp,
  getInitials,
} from "@/components/integrations/shared/dataTabPrimitives";

type CustomerSortValue =
  | "last_order_date:desc"
  | "total_spent:desc"
  | "orders_count:desc"
  | "name:asc"
  | "synced_at:desc";

const CUSTOMER_SORT_OPTIONS = [
  { label: "Last Order", value: "last_order_date:desc" },
  { label: "Total Spent", value: "total_spent:desc" },
  { label: "Orders", value: "orders_count:desc" },
  { label: "Name A-Z", value: "name:asc" },
  { label: "Synced At", value: "synced_at:desc" },
] satisfies Array<{ label: string; value: CustomerSortValue }>;

function getSortValue(
  field: ShopifyCustomerSortField,
  direction: LightspeedSortDirection,
) {
  return `${field}:${direction}` as CustomerSortValue;
}

export function CustomersTabView({
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
  onPageChange,
  onTriggerSync,
}: {
  rows: ShopifyCustomerTableRow[];
  pagination: LightspeedPagination;
  isLoading: boolean;
  isFetching: boolean;
  customersSynced: number;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  sortField: ShopifyCustomerSortField;
  sortDirection: LightspeedSortDirection;
  onSortChange: (
    field: ShopifyCustomerSortField,
    direction: LightspeedSortDirection,
  ) => void;
  onPageChange: (page: number) => void;
  onTriggerSync: () => void;
}) {
  const [selectedCustomer, setSelectedCustomer] =
    useState<ShopifyCustomerTableRow | null>(null);
  const sortValue = getSortValue(sortField, sortDirection);
  const showEmptySyncState =
    customersSynced === 0 && rows.length === 0 && !isLoading && !isFetching;
  const showFilteredEmptyState =
    rows.length === 0 && !showEmptySyncState && !isLoading && !isFetching;

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-3">
          <TableSearchInput
            placeholder="Search customers..."
            value={searchQuery}
            onChange={onSearchQueryChange}
          />
          <div className="flex items-center gap-3">
            <ToolbarSelect
              ariaLabel="Sort Shopify customers"
              value={sortValue}
              onChange={(value) => {
                const [field, direction] = value.split(":") as [
                  ShopifyCustomerSortField,
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
              <table className="w-full min-w-[980px] border-collapse">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Customer
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Email
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Phone
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Total Spend
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Orders
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Last Order
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Synced
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((customer) => (
                    <tr
                      key={customer.id}
                      className="cursor-pointer border-b border-gray-50 transition-colors hover:bg-gray-50"
                      onClick={() => setSelectedCustomer(customer)}
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
                              {customer.shopify_customer_id}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-sm text-foreground">
                        {customer.email ?? <EmptyValue />}
                      </td>
                      <td className="px-5 py-3 text-sm text-foreground">
                        {customer.phone ?? <EmptyValue />}
                      </td>
                      <td className="px-5 py-3 text-right text-sm font-medium text-foreground">
                        {formatCurrency(Number(customer.total_spent ?? 0))}
                      </td>
                      <td className="px-5 py-3 text-right text-sm text-foreground">
                        {(customer.orders_count ?? 0).toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-sm text-foreground">
                        {customer.last_order_date ? (
                          formatRelativeTimestamp(customer.last_order_date)
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
            Loading customers...
          </div>
        ) : null}

        {showEmptySyncState ? (
          <DataTabEmptyState
            icon={Users}
            title="No Shopify customers synced yet"
            description="Trigger a manual sync to import your Shopify customers."
            action={
              <Button variant="outline" size="sm" onClick={onTriggerSync}>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                Sync now
              </Button>
            }
          />
        ) : null}

        {showFilteredEmptyState ? (
          <DataTabEmptyState
            icon={Users}
            title="No customers match this view"
            description="Adjust the search or sort to inspect a different slice of synced Shopify customer data."
          />
        ) : null}
      </div>

      <Sheet
        open={Boolean(selectedCustomer)}
        onOpenChange={() => setSelectedCustomer(null)}
      >
        <SheetContent className="w-[420px] overflow-y-auto sm:w-[480px]">
          {selectedCustomer ? (
            <div className="space-y-4">
              <SheetHeader className="border-b border-gray-100 pb-4 text-left">
                <SheetTitle>{selectedCustomer.displayName}</SheetTitle>
                <SheetDescription className="sr-only">
                  Shopify customer details and raw payload for
                  {` ${selectedCustomer.displayName}`}.
                </SheetDescription>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-mono">
                    {selectedCustomer.shopify_customer_id}
                  </span>
                  <CopyValueButton
                    value={selectedCustomer.shopify_customer_id}
                    label="Shopify customer ID"
                  />
                </div>
              </SheetHeader>

              <div className="space-y-3 rounded-xl border border-gray-100 bg-white p-4">
                <SlideOverField
                  label="Email"
                  value={selectedCustomer.email ?? null}
                />
                <SlideOverField
                  label="Phone"
                  value={selectedCustomer.phone ?? null}
                />
                <SlideOverField
                  label="Total spend"
                  value={formatCurrency(
                    Number(selectedCustomer.total_spent ?? 0),
                  )}
                />
                <SlideOverField
                  label="Orders"
                  value={(selectedCustomer.orders_count ?? 0).toLocaleString()}
                />
                <SlideOverField
                  label="Marketing"
                  value={
                    selectedCustomer.accepts_marketing
                      ? "Subscribed"
                      : "Not subscribed"
                  }
                />
                <SlideOverField
                  label="First order"
                  value={formatDateTimeValue(selectedCustomer.first_order_date)}
                />
                <SlideOverField
                  label="Last order"
                  value={formatDateTimeValue(selectedCustomer.last_order_date)}
                />
                <SlideOverField
                  label="CRM contact"
                  value={selectedCustomer.contact_id ?? null}
                  copyable={Boolean(selectedCustomer.contact_id)}
                />
                <SlideOverField
                  label="Synced"
                  value={formatDateTimeValue(selectedCustomer.synced_at)}
                />
              </div>

              <div className="space-y-2 rounded-xl border border-gray-100 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Tags
                </p>
                <TagList tags={selectedCustomer.normalizedTags} />
              </div>

              <div className="space-y-2 rounded-xl border border-gray-100 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Default Address
                </p>
                <RawDataPre value={selectedCustomer.default_address} />
              </div>

              <div className="space-y-2 rounded-xl border border-gray-100 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Raw Shopify Payload
                </p>
                <RawDataPre value={selectedCustomer.raw_data} />
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
