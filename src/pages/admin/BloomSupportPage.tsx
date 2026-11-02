import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import Box from "@mui/joy/Box";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import Tabs from "@mui/joy/Tabs";
import TabList from "@mui/joy/TabList";
import Tab from "@mui/joy/Tab";
import Sheet from "@mui/joy/Sheet";
import Chip from "@mui/joy/Chip";
import Alert from "@mui/joy/Alert";
import Skeleton from "@mui/joy/Skeleton";
import IconButton from "@mui/joy/IconButton";
import Button from "@mui/joy/Button";
import { ArrowLeft, ChevronDown, Inbox, Plus } from "lucide-react";
import Dropdown from "@mui/joy/Dropdown";
import MenuButton from "@mui/joy/MenuButton";
import Menu from "@mui/joy/Menu";
import MenuItem from "@mui/joy/MenuItem";
import { useState } from "react";
import { NewTicketDialog } from "@/components/bloomSupport/NewTicketDialog";
import { TodayView } from "@/components/bloomSupport/TodayView";
import { TicketConversation } from "@/components/bloomSupport/TicketConversation";
import { PageContainer } from "@/components/joy/PageContainer";
import { JoyEmptyState } from "@/components/joy/JoyEmptyState";
import { bloomSupport } from "@/lib/bloomSupport/api";
import { TicketDetailPane } from "@/components/bloomSupport/TicketDetailPane";
import { QueueList } from "@/components/bloomSupport/QueueList";
import { KnowledgePanel } from "@/components/bloomSupport/KnowledgePanel";
import { ClientsPanel, EngineeringPanel, EscalationsPanel, FeaturesPanel, OperationsPanel, ProblemsPanel, ReadinessPanel, ReportsPanel, SettingsPanel } from "@/components/bloomSupport/AdminPanels";

type View = "today" | "queue" | "escalations" | "problems" | "engineering" | "features" | "clients" | "operations" | "reports" | "readiness" | "settings" | "knowledge";

// Everyday tabs stay visible; setup and specialist tools live under "More".
const MAIN_VIEWS: Array<{ value: View; label: string }> = [
  { value: "today", label: "Today" },
  { value: "queue", label: "All requests" },
  { value: "escalations", label: "Needs a decision" },
  { value: "features", label: "Feature requests" },
  { value: "clients", label: "Clients" },
  { value: "knowledge", label: "Saved answers" },
  { value: "reports", label: "Reports" },
];
const MORE_VIEWS: Array<{ value: View; label: string; short: string }> = [
  { value: "problems", label: "Shared problems", short: "One issue affecting several clients" },
  { value: "engineering", label: "Fixes in progress", short: "Bugs Bloom is investigating or fixing" },
  { value: "operations", label: "Account changes", short: "Look up or change a client's settings" },
  { value: "readiness", label: "Setup check", short: "What's connected and working" },
  { value: "settings", label: "Settings", short: "People, owners, notifications, automation" },
];
const VIEW_HELP: Partial<Record<View, string>> = {
  queue: "Every open request. Filter, assign, and reply to clients.",
  escalations: "Things Bloom could not decide on its own. Take one, or record what you decided.",
  features: "Ideas clients asked for, with who asked. Decide whether to plan them.",
  clients: "Each client's requests, contacts and linked accounts.",
  knowledge: "Approved answers Bloom can reuse when it replies to clients.",
  reports: "How quickly requests are answered and solved, and what is still open.",
  problems: "When the same problem affects several clients, it is grouped here so it is fixed once.",
  engineering: "Bugs Bloom is investigating or fixing, and where each fix is.",
  operations: "Look up or change a client's account settings. You see a preview before anything changes.",
  readiness: "What is set up and working, and what still needs configuring.",
  settings: "Who has access, who owns what, notifications, and Bloom's automation switches.",
};

export default function BloomSupportPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [newOpen, setNewOpen] = useState(false);
  const ticketId = params.get("ticket");
  // Today is the default. A ticket opened from Today (or a deep link) reads as a conversation;
  // the queue keeps its list-and-detail layout.
  const view = (params.get("view") as View) ?? "today";
  const me = useQuery({ queryKey: ["bloom-support", "me"], queryFn: () => bloomSupport.me(), staleTime: 60_000 });
  const staff = !!me.data && me.data.role !== "client" && me.data.role !== "service";
  const summary = useQuery({ queryKey: ["bloom-support", "summary"], queryFn: () => bloomSupport.summary(), enabled: staff, refetchInterval: 30_000 });
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
  const badge = (v: View) => (v === "escalations" ? Number(s.open_escalations ?? 0) : v === "features" ? Number(s.features_awaiting ?? 0) : 0);

  return (
    <PageContainer fullWidth sx={{ display: "flex", flexDirection: "column", gap: 1.5, height: { md: "calc(100dvh - 96px)" } }}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ md: "flex-end" }} spacing={1.5}>
        <Stack spacing={0.5}>
          <Typography level="h2" sx={{ fontSize: { xs: "1.5rem", md: "1.75rem" } }}>Support desk</Typography>
          <Typography level="body-md" textColor="text.secondary">
            Client requests, what Bloom is handling, and anything that needs a person.
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ pt: 0.5 }}>
            <Chip size="sm" variant="soft">{counts.new ?? 0} new</Chip>
            <Chip size="sm" variant="soft">{counts.working ?? 0} being handled</Chip>
            <Chip size="sm" variant="soft">{counts.waiting ?? 0} waiting on someone</Chip>
            <Chip size="sm" variant="soft" color={(counts.needs_owner ?? 0) > 0 ? "warning" : "neutral"}>{counts.needs_owner ?? 0} need Jon or Jeff</Chip>
            {s.automation_enabled === false && <Chip size="sm" color="danger">Bloom is paused</Chip>}
            {Number(s.dead_jobs ?? 0) > 0 && <Chip size="sm" color="danger" variant="soft">{String(s.dead_jobs)} automatic steps failed</Chip>}
          </Stack>
        </Stack>
        <Button startDecorator={<Plus size={16} />} onClick={() => setNewOpen(true)} sx={{ borderRadius: "xl", alignSelf: { xs: "flex-start", md: "auto" } }}>New request</Button>
      </Stack>
      <NewTicketDialog open={newOpen} onClose={() => setNewOpen(false)} onCreated={(id) => { setNewOpen(false); go({ view: "today", ticket: id }); }} />

      <Stack direction="row" alignItems="center" spacing={1} sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
        <Tabs value={MORE_VIEWS.some((m) => m.value === view) ? null : view} onChange={(_, v) => v && go({ view: String(v), ticket: null })} sx={{ bgcolor: "transparent", minWidth: 0, flex: 1 }}>
          <TabList size="md" disableUnderline sx={{ overflowX: "auto", flexWrap: "nowrap", "--ListItem-minHeight": "44px" }}>
            {MAIN_VIEWS.map((m) => (
              <Tab key={m.value} value={m.value} sx={{ whiteSpace: "nowrap" }}>
                {m.label}{badge(m.value) ? ` (${badge(m.value)})` : ""}
              </Tab>
            ))}
          </TabList>
        </Tabs>
        <Dropdown>
          <MenuButton variant={MORE_VIEWS.some((m) => m.value === view) ? "soft" : "plain"} color="neutral" endDecorator={<ChevronDown size={16} />} sx={{ whiteSpace: "nowrap", minHeight: 44 }}>
            {MORE_VIEWS.find((m) => m.value === view)?.label ?? "More"}
          </MenuButton>
          <Menu placement="bottom-end" sx={{ minWidth: 280 }}>
            {MORE_VIEWS.map((m) => (
              <MenuItem key={m.value} selected={view === m.value} onClick={() => go({ view: m.value, ticket: null })}>
                <Stack>
                  <Typography level="title-sm">{m.label}</Typography>
                  <Typography level="body-xs" textColor="text.tertiary">{m.short}</Typography>
                </Stack>
              </MenuItem>
            ))}
          </Menu>
        </Dropdown>
      </Stack>
      {!(view === "today" && ticketId) && VIEW_HELP[view] && (
        <Typography level="body-sm" textColor="text.secondary" sx={{ mt: -0.5 }}>{VIEW_HELP[view]}</Typography>
      )}

      {view === "today" && (
        ticketId ? (
          <Sheet variant="outlined" sx={{ borderRadius: "lg", flex: 1, minHeight: { xs: "70dvh", md: 0 }, overflow: "hidden" }}>
            <TicketConversation key={ticketId} ticketId={ticketId} me={me.data!} onBack={() => go({ ticket: null })} onShowDetails={() => go({ view: "queue" })} onOpenTicket={(id) => go({ view: "today", ticket: id })} />
          </Sheet>
        ) : (
          <Box sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
            <TodayView me={me.data!} onOpenTicket={(id) => go({ view: "today", ticket: id })} onOpenDesk={() => go({ view: "queue", ticket: null })} />
          </Box>
        )
      )}
      {view === "queue" && (
        <Sheet variant="outlined" sx={{ borderRadius: "lg", flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(300px, 380px) minmax(0, 1fr)" }, overflow: "hidden" }}>
          <Box sx={{ borderRight: { md: "1px solid" }, borderColor: { md: "divider" }, minHeight: 0, display: { xs: ticketId ? "none" : "block", md: "block" } }}>
            <QueueList me={me.data!} selectedId={ticketId} onOpen={openTicket} />
          </Box>
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
      <Box sx={{ overflow: "auto", display: view === "queue" || view === "today" ? "none" : "block" }}>
        {view === "escalations" && <EscalationsPanel onOpenTicket={openTicket} />}
        {view === "engineering" && <EngineeringPanel me={me.data!} onOpenTicket={openTicket} />}
        {view === "features" && <FeaturesPanel me={me.data!} onOpenTicket={openTicket} />}
        {view === "clients" && <ClientsPanel onOpenTicket={openTicket} />}
        {view === "operations" && <OperationsPanel />}
        {view === "problems" && <ProblemsPanel onOpenTicket={openTicket} />}
        {view === "reports" && <ReportsPanel />}
        {view === "knowledge" && <KnowledgePanel me={me.data!} />}
        {view === "readiness" && <ReadinessPanel />}
        {view === "settings" && <SettingsPanel me={me.data!} />}
      </Box>
    </PageContainer>
  );
}

