import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import Button from "@mui/joy/Button";
import Textarea from "@mui/joy/Textarea";
import { useRef, useState } from "react";
import { Sprout } from "lucide-react";
import { labelFor } from "@/components/admin/readableFormat";
import { bloomSupport, type TicketDetail, type Whoami } from "@/lib/bloomSupport/api";
import { MAX_SUPPORT_BODY_LENGTH } from "@/lib/bloomSupport/constants";
import { type EngineeringFacts, liveNextStep, type NextAction, resolutionPlan } from "../../../supabase/functions/_shared/bloom-support/next-step";

/**
 * "Bloom recommends": the one thing this ticket needs from a person, with a
 * single confirm button. A staff email's link can only pre-select the action
 * (`hint`); the live ticket decides whether it is still valid, the person
 * confirms here, and the existing endpoints check their permissions.
 */
export function BloomRecommends({ t, me, hint, busy, run, onReply }: {
  t: TicketDetail;
  me: Whoami;
  hint: NextAction | null;
  busy: boolean;
  run: (fn: () => Promise<unknown>, done: string) => void;
  /** Focus the reply box. */
  onReply: () => void;
}) {
  const step = liveNextStep({
    status: t.status,
    automation: t.automation,
    pending_review: t.pending_review,
    merged_into: t.merged_into,
    engineering: t.engineering as EngineeringFacts | null | undefined,
    operations: t.operations,
    feature_request: t.feature_request as { id?: unknown; status?: unknown } | null | undefined,
    escalations: t.escalations as Array<{ reason?: unknown; status?: unknown }> | undefined,
  }, hint);
  const plan = step?.action === "send-and-solve"
    ? resolutionPlan({ engineering: t.engineering as EngineeringFacts | null | undefined, requesterName: t.requester?.name ?? null })
    : null;
  // The drafted reply is the person's to edit; it is only sent when they confirm.
  const [draft, setDraft] = useState<string | null>(null);
  const replyKey = useRef(crypto.randomUUID());
  // A client's reply after resolution already has its own one-click choices below.
  if (!step || step.action === "review-reply") return null;
  // Everyday "take over / reply" is only suggested when a person was asked for.
  if ((step.action === "take-over" || step.action === "reply") && !hint && t.status !== "needs_owner") return null;

  const allowed = me.permissions.includes(step.permission);
  const eng = t.engineering as { id?: string } | null | undefined;
  const op = (t.operations ?? []).find((o) => o.status === "previewed");
  const feature = t.feature_request as { id?: string; title?: string } | null | undefined;
  const note = `From Bloom's recommendation on #${t.number}`;

  const primary = (): void => {
    switch (step.action) {
      case "approve-fix":
        if (eng?.id) run(() => bloomSupport.updateEngineering(eng.id!, { status: "approved", note }), "Fix approved. Bloom will release it, check it and tell the client.");
        return;
      case "start-repair":
        if (eng?.id) run(() => bloomSupport.updateEngineering(eng.id!, { start_repair: true, note }), "Repair started. Nothing is released without approval.");
        return;
      case "confirm-change":
        if (op) run(() => bloomSupport.executeOperation(String(op.id)), "Change made. Bloom will report back to the client.");
        return;
      case "take-over":
        run(() => bloomSupport.setAutomation(t.id, "human", note), "It's yours. Bloom won't message the client. Write your reply below.");
        onReply();
        return;
      case "reply":
        onReply();
        return;
      case "send-and-solve": {
        if (!plan) return;
        const body = (draft ?? plan.draft).trim();
        if (!body) return;
        run(async () => {
          // The existing reply and status endpoints; each checks the person's permission.
          const sent = await bloomSupport.addMessage(t.id, { body, visibility: "public", idempotency_key: replyKey.current });
          await bloomSupport.updateTicket(t.id, {
            status: "resolved",
            resolution_summary: plan.summary,
            resolution_evidence: {
              via: "send-and-solve",
              reply_message_id: sent.message_id,
              verification: { passed: true, note: plan.checked },
              verified_note: plan.checked,
              ...(plan.noDeployReason ? { no_deploy_reason: plan.noDeployReason } : {}),
            },
          });
        }, "Reply sent and the request is marked solved.");
        return;
      }
      default:
        return;
    }
  };

  return (
    <Sheet
      variant="soft"
      color="primary"
      role="region"
      aria-label="Bloom recommends"
      sx={{ px: 2, py: 1.75, borderRadius: "lg", border: "1px solid", borderColor: "primary.outlinedBorder" }}
    >
      <Stack spacing={1}>
        <Typography level="title-sm" startDecorator={<Sprout size={16} aria-hidden />}>Bloom recommends</Typography>
        <Typography level="body-sm" textColor="text.primary">{step.recommendation}</Typography>
        {plan ? (
          <Stack spacing={0.75}>
            {plan.findings.map((f) => <Typography key={f} level="body-xs" textColor="text.secondary">{f}</Typography>)}
            <Textarea
              size="sm"
              minRows={4}
              maxRows={12}
              value={draft ?? plan.draft}
              disabled={busy || !allowed}
              onChange={(e) => setDraft(e.target.value)}
              slotProps={{ textarea: { maxLength: MAX_SUPPORT_BODY_LENGTH, "aria-label": "Reply to the client" } }}
              sx={{ bgcolor: "background.surface" }}
            />
            <Typography level="body-xs" textColor="text.tertiary">Sent to the client as your reply. Edit anything first.</Typography>
          </Stack>
        ) : null}
        {step.action === "confirm-change" && op ? (
          <Typography level="body-xs" textColor="text.secondary">Prepared change: {labelFor(String(op.kind ?? "change"))}</Typography>
        ) : null}
        {!allowed ? (
          <Typography level="body-xs" textColor="text.secondary">Your role can't do this. An admin can.</Typography>
        ) : step.action === "decide-feature" && feature?.id ? (
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ pt: 0.5 }}>
            <Button size="sm" loading={busy} onClick={() => run(() => bloomSupport.decideFeature(feature.id!, "accepted", note), "Accepted. Bloom will tell the client.")}>Accept</Button>
            <Button size="sm" variant="outlined" disabled={busy} onClick={() => run(() => bloomSupport.decideFeature(feature.id!, "planned", note), "Planned. Bloom will tell the client.")}>Plan for later</Button>
            <Button size="sm" variant="plain" color="neutral" disabled={busy} onClick={() => run(() => bloomSupport.decideFeature(feature.id!, "declined", note), "Declined. Bloom will tell the client.")}>Decline</Button>
          </Stack>
        ) : (
          <Stack direction="row" sx={{ pt: 0.5 }}>
            <Button size="sm" loading={busy} disabled={!!plan && !(draft ?? plan.draft).trim()} onClick={primary} sx={{ borderRadius: "md" }}>{step.button}</Button>
          </Stack>
        )}
      </Stack>
    </Sheet>
  );
}
