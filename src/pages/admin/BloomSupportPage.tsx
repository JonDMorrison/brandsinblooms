import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import Box from "@mui/joy/Box";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import Tabs from "@mui/joy/Tabs";
import TabList from "@mui/joy/TabList";
import Tab from "@mui/joy/Tab";
import Sheet from "@mui/joy/Sheet";
import Input from "@mui/joy/Input";
import Select from "@mui/joy/Select";
import Option from "@mui/joy/Option";
import Chip from "@mui/joy/Chip";
import Alert from "@mui/joy/Alert";
import Skeleton from "@mui/joy/Skeleton";
import IconButton from "@mui/joy/IconButton";
import { ArrowLeft, Inbox, Search } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { PageContainer } from "@/components/joy/PageContainer";
import { JoyEmptyState } from "@/components/joy/JoyEmptyState";
import { bloomSupport, PRODUCT_LABEL } from "@/lib/bloomSupport/api";
import { TicketDetailPane } from "@/components/bloomSupport/TicketDetailPane";
import { AutomationChip, PriorityChip, StatusChip } from "@/components/bloomSupport/chips";
import { ClientsPanel, EngineeringPanel, EscalationsPanel, FeaturesPanel, OperationsPanel, SettingsPanel } from "@/components/bloomSupport/AdminPanels";

const QUEUES: Array<{ key: string; label: string; status?: string; owner?: string; automation?: string }> = [
  { key: "open", label: "Open", status: "new,working,waiting,needs_owner" },
  { key: "needs_owner", label: "Needs Jon/Jeff", status: "needs_owner" },
  { key: "mine", label: "Mine", status: "new,working,waiting,needs_owner", owner: "me" },
  { key: "human", label: "Human-owned", status: "new,working,waiting,needs_owner", automation: "human" },
  { key: "new", label: "New", status: "new" },
  { key: "waiting", label: "Waiting", status: "waiting" },
  { key: "resolved", label: "Resolved", status: "resolved" },
];

type View = "queue" | "escalations" | "engineering" | "features" | "clients" | "operations" | "settings";

export default function BloomSupportPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const view = (params.get("view") as View) ?? "queue";
  const ticketId = params.get("ticket");
  const [queue, setQueue] = useState("open");
  const [product, setProduct] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const me = useQuery({ queryKey: ["bloom-support", "me"], queryFn: () => bloomSupport.me(), staleTime: 60_000 });
  const staff = !!me.data && me.data.role !== "client" && me.data.role !== "service";
  const summary = useQuery({ queryKey: ["bloom-support", "summary"], queryFn: () => bloomSupport.summary(), enabled: staff, refetchInterval: 30_000 });
  const q = QUEUES.find((x) => x.key === queue)!;
  const tickets = useQuery({
    queryKey: ["bloom-support", "tickets", queue, product, debounced],
    queryFn: () => bloomSupport.listTickets({ status: q.status, owner: q.owner, automation: q.automation, product: product ?? undefined, q: debounced || undefined }),
    enabled: staff,
    refetchInterval: 30_000,
  });

  const go = (next: Record<string, string | null>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) {
      if (v === null) p.delete(k);
      else p.set(k, v);
    }
    setParams(p, { replace: false });
  };
  const openTicket = (id: string) => go({ view: "queue", ticket: id });

  if (me.isLoading) return <PageContainer fullWidth><Skeleton variant="rectangular" height={480} /></PageContainer>;
  if (me.error) return <PageContainer><Alert color="danger">{(me.error as Error).message}</Alert></PageContainer>;
  if (!staff) {
    return (
      <PageContainer>
        <JoyEmptyState icon={<Inbox size={28} />} title="Bloom Support is for the Brands in Blooms team" description="To get help with your account, use Help & Support." primaryAction={{ label: "Go to Help & Support", onClick: () => navigate("/support") }} />
      </PageContainer>
    );
  }
  const counts = (summary.data?.by_status ?? {}) as Record<string, number>;
  const s = summary.data ?? {};

  return (
    <PageContainer fullWidth sx={{ display: "flex", flexDirection: "column", gap: 1.5, height: { md: "calc(100dvh - 96px)" } }}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ md: "center" }} spacing={1}>
        <div>
          <Typography level="h3">Bloom Support</Typography>
          <Typography level="body-sm" textColor="text.secondary">
            {counts.new ?? 0} new · {counts.working ?? 0} working · {counts.waiting ?? 0} waiting · {counts.needs_owner ?? 0} need Jon/Jeff
            {s.automation_enabled === false && <Chip size="sm" color="danger" sx={{ ml: 1 }}>Automation paused</Chip>}
            {Number(s.dead_jobs ?? 0) > 0 && <Chip size="sm" color="danger" variant="soft" sx={{ ml: 1 }}>{String(s.dead_jobs)} failed jobs</Chip>}
          </Typography>
        </div>
        <Tabs value={view} onChange={(_, v) => go({ view: String(v), ticket: null })} sx={{ bgcolor: "transparent" }}>
          <TabList size="sm" sx={{ overflowX: "auto", flexWrap: "nowrap" }}>
            <Tab value="queue">Queue</Tab>
            <Tab value="escalations">Escalations{Number(s.open_escalations ?? 0) ? ` (${s.open_escalations})` : ""}</Tab>
            <Tab value="engineering">Engineering</Tab>
            <Tab value="features">Features{Number(s.features_awaiting ?? 0) ? ` (${s.features_awaiting})` : ""}</Tab>
            <Tab value="clients">Clients</Tab>
            <Tab value="operations">Operations</Tab>
            <Tab value="settings">Settings</Tab>
          </TabList>
        </Tabs>
      </Stack>

      {view === "queue" && (
        <Sheet variant="outlined" sx={{ borderRadius: "lg", flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(300px, 380px) minmax(0, 1fr)" }, overflow: "hidden" }}>
          <Stack sx={{ borderRight: { md: "1px solid" }, borderColor: { md: "divider" }, minHeight: 0, display: { xs: ticketId ? "none" : "flex", md: "flex" } }}>
            <Stack spacing={1} sx={{ p: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>
              <Input size="sm" startDecorator={<Search size={14} />} placeholder="Search text, #number or client" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search tickets" />
              <Stack direction="row" spacing={1}>
                <Select size="sm" value={queue} onChange={(_, v) => v && setQueue(v)} sx={{ flex: 1 }} aria-label="Queue">
                  {QUEUES.map((x) => <Option key={x.key} value={x.key}>{x.label}</Option>)}
                </Select>
                <Select size="sm" value={product} placeholder="All products" onChange={(_, v) => setProduct(v)} sx={{ flex: 1 }} aria-label="Product">
                  <Option value={null as unknown as string}>All products</Option>
                  {["cms", "crm", "pos", "unknown"].map((p) => <Option key={p} value={p}>{PRODUCT_LABEL[p]}</Option>)}
                </Select>
              </Stack>
            </Stack>
            <Box sx={{ overflow: "auto", flex: 1 }} role="list" aria-label="Tickets">
              {tickets.isLoading && <Stack spacing={1} sx={{ p: 1.5 }}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} variant="rectangular" height={56} />)}</Stack>}
              {tickets.error && <Alert color="danger" sx={{ m: 1.5 }}>{(tickets.error as Error).message}</Alert>}
              {tickets.data?.length === 0 && <Typography level="body-sm" sx={{ p: 2 }} textColor="text.tertiary">Nothing here.</Typography>}
              {tickets.data?.map((t) => (
                <Box key={t.id} role="listitem" tabIndex={0} onClick={() => openTicket(t.id)} onKeyDown={(e) => e.key === "Enter" && openTicket(t.id)}
                  sx={{ px: 1.5, py: 1, cursor: "pointer", borderBottom: "1px solid", borderColor: "divider", bgcolor: ticketId === t.id ? "primary.softBg" : undefined, "&:hover": { bgcolor: ticketId === t.id ? "primary.softBg" : "background.level1" }, "&:focus-visible": { outline: "2px solid", outlineColor: "primary.500" } }}>
                  <Stack direction="row" spacing={0.75} alignItems="center">
                    <Typography level="body-xs" textColor="text.tertiary">#{t.number}</Typography>
                    <StatusChip status={t.status} />
                    <PriorityChip priority={t.priority} />
                    {t.automation && t.automation !== "auto" && <AutomationChip mode={t.automation} />}
                    <Typography level="body-xs" textColor="text.tertiary" sx={{ ml: "auto !important" }}>{formatDistanceToNow(new Date(t.updated_at))}</Typography>
                  </Stack>
                  <Typography level="title-sm" noWrap>{t.subject}</Typography>
                  <Typography level="body-xs" noWrap>
                    <strong>{t.account?.name ?? "No client"}</strong> · {PRODUCT_LABEL[t.product] ?? t.product}{t.next_action ? ` · ${t.next_action}` : ""}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Stack>
          <Box sx={{ minHeight: 0, display: { xs: ticketId ? "block" : "none", md: "block" } }}>
            {ticketId ? (
              <Stack sx={{ height: "100%" }}>
                <Box sx={{ display: { md: "none" }, p: 1 }}><IconButton size="sm" aria-label="Back to list" onClick={() => go({ ticket: null })}><ArrowLeft size={16} /></IconButton></Box>
                <Box sx={{ flex: 1, minHeight: 0 }}><TicketDetailPane key={ticketId} ticketId={ticketId} me={me.data!} onOpenTicket={openTicket} /></Box>
              </Stack>
            ) : (
              <Box sx={{ p: 4 }}><JoyEmptyState icon={<Inbox size={28} />} title="Select a ticket" description="The conversation, client, owner, next action and Bloom's automation status appear here." /></Box>
            )}
          </Box>
        </Sheet>
      )}
      <Box sx={{ overflow: "auto", display: view === "queue" ? "none" : "block" }}>
        {view === "escalations" && <EscalationsPanel onOpenTicket={openTicket} />}
        {view === "engineering" && <EngineeringPanel me={me.data!} onOpenTicket={openTicket} />}
        {view === "features" && <FeaturesPanel me={me.data!} onOpenTicket={openTicket} />}
        {view === "clients" && <ClientsPanel onOpenTicket={openTicket} />}
        {view === "operations" && <OperationsPanel />}
        {view === "settings" && <SettingsPanel me={me.data!} />}
      </Box>
    </PageContainer>
  );
}

