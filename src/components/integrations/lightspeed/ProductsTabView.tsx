import { Package } from "lucide-react";

import { Button } from "@/components/ui-legacy/button";
import type {
  LightspeedPagination,
  LightspeedProductsSortField,
  LightspeedProductTableRow,
  LightspeedSortDirection,
} from "@/hooks/useIntegrationDetailData";

import {
  CategoryMultiSelect,
  DataTabEmptyState,
  DataTabPagination,
  EmptyValue,
  StockCountBadge,
  TableSearchInput,
  TagList,
  ToolbarSelect,
  formatCurrency,
  formatRelativeTimestamp,
  parseTags,
} from "@/components/integrations/shared/dataTabPrimitives";

type ProductsSortValue =
  | "name:asc"
  | "price:desc"
  | "inventory_count:desc"
  | "category:asc";

const PRODUCT_SORT_OPTIONS = [
  { label: "Name A–Z", value: "name:asc" },
  { label: "Price (high–low)", value: "price:desc" },
  { label: "Stock (high–low)", value: "inventory_count:desc" },
  { label: "Category A–Z", value: "category:asc" },
] satisfies Array<{ label: string; value: ProductsSortValue }>;

function getSortValue(
  field: LightspeedProductsSortField,
  direction: LightspeedSortDirection,
) {
  return `${field}:${direction}` as ProductsSortValue;
}

export function ProductsTabView({
  connectionId: _connectionId,
  rows,
  pagination,
  categories,
  isLoading,
  isFetching,
  searchQuery,
  onSearchQueryChange,
  selectedCategories,
  onSelectedCategoriesChange,
  inStockOnly,
  onInStockOnlyChange,
  sortField,
  sortDirection,
  onSortChange,
  onPageChange,
}: {
  connectionId: string;
  rows: LightspeedProductTableRow[];
  pagination: LightspeedPagination;
  categories: string[];
  isLoading: boolean;
  isFetching: boolean;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  selectedCategories: string[];
  onSelectedCategoriesChange: (value: string[]) => void;
  inStockOnly: boolean;
  onInStockOnlyChange: (value: boolean) => void;
  sortField: LightspeedProductsSortField;
  sortDirection: LightspeedSortDirection;
  onSortChange: (
    field: LightspeedProductsSortField,
    direction: LightspeedSortDirection,
  ) => void;
  onPageChange: (page: number) => void;
}) {
  const sortValue = getSortValue(sortField, sortDirection);

  return (
    <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-3">
        <TableSearchInput
          placeholder="Search products..."
          value={searchQuery}
          onChange={onSearchQueryChange}
        />
        <div className="flex items-center gap-3">
          <CategoryMultiSelect
            categories={categories}
            value={selectedCategories}
            onChange={onSelectedCategoriesChange}
          />
          <Button
            type="button"
            variant={inStockOnly ? "default" : "outline"}
            size="sm"
            className="h-8"
            onClick={() => onInStockOnlyChange(!inStockOnly)}
          >
            In stock only
          </Button>
          <ToolbarSelect
            ariaLabel="Sort products"
            value={sortValue}
            onChange={(value) => {
              const [field, direction] = value.split(":") as [
                LightspeedProductsSortField,
                LightspeedSortDirection,
              ];
              onSortChange(field, direction);
            }}
            options={PRODUCT_SORT_OPTIONS}
          />
          <span className="text-xs tabular-nums text-muted-foreground">
            {pagination.totalCount.toLocaleString()} records
          </span>
        </div>
      </div>

      {rows.length > 0 ? (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] border-collapse">
              <thead>
                <tr className="border-b border-gray-100">
                  <th
                    className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                    style={{ width: "280px" }}
                  >
                    Product
                  </th>
                  <th
                    className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                    style={{ width: "140px" }}
                  >
                    Category
                  </th>
                  <th
                    className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                    style={{ width: "100px" }}
                  >
                    Price
                  </th>
                  <th
                    className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                    style={{ width: "100px" }}
                  >
                    Stock
                  </th>
                  <th
                    className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                    style={{ width: "200px" }}
                  >
                    Tags
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
                {rows.map((product) => (
                  <tr
                    key={product.id}
                    className="border-b border-gray-50 transition-colors hover:bg-gray-50"
                  >
                    <td className="px-5 py-3">
                      <div className="text-sm font-medium text-foreground">
                        {product.name}
                      </div>
                      <div className="font-mono text-xs text-muted-foreground">
                        {product.sku ?? "—"}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-sm text-foreground">
                      {product.category ? (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                          {product.category}
                        </span>
                      ) : (
                        <EmptyValue />
                      )}
                    </td>
                    <td className="px-5 py-3 text-right text-sm text-foreground">
                      {formatCurrency(product.price)}
                    </td>
                    <td className="px-5 py-3">
                      <StockCountBadge count={product.inventory_count} />
                    </td>
                    <td className="px-5 py-3 text-sm text-foreground">
                      <TagList tags={parseTags(product.normalizedTags)} />
                    </td>
                    <td className="px-5 py-3 text-sm text-muted-foreground">
                      {product.synced_at ? (
                        formatRelativeTimestamp(product.synced_at)
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
          Loading products…
        </div>
      ) : null}

      {!isLoading && !isFetching && rows.length === 0 ? (
        <DataTabEmptyState
          icon={Package}
          title="No products match this view"
          description="Adjust the search, category filter, or stock toggle to browse synced catalog data."
        />
      ) : null}
    </div>
  );
}
