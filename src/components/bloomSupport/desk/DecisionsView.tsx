import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import Skeleton from "@mui/joy/Skeleton";
import Alert from "@mui/joy/Alert";
import type { Whoami } from "@/lib/bloomSupport/api";
import { EscalationsPanel } from "../AdminPanels";
import { DecisionList } from "./DecisionList";
import { useDeskDecisions } from "./useDeskDecisions";

/**
 * The Decisions destination. The top list is the same one Today shows as
 * "Needs your decision". Below it, escalations a person has already taken stay
 * visible until someone records the outcome.
 */
export function DecisionsView({ me, onOpenTicket, onOpenDesk }: { me: Whoami; onOpenTicket: (id: string) => void; onOpenDesk: () => void }) {
  const { decisions, moreNeedsOwner, loading, error } = useDeskDecisions(me, onOpenTicket);
  return (
    <Stack spacing={8} sx={{ maxWidth: 1200, width: "100%", pb: 12 }}>
      <Stack spacing={3} component="section" aria-label="Needs your decision">
        <Typography level="h3" component="h2">Needs your decision</Typography>
        {error && <Alert color="danger" variant="soft" sx={{ borderRadius: "lg" }}>Some decisions couldn't load: {error.message}</Alert>}
        {loading ? <Skeleton variant="rectangular" height={220} sx={{ borderRadius: "xl" }} />
          : decisions.length || moreNeedsOwner ? <DecisionList decisions={decisions} moreNeedsOwner={moreNeedsOwner} onOpenDesk={onOpenDesk} />
          : <Typography level="body-md" textColor="text.secondary">Nothing is waiting for a decision.</Typography>}
      </Stack>
      <Stack spacing={3} component="section" aria-label="Escalations in progress">
        <Stack spacing={1}>
          <Typography level="h3" component="h2">Escalations in progress</Typography>
          <Typography level="body-md" textColor="text.secondary">Taken by a person and waiting for the outcome to be recorded.</Typography>
        </Stack>
        <EscalationsPanel me={me} onOpenTicket={onOpenTicket} />
      </Stack>
    </Stack>
  );
}
