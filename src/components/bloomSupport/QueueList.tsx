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
import Chip from "@mui/joy/Chip";
import Alert from "@mui/joy/Alert";
import Skeleton from "@mui/joy/Skeleton";
import Dropdown from "@mui/joy/Dropdown";
import MenuButton from "@mui/joy/MenuButton";
import Menu from "@mui/joy/Menu";
import MenuItem from "@mui/joy/MenuItem";
import { Search, SlidersHorizontal } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { bloomSupport, KIND_LABEL, PRODUCT_LABEL, QUEUE_VIEWS, STATUS_LABEL, WAITING_LABEL, type SupportStatus, type TicketSummary, type Whoami } from "@/lib/bloomSupport/api";
import { AutomationChip, PriorityChip, StatusChip } from "./chips";
import { useAskDialog } from "./useAskDialog";
import { WAITING_OPTIONS } from "./statusPatch";
import { humanizeNextAction } from "../../../supabase/functions/_shared/bloom-support/notes";

type Filters = { view: string; q?: string; product?: string; priority?: string; kind?: string; owner?: string; sort: string; age_days_min?: string };

function FlagChips({ t }: { t: TicketSummary }) {
  const f = t.flags;
  return (
    <>
      {f?.overdue && <Chip size="sm" color="danger" variant="solid">Overdue</Chip>}
      {!f?.overdue && f?.due_soon && <Chip size="sm" color="warning" variant="soft">Due soon</Chip>}
      {f?.stalled && <Chip size="sm" color="warning" variant="outlined">Stalled</Chip>}
      {t.pending_review && <Chip size="sm" color="primary" variant="soft">Client replied</Chip>}
    </>
  );
}

export function QueueList({ me, selectedId, onOpen }: { me: Whoami; selectedId: string | null; onOpen: (id: string) => void }) {
  const qc = useQueryClient();
  const [filters, setFilters] = useState<Filters>({ view: "needs_attention", sort: "priority" });
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<{ color: "success" | "danger" | "warning"; text: string } | null>(null);
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
    onError: (e: Error) => setNotice({ color: "danger", text: e.message }),
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

  return (
    <Stack sx={{ minHeight: 0, height: "100%" }}>
      {dialog}
      <Stack spacing={1} sx={{ p: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>
        <Stack direction="row" spacing={0.5} sx={{ overflowX: "auto", pb: 0.5 }} role="tablist" aria-label="Queue views">
          {QUEUE_VIEWS.map((v) => (
            <Chip key={v.key} role="tab" aria-selected={filters.view === v.key} size="sm" variant={filters.view === v.key ? "solid" : "soft"}
              color={filters.view === v.key ? "primary" : "neutral"} onClick={() => set({ view: v.key })} sx={{ flexShrink: 0 }}>{v.label}</Chip>
          ))}
        </Stack>
        <Input size="sm" startDecorator={<Search size={14} />} placeholder="Search #number, client, requester or text" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search tickets" />
        <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
          <Button
            size="sm"
            variant={filtersOpen || activeFilterCount ? "soft" : "outlined"}
            color="neutral"
            startDecorator={<SlidersHorizontal size={14} aria-hidden />}
            aria-expanded={filtersOpen}
            aria-controls="bloom-queue-filters"
            onClick={() => setFiltersOpen((value) => !value)}
          >
            Filters{activeFilterCount ? ` (${activeFilterCount})` : ""}
          </Button>
          <Select size="sm" value={filters.sort} onChange={(_, v) => v && set({ sort: v })} sx={{ minWidth: 110 }} aria-label="Sort">
            <Option value="priority">Priority</Option>
            <Option value="due">Due first</Option>
            <Option value="updated">Recently updated</Option>
            <Option value="created">Newest</Option>
          </Select>
          <Dropdown>
            <MenuButton size="sm" variant="plain">Saved views</MenuButton>
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
          <Sheet id="bloom-queue-filters" variant="soft" color="neutral" sx={{ p: 1, borderRadius: "md" }}>
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
              <Select size="sm" placeholder="Product" value={filters.product ?? null} onChange={(_, v) => set({ product: v ?? undefined })} sx={{ minWidth: 110, flex: { xs: "1 1 45%", sm: "0 0 auto" } }} aria-label="Product">
                <Option value={null as unknown as string}>All products</Option>
                {["cms", "crm", "pos", "unknown"].map((p) => <Option key={p} value={p}>{PRODUCT_LABEL[p]}</Option>)}
              </Select>
              <Select size="sm" placeholder="Priority" value={filters.priority ?? null} onChange={(_, v) => set({ priority: v ?? undefined })} sx={{ minWidth: 100, flex: { xs: "1 1 45%", sm: "0 0 auto" } }} aria-label="Priority">
                <Option value={null as unknown as string}>Any priority</Option>
                {["urgent", "high", "normal", "low"].map((p) => <Option key={p} value={p}>{p}</Option>)}
              </Select>
              <Select size="sm" placeholder="Type" value={filters.kind ?? null} onChange={(_, v) => set({ kind: v ?? undefined })} sx={{ minWidth: 110, flex: { xs: "1 1 45%", sm: "0 0 auto" } }} aria-label="Type">
                <Option value={null as unknown as string}>Any type</Option>
                {Object.entries(KIND_LABEL).map(([k, l]) => <Option key={k} value={k}>{l}</Option>)}
              </Select>
              <Select size="sm" placeholder="Owner" value={filters.owner ?? null} onChange={(_, v) => set({ owner: v ?? undefined })} sx={{ minWidth: 100, flex: { xs: "1 1 45%", sm: "0 0 auto" } }} aria-label="Owner">
                <Option value={null as unknown as string}>Any owner</Option>
                <Option value="me">Me</Option>
                <Option value="none">Unassigned</Option>
              </Select>
              <Select size="sm" value={filters.age_days_min ?? null} placeholder="Age" onChange={(_, v) => set({ age_days_min: v ?? undefined })} sx={{ minWidth: 90, flex: { xs: "1 1 45%", sm: "0 0 auto" } }} aria-label="Age">
                <Option value={null as unknown as string}>Any age</Option>
                <Option value="1">&gt; 1 day</Option>
                <Option value="7">&gt; 7 days</Option>
                <Option value="30">&gt; 30 days</Option>
              </Select>
              {activeFilterCount > 0 && (
                <Button size="sm" variant="plain" color="neutral" onClick={() => set({ product: undefined, priority: undefined, kind: undefined, owner: undefined, age_days_min: undefined })}>
                  Clear filters
                </Button>
              )}
            </Stack>
          </Sheet>
        )}
        {checked.size > 0 && (
          <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography level="body-xs">{checked.size} selected</Typography>
            <Button size="sm" variant="soft" onClick={() => runBulk({ patch: { owner_id: me.id } })}>Assign to me</Button>
            <Button size="sm" variant="soft" onClick={async () => { const r = await ask({ title: "Add a tag", description: "Tags help you find related requests later.", fields: [{ name: "tag", label: "Tag", kind: "text", placeholder: "e.g. spring-sale", required: true }], confirmLabel: "Add tag" }); if (r) runBulk({ add_tags: [String(r.tag).trim().toLowerCase()] }); }}>Add tag</Button>
            <Select size="sm" placeholder="Set status…" value={null} onChange={async (_, v) => {
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
            }} sx={{ minWidth: 120 }}>
              {(["working", "waiting", "resolved"] as SupportStatus[]).map((s) => <Option key={s} value={s}>{STATUS_LABEL[s]}</Option>)}
            </Select>
            <Button size="sm" variant="plain" color="neutral" onClick={() => setChecked(new Set())}>Clear</Button>
          </Stack>
        )}
        {notice && <Alert size="sm" color={notice.color} variant="soft" endDecorator={<Button size="sm" variant="plain" onClick={() => setNotice(null)}>Dismiss</Button>}>{notice.text}</Alert>}
      </Stack>
      <Box ref={listRef} sx={{ overflow: "auto", flex: 1 }} role="list" aria-label={`Tickets (${total})`} onKeyDown={onKeyDown}>
        {pages.isLoading && <Stack spacing={1} sx={{ p: 1.5 }}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} variant="rectangular" height={56} />)}</Stack>}
        {pages.error && (
          <Alert color="danger" sx={{ m: 1.5 }} endDecorator={<Button size="sm" variant="soft" onClick={() => pages.refetch()}>Retry</Button>}>{(pages.error as Error).message}</Alert>
        )}
        {!pages.isLoading && items.length === 0 && !pages.error && <Typography level="body-sm" sx={{ p: 2 }} textColor="text.tertiary">Nothing in this view.</Typography>}
        {items.map((t) => (
          <Box key={t.id} role="listitem" tabIndex={0} data-ticket={t.id} onClick={() => onOpen(t.id)} onKeyDown={(e) => e.key === "Enter" && onOpen(t.id)}
            sx={{ display: "flex", gap: 1, px: 1.5, py: 1, cursor: "pointer", borderBottom: "1px solid", borderColor: "divider", bgcolor: selectedId === t.id ? "primary.softBg" : undefined,
              "&:hover": { bgcolor: selectedId === t.id ? "primary.softBg" : "background.level1" }, "&:focus-visible": { outline: "2px solid", outlineColor: "primary.500" } }}>
            <Checkbox size="sm" checked={checked.has(t.id)} onClick={(e) => e.stopPropagation()} slotProps={{ input: { "aria-label": `Select #${t.number}` } }}
              onChange={(e) => setChecked((s) => { const n = new Set(s); if (e.target.checked) n.add(t.id); else n.delete(t.id); return n; })} />
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                <Typography level="body-xs" textColor="text.tertiary">#{t.number}</Typography>
                <StatusChip status={t.status} />
                <PriorityChip priority={t.priority} />
                <FlagChips t={t} />
                {t.automation && t.automation !== "auto" && <AutomationChip mode={t.automation} />}
                <Typography level="body-xs" textColor="text.tertiary" sx={{ ml: "auto !important" }}>{formatDistanceToNow(new Date(t.updated_at))}</Typography>
              </Stack>
              <Typography level="title-sm" noWrap>{t.subject}</Typography>
              <Typography level="body-xs" noWrap>
                <strong>{t.account?.name ?? "No client"}</strong> · {PRODUCT_LABEL[t.product] ?? t.product} · {KIND_LABEL[t.kind] ?? t.kind}
                {t.waiting_reason ? ` · ${WAITING_LABEL[t.waiting_reason]}` : ""}
                {` · ${t.owner?.name ?? "Unassigned"}${t.executor === "bloom" ? " (Bloom working)" : ""}`}
                {t.next_action ? ` · Next: ${humanizeNextAction(t.next_action)}` : ""}
              </Typography>
            </Box>
          </Box>
        ))}
        {pages.hasNextPage && (
          <Box sx={{ p: 1.5, textAlign: "center" }}>
            <Button size="sm" variant="outlined" loading={pages.isFetchingNextPage} onClick={() => pages.fetchNextPage()}>Load more ({items.length} of {total})</Button>
          </Box>
        )}
      </Box>
    </Stack>
  );
}
