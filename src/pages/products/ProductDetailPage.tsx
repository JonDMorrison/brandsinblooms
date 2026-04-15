import { useEffect, useRef, useState } from "react";
import Box from "@mui/joy/Box";
import Skeleton from "@mui/joy/Skeleton";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  GripVertical,
  Image as ImageIcon,
  Plus,
  Save,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
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
import { ProductFormData } from "@/types/product";

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
];

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

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showVariationDialog, setShowVariationDialog] = useState(false);
  const [newVariation, setNewVariation] = useState({
    name: "",
    sku: "",
    price: 0,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
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
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(`Failed to upload image: ${error.message}`);
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  useEffect(() => {
    if (product && !isNew) {
      setFormData({
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
      });
    }
  }, [product, isNew]);

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

  if (isLoading && !isNew) {
    return (
      <Stack spacing={3.5}>
        <Skeleton variant="text" level="h2" sx={{ width: 240 }} />
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "2fr 1fr" },
            gap: 3,
          }}
        >
          <Stack spacing={3}>
            <Skeleton
              variant="rectangular"
              sx={{ height: 220, borderRadius: "24px" }}
            />
            <Skeleton
              variant="rectangular"
              sx={{ height: 180, borderRadius: "24px" }}
            />
            <Skeleton
              variant="rectangular"
              sx={{ height: 180, borderRadius: "24px" }}
            />
          </Stack>
          <Stack spacing={3}>
            <Skeleton
              variant="rectangular"
              sx={{ height: 180, borderRadius: "24px" }}
            />
            <Skeleton
              variant="rectangular"
              sx={{ height: 280, borderRadius: "24px" }}
            />
          </Stack>
        </Box>
      </Stack>
    );
  }

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
            "linear-gradient(135deg, rgba(15, 118, 110, 0.08) 0%, rgba(239, 246, 255, 0.88) 45%, rgba(255, 255, 255, 1) 100%)",
        }}
      >
        <Stack
          direction={{ xs: "column", lg: "row" }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", lg: "center" }}
        >
          <Stack spacing={1.25}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <JoyButton
                bloomVariant="ghost"
                size="icon"
                onClick={() => navigate("/products")}
                aria-label="Back to products"
              >
                <ArrowLeft className="h-4 w-4" />
              </JoyButton>
              <div>
                <Typography level="h1">
                  {isNew ? "New Product" : product?.name}
                </Typography>
                {!isNew && product?.source !== "platform" ? (
                  <Typography level="body-sm" color="neutral">
                    Synced from {product?.source}
                  </Typography>
                ) : (
                  <Typography level="body-sm" color="neutral">
                    Manage pricing, inventory, images, and product visibility.
                  </Typography>
                )}
              </div>
            </Stack>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              <JoyChip
                color={
                  formData.status === "active"
                    ? "success"
                    : formData.status === "draft"
                      ? "warning"
                      : "neutral"
                }
                variant="soft"
              >
                {formData.status}
              </JoyChip>
              {formData.is_visible ? (
                <JoyChip color="primary" variant="soft">
                  Visible on store
                </JoyChip>
              ) : (
                <JoyChip color="neutral" variant="soft">
                  Hidden from store
                </JoyChip>
              )}
            </Stack>
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            {!isNew ? (
              <JoyButton
                bloomVariant="destructiveOutline"
                onClick={() => setShowDeleteDialog(true)}
                startDecorator={<Trash2 />}
              >
                Delete
              </JoyButton>
            ) : null}
            <JoyButton
              onClick={handleSave}
              loading={isSaving}
              startDecorator={<Save />}
            >
              {isNew ? "Create Product" : "Save Changes"}
            </JoyButton>
          </Stack>
        </Stack>
      </Sheet>

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
              description="Core customer-facing details for this product listing."
            >
              <JoyInput
                label="Product Name"
                value={formData.name}
                onChange={(event) =>
                  setFormData({ ...formData, name: event.target.value })
                }
                placeholder="Enter product name"
                required
              />
              <JoyTextarea
                label="Description"
                value={formData.description}
                onChange={(event) =>
                  setFormData({ ...formData, description: event.target.value })
                }
                placeholder="Describe your product..."
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
                  placeholder="SKU-001"
                />
                <JoyInput
                  label="Barcode"
                  value={formData.barcode}
                  onChange={(event) =>
                    setFormData({ ...formData, barcode: event.target.value })
                  }
                  placeholder="123456789"
                />
              </Box>
            </JoyFormSection>

            <JoyFormSection
              title="Pricing"
              description="Set the public price and optional compare-at or cost values."
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
                  label="Compare at Price"
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
                  label="Cost Price"
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
              description="Track on-hand quantities and alert thresholds."
            >
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={2}
                justifyContent="space-between"
                alignItems={{ xs: "flex-start", md: "center" }}
              >
                <Stack spacing={0.5}>
                  <Typography level="title-sm">Track Inventory</Typography>
                  <Typography level="body-sm" color="neutral">
                    Keep stock counts current inside the tenant catalog.
                  </Typography>
                </Stack>
                <JoySwitch
                  checked={formData.track_inventory}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, track_inventory: checked })
                  }
                />
              </Stack>

              {formData.track_inventory ? (
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
                    label="Quantity in Stock"
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
                    label="Low Stock Alert"
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
              ) : null}
            </JoyFormSection>

            {!isNew ? (
              <JoyFormSection
                title="Variations"
                description="Add size, color, or other sellable variants for this product."
                headerActions={
                  <JoyButton
                    size="sm"
                    bloomVariant="outline"
                    onClick={() => setShowVariationDialog(true)}
                    startDecorator={<Plus />}
                  >
                    Add Variation
                  </JoyButton>
                }
              >
                {product?.variations?.length ? (
                  <Stack spacing={1.25}>
                    {product.variations.map((variation) => (
                      <Sheet
                        key={variation.id}
                        variant="outlined"
                        sx={{
                          p: 1.75,
                          borderRadius: "16px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 2,
                          flexWrap: "wrap",
                        }}
                      >
                        <Stack
                          direction="row"
                          spacing={1.25}
                          alignItems="center"
                        >
                          <GripVertical className="h-4 w-4 text-slate-400" />
                          <Stack spacing={0.35}>
                            <Typography level="title-sm">
                              {variation.name}
                            </Typography>
                            <Typography level="body-xs" color="neutral">
                              {variation.sku
                                ? `SKU ${variation.sku}`
                                : "No SKU override"}
                            </Typography>
                          </Stack>
                        </Stack>
                        <Stack
                          direction="row"
                          spacing={1}
                          alignItems="center"
                          useFlexGap
                          flexWrap="wrap"
                        >
                          {variation.price ? (
                            <JoyChip color="primary" variant="soft">
                              ${variation.price.toFixed(2)}
                            </JoyChip>
                          ) : null}
                          <JoyChip color="neutral" variant="soft">
                            {variation.inventory_count} in stock
                          </JoyChip>
                          <JoyButton
                            bloomVariant="ghost"
                            size="icon"
                            onClick={() => deleteVariation.mutate(variation.id)}
                            aria-label={`Delete ${variation.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </JoyButton>
                        </Stack>
                      </Sheet>
                    ))}
                  </Stack>
                ) : (
                  <Typography level="body-sm" color="neutral">
                    No variations yet. Add variations like size or color.
                  </Typography>
                )}
              </JoyFormSection>
            ) : null}
          </Stack>

          <Stack spacing={3}>
            <JoyFormSection
              title="Status"
              description="Control publish state and storefront visibility."
            >
              <JoySelect
                label="Product Status"
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
                direction={{ xs: "column", md: "row" }}
                spacing={2}
                justifyContent="space-between"
                alignItems={{ xs: "flex-start", md: "center" }}
              >
                <Stack spacing={0.5}>
                  <Typography level="title-sm">Visible on Store</Typography>
                  <Typography level="body-sm" color="neutral">
                    Toggle whether this product appears in the published
                    storefront.
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
                description="Upload and manage primary product imagery."
                headerActions={
                  <>
                    <JoyButton
                      size="sm"
                      bloomVariant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      loading={isUploadingImage}
                      startDecorator={<Upload />}
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
                          borderRadius: "18px",
                          overflow: "hidden",
                          backgroundColor: "neutral.100",
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
                            }}
                          >
                            <ImageIcon className="h-6 w-6 text-slate-400" />
                          </Box>
                        )}
                        <Stack
                          direction="row"
                          spacing={1}
                          sx={{ position: "absolute", top: 10, right: 10 }}
                        >
                          <JoyButton
                            size="icon"
                            bloomVariant="ghost"
                            color="neutral"
                            onClick={() => setPrimaryImage.mutate(image.id)}
                            aria-label="Mark as primary"
                          >
                            <Star
                              className="h-4 w-4"
                              style={{
                                fill: image.is_primary
                                  ? "#facc15"
                                  : "transparent",
                                color: image.is_primary ? "#facc15" : undefined,
                              }}
                            />
                          </JoyButton>
                          <JoyButton
                            size="icon"
                            bloomVariant="destructive"
                            onClick={() => deleteImage.mutate(image.id)}
                            aria-label="Delete image"
                          >
                            <X className="h-4 w-4" />
                          </JoyButton>
                        </Stack>
                        {image.is_primary ? (
                          <JoyChip
                            color="warning"
                            variant="solid"
                            size="sm"
                            sx={{ position: "absolute", left: 10, bottom: 10 }}
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
                    sx={{
                      minHeight: 220,
                      borderRadius: "18px",
                      borderStyle: "dashed",
                      display: "grid",
                      placeItems: "center",
                      textAlign: "center",
                      color: "neutral.500",
                    }}
                  >
                    <Stack spacing={1} alignItems="center">
                      <ImageIcon className="h-8 w-8" />
                      <Typography level="body-sm">No images yet</Typography>
                    </Stack>
                  </Sheet>
                )}
              </JoyFormSection>
            ) : null}

            <JoyFormSection
              title="Organization"
              description="Keep catalog categories and merchandising buckets consistent."
            >
              <JoyInput
                label="Category"
                value={formData.category}
                onChange={(event) =>
                  setFormData({ ...formData, category: event.target.value })
                }
                placeholder="e.g., Plants, Tools"
              />
              <JoyInput
                label="Subcategory"
                value={formData.subcategory}
                onChange={(event) =>
                  setFormData({ ...formData, subcategory: event.target.value })
                }
                placeholder="e.g., Indoor, Outdoor"
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
        title="Add Variation"
        description="Create a variant with its own SKU or price override."
      >
        <JoyDialogContent>
          <Stack spacing={2}>
            <JoyInput
              label="Variation Name"
              value={newVariation.name}
              onChange={(event) =>
                setNewVariation({ ...newVariation, name: event.target.value })
              }
              placeholder="e.g., Large, Red"
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
                value={newVariation.sku}
                onChange={(event) =>
                  setNewVariation({ ...newVariation, sku: event.target.value })
                }
                placeholder="Optional"
              />
              <JoyInput
                label="Price Override"
                type="number"
                value={newVariation.price ? String(newVariation.price) : ""}
                onChange={(event) =>
                  setNewVariation({
                    ...newVariation,
                    price: Number.parseFloat(event.target.value) || 0,
                  })
                }
                placeholder="Leave empty to use product price"
                slotProps={{ input: { min: 0, step: 0.01 } }}
              />
            </Box>
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
          <JoyButton onClick={handleAddVariation} disabled={!newVariation.name}>
            Add Variation
          </JoyButton>
        </JoyDialogActions>
      </JoyDialog>
    </Stack>
  );
}
