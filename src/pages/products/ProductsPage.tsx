import { useEffect, useState } from "react";
import Box from "@mui/joy/Box";
import Divider from "@mui/joy/Divider";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { useNavigate } from "react-router-dom";
import { MoreHorizontal, Package, Pencil, Plus, Trash2 } from "lucide-react";
import { JoyAlertDialog } from "@/components/joy/JoyAlertDialog";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyChip } from "@/components/joy/JoyChip";
import {
  JoyDropdownMenu,
  JoyDropdownMenuContent,
  JoyDropdownMenuItem,
  JoyDropdownMenuTrigger,
} from "@/components/joy/JoyDropdownMenu";
import { JoyEmptyState } from "@/components/joy/JoyEmptyState";
import { JoySearchInput } from "@/components/joy/JoySearchInput";
import { JoySelect } from "@/components/joy/JoySelect";
import {
  JoyTable,
  JoyTableBody,
  JoyTableCell,
  JoyTableHead,
  JoyTableHeaderCell,
  JoyTablePagination,
  JoyTableRow,
} from "@/components/joy/JoyTable";
import { useProducts, useProductMutations } from "@/hooks/useProducts";
import { ProductFilters, ProductSource, ProductStatus } from "@/types/product";

const SOURCE_LABELS: Record<ProductSource, string> = {
  platform: "Platform",
  square: "Square",
  stripe: "Stripe",
  shopify: "Shopify",
  lightspeed: "Lightspeed",
  import: "Import",
};

const SOURCE_COLORS: Record<
  ProductSource,
  "primary" | "success" | "warning" | "neutral" | "danger"
> = {
  platform: "primary",
  square: "neutral",
  stripe: "neutral",
  shopify: "neutral",
  lightspeed: "neutral",
  import: "neutral",
};

const STATUS_COLORS: Record<ProductStatus, "success" | "warning" | "neutral"> =
  {
    active: "success",
    draft: "warning",
    archived: "neutral",
  };

const STATUS_LABELS: Record<ProductStatus, string> = {
  active: "Active",
  draft: "Draft",
  archived: "Archived",
};

const SOURCE_OPTIONS = [
  { value: "all", label: "All Sources" },
  { value: "platform", label: "Platform" },
  { value: "square", label: "Square" },
  { value: "stripe", label: "Stripe" },
  { value: "shopify", label: "Shopify" },
  { value: "lightspeed", label: "Lightspeed" },
  { value: "import", label: "Import" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "All Status" },
  { value: "active", label: "Active" },
  { value: "draft", label: "Draft" },
  { value: "archived", label: "Archived" },
];

const PAGE_SIZE_OPTIONS = [12, 24, 48];

function ProductTableSkeleton({ rowCount }: { rowCount: number }) {
  return (
    <JoyTable stickyHeader>
      <JoyTableHead>
        <JoyTableRow>
          <JoyTableHeaderCell sx={{ width: "42%", px: 3 }}>
            Product
          </JoyTableHeaderCell>
          <JoyTableHeaderCell sx={{ width: 140 }}>Source</JoyTableHeaderCell>
          <JoyTableHeaderCell sx={{ width: 120 }}>Status</JoyTableHeaderCell>
          <JoyTableHeaderCell sx={{ width: 120 }}>Inventory</JoyTableHeaderCell>
          <JoyTableHeaderCell align="right" sx={{ width: 120 }}>
            Price
          </JoyTableHeaderCell>
          <JoyTableHeaderCell align="right" sx={{ width: 68, px: 3 }}>
            Actions
          </JoyTableHeaderCell>
        </JoyTableRow>
      </JoyTableHead>
      <JoyTableBody>
        {Array.from({ length: rowCount }).map((_, index) => (
          <JoyTableRow key={index}>
            <JoyTableCell sx={{ px: 3 }}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Skeleton
                  variant="rectangular"
                  animation="wave"
                  width={44}
                  height={44}
                  sx={{ borderRadius: "var(--joy-radius-md)", flexShrink: 0 }}
                />
                <Stack spacing={0.75} sx={{ minWidth: 0, flex: 1 }}>
                  <Skeleton
                    variant="text"
                    animation="wave"
                    sx={{ width: "55%", height: 18 }}
                  />
                  <Skeleton
                    variant="text"
                    animation="wave"
                    sx={{ width: "35%", height: 14 }}
                  />
                </Stack>
              </Stack>
            </JoyTableCell>
            <JoyTableCell>
              <Skeleton
                variant="rectangular"
                animation="wave"
                sx={{ width: 72, height: 24, borderRadius: "999px" }}
              />
            </JoyTableCell>
            <JoyTableCell>
              <Skeleton
                variant="rectangular"
                animation="wave"
                sx={{ width: 64, height: 24, borderRadius: "999px" }}
              />
            </JoyTableCell>
            <JoyTableCell>
              <Skeleton
                variant="text"
                animation="wave"
                sx={{ width: 48, height: 16 }}
              />
            </JoyTableCell>
            <JoyTableCell align="right">
              <Skeleton
                variant="text"
                animation="wave"
                sx={{ width: 56, height: 16, ml: "auto" }}
              />
            </JoyTableCell>
            <JoyTableCell align="right" sx={{ px: 3 }}>
              <Skeleton
                variant="circular"
                animation="wave"
                width={28}
                height={28}
                sx={{ ml: "auto" }}
              />
            </JoyTableCell>
          </JoyTableRow>
        ))}
      </JoyTableBody>
    </JoyTable>
  );
}

export default function ProductsPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<ProductFilters>({
    search: "",
    source: "all",
    status: "all",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(24);
  const [deleteProductId, setDeleteProductId] = useState<string | null>(null);

  const { data, isLoading, isFetching } = useProducts({
    ...filters,
    page: currentPage,
    pageSize,
  });
  const { deleteProduct } = useProductMutations();

  const products = data?.products;
  const totalCount = data?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / pageSize);
  const hasActiveFilters =
    filters.search.trim().length > 0 ||
    filters.source !== "all" ||
    filters.status !== "all";
  const showSkeleton = isLoading || isFetching;
  const visibleSkeletonRows = Math.min(pageSize, 8);

  // Reset to page 1 when filters change
  const handleSearchChange = (value: string) => {
    setFilters((prev) => ({ ...prev, search: value }));
    setCurrentPage(1);
  };

  const handleSourceChange = (value: string) => {
    setFilters((prev) => ({ ...prev, source: value as ProductSource | "all" }));
    setCurrentPage(1);
  };

  const handleStatusChange = (value: string) => {
    setFilters((prev) => ({ ...prev, status: value as ProductStatus | "all" }));
    setCurrentPage(1);
  };

  const handlePageSizeChange = (value: string) => {
    setPageSize(Number(value));
    setCurrentPage(1);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger if not focused on an input
      if (document.activeElement?.tagName === "INPUT") return;

      if (e.key === "ArrowLeft" && currentPage > 1) {
        setCurrentPage((p) => p - 1);
      } else if (e.key === "ArrowRight" && currentPage < totalPages) {
        setCurrentPage((p) => p + 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentPage, totalPages]);

  const handleDelete = async () => {
    if (deleteProductId) {
      await deleteProduct.mutateAsync(deleteProductId);
      setDeleteProductId(null);
    }
  };

  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
    }).format(price);
  };

  return (
    <Stack spacing={4.5}>
      <Sheet
        variant="plain"
        sx={{
          backgroundColor: "transparent",
          border: 0,
          boxShadow: "none",
          p: 0,
        }}
      >
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "center" }}
        >
          <Stack spacing={0.75} sx={{ minWidth: 0 }}>
            <Typography
              level="h1"
              sx={{
                fontSize: "22px",
                fontWeight: 700,
                color: "neutral.900",
                fontFamily: "var(--joy-fontFamily-body)",
                letterSpacing: "-0.01em",
              }}
            >
              Products
            </Typography>
            <Typography
              level="body-sm"
              sx={{
                fontSize: "13px",
                color: "neutral.500",
                maxWidth: 480,
                lineHeight: 1.5,
              }}
            >
              Manage your product catalog, inventory, and pricing.
            </Typography>
            {showSkeleton ? (
              <Skeleton
                variant="rectangular"
                animation="wave"
                sx={{ width: 72, height: 14, borderRadius: "999px" }}
              />
            ) : (
              <Typography
                level="body-xs"
                sx={{
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "neutral.400",
                  letterSpacing: "0.02em",
                }}
              >
                {totalCount.toLocaleString()} products
              </Typography>
            )}
          </Stack>

          <JoyButton
            size="sm"
            onClick={() => navigate("/products/new")}
            startDecorator={<Plus size={16} />}
          >
            Add Product
          </JoyButton>
        </Stack>
      </Sheet>

      <Sheet
        variant="outlined"
        sx={{
          borderRadius: "var(--joy-radius-xl)",
          borderColor: "neutral.200",
          backgroundColor: "background.surface",
          boxShadow: "none",
          overflow: "hidden",
        }}
      >
        <Stack spacing={0}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1.5}
            justifyContent="space-between"
            alignItems={{ xs: "stretch", md: "center" }}
            sx={{ px: 3, py: 2.5 }}
          >
            <JoySearchInput
              value={filters.search}
              onValueChange={handleSearchChange}
              placeholder="Search by name or SKU..."
              sx={{ flex: 1, maxWidth: 360 }}
            />
            <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
              <JoySelect
                value={filters.source || "all"}
                onValueChange={handleSourceChange}
                options={SOURCE_OPTIONS}
                sx={{ minWidth: 160 }}
              />
              <JoySelect
                value={filters.status || "all"}
                onValueChange={handleStatusChange}
                options={STATUS_OPTIONS}
                sx={{ minWidth: 160 }}
              />
            </Stack>
          </Stack>

          <Divider
            sx={{ "--Divider-lineColor": "var(--joy-palette-neutral-100)" }}
          />

          {showSkeleton ? (
            <ProductTableSkeleton rowCount={visibleSkeletonRows} />
          ) : products?.length === 0 ? (
            <Box sx={{ minHeight: 360, display: "grid", placeItems: "center" }}>
              <JoyEmptyState
                icon={
                  <Box
                    sx={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "neutral.300",
                      "& .lucide": {
                        width: 40,
                        height: 40,
                      },
                    }}
                  >
                    <Package size={40} strokeWidth={1.2} />
                  </Box>
                }
                title={
                  <Box
                    component="span"
                    sx={{
                      fontSize: "15px",
                      fontWeight: 600,
                      color: "neutral.800",
                    }}
                  >
                    No products found
                  </Box>
                }
                description={
                  <Box component="span" sx={{ color: "neutral.500" }}>
                    {hasActiveFilters
                      ? "Try adjusting your filters or search term."
                      : "Create your first product to get started."}
                  </Box>
                }
                primaryAction={
                  hasActiveFilters
                    ? undefined
                    : {
                        label: "Add Product",
                        size: "sm",
                        onClick: () => navigate("/products/new"),
                        startDecorator: <Plus size={16} />,
                      }
                }
              />
            </Box>
          ) : (
            <>
              <JoyTable stickyHeader>
                <JoyTableHead>
                  <JoyTableRow>
                    <JoyTableHeaderCell sx={{ width: "42%", px: 3 }}>
                      Product
                    </JoyTableHeaderCell>
                    <JoyTableHeaderCell sx={{ width: 140 }}>
                      Source
                    </JoyTableHeaderCell>
                    <JoyTableHeaderCell sx={{ width: 120 }}>
                      Status
                    </JoyTableHeaderCell>
                    <JoyTableHeaderCell sx={{ width: 120 }}>
                      Inventory
                    </JoyTableHeaderCell>
                    <JoyTableHeaderCell align="right" sx={{ width: 120 }}>
                      Price
                    </JoyTableHeaderCell>
                    <JoyTableHeaderCell align="right" sx={{ width: 68, px: 3 }}>
                      Actions
                    </JoyTableHeaderCell>
                  </JoyTableRow>
                </JoyTableHead>
                <JoyTableBody>
                  {products?.map((product) => {
                    const inventoryCount = product.inventory_count;
                    const lowStockThreshold = product.low_stock_threshold;
                    const lowInventory =
                      product.track_inventory &&
                      inventoryCount <= lowStockThreshold;

                    return (
                      <JoyTableRow
                        key={product.id}
                        clickable
                        onClick={() => navigate(`/products/${product.id}`)}
                        hoverColor="var(--joy-palette-neutral-50)"
                      >
                        <JoyTableCell sx={{ px: 3 }}>
                          <Stack
                            direction="row"
                            spacing={1.5}
                            alignItems="center"
                            sx={{ minWidth: 0 }}
                          >
                            <Sheet
                              variant="soft"
                              color="neutral"
                              sx={{
                                width: 44,
                                height: 44,
                                borderRadius: "var(--joy-radius-md)",
                                display: "grid",
                                placeItems: "center",
                                flexShrink: 0,
                                color: "neutral.400",
                              }}
                            >
                              <Package size={18} />
                            </Sheet>
                            <Stack spacing={0.35} sx={{ minWidth: 0 }}>
                              <Typography
                                sx={{
                                  fontSize: "14px",
                                  fontWeight: 500,
                                  color: "neutral.900",
                                  lineHeight: 1.35,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {product.name}
                              </Typography>
                              <Typography
                                sx={{
                                  fontSize: "12px",
                                  color: "neutral.400",
                                  fontWeight: 400,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {product.sku || "No SKU"}
                              </Typography>
                            </Stack>
                          </Stack>
                        </JoyTableCell>

                        <JoyTableCell>
                          <JoyChip
                            color={SOURCE_COLORS[product.source]}
                            variant="soft"
                            size="sm"
                          >
                            {SOURCE_LABELS[product.source]}
                          </JoyChip>
                        </JoyTableCell>

                        <JoyTableCell>
                          <JoyChip
                            color={STATUS_COLORS[product.status]}
                            variant="soft"
                            size="sm"
                          >
                            {STATUS_LABELS[product.status]}
                          </JoyChip>
                        </JoyTableCell>

                        <JoyTableCell>
                          <Typography
                            sx={{
                              fontSize: "13px",
                              lineHeight: 1.45,
                              color: product.track_inventory
                                ? lowInventory
                                  ? "danger.600"
                                  : "neutral.600"
                                : "neutral.300",
                              fontWeight:
                                product.track_inventory && lowInventory
                                  ? 500
                                  : 400,
                            }}
                          >
                            {product.track_inventory
                              ? `${inventoryCount}`
                              : "—"}
                          </Typography>
                        </JoyTableCell>

                        <JoyTableCell align="right">
                          <Typography
                            sx={{
                              fontFamily: "var(--joy-fontFamily-body)",
                              fontSize: "14px",
                              fontWeight: 600,
                              color: "neutral.900",
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            {formatPrice(product.price, product.currency)}
                          </Typography>
                        </JoyTableCell>

                        <JoyTableCell align="right" sx={{ px: 3 }}>
                          <Box onClick={(event) => event.stopPropagation()}>
                            <JoyDropdownMenu>
                              <JoyDropdownMenuTrigger
                                variant="plain"
                                color="neutral"
                                size="sm"
                                aria-label={`Actions for ${product.name}`}
                              >
                                <MoreHorizontal size={16} />
                              </JoyDropdownMenuTrigger>
                              <JoyDropdownMenuContent>
                                <JoyDropdownMenuItem
                                  startDecorator={<Pencil size={16} />}
                                  onClick={() =>
                                    navigate(`/products/${product.id}`)
                                  }
                                >
                                  Edit
                                </JoyDropdownMenuItem>
                                <JoyDropdownMenuItem
                                  destructive
                                  startDecorator={<Trash2 size={16} />}
                                  onClick={() => setDeleteProductId(product.id)}
                                >
                                  Delete
                                </JoyDropdownMenuItem>
                              </JoyDropdownMenuContent>
                            </JoyDropdownMenu>
                          </Box>
                        </JoyTableCell>
                      </JoyTableRow>
                    );
                  })}
                </JoyTableBody>
              </JoyTable>

              {totalPages > 1 && (
                <JoyTablePagination
                  page={currentPage}
                  pageSize={pageSize}
                  totalCount={totalCount}
                  pageSizeOptions={PAGE_SIZE_OPTIONS}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={handlePageSizeChange}
                  sx={{
                    px: 3,
                    py: 2,
                    borderTop: "1px solid",
                    borderColor: "neutral.100",
                  }}
                />
              )}
            </>
          )}
        </Stack>
      </Sheet>

      <JoyAlertDialog
        open={Boolean(deleteProductId)}
        onClose={() => setDeleteProductId(null)}
        onConfirm={handleDelete}
        title="Delete product"
        description="Are you sure you want to delete this product? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
      />
    </Stack>
  );
}
