import { useState } from "react";
import { Package, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui-legacy/button";

import type {
  LightspeedPagination,
  LightspeedSortDirection,
  ShopifyProductTableRow,
  ShopifyProductsSortField,
} from "@/hooks/useIntegrationDetailData";

import {
  CategoryMultiSelect,
  CopyValueButton,
  DataTabEmptyState,
  DataTabPagination,
  RawDataPre,
  SlideOverField,
  StockCountBadge,
  TableSearchInput,
  TagList,
  ToolbarSelect,
  formatDateTimeValue,
  DataTabLoadingState,
  JoyDataTable,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/integrations/shared/dataTabPrimitives";

type ProductSortValue =
  | "updated_at:desc"
  | "title:asc"
  | "vendor:asc"
  | "product_type:asc"
  | "inventory_quantity:desc";

const PRODUCT_SORT_OPTIONS = [
  { label: "Recently updated", value: "updated_at:desc" },
  { label: "Title A-Z", value: "title:asc" },
  { label: "Vendor A-Z", value: "vendor:asc" },
  { label: "Type A-Z", value: "product_type:asc" },
  { label: "Stock high-low", value: "inventory_quantity:desc" },
] satisfies Array<{ label: string; value: ProductSortValue }>;

function getSortValue(
  field: ShopifyProductsSortField,
  direction: LightspeedSortDirection,
) {
  return `${field}:${direction}` as ProductSortValue;
}

export function ProductsTabView({
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
  onTriggerSync,
}: {
  rows: ShopifyProductTableRow[];
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
  sortField: ShopifyProductsSortField;
  sortDirection: LightspeedSortDirection;
  onSortChange: (
    field: ShopifyProductsSortField,
    direction: LightspeedSortDirection,
  ) => void;
  onPageChange: (page: number) => void;
  onTriggerSync: () => void;
}) {
  const [selectedProduct, setSelectedProduct] =
    useState<ShopifyProductTableRow | null>(null);
  const sortValue = getSortValue(sortField, sortDirection);
  const showFilteredEmptyState = rows.length === 0 && !isLoading && !isFetching;

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-3">
          <TableSearchInput
            placeholder="Search products..."
            value={searchQuery}
            onChange={onSearchQueryChange}
          />
          <div className="flex flex-wrap items-center gap-3">
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
              ariaLabel="Sort Shopify products"
              value={sortValue}
              onChange={(value) => {
                const [field, direction] = value.split(":") as [
                  ShopifyProductsSortField,
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
              <JoyDataTable>
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Product
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Vendor
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Type
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Stock
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Variants
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Images
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Updated
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((product) => (
                    <tr
                      key={product.id}
                      className="cursor-pointer border-b border-gray-50 transition-colors hover:bg-gray-50"
                      onClick={() => setSelectedProduct(product)}
                    >
                      <td className="px-5 py-3">
                        <div className="font-medium text-foreground">
                          {product.title ?? product.shopify_product_id}
                        </div>
                        <div className="font-mono text-xs text-muted-foreground">
                          {product.shopify_product_id}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-sm text-foreground">
                        {product.vendor ?? "-"}
                      </td>
                      <td className="px-5 py-3 text-sm text-foreground">
                        {product.product_type ?? "-"}
                      </td>
                      <td className="px-5 py-3 text-right text-sm">
                        <StockCountBadge count={product.inventory_quantity} />
                      </td>
                      <td className="px-5 py-3 text-right text-sm text-foreground">
                        {product.variantCount.toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-right text-sm text-foreground">
                        {product.imageCount.toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-sm text-muted-foreground">
                        {formatDateTimeValue(product.updated_at)}
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

        {showFilteredEmptyState ? (
          <DataTabEmptyState
            icon={Package}
            title="No Shopify products match this view"
            description="Adjust the search, category filter, or stock toggle to inspect a different slice of synced Shopify catalog data."
            action={
              pagination.totalCount === 0 ? (
                <Button variant="outline" size="sm" onClick={onTriggerSync}>
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  Sync now
                </Button>
              ) : undefined
            }
          />
        ) : null}
      </div>

      <Sheet
        open={Boolean(selectedProduct)}
        onOpenChange={() => setSelectedProduct(null)}
      >
        <SheetContent className="w-[440px] overflow-y-auto sm:w-[520px]">
          {selectedProduct ? (
            <div className="space-y-4">
              <SheetHeader className="border-b border-gray-100 pb-4 text-left">
                <SheetTitle>
                  {selectedProduct.title ?? selectedProduct.shopify_product_id}
                </SheetTitle>
                <SheetDescription className="sr-only">
                  Shopify product details and raw payload for
                  {` ${selectedProduct.shopify_product_id}`}.
                </SheetDescription>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-mono">
                    {selectedProduct.shopify_product_id}
                  </span>
                  <CopyValueButton
                    value={selectedProduct.shopify_product_id}
                    label="Shopify product ID"
                  />
                </div>
              </SheetHeader>

              <div className="space-y-3 rounded-xl border border-gray-100 bg-white p-4">
                <SlideOverField
                  label="Vendor"
                  value={selectedProduct.vendor ?? null}
                />
                <SlideOverField
                  label="Product type"
                  value={selectedProduct.product_type ?? null}
                />
                <SlideOverField
                  label="Status"
                  value={selectedProduct.status ?? null}
                />
                <SlideOverField
                  label="Inventory"
                  value={String(selectedProduct.inventory_quantity ?? 0)}
                />
                <SlideOverField
                  label="Variants"
                  value={String(selectedProduct.variantCount)}
                />
                <SlideOverField
                  label="Images"
                  value={String(selectedProduct.imageCount)}
                />
                <SlideOverField
                  label="Updated"
                  value={formatDateTimeValue(selectedProduct.updated_at)}
                />
                <SlideOverField
                  label="Synced"
                  value={formatDateTimeValue(selectedProduct.synced_at)}
                />
              </div>

              <div className="space-y-2 rounded-xl border border-gray-100 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Tags
                </p>
                <TagList tags={selectedProduct.normalizedTags} />
              </div>

              <div className="space-y-2 rounded-xl border border-gray-100 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Variants
                </p>
                <RawDataPre value={selectedProduct.variants} />
              </div>

              <div className="space-y-2 rounded-xl border border-gray-100 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Images
                </p>
                <RawDataPre value={selectedProduct.images} />
              </div>

              <div className="space-y-2 rounded-xl border border-gray-100 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Raw Shopify Payload
                </p>
                <RawDataPre value={selectedProduct.raw_data} />
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
