import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Box from "@mui/joy/Box";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import Button from "@mui/joy/Button";
import Checkbox from "@mui/joy/Checkbox";
import Textarea from "@mui/joy/Textarea";
import Alert from "@mui/joy/Alert";
import Skeleton from "@mui/joy/Skeleton";
import CircularProgress from "@mui/joy/CircularProgress";
import Link from "@mui/joy/Link";
import { AlertTriangle, CheckCircle2, Circle, Hand, MinusCircle, Sparkles, XCircle } from "lucide-react";
import { JoyDrawer } from "@/components/joy/JoyDrawer";
import { bloomSupport, type TicketDetail, type Whoami } from "@/lib/bloomSupport/api";
import { MAX_SUPPORT_BODY_LENGTH } from "@/lib/bloomSupport/constants";
import { deskCardSx, deskScaleSx } from "./deskStyles";
import { planHandoff, runHandoffItem, type HandoffItem, type HandoffResult } from "./handoff";

type RunState = { status: "queued" } | { status: "working" } | HandoffResult;
const MAX_REVIEW = 50;

/** Loads the live detail of every open request so the plan is built from current facts. */
async function loadOpenDetails(): Promise<TicketDetail[]> {
  const page = await bloomSupport.pageTickets({ view: "open", sort: "updated", limit: String(MAX_REVIEW) });
  const out: TicketDetail[] = [];
  const ids = page.items.map((t) => t.id);
  for (let i = 0; i < ids.length; i += 4) {
    const batch = await Promise.all(ids.slice(i, i + 4).map((id) => bloomSupport.getTicket(id)));
    out.push(...batch);
  }
  return out;
}

/**
 * The primary hand-off. Opens a review of what Bloom can safely take, lets a
 * person adjust it, then runs only what they approved, one request at a time.
 */
export function LetBloomHandle({ me, onOpenTicket }: { me: Whoami; onOpenTicket: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        size="lg"
        startDecorator={<Sparkles size={20} aria-hidden />}
        onClick={() => setOpen(true)}
        sx={{ "&&&": { minHeight: 52, px: 6, fontSize: "1.0625rem", borderRadius: "xl", boxShadow: "0 1px 2px rgba(15, 23, 42, 0.08), 0 6px 16px rgba(76, 146, 141, 0.28)", flexShrink: 0 } }}
      >
        Let Bloom handle it
      </Button>
      {open && <HandoffReview me={me} onClose={() => setOpen(false)} onOpenTicket={(id) => { setOpen(false); onOpenTicket(id); }} />}
    </>
  );
}

function HandoffReview({ me, onClose, onOpenTicket }: { me: Whoami; onClose: () => void; onOpenTicket: (id: string) => void }) {
  const qc = useQueryClient();
  // One key per review: a retry inside this review never repeats a sent reply.
  const reviewKey = useRef(`handoff:${crypto.randomUUID()}`);
  const details = useQuery({ queryKey: ["bloom-support", "handoff", reviewKey.current], queryFn: loadOpenDetails, staleTime: Infinity, retry: false });
  const livePlan = details.data ? planHandoff(details.data, me.permissions) : null;
  // Once work starts, the plan is frozen: refreshed data must not hide what Bloom just did.
  const [frozen, setFrozen] = useState<typeof livePlan>(null);
  const plan = frozen ?? livePlan;
  const [selected, setSelected] = useState<Record<string, boolean> | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [run, setRun] = useState<Record<string, RunState>>({});
  const [phase, setPhase] = useState<"review" | "running" | "finished">("review");

  const chosen = (item: HandoffItem) => !item.blocked && (selected?.[item.key] ?? item.preselected);
  const approved = plan?.items.filter(chosen) ?? [];

  const execute = async (items: HandoffItem[]) => {
    if (!frozen) setFrozen(plan);
    setPhase("running");
    setRun((r) => ({ ...r, ...Object.fromEntries(items.map((i) => [i.key, { status: "queued" } as RunState])) }));
    for (const item of items) {
      setRun((r) => ({ ...r, [item.key]: { status: "working" } }));
      const result = await runHandoffItem(bloomSupport, item, {
        body: drafts[item.key], instructions: notes[item.key], idempotencyKey: `${reviewKey.current}:${item.key}`, permissions: me.permissions,
      });
      setRun((r) => ({ ...r, [item.key]: result }));
    }
    setPhase("finished");
    // Refresh the desk behind the drawer, but not this review's own snapshot.
    qc.invalidateQueries({ queryKey: ["bloom-support"], predicate: (q) => q.queryKey[1] !== "handoff" });
  };

  const results = Object.entries(run).filter(([, s]) => s.status !== "queued" && s.status !== "working") as Array<[string, HandoffResult]>;
  const done = results.filter(([, s]) => s.status === "done").length;
  const failed = plan?.items.filter((i) => run[i.key]?.status === "failed") ?? [];
  const skipped = results.filter(([, s]) => s.status === "skipped").length;

  return (
    <JoyDrawer
      open
      onClose={() => phase !== "running" && onClose()}
      disableClose={phase === "running"}
      size="lg"
      title="Let Bloom handle it"
      description={phase === "review" ? "Review what Bloom will do. Nothing happens until you approve." : phase === "running" ? "Bloom is working through the requests you approved." : "Here is what happened."}
      contentSx={deskScaleSx}
    >
      <Stack spacing={6} sx={{ pb: 4 }}>
        {details.isLoading && (
          <Stack spacing={3} aria-busy="true">
            <Typography level="body-md" textColor="text.secondary">Bloom is checking every open request…</Typography>
            <Skeleton variant="rectangular" height={120} sx={{ borderRadius: "xl" }} />
            <Skeleton variant="rectangular" height={120} sx={{ borderRadius: "xl" }} />
          </Stack>
        )}
        {details.error && <Alert color="warning" variant="soft" sx={{ borderRadius: "lg" }}>Bloom couldn't load the open requests, so nothing was changed. Close this and try again.</Alert>}

        {plan && phase !== "review" && (
          <Box role="status" aria-live="polite" sx={{ ...deskCardSx, p: 4, bgcolor: phase === "running" ? "primary.50" : failed.length ? "warning.50" : "success.50", borderColor: phase === "running" ? "primary.200" : failed.length ? "warning.200" : "success.200" }}>
            {phase === "running"
              ? <Typography level="title-md" startDecorator={<CircularProgress size="sm" />}>Working… {results.length} of {Object.keys(run).length} done</Typography>
              : <Stack spacing={1}>
                  <Typography level="title-md">{done} done{failed.length ? `, ${failed.length} didn't finish` : ""}{skipped ? `, ${skipped} left alone` : ""}.</Typography>
                  <Typography level="body-md" textColor="text.secondary">{failed.length ? "Nothing was marked solved unless it finished. You can try the unfinished ones again." : "Bloom will keep each client updated from here."}</Typography>
                </Stack>}
          </Box>
        )}

        {plan && (
          <Stack spacing={3} component="section" aria-label="Bloom will do this">
            <Typography level="h3" component="h2">{phase === "review" ? "Bloom can take these" : "What Bloom did"}</Typography>
            {plan.items.length === 0 && <Typography level="body-md" textColor="text.secondary">Nothing is ready for Bloom to take right now. Everything open is either already Bloom's, or needs a person (below).</Typography>}
            {plan.items.map((item) => (
              <HandoffRow
                key={item.key}
                item={item}
                phase={phase}
                checked={chosen(item)}
                state={run[item.key]}
                draft={drafts[item.key] ?? item.draft ?? ""}
                note={notes[item.key] ?? ""}
                onToggle={(v) => setSelected((s) => ({ ...(s ?? {}), [item.key]: v }))}
                onDraft={(v) => setDrafts((d) => ({ ...d, [item.key]: v }))}
                onNote={(v) => setNotes((n) => ({ ...n, [item.key]: v }))}
                onOpen={() => onOpenTicket(item.ticketId)}
              />
            ))}
          </Stack>
        )}

        {plan && plan.held.length > 0 && (
          <Stack spacing={3} component="section" aria-label="A person needs to handle these">
            <Stack spacing={1}>
              <Typography level="h3" component="h2" startDecorator={<Hand size={22} aria-hidden />}>A person needs to handle these</Typography>
              <Typography level="body-md" textColor="text.secondary">Bloom won't touch these. Each one has its own card on Today.</Typography>
            </Stack>
            {plan.held.map((h) => (
              <Box key={h.key} sx={{ ...deskCardSx, p: 4, borderLeft: "4px solid", borderLeftColor: "warning.400" }}>
                <Stack spacing={1}>
                  <Typography level="title-md">{h.client}</Typography>
                  <Typography level="body-sm" textColor="text.secondary">{h.ticket}</Typography>
                  <Typography level="body-md">{h.reason}</Typography>
                  <Link component="button" level="body-md" onClick={() => onOpenTicket(h.ticketId)} sx={{ alignSelf: "flex-start" }}>Open request</Link>
                </Stack>
              </Box>
            ))}
          </Stack>
        )}

        {plan && (
          <Stack direction={{ xs: "column-reverse", sm: "row" }} spacing={2} justifyContent="flex-end" sx={{ position: "sticky", bottom: 0, py: 4, bgcolor: "background.surface", borderTop: "1px solid", borderColor: "neutral.100" }}>
            {phase === "review" && <>
              <Button variant="plain" color="neutral" onClick={onClose}>Cancel</Button>
              <Button size="lg" disabled={approved.length === 0} onClick={() => void execute(approved)} sx={{ "&&&": { minHeight: 52, px: 6, borderRadius: "xl" } }}>
                {approved.length ? `Approve and let Bloom work (${approved.length})` : "Choose at least one request"}
              </Button>
            </>}
            {phase === "finished" && <>
              {failed.length > 0 && <Button variant="outlined" color="neutral" onClick={() => void execute(failed)}>Try the unfinished ones again</Button>}
              <Button size="lg" onClick={onClose} sx={{ borderRadius: "xl" }}>Done</Button>
            </>}
          </Stack>
        )}
      </Stack>
    </JoyDrawer>
  );
}

function HandoffRow({ item, phase, checked, state, draft, note, onToggle, onDraft, onNote, onOpen }: {
  item: HandoffItem; phase: "review" | "running" | "finished"; checked: boolean; state?: RunState;
  draft: string; note: string; onToggle: (v: boolean) => void; onDraft: (v: string) => void; onNote: (v: string) => void; onOpen: () => void;
}) {
  const reviewing = phase === "review";
  if (!reviewing && !state) return null;
  return (
    <Box sx={{ ...deskCardSx, p: 4, borderLeft: "4px solid", borderLeftColor: item.kind === "send-and-solve" ? "success.400" : "primary.400" }}>
      <Stack spacing={2.5}>
        <Stack direction="row" spacing={3} alignItems="flex-start">
          {reviewing ? (
            <Checkbox
              checked={checked}
              disabled={!!item.blocked}
              onChange={(e) => onToggle(e.target.checked)}
              slotProps={{ input: { "aria-label": `${item.action}: ${item.client}` } }}
              sx={{ pt: 1, "--Checkbox-size": "24px" }}
            />
          ) : <Box sx={{ pt: 0.5 }}><StateIcon state={state} /></Box>}
          <Stack spacing={1} sx={{ flex: 1, minWidth: 0 }}>
            <Typography level="title-md">{item.client}</Typography>
            <Typography level="body-sm" textColor="text.secondary">{item.ticket}</Typography>
            <Typography level="body-md" sx={{ fontWeight: 600 }} textColor={item.kind === "send-and-solve" ? "success.700" : "primary.800"}>{item.action}</Typography>
            <Typography level="body-md" textColor="text.secondary"><b>Why:</b> {item.reason}</Typography>
            {item.blocked && <Typography level="body-sm" textColor="warning.800">{item.blocked}</Typography>}
            {state && state.status !== "queued" && state.status !== "working" && (
              <Typography level="body-md" textColor={state.status === "done" ? "success.700" : state.status === "failed" ? "warning.700" : "text.secondary"}>{state.message}</Typography>
            )}
            {state && state.status !== "done" && !reviewing && <Link component="button" level="body-md" onClick={onOpen} sx={{ alignSelf: "flex-start" }}>Open request</Link>}
          </Stack>
        </Stack>
        {reviewing && checked && item.kind === "send-and-solve" && (
          <Box sx={{ pl: { sm: 9 } }}>
            <Textarea
              minRows={4} maxRows={8} value={draft} onChange={(e) => onDraft(e.target.value)}
              slotProps={{ textarea: { maxLength: MAX_SUPPORT_BODY_LENGTH, "aria-label": `Reply to ${item.client}` } }}
            />
            <Typography level="body-sm" textColor="text.tertiary" sx={{ pt: 1 }}>Sent to the client as written. Change anything first.</Typography>
          </Box>
        )}
        {reviewing && checked && item.kind === "hand-back" && (
          <Box sx={{ pl: { sm: 9 } }}>
            <Textarea
              minRows={2} maxRows={6} value={note} onChange={(e) => onNote(e.target.value)} placeholder="Optional: anything the team should know"
              slotProps={{ textarea: { maxLength: 2000, "aria-label": `Instructions for ${item.client}` } }}
            />
            <Typography level="body-sm" textColor="text.tertiary" sx={{ pt: 1 }}>Saved as a team note on the request. Bloom's automatic sorting doesn't read notes yet.</Typography>
          </Box>
        )}
      </Stack>
    </Box>
  );
}

function StateIcon({ state }: { state?: RunState }) {
  if (!state || state.status === "queued") return <Box sx={{ color: "neutral.400", display: "flex" }}><Circle size={22} aria-label="Waiting" /></Box>;
  if (state.status === "working") return <CircularProgress size="sm" aria-label="Working" />;
  if (state.status === "done") return <Box sx={{ color: "success.600", display: "flex" }}><CheckCircle2 size={22} aria-label="Done" /></Box>;
  if (state.status === "failed") return <Box sx={{ color: "warning.600", display: "flex" }}><XCircle size={22} aria-label="Didn't finish" /></Box>;
  if (state.status === "skipped") return <Box sx={{ color: "warning.600", display: "flex" }}><MinusCircle size={22} aria-label="Left alone" /></Box>;
  return <Box sx={{ color: "warning.600", display: "flex" }}><AlertTriangle size={22} aria-hidden /></Box>;
}
