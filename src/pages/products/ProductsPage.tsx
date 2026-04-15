import { useEffect, useState } from "react";
import Box from "@mui/joy/Box";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { useNavigate } from "react-router-dom";
import { MoreHorizontal, Package, Pencil, Plus, Trash2 } from "lucide-react";
import { JoyAlertDialog } from "@/components/joy/JoyAlertDialog";
import { JoyButton } from "@/components/joy/JoyButton";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import { JoyChip } from "@/components/joy/JoyChip";
import {
  JoyDropdownMenu,
  JoyDropdownMenuContent,
  JoyDropdownMenuItem,
  JoyDropdownMenuTrigger,
} from "@/components/joy/JoyDropdownMenu";
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
  square: "primary",
  stripe: "neutral",
  shopify: "success",
  lightspeed: "warning",
  import: "neutral",
};

const STATUS_COLORS: Record<ProductStatus, "success" | "warning" | "neutral"> =
  {
    active: "success",
    draft: "warning",
    archived: "neutral",
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

  const { data, isLoading } = useProducts({
    ...filters,
    page: currentPage,
    pageSize,
  });
  const { deleteProduct } = useProductMutations();

  const products = data?.products;
  const totalCount = data?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

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
    <Stack spacing={3.5}>
      <Sheet
        variant="plain"
        sx={{
          p: { xs: 3, md: 4 },
          borderRadius: "24px",
          border: "1px solid",
          borderColor: "neutral.200",
          background:
            "linear-gradient(135deg, rgba(20, 83, 45, 0.08) 0%, rgba(239, 246, 255, 0.8) 45%, rgba(255, 255, 255, 1) 100%)",
        }}
      >
        <Stack
          direction={{ xs: "column", lg: "row" }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", lg: "center" }}
        >
          <Stack spacing={1}>
            <Typography level="h1">Products</Typography>
            <Typography level="body-md" color="neutral">
              Manage catalog visibility, status, and inventory across your
              connected channels.
            </Typography>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              <JoyChip color="primary" variant="soft">
                {totalCount.toLocaleString()} products
              </JoyChip>
              <JoyChip color="success" variant="soft">
                Joy table view
              </JoyChip>
            </Stack>
          </Stack>

          <JoyButton
            onClick={() => navigate("/products/new")}
            startDecorator={<Plus />}
          >
            Add Product
          </JoyButton>
        </Stack>
      </Sheet>

      <JoyCard>
        <JoyCardHeader
          title="Catalog"
          description="Filter products by source and status, then open any item for editing."
        />
        <JoyCardContent sx={{ pt: 1 }}>
          <Stack spacing={2.5}>
            <Stack
              direction={{ xs: "column", lg: "row" }}
              spacing={1.5}
              alignItems={{ xs: "stretch", lg: "center" }}
            >
              <JoySearchInput
                value={filters.search}
                onValueChange={handleSearchChange}
                placeholder="Search products..."
                sx={{ flex: 1 }}
              />
              <JoySelect
                value={filters.source || "all"}
                onValueChange={handleSourceChange}
                options={SOURCE_OPTIONS}
                sx={{ minWidth: { xs: "100%", sm: 180 } }}
              />
              <JoySelect
                value={filters.status || "all"}
                onValueChange={handleStatusChange}
                options={STATUS_OPTIONS}
                sx={{ minWidth: { xs: "100%", sm: 160 } }}
              />
            </Stack>

            {isLoading ? (
              <Stack spacing={1.5}>
                {Array.from({ length: Math.min(pageSize, 8) }).map(
                  (_, index) => (
                    <Sheet
                      key={index}
                      variant="outlined"
                      sx={{
                        p: 2,
                        borderRadius: "16px",
                        display: "grid",
                        gridTemplateColumns: "2fr 1fr 1fr 1fr auto",
                        gap: 2,
                        alignItems: "center",
                      }}
                    >
                      <Skeleton variant="text" level="body-sm" />
                      <Skeleton
                        variant="rectangular"
                        sx={{ height: 28, borderRadius: "999px" }}
                      />
                      <Skeleton
                        variant="rectangular"
                        sx={{ height: 28, borderRadius: "999px" }}
                      />
                      <Skeleton variant="text" level="body-sm" />
                      <Skeleton variant="circular" width={28} height={28} />
                    </Sheet>
                  ),
                )}
              </Stack>
            ) : products?.length === 0 ? (
              <Stack
                spacing={2}
                alignItems="center"
                justifyContent="center"
                sx={{ py: { xs: 5, md: 7 }, textAlign: "center" }}
              >
                <Box
                  sx={{
                    width: 64,
                    height: 64,
                    borderRadius: "20px",
                    display: "grid",
                    placeItems: "center",
                    backgroundColor: "neutral.100",
                    color: "neutral.500",
                  }}
                >
                  <Package className="h-8 w-8" />
                </Box>
                <Stack spacing={0.5}>
                  <Typography level="title-md">No products yet</Typography>
                  <Typography level="body-sm" color="neutral">
                    Create your first product or sync inventory from a connected
                    integration.
                  </Typography>
                </Stack>
                <JoyButton
                  onClick={() => navigate("/products/new")}
                  startDecorator={<Plus />}
                >
                  Add Product
                </JoyButton>
              </Stack>
            ) : (
              <>
                <JoyTable stickyHeader>
                  <JoyTableHead>
                    <JoyTableRow>
                      <JoyTableHeaderCell>Product</JoyTableHeaderCell>
                      <JoyTableHeaderCell>Source</JoyTableHeaderCell>
                      <JoyTableHeaderCell>Status</JoyTableHeaderCell>
                      <JoyTableHeaderCell>Inventory</JoyTableHeaderCell>
                      <JoyTableHeaderCell align="right">
                        Price
                      </JoyTableHeaderCell>
                      <JoyTableHeaderCell align="right">
                        Actions
                      </JoyTableHeaderCell>
                    </JoyTableRow>
                  </JoyTableHead>
                  <JoyTableBody>
                    {products?.map((product) => {
                      const lowInventory =
                        product.track_inventory &&
                        product.inventory_count <= product.low_stock_threshold;

                      return (
                        <JoyTableRow
                          key={product.id}
                          clickable
                          onClick={() => navigate(`/products/${product.id}`)}
                        >
                          <JoyTableCell>
                            <Stack spacing={0.35}>
                              <Typography level="title-sm">
                                {product.name}
                              </Typography>
                              <Typography level="body-xs" color="neutral">
                                {product.sku
                                  ? `SKU ${product.sku}`
                                  : "No SKU assigned"}
                              </Typography>
                            </Stack>
                          </JoyTableCell>
                          <JoyTableCell>
                            <JoyChip
                              color={SOURCE_COLORS[product.source]}
                              variant="soft"
                            >
                              {SOURCE_LABELS[product.source]}
                            </JoyChip>
                          </JoyTableCell>
                          <JoyTableCell>
                            <JoyChip
                              color={STATUS_COLORS[product.status]}
                              variant="soft"
                            >
                              {product.status}
                            </JoyChip>
                          </JoyTableCell>
                          <JoyTableCell>
                            <Typography
                              level="body-sm"
                              color={lowInventory ? "danger" : "neutral"}
                            >
                              {product.track_inventory
                                ? `${product.inventory_count} in stock`
                                : "Not tracked"}
                            </Typography>
                          </JoyTableCell>
                          <JoyTableCell align="right">
                            <Typography level="title-sm">
                              {formatPrice(product.price, product.currency)}
                            </Typography>
                          </JoyTableCell>
                          <JoyTableCell align="right">
                            <Box onClick={(event) => event.stopPropagation()}>
                              <JoyDropdownMenu>
                                <JoyDropdownMenuTrigger
                                  aria-label={`Actions for ${product.name}`}
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </JoyDropdownMenuTrigger>
                                <JoyDropdownMenuContent>
                                  <JoyDropdownMenuItem
                                    startDecorator={
                                      <Pencil className="h-4 w-4" />
                                    }
                                    onClick={() =>
                                      navigate(`/products/${product.id}`)
                                    }
                                  >
                                    Edit
                                  </JoyDropdownMenuItem>
                                  <JoyDropdownMenuItem
                                    destructive
                                    startDecorator={
                                      <Trash2 className="h-4 w-4" />
                                    }
                                    onClick={() =>
                                      setDeleteProductId(product.id)
                                    }
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
                  />
                )}
              </>
            )}
          </Stack>
        </JoyCardContent>
      </JoyCard>

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
