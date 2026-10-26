import * as React from "react";
import { useDraggable } from "@dnd-kit/core";
import Box from "@mui/joy/Box";
import IconButton from "@mui/joy/IconButton";
import Input from "@mui/joy/Input";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Tooltip from "@mui/joy/Tooltip";
import Typography from "@mui/joy/Typography";
import { ChevronDown, ChevronRight, Heart, Search } from "lucide-react";
import {
  BLOCK_CATEGORIES,
  type StudioBlockDefinition,
  type StudioBlockType,
} from "@/components/crm/studio/blockLibraryData";
import { getStudioLibraryDragId } from "@/components/crm/studio/studioCanvasTypes";
import type { StudioBlock } from "@/types/studioBlocks";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const DEFAULT_OPEN_CATEGORIES = Object.fromEntries(
  BLOCK_CATEGORIES.map((category) => [category.id, true]),
) as Record<string, boolean>;

type BlockLibraryProps = {
  blocks: StudioBlock[];
  onAddBlock: (blockType: StudioBlockType) => void;
  onSelectBlock: (blockId: string) => void;
  onInsertSavedBlock: (block: StudioBlock) => void;
};

type LibraryBlockCardProps = {
  block: StudioBlockDefinition;
  onAddBlock: (blockType: StudioBlockType) => void;
  savedBlock: boolean;
  onToggleSavedBlock: (blockType: StudioBlockType) => void;
  disabled?: boolean;
  disabledReason?: string;
  onDisabledClick?: () => void;
};

function LibraryBlockCard({
  block,
  onAddBlock,
  savedBlock,
  onToggleSavedBlock,
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
      <IconButton size="sm" variant="plain" aria-label={savedBlock ? `Remove ${block.name} from Saved Blocks` : `Add ${block.name} to Saved Blocks`} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onToggleSavedBlock(block.type); }} sx={{ color: savedBlock ? "#334e49" : "neutral.400", minWidth: 28 }}><Heart size={17} fill={savedBlock ? "currentColor" : "none"} /></IconButton>
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
  onInsertSavedBlock,
}: BlockLibraryProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const { tenant } = useTenant();
  const { user } = useAuth();
  const [savedTemplates, setSavedTemplates] = React.useState<Array<{ id: string; name: string; block: StudioBlock }>>([]);
  const [savedError, setSavedError] = React.useState("");
  const [savedLoading, setSavedLoading] = React.useState(false);
  const loadSaved = React.useCallback(async () => {
    if (!tenant?.id || !user?.id) { setSavedTemplates([]); return; }
    setSavedLoading(true);
    const { data, error } = await supabase.from("crm_saved_blocks" as any)
      .select("id,name,block_data").eq("tenant_id", tenant.id).order("created_at", { ascending: false });
    setSavedLoading(false);
    if (error) { setSavedError("Saved Blocks could not be loaded. Please retry."); return; }
    setSavedError("");
    setSavedTemplates(((data || []) as any[]).filter(item => item.block_data && typeof item.block_data.type === "string")
      .map(item => ({ id: item.id, name: item.name, block: item.block_data as StudioBlock })));
  }, [tenant?.id, user?.id]);
  React.useEffect(() => { void loadSaved(); }, [loadSaved]);
  const saveConfiguredBlock = async (block: StudioBlock) => {
    if (block.type === "footer" || !tenant?.id || !user?.id) return;
    setSavedError("");
    const { error } = await supabase.from("crm_saved_blocks" as any).insert({
      tenant_id: tenant.id, created_by: user.id,
      name: (block.headline || block.label || "Saved Block").slice(0, 160),
      block_data: { ...block },
    } as any);
    if (error) { setSavedError("Could not save this block to your account."); return; }
    await loadSaved();
  };
  const removeSaved = async (id: string) => {
    if (!tenant?.id) return;
    const { error } = await supabase.from("crm_saved_blocks" as any).delete().eq("id", id).eq("tenant_id", tenant.id);
    if (error) { setSavedError("Could not remove this saved block."); return; }
    await loadSaved();
  };
  // One-way migration of old browser templates; never delete local copies until
  // all insertions succeed. Deduplicate this browser's migrated IDs per tenant.
  React.useEffect(() => {
    if (!tenant?.id || !user?.id || savedLoading) return;
    const migrationKey = `bloomsuite-saved-blocks-migrated:${tenant.id}`;
    if (localStorage.getItem(migrationKey) === "done") return;
    let legacy: Array<{ name: string; block: StudioBlock }> = [];
    try {
      const parsed = JSON.parse(localStorage.getItem("bloomsuite-saved-block-templates") || "[]");
      if (Array.isArray(parsed)) legacy = parsed.filter(item => item?.block?.type && item.block.type !== "footer");
    } catch { return; }
    if (!legacy.length) { localStorage.setItem(migrationKey, "done"); return; }
    let cancelled = false;
    (async () => {
      const payload = legacy.map(item => ({
        tenant_id: tenant.id, created_by: user.id,
        name: String(item.name || item.block.label || "Saved Block").slice(0, 160),
        block_data: item.block,
      }));
      const { error } = await supabase.from("crm_saved_blocks" as any).insert(payload as any);
      if (!error && !cancelled) {
        localStorage.setItem(migrationKey, "done");
        await loadSaved();
      }
    })();
    return () => { cancelled = true; };
  }, [tenant?.id, user?.id, loadSaved, savedLoading]);
  const [savedBlocks, setSavedBlocks] = React.useState<StudioBlockType[]>(() => { try { const value = JSON.parse(localStorage.getItem("bloomsuite-studio-saved-block-types") || "[]"); return Array.isArray(value) ? value.filter((type): type is StudioBlockType => BLOCK_CATEGORIES.some(c => c.blocks.some(b => b.type === type))) : []; } catch { return []; } });
  const toggleSavedBlock = React.useCallback((type: StudioBlockType) => { setSavedBlocks(current => { const next = current.includes(type) ? current.filter(item => item !== type) : [...current, type]; try { localStorage.setItem("bloomsuite-studio-saved-block-types", JSON.stringify(next)); } catch { /* private browsing */ } return next; }); }, []);
  const [openCategories, setOpenCategories] = React.useState(
    DEFAULT_OPEN_CATEGORIES,
  );
  const footerBlockId = React.useMemo(
    () => blocks.find((block) => block.type === "footer")?.id ?? null,
    [blocks],
  );

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const visibleCategories = React.useMemo(() => {
    const allBlocks = BLOCK_CATEGORIES.flatMap(category => category.blocks);
    const groups = savedBlocks.length ? [{ id: "saved-blocks", label: "Saved Blocks", blocks: allBlocks.filter(block => savedBlocks.includes(block.type)) }, ...BLOCK_CATEGORIES] : BLOCK_CATEGORIES;
    return groups.map((category) => ({
      ...category,
      blocks: category.blocks.filter((block) => {
        if (!normalizedQuery) {
          return true;
        }

        const haystack = `${block.name} ${block.description}`.toLowerCase();
        return haystack.includes(normalizedQuery);
      }),
    })).filter((category) => category.blocks.length > 0);
  }, [normalizedQuery, savedBlocks]);

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
        <Box sx={{ mb: 2 }}>
          <Typography level="body-xs" sx={{ mb: 1, fontWeight: 700, textTransform: "uppercase" }}>Saved Blocks</Typography>
          {savedLoading && <Typography level="body-xs">Loading saved blocks…</Typography>}
          {savedError && <Typography level="body-xs" color="danger">{savedError}</Typography>}
          {savedTemplates.map(entry => (
            <Box key={entry.id} sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5 }}>
              <Box role="button" tabIndex={0} onClick={() => onInsertSavedBlock(entry.block)} onKeyDown={event => { if (event.key === "Enter") onInsertSavedBlock(entry.block); }} sx={{ flex: 1, cursor: "pointer", bgcolor: "neutral.50", p: 1, borderRadius: "6px" }}>
                <Typography level="body-sm">{entry.name}</Typography>
              </Box>
              <IconButton size="sm" aria-label={`Remove ${entry.name} saved block`} onClick={() => { void removeSaved(entry.id); }}><Heart size={16} fill="currentColor" /></IconButton>
            </Box>
          ))}
          <Typography level="body-xs" sx={{ mt: 1, color: "neutral.500" }}>Save a customized block from this newsletter:</Typography>
          {blocks.filter(block => block.type !== "footer").map(block => (
            <Box key={block.id} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
              <Typography level="body-xs" sx={{ maxWidth: 175, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{block.headline || block.label}</Typography>
              <IconButton size="sm" aria-label={`Save ${block.headline || block.label} as Saved Block`} onClick={() => { void saveConfiguredBlock(block); }}><Heart size={16} /></IconButton>
            </Box>
          ))}
        </Box>
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
                        savedBlock={savedBlocks.includes(block.type)}
                        onToggleSavedBlock={toggleSavedBlock}
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
