import * as React from "react";
import { useDroppable } from "@dnd-kit/core";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Dropdown from "@mui/joy/Dropdown";
import IconButton from "@mui/joy/IconButton";
import ListDivider from "@mui/joy/ListDivider";
import ListItemDecorator from "@mui/joy/ListItemDecorator";
import Menu from "@mui/joy/Menu";
import MenuButton from "@mui/joy/MenuButton";
import MenuItem from "@mui/joy/MenuItem";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Mail, Plus } from "lucide-react";
import CanvasBlockSlot from "@/components/crm/studio/CanvasBlockSlot";
import {
  BLOCK_CATEGORIES,
  type StudioBlockType,
} from "@/components/crm/studio/blockLibraryData";
import {
  STUDIO_CANVAS_APPEND_DROP_ID,
  STUDIO_CANVAS_EMPTY_DROP_ID,
  getStudioInsertionDropId,
} from "@/components/crm/studio/studioCanvasTypes";
import type {
  CanvasReorderInstruction,
  DummyBlock,
} from "@/components/crm/studio/studioCanvasTypes";

type StudioCanvasProps = {
  blocks: DummyBlock[];
  selectedBlockId: string | null;
  canvasWidth: number;
  activeDropIndex: number | null;
  isSidebarDragActive: boolean;
  isDraggingOverCanvas: boolean;
  recentlyAddedBlockId: string | null;
  removingBlockIds: string[];
  onReorder: (blockId: string, instruction: CanvasReorderInstruction) => void;
  onSelect: (blockId: string | null) => void;
  onDelete: (blockId: string) => void;
  onDuplicate: (blockId: string) => void;
  onInsertAt: (index: number, blockType: StudioBlockType) => void;
  onDoubleClickBlock: (blockId: string) => void;
  onUpdateBlockField?: (
    blockId: string,
    field: keyof DummyBlock,
    value: DummyBlock[keyof DummyBlock],
  ) => void;
};

const DEFAULT_EMPTY_BLOCK_TYPE: StudioBlockType = "email-safe-hero";

type CanvasInsertionPointProps = {
  index: number;
  onInsertAt: (index: number, blockType: StudioBlockType) => void;
  isSidebarDragActive: boolean;
  isActiveDropTarget: boolean;
};

function CanvasInsertionPoint({
  index,
  onInsertAt,
  isSidebarDragActive,
  isActiveDropTarget,
}: CanvasInsertionPointProps) {
  const { setNodeRef } = useDroppable({
    id: getStudioInsertionDropId(index),
    data: {
      kind: "canvas-insert",
      index,
    },
  });

  return (
    <Dropdown>
      <Box
        ref={setNodeRef}
        sx={{
          position: "relative",
          height: isActiveDropTarget ? 32 : 16,
          my: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "8px",
          transition: "height 120ms ease",
          "& .studio-insert-line": {
            opacity: isSidebarDragActive || isActiveDropTarget ? 1 : 0,
            transition: "all 120ms ease",
          },
          "& .studio-insert-button": {
            opacity: isSidebarDragActive || isActiveDropTarget ? 1 : 0,
            transform: "translate(-50%, -50%) scale(0.88)",
            transition: "all 120ms ease",
          },
          "&:hover": {
            height: 32,
          },
          "&:hover .studio-insert-line, &:focus-within .studio-insert-line": {
            opacity: 1,
          },
          "&:hover .studio-insert-button, &:focus-within .studio-insert-button":
            {
              opacity: 1,
              transform: "translate(-50%, -50%) scale(1)",
            },
          "& .studio-insert-line::before, & .studio-insert-line::after": {
            borderTopWidth: isActiveDropTarget ? "2px" : "1px",
            borderColor: isActiveDropTarget ? "primary.400" : "rgba(0,0,0,0.1)",
          },
        }}
      >
        <Box
          className="studio-insert-line"
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            gap: 2.25,
            "&::before, &::after": {
              content: '""',
              flex: 1,
              borderTop: "1px solid",
              borderColor: "rgba(0,0,0,0.1)",
              transition: "all 120ms ease",
            },
          }}
        />

        <MenuButton
          className="studio-insert-button"
          slots={{ root: IconButton }}
          slotProps={{
            root: {
              size: "sm",
              variant: "soft",
              color: isActiveDropTarget ? "primary" : "neutral",
              "aria-label": `Insert block at position ${index + 1}`,
              sx: {
                position: "absolute",
                top: "50%",
                left: "50%",
                width: 20,
                height: 20,
                minHeight: 20,
                minWidth: 20,
                borderRadius: "50%",
                bgcolor: isActiveDropTarget ? "primary.500" : "neutral.100",
                color: isActiveDropTarget ? "#fff" : "neutral.500",
                "&:hover": {
                  bgcolor: "primary.500",
                  color: "#fff",
                },
              },
            },
          }}
        >
          <Plus size={12} />
        </MenuButton>
        <Menu
          placement="bottom"
          sx={{
            minWidth: 240,
            maxHeight: 320,
            overflowY: "auto",
            p: 0.5,
            borderRadius: "10px",
            boxShadow: "lg",
          }}
        >
          {BLOCK_CATEGORIES.map((category, categoryIndex) => (
            <React.Fragment key={category.id}>
              {categoryIndex > 0 ? <ListDivider inset="gutter" /> : null}
              <Typography
                level="body-xs"
                sx={{
                  px: 1,
                  py: 0.75,
                  color: "neutral.500",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                {category.label}
              </Typography>
              {category.blocks.map((block) => {
                const Icon = block.icon;

                return (
                  <MenuItem
                    key={`${category.id}-${block.type}`}
                    onClick={() => onInsertAt(index, block.type)}
                  >
                    <ListItemDecorator>
                      <Icon size={16} />
                    </ListItemDecorator>
                    <Stack spacing={0.25}>
                      <Typography level="body-sm">{block.name}</Typography>
                      <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                        {block.description}
                      </Typography>
                    </Stack>
                  </MenuItem>
                );
              })}
            </React.Fragment>
          ))}
        </Menu>
      </Box>
    </Dropdown>
  );
}

export default function StudioCanvas({
  blocks,
  selectedBlockId,
  canvasWidth,
  activeDropIndex,
  isSidebarDragActive,
  isDraggingOverCanvas,
  recentlyAddedBlockId,
  removingBlockIds,
  onReorder,
  onSelect,
  onDelete,
  onDuplicate,
  onInsertAt,
  onDoubleClickBlock,
  onUpdateBlockField,
}: StudioCanvasProps) {
  const contentBlocks = React.useMemo(
    () => blocks.filter((block) => block.type !== "footer"),
    [blocks],
  );
  const footerBlock = React.useMemo(
    () => blocks.find((block) => block.type === "footer") ?? null,
    [blocks],
  );
  const { setNodeRef: setAppendDropRef } = useDroppable({
    id: STUDIO_CANVAS_APPEND_DROP_ID,
    data: {
      kind: "canvas-append",
    },
  });
  const { setNodeRef: setEmptyDropRef } = useDroppable({
    id: STUDIO_CANVAS_EMPTY_DROP_ID,
    data: {
      kind: "canvas-empty",
    },
  });

  return (
    <Box
      onClick={() => onSelect(null)}
      sx={{
        minWidth: 0,
        minHeight: 0,
        height: "100%",
        overflowY: "auto",
        bgcolor: "neutral.50",
        backgroundImage:
          "radial-gradient(circle, rgba(0,0,0,0.04) 1px, transparent 1px)",
        backgroundSize: "24px 24px",
        "&, & *, & *::before, & *::after": {
          boxSizing: "border-box",
        },
        "&::-webkit-scrollbar": { width: "4px" },
        "&::-webkit-scrollbar-thumb": {
          bgcolor: "neutral.200",
          borderRadius: "4px",
        },
        "&::-webkit-scrollbar-track": { bgcolor: "transparent" },
      }}
    >
      <Box
        sx={{
          width: "100%",
          maxWidth: canvasWidth,
          mx: "auto",
          my: 4,
          px: { xs: 2, md: 0 },
          transition: "max-width 300ms ease",
        }}
      >
        <Stack spacing={1} sx={{ mb: 1.5 }}>
          <Stack
            direction="row"
            alignItems="center"
            spacing={1.25}
            justifyContent="center"
          >
            <Box
              sx={{
                width: 44,
                height: "1px",
                background:
                  "linear-gradient(to right, transparent, rgba(0,0,0,0.1))",
              }}
            />
            <Typography
              level="body-xs"
              sx={{
                color: "neutral.300",
                fontSize: "10px",
                letterSpacing: "0.15em",
                textTransform: "uppercase",
              }}
            >
              {canvasWidth}px content width
            </Typography>
            <Box
              sx={{
                width: 44,
                height: "1px",
                background:
                  "linear-gradient(to right, rgba(0,0,0,0.1), transparent)",
              }}
            />
          </Stack>
        </Stack>

        <Sheet
          ref={setAppendDropRef}
          onClick={(event) => {
            event.stopPropagation();

            const target = event.target as HTMLElement;

            if (!target.closest("[data-studio-block-slot='true']")) {
              onSelect(null);
            }
          }}
          sx={{
            bgcolor: "#ffffff",
            borderRadius: "12px",
            overflow: "visible",
            transition:
              "box-shadow 180ms ease, background-color 180ms ease, max-width 300ms ease",
            boxShadow: isDraggingOverCanvas
              ? "0 1px 3px rgba(0,0,0,0.1), 0 12px 32px rgba(13,110,253,0.12)"
              : "0 1px 3px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.04)",
          }}
        >
          <Box sx={{ px: { xs: 2, md: 3 }, py: 3 }}>
            {contentBlocks.length === 0 ? (
              <Sheet
                ref={setEmptyDropRef}
                variant="plain"
                sx={{
                  minHeight: 360,
                  border: "1.5px dashed",
                  borderColor: isDraggingOverCanvas
                    ? "primary.300"
                    : "neutral.200",
                  borderRadius: "12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  px: 3,
                  textAlign: "center",
                  bgcolor: isDraggingOverCanvas ? "primary.50" : "transparent",
                  transition: "all 120ms ease",
                }}
              >
                <Stack spacing={1.25} alignItems="center">
                  <Box sx={{ color: "neutral.200", display: "flex" }}>
                    <Mail size={40} />
                  </Box>
                  <Typography level="title-sm" sx={{ color: "neutral.400" }}>
                    Design your email
                  </Typography>
                  <Typography
                    level="body-xs"
                    sx={{ color: "neutral.300", maxWidth: 280 }}
                  >
                    Drag a block from the library or click + to begin
                  </Typography>
                  <Button
                    variant="soft"
                    color="neutral"
                    size="sm"
                    startDecorator={<Plus size={14} />}
                    onClick={() => onInsertAt(0, DEFAULT_EMPTY_BLOCK_TYPE)}
                    sx={{ borderRadius: "8px", fontWeight: 500 }}
                  >
                    Add First Block
                  </Button>
                </Stack>
              </Sheet>
            ) : (
              <Stack spacing={0}>
                {contentBlocks.map((block, index) => (
                  <React.Fragment key={block.id}>
                    <CanvasInsertionPoint
                      index={index}
                      onInsertAt={onInsertAt}
                      isSidebarDragActive={isSidebarDragActive}
                      isActiveDropTarget={activeDropIndex === index}
                    />
                    <CanvasBlockSlot
                      block={block}
                      isSelected={selectedBlockId === block.id}
                      isFirst={index === 0}
                      isLast={index === contentBlocks.length - 1}
                      isNewlyAdded={recentlyAddedBlockId === block.id}
                      isRemoving={removingBlockIds.includes(block.id)}
                      onSelect={onSelect}
                      onDelete={onDelete}
                      onDuplicate={onDuplicate}
                      onReorder={onReorder}
                      onDoubleClick={onDoubleClickBlock}
                      onUpdateBlockField={onUpdateBlockField}
                    />
                  </React.Fragment>
                ))}
                <CanvasInsertionPoint
                  index={contentBlocks.length}
                  onInsertAt={onInsertAt}
                  isSidebarDragActive={isSidebarDragActive}
                  isActiveDropTarget={activeDropIndex === contentBlocks.length}
                />
              </Stack>
            )}
          </Box>

          {footerBlock ? (
            <Stack spacing={1.25} sx={{ pt: 0, px: { xs: 2, md: 3 }, pb: 3 }}>
              <Box
                sx={{
                  borderTop: "1px dashed",
                  borderColor: "neutral.200",
                  pt: 1.25,
                }}
              >
                <Typography
                  level="body-xs"
                  sx={{
                    color: "neutral.300",
                    textAlign: "center",
                    fontSize: "10px",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                  }}
                >
                  email footer
                </Typography>
              </Box>
              <CanvasBlockSlot
                block={footerBlock}
                isSelected={selectedBlockId === footerBlock.id}
                isFirst={contentBlocks.length === 0}
                isLast
                isNewlyAdded={recentlyAddedBlockId === footerBlock.id}
                isRemoving={removingBlockIds.includes(footerBlock.id)}
                onSelect={onSelect}
                onDelete={onDelete}
                onDuplicate={onDuplicate}
                onReorder={onReorder}
                onDoubleClick={onDoubleClickBlock}
                onUpdateBlockField={onUpdateBlockField}
              />
            </Stack>
          ) : null}
        </Sheet>
      </Box>
    </Box>
  );
}
