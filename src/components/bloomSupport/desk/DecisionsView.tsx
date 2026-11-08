import { useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import Box from "@mui/joy/Box";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import Skeleton from "@mui/joy/Skeleton";
import Alert from "@mui/joy/Alert";
import Button from "@mui/joy/Button";
import Link from "@mui/joy/Link";
import { ChevronDown, UserCheck } from "lucide-react";
import { bloomSupport, type Whoami } from "@/lib/bloomSupport/api";
import { useAskDialog } from "../useAskDialog";
import { DecisionList } from "./DecisionList";
import { useDeskDecisions } from "./useDeskDecisions";
import { deskCardSx } from "./deskStyles";

const ago = (d: unknown) => (typeof d === "string" ? formatDistanceToNow(new Date(d), { addSuffix: true }) : "");

/**
 * The Decisions destination. The top list is the same one Today shows. Below
 * it, requests a person already took fold into one short line each, so the
 * page never fills with raw engineering notes.
 */
export function DecisionsView({ me, onOpenTicket, onOpenDesk }: { me: Whoami; onOpenTicket: (id: string) => void; onOpenDesk: () => void }) {
  const qc = useQueryClient();
  const { ask, dialog } = useAskDialog();
  const { decisions, moreNeedsOwner, taken, nameOf, loading, error } = useDeskDecisions(me, onOpenTicket);
  const record = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: string }) => bloomSupport.resolveEscalation(id, decision),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bloom-support"] }),
  });
  const canRecord = me.permissions.includes("escalations.resolve");

  return (
    <Stack spacing={6} sx={{ maxWidth: 1200, width: "100%", pb: 12 }}>
      {dialog}
      <Stack spacing={3} component="section" aria-label="Needs your decision">
        {error && <Alert color="warning" variant="soft" sx={{ borderRadius: "lg" }}>Some decisions couldn't load. Refresh to try again.</Alert>}
        {loading ? <Skeleton variant="rectangular" height={220} sx={{ borderRadius: "xl" }} />
          : decisions.length || moreNeedsOwner ? <DecisionList decisions={decisions} moreNeedsOwner={moreNeedsOwner} onOpenDesk={onOpenDesk} />
          : <Typography level="body-lg" textColor="text.secondary">Nothing is waiting for a decision.</Typography>}
      </Stack>

      {taken.length > 0 && (
        <Box component="details" sx={{ ...deskCardSx, overflow: "hidden", "&[open] .fold-chevron": { transform: "rotate(180deg)" }, "& > summary::-webkit-details-marker": { display: "none" } }}>
          <Box component="summary" sx={{ listStyle: "none", cursor: "pointer", px: 5, py: 4, display: "flex", alignItems: "center", gap: 3, "&:hover": { bgcolor: "neutral.50" } }}>
            <Box sx={{ color: "text.tertiary", display: "flex" }}><UserCheck size={22} aria-hidden /></Box>
            <Stack sx={{ flex: 1, minWidth: 0 }}>
              <Typography level="title-md">With a person ({taken.length})</Typography>
              <Typography level="body-sm" textColor="text.secondary">Someone took these. Record the outcome when it's settled.</Typography>
            </Stack>
            <Box className="fold-chevron" sx={{ display: "flex", color: "text.tertiary", transition: "transform 150ms ease" }}><ChevronDown size={20} aria-hidden /></Box>
          </Box>
          <Box sx={{ borderTop: "1px solid", borderColor: "neutral.100", "& > * + *": { borderTop: "1px solid", borderColor: "neutral.100" } }}>
            {taken.map((x) => {
              const t = x.ticket as { number: number; subject: string } | null;
              const ticketId = typeof x.ticket_id === "string" ? x.ticket_id : null;
              return (
                <Stack key={String(x.id)} direction={{ xs: "column", sm: "row" }} spacing={{ xs: 2, sm: 4 }} alignItems={{ sm: "center" }} sx={{ px: 5, py: 3.5 }}>
                  <Stack sx={{ flex: 1, minWidth: 0 }}>
                    <Typography level="title-sm">{(ticketId && nameOf.get(ticketId)) ?? (t ? `Request #${t.number}` : "Request")}</Typography>
                    <Typography level="body-sm" textColor="text.secondary" noWrap>{t ? `#${t.number} ${t.subject}` : ""}</Typography>
                    <Typography level="body-xs" textColor="text.tertiary">Taken {ago(x.acknowledged_at ?? x.created_at)}</Typography>
                  </Stack>
                  <Stack direction="row" spacing={3} alignItems="center" sx={{ flexShrink: 0 }}>
                    {ticketId && <Link component="button" level="body-md" onClick={() => onOpenTicket(ticketId)}>Open</Link>}
                    {canRecord && (
                      <Button size="sm" variant="outlined" color="neutral" loading={record.isPending && record.variables?.id === String(x.id)} onClick={async () => {
                        const r = await ask({ title: "Record the outcome", description: "Bloom follows this and lets the client know where it lands.", fields: [{ name: "decision", label: "What did you decide?", kind: "textarea", required: true, placeholder: "e.g. Refund the order and apologise for the delay." }], confirmLabel: "Save outcome" });
                        if (r) record.mutate({ id: String(x.id), decision: String(r.decision).trim() });
                      }}>Record outcome</Button>
                    )}
                  </Stack>
                </Stack>
              );
            })}
          </Box>
        </Box>
      )}
      {record.error && <Alert color="warning" variant="soft" sx={{ borderRadius: "lg" }}>That outcome didn't save. Try again.</Alert>}
    </Stack>
  );
}
