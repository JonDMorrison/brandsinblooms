import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, FormControl, FormLabel, Input, Sheet, Stack, Textarea, Typography } from "@mui/joy";
import { bloomSupport } from "@/lib/bloomSupport/api";
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
/** Existing admin authority, narrowed to one reviewed recipe and two exact paths. */
export function TrustedBugSetupCard() {
  const query = useQueryClient();
  const settings = useQuery({ queryKey: ["bloom-support", "settings"], queryFn: bloomSupport.settings });
  const [snapshot, setSnapshot] = useState<unknown>(null);
  const [issue, setIssue] = useState("");
  const [githubIssue, setGithubIssue] = useState("");
  const [ticketText, setTicketText] = useState("");
  const [saved, setSaved] = useState(false);
  const tickets = ticketText.split(/[\s,]+/).filter(Boolean);
  const valid = UUID.test(issue) && /^[1-9][0-9]{0,8}$/.test(githubIssue) && tickets.length > 0 && tickets.length <= 50 && tickets.every(t => UUID.test(t)) && new Set(tickets).size === tickets.length;
  const save = useMutation({
    mutationFn: () => bloomSupport.configureTrustedBug({ issue_id: issue, github_issue: Number(githubIssue), ticket_ids: tickets, expected_policy: snapshot }),
    onSuccess: () => { setSaved(true); setSnapshot(null); void query.invalidateQueries({ queryKey: ["bloom-support", "settings"] }); },
  });
  const start = () => { save.reset(); setSaved(false); setSnapshot(structuredClone(settings.data?.release_policy ?? null)); };
  return <Sheet variant="outlined" sx={{ p: 1.5, borderRadius: "md" }}>
    <Stack spacing={1.5}>
      <Typography level="title-sm">Trusted bug verification</Typography>
      <Typography level="body-sm">Only the public contact attachment filename boundary: a valid 200-character PNG name must work; 201 characters must be rejected before sending. The browser check never submits a request.</Typography>
      <Typography level="body-xs">This assigns the fixed recipe to exactly these linked CRM bug tickets and adds only src/lib/bloomSupport/constants.ts and src/lib/bloomSupport/constants.test.ts to approved paths. It does not approve a feature, start repair, waive review, allow existing test edits, change checks or remove holds.</Typography>
      {saved && <Alert color="success">Verification scope saved. No repair was started and no release was approved.</Alert>}
      {!snapshot ? <Button size="sm" variant="outlined" disabled={!settings.data?.release_policy || settings.isLoading} onClick={start}>Configure exact bug scope</Button> : <>
        <FormControl><FormLabel>Engineering issue ID</FormLabel><Input value={issue} disabled={save.isPending} onChange={e => setIssue(e.target.value.trim())} /></FormControl>
        <FormControl><FormLabel>Recorded GitHub issue number</FormLabel><Input value={githubIssue} disabled={save.isPending} onChange={e => setGithubIssue(e.target.value.trim())} /></FormControl>
        <FormControl><FormLabel>Every linked ticket ID</FormLabel><Textarea value={ticketText} disabled={save.isPending} onChange={e => setTicketText(e.target.value)} minRows={2} placeholder="One ticket UUID per line" /></FormControl>
        {save.error && <Alert color="danger">{(save.error as Error).message} Reload the policy and review the scope before trying again.</Alert>}
        <Stack direction="row" spacing={1}>
          <Button disabled={!valid} loading={save.isPending} onClick={() => save.mutate()}>Save verification scope</Button>
          <Button variant="plain" disabled={save.isPending} onClick={() => { save.reset(); setSnapshot(null); }}>Cancel</Button>
          {save.error && <Button variant="outlined" disabled={save.isPending} onClick={async () => { const fresh = await settings.refetch(); setSnapshot(structuredClone(fresh.data?.release_policy ?? null)); save.reset(); }}>Reload current policy</Button>}
        </Stack>
      </>}
    </Stack>
  </Sheet>;
}
