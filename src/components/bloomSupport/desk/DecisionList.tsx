import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Box from "@mui/joy/Box";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import Alert from "@mui/joy/Alert";
import Link from "@mui/joy/Link";
import { Check } from "lucide-react";
import { DecisionCard, type DecisionPick } from "./DecisionCard";
import type { DeskDecision } from "./useDeskDecisions";
import { deskCardSx } from "./deskStyles";

/** Pending decisions plus what you just decided. Shared by Today and the Decisions view. */
export function DecisionList({ decisions, moreNeedsOwner, onOpenDesk }: { decisions: DeskDecision[]; moreNeedsOwner: number; onOpenDesk: () => void }) {
  const qc = useQueryClient();
  const [acted, setActed] = useState<Record<string, { client: string; done: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const act = useMutation({
    mutationFn: async ({ run }: { key: string; client: string; run: () => Promise<unknown>; done: string }) => run(),
    onMutate: ({ key }) => { setBusy(key); setError(null); setOutcome(null); },
    onSuccess: (_d, { key, client, done }) => { setOutcome(done); setActed((a) => ({ ...a, [key]: { client, done } })); qc.invalidateQueries({ queryKey: ["bloom-support"] }); },
    onError: () => setError("That didn't finish. Open the request to check where it stands, then try again."),
    onSettled: () => setBusy(null),
  });

  const confirm = (d: DeskDecision, pick: DecisionPick) => {
    if ("other" in pick) {
      if (!d.other) return;
      act.mutate({ key: d.key, client: d.client, run: () => d.other!.run(pick.other), done: d.other.done });
      return;
    }
    const option = d.options.find((o) => o.id === pick.optionId);
    if (option) act.mutate({ key: d.key, client: d.client, run: option.run, done: option.done });
  };

  const pending = decisions.filter((d) => !acted[d.key]);
  const decided = Object.entries(acted);
  return (
    <Stack spacing={4}>
      {outcome && <Alert role="status" color="success" variant="soft" sx={{ borderRadius: "lg" }}>{outcome}</Alert>}
      {error && <Alert role="alert" color="warning" variant="soft" sx={{ borderRadius: "lg" }}>{error}</Alert>}
      {pending.map((d) => <DecisionCard key={d.key} d={d} busy={busy !== null} onConfirm={(pick) => confirm(d, pick)} />)}
      {moreNeedsOwner > 0 && (
        <Link component="button" level="body-md" onClick={onOpenDesk} sx={{ alignSelf: "flex-start" }}>
          {moreNeedsOwner} more need an admin. See them in Requests
        </Link>
      )}
      {decided.length > 0 && (
        <Box sx={{ ...deskCardSx, "& > * + *": { borderTop: "1px solid", borderColor: "neutral.100" } }}>
          {decided.map(([key, d]) => (
            <Stack key={key} direction="row" spacing={3} alignItems="center" sx={{ px: 5, py: 3.5 }}>
              <Box sx={{ color: "success.600", display: "flex" }}><Check size={18} aria-hidden /></Box>
              <Typography level="body-md"><b>{d.client}</b> · {d.done}</Typography>
            </Stack>
          ))}
        </Box>
      )}
    </Stack>
  );
}
