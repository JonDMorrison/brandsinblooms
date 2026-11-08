import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import Box from "@mui/joy/Box";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import Button from "@mui/joy/Button";
import Alert from "@mui/joy/Alert";
import Skeleton from "@mui/joy/Skeleton";
import { formatDistanceToNow } from "date-fns";
import { Activity, AlertTriangle, CheckCircle2, ChevronDown, CirclePause, Settings2, Wrench } from "lucide-react";
import { bloomSupport, type Whoami } from "@/lib/bloomSupport/api";
import { useAskDialog } from "../useAskDialog";
import { deskCardSx } from "./deskStyles";
import { capabilityState, friendlyName, purposeOf, runningState, STATE_LABEL, summarizeCapabilities, type Capability, type CapabilityState } from "./systemStatus";

const ago = (d: string | null) => (d ? formatDistanceToNow(new Date(d), { addSuffix: true }) : null);

const STATE_STYLE: Record<CapabilityState, { bg: string; fg: string }> = {
  ready: { bg: "success.50", fg: "success.700" },
  needs_setup: { bg: "warning.50", fg: "warning.800" },
  off: { bg: "neutral.100", fg: "neutral.700" },
  not_built: { bg: "neutral.100", fg: "neutral.600" },
};

/**
 * System status: is Bloom running, and does anything need setting up?
 * Healthy capabilities fold away. Configuration names, tests and raw evidence
 * sit behind "Show technical evidence", shown only to people who manage automation.
 */
export function SystemStatusPanel({ me }: { me: Whoami }) {
  const q = useQuery({ queryKey: ["bloom-support", "readiness"], queryFn: () => bloomSupport.readiness(), refetchInterval: 60_000 });
  const settings = useQuery({ queryKey: ["bloom-support", "settings"], queryFn: () => bloomSupport.settings() });
  const technical = me.permissions.includes("automation.control") || me.permissions.includes("admin.policy");

  if (q.isLoading) return <Stack spacing={4}><Skeleton variant="rectangular" height={160} sx={{ borderRadius: "xl" }} /><Skeleton variant="rectangular" height={240} sx={{ borderRadius: "xl" }} /></Stack>;
  if (q.error) return <Alert color="warning" variant="soft" sx={{ borderRadius: "lg" }}>Bloom's status couldn't load. Try again in a minute.</Alert>;
  const r = q.data!;
  const caps = r.capabilities as Capability[];
  const s = summarizeCapabilities(caps);
  const run = runningState(r.summary.continuous_automation);
  const alerts = r.summary.open_alerts ?? [];
  const ai = (settings.data?.ai ?? {}) as { model?: string; max_calls_per_account_per_day?: number };

  return (
    <Stack spacing={6} sx={{ maxWidth: 1100, width: "100%", pb: 12 }}>
      <Box sx={{ ...deskCardSx, p: { xs: 5, md: 7 } }}>
        <Stack spacing={5}>
          <Stack direction="row" spacing={3} alignItems="flex-start">
            <Box sx={{ width: 52, height: 52, borderRadius: "xl", flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: `${run.tone}.50`, color: `${run.tone}.700` }}>
              {run.tone === "success" ? <Activity size={26} aria-hidden /> : run.title === "Bloom is paused" ? <CirclePause size={26} aria-hidden /> : <AlertTriangle size={26} aria-hidden />}
            </Box>
            <Stack spacing={1}>
              <Typography level="h2" component="h2">{run.title}</Typography>
              <Typography level="body-lg" textColor="text.secondary">{run.body}</Typography>
            </Stack>
          </Stack>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" }, gap: 3 }}>
            <Count value={s.ready} label="Capabilities ready" tone="success" />
            <Count value={s.needsSetup} label="Need setting up" tone={s.needsSetup ? "warning" : "neutral"} />
            <Count value={s.observed} label="Success observed recently" tone="primary" />
          </Box>
        </Stack>
      </Box>

      {alerts.length > 0 && (
        <Stack spacing={3} component="section" aria-label="Alerts">
          <Typography level="h3" component="h2">Alerts in the last day</Typography>
          <Box sx={{ ...deskCardSx, p: 5, bgcolor: "warning.50", borderColor: "warning.200" }}>
            <Stack spacing={2}>
              <Typography level="title-md" startDecorator={<AlertTriangle size={20} aria-hidden />} textColor="warning.800">
                Bloom raised {alerts.length} alert{alerts.length === 1 ? "" : "s"} about its own work.
              </Typography>
              <Typography level="body-md" textColor="text.secondary">Check failed steps in Settings. Details are under technical evidence.</Typography>
            </Stack>
          </Box>
        </Stack>
      )}

      {s.attention.length > 0 && (
        <Stack spacing={3} component="section" aria-label="Needs setting up">
          <Typography level="h3" component="h2">Needs setting up</Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }, gap: 3 }}>
            {s.attention.map((c) => (
              <Box key={c.key} sx={{ ...deskCardSx, p: 5, borderLeft: "4px solid", borderLeftColor: "warning.400" }}>
                <Stack spacing={1.5}>
                  <Typography level="title-lg" startDecorator={<Wrench size={20} aria-hidden />}>{friendlyName(c)}</Typography>
                  {purposeOf(c) && <Typography level="body-md" textColor="text.secondary">{purposeOf(c)}</Typography>}
                  <Typography level="body-md">Bloom can't do this yet. A developer needs to finish the setup.</Typography>
                </Stack>
              </Box>
            ))}
          </Box>
        </Stack>
      )}

      <Stack spacing={3} component="section" aria-label="All capabilities">
        <Typography level="h3" component="h2">Everything Bloom can do</Typography>
        <Stack spacing={2}>
          {s.groups.map((g) => (
            <Fold key={g.key} title={g.label} meta={`${g.ready} of ${g.items.length} ready`} complete={g.ready === g.items.length}>
              {g.items.map((c) => <CapabilityRow key={c.key} c={c} />)}
            </Fold>
          ))}
        </Stack>
      </Stack>

      <ModelSetting ai={ai} />

      {technical && (
        <Fold title="Show technical evidence" meta="Test coverage, configuration names and raw timestamps">
          <Stack spacing={0} sx={{ "& > * + *": { borderTop: "1px solid", borderColor: "neutral.100" } }}>
            <Typography level="body-sm" textColor="text.secondary" sx={{ px: 5, py: 3 }}>{r.live_evidence ?? "Last observed success is real production evidence, not a deployment or health check."} Generated {ago(r.generated_at)}.</Typography>
            {caps.map((c) => (
              <Stack key={c.key} spacing={1} sx={{ px: 5, py: 3 }}>
                <Typography level="title-sm">{c.label} <Box component="code" sx={{ fontSize: "0.8125rem", color: "text.tertiary" }}>{c.key}</Box></Typography>
                <Typography level="body-sm" textColor="text.secondary">Tested by: {c.tested}</Typography>
                <Typography level="body-sm" textColor="text.secondary">Built: {c.implemented ? "yes" : "no"} · Set up: {c.configured ? "yes" : "no"} · Switched on: {c.enabled === null ? "n/a" : c.enabled ? "yes" : "no"} · Last observed success: {c.live ?? "none in window"}</Typography>
                {c.missing.length > 0 && <Typography level="body-sm" textColor="warning.800" sx={{ overflowWrap: "anywhere" }}>Missing configuration: {c.missing.join(", ")}</Typography>}
                {c.note && <Typography level="body-sm" textColor="text.secondary" sx={{ overflowWrap: "anywhere" }}>{c.note}</Typography>}
              </Stack>
            ))}
            {alerts.map((a, i) => (
              <Typography key={i} level="body-sm" textColor="warning.700" sx={{ px: 5, py: 2 }}>Alert: {String(a.condition)} · {String(a.created_at)} · {String(a.delivered)}</Typography>
            ))}
          </Stack>
        </Fold>
      )}
    </Stack>
  );
}

function Count({ value, label, tone }: { value: number; label: string; tone: "success" | "warning" | "primary" | "neutral" }) {
  return (
    <Stack spacing={0.5} sx={{ p: 4, borderRadius: "lg", border: "1px solid", borderColor: `${tone}.200`, bgcolor: `${tone}.50` }}>
      <Typography level="h1" component="p" textColor={`${tone}.700`}>{value}</Typography>
      <Typography level="body-md" textColor="text.secondary">{label}</Typography>
    </Stack>
  );
}

/** A large, keyboard-friendly disclosure. Collapsed by default. */
function Fold({ title, meta, complete, children }: { title: string; meta: string; complete?: boolean; children: ReactNode }) {
  return (
    <Box component="details" sx={{ ...deskCardSx, overflow: "hidden", "&[open] .fold-chevron": { transform: "rotate(180deg)" }, "& > summary::-webkit-details-marker": { display: "none" } }}>
      <Box component="summary" sx={{ listStyle: "none", cursor: "pointer", px: 5, py: 4, minHeight: 64, display: "flex", alignItems: "center", gap: 3, "&:hover": { bgcolor: "neutral.50" } }}>
        {complete !== undefined && <Box sx={{ color: complete ? "success.600" : "warning.600", display: "flex" }}>{complete ? <CheckCircle2 size={22} aria-hidden /> : <AlertTriangle size={22} aria-hidden />}</Box>}
        {complete === undefined && <Box sx={{ color: "text.tertiary", display: "flex" }}><Settings2 size={22} aria-hidden /></Box>}
        <Stack sx={{ flex: 1, minWidth: 0 }}>
          <Typography level="title-md">{title}</Typography>
          <Typography level="body-sm" textColor="text.secondary">{meta}</Typography>
        </Stack>
        <Box className="fold-chevron" sx={{ display: "flex", color: "text.tertiary", transition: "transform 150ms ease" }}><ChevronDown size={20} aria-hidden /></Box>
      </Box>
      <Box sx={{ borderTop: "1px solid", borderColor: "neutral.100" }}>{children}</Box>
    </Box>
  );
}

function CapabilityRow({ c }: { c: Capability }) {
  const state = capabilityState(c);
  const style = STATE_STYLE[state];
  const seen = ago(c.live);
  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 1, sm: 3 }} alignItems={{ sm: "center" }} sx={{ px: 5, py: 3, "& + &": { borderTop: "1px solid", borderColor: "neutral.100" } }}>
      <Stack sx={{ flex: 1, minWidth: 0 }}>
        <Typography level="title-sm">{friendlyName(c)}</Typography>
        {purposeOf(c) && <Typography level="body-sm" textColor="text.secondary">{purposeOf(c)}</Typography>}
      </Stack>
      <Typography level="body-sm" textColor="text.tertiary" sx={{ flex: "0 0 auto" }}>{seen ? `Last success observed ${seen}` : "No recent evidence"}</Typography>
      <Box component="span" sx={{ flex: "0 0 auto", alignSelf: { xs: "flex-start", sm: "center" }, px: 2.5, py: 0.5, borderRadius: 999, bgcolor: style.bg, color: style.fg, fontSize: "0.8125rem", fontWeight: 600, whiteSpace: "nowrap" }}>{STATE_LABEL[state]}</Box>
    </Stack>
  );
}

function ModelSetting({ ai }: { ai: { model?: string; max_calls_per_account_per_day?: number } }) {
  const qc = useQueryClient();
  const { ask, dialog } = useAskDialog();
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (model: string) => bloomSupport.setSetting("ai", { ...ai, provider: "openai", model }),
    onSuccess: () => { setError(null); qc.invalidateQueries({ queryKey: ["bloom-support"] }); },
    onError: (e: Error) => setError(e.message),
  });
  return (
    <Box sx={{ ...deskCardSx, p: 5 }}>
      {dialog}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={3} alignItems={{ sm: "center" }} justifyContent="space-between">
        <Stack spacing={0.5}>
          <Typography level="title-md">Bloom's AI model</Typography>
          <Typography level="body-md" textColor="text.secondary">{ai.model ?? "gpt-4o-mini"} · up to {ai.max_calls_per_account_per_day ?? 200} uses per client each day. Billed to the OpenAI API account.</Typography>
        </Stack>
        <Button variant="outlined" color="neutral" loading={save.isPending} sx={{ borderRadius: "xl", flexShrink: 0 }} onClick={async () => {
          const r = await ask({ title: "Change Bloom's AI model", description: "Used for Bloom's background work. Billed to the OpenAI API account.", fields: [{ name: "model", label: "Model name", kind: "text", required: true, initial: ai.model ?? "gpt-4o-mini", helper: "Exactly as OpenAI names it, e.g. gpt-4o-mini." }], confirmLabel: "Change model" });
          if (r) save.mutate(String(r.model).trim());
        }}>Change model</Button>
      </Stack>
      {error && <Alert color="warning" variant="soft" sx={{ mt: 3, borderRadius: "lg" }}>{error}</Alert>}
    </Box>
  );
}
