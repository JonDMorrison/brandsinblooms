import Box from "@mui/joy/Box";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import Button from "@mui/joy/Button";
import Link from "@mui/joy/Link";
import { AlertTriangle, MessageSquarePlus, Sprout } from "lucide-react";
import type { DecisionChoice } from "../todayActions";
import type { DeskDecision } from "./useDeskDecisions";
import { deskCardSx } from "./deskStyles";

/** One decision, readable at a glance: problem, Bloom's plan, why, and three clear choices. */
export function DecisionCard({ d, busy, onChoose }: { d: DeskDecision; busy: boolean; onChoose: (choice: DecisionChoice) => void }) {
  const disabled = busy || !d.decide;
  return (
    <Box
      component="article"
      aria-label={`${d.client}: ${d.problem}`}
      sx={{ ...deskCardSx, overflow: "hidden", borderLeft: "4px solid", borderLeftColor: "warning.400" }}
    >
      <Stack spacing={4} sx={{ p: { xs: 4, sm: 5.5 } }}>
        <Stack spacing={1}>
          <Stack direction="row" spacing={2} alignItems="baseline" flexWrap="wrap" useFlexGap>
            <Typography level="title-lg" component="h3">{d.client}</Typography>
            {d.when && <Typography level="body-sm" textColor="text.tertiary">{d.when}</Typography>}
          </Stack>
          {d.ticket && <Typography level="body-sm" textColor="text.secondary">{d.ticket}</Typography>}
          <Typography level="body-lg" textColor="text.primary" sx={{ pt: 1 }}>{d.problem}</Typography>
        </Stack>

        <Box sx={{ borderRadius: "lg", bgcolor: "primary.50", border: "1px solid", borderColor: "primary.100", p: 4 }}>
          <Stack spacing={1.5}>
            <Typography level="title-sm" startDecorator={<Sprout size={18} aria-hidden />} textColor="primary.800">Bloom recommends</Typography>
            <Typography level="body-md" textColor="text.primary">{d.recommendation}</Typography>
            <Typography level="body-sm" textColor="text.secondary"><b>Why:</b> {d.reason}</Typography>
          </Stack>
        </Box>

        {d.risk && (
          <Typography level="body-md" startDecorator={<AlertTriangle size={18} aria-hidden />} textColor="warning.800" sx={{ alignItems: "flex-start" }}>
            {d.risk}
          </Typography>
        )}

        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} useFlexGap flexWrap="wrap">
          <Button size="lg" disabled={disabled} onClick={() => onChoose("do")} sx={{ borderRadius: "xl", minHeight: 48, px: 5 }}>
            Approve Bloom's plan
          </Button>
          <Button size="lg" variant="outlined" color="neutral" disabled={disabled} startDecorator={<MessageSquarePlus size={18} aria-hidden />} onClick={() => onChoose("other")} sx={{ borderRadius: "xl", minHeight: 48, bgcolor: "background.surface" }}>
            Add instructions
          </Button>
          <Button size="lg" variant="plain" color="neutral" disabled={disabled} onClick={() => onChoose("reject")} sx={{ borderRadius: "xl", minHeight: 48 }}>
            Not this
          </Button>
        </Stack>
        {!d.decide && <Typography level="body-sm" textColor="text.secondary">Your role can't make this decision. An admin can.</Typography>}

        {(d.evidence || d.open) && (
          <Box component="details" sx={{ "& summary": { cursor: "pointer", color: "text.secondary", fontSize: "0.9375rem", py: 1 } }}>
            <Box component="summary">Show technical evidence</Box>
            <Stack spacing={2} sx={{ pt: 2 }}>
              {d.evidence && <Typography level="body-sm" sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{d.evidence}</Typography>}
              {d.open && (d.open.href
                ? <Link href={d.open.href} target="_blank" rel="noopener" level="body-md">{d.open.label}</Link>
                : <Link component="button" onClick={d.open.onClick} level="body-md" sx={{ alignSelf: "flex-start" }}>{d.open.label}</Link>)}
            </Stack>
          </Box>
        )}
      </Stack>
    </Box>
  );
}
