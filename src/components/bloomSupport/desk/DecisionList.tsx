import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Box from "@mui/joy/Box";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import Alert from "@mui/joy/Alert";
import Link from "@mui/joy/Link";
import { Check } from "lucide-react";
import { useAskDialog } from "../useAskDialog";
import type { DecisionChoice } from "../todayActions";
import { DecisionCard } from "./DecisionCard";
import type { DeskDecision } from "./useDeskDecisions";
import { deskCardSx } from "./deskStyles";

/** Pending decisions plus what you just decided. Shared by Today and the Decisions view. */
export function DecisionList({ decisions, moreNeedsOwner, onOpenDesk }: { decisions: DeskDecision[]; moreNeedsOwner: number; onOpenDesk: () => void }) {
  const qc = useQueryClient();
  const { ask, dialog } = useAskDialog();
  const [acted, setActed] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const act = useMutation({
    mutationFn: async ({ run }: { key: string; run: () => Promise<unknown>; done: string }) => run(),
    onMutate: ({ key }) => { setBusy(key); setError(null); setOutcome(null); },
    onSuccess: (_d, { key, done }) => { setOutcome(done); setActed((a) => ({ ...a, [key]: done })); qc.invalidateQueries({ queryKey: ["bloom-support"] }); },
    onError: (e: Error) => setError(`That didn't save: ${e.message}. Nothing else changed. Try again.`),
    onSettled: () => setBusy(null),
  });

  const choose = async (d: DeskDecision, choice: DecisionChoice) => {
    let instructions: string | undefined;
    if (choice === "other") {
      const result = await ask({
        title: "Add instructions",
        description: "Your instructions are saved on this request and it is assigned to you. Nothing is sent to the client and no change is made yet.",
        fields: [{ name: "instructions", label: "What should happen instead?", kind: "textarea", required: true, placeholder: "e.g. Check the fix already in review before starting a new one." }],
        confirmLabel: "Save instructions",
      });
      if (!result) return;
      instructions = String(result.instructions).trim();
    }
    act.mutate({ key: d.key, run: () => d.decide!(choice, instructions), done: d.done[choice] });
  };

  const pending = decisions.filter((d) => !acted[d.key]);
  const decided = decisions.filter((d) => acted[d.key]);
  return (
    <Stack spacing={4}>
      {dialog}
      {outcome && <Alert role="status" color="success" variant="soft" sx={{ borderRadius: "lg" }}>{outcome}</Alert>}
      {error && <Alert role="alert" color="danger" variant="soft" sx={{ borderRadius: "lg" }}>{error}</Alert>}
      {pending.map((d) => <DecisionCard key={d.key} d={d} busy={busy !== null} onChoose={(c) => void choose(d, c)} />)}
      {moreNeedsOwner > 0 && (
        <Link component="button" level="body-md" onClick={onOpenDesk} sx={{ alignSelf: "flex-start" }}>
          {moreNeedsOwner} more need an admin. See them in Requests
        </Link>
      )}
      {decided.length > 0 && (
        <Box sx={{ ...deskCardSx, "& > * + *": { borderTop: "1px solid", borderColor: "neutral.100" } }}>
          {decided.map((d) => (
            <Stack key={d.key} direction="row" spacing={3} alignItems="center" sx={{ px: 5, py: 3.5 }}>
              <Box sx={{ color: "success.600", display: "flex" }}><Check size={18} aria-hidden /></Box>
              <Typography level="body-md"><b>{d.client}</b> · {acted[d.key]}</Typography>
            </Stack>
          ))}
        </Box>
      )}
    </Stack>
  );
}
