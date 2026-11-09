import { useState, type ReactNode } from "react";
import Box from "@mui/joy/Box";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import Button from "@mui/joy/Button";
import Link from "@mui/joy/Link";
import Radio from "@mui/joy/Radio";
import RadioGroup from "@mui/joy/RadioGroup";
import Textarea from "@mui/joy/Textarea";
import { AlertTriangle } from "lucide-react";
import type { DeskDecision } from "./useDeskDecisions";
import { deskCardSx } from "./deskStyles";

const OTHER = "__other__";

export type DecisionPick = { optionId: string } | { other: string };

/**
 * One decision, asked like a short question: the problem, what Bloom
 * recommends, two or three real answers with one marked Recommended, and a box
 * to write something else.
 */
export function DecisionCard({ d, busy, onConfirm }: { d: DeskDecision; busy: boolean; onConfirm: (pick: DecisionPick) => void }) {
  const recommended = d.options.find((o) => o.recommended) ?? d.options[0];
  const [choice, setChoice] = useState<string>(d.reviewFirst ? "" : recommended?.id ?? (d.other ? OTHER : ""));
  const [text, setText] = useState("");
  const allowed = d.options.length > 0 || !!d.other;
  const ready = choice === OTHER ? text.trim().length > 0 : !!choice;
  const groupId = `decision-${d.key.replace(/[^a-z0-9]/gi, "-")}`;

  return (
    <Box component="article" aria-labelledby={`${groupId}-title`} sx={{ ...deskCardSx, p: { xs: 4, sm: 5 } }}>
      <Stack spacing={4}>
        <Stack spacing={0.5}>
          <Stack direction="row" spacing={2} alignItems="baseline" flexWrap="wrap" useFlexGap>
            <Typography id={`${groupId}-title`} level="title-lg" component="h3">{d.client}</Typography>
            {d.when && <Typography level="body-sm" textColor="text.tertiary">{d.when}</Typography>}
          </Stack>
          {d.ticket && <Typography level="body-sm" textColor="text.secondary">{d.ticket}</Typography>}
        </Stack>

        <Stack spacing={3}>
          <Stack spacing={0.5}>
            <Typography level="body-sm" textColor="text.tertiary" sx={{ fontWeight: 600 }}>The problem</Typography>
            <Typography level="body-lg" textColor="text.primary">{d.problem}</Typography>
          </Stack>
          <Stack spacing={0.5}>
            <Typography level="body-sm" textColor="text.tertiary" sx={{ fontWeight: 600 }}>What Bloom recommends</Typography>
            <Typography level="body-lg" textColor="text.primary">{d.recommendation}</Typography>
          </Stack>
          {d.risk && (
            <Typography level="body-md" startDecorator={<AlertTriangle size={18} aria-hidden />} textColor="warning.800" sx={{ alignItems: "flex-start" }}>{d.risk}</Typography>
          )}
        </Stack>

        {allowed ? (
          <Stack spacing={3}>
            <RadioGroup
              name={groupId}
              value={choice}
              onChange={(e) => setChoice(e.target.value)}
              aria-label={`What should happen with ${d.client}?`}
              sx={{ gap: 2, m: 0 }}
            >
              {d.options.map((o) => (
                <OptionRow key={o.id} value={o.id} selected={choice === o.id} disabled={busy}>
                  <Stack spacing={0.25}>
                    <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
                      <Typography level="title-md">{o.label}</Typography>
                      {o.recommended && <Box component="span" sx={{ px: 2, py: 0.5, borderRadius: 999, bgcolor: "primary.100", color: "primary.800", fontSize: "0.75rem", fontWeight: 700 }}>Recommended</Box>}
                    </Stack>
                    <Typography level="body-sm" textColor="text.secondary">{o.detail}</Typography>
                  </Stack>
                </OptionRow>
              ))}
              {d.other && (
                <OptionRow value={OTHER} selected={choice === OTHER} disabled={busy}>
                  <Stack spacing={0.25}>
                    <Typography level="title-md">Something else</Typography>
                    <Typography level="body-sm" textColor="text.secondary">Write what should happen. It's saved on the request and assigned to you.</Typography>
                  </Stack>
                </OptionRow>
              )}
            </RadioGroup>
            {choice === OTHER && (
              <Textarea
                autoFocus
                minRows={2}
                maxRows={6}
                value={text}
                disabled={busy}
                onChange={(e) => setText(e.target.value)}
                placeholder="e.g. Check the fix already in review before starting a new one."
                slotProps={{ textarea: { maxLength: 2000, "aria-label": "What should happen instead?" } }}
              />
            )}
            <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
              {d.reviewFirst && d.open?.onClick ? (
                <Button size="lg" color="primary" variant="soft" onClick={d.open.onClick} sx={{ borderRadius: "xl", px: 3 }}>
                  Review stopped repair
                </Button>
              ) : null}
              <Button size={d.reviewFirst ? "md" : "lg"} variant={d.reviewFirst ? "outlined" : "solid"} color={d.reviewFirst ? "neutral" : "primary"} disabled={busy || !ready} onClick={() => onConfirm(choice === OTHER ? { other: text.trim() } : { optionId: choice })} sx={{ borderRadius: "xl", px: d.reviewFirst ? 3 : 6 }}>
                Confirm
              </Button>
              {d.open && !d.reviewFirst && (d.open.href
                ? <Link href={d.open.href} target="_blank" rel="noopener" level="body-md">{d.open.label}</Link>
                : <Link component="button" onClick={d.open.onClick} level="body-md">{d.open.label}</Link>)}
            </Stack>
          </Stack>
        ) : (
          <Stack spacing={2}>
            <Typography level="body-md" textColor="text.secondary">{d.reviewFirst ? "Review the stopped repair to decide what happens next." : "Your role can't make this decision. An admin can."}</Typography>
            {d.open && !d.open.href && (
              d.reviewFirst
                ? <Button variant="soft" onClick={d.open.onClick} sx={{ alignSelf: "flex-start" }}>Review stopped repair</Button>
                : <Link component="button" onClick={d.open.onClick} level="body-md" sx={{ alignSelf: "flex-start" }}>{d.open.label}</Link>
            )}
          </Stack>
        )}

        {d.evidence && (
          <Box component="details" sx={{ "& summary": { cursor: "pointer", color: "text.tertiary", fontSize: "0.9375rem", py: 1 } }}>
            <Box component="summary">Show technical evidence</Box>
            <Typography level="body-sm" textColor="text.secondary" sx={{ pt: 2, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{d.evidence}</Typography>
          </Box>
        )}
      </Stack>
    </Box>
  );
}

function OptionRow({ value, selected, disabled, children }: { value: string; selected: boolean; disabled: boolean; children: ReactNode }) {
  return (
    <Box
      component="label"
      sx={{
        display: "flex", gap: 3, alignItems: "flex-start", cursor: disabled ? "default" : "pointer",
        px: 4, py: 3, borderRadius: "lg", border: "1px solid",
        borderColor: selected ? "primary.400" : "neutral.200",
        bgcolor: selected ? "primary.50" : "background.surface",
        transition: "background-color 120ms ease, border-color 120ms ease",
        "&:hover": disabled ? {} : { borderColor: selected ? "primary.400" : "neutral.300" },
        "&:has(:focus-visible)": { outline: "3px solid var(--joy-palette-primary-500)", outlineOffset: "2px" },
      }}
    >
      <Radio value={value} disabled={disabled} sx={{ mt: 0.5 }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>{children}</Box>
    </Box>
  );
}
