import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import Button from "@mui/joy/Button";
import Sheet from "@mui/joy/Sheet";
import Box from "@mui/joy/Box";
import Alert from "@mui/joy/Alert";
import Skeleton from "@mui/joy/Skeleton";
import Link from "@mui/joy/Link";
import { BookOpen, ExternalLink, LifeBuoy } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { PageContainer } from "@/components/joy/PageContainer";
import { ReportProblemDialog } from "@/components/bloomSupport/ReportProblemDialog";
import { TicketDetailPane } from "@/components/bloomSupport/TicketDetailPane";
import { StatusChip } from "@/components/bloomSupport/chips";
import { bloomSupport } from "@/lib/bloomSupport/api";

const KNOWLEDGE_BASE_URL = "https://bloomsuite.notion.site/bloomsuite-help";

/**
 * Help & Support for BloomSuite users. Requests go to Bloom Support (the shared
 * support system for BloomSites, CRM and POS); people see and reply to their
 * own requests here.
 */
const SupportPage = () => {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const me = useQuery({ queryKey: ["bloom-support", "me"], queryFn: () => bloomSupport.me(), staleTime: 60_000 });
  const mine = useQuery({ queryKey: ["bloom-support", "tickets", "mine-client"], queryFn: () => bloomSupport.listTickets({ limit: "50" }), enabled: !!me.data, refetchInterval: 30_000 });

  return (
    <PageContainer>
      <Stack spacing={3}>
        <div>
          <Typography level="h2">Help &amp; Support</Typography>
          <Typography level="body-md" textColor="text.secondary">Report a problem, ask a question, or request a change. Bloom replies by email and here.</Typography>
        </div>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <Sheet variant="outlined" sx={{ p: 2, borderRadius: "lg", flex: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center"><LifeBuoy size={18} aria-hidden /><Typography level="title-md">Get help</Typography></Stack>
            <Typography level="body-sm" sx={{ my: 1 }}>Describe what's happening. No need to choose a category — we'll route it.</Typography>
            <Button onClick={() => setOpen(true)}>Start a request</Button>
          </Sheet>
          <Sheet variant="outlined" sx={{ p: 2, borderRadius: "lg", flex: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center"><BookOpen size={18} aria-hidden /><Typography level="title-md">Help centre</Typography></Stack>
            <Typography level="body-sm" sx={{ my: 1 }}>Guides and answers to common questions.</Typography>
            <Button variant="outlined" component="a" href={KNOWLEDGE_BASE_URL} target="_blank" rel="noopener noreferrer" endDecorator={<ExternalLink size={14} />}>Open help centre</Button>
          </Sheet>
        </Stack>

        <div>
          <Typography level="title-lg" sx={{ mb: 1 }}>Your requests</Typography>
          {me.error && <Alert color="danger">{(me.error as Error).message}</Alert>}
          {mine.isLoading && <Skeleton variant="rectangular" height={120} />}
          {mine.data?.length === 0 && <Typography level="body-sm" textColor="text.tertiary">You haven't sent any requests yet.</Typography>}
          {mine.data && mine.data.length > 0 && (
            <Sheet variant="outlined" sx={{ borderRadius: "lg", display: "grid", gridTemplateColumns: { xs: "1fr", md: selected ? "320px minmax(0,1fr)" : "1fr" }, minHeight: 240, overflow: "hidden" }}>
              <Box role="list" sx={{ borderRight: { md: selected ? "1px solid" : "none" }, borderColor: "divider", display: { xs: selected ? "none" : "block", md: "block" } }}>
                {mine.data.map((t) => (
                  <Box key={t.id} role="listitem" tabIndex={0} onClick={() => setSelected(t.id)} onKeyDown={(e) => e.key === "Enter" && setSelected(t.id)}
                    sx={{ p: 1.5, cursor: "pointer", borderBottom: "1px solid", borderColor: "divider", bgcolor: selected === t.id ? "primary.softBg" : undefined }}>
                    <Stack direction="row" spacing={1} alignItems="center"><Typography level="body-xs">#{t.number}</Typography><StatusChip status={t.status} /></Stack>
                    <Typography level="title-sm" noWrap>{t.subject}</Typography>
                    <Typography level="body-xs" textColor="text.tertiary">Updated {formatDistanceToNow(new Date(t.updated_at), { addSuffix: true })}</Typography>
                  </Box>
                ))}
              </Box>
              {selected && me.data && (
                <Box sx={{ minHeight: 360 }}>
                  <Link component="button" level="body-sm" sx={{ m: 1, display: { md: "none" } }} onClick={() => setSelected(null)}>← All requests</Link>
                  <TicketDetailPane key={selected} ticketId={selected} me={me.data} onOpenTicket={setSelected} />
                </Box>
              )}
            </Sheet>
          )}
        </div>
      </Stack>
      <ReportProblemDialog open={open} onClose={() => { setOpen(false); mine.refetch(); }} />
    </PageContainer>
  );
};

export default SupportPage;
