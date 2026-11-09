import { useEffect, useRef, useState } from "react";
import { Link as RouterLink, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import Button from "@mui/joy/Button";
import Sheet from "@mui/joy/Sheet";
import Box from "@mui/joy/Box";
import Alert from "@mui/joy/Alert";
import Skeleton from "@mui/joy/Skeleton";
import Link from "@mui/joy/Link";
import Chip from "@mui/joy/Chip";
import { ArrowRight, BookOpen, Inbox, LifeBuoy } from "lucide-react";
import { differenceInCalendarDays, differenceInHours, differenceInMinutes, format } from "date-fns";
import { PageContainer } from "@/components/joy/PageContainer";
import { JoyEmptyState } from "@/components/joy/JoyEmptyState";
import { ReportProblemDialog } from "@/components/bloomSupport/ReportProblemDialog";
import { TicketConversation } from "@/components/bloomSupport/TicketConversation";
import { TicketDetailPane } from "@/components/bloomSupport/TicketDetailPane";
import { StatusChip } from "@/components/bloomSupport/chips";
import { bloomSupport, type TicketSummary } from "@/lib/bloomSupport/api";
import { isNextAction } from "../../supabase/functions/_shared/bloom-support/next-step";

export const SUPPORT_MOBILE_GRID_TRACK = "minmax(0, 1fr)";

/** Compact inbox age: "now", "12m", "3h", "4d", then the date. */
function shortAge(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const minutes = differenceInMinutes(now, date);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = differenceInHours(now, date);
  if (hours < 24) return `${hours}h`;
  const days = differenceInCalendarDays(now, date);
  return days < 7 ? `${days}d` : format(date, "MMM d");
}

/** A request is waiting on us when it needs an owner's decision or the client wrote last. */
function needsAttention(t: TicketSummary): boolean {
  if (t.status === "resolved") return !!t.pending_review;
  if (t.status === "needs_owner" || t.pending_review) return true;
  // A customer message is not automatically a staff task while Bloom owns
  // the conversation. Only a named handoff/decision should interrupt staff.
  if (t.automation === "auto") return false;
  if (!t.last_customer_message_at) return false;
  return !t.last_team_message_at || new Date(t.last_customer_message_at) > new Date(t.last_team_message_at);
}

/**
 * Help & Support for BloomSuite users. Requests go to Bloom Support (the shared
 * support system for BloomSites, CRM and POS); people see and reply to their
 * own requests here.
 */
const SupportPage = () => {
  const navigate = useNavigate();
  // Staff emails link here as /support?ticket=<id>&action=<recommended action>.
  // The link only opens the ticket with the action pre-selected; nothing runs until a person confirms.
  const [params] = useSearchParams();
  const linkedTicket = params.get("ticket");
  const linkedAction = params.get("action");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(linkedTicket && /^[0-9a-f-]{36}$/i.test(linkedTicket) ? linkedTicket : null);
  const detailRef = useRef<HTMLDivElement>(null);
  const requestRefs = useRef(new Map<string, HTMLButtonElement>());
  const me = useQuery({ queryKey: ["bloom-support", "me"], queryFn: () => bloomSupport.me(), staleTime: 60_000 });
  const mine = useQuery({ queryKey: ["bloom-support", "tickets", "mine-client"], queryFn: () => bloomSupport.listTickets({ limit: "50" }), enabled: !!me.data, refetchInterval: 30_000 });
  const staff = !!me.data && me.data.permissions.includes("tickets.read_all");
  const orderedRequests = [...(mine.data ?? [])].sort((a, b) =>
    (staff ? Number(needsAttention(b)) - Number(needsAttention(a)) : 0) ||
    new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );

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
      <Stack spacing={3} sx={staff ? { height: "100%", minHeight: 0 } : undefined}>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "flex-end" }} spacing={2}>
          <Stack spacing={0.5}>
            <Typography level="h2">{staff ? "Support" : "Help & Support"}</Typography>
            <Typography level="body-md" textColor="text.secondary">
              {staff
                ? "Stay focused on the client conversation. Bloom keeps the background work moving."
                : "Report a problem, ask a question, or request a change. Track the conversation and replies here."}
            </Typography>
          </Stack>
          {staff ? (
            <Button
              component={RouterLink}
              to="/admin/bloom-support"
              variant="outlined"
              color="neutral"
              endDecorator={<ArrowRight size={16} aria-hidden />}
              sx={{ borderRadius: "md", alignSelf: { xs: "flex-start", sm: "auto" }, flex: "0 0 auto" }}
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
          {mine.error && <Alert color="danger">{(mine.error as Error).message}</Alert>}
          {mine.isLoading && <Skeleton variant="rectangular" height={120} sx={{ borderRadius: "lg" }} />}
          {mine.data?.length === 0 && <Typography level="body-sm" textColor="text.tertiary">{staff ? "No client requests yet." : "You haven't sent any requests yet."}</Typography>}
          {mine.data && mine.data.length > 0 && (
            <Sheet
              variant="outlined"
              sx={{
                borderRadius: "xl",
                borderColor: "divider",
                boxShadow: "sm",
                bgcolor: "background.surface",
                display: "grid",
                gridTemplateColumns: { xs: SUPPORT_MOBILE_GRID_TRACK, md: "minmax(300px, 360px) minmax(0, 1fr)" },
                gridTemplateRows: "minmax(0, 1fr)",
                minWidth: 0,
                minHeight: staff ? { xs: 480, md: 0 } : 360,
                flex: staff ? 1 : undefined,
                overflow: "hidden",
              }}
            >
              <Box sx={{ display: { xs: selected ? "none" : "flex", md: "flex" }, flexDirection: "column", minWidth: 0, minHeight: 0, borderRight: { md: "1px solid" }, borderColor: { md: "divider" }, bgcolor: "background.level1" }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2.5, py: 2, borderBottom: "1px solid", borderColor: "divider" }}>
                  <Typography level="title-md" sx={{ flex: 1 }}>{staff ? "Recent requests" : "Your requests"}</Typography>
                  <Chip size="sm" variant="soft" color="neutral">{mine.data.length}</Chip>
                </Stack>
                <Stack role="list" aria-label={staff ? "Recent client conversations" : "Your support requests"} spacing={0.5} sx={{ flex: 1, minHeight: 0, overflowY: "auto", p: 1 }}>
                  {orderedRequests.map((t) => {
                    const active = selected === t.id;
                    const attention = needsAttention(t);
                    const name = staff ? t.account?.name ?? t.requester?.name ?? t.requester?.email ?? "Unknown client" : t.subject;
                    return (
                      <Box key={t.id} role="listitem">
                        <Box
                          component="button"
                          ref={(node: HTMLButtonElement | null) => {
                            if (node) requestRefs.current.set(t.id, node);
                            else requestRefs.current.delete(t.id);
                          }}
                          type="button"
                          aria-current={active ? "true" : undefined}
                          aria-label={`Open request #${t.number}: ${t.subject}${attention ? " (needs attention)" : ""}`}
                          onClick={() => setSelected(t.id)}
                          sx={{
                            display: "block",
                            width: "100%",
                            px: 1.5,
                            py: 1.5,
                            cursor: "pointer",
                            border: 0,
                            borderRadius: "md",
                            bgcolor: active ? "background.surface" : "transparent",
                            boxShadow: active ? "sm" : "none",
                            position: "relative",
                            color: "inherit",
                            font: "inherit",
                            textAlign: "left",
                            transition: "background-color 120ms ease, box-shadow 120ms ease",
                            "&::before": active
                              ? { content: '""', position: "absolute", left: 0, top: 12, bottom: 12, width: 3, borderRadius: 3, bgcolor: "primary.500" }
                              : undefined,
                            "&:hover": { bgcolor: active ? "background.surface" : "background.level2" },
                            "&:focus-visible": { outline: "2px solid", outlineColor: "primary.500", outlineOffset: -2 },
                          }}
                        >
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                            {attention ? <Box aria-hidden sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "primary.500", flex: "0 0 auto" }} /> : null}
                            <Typography level="title-sm" noWrap sx={{ flex: 1, minWidth: 0, fontWeight: attention ? "lg" : "md" }}>{name}</Typography>
                            <Typography level="body-xs" textColor="text.tertiary" sx={{ flex: "0 0 auto" }} title={new Date(t.updated_at).toLocaleString()}>{shortAge(t.updated_at)}</Typography>
                          </Stack>
                          {staff ? <Typography level="body-sm" textColor="text.secondary" noWrap sx={{ mt: 0.5 }}>{t.subject}</Typography> : null}
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                            <Typography level="body-xs" textColor="text.tertiary">#{t.number}</Typography>
                            <StatusChip status={t.status} audience={staff ? "staff" : "client"} />
                            {staff && attention && t.status !== "needs_owner" ? (
                              <Typography level="body-xs" textColor="primary.700" sx={{ fontWeight: "lg" }}>Needs review</Typography>
                            ) : null}
                          </Stack>
                        </Box>
                      </Box>
                    );
                  })}
                </Stack>
              </Box>
              {selected && me.data ? (
                <Box ref={detailRef} tabIndex={-1} role="region" aria-label="Request details" sx={{ width: "100%", maxWidth: "100%", minWidth: 0, minHeight: { xs: 480, md: 0 }, outline: "none" }}>
                  {staff ? (
                    <TicketConversation
                      key={selected}
                      ticketId={selected}
                      me={me.data}
                      backOn="compact"
                      onBack={showRequestList}
                      onShowDetails={() => navigate(`/admin/bloom-support?view=queue&ticket=${encodeURIComponent(selected)}`)}
                      onOpenTicket={setSelected}
                      actionHint={selected === linkedTicket && isNextAction(linkedAction) ? linkedAction : null}
                    />
                  ) : (
                    <>
                      <Link component="button" level="body-sm" sx={{ m: 1, display: { md: "none" } }} onClick={showRequestList}>← All requests</Link>
                      <TicketDetailPane key={selected} ticketId={selected} me={me.data} onOpenTicket={setSelected} />
                    </>
                  )}
                </Box>
              ) : (
                <Box sx={{ display: { xs: "none", md: "flex" }, alignItems: "center", justifyContent: "center", minHeight: 0 }}>
                  <JoyEmptyState
                    icon={<Inbox size={28} aria-hidden />}
                    title={staff ? "Pick a conversation" : "Pick a request"}
                    description={staff ? "Choose a conversation on the left to read the thread and reply." : "Choose a request on the left to see replies and add more detail."}
                  />
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
