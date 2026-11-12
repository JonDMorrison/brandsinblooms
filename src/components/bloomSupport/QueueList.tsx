import { useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Box from "@mui/joy/Box";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import Input from "@mui/joy/Input";
import Select from "@mui/joy/Select";
import Option from "@mui/joy/Option";
import Checkbox from "@mui/joy/Checkbox";
import Button from "@mui/joy/Button";
import Alert from "@mui/joy/Alert";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Dropdown from "@mui/joy/Dropdown";
import MenuButton from "@mui/joy/MenuButton";
import Menu from "@mui/joy/Menu";
import MenuItem from "@mui/joy/MenuItem";
import { CheckSquare, Search, SlidersHorizontal } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { bloomSupport, KIND_LABEL, PRODUCT_LABEL, QUEUE_VIEWS, STATUS_LABEL, type SupportStatus, type TicketSummary, type Whoami } from "@/lib/bloomSupport/api";
import { useAskDialog } from "./useAskDialog";
import { WAITING_OPTIONS } from "./statusPatch";
import { bloomNextStep, clientName, friendlyStatus } from "./desk/statusWords";
import { StatusPill } from "./desk/StatusPill";

type Filters = { view: string; q?: string; product?: string; priority?: string; kind?: string; owner?: string; sort: string; age_days_min?: string };

/** One calm line per request: who, what, where it stands, and what happens next. */
function RequestRow({ t, selected, selecting, checked, onOpen, onCheck }: {
  t: TicketSummary;
  selected: boolean;
  selecting: boolean;
  checked: boolean;
  onOpen: () => void;
  onCheck: (on: boolean) => void;
}) {
  const f = t.flags;
  const status = friendlyStatus(t);
  const next = bloomNextStep(t);
  return (
    <Box
      role="listitem"
      tabIndex={0}
      data-ticket={t.id}
      aria-current={selected ? "true" : undefined}
      onClick={onOpen}
      onKeyDown={(e) => e.key === "Enter" && onOpen()}
      sx={{
        display: "flex", gap: 3, px: 4, py: 3.5, cursor: "pointer",
        borderBottom: "1px solid", borderColor: "neutral.100",
        borderLeft: "3px solid", borderLeftColor: selected ? "primary.500" : "transparent",
        bgcolor: selected ? "primary.50" : undefined,
        transition: "background-color 120ms ease",
        "&:hover": { bgcolor: selected ? "primary.50" : "neutral.50" },
        "&:focus-visible": { outline: "3px solid", outlineColor: "primary.500", outlineOffset: -3 },
      }}
    >
      {selecting && (
        <Checkbox
          checked={checked}
          onClick={(e) => e.stopPropagation()}
          slotProps={{ input: { "aria-label": `Select #${t.number}` } }}
          onChange={(e) => onCheck(e.target.checked)}
          sx={{ mt: 0.5 }}
        />
      )}
      <Stack spacing={1} sx={{ minWidth: 0, flex: 1 }}>
        <Stack direction="row" spacing={2} alignItems="baseline">
          <Typography level="title-md" noWrap sx={{ flex: 1, minWidth: 0 }}>{clientName(t)}</Typography>
          <Typography level="body-xs" textColor="text.tertiary" sx={{ flex: "0 0 auto" }}>{formatDistanceToNow(new Date(t.updated_at), { addSuffix: true })}</Typography>
        </Stack>
        <Typography level="body-md" sx={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", overflowWrap: "anywhere" }}>{t.subject}</Typography>
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
          <StatusPill tone={status.tone}>{status.label}</StatusPill>
          {t.priority === "urgent" && <StatusPill tone="attention">Urgent</StatusPill>}
          {f?.overdue ? <StatusPill tone="attention">Past due</StatusPill> : f?.due_soon ? <StatusPill tone="neutral">Due soon</StatusPill> : null}
          {t.pending_review && <StatusPill tone="active">Client replied</StatusPill>}
          <Typography level="body-xs" textColor="text.tertiary">#{t.number}</Typography>
        </Stack>
        {t.status !== "resolved" && (
          <Typography level="body-sm" textColor="text.secondary" noWrap>
            <Box component="span" sx={{ fontWeight: 600, color: "text.primary" }}>Next: </Box>{next}
          </Typography>
        )}
      </Stack>
    </Box>
  );
}

export function QueueList({ me, selectedId, onOpen, initialView }: { me: Whoami; selectedId: string | null; onOpen: (id: string) => void; initialView?: string | null }) {
  const qc = useQueryClient();
  // A link from the desk header (e.g. "urgent") can open a specific queue view; unknown values fall back.
  const startView = initialView && QUEUE_VIEWS.some((v) => v.key === initialView) ? initialView : "needs_attention";
  const [filters, setFilters] = useState<Filters>({ view: startView, sort: "priority" });
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<{ color: "success" | "warning"; text: string } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => ({ ...f, q: search.trim() || undefined })), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => setChecked(new Set()), [filters]);

  const views = useQuery({ queryKey: ["bloom-support", "views"], queryFn: () => bloomSupport.views() });
  const pages = useInfiniteQuery({
    queryKey: ["bloom-support", "tickets", filters],
    queryFn: ({ pageParam }) => bloomSupport.pageTickets({ ...filters, limit: "40", cursor: pageParam ?? undefined }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
    refetchInterval: 30_000,
  });
  const items = useMemo(() => pages.data?.pages.flatMap((p) => p.items) ?? [], [pages.data]);
  const total = pages.data?.pages[0]?.total ?? 0;

  const bulk = useMutation({
    mutationFn: async (b: Record<string, unknown>) => bloomSupport.bulk([...checked], b),
    onSuccess: (r) => {
      setNotice({ color: r.failed.length ? "warning" : "success", text: `${r.updated.length} updated${r.failed.length ? `, ${r.failed.length} not changed: ${r.failed[0].error}` : ""}` });
      setChecked(new Set());
      qc.invalidateQueries({ queryKey: ["bloom-support"] });
    },
    onError: (e: Error) => setNotice({ color: "warning", text: e.message }),
  });
  const { ask, dialog } = useAskDialog();
  const runBulk = async (b: Record<string, unknown>, consequential = false) => {
    const n = checked.size;
    if (consequential || n > 20) {
      const r = await ask({
        title: `Change ${n} request${n === 1 ? "" : "s"}?`,
        description: "This changes every selected request at once and cannot be undone in one step.",
        fields: [{ name: "typed", label: `Type ${n} to confirm`, kind: "text", required: true }],
        confirmLabel: "Change them",
        tone: "danger",
      });
      if (!r || String(r.typed).trim() !== String(n)) return;
      b = { ...b, confirm: String(n) };
    }
    bulk.mutate(b);
  };

  const set = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));
  const activeFilterCount = [filters.product, filters.priority, filters.kind, filters.owner, filters.age_days_min].filter(Boolean).length;
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const idx = items.findIndex((t) => t.id === selectedId);
    const next = items[Math.min(items.length - 1, Math.max(0, idx + (e.key === "ArrowDown" ? 1 : -1)))];
    if (next) {
      e.preventDefault();
      onOpen(next.id);
      listRef.current?.querySelector<HTMLElement>(`[data-ticket="${next.id}"]`)?.focus();
    }
  };
  const viewLabel = QUEUE_VIEWS.find((v) => v.key === filters.view)?.label ?? "Requests";

  return (
    <Stack sx={{ minHeight: 0, height: "100%" }}>
      {dialog}
      <Stack spacing={3} sx={{ p: 4, borderBottom: "1px solid", borderColor: "neutral.100" }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Select
            value={filters.view}
            onChange={(_, v) => v && set({ view: v })}
            aria-label="Which requests"
            variant="plain"
            sx={{ flex: 1, minWidth: 0, fontWeight: 600, fontSize: "1.0625rem", px: 1, ml: -1 }}
            renderValue={() => viewLabel}
          >
            {QUEUE_VIEWS.map((v) => <Option key={v.key} value={v.key}>{v.label}</Option>)}
          </Select>
          {!pages.isLoading && <Typography level="body-sm" textColor="text.tertiary" sx={{ flex: "0 0 auto" }}>{total} {total === 1 ? "request" : "requests"}</Typography>}
        </Stack>
        <Input startDecorator={<Search size={18} aria-hidden />} placeholder="Search a client, request number or words" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search tickets" sx={{ borderRadius: "lg" }} />
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
          <Button
            size="sm"
            variant={filtersOpen || activeFilterCount ? "soft" : "plain"}
            color="neutral"
            startDecorator={<SlidersHorizontal size={16} aria-hidden />}
            aria-expanded={filtersOpen}
            aria-controls="bloom-queue-filters"
            onClick={() => setFiltersOpen((value) => !value)}
          >
            Filter and sort{activeFilterCount ? ` (${activeFilterCount})` : ""}
          </Button>
          <Button
            size="sm"
            variant={selecting ? "soft" : "plain"}
            color="neutral"
            startDecorator={<CheckSquare size={16} aria-hidden />}
            aria-pressed={selecting}
            onClick={() => { setSelecting((v) => !v); setChecked(new Set()); }}
          >
            {selecting ? "Done selecting" : "Select"}
          </Button>
          <Dropdown>
            <MenuButton size="sm" variant="plain" color="neutral">Saved views</MenuButton>
            <Menu size="sm">
              {(views.data ?? []).map((v) => <MenuItem key={v.id} onClick={() => setFilters({ sort: "priority", ...(v.filters as Filters) })}>{v.name}{v.shared ? " (shared)" : ""}</MenuItem>)}
              <MenuItem onClick={async () => {
                const r = await ask({ title: "Save this view", description: "Keep these filters so you can come back to them in one click.", fields: [{ name: "name", label: "Name", kind: "text", placeholder: "e.g. Urgent POS problems", required: true }], confirmLabel: "Save view" });
                if (r) { await bloomSupport.saveView(String(r.name).trim(), filters); qc.invalidateQueries({ queryKey: ["bloom-support", "views"] }); }
              }}>Save current view…</MenuItem>
            </Menu>
          </Dropdown>
        </Stack>
        {filtersOpen && (
          <Sheet id="bloom-queue-filters" variant="soft" color="neutral" sx={{ p: 3, borderRadius: "lg" }}>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 2 }}>
              <Select size="sm" value={filters.sort} onChange={(_, v) => v && set({ sort: v })} aria-label="Sort">
                <Option value="priority">Most important first</Option>
                <Option value="due">Due first</Option>
                <Option value="updated">Recently updated</Option>
                <Option value="created">Newest</Option>
              </Select>
              <Select size="sm" placeholder="Product" value={filters.product ?? null} onChange={(_, v) => set({ product: v ?? undefined })} aria-label="Product">
                <Option value={null as unknown as string}>All products</Option>
                {["cms", "crm", "pos", "unknown"].map((p) => <Option key={p} value={p}>{PRODUCT_LABEL[p]}</Option>)}
              </Select>
              <Select size="sm" placeholder="Priority" value={filters.priority ?? null} onChange={(_, v) => set({ priority: v ?? undefined })} aria-label="Priority">
                <Option value={null as unknown as string}>Any priority</Option>
                {[["urgent", "Urgent"], ["high", "High"], ["normal", "Normal"], ["low", "Low"]].map(([p, l]) => <Option key={p} value={p}>{l}</Option>)}
              </Select>
              <Select size="sm" placeholder="Type" value={filters.kind ?? null} onChange={(_, v) => set({ kind: v ?? undefined })} aria-label="Type">
                <Option value={null as unknown as string}>Any type</Option>
                {Object.entries(KIND_LABEL).map(([k, l]) => <Option key={k} value={k}>{l}</Option>)}
              </Select>
              <Select size="sm" placeholder="Owner" value={filters.owner ?? null} onChange={(_, v) => set({ owner: v ?? undefined })} aria-label="Owner">
                <Option value={null as unknown as string}>Anyone</Option>
                <Option value="me">Me</Option>
                <Option value="none">Unassigned</Option>
              </Select>
              <Select size="sm" value={filters.age_days_min ?? null} placeholder="Age" onChange={(_, v) => set({ age_days_min: v ?? undefined })} aria-label="Age">
                <Option value={null as unknown as string}>Any age</Option>
                <Option value="1">Older than 1 day</Option>
                <Option value="7">Older than 7 days</Option>
                <Option value="30">Older than 30 days</Option>
              </Select>
            </Box>
            {activeFilterCount > 0 && (
              <Button size="sm" variant="plain" color="neutral" sx={{ mt: 2 }} onClick={() => set({ product: undefined, priority: undefined, kind: undefined, owner: undefined, age_days_min: undefined })}>
                Clear filters
              </Button>
            )}
          </Sheet>
        )}
        {selecting && checked.size > 0 && (
          <Sheet variant="soft" color="primary" sx={{ p: 2, borderRadius: "lg" }}>
            <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography level="title-sm">{checked.size} selected</Typography>
              <Button size="sm" variant="soft" color="neutral" onClick={() => runBulk({ patch: { owner_id: me.id } })}>Assign to me</Button>
              <Button size="sm" variant="soft" color="neutral" onClick={async () => { const r = await ask({ title: "Add a tag", description: "Tags help you find related requests later.", fields: [{ name: "tag", label: "Tag", kind: "text", placeholder: "e.g. spring-sale", required: true }], confirmLabel: "Add tag" }); if (r) runBulk({ add_tags: [String(r.tag).trim().toLowerCase()] }); }}>Add tag</Button>
              <Select size="sm" placeholder="Set status…" value={null} aria-label="Set status" onChange={async (_, v) => {
                if (!v) return;
                if (v === "waiting") {
                  const r = await ask({ title: "Waiting on whom?", fields: [{ name: "reason", label: "Waiting on", kind: "select", required: true, initial: "customer", options: WAITING_OPTIONS }], confirmLabel: "Set to waiting" });
                  if (r) runBulk({ patch: { status: "waiting", waiting_reason: String(r.reason) } });
                  return;
                }
                if (v === "resolved") {
                  const r = await ask({ title: "Mark as solved", description: "This message is sent to each client.", fields: [{ name: "summary", label: "What can the client do now?", kind: "textarea", required: true, helper: "Plain words, no technical terms. For example: \"You can upload photos to your gallery again.\"" }], confirmLabel: "Continue" });
                  if (r) runBulk({ patch: { status: "resolved", resolution_summary: String(r.summary).trim() } }, true);
                  return;
                }
                runBulk({ patch: { status: v } });
              }} sx={{ minWidth: 140 }}>
                {(["working", "waiting", "resolved"] as SupportStatus[]).map((s) => <Option key={s} value={s}>{STATUS_LABEL[s]}</Option>)}
              </Select>
            </Stack>
          </Sheet>
        )}
        {notice && <Alert color={notice.color} variant="soft" endDecorator={<Button size="sm" variant="plain" color="neutral" onClick={() => setNotice(null)}>Dismiss</Button>}>{notice.text}</Alert>}
      </Stack>
      <Box ref={listRef} sx={{ overflow: "auto", flex: 1 }} role="list" aria-label={`Tickets (${total})`} onKeyDown={onKeyDown}>
        {pages.isLoading && <Stack spacing={2} sx={{ p: 4 }}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} variant="rectangular" height={88} sx={{ borderRadius: "lg" }} />)}</Stack>}
        {pages.error && (
          <Alert color="warning" variant="soft" sx={{ m: 4 }} endDecorator={<Button size="sm" variant="soft" color="neutral" onClick={() => pages.refetch()}>Try again</Button>}>These requests didn't load.</Alert>
        )}
        {!pages.isLoading && items.length === 0 && !pages.error && (
          <Stack spacing={1} sx={{ p: 6, textAlign: "center" }}>
            <Typography level="title-md">Nothing here</Typography>
            <Typography level="body-md" textColor="text.secondary">No requests match this view. Try another view or clear the search.</Typography>
          </Stack>
        )}
        {items.map((t) => (
          <RequestRow
            key={t.id}
            t={t}
            selected={selectedId === t.id}
            selecting={selecting}
            checked={checked.has(t.id)}
            onOpen={() => onOpen(t.id)}
            onCheck={(on) => setChecked((s) => { const n = new Set(s); if (on) n.add(t.id); else n.delete(t.id); return n; })}
          />
        ))}
        {pages.hasNextPage && (
          <Box sx={{ p: 4, textAlign: "center" }}>
            <Button size="sm" variant="outlined" color="neutral" loading={pages.isFetchingNextPage} onClick={() => pages.fetchNextPage()}>Show more ({items.length} of {total})</Button>
          </Box>
        )}
      </Box>
    </Stack>
  );
}
