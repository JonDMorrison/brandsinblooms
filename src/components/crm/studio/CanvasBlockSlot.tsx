import * as React from "react";
import Box from "@mui/joy/Box";
import IconButton from "@mui/joy/IconButton";
import Sheet from "@mui/joy/Sheet";
import Typography from "@mui/joy/Typography";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  GripVertical,
  Trash2,
} from "lucide-react";
import BlockRenderer from "@/components/crm/studio/blocks/BlockRenderer";
import type {
  CanvasReorderInstruction,
  StudioBlock,
  StudioCanvasBlockDragData,
} from "@/components/crm/studio/studioCanvasTypes";

type CanvasBlockSlotProps = {
  block: StudioBlock;
  isSelected: boolean;
  isFirst: boolean;
  isLast: boolean;
  isNewlyAdded?: boolean;
  isRemoving?: boolean;
  onSelect: (blockId: string) => void;
  onDelete: (blockId: string) => void;
  onDuplicate: (blockId: string) => void;
  onReorder: (blockId: string, instruction: CanvasReorderInstruction) => void;
  onDoubleClick: (blockId: string) => void;
  onUpdateBlockField?: (
    blockId: string,
    field: keyof StudioBlock,
    value: StudioBlock[keyof StudioBlock],
  ) => void;
};

function getPlaceholderMinHeight(blockType: StudioBlock["type"]) {
  switch (blockType) {
    case "email-safe-hero":
    case "graphic-hero":
    case "full-width-image":
      return 200;
    case "newsletter-header":
      return 0;
    case "image-gallery":
    case "product-gallery":
      return 160;
    case "call-to-action":
    case "social-follow":
      return 60;
    case "divider":
    case "spacer":
      return 32;
    case "footer":
      return 100;
    default:
      return 120;
  }
}

export default function CanvasBlockSlot({
  block,
  isSelected,
  isFirst,
  isLast,
  isNewlyAdded = false,
  isRemoving = false,
  onSelect,
  onDelete,
  onDuplicate,
  onReorder,
  onDoubleClick,
  onUpdateBlockField,
}: CanvasBlockSlotProps) {
  const [isHovered, setIsHovered] = React.useState(false);
  const isFooterBlock = block.type === "footer";

  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: block.id,
    disabled: isFooterBlock,
    data: {
      kind: "canvas-block",
      blockId: block.id,
    } satisfies StudioCanvasBlockDragData,
  });

  const showAffordances = !isRemoving && (isHovered || isSelected);

  return (
    <Box
      ref={setNodeRef}
      data-studio-block-slot="true"
      data-studio-block-id={block.id}
      onClick={() => onSelect(block.id)}
      onDoubleClick={() => onDoubleClick(block.id)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      sx={{
        position: "relative",
        overflow: "visible",
        transform: CSS.Transform.toString(transform),
        transition: transition ?? "all 150ms ease",
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 2 : 1,
      }}
    >
      <Box
        sx={{
          position: "relative",
          pl: 0,
          pb: 0,
          display: "grid",
          gridTemplateRows: isRemoving ? "0fr" : "1fr",
          opacity: isRemoving ? 0 : 1,
          transform: isRemoving ? "translateY(-8px) scale(0.98)" : undefined,
          transition:
            "grid-template-rows 150ms ease, opacity 150ms ease, transform 150ms ease",
          overflow: "visible",
          animation:
            isNewlyAdded && !isRemoving
              ? "studio-block-slide-in 200ms ease"
              : undefined,
          "@keyframes studio-block-slide-in": {
            from: {
              opacity: 0,
              transform: "translateY(-8px)",
            },
            to: {
              opacity: 1,
              transform: "translateY(0)",
            },
          },
          "@keyframes studio-selection-pulse": {
            from: { transform: "scale(1.005)" },
            to: { transform: "scale(1)" },
          },
        }}
      >
        <Box
          sx={{
            minHeight: 0,
            position: "relative",
            overflow: isRemoving ? "hidden" : "visible",
          }}
        >
          {!isFooterBlock ? (
            <Box
              sx={{
                position: "absolute",
                left: -20,
                top: "50%",
                transform: "translateY(-50%)",
                opacity: showAffordances ? 1 : 0,
                transition: "all 120ms ease",
                zIndex: 3,
              }}
            >
              <IconButton
                ref={setActivatorNodeRef}
                {...attributes}
                {...listeners}
                variant="plain"
                color="neutral"
                size="sm"
                aria-label={`Drag ${block.label}`}
                onClick={(event) => event.stopPropagation()}
                sx={{
                  cursor: isDragging ? "grabbing" : "grab",
                  color: "neutral.300",
                  minWidth: 20,
                  minHeight: 20,
                  width: 20,
                  height: 20,
                  "&:hover": {
                    bgcolor: "transparent",
                    color: "neutral.500",
                  },
                }}
              >
                <GripVertical size={14} />
              </IconButton>
            </Box>
          ) : null}

          <Sheet
            variant="soft"
            color="primary"
            sx={{
              position: "absolute",
              top: -10,
              left: 12,
              px: 1,
              py: 0.25,
              borderRadius: "4px",
              pointerEvents: "none",
              opacity: showAffordances ? 1 : 0,
              transform: showAffordances ? "translateY(-2px)" : "translateY(0)",
              transition: "opacity 120ms ease, transform 120ms ease",
              zIndex: 2,
            }}
          >
            <Typography
              level="body-xs"
              sx={{ color: "primary.600", fontSize: "10px", fontWeight: 600 }}
            >
              {block.label}
            </Typography>
          </Sheet>

          <Box
            sx={{
              position: "relative",
              borderRadius: "4px",
              outline: isSelected ? "2px solid" : "0 solid transparent",
              outlineColor: isSelected ? "primary.400" : "transparent",
              outlineOffset: 0,
              transition: "all 120ms ease",
              overflow: "visible",
              animation: isSelected
                ? "studio-selection-pulse 200ms ease"
                : undefined,
              "&::before": {
                content: '""',
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: "2px",
                bgcolor: "primary.300",
                opacity: showAffordances && !isSelected ? 1 : 0,
                transition: "opacity 120ms ease",
                zIndex: 1,
              },
            }}
          >
            <Sheet
              variant="plain"
              sx={{
                p: 0,
                borderRadius: "4px",
                height: "auto",
                minHeight: getPlaceholderMinHeight(block.type),
                bgcolor: "transparent",
                transition: "all 120ms ease",
                overflow: "visible",
              }}
            >
              <BlockRenderer
                block={block}
                onUpdateBlockField={onUpdateBlockField}
              />
            </Sheet>
          </Box>

          <Sheet
            variant="plain"
            sx={{
              position: "absolute",
              right: -8,
              top: -8,
              display: "flex",
              alignItems: "center",
              gap: "2px",
              p: "4px",
              borderRadius: "8px",
              bgcolor: "#ffffff",
              boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
              opacity: showAffordances ? 1 : 0,
              pointerEvents: showAffordances ? "auto" : "none",
              transition: "opacity 120ms ease, transform 120ms ease",
              transform: showAffordances ? "translateY(0)" : "translateY(-2px)",
              zIndex: 4,
            }}
            onClick={(event) => event.stopPropagation()}
          >
            {!isFooterBlock ? (
              <IconButton
                variant="plain"
                color="neutral"
                size="sm"
                aria-label={`Duplicate ${block.label}`}
                onClick={() => onDuplicate(block.id)}
              >
                <Copy size={14} />
              </IconButton>
            ) : null}
            {!isFooterBlock ? (
              <IconButton
                variant="plain"
                color="neutral"
                size="sm"
                aria-label={`Move ${block.label} up`}
                disabled={isFirst}
                onClick={() =>
                  onReorder(block.id, {
                    kind: "direction",
                    direction: "up",
                  })
                }
              >
                <ChevronUp size={14} />
              </IconButton>
            ) : null}
            {!isFooterBlock ? (
              <IconButton
                variant="plain"
                color="neutral"
                size="sm"
                aria-label={`Move ${block.label} down`}
                disabled={isLast}
                onClick={() =>
                  onReorder(block.id, {
                    kind: "direction",
                    direction: "down",
                  })
                }
              >
                <ChevronDown size={14} />
              </IconButton>
            ) : null}
            <IconButton
              variant="plain"
              color="neutral"
              size="sm"
              aria-label={`Delete ${block.label}`}
              onClick={() => onDelete(block.id)}
              sx={{
                "&:hover": {
                  color: "danger.500",
                  bgcolor: "danger.50",
                },
              }}
            >
              <Trash2 size={14} />
            </IconButton>
          </Sheet>
        </Box>
      </Box>
    </Box>
  );
}
