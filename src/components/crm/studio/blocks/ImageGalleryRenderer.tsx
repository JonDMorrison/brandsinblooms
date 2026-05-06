import * as React from "react";
import Box from "@mui/joy/Box";
import IconButton from "@mui/joy/IconButton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { GripVertical, ImagePlus, Plus, Trash2 } from "lucide-react";
import { uploadStudioImageFile } from "@/components/crm/studio/fields/StudioImageUpload";
import type { GalleryImage, StudioBlock } from "@/types/studioBlocks";

type ImageGalleryRendererProps = {
  block: StudioBlock;
  onUpdateBlockField?: (
    blockId: string,
    field: keyof StudioBlock,
    value: StudioBlock[keyof StudioBlock],
  ) => void;
};

function getSlotCount(block: StudioBlock) {
  switch (block.layout) {
    case "grid-4":
      return 4;
    case "grid-6":
      return 6;
    case "feature-grid":
      return 3;
    default:
      return 3;
  }
}

function moveGalleryImage(
  images: GalleryImage[],
  sourceIndex: number,
  targetIndex: number,
) {
  if (
    sourceIndex < 0 ||
    targetIndex < 0 ||
    sourceIndex >= images.length ||
    targetIndex >= images.length ||
    sourceIndex === targetIndex
  ) {
    return images;
  }

  const nextImages = [...images];
  const [movedImage] = nextImages.splice(sourceIndex, 1);
  nextImages.splice(targetIndex, 0, movedImage);
  return nextImages;
}

export default function ImageGalleryRenderer({
  block,
  onUpdateBlockField,
}: ImageGalleryRendererProps) {
  const images = block.galleryImages ?? [];
  const layout = block.layout || "grid-3";
  const slotCount = Math.max(getSlotCount(block), images.length);
  const imageHeight = block.imageHeight ?? 180;
  const gap = block.gridGap ?? 8;
  const radius = block.borderRadius ?? 6;
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const pendingSlotRef = React.useRef<number | null>(null);
  const [draggedIndex, setDraggedIndex] = React.useState<number | null>(null);
  const [uploadingSlot, setUploadingSlot] = React.useState<number | null>(null);
  const [uploadError, setUploadError] = React.useState<string | null>(null);

  const updateImages = React.useCallback(
    (nextImages: GalleryImage[]) => {
      onUpdateBlockField?.(block.id, "galleryImages", nextImages);
    },
    [block.id, onUpdateBlockField],
  );

  const uploadIntoSlot = React.useCallback(
    async (files: FileList | null, slotIndex: number | null) => {
      const file = files?.[0];

      if (!file || slotIndex === null || !onUpdateBlockField) {
        return;
      }

      setUploadingSlot(slotIndex);
      setUploadError(null);

      try {
        const url = await uploadStudioImageFile(file);
        const nextImages = [...images];
        nextImages[slotIndex] = {
          id: nextImages[slotIndex]?.id ?? crypto.randomUUID(),
          url,
          alt: nextImages[slotIndex]?.alt ?? "",
          linkUrl: nextImages[slotIndex]?.linkUrl ?? "",
        };
        updateImages(
          nextImages.filter((image): image is GalleryImage => Boolean(image)),
        );
      } catch (error) {
        setUploadError(
          error instanceof Error ? error.message : "Upload failed.",
        );
      } finally {
        setUploadingSlot(null);
        pendingSlotRef.current = null;

        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [images, onUpdateBlockField, updateImages],
  );

  const openSlotPicker = React.useCallback(
    (slotIndex: number) => {
      if (!onUpdateBlockField) {
        return;
      }

      pendingSlotRef.current = slotIndex;
      fileInputRef.current?.click();
    },
    [onUpdateBlockField],
  );

  const removeImage = React.useCallback(
    (slotIndex: number) => {
      updateImages(images.filter((_image, index) => index !== slotIndex));
    },
    [images, updateImages],
  );

  const reorderImage = React.useCallback(
    (targetIndex: number) => {
      if (draggedIndex === null) {
        return;
      }

      updateImages(moveGalleryImage(images, draggedIndex, targetIndex));
      setDraggedIndex(null);
    },
    [draggedIndex, images, updateImages],
  );

  const renderSlot = (slotIndex: number, height: number | string) => {
    const image = images[slotIndex];
    const isUploading = uploadingSlot === slotIndex;

    if (!image) {
      return (
        <Box
          role={onUpdateBlockField ? "button" : undefined}
          tabIndex={onUpdateBlockField ? 0 : undefined}
          onClick={(event) => {
            event.stopPropagation();
            openSlotPicker(slotIndex);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              openSlotPicker(slotIndex);
            }
          }}
          sx={{
            height,
            minHeight: 96,
            border: "1.5px dashed",
            borderColor: "neutral.200",
            borderRadius: `${radius}px`,
            bgcolor: "neutral.50",
            color: "neutral.300",
            boxShadow: block.showShadow
              ? "0 10px 24px -22px rgba(15, 23, 42, 0.5)"
              : "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: onUpdateBlockField ? "pointer" : "default",
            transition: "all 120ms ease",
            "&:hover": onUpdateBlockField
              ? { bgcolor: "neutral.100", borderColor: "neutral.300" }
              : undefined,
          }}
        >
          <Stack spacing={0.75} alignItems="center">
            {isUploading ? <ImagePlus size={24} /> : <Plus size={24} />}
            <Typography level="body-xs" sx={{ color: "neutral.400" }}>
              {isUploading ? "Uploading" : "Add image"}
            </Typography>
          </Stack>
        </Box>
      );
    }

    const imageNode = (
      <Box
        component="img"
        src={image.url}
        alt={image.alt}
        draggable={false}
        sx={{
          width: "100%",
          height: "100%",
          display: "block",
          objectFit: "cover",
          objectPosition: "center",
        }}
      />
    );

    return (
      <Box
        draggable={Boolean(onUpdateBlockField)}
        onDragStart={(event) => {
          event.stopPropagation();
          setDraggedIndex(slotIndex);
          event.dataTransfer.effectAllowed = "move";
        }}
        onDragOver={(event) => {
          if (draggedIndex !== null) {
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
          }
        }}
        onDrop={(event) => {
          event.preventDefault();
          event.stopPropagation();
          reorderImage(slotIndex);
        }}
        onDragEnd={() => setDraggedIndex(null)}
        sx={{
          position: "relative",
          height,
          minHeight: 96,
          borderRadius: `${radius}px`,
          overflow: "hidden",
          bgcolor: "neutral.100",
          boxShadow: block.showShadow
            ? "0 14px 28px -24px rgba(15, 23, 42, 0.45)"
            : "none",
          cursor: onUpdateBlockField ? "grab" : "default",
          "&:hover .gallery-image-overlay": {
            opacity: onUpdateBlockField ? 1 : 0,
          },
        }}
      >
        {image.linkUrl ? (
          <Box
            component="a"
            href={image.linkUrl}
            onClick={(event) => event.preventDefault()}
            sx={{ display: "block", width: "100%", height: "100%" }}
          >
            {imageNode}
          </Box>
        ) : (
          imageNode
        )}
        <Stack
          className="gallery-image-overlay"
          direction="row"
          spacing={0.5}
          alignItems="center"
          justifyContent="center"
          sx={{
            position: "absolute",
            inset: 0,
            bgcolor: "rgba(17,24,39,0.38)",
            color: "#ffffff",
            opacity: 0,
            transition: "opacity 120ms ease",
          }}
        >
          <GripVertical size={16} />
          <IconButton
            variant="soft"
            color="neutral"
            size="sm"
            aria-label="Remove gallery image"
            onClick={(event) => {
              event.stopPropagation();
              removeImage(slotIndex);
            }}
            sx={{ minWidth: 28, minHeight: 28, borderRadius: "6px" }}
          >
            <Trash2 size={14} />
          </IconButton>
        </Stack>
      </Box>
    );
  };

  if (layout === "feature-grid") {
    return (
      <Box sx={{ bgcolor: block.backgroundColor || "#ffffff", p: "16px" }}>
        <Box
          component="input"
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            void uploadIntoSlot(event.target.files, pendingSlotRef.current)
          }
          sx={{ display: "none" }}
        />
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr",
            gap: `${gap}px`,
            height: imageHeight * 2 + gap,
          }}
        >
          {renderSlot(0, "100%")}
          <Stack spacing={`${gap}px`}>
            {renderSlot(1, imageHeight)}
            {renderSlot(2, imageHeight)}
          </Stack>
        </Box>
        {uploadError ? (
          <Typography level="body-xs" sx={{ mt: 1, color: "danger.600" }}>
            {uploadError}
          </Typography>
        ) : null}
      </Box>
    );
  }

  return (
    <Box sx={{ bgcolor: block.backgroundColor || "#ffffff", p: "16px" }}>
      <Box
        component="input"
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
          void uploadIntoSlot(event.target.files, pendingSlotRef.current)
        }
        sx={{ display: "none" }}
      />
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: `repeat(${block.gridColumns ?? 3}, minmax(0, 1fr))`,
          gap: `${gap}px`,
        }}
      >
        {Array.from({ length: slotCount }).map((_item, index) => (
          <React.Fragment key={images[index]?.id ?? `slot-${index}`}>
            {renderSlot(index, imageHeight)}
          </React.Fragment>
        ))}
      </Box>
      {uploadError ? (
        <Typography level="body-xs" sx={{ mt: 1, color: "danger.600" }}>
          {uploadError}
        </Typography>
      ) : null}
    </Box>
  );
}
