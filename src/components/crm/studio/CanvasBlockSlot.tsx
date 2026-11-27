import * as React from "react";
import { isEmptyContentBlock } from "@/lib/studio/emailHtmlGenerator";
import { isEditorEmptyBlock } from "@/lib/studio/newsletter/editorEmptyBlocks";
import Box from "@mui/joy/Box";
import Chip from "@mui/joy/Chip";
import IconButton from "@mui/joy/IconButton";
import Sheet from "@mui/joy/Sheet";
import Typography from "@mui/joy/Typography";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ChevronsDown,
  ChevronsUp,
  Copy,
  GripVertical,
  Trash2,
} from "lucide-react";
import { getBlockDisplayLabel } from "@/components/crm/studio/blockLibraryData";
import BlockRenderer from "@/components/crm/studio/blocks/BlockRenderer";
import { describeBlockLinkIssue, findBlockLinkIssues } from "@/lib/email/blockLinkIssues";
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
      return 0;
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
  const displayLabel = getBlockDisplayLabel(block);
  // Editor chrome only: marks a block whose links would go out broken. The
  // email itself is rendered separately and never carries this mark.
  const linkIssues = React.useMemo(() => findBlockLinkIssues(block), [block]);
  const linkIssueSummary = linkIssues.map(describeBlockLinkIssue).join("; ");

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

  // Bring a block that was just added into view so the person never has to
  // hunt for it further down the email.
  React.useEffect(() => {
    if (!isNewlyAdded) return;
    const node = document.querySelector<HTMLElement>(
      `[data-studio-block-id="${block.id}"]`,
    );
    if (typeof node?.scrollIntoView === "function") {
      node.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [block.id, isNewlyAdded]);

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
                left: -30,
                top: "50%",
                transform: "translateY(-50%)",
                opacity: showAffordances ? 1 : 0,
                transition: "all 120ms ease",
                zIndex: 3,
                // Stays reachable by keyboard even while hidden from the mouse.
                "&:focus-within": { opacity: 1 },
              }}
            >
              <IconButton
                ref={setActivatorNodeRef}
                {...attributes}
                {...listeners}
                variant="outlined"
                color="neutral"
                size="sm"
                aria-label={`Drag ${displayLabel}`}
                title="Drag to move this block"
                onClick={(event) => event.stopPropagation()}
                sx={{
                  cursor: isDragging ? "grabbing" : "grab",
                  color: "neutral.600",
                  bgcolor: "#ffffff",
                  borderColor: "neutral.300",
                  boxShadow: "0 1px 3px rgba(15, 23, 42, 0.12)",
                  borderRadius: "8px",
                  minWidth: 26,
                  minHeight: 40,
                  width: 26,
                  height: 40,
                  "&:hover": {
                    bgcolor: "primary.50",
                    borderColor: "primary.300",
                    color: "primary.700",
                  },
                  "&:focus-visible": {
                    outline: "2px solid",
                    outlineColor: "primary.400",
                    outlineOffset: 2,
                  },
                }}
              >
                <GripVertical size={16} />
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
              {displayLabel}
            </Typography>
          </Sheet>

          <Box
            sx={{
              position: "relative",
              borderRadius: "4px",
              outline: isSelected
                ? "2px solid"
                : linkIssues.length > 0
                  ? "2px dashed"
                  : "0 solid transparent",
              outlineColor: isSelected
                ? "primary.400"
                : linkIssues.length > 0
                  ? "warning.outlinedBorder"
                  : "transparent",
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
                // An empty block draws its own sample layout (or one
                // "This block is empty" box); no extra reserved height under it.
                minHeight: isEmptyContentBlock(block) || isEditorEmptyBlock(block)
                  ? 0
                  : getPlaceholderMinHeight(block.type),
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

          {linkIssues.length > 0 ? (
            <Chip
              size="sm"
              variant="solid"
              color="warning"
              data-testid="studio-block-link-issue"
              title={linkIssueSummary}
              startDecorator={<AlertTriangle size={12} aria-hidden />}
              sx={{
                position: "absolute",
                right: 12,
                bottom: -12,
                zIndex: 3,
                fontSize: "11px",
              }}
            >
              {linkIssues.length === 1 ? "Fix link" : `Fix ${linkIssues.length} links`}
            </Chip>
          ) : null}

          <Sheet
            variant="plain"
            sx={{
              // Sits just outside the block, above its top-right corner, so it
              // never covers the block's own content.
              position: "absolute",
              right: 0,
              bottom: "calc(100% + 6px)",
              display: isFooterBlock ? "none" : "flex",
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
                aria-label={`Duplicate ${displayLabel}`}
                title="Duplicate"
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
                aria-label={`Move ${displayLabel} to the top`}
                title="Move to top"
                disabled={isFirst}
                onClick={() =>
                  onReorder(block.id, { kind: "direction", direction: "top" })
                }
              >
                <ChevronsUp size={14} />
              </IconButton>
            ) : null}
            {!isFooterBlock ? (
              <IconButton
                variant="plain"
                color="neutral"
                size="sm"
                aria-label={`Move ${displayLabel} up`}
                title="Move up"
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
                aria-label={`Move ${displayLabel} down`}
                title="Move down"
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
            {!isFooterBlock ? (
              <IconButton
                variant="plain"
                color="neutral"
                size="sm"
                aria-label={`Move ${displayLabel} to the bottom`}
                title="Move to bottom"
                disabled={isLast}
                onClick={() =>
                  onReorder(block.id, { kind: "direction", direction: "bottom" })
                }
              >
                <ChevronsDown size={14} />
              </IconButton>
            ) : null}
            {/* The footer holds the required unsubscribe link, so it cannot
                be deleted from the email. */}
            {isFooterBlock ? null : (
            <IconButton
              variant="plain"
              color="neutral"
              size="sm"
              aria-label={`Delete ${displayLabel}`}
              title="Delete"
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
            )}
          </Sheet>
        </Box>
      </Box>
    </Box>
  );
}
