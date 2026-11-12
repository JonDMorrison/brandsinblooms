import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Checkbox, FormControl, FormLabel, Modal, ModalDialog, Stack, Textarea, Typography } from "@mui/joy";
import { bloomSupport, type TicketDetail, type ReconcileTicketLinksInput } from "@/lib/bloomSupport/api";

const fields = ["problem_id", "engineering_issue_id", "feature_request_id"] as const;
const labels = { problem_id: "Shared problem", engineering_issue_id: "Engineering issue", feature_request_id: "Feature request" };

/** Freeze the reviewed tuple; polling must never silently change a person's selection. */
export function ReconcileTicketLinks({ ticket }: { ticket: TicketDetail }) {
  const qc = useQueryClient();
  const [review, setReview] = useState<TicketDetail | null>(null);
  const [selected, setSelected] = useState<Array<typeof fields[number]>>([]);
  const [reason, setReason] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const pending = useRef<ReconcileTicketLinksInput | null>(null);
  const eligible = (t: TicketDetail) => !!t.duplicate_of && !t.merged_into && !t.spam && t.status !== "resolved" && Number.isSafeInteger(t.version);
  const open = async () => {
    setBusy(true); setError(null); setNotice(null);
    try {
      const fresh = await bloomSupport.getTicket(ticket.id);
      if (!eligible(fresh)) throw new Error("This request is no longer an active duplicate. Refresh and review its current links.");
      setReview(fresh); setSelected([]); setReason(""); setNext(fresh.next_action ?? ""); pending.current = null;
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load the current links."); }
    finally { setBusy(false); }
  };
  const save = async () => {
    if (!review || busy) return;
    const request = pending.current ?? {
      version: review.version!,
      expected: { duplicate_of: review.duplicate_of!, merged_into: review.merged_into ?? null, problem_id: review.problem_id ?? null, engineering_issue_id: review.engineering_issue_id ?? null, feature_request_id: review.feature_request_id ?? null },
      clear_inherited: selected, reason: reason.trim(), next_action: next.trim(), idempotency_key: crypto.randomUUID(),
    };
    pending.current = request; setBusy(true); setError(null);
    try {
      const result = await bloomSupport.reconcileTicketLinks(review.id, request);
      if (result.ticket_id !== review.id || result.detached_duplicate !== request.expected.duplicate_of || result.version !== request.version + 1 ||
          !Array.isArray(result.cleared_inherited) || [...result.cleared_inherited].sort().join(",") !== [...request.clear_inherited].sort().join(",")) {
        throw new Error("The server did not confirm this exact correction.");
      }
      setReview(null); pending.current = null; setNotice("Duplicate correction saved. No approval, repair or client reply was sent.");
      // Refresh the shared desk cache, not the browser or a stale dialog snapshot.
      void qc.invalidateQueries({ queryKey: ["bloom-support"] });
    } catch (e) { setError(`${e instanceof Error ? e.message : "Correction could not be confirmed."} Retry the same correction, or cancel and review current links again.`); }
    finally { setBusy(false); }
  };
  const locked = busy || pending.current !== null;
  const duplicate = review?.links?.find((l) => l.kind === "duplicate" && l.ticket_id === review.duplicate_of);
  return <>
    {eligible(ticket) && <Button size="sm" variant="plain" disabled={busy} onClick={open}>Correct mistaken duplicate</Button>}
    {!review && error && <Alert role="alert" color="warning">{error}</Alert>}
    {notice && <Typography role="status" level="body-sm">{notice}</Typography>}
    <Modal open={!!review} onClose={() => { if (!busy) { setReview(null); setError(null); } }}>
      <ModalDialog sx={{ width: "min(600px, 94vw)", maxHeight: "90vh", overflow: "auto", borderRadius: "xl" }}>
        {review && <Stack component="form" spacing={2} onSubmit={(e) => { e.preventDefault(); void save(); }}>
          <Typography level="title-lg">Correct mistaken duplicate</Typography>
          <Typography level="body-sm">Request #{review.number}: {review.subject}. Reviewed version {review.version}.</Typography>
          <Typography level="body-sm">Detach duplicate of {duplicate ? `#${duplicate.number}: ${duplicate.subject}` : review.duplicate_of} ({review.duplicate_of}).</Typography>
          <Typography level="body-sm">Select only links inherited from that mistaken duplicate. Unchecked links stay unchanged. Independent associations are rejected by the server. This does not choose replacement links, grant feature approval, dispatch a repair, resolve the request or send a client reply.</Typography>
          {fields.map((field) => {
            const linked = field === "problem_id" ? review.problem : field === "engineering_issue_id" ? review.engineering : review.feature_request;
            return <Stack key={field} spacing={0.5}>
              <Typography level="body-xs" sx={{ overflowWrap: "anywhere" }}>{labels[field]}: {linked?.title ? String(linked.title) : "No title available"} · {review[field] ?? "Not linked"}</Typography>
              <Checkbox label={`Clear inherited ${labels[field].toLowerCase()}`} disabled={locked || !review[field]} checked={selected.includes(field)} onChange={(e) => setSelected((old) => e.target.checked ? [...old, field] : old.filter((f) => f !== field))} />
            </Stack>;
          })}
          <FormControl required><FormLabel>Reason for correction</FormLabel><Textarea disabled={locked} value={reason} onChange={(e) => setReason(e.target.value)} slotProps={{ textarea: { disabled: locked, maxLength: 2000 } }} /></FormControl>
          <FormControl required><FormLabel>What happens next</FormLabel><Textarea disabled={locked} value={next} onChange={(e) => setNext(e.target.value)} slotProps={{ textarea: { disabled: locked, maxLength: 1000 } }} /></FormControl>
          {error && <Alert role="alert" color="warning">{error}</Alert>}
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button variant="plain" disabled={busy} onClick={() => { setReview(null); setError(null); }}>Cancel</Button>
            <Button type="submit" loading={busy} disabled={busy || !reason.trim() || !next.trim() || reason.length > 2000 || next.length > 1000}>{pending.current ? "Retry same correction" : "Detach duplicate and save"}</Button>
          </Stack>
        </Stack>}
      </ModalDialog>
    </Modal>
  </>;
}
