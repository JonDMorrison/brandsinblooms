import * as React from "react";
import { useDraggable } from "@dnd-kit/core";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import IconButton from "@mui/joy/IconButton";
import Input from "@mui/joy/Input";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import Modal from "@mui/joy/Modal";
import ModalDialog from "@mui/joy/ModalDialog";
import {
  Search,
  Globe2,
  Heart,
  Pencil,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  ArrowUpToLine,
  ArrowDownToLine,
} from "lucide-react";
import {
  BLOCK_CATEGORIES,
  getBlockDisplayLabel,
  STUDIO_BLOCK_LOOKUP,
  type StudioBlockDefinition,
  type StudioBlockType,
} from "./blockLibraryData";
import { getStudioLibraryDragId } from "./studioCanvasTypes";
import type { StudioBlock } from "@/types/studioBlocks";
import { useSavedNewsletterBlocks } from "@/hooks/useSavedNewsletterBlocks";
import { readBrowserSavedBlocks } from "@/lib/studio/newsletter/savedBlocks";
import { Field } from "./newsletter/AppearanceControls";

type Props = {
  blocks: StudioBlock[];
  onAddBlock: (type: StudioBlockType) => void;
  onSelectBlock: (id: string) => void;
  onInsertWebsiteContent?: () => void;
  onInsertSavedBlock: (block: StudioBlock) => void;
  onInsertImportedBlocks?: (blocks: StudioBlock[]) => void;
  onDuplicateBlock?: (id: string) => void;
  onDeleteBlock?: (id: string) => void;
  onMoveBlock?: (id: string, direction: "up" | "down") => void;
  selectedBlockId?: string | null;
  /** This week's theme blocks (copy and photos) to insert one at a time. */
  weeklyTheme?: WeeklyThemeLibrary | null;
};

export interface WeeklyThemeLibrary {
  title: string;
  weekLabel: string;
  blocks: Array<{ name: string; block: StudioBlock }>;
}

function WeeklyThemeSection({
  theme,
  onInsert,
  onInsertAll,
}: {
  theme: WeeklyThemeLibrary;
  onInsert: (block: StudioBlock) => void;
  onInsertAll?: (blocks: StudioBlock[]) => void;
}) {
  return (
    <details open data-testid="block-library-weekly-theme" style={{ marginBottom: 8 }}>
      <summary
        style={{
          fontWeight: 750,
          color: "#203b40",
          padding: "12px 0",
          borderBottom: "1px solid #b8c5c8",
          cursor: "pointer",
        }}
      >
        This week's theme · {theme.weekLabel}
      </summary>
      <Typography level="body-xs" sx={{ color: "#526b72", mt: 1 }}>
        {theme.title}
      </Typography>
      <Stack spacing={0.5} sx={{ mt: 1 }}>
        {theme.blocks.map(({ name, block }) => (
          <button
            key={block.id}
            type="button"
            className="nl-quiet"
            style={{ textAlign: "left", whiteSpace: "normal", display: "flex", gap: 8, alignItems: "center" }}
            onClick={() => onInsert(block)}
          >
            {block.imageUrl ? (
              <img
                src={block.imageUrl}
                alt=""
                width={40}
                height={30}
                style={{ objectFit: "cover", borderRadius: 4, flexShrink: 0 }}
              />
            ) : null}
            <span>
              {name}
              <span style={{ display: "block", fontSize: 11, color: "#526b72" }}>
                {STUDIO_BLOCK_LOOKUP[block.type]?.name}
              </span>
            </span>
          </button>
        ))}
        {onInsertAll && theme.blocks.length > 1 ? (
          <button
            type="button"
            className="nl-quiet"
            onClick={() => onInsertAll(theme.blocks.map((entry) => entry.block))}
          >
            Add all {theme.blocks.length} theme blocks
          </button>
        ) : null}
      </Stack>
    </details>
  );
}
function LibraryCard({
  definition,
  onAdd,
  disabled,
  onSelectFooter,
}: {
  definition: StudioBlockDefinition;
  onAdd: (type: StudioBlockType) => void;
  disabled?: boolean;
  onSelectFooter?: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: getStudioLibraryDragId(definition.type),
    disabled,
    data: {
      kind: "library-block",
      blockType: definition.type,
      label: definition.name,
    },
  });
  const Icon = definition.icon;
  return (
    <Sheet
      component="button"
      type="button"
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => (disabled ? onSelectFooter?.() : onAdd(definition.type))}
      aria-label={`Add ${definition.name}`}
      aria-disabled={disabled || undefined}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        p: 1.5,
        minHeight: 64,
        border: 0,
        width: "100%",
        textAlign: "left",
        borderRadius: 10,
        cursor: disabled ? "pointer" : "grab",
        bgcolor: "transparent",
        opacity: isDragging ? 0.5 : 1,
        touchAction: disabled ? "auto" : "none",
        transition: "background-color 160ms ease, transform 120ms ease",
        "&:active": { transform: "scale(0.985)" },
        "@media (prefers-reduced-motion: reduce)": { transition: "none", "&:active": { transform: "none" } },
        "&:hover": { bgcolor: "#e8f0eb" },
        "&:focus-visible .library-add, &:hover .library-add": { opacity: 1 },
        "&:focus-visible": { outline: "2px solid #234b49" },
      }}
    >
      <Box
        sx={{
          p: 1.1,
          borderRadius: 8,
          bgcolor: "#e0e7e7",
          color: "#34554f",
          display: "flex",
        }}
      >
        <Icon size={20} />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography
          level="body-sm"
          sx={{ fontWeight: 600, color: "#263d42", fontSize: 14 }}
        >
          {definition.name}
        </Typography>
        <Typography
          level="body-xs"
          sx={{ color: "#526b72", fontSize: 13, lineHeight: 1.45 }}
        >
          {disabled ? "Already added. Select footer." : definition.description}
        </Typography>
      </Box>
      {!disabled && <Typography className="library-add" aria-hidden="true" level="body-xs" sx={{ ml: "auto", color: "#315f53", fontWeight: 700, opacity: 0, transition: "opacity 150ms" }}>Add</Typography>}
    </Sheet>
  );
}
export default function BlockLibrary({
  blocks,
  onAddBlock,
  onSelectBlock,
  onInsertWebsiteContent,
  onInsertSavedBlock,
  onInsertImportedBlocks,
  onDuplicateBlock,
  onDeleteBlock,
  onMoveBlock,
  selectedBlockId,
  weeklyTheme = null,
}: Props) {
  const [tab, setTab] = React.useState<"blocks" | "outline" | "saved">(
    "blocks",
  );
  const [search, setSearch] = React.useState("");
  const saved = useSavedNewsletterBlocks();
  const [dialog, setDialog] = React.useState<
    | { kind: "create"; block: StudioBlock }
    | { kind: "rename"; id: string }
    | null
  >(null);
  const [name, setName] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState("");
  const [legacy, setLegacy] = React.useState(() => {
    try {
      return typeof window !== "undefined"
        ? readBrowserSavedBlocks(window.localStorage)
        : [];
    } catch {
      return [];
    }
  });
  const [importing, setImporting] = React.useState(false);
  const currentScope = React.useRef(saved.scopeKey);
  currentScope.current = saved.scopeKey;
  React.useEffect(() => {
    setDialog(null);
    setName("");
    setMessage("");
    setError("");
  }, [saved.scopeKey]);
  const query = search.trim().toLowerCase();
  const footer = blocks.find((block) => block.type === "footer");
  const editable = blocks.filter((block) => block.type !== "footer");
  const openSave = (block: StudioBlock) => {
    setName(
      block.label ||
        block.headline ||
        STUDIO_BLOCK_LOOKUP[block.type]?.name ||
        "Saved Block",
    );
    setDialog({ kind: "create", block });
    setError("");
  };
  const categories = BLOCK_CATEGORIES.map((category) => ({
    ...category,
    blocks: category.blocks.filter((block) =>
      `${block.name} ${block.description}`.toLowerCase().includes(query),
    ),
  })).filter((category) => category.blocks.length);
  return (
    <Sheet
      sx={{
        width: { md: 288, xl: 320 },
        height: "100%",
        display: "flex",
        flexDirection: "column",
        borderRight: "1px solid #d6dfd9",
        bgcolor: "#f7f9f6",
        minHeight: 0,
      }}
    >
      <Box sx={{ p: 2, borderBottom: "1px solid #d6dfd9" }}>
        <Typography level="title-md" sx={{ color: "#243c41", mb: 1.5 }}>
          Build your email
        </Typography>
        <Box
          role="tablist"
          aria-label="Newsletter navigation"
          sx={{ display: "flex", gap: 0.5, mb: 1.5, "& button": { transition: "transform 120ms ease, background-color 160ms ease" }, "& button:active": { transform: "scale(0.97)" }, "@media (prefers-reduced-motion: reduce)": { "& button": { transition: "none" }, "& button:active": { transform: "none" } } }}
        >
          {(["blocks", "outline", "saved"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              className="nl-quiet"
              style={{
                flex: 1,
                padding: "10px 4px",
                minHeight: 44,
                borderRadius: 8,
                fontSize: 14,
                background: tab === value ? "#254b49" : undefined,
                color: tab === value ? "#fff" : undefined,
              }}
              onClick={() => setTab(value)}
            >
              {value === "blocks"
                ? "Blocks"
                : value === "outline"
                  ? "Outline"
                  : "Saved blocks"}
            </button>
          ))}
        </Box>
        <Input
          size="sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={
            tab === "outline"
              ? "Find a block…"
              : tab === "saved"
                ? "Search saved blocks…"
                : "Search blocks…"
          }
          startDecorator={<Search size={16} />}
          sx={{
            minHeight: 44,
            bgcolor: "#fff",
            borderRadius: 8,
            borderColor: "#b9c9c0",
            color: "#203137",
            "& input::placeholder": { color: "#62777d", opacity: 1 },
          }}
        />
      </Box>
      {onInsertWebsiteContent && <Button variant="outlined" color="neutral" startDecorator={<Globe2 size={16} />} onClick={onInsertWebsiteContent} sx={{ mx: 2, mb: 1 }}>From my website</Button>}
      <Box sx={{ overflowY: "auto", minHeight: 0, p: 2, flex: 1 }}>
        {tab === "blocks" && (
          <>
            <Typography
              level="body-xs"
              sx={{ fontWeight: 700, color: "#344b50", mb: 1 }}
            >
              Click a block to add it to your email
            </Typography>
            {weeklyTheme && weeklyTheme.blocks.length > 0 && !query ? (
              <WeeklyThemeSection
                theme={weeklyTheme}
                onInsert={onInsertSavedBlock}
                onInsertAll={onInsertImportedBlocks}
              />
            ) : null}
            {categories.map((category) => (
              <details key={category.id} open style={{ marginBottom: 14 }}>
                <summary
                  style={{
                    fontSize: 14,
                    fontWeight: 750,
                    color: "#203b40",
                    padding: "12px 0",
                    borderBottom: "1px solid #b8c5c8",
                    cursor: "pointer",
                  }}
                >
                  {category.label}
                </summary>
                <Stack spacing={0.5} sx={{ mt: 1 }}>
                  {category.blocks.map((definition) => (
                    <LibraryCard
                      key={definition.type}
                      definition={definition}
                      onAdd={onAddBlock}
                      disabled={definition.type === "footer" && Boolean(footer)}
                      onSelectFooter={() => footer && onSelectBlock(footer.id)}
                    />
                  ))}
                </Stack>
              </details>
            ))}
            {!categories.length && (
              <p className="nl-note">No blocks match your search.</p>
            )}
          </>
        )}
        {tab === "outline" && (
          <>
            <Typography
              level="body-xs"
              sx={{ fontWeight: 700, color: "#344b50", mb: 1 }}
            >
              Newsletter outline
            </Typography>
            <div className="nl-inline" style={{ marginBottom: 12 }}>
              <button
                type="button"
                className="nl-quiet"
                onClick={() => blocks[0] && onSelectBlock(blocks[0].id)}
              >
                <ArrowUpToLine size={14} /> Top
              </button>
              <button
                type="button"
                className="nl-quiet"
                onClick={() =>
                  blocks.at(-1) && onSelectBlock(blocks.at(-1)!.id)
                }
              >
                <ArrowDownToLine size={14} /> Bottom
              </button>
            </div>
            {blocks
              .filter((block) =>
                `${block.label} ${block.headline || ""}`
                  .toLowerCase()
                  .includes(query),
              )
              .map((block) => (
                <Box
                  key={block.id}
                  sx={{
                    p: 1,
                    mb: 1,
                    border: "1px solid",
                    borderColor:
                      selectedBlockId === block.id ? "#315c58" : "#c2ced0",
                    borderRadius: 6,
                    bgcolor: selectedBlockId === block.id ? "#e5eeed" : "#fff",
                  }}
                >
                  <button
                    type="button"
                    className="nl-quiet"
                    style={{
                      border: 0,
                      background: "transparent",
                      width: "100%",
                      textAlign: "left",
                      whiteSpace: "normal",
                      fontWeight: 650,
                    }}
                    onClick={() => onSelectBlock(block.id)}
                  >
                    {blocks.indexOf(block) + 1}.{" "}
                    {getBlockDisplayLabel(block)}
                  </button>
                  {(() => {
                    const typeName = STUDIO_BLOCK_LOOKUP[block.type]?.name;
                    const details = [
                      getBlockDisplayLabel(block) !== typeName ? typeName : "",
                      block.visible === false ? "Hidden" : "",
                      block.audience?.mode === "segments"
                        ? "Only some customers see this"
                        : "",
                    ].filter(Boolean);
                    return details.length ? (
                      <Typography
                        level="body-xs"
                        sx={{ color: "#526b72", px: 1 }}
                      >
                        {details.join(" · ")}
                      </Typography>
                    ) : null;
                  })()}
                  {block.type !== "footer" && (
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        mt: 0.5,
                      }}
                    >
                      <IconButton
                        size="sm"
                        title="Move up"
                        aria-label={`Move ${block.label} up`}
                        disabled={editable[0]?.id === block.id}
                        onClick={() => onMoveBlock?.(block.id, "up")}
                      >
                        <ChevronUp size={15} />
                      </IconButton>
                      <IconButton
                        size="sm"
                        title="Move down"
                        aria-label={`Move ${block.label} down`}
                        disabled={editable.at(-1)?.id === block.id}
                        onClick={() => onMoveBlock?.(block.id, "down")}
                      >
                        <ChevronDown size={15} />
                      </IconButton>
                      <IconButton
                        size="sm"
                        title="Make a copy"
                        aria-label={`Duplicate ${block.label}`}
                        onClick={() => onDuplicateBlock?.(block.id)}
                      >
                        <Copy size={15} />
                      </IconButton>
                      <Button
                        size="sm"
                        variant="plain"
                        color="neutral"
                        title="Save this block to use again later"
                        aria-label={`Save block ${block.label}`}
                        startDecorator={<Heart size={14} aria-hidden />}
                        onClick={() => openSave(block)}
                        sx={{ minHeight: 28, px: 0.75, fontSize: 12, whiteSpace: "nowrap" }}
                      >
                        Save block
                      </Button>
                      <IconButton
                        size="sm"
                        title="Delete"
                        aria-label={`Delete ${block.label}`}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Delete “${block.label}” from this newsletter? You can undo this change.`,
                            )
                          )
                            onDeleteBlock?.(block.id);
                        }}
                      >
                        <Trash2 size={15} />
                      </IconButton>
                    </Box>
                  )}
                </Box>
              ))}
          </>
        )}
        {tab === "saved" && (
          <>
            <Typography level="title-sm">Saved Blocks</Typography>
            <p className="nl-note">
              Shared with your team in {saved.accountName}. Inserted copies can
              be edited independently.
            </p>
            {selectedBlockId &&
              blocks.find(
                (block) =>
                  block.id === selectedBlockId && block.type !== "footer",
              ) && (
                <button
                  type="button"
                  className="nl-action"
                  disabled={!saved.ready}
                  onClick={() =>
                    openSave(
                      blocks.find((block) => block.id === selectedBlockId)!,
                    )
                  }
                >
                  Save selected block
                </button>
              )}
            {saved.loading && (
              <p className="nl-note" role="status">
                Loading saved blocks…
              </p>
            )}
            {saved.error && (
              <div role="alert">
                <p className="nl-error">{saved.error}</p>
                <button
                  type="button"
                  className="nl-quiet"
                  onClick={() => void saved.reload()}
                >
                  Retry
                </button>
              </div>
            )}
            {saved.blocks
              .filter((entry) => entry.name.toLowerCase().includes(query))
              .map((entry) => (
                <Box
                  key={entry.id}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.25,
                    mt: 1,
                    p: 0.75,
                    bgcolor: "#fff",
                    border: "1px solid #c2ced0",
                    borderRadius: 6,
                  }}
                >
                  <button
                    type="button"
                    className="nl-quiet"
                    style={{
                      flex: 1,
                      textAlign: "left",
                      border: 0,
                      whiteSpace: "normal",
                      background: "transparent",
                    }}
                    onClick={() => onInsertSavedBlock(entry.block)}
                  >
                    {entry.name}
                    <span
                      style={{
                        display: "block",
                        fontSize: 11,
                        color: "#526b72",
                      }}
                    >
                      {STUDIO_BLOCK_LOOKUP[entry.block.type]?.name}
                    </span>
                  </button>
                  <IconButton
                    size="sm"
                    aria-label={`Rename ${entry.name}`}
                    onClick={() => {
                      setName(entry.name);
                      setDialog({ kind: "rename", id: entry.id });
                      setError("");
                    }}
                  >
                    <Pencil size={14} />
                  </IconButton>
                  <IconButton
                    size="sm"
                    disabled={saved.busy}
                    aria-label={`Remove ${entry.name}`}
                    onClick={async () => {
                      if (
                        !window.confirm(
                          `Remove “${entry.name}” from the shared library? Existing newsletters will not change.`,
                        )
                      )
                        return;
                      try {
                        await saved.remove(entry.id);
                        setMessage("Saved Block removed.");
                      } catch (err) {
                        setError(
                          err instanceof Error
                            ? err.message
                            : "Could not remove saved block.",
                        );
                      }
                    }}
                  >
                    <Trash2 size={14} />
                  </IconButton>
                </Box>
              ))}
            {!saved.loading && !saved.blocks.length && !saved.error && (
              <p className="nl-note">
                Select a newsletter block, then choose “Save selected block”, or
                use its heart in the outline.
              </p>
            )}
            {legacy.length > 0 && (
              <details style={{ marginTop: 20 }}>
                <summary>Import blocks from this browser</summary>
                <p className="nl-note">
                  These older blocks have no account label. Only import them if
                  they belong to {saved.accountName}. They will not be imported
                  automatically.
                </p>
                <button
                  type="button"
                  className="nl-quiet"
                  disabled={importing || !saved.ready}
                  onClick={async () => {
                    if (
                      !window.confirm(
                        `Import ${legacy.length} browser blocks into ${saved.accountName}? Confirm they belong to this account.`,
                      )
                    )
                      return;
                    setImporting(true);
                    setError("");
                    const confirmedScope = saved.scopeKey;
                    const confirmedTenant = saved.accountId;
                    let remaining = [...legacy];
                    try {
                      for (const entry of legacy) {
                        if (currentScope.current !== confirmedScope)
                          throw new Error(
                            "Account changed. Remaining browser blocks were kept and must be reviewed again.",
                          );
                        await saved.create({
                          ...entry,
                          ...(confirmedTenant
                            ? { expectedTenantId: confirmedTenant }
                            : {}),
                        });
                        remaining = remaining.slice(1);
                        setLegacy(remaining);
                        try {
                          localStorage.setItem(
                            "bloomsuite-saved-block-templates",
                            JSON.stringify(remaining),
                          );
                        } catch {
                          /* successful account records remain authoritative */
                        }
                      }
                      if (currentScope.current === confirmedScope)
                        setMessage(
                          "Browser blocks imported into this account.",
                        );
                    } catch (err) {
                      setError(
                        err instanceof Error
                          ? err.message
                          : "Import failed. Unsaved browser blocks were kept.",
                      );
                    } finally {
                      setImporting(false);
                    }
                  }}
                >
                  {importing ? "Importing…" : `Import ${legacy.length} blocks`}
                </button>
              </details>
            )}
          </>
        )}
        {message && (
          <p className="nl-note" role="status">
            {message}
          </p>
        )}
        {error && !dialog && (
          <p className="nl-error" role="alert">
            {error}
          </p>
        )}
      </Box>
      {/* The "add a block" hint appears once, at the top of the Blocks tab.
          Import data / spreadsheet lives in the Studio top bar's More menu. */}
      <Modal
        open={Boolean(dialog)}
        onClose={() => !saved.busy && setDialog(null)}
      >
        <ModalDialog sx={{ width: 400, maxWidth: "calc(100vw - 24px)" }}>
          <Typography level="h4">
            {dialog?.kind === "rename" ? "Rename Saved Block" : "Save Block"}
          </Typography>
          <Field
            label="Block name"
            value={name}
            onChange={setName}
            placeholder="e.g. Spring lawn-care offer"
          />
          <p className="nl-note">
            Saved to {saved.accountName}, including its images, text, links and
            styling.
          </p>
          {error && (
            <p className="nl-error" role="alert">
              {error}
            </p>
          )}
          <div className="nl-inline">
            <button
              type="button"
              className="nl-quiet"
              disabled={saved.busy}
              onClick={() => setDialog(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="nl-action"
              disabled={saved.busy || !name.trim() || !saved.ready}
              onClick={async () => {
                if (!dialog) return;
                const confirmedScope = saved.scopeKey;
                try {
                  if (dialog.kind === "create")
                    await saved.create({
                      name,
                      block: dialog.block,
                      ...(saved.accountId
                        ? { expectedTenantId: saved.accountId }
                        : {}),
                    });
                  else await saved.rename({ id: dialog.id, name });
                  if (currentScope.current !== confirmedScope) return;
                  setDialog(null);
                  setTab("saved");
                  setMessage("Saved to your account.");
                  setError("");
                } catch (err) {
                  setError(
                    err instanceof Error
                      ? err.message
                      : "Could not save this block.",
                  );
                }
              }}
            >
              {saved.busy ? "Saving…" : "Save to account"}
            </button>
          </div>
        </ModalDialog>
      </Modal>
    </Sheet>
  );
}
