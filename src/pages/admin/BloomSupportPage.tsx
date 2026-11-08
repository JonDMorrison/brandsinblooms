import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import Box from "@mui/joy/Box";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import Sheet from "@mui/joy/Sheet";
import Alert from "@mui/joy/Alert";
import Skeleton from "@mui/joy/Skeleton";
import IconButton from "@mui/joy/IconButton";
import { ArrowLeft, Inbox } from "lucide-react";
import { useState } from "react";
import { NewTicketDialog } from "@/components/bloomSupport/NewTicketDialog";
import { TodayView } from "@/components/bloomSupport/TodayView";
import { TicketConversation } from "@/components/bloomSupport/TicketConversation";
import { PageContainer } from "@/components/joy/PageContainer";
import { JoyEmptyState } from "@/components/joy/JoyEmptyState";
import { mergeSx } from "@/components/joy/mergeSx";
import { bloomSupport, type Whoami } from "@/lib/bloomSupport/api";
import { TicketDetailPane } from "@/components/bloomSupport/TicketDetailPane";
import { QueueList } from "@/components/bloomSupport/QueueList";
import { KnowledgePanel } from "@/components/bloomSupport/KnowledgePanel";
import { ClientsPanel, EngineeringPanel, FeaturesPanel, OperationsPanel, ProblemsPanel, ReadinessPanel, ReportsPanel, SettingsPanel } from "@/components/bloomSupport/AdminPanels";
import { DeskNav } from "@/components/bloomSupport/desk/DeskNav";
import { DecisionsView } from "@/components/bloomSupport/desk/DecisionsView";
import { useDeskDecisions } from "@/components/bloomSupport/desk/useDeskDecisions";
import { DeskHeader } from "@/components/bloomSupport/desk/DeskHeader";
import { parseDeskView, type DeskAlertTarget, type DeskSummary, type DeskView } from "@/components/bloomSupport/desk/deskModel";
import { deskScaleSx } from "@/components/bloomSupport/desk/deskStyles";

const VIEW_HELP: Partial<Record<DeskView, string>> = {
  queue: "Every open request. Filter, assign, and reply to clients.",
  escalations: "Things Bloom could not decide on its own. Bloom recommends a next step for each one.",
  features: "Ideas clients asked for, with who asked. Decide whether to plan them.",
  clients: "Each client's requests, contacts and linked accounts.",
  knowledge: "Approved answers Bloom can reuse when it replies to clients.",
  reports: "How quickly requests are answered and solved, and what is still open.",
  problems: "When the same problem affects several clients, it is grouped here so it is fixed once.",
  engineering: "Bugs Bloom is investigating or fixing, and where each fix is.",
  operations: "Look up or change a client's account settings. You see a preview before anything changes.",
  readiness: "Whether Bloom is running, and anything that still needs setting up.",
  settings: "Who has access, who owns what, notifications, and Bloom's automation switches.",
};

export default function BloomSupportPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [newOpen, setNewOpen] = useState(false);
  const ticketId = params.get("ticket");
  // Today is the default. A ticket opened from Today (or a deep link) reads as a conversation;
  // the queue keeps its list-and-detail layout.
  const view = parseDeskView(params.get("view"));
  const queueFilter = params.get("filter");
  const me = useQuery({ queryKey: ["bloom-support", "me"], queryFn: () => bloomSupport.me(), staleTime: 60_000 });
  const staff = !!me.data && me.data.role !== "client" && me.data.role !== "service";
  const summary = useQuery({ queryKey: ["bloom-support", "summary"], queryFn: () => bloomSupport.summary(), enabled: staff, refetchInterval: 30_000 });
  const urgent = useQuery({ queryKey: ["bloom-support", "header", "urgent"], queryFn: () => bloomSupport.pageTickets({ view: "urgent", limit: "1" }), enabled: staff, refetchInterval: 60_000 });
  const go = (next: Record<string, string | null>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) {
      if (v === null) p.delete(k);
      else p.set(k, v);
    }
    setParams(p, { replace: false });
  };
  const openTicket = (id: string) => go({ view: "queue", ticket: id });
  const onAlert = (target: DeskAlertTarget) => {
    if (target === "settings") go({ view: "settings", ticket: null, filter: null });
    else if (target === "decisions") go({ view: "escalations", ticket: null, filter: null });
    else go({ view: "queue", ticket: null, filter: "urgent" });
  };

  if (me.isLoading) return <PageContainer fullWidth><Skeleton variant="rectangular" height={480} /></PageContainer>;
  if (me.error) return <PageContainer><Alert color="danger">{(me.error as Error).message}</Alert></PageContainer>;
  if (!staff) {
    return (
      <PageContainer>
        <JoyEmptyState icon={<Inbox size={28} />} title="Bloom Support is for the Brands in Blooms team" description="To get help with your account, use Help & Support." primaryAction={{ label: "Go to Help & Support", onClick: () => navigate("/support") }} />
      </PageContainer>
    );
  }
  const s = summary.data as DeskSummary | undefined;

  return (
    <PageContainer
      fullWidth
      sx={mergeSx(deskScaleSx, { display: "flex", flexDirection: "column", gap: 5, height: { md: "calc(100dvh - 96px)" } })}
      data-testid="bloom-support-desk"
    >
      <DeskHeader summary={s} summaryFailed={!!summary.error} urgent={urgent.data?.total ?? 0} onNewRequest={() => setNewOpen(true)} onAlert={onAlert} />
      <NewTicketDialog open={newOpen} onClose={() => setNewOpen(false)} onCreated={(id) => { setNewOpen(false); go({ view: "today", ticket: id }); }} />

      <Stack spacing={2}>
        <CountedDeskNav me={me.data!} view={view} onChange={(v) => go({ view: v, ticket: null, filter: null })} />
        {!(view === "today" && ticketId) && VIEW_HELP[view] && (
          <Typography level="body-md" textColor="text.secondary">{VIEW_HELP[view]}</Typography>
        )}
      </Stack>

      {view === "today" && (
        ticketId ? (
          <Sheet variant="outlined" sx={{ borderRadius: "xl", flex: 1, minHeight: { xs: "70dvh", md: 0 }, overflow: "hidden" }}>
            <TicketConversation key={ticketId} ticketId={ticketId} me={me.data!} onBack={() => go({ ticket: null })} onShowDetails={() => go({ view: "queue" })} onOpenTicket={(id) => go({ view: "today", ticket: id })} />
          </Sheet>
        ) : (
          <Box sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
            <TodayView me={me.data!} onOpenTicket={(id) => go({ view: "today", ticket: id })} onOpenDesk={() => go({ view: "queue", ticket: null })} />
          </Box>
        )
      )}
      {view === "queue" && (
        <Sheet variant="outlined" sx={{ borderRadius: "xl", flex: 1, minWidth: 0, maxWidth: "100%", minHeight: 0, display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(300px, 380px) minmax(0, 1fr)" }, overflow: "hidden", bgcolor: "background.surface" }}>
          <Box sx={{ borderRight: { md: "1px solid" }, borderColor: { md: "divider" }, minWidth: 0, minHeight: 0, display: { xs: ticketId ? "none" : "block", md: "block" } }}>
            <QueueList key={queueFilter ?? "default"} me={me.data!} selectedId={ticketId} onOpen={openTicket} initialView={queueFilter} />
          </Box>
          <Box sx={{ minWidth: 0, maxWidth: "100%", minHeight: 0, display: { xs: ticketId ? "block" : "none", md: "block" } }}>
            {ticketId ? (
              <Stack sx={{ height: "100%", minWidth: 0, maxWidth: "100%" }}>
                <Box sx={{ display: { md: "none" }, p: 1 }}><IconButton aria-label="Back to list" onClick={() => go({ ticket: null })}><ArrowLeft size={18} /></IconButton></Box>
                <Box sx={{ flex: 1, minWidth: 0, maxWidth: "100%", minHeight: 0 }}><TicketDetailPane key={ticketId} ticketId={ticketId} me={me.data!} onOpenTicket={openTicket} /></Box>
              </Stack>
            ) : (
              <Box sx={{ p: 4 }}><JoyEmptyState icon={<Inbox size={28} />} title="Select a request" description="The conversation, client, owner, next action and Bloom's automation status appear here." /></Box>
            )}
          </Box>
        </Sheet>
      )}
      <Box sx={{ overflow: "auto", display: view === "queue" || view === "today" ? "none" : "block" }}>
        {view === "escalations" && <DecisionsView me={me.data!} onOpenTicket={openTicket} onOpenDesk={() => go({ view: "queue", ticket: null })} />}
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

/** The Decisions badge counts the same list the Decisions view shows (shared query cache, no extra requests). */
function CountedDeskNav({ me, view, onChange }: { me: Whoami; view: DeskView; onChange: (v: DeskView) => void }) {
  const { decisions, moreNeedsOwner, loading } = useDeskDecisions(me, () => undefined);
  const badges: Partial<Record<DeskView, number>> = loading ? {} : { escalations: decisions.length + moreNeedsOwner };
  return <DeskNav view={view} badges={badges} onChange={onChange} />;
}
