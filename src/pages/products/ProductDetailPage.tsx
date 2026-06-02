import { useCallback, useEffect, useRef, useState } from "react";
import Box from "@mui/joy/Box";
import IconButton from "@mui/joy/IconButton";
import Skeleton from "@mui/joy/Skeleton";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Image as ImageIcon,
  Plus,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AskBloomResourceTrigger } from "@/components/askBloom/AskBloomResourceTrigger";
import { JoyAlertDialog } from "@/components/joy/JoyAlertDialog";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyChip } from "@/components/joy/JoyChip";
import {
  JoyDialog,
  JoyDialogActions,
  JoyDialogContent,
} from "@/components/joy/JoyDialog";
import { JoyFormSection } from "@/components/joy/JoyFormSection";
import { JoyInput } from "@/components/joy/JoyInput";
import { JoySelect } from "@/components/joy/JoySelect";
import { JoySwitch } from "@/components/joy/JoySwitch";
import { JoyTextarea } from "@/components/joy/JoyTextarea";
import {
  useProduct,
  useProductImages,
  useProductMutations,
  useProductVariations,
} from "@/hooks/useProducts";
import { supabase } from "@/integrations/supabase/client";
import { Product, ProductFormData } from "@/types/product";
import { buildProductFocus } from "@/utils/askBloomContextBuilders";
import { registerResourceAccessor } from "@/utils/askBloomResourceRegistry";

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
];

const STATUS_LABELS = {
  active: "Active",
  archived: "Archived",
  draft: "Draft",
} as const;

const SOURCE_LABELS: Record<string, string> = {
  import: "Import",
  lightspeed: "Lightspeed",
  platform: "Platform",
  shopify: "Shopify",
  square: "Square",
  stripe: "Stripe",
};

function formatRelativeTime(value: string | null | undefined) {
  if (!value) {
    return "recently";
  }

  const target = new Date(value).getTime();

  if (Number.isNaN(target)) {
    return "recently";
  }

  const diffMs = target - Date.now();
  const absMs = Math.abs(diffMs);

  if (absMs < 60_000) {
    return "just now";
  }

  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const units = [
    { unit: "year", amount: 1000 * 60 * 60 * 24 * 365 },
    { unit: "month", amount: 1000 * 60 * 60 * 24 * 30 },
    { unit: "week", amount: 1000 * 60 * 60 * 24 * 7 },
    { unit: "day", amount: 1000 * 60 * 60 * 24 },
    { unit: "hour", amount: 1000 * 60 * 60 },
    { unit: "minute", amount: 1000 * 60 },
  ] as const;

  for (const { unit, amount } of units) {
    if (absMs >= amount) {
      return rtf.format(Math.round(diffMs / amount), unit);
    }
  }

  return "just now";
}

function getSourceLabel(source: string | null | undefined) {
  if (!source) {
    return "Unknown source";
  }

  return SOURCE_LABELS[source] ?? source.replace(/[_-]+/g, " ");
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
  }).format(value);
}

function FormFieldSkeleton({
  height = 42,
  labelWidth = 64,
}: {
  height?: number;
  labelWidth?: number;
}) {
  return (
    <Stack spacing={0.75}>
      <Skeleton
        variant="text"
        animation="wave"
        sx={{ width: labelWidth, height: 12 }}
      />
      <Skeleton
        variant="rectangular"
        animation="wave"
        sx={{ height, borderRadius: "var(--joy-radius-lg)" }}
      />
    </Stack>
  );
}

function SectionShellSkeleton({
  children,
  actionWidth,
}: {
  children: React.ReactNode;
  actionWidth?: number;
}) {
  return (
    <JoyFormSection
      title={
        <Skeleton
          variant="text"
          animation="wave"
          sx={{ width: 140, height: 16 }}
        />
      }
      description={
        <Skeleton
          variant="text"
          animation="wave"
          sx={{ width: 220, height: 12 }}
        />
      }
      headerActions={
        actionWidth ? (
          <Skeleton
            variant="rectangular"
            animation="wave"
            sx={{
              width: actionWidth,
              height: 36,
              borderRadius: "var(--joy-radius-md)",
            }}
          />
        ) : undefined
      }
    >
      {children}
    </JoyFormSection>
  );
}

function ProductDetailPageSkeleton() {
  return (
    <Stack spacing={4.5}>
      <Stack spacing={3}>
        <Skeleton variant="circular" animation="wave" width={32} height={32} />

        <Stack
          direction={{ xs: "column", lg: "row" }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", lg: "flex-start" }}
        >
          <Stack spacing={1}>
            <Skeleton
              variant="text"
              animation="wave"
              sx={{ width: 200, height: 24 }}
            />
            <Skeleton
              variant="text"
              animation="wave"
              sx={{ width: 280, height: 14 }}
            />
            <Stack direction="row" spacing={0.75}>
              <Skeleton
                variant="rectangular"
                animation="wave"
                sx={{ width: 72, height: 24, borderRadius: "999px" }}
              />
              <Skeleton
                variant="rectangular"
                animation="wave"
                sx={{ width: 72, height: 24, borderRadius: "999px" }}
              />
            </Stack>
          </Stack>

          <Stack direction="row" spacing={1}>
            <Skeleton
              variant="rectangular"
              animation="wave"
              sx={{
                width: 120,
                height: 36,
                borderRadius: "var(--joy-radius-md)",
              }}
            />
            <Skeleton
              variant="rectangular"
              animation="wave"
              sx={{
                width: 120,
                height: 36,
                borderRadius: "var(--joy-radius-md)",
              }}
            />
          </Stack>
        </Stack>
      </Stack>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "2fr 1fr" },
          gap: 3,
        }}
      >
        <Stack spacing={3}>
          <SectionShellSkeleton>
            <FormFieldSkeleton labelWidth={52} />
            <FormFieldSkeleton labelWidth={78} height={96} />
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "minmax(0, 1fr)",
                  md: "repeat(2, minmax(0, 1fr))",
                },
                gap: 2,
              }}
            >
              <FormFieldSkeleton labelWidth={40} />
              <FormFieldSkeleton labelWidth={60} />
            </Box>
          </SectionShellSkeleton>

          <SectionShellSkeleton>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "minmax(0, 1fr)",
                  md: "repeat(3, minmax(0, 1fr))",
                },
                gap: 2,
              }}
            >
              <FormFieldSkeleton labelWidth={40} />
              <FormFieldSkeleton labelWidth={72} />
              <FormFieldSkeleton labelWidth={40} />
            </Box>
          </SectionShellSkeleton>

          <SectionShellSkeleton>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
            >
              <Stack spacing={0.5}>
                <Skeleton
                  variant="text"
                  animation="wave"
                  sx={{ width: 112, height: 14 }}
                />
                <Skeleton
                  variant="text"
                  animation="wave"
                  sx={{ width: 188, height: 12 }}
                />
              </Stack>
              <Skeleton
                variant="rectangular"
                animation="wave"
                sx={{ width: 42, height: 24, borderRadius: "999px" }}
              />
            </Stack>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "minmax(0, 1fr)",
                  md: "repeat(2, minmax(0, 1fr))",
                },
                gap: 2,
              }}
            >
              <FormFieldSkeleton labelWidth={112} />
              <FormFieldSkeleton labelWidth={120} />
            </Box>
          </SectionShellSkeleton>
        </Stack>

        <Stack spacing={3}>
          <SectionShellSkeleton>
            <FormFieldSkeleton labelWidth={48} />
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
            >
              <Stack spacing={0.5}>
                <Skeleton
                  variant="text"
                  animation="wave"
                  sx={{ width: 120, height: 14 }}
                />
                <Skeleton
                  variant="text"
                  animation="wave"
                  sx={{ width: 180, height: 12 }}
                />
              </Stack>
              <Skeleton
                variant="rectangular"
                animation="wave"
                sx={{ width: 42, height: 24, borderRadius: "999px" }}
              />
            </Stack>
          </SectionShellSkeleton>

          <SectionShellSkeleton actionWidth={92}>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 1.5,
              }}
            >
              {Array.from({ length: 2 }).map((_, index) => (
                <Skeleton
                  key={index}
                  variant="rectangular"
                  animation="wave"
                  sx={{
                    width: "100%",
                    aspectRatio: "1 / 1",
                    borderRadius: "var(--joy-radius-lg)",
                  }}
                />
              ))}
            </Box>
          </SectionShellSkeleton>

          <SectionShellSkeleton>
            <FormFieldSkeleton labelWidth={56} />
            <FormFieldSkeleton labelWidth={84} />
          </SectionShellSkeleton>
        </Stack>
      </Box>
    </Stack>
  );
}

export default function ProductDetailPage() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const isNew = productId === "new";

  const { data: product, isLoading } = useProduct(
    isNew ? undefined : productId,
  );
  const { createProduct, updateProduct, deleteProduct } = useProductMutations();
  const { createVariation, deleteVariation } = useProductVariations(productId);
  const { addImage, deleteImage, setPrimaryImage } =
    useProductImages(productId);

  const [formData, setFormData] = useState<ProductFormData>({
    name: "",
    description: "",
    sku: "",
    barcode: "",
    price: 0,
    cost_price: undefined,
    compare_at_price: undefined,
    currency: "USD",
    inventory_count: 0,
    track_inventory: true,
    low_stock_threshold: 5,
    category: "",
    subcategory: "",
    tags: [],
    status: "draft",
    is_visible: true,
    meta_title: "",
    meta_description: "",
  });
  const [hasInitializedForm, setHasInitializedForm] = useState(isNew);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showVariationDialog, setShowVariationDialog] = useState(false);
  const [newVariation, setNewVariation] = useState({
    name: "",
    sku: "",
    price: 0,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [shouldRenderInventoryFields, setShouldRenderInventoryFields] =
    useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];

    if (!file || !productId) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }

    setIsUploadingImage(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${productId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        throw uploadError;
      }

      const { data: urlData } = supabase.storage
        .from("product-images")
        .getPublicUrl(fileName);

      await addImage.mutateAsync({
        product_id: productId,
        image_url: urlData.publicUrl,
        alt_text: file.name,
        source: "upload",
        is_primary: product?.images?.length === 0,
        sort_order: (product?.images?.length || 0) + 1,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("Upload error:", error);
      toast.error(`Failed to upload image: ${message}`);
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  useEffect(() => {
    setHasInitializedForm(isNew);
  }, [isNew, productId]);

  useEffect(() => {
    if (product && !isNew) {
      const nextFormData: ProductFormData = {
        name: product.name,
        description: product.description || "",
        sku: product.sku || "",
        barcode: product.barcode || "",
        price: product.price,
        cost_price: product.cost_price,
        compare_at_price: product.compare_at_price,
        currency: product.currency,
        inventory_count: product.inventory_count,
        track_inventory: product.track_inventory,
        low_stock_threshold: product.low_stock_threshold,
        category: product.category || "",
        subcategory: product.subcategory || "",
        tags: product.tags || [],
        status: product.status,
        is_visible: product.is_visible,
        meta_title: product.meta_title || "",
        meta_description: product.meta_description || "",
      };

      setFormData(nextFormData);
      setShouldRenderInventoryFields(Boolean(nextFormData.track_inventory));
      setHasInitializedForm(true);
    }
  }, [product, isNew]);

  useEffect(() => {
    if (formData.track_inventory) {
      setShouldRenderInventoryFields(true);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setShouldRenderInventoryFields(false);
    }, 200);

    return () => window.clearTimeout(timeoutId);
  }, [formData.track_inventory]);

  const buildProductResourceFocus = useCallback(
    (currentProduct: Product) =>
      buildProductFocus(
        currentProduct,
        currentProduct.variations ?? [],
        undefined,
      ),
    [],
  );

  useEffect(() => {
    if (isNew || !product?.id) {
      return;
    }

    return registerResourceAccessor("product", {
      getResourceFocus: (resourceId, queryClient) => {
        if (resourceId === product.id) {
          return buildProductResourceFocus(product);
        }

        const cachedProduct = queryClient.getQueryData<Product | null>([
          "product",
          resourceId,
        ]);
        if (!cachedProduct) {
          return null;
        }

        return buildProductResourceFocus(cachedProduct);
      },
    });
  }, [buildProductResourceFocus, isNew, product]);

  const handleSave = async () => {
    setIsSaving(true);

    try {
      if (isNew) {
        const created = await createProduct.mutateAsync(formData);
        navigate(`/products/${created.id}`);
      } else if (productId) {
        await updateProduct.mutateAsync({ id: productId, data: formData });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (productId) {
      await deleteProduct.mutateAsync(productId);
      navigate("/products");
    }
  };

  const handleAddVariation = async () => {
    if (productId && newVariation.name) {
      await createVariation.mutateAsync({
        product_id: productId,
        name: newVariation.name,
        sku: newVariation.sku || undefined,
        price: newVariation.price || undefined,
        inventory_count: 0,
        attributes: {},
        is_active: true,
        sort_order: (product?.variations?.length || 0) + 1,
      });
      setNewVariation({ name: "", sku: "", price: 0 });
      setShowVariationDialog(false);
    }
  };

  if ((isLoading || !hasInitializedForm) && !isNew) {
    return <ProductDetailPageSkeleton />;
  }

  const subtitle = isNew
    ? "Fill in the details to create a new product."
    : product?.source !== "platform"
      ? `Synced from ${getSourceLabel(product?.source)}`
      : `Last updated ${formatRelativeTime(product?.updated_at)}`;

  return (
    <Stack spacing={4.5}>
      <Stack spacing={3}>
        <JoyButton
          bloomVariant="ghost"
          size="sm"
          startDecorator={<ArrowLeft size={16} />}
          onClick={() => navigate("/products")}
          sx={{
            alignSelf: "flex-start",
            color: "neutral.500",
            fontWeight: 500,
            fontSize: "13px",
            transition: "color 120ms ease",
            "&:hover": {
              color: "neutral.700",
              backgroundColor: "transparent",
            },
          }}
        >
          Products
        </JoyButton>

        <Stack
          direction={{ xs: "column", lg: "row" }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", lg: "flex-start" }}
        >
          <Stack spacing={1} sx={{ minWidth: 0 }}>
            <Typography
              level="h2"
              sx={{
                fontSize: "20px",
                fontWeight: 700,
                color: "neutral.900",
                lineHeight: 1.2,
              }}
            >
              {isNew ? "New Product" : product?.name}
            </Typography>
            <Typography
              level="body-sm"
              sx={{
                fontSize: "13px",
                color: "neutral.500",
              }}
            >
              {subtitle}
            </Typography>

            {!isNew ? (
              <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                <JoyChip
                  variant="soft"
                  color={
                    formData.status === "active"
                      ? "success"
                      : formData.status === "draft"
                        ? "warning"
                        : "neutral"
                  }
                >
                  {STATUS_LABELS[formData.status]}
                </JoyChip>
                <JoyChip variant="soft" color="neutral">
                  {formData.is_visible ? "Visible" : "Hidden"}
                </JoyChip>
              </Stack>
            ) : null}
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            {!isNew && product ? (
              <AskBloomResourceTrigger
                resourceType="product"
                resourceId={product.id}
                resourceLabel={product.name || "Product"}
                buildContext={() => buildProductResourceFocus(product)}
              />
            ) : null}
            {!isNew ? (
              <JoyButton
                bloomVariant="ghost"
                color="danger"
                onClick={() => setShowDeleteDialog(true)}
              >
                Delete
              </JoyButton>
            ) : null}
            <JoyButton onClick={handleSave} loading={isSaving}>
              {isNew ? "Create Product" : "Save Changes"}
            </JoyButton>
          </Stack>
        </Stack>
      </Stack>

      <form
        id="product-detail-form"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSave();
        }}
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "2fr 1fr" },
            gap: 3,
          }}
        >
          <Stack spacing={3}>
            <JoyFormSection
              title="Product Information"
              description="Name, description, and identifiers."
            >
              <JoyInput
                label="Name"
                value={formData.name}
                onChange={(event) =>
                  setFormData({ ...formData, name: event.target.value })
                }
                placeholder="Product name"
                required
              />
              <JoyTextarea
                label="Description"
                value={formData.description}
                onChange={(event) =>
                  setFormData({ ...formData, description: event.target.value })
                }
                placeholder="Add a description..."
                rows={4}
              />
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "minmax(0, 1fr)",
                    md: "repeat(2, minmax(0, 1fr))",
                  },
                  gap: 2,
                }}
              >
                <JoyInput
                  label="SKU"
                  value={formData.sku}
                  onChange={(event) =>
                    setFormData({ ...formData, sku: event.target.value })
                  }
                  placeholder="e.g. SKU-001"
                />
                <JoyInput
                  label="Barcode"
                  value={formData.barcode}
                  onChange={(event) =>
                    setFormData({ ...formData, barcode: event.target.value })
                  }
                  placeholder="e.g. 012345678901"
                />
              </Box>
            </JoyFormSection>

            <JoyFormSection
              title="Pricing"
              description="Set the selling price and optional comparison values."
            >
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "minmax(0, 1fr)",
                    md: "repeat(3, minmax(0, 1fr))",
                  },
                  gap: 2,
                }}
              >
                <JoyInput
                  label="Price"
                  type="number"
                  value={String(formData.price)}
                  onChange={(event) =>
                    setFormData({
                      ...formData,
                      price: Number.parseFloat(event.target.value) || 0,
                    })
                  }
                  slotProps={{ input: { min: 0, step: 0.01 } }}
                  required
                />
                <JoyInput
                  label="Compare at"
                  type="number"
                  value={formData.compare_at_price?.toString() || ""}
                  onChange={(event) =>
                    setFormData({
                      ...formData,
                      compare_at_price:
                        Number.parseFloat(event.target.value) || undefined,
                    })
                  }
                  slotProps={{ input: { min: 0, step: 0.01 } }}
                />
                <JoyInput
                  label="Cost"
                  type="number"
                  value={formData.cost_price?.toString() || ""}
                  onChange={(event) =>
                    setFormData({
                      ...formData,
                      cost_price:
                        Number.parseFloat(event.target.value) || undefined,
                    })
                  }
                  slotProps={{ input: { min: 0, step: 0.01 } }}
                />
              </Box>
            </JoyFormSection>

            <JoyFormSection
              title="Inventory"
              description="Stock tracking and low-stock alerts."
            >
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                spacing={2}
              >
                <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                  <Typography level="title-sm">Track inventory</Typography>
                  <Typography level="body-xs" color="neutral">
                    Keep stock counts updated automatically.
                  </Typography>
                </Stack>
                <JoySwitch
                  checked={formData.track_inventory}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, track_inventory: checked })
                  }
                />
              </Stack>

              {shouldRenderInventoryFields ? (
                <Box
                  sx={{
                    overflow: "hidden",
                    maxHeight: formData.track_inventory ? 160 : 0,
                    opacity: formData.track_inventory ? 1 : 0,
                    transition: "max-height 200ms ease, opacity 200ms ease",
                  }}
                >
                  <Box
                    sx={{
                      pt: 0.5,
                      display: "grid",
                      gridTemplateColumns: {
                        xs: "minmax(0, 1fr)",
                        md: "repeat(2, minmax(0, 1fr))",
                      },
                      gap: 2,
                    }}
                  >
                    <JoyInput
                      label="Quantity in stock"
                      type="number"
                      value={String(formData.inventory_count)}
                      onChange={(event) =>
                        setFormData({
                          ...formData,
                          inventory_count:
                            Number.parseInt(event.target.value, 10) || 0,
                        })
                      }
                      slotProps={{ input: { min: 0 } }}
                    />
                    <JoyInput
                      label="Low stock threshold"
                      type="number"
                      value={String(formData.low_stock_threshold)}
                      onChange={(event) =>
                        setFormData({
                          ...formData,
                          low_stock_threshold:
                            Number.parseInt(event.target.value, 10) || 0,
                        })
                      }
                      slotProps={{ input: { min: 0 } }}
                    />
                  </Box>
                </Box>
              ) : null}
            </JoyFormSection>

            {!isNew ? (
              <JoyFormSection
                title="Variations"
                description="Size, color, or other sellable variants."
                headerActions={
                  <JoyButton
                    size="sm"
                    bloomVariant="ghost"
                    onClick={() => setShowVariationDialog(true)}
                    startDecorator={<Plus size={14} />}
                  >
                    Add
                  </JoyButton>
                }
              >
                {product?.variations?.length ? (
                  <Stack spacing={1}>
                    {product.variations.map((variation) => (
                      <Sheet
                        key={variation.id}
                        variant="outlined"
                        sx={{
                          borderRadius: "var(--joy-radius-lg)",
                          borderColor: "neutral.200",
                          p: 2,
                        }}
                      >
                        <Stack
                          direction="row"
                          justifyContent="space-between"
                          alignItems="center"
                          spacing={2}
                        >
                          <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                            <Typography
                              sx={{
                                fontSize: "14px",
                                fontWeight: 500,
                                color: "neutral.800",
                                lineHeight: 1.35,
                              }}
                            >
                              {variation.name}
                            </Typography>
                            <Typography
                              sx={{
                                fontSize: "12px",
                                color: "neutral.400",
                              }}
                            >
                              {variation.sku || "No SKU"}
                            </Typography>
                          </Stack>

                          <Stack
                            direction="row"
                            spacing={0.75}
                            alignItems="center"
                            useFlexGap
                            flexWrap="wrap"
                          >
                            {variation.price != null ? (
                              <JoyChip variant="soft" color="neutral" size="sm">
                                {formatCurrency(
                                  variation.price,
                                  formData.currency,
                                )}
                              </JoyChip>
                            ) : null}
                            <JoyChip variant="soft" color="neutral" size="sm">
                              {variation.inventory_count} in stock
                            </JoyChip>
                            <JoyButton
                              bloomVariant="ghost"
                              size="icon"
                              color="neutral"
                              onClick={() =>
                                deleteVariation.mutate(variation.id)
                              }
                              aria-label={`Delete ${variation.name}`}
                              sx={{
                                color: "neutral.400",
                                "&:hover": {
                                  color: "danger.600",
                                  backgroundColor:
                                    "rgba(var(--joy-palette-danger-mainChannel) / 0.08)",
                                },
                              }}
                            >
                              <Trash2 size={14} />
                            </JoyButton>
                          </Stack>
                        </Stack>
                      </Sheet>
                    ))}
                  </Stack>
                ) : (
                  <Typography
                    sx={{
                      fontSize: "13px",
                      color: "neutral.400",
                      textAlign: "center",
                      py: 3,
                    }}
                  >
                    No variations yet.
                  </Typography>
                )}
              </JoyFormSection>
            ) : null}
          </Stack>

          <Stack spacing={3}>
            <JoyFormSection
              title="Status"
              description="Publish state and storefront visibility."
            >
              <JoySelect
                label="Status"
                value={formData.status}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    status: value as "draft" | "active" | "archived",
                  })
                }
                options={STATUS_OPTIONS}
              />
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                spacing={2}
              >
                <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                  <Typography level="title-sm">
                    Storefront visibility
                  </Typography>
                  <Typography level="body-xs" color="neutral">
                    Show this product in your store.
                  </Typography>
                </Stack>
                <JoySwitch
                  checked={formData.is_visible}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_visible: checked })
                  }
                />
              </Stack>
            </JoyFormSection>

            {!isNew ? (
              <JoyFormSection
                title="Images"
                description="Product photography and media."
                headerActions={
                  <>
                    <JoyButton
                      size="sm"
                      bloomVariant="ghost"
                      onClick={() => fileInputRef.current?.click()}
                      loading={isUploadingImage}
                      startDecorator={<Upload size={14} />}
                    >
                      Upload
                    </JoyButton>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={handleImageUpload}
                    />
                  </>
                }
              >
                {product?.images?.length ? (
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                      gap: 1.5,
                    }}
                  >
                    {product.images.map((image) => (
                      <Sheet
                        key={image.id}
                        variant="outlined"
                        sx={{
                          position: "relative",
                          aspectRatio: "1 / 1",
                          borderRadius: "var(--joy-radius-lg)",
                          borderColor: "neutral.200",
                          overflow: "hidden",
                          backgroundColor: "neutral.50",
                          "&:hover .product-image-overlay": {
                            opacity: 1,
                            pointerEvents: "auto",
                          },
                        }}
                      >
                        {image.image_url ? (
                          <Box
                            component="img"
                            src={image.image_url}
                            alt={image.alt_text || "Product image"}
                            sx={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                            }}
                          />
                        ) : (
                          <Box
                            sx={{
                              width: "100%",
                              height: "100%",
                              display: "grid",
                              placeItems: "center",
                              color: "neutral.300",
                            }}
                          >
                            <ImageIcon size={20} />
                          </Box>
                        )}

                        <Box
                          className="product-image-overlay"
                          sx={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            p: 1,
                            display: "flex",
                            justifyContent: "flex-end",
                            gap: 0.75,
                            background:
                              "linear-gradient(to bottom, rgba(0, 0, 0, 0.35) 0%, transparent 60%)",
                            opacity: 0,
                            pointerEvents: "none",
                            transition: "opacity 160ms ease",
                          }}
                        >
                          <IconButton
                            size="sm"
                            variant="plain"
                            onClick={() => setPrimaryImage.mutate(image.id)}
                            aria-label="Mark as primary"
                            sx={{
                              color: image.is_primary
                                ? "#facc15"
                                : "common.white",
                              backgroundColor: "rgba(0, 0, 0, 0.24)",
                              pointerEvents: "auto",
                              "&:hover": {
                                backgroundColor: "rgba(0, 0, 0, 0.36)",
                              },
                            }}
                          >
                            <Star
                              size={15}
                              style={{
                                fill: image.is_primary
                                  ? "#facc15"
                                  : "transparent",
                              }}
                            />
                          </IconButton>
                          <IconButton
                            size="sm"
                            variant="plain"
                            onClick={() => deleteImage.mutate(image.id)}
                            aria-label="Delete image"
                            sx={{
                              color: "common.white",
                              backgroundColor: "rgba(0, 0, 0, 0.24)",
                              pointerEvents: "auto",
                              "&:hover": {
                                backgroundColor: "rgba(0, 0, 0, 0.36)",
                              },
                            }}
                          >
                            <X size={15} />
                          </IconButton>
                        </Box>

                        {image.is_primary ? (
                          <JoyChip
                            variant="solid"
                            color="neutral"
                            size="sm"
                            sx={{
                              position: "absolute",
                              left: 8,
                              bottom: 8,
                            }}
                          >
                            Primary
                          </JoyChip>
                        ) : null}
                      </Sheet>
                    ))}
                  </Box>
                ) : (
                  <Sheet
                    variant="outlined"
                    role="button"
                    tabIndex={0}
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        fileInputRef.current?.click();
                      }
                    }}
                    sx={{
                      minHeight: 180,
                      borderStyle: "dashed",
                      borderColor: "neutral.200",
                      borderRadius: "var(--joy-radius-lg)",
                      display: "grid",
                      placeItems: "center",
                      cursor: "pointer",
                      textAlign: "center",
                      color: "neutral.400",
                      transition:
                        "border-color 150ms ease, background-color 150ms ease, color 150ms ease",
                      "&:hover": {
                        borderColor: "neutral.300",
                        backgroundColor: "neutral.50",
                      },
                    }}
                  >
                    <Stack spacing={1} alignItems="center">
                      <Upload size={28} color="currentColor" />
                      <Typography
                        sx={{ fontSize: "13px", color: "neutral.400" }}
                      >
                        Drop images or click Upload
                      </Typography>
                    </Stack>
                  </Sheet>
                )}
              </JoyFormSection>
            ) : null}

            <JoyFormSection
              title="Organization"
              description="Catalog categories for merchandising."
            >
              <JoyInput
                label="Category"
                value={formData.category}
                onChange={(event) =>
                  setFormData({ ...formData, category: event.target.value })
                }
                placeholder="e.g. Plants"
              />
              <JoyInput
                label="Subcategory"
                value={formData.subcategory}
                onChange={(event) =>
                  setFormData({ ...formData, subcategory: event.target.value })
                }
                placeholder="e.g. Indoor"
              />
            </JoyFormSection>
          </Stack>
        </Box>
      </form>

      <JoyAlertDialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDelete}
        title="Delete Product"
        description={`Are you sure you want to delete "${product?.name ?? "this product"}"? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        loading={deleteProduct.isPending}
        variant="danger"
      />

      <JoyDialog
        open={showVariationDialog}
        onClose={() => setShowVariationDialog(false)}
        title="Add variation"
        description="Create a variant with optional SKU and price override."
      >
        <JoyDialogContent>
          <Stack spacing={2}>
            <JoyInput
              label="Name"
              value={newVariation.name}
              onChange={(event) =>
                setNewVariation({ ...newVariation, name: event.target.value })
              }
              placeholder="e.g. Large"
            />
            <JoyInput
              label="SKU"
              value={newVariation.sku}
              onChange={(event) =>
                setNewVariation({ ...newVariation, sku: event.target.value })
              }
              placeholder="Optional"
            />
            <JoyInput
              label="Price override"
              type="number"
              value={newVariation.price ? String(newVariation.price) : ""}
              onChange={(event) =>
                setNewVariation({
                  ...newVariation,
                  price: Number.parseFloat(event.target.value) || 0,
                })
              }
              placeholder="Inherits product price"
              slotProps={{ input: { min: 0, step: 0.01 } }}
            />
          </Stack>
        </JoyDialogContent>
        <JoyDialogActions>
          <JoyButton
            bloomVariant="ghost"
            color="neutral"
            onClick={() => setShowVariationDialog(false)}
          >
            Cancel
          </JoyButton>
          <JoyButton
            onClick={handleAddVariation}
            disabled={!newVariation.name.trim()}
          >
            Add
          </JoyButton>
        </JoyDialogActions>
      </JoyDialog>
    </Stack>
  );
}
