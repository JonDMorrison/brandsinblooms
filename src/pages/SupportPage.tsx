import { useEffect, useRef, useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import Button from "@mui/joy/Button";
import Sheet from "@mui/joy/Sheet";
import Box from "@mui/joy/Box";
import Alert from "@mui/joy/Alert";
import Skeleton from "@mui/joy/Skeleton";
import Link from "@mui/joy/Link";
import { ArrowRight, BookOpen, LifeBuoy } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { PageContainer } from "@/components/joy/PageContainer";
import { ReportProblemDialog } from "@/components/bloomSupport/ReportProblemDialog";
import { TicketConversation } from "@/components/bloomSupport/TicketConversation";
import { TicketDetailPane } from "@/components/bloomSupport/TicketDetailPane";
import { StatusChip } from "@/components/bloomSupport/chips";
import { bloomSupport } from "@/lib/bloomSupport/api";

export const SUPPORT_MOBILE_GRID_TRACK = "minmax(0, 1fr)";

/**
 * Help & Support for BloomSuite users. Requests go to Bloom Support (the shared
 * support system for BloomSites, CRM and POS); people see and reply to their
 * own requests here.
 */
const SupportPage = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const requestRefs = useRef(new Map<string, HTMLButtonElement>());
  const me = useQuery({ queryKey: ["bloom-support", "me"], queryFn: () => bloomSupport.me(), staleTime: 60_000 });
  const mine = useQuery({ queryKey: ["bloom-support", "tickets", "mine-client"], queryFn: () => bloomSupport.listTickets({ limit: "50" }), enabled: !!me.data, refetchInterval: 30_000 });
  const staff = !!me.data && me.data.permissions.includes("tickets.read_all");

  useEffect(() => {
    if (selected) detailRef.current?.focus();
  }, [selected]);

  if (me.isLoading) {
    return (
      <PageContainer>
        <Stack spacing={2} aria-busy="true">
          <div>
            <Typography level="h2">Loading support</Typography>
            <Typography level="body-md" textColor="text.secondary">Loading your support workspace…</Typography>
          </div>
          <Sheet
            role="status"
            aria-label="Loading your support workspace"
            aria-live="polite"
            variant="outlined"
            sx={{ p: 2, borderRadius: "lg" }}
          >
            <Stack spacing={1.25} aria-hidden="true">
              <Skeleton variant="text" level="title-md" sx={{ width: "min(240px, 70%)" }} />
              <Skeleton variant="rectangular" height={88} sx={{ borderRadius: "md" }} />
            </Stack>
          </Sheet>
        </Stack>
      </PageContainer>
    );
  }

  if (me.error) {
    return (
      <PageContainer>
        <Stack spacing={2}>
          <div>
            <Typography level="h2">Support unavailable</Typography>
            <Typography level="body-md" textColor="text.secondary">We couldn't confirm which support workspace you should see.</Typography>
          </div>
          <Sheet role="alert" variant="outlined" sx={{ p: 2, borderRadius: "lg" }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} justifyContent="space-between" alignItems={{ sm: "center" }}>
              <Typography level="body-sm">Try again to securely load your support access.</Typography>
              <Button
                variant="outlined"
                color="neutral"
                loading={me.isFetching}
                onClick={() => { void me.refetch(); }}
                sx={{ minHeight: 44, alignSelf: { xs: "stretch", sm: "auto" } }}
              >
                Retry
              </Button>
            </Stack>
          </Sheet>
        </Stack>
      </PageContainer>
    );
  }

  const showRequestList = () => {
    const previous = selected;
    setSelected(null);
    requestAnimationFrame(() => {
      if (previous) requestRefs.current.get(previous)?.focus();
    });
  };

  return (
    <PageContainer
      fullWidth={staff}
      sx={staff ? { height: { md: "calc(100dvh - 96px)" } } : undefined}
    >
      <Stack spacing={staff ? 2 : 3} sx={staff ? { height: "100%", minHeight: 0 } : undefined}>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "flex-end" }} spacing={1.5}>
          <div>
            <Typography level="h2">{staff ? "Support" : "Help & Support"}</Typography>
            <Typography level="body-md" textColor="text.secondary">
              {staff
                ? "Stay focused on the client conversation. Bloom keeps the background work moving."
                : "Report a problem, ask a question, or request a change. Track the conversation and replies here."}
            </Typography>
          </div>
          {staff ? (
            <Button
              component={RouterLink}
              to="/admin/bloom-support"
              endDecorator={<ArrowRight size={16} aria-hidden />}
              sx={{ borderRadius: "xl", alignSelf: { xs: "flex-start", sm: "auto" } }}
            >
              Open full support desk
            </Button>
          ) : null}
        </Stack>
        {!staff ? (
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <Sheet variant="outlined" sx={{ p: 2, borderRadius: "lg", flex: 1 }}>
              <Stack direction="row" spacing={1} alignItems="center"><LifeBuoy size={18} aria-hidden /><Typography level="title-md">Get help</Typography></Stack>
              <Typography level="body-sm" sx={{ my: 1 }}>Describe what's happening. No need to choose a category — we'll route it.</Typography>
              <Button onClick={() => setOpen(true)}>Start a request</Button>
            </Sheet>
            <Sheet variant="outlined" sx={{ p: 2, borderRadius: "lg", flex: 1 }}>
              <Stack direction="row" spacing={1} alignItems="center"><BookOpen size={18} aria-hidden /><Typography level="title-md">Help centre</Typography></Stack>
              <Typography level="body-sm" sx={{ my: 1 }}>Guides and answers to common questions.</Typography>
              <Button variant="outlined" component={RouterLink} to="/knowledge-base">Open help centre</Button>
            </Sheet>
          </Stack>
        ) : null}

        <Box sx={staff ? { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" } : undefined}>
          <Typography level="title-lg" sx={{ mb: 1 }}>{staff ? "Recent conversations" : "Your requests"}</Typography>
          {mine.error && <Alert color="danger">{(mine.error as Error).message}</Alert>}
          {mine.isLoading && <Skeleton variant="rectangular" height={120} />}
          {mine.data?.length === 0 && <Typography level="body-sm" textColor="text.tertiary">{staff ? "No client requests yet." : "You haven't sent any requests yet."}</Typography>}
          {mine.data && mine.data.length > 0 && (
            <Sheet variant="outlined" sx={{ borderRadius: "lg", display: "grid", gridTemplateColumns: { xs: SUPPORT_MOBILE_GRID_TRACK, md: selected ? "minmax(280px, 340px) minmax(0,1fr)" : "1fr" }, minWidth: 0, minHeight: staff ? { xs: 480, md: 0 } : 240, flex: staff ? 1 : undefined, overflow: "hidden" }}>
              <Box role="list" aria-label={staff ? "Recent client conversations" : "Your support requests"} sx={{ borderRight: { md: selected ? "1px solid" : "none" }, borderColor: "divider", display: { xs: selected ? "none" : "block", md: "block" }, overflowY: "auto", minWidth: 0, minHeight: 0 }}>
                {mine.data.map((t) => (
                  <Box key={t.id} role="listitem">
                    <Box
                      component="button"
                      ref={(node: HTMLButtonElement | null) => {
                        if (node) requestRefs.current.set(t.id, node);
                        else requestRefs.current.delete(t.id);
                      }}
                      type="button"
                      aria-current={selected === t.id ? "true" : undefined}
                      aria-label={`Open request #${t.number}: ${t.subject}`}
                      onClick={() => setSelected(t.id)}
                      sx={{
                        display: "block",
                        width: "100%",
                        p: 1.75,
                        cursor: "pointer",
                        border: 0,
                        borderBottom: "1px solid",
                        borderColor: "divider",
                        borderRadius: 0,
                        bgcolor: selected === t.id ? "primary.softBg" : "transparent",
                        color: "inherit",
                        font: "inherit",
                        textAlign: "left",
                        "&:hover": { bgcolor: selected === t.id ? "primary.softHoverBg" : "background.level1" },
                        "&:focus-visible": { outline: "2px solid", outlineColor: "primary.500", outlineOffset: -2 },
                      }}
                    >
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography level="body-xs">#{t.number}</Typography>
                        <StatusChip status={t.status} />
                        <Typography level="body-xs" textColor="text.tertiary" sx={{ ml: "auto !important" }}>{formatDistanceToNow(new Date(t.updated_at), { addSuffix: true })}</Typography>
                      </Stack>
                      <Typography level="title-sm" noWrap sx={{ mt: 0.5 }}>{t.subject}</Typography>
                      {staff && t.account ? <Typography level="body-xs" textColor="text.secondary">{t.account.name}</Typography> : null}
                    </Box>
                  </Box>
                ))}
              </Box>
              {selected && me.data && (
                <Box ref={detailRef} tabIndex={-1} role="region" aria-label="Request details" sx={{ width: "100%", maxWidth: "100%", minWidth: 0, minHeight: 360, borderRadius: "sm", "&:focus-visible": { outline: "2px solid", outlineColor: "primary.500", outlineOffset: -2 } }}>
                  {staff ? (
                    <TicketConversation
                      key={selected}
                      ticketId={selected}
                      me={me.data}
                      onBack={showRequestList}
                      onShowDetails={() => navigate(`/admin/bloom-support?view=queue&ticket=${encodeURIComponent(selected)}`)}
                      onOpenTicket={setSelected}
                    />
                  ) : (
                    <>
                      <Link component="button" level="body-sm" sx={{ m: 1, display: { md: "none" } }} onClick={showRequestList}>← All requests</Link>
                      <TicketDetailPane key={selected} ticketId={selected} me={me.data} onOpenTicket={setSelected} />
                    </>
                  )}
                </Box>
              )}
            </Sheet>
          )}
        </Box>
      </Stack>
      <ReportProblemDialog open={open} onClose={() => { setOpen(false); mine.refetch(); }} />
    </PageContainer>
  );
};

export default SupportPage;
