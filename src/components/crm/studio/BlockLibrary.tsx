import * as React from "react";
import { useDraggable } from "@dnd-kit/core";
import Box from "@mui/joy/Box";
import IconButton from "@mui/joy/IconButton";
import Input from "@mui/joy/Input";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Tooltip from "@mui/joy/Tooltip";
import Typography from "@mui/joy/Typography";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import {
  BLOCK_CATEGORIES,
  type StudioBlockDefinition,
  type StudioBlockType,
} from "@/components/crm/studio/blockLibraryData";
import { getStudioLibraryDragId } from "@/components/crm/studio/studioCanvasTypes";
import type { StudioBlock } from "@/types/studioBlocks";

const DEFAULT_OPEN_CATEGORIES = Object.fromEntries(
  BLOCK_CATEGORIES.map((category) => [category.id, true]),
) as Record<string, boolean>;

type BlockLibraryProps = {
  blocks: StudioBlock[];
  onAddBlock: (blockType: StudioBlockType) => void;
  onSelectBlock: (blockId: string) => void;
};

type LibraryBlockCardProps = {
  block: StudioBlockDefinition;
  onAddBlock: (blockType: StudioBlockType) => void;
  disabled?: boolean;
  disabledReason?: string;
  onDisabledClick?: () => void;
};

function LibraryBlockCard({
  block,
  onAddBlock,
  disabled = false,
  disabledReason,
  onDisabledClick,
}: LibraryBlockCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: getStudioLibraryDragId(block.type),
    disabled,
    data: {
      kind: "library-block",
      blockType: block.type,
      label: block.name,
    },
  });

  const Icon = block.icon;
  const handleActivate = React.useCallback(() => {
    if (disabled) {
      onDisabledClick?.();
      return;
    }

    onAddBlock(block.type);
  }, [block.type, disabled, onAddBlock, onDisabledClick]);

  const card = (
    <Sheet
      ref={setNodeRef}
      variant="plain"
      role="button"
      tabIndex={0}
      aria-disabled={disabled || undefined}
      onClick={handleActivate}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleActivate();
        }
      }}
      {...attributes}
      {...listeners}
      sx={{
        borderRadius: "8px",
        p: 1.25,
        cursor: disabled ? "not-allowed" : isDragging ? "grabbing" : "grab",
        transition: "all 120ms ease",
        display: "flex",
        alignItems: "center",
        gap: 1,
        minHeight: 52,
        touchAction: disabled ? "auto" : "none",
        bgcolor: "transparent",
        opacity: disabled ? 0.4 : isDragging ? 0.5 : 1,
        transform: isDragging ? "scale(0.97)" : "scale(1)",
        "&:hover": disabled
          ? undefined
          : {
              bgcolor: "neutral.50",
              "& .studio-library-icon": {
                bgcolor: "neutral.100",
              },
            },
        "&:active": disabled
          ? undefined
          : {
              transform: "scale(0.98)",
              cursor: "grabbing",
            },
        "&:focus-visible": {
          outline: "2px solid",
          outlineColor: disabled ? "neutral.300" : "neutral.400",
          outlineOffset: "2px",
        },
      }}
    >
      <Box
        className="studio-library-icon"
        sx={{
          width: 28,
          height: 28,
          flexShrink: 0,
          borderRadius: "6px",
          bgcolor: "neutral.50",
          color: "neutral.500",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 120ms ease",
        }}
      >
        <Icon size={16} color="currentColor" />
      </Box>
      <Stack spacing={0.15} sx={{ minWidth: 0, flex: 1 }}>
        <Typography
          level="body-sm"
          sx={{
            fontSize: "13px",
            fontWeight: 500,
            color: "text.primary",
            lineHeight: 1.2,
          }}
        >
          {block.name}
        </Typography>
        <Typography
          level="body-xs"
          sx={{
            color: "neutral.400",
            fontSize: "11.5px",
            overflow: "hidden",
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
            lineHeight: 1.25,
          }}
        >
          {block.description}
        </Typography>
        {disabledReason ? (
          <Typography
            level="body-xs"
            sx={{ color: "neutral.400", fontSize: "10px", lineHeight: 1.2 }}
          >
            {disabledReason}
          </Typography>
        ) : null}
      </Stack>
    </Sheet>
  );

  if (disabled && disabledReason) {
    return <Tooltip title={disabledReason}>{card}</Tooltip>;
  }

  return card;
}

export default function BlockLibrary({
  blocks,
  onAddBlock,
  onSelectBlock,
}: BlockLibraryProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [openCategories, setOpenCategories] = React.useState(
    DEFAULT_OPEN_CATEGORIES,
  );
  const footerBlockId = React.useMemo(
    () => blocks.find((block) => block.type === "footer")?.id ?? null,
    [blocks],
  );

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const visibleCategories = React.useMemo(() => {
    return BLOCK_CATEGORIES.map((category) => ({
      ...category,
      blocks: category.blocks.filter((block) => {
        if (!normalizedQuery) {
          return true;
        }

        const haystack = `${block.name} ${block.description}`.toLowerCase();
        return haystack.includes(normalizedQuery);
      }),
    })).filter((category) => category.blocks.length > 0);
  }, [normalizedQuery]);

  const toggleCategory = React.useCallback((categoryId: string) => {
    setOpenCategories((current) => ({
      ...current,
      [categoryId]: !current[categoryId],
    }));
  }, []);

  return (
    <Sheet
      sx={{
        width: 264,
        height: "100%",
        display: "grid",
        gridTemplateRows: "auto minmax(0, 1fr) auto",
        bgcolor: "background.surface",
        boxShadow: "1px 0 0 0 rgba(0,0,0,0.06)",
      }}
    >
      <Sheet
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 1,
          p: 1.5,
          bgcolor: "background.surface",
        }}
      >
        <Input
          size="sm"
          variant="plain"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search blocks..."
          startDecorator={<Search size={15} />}
          sx={{
            mb: 1.5,
            borderRadius: "8px",
            bgcolor: "neutral.50",
            fontSize: "13px",
            color: "text.primary",
            "--Input-minHeight": "34px",
            "& svg": { color: "neutral.400" },
            "& input::placeholder": { color: "neutral.400", opacity: 1 },
            "&:focus-within": {
              bgcolor: "neutral.100",
              outline: "1.5px solid",
              outlineColor: "primary.200",
            },
          }}
        />
      </Sheet>

      <Box
        sx={{
          minHeight: 0,
          overflowY: "auto",
          px: 1.5,
          pb: 1.5,
          "&::-webkit-scrollbar": { width: "4px" },
          "&::-webkit-scrollbar-thumb": {
            bgcolor: "neutral.200",
            borderRadius: "4px",
          },
          "&::-webkit-scrollbar-track": { bgcolor: "transparent" },
        }}
      >
        {visibleCategories.length > 0 ? (
          visibleCategories.map((category, index) => {
            const isOpen = openCategories[category.id] ?? true;

            return (
              <Box key={category.id} sx={{ mt: index === 0 ? 0 : 2 }}>
                <Box
                  onClick={() => toggleCategory(category.id)}
                  sx={{
                    mb: 0.75,
                    pb: 0.5,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 1,
                    cursor: "pointer",
                    userSelect: "none",
                    borderBottom: "1px solid",
                    borderColor: "neutral.100",
                  }}
                >
                  <Typography
                    level="body-xs"
                    sx={{
                      color: "neutral.400",
                      fontSize: "10.5px",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                    }}
                  >
                    {category.label}
                  </Typography>
                  <IconButton
                    size="sm"
                    variant="plain"
                    color="neutral"
                    aria-label={`${isOpen ? "Collapse" : "Expand"} ${category.label}`}
                    sx={{
                      minWidth: 18,
                      minHeight: 18,
                      width: 18,
                      height: 18,
                      opacity: 0.45,
                      transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)",
                      "&:hover": { bgcolor: "transparent", opacity: 0.8 },
                    }}
                  >
                    {isOpen ? (
                      <ChevronDown size={12} />
                    ) : (
                      <ChevronRight size={12} />
                    )}
                  </IconButton>
                </Box>

                {isOpen ? (
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 0.25,
                    }}
                  >
                    {category.blocks.map((block) => (
                      <LibraryBlockCard
                        key={block.type}
                        block={block}
                        onAddBlock={onAddBlock}
                        disabled={
                          block.type === "footer" && Boolean(footerBlockId)
                        }
                        disabledReason={
                          block.type === "footer" && footerBlockId
                            ? "Footer already added"
                            : undefined
                        }
                        onDisabledClick={
                          block.type === "footer" && footerBlockId
                            ? () => onSelectBlock(footerBlockId)
                            : undefined
                        }
                      />
                    ))}
                  </Box>
                ) : null}
              </Box>
            );
          })
        ) : (
          <Stack
            alignItems="center"
            justifyContent="center"
            sx={{ minHeight: "100%", px: 2, textAlign: "center" }}
          >
            <Typography level="body-sm" sx={{ color: "neutral.500" }}>
              No blocks match your search
            </Typography>
          </Stack>
        )}
      </Box>

      <Sheet sx={{ px: 1.5, py: 1.25, bgcolor: "background.surface" }}>
        <Typography
          level="body-xs"
          sx={{ color: "neutral.300", textAlign: "center", fontSize: "11px" }}
        >
          Drag blocks to canvas
        </Typography>
      </Sheet>
    </Sheet>
  );
}
