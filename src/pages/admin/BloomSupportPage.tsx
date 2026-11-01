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
import { ArrowLeft, Inbox } from "lucide-react";
import { PageContainer } from "@/components/joy/PageContainer";
import { JoyEmptyState } from "@/components/joy/JoyEmptyState";
import { bloomSupport } from "@/lib/bloomSupport/api";
import { TicketDetailPane } from "@/components/bloomSupport/TicketDetailPane";
import { QueueList } from "@/components/bloomSupport/QueueList";
import { KnowledgePanel } from "@/components/bloomSupport/KnowledgePanel";
import { ClientsPanel, EngineeringPanel, EscalationsPanel, FeaturesPanel, OperationsPanel, ProblemsPanel, ReadinessPanel, ReportsPanel, SettingsPanel } from "@/components/bloomSupport/AdminPanels";

type View = "queue" | "escalations" | "problems" | "engineering" | "features" | "clients" | "operations" | "reports" | "readiness" | "settings" | "knowledge";

export default function BloomSupportPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const view = (params.get("view") as View) ?? "queue";
  const ticketId = params.get("ticket");
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
        <Button size="sm" variant="outlined" onClick={async () => {
          // Manual staff entry (phone call, in person): filed for the client, then triaged like any other request.
          const who = window.prompt("Client name (search)");
          if (!who) return;
          const matches = await bloomSupport.listAccounts(who);
          const account = matches[0];
          if (!account || !window.confirm(`File for ${account.name}?`)) return;
          const body = window.prompt("What did the client ask for?");
          if (!body) return;
          const created = await bloomSupport.createTicket({ account_id: account.id, body, channel: "staff", subject: body.slice(0, 120) });
          openTicket(created.ticket_id);
        }}>New ticket</Button>
        <Tabs value={view} onChange={(_, v) => go({ view: String(v), ticket: null })} sx={{ bgcolor: "transparent" }}>
          <TabList size="sm" sx={{ overflowX: "auto", flexWrap: "nowrap" }}>
            <Tab value="queue">Queue</Tab>
            <Tab value="escalations">Escalations{Number(s.open_escalations ?? 0) ? ` (${s.open_escalations})` : ""}</Tab>
            <Tab value="problems">Problems</Tab>
            <Tab value="engineering">Engineering</Tab>
            <Tab value="features">Features{Number(s.features_awaiting ?? 0) ? ` (${s.features_awaiting})` : ""}</Tab>
            <Tab value="clients">Clients</Tab>
            <Tab value="operations">Operations</Tab>
            <Tab value="reports">Reports</Tab>
            <Tab value="knowledge">Answers</Tab>
            <Tab value="readiness">Readiness</Tab>
            <Tab value="settings">Settings</Tab>
          </TabList>
        </Tabs>
      </Stack>

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
      <Box sx={{ overflow: "auto", display: view === "queue" ? "none" : "block" }}>
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

