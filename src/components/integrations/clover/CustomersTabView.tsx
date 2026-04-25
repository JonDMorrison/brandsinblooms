import { RefreshCw, Users } from "lucide-react";
import Button from "@mui/joy/Button";

import type {
  CloverCustomerTableRow,
  LightspeedPagination,
  LightspeedSortDirection,
  SquareCustomerSortField,
} from "@/hooks/useIntegrationDetailData";

import {
  DataTabCard,
  DataTabEmptyState,
  DataTabPagination,
  EmptyValue,
  RawDataPre,
  SlideOverField,
  TableSearchInput,
  TableSkeleton,
  TagList,
  ToolbarSelect,
  formatDateTimeValue,
  getInitials,
  JoyDataTable,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/integrations/shared/dataTabPrimitives";

type CustomerSortValue =
  | "updated_at:desc"
  | "created_at:desc"
  | "name:asc"
  | "email:asc";

const CUSTOMER_SORT_OPTIONS = [
  { label: "Updated (newest)", value: "updated_at:desc" },
  { label: "Created (newest)", value: "created_at:desc" },
  { label: "Name A-Z", value: "name:asc" },
  { label: "Email A-Z", value: "email:asc" },
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
  field: SquareCustomerSortField,
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
  rows: CloverCustomerTableRow[];
  pagination: LightspeedPagination;
  isLoading: boolean;
  isFetching: boolean;
  customersSynced: number;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  sortField: SquareCustomerSortField;
  sortDirection: LightspeedSortDirection;
  onSortChange: (
    field: SquareCustomerSortField,
    direction: LightspeedSortDirection,
  ) => void;
  selectedCustomer: CloverCustomerTableRow | null;
  onSelectedCustomerChange: (customer: CloverCustomerTableRow | null) => void;
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
            placeholder="Search Clover customers..."
            value={searchQuery}
            onChange={onSearchQueryChange}
          />
          <div className="flex items-center gap-3">
            <ToolbarSelect
              ariaLabel="Sort Clover customers"
              value={sortValue}
              onChange={(value) => {
                const [field, direction] = value.split(":") as [
                  SquareCustomerSortField,
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
                      style={{ width: "280px" }}
                    >
                      Customer
                    </th>
                    <th
                      className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                      style={{ width: "170px" }}
                    >
                      Clover Customer ID
                    </th>
                    <th
                      className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                      style={{ width: "150px" }}
                    >
                      Phone
                    </th>
                    <th
                      className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                      style={{ width: "220px" }}
                    >
                      Tags
                    </th>
                    <th
                      className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                      style={{ width: "140px" }}
                    >
                      Updated
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
                                customer.name,
                                undefined,
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
                      <td className="px-5 py-3 font-mono text-xs text-foreground">
                        {customer.external_id ?? <EmptyValue />}
                      </td>
                      <td className="px-5 py-3 text-sm text-foreground">
                        {customer.phone ? (
                          formatPhoneNumber(customer.phone)
                        ) : (
                          <EmptyValue />
                        )}
                      </td>
                      <td className="px-5 py-3 text-sm text-foreground">
                        <TagList tags={customer.normalizedTags} />
                      </td>
                      <td className="px-5 py-3 text-sm text-muted-foreground">
                        {formatDateTimeValue(customer.updated_at)}
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
            title="No Clover customers synced yet"
            description="Run a Clover sync to import customer records into this integration view."
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
            title="No Clover customers match this view"
            description="Adjust the search or sort to browse a different slice of synced Clover customers."
          />
        ) : null}
      </DataTabCard>

      <Sheet
        open={Boolean(selectedCustomer)}
        onOpenChange={(open) => {
          if (!open) {
            onSelectedCustomerChange(null);
          }
        }}
      >
        <SheetContent className="w-full sm:max-w-xl">
          {selectedCustomer ? (
            <>
              <SheetHeader>
                <SheetTitle>{selectedCustomer.displayName}</SheetTitle>
                <SheetDescription>
                  Clover customer detail from the shared POS storage layer.
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6 overflow-y-auto pb-6">
                <div className="space-y-3">
                  <SlideOverField
                    label="Email"
                    value={selectedCustomer.email}
                  />
                  <SlideOverField
                    label="Phone"
                    value={formatPhoneNumber(selectedCustomer.phone)}
                  />
                  <SlideOverField
                    label="Clover Customer ID"
                    value={selectedCustomer.external_id}
                    valueClassName="font-mono text-xs"
                  />
                  <SlideOverField
                    label="Updated"
                    value={formatDateTimeValue(selectedCustomer.updated_at)}
                  />
                  <SlideOverField
                    label="Tags"
                    value={<TagList tags={selectedCustomer.normalizedTags} />}
                  />
                </div>

                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Raw record
                  </div>
                  <RawDataPre value={selectedCustomer.raw_data} />
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
