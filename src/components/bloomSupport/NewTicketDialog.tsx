import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import Modal from "@mui/joy/Modal";
import ModalDialog from "@mui/joy/ModalDialog";
import ModalClose from "@mui/joy/ModalClose";
import Typography from "@mui/joy/Typography";
import Stack from "@mui/joy/Stack";
import FormControl from "@mui/joy/FormControl";
import FormLabel from "@mui/joy/FormLabel";
import FormHelperText from "@mui/joy/FormHelperText";
import Textarea from "@mui/joy/Textarea";
import Button from "@mui/joy/Button";
import Alert from "@mui/joy/Alert";
import RadioGroup from "@mui/joy/RadioGroup";
import Radio from "@mui/joy/Radio";
import { bloomSupport } from "@/lib/bloomSupport/api";

import { ClientPicker, type PickedClient as Account } from "./ClientPicker";

/**
 * Files a request on a client's behalf (phone call, in person). It is triaged like
 * any other request. Replaces the old chain of browser prompts.
 */
export function NewTicketDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (ticketId: string) => void }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const attempt = useRef<{ signature: string; key: string } | null>(null);


  const create = useMutation({
    mutationFn: () => {
      const payload = { ...(internal ? { product: "crm", kind: "bug", context: { page_url: "https://bloomsuite.app/support/contact" } } : { account_id: account!.id }),
        body: body.trim(), channel: "staff", subject: body.trim().split("\n")[0].slice(0, 120) };
      const signature = JSON.stringify(payload);
      if (attempt.current?.signature !== signature) attempt.current = { signature, key: `staff-request:${crypto.randomUUID()}` };
      return bloomSupport.createTicket({ ...payload, idempotency_key: attempt.current.key });
    },
    onSuccess: (created) => {
      setAccount(null);
      setBody("");
      setInternal(false);
      attempt.current = null;
      onCreated(created.ticket_id);
    },
  });

  return (
    <Modal open={open} onClose={() => { if (!create.isPending) onClose(); }}>
      <ModalDialog sx={{ width: "min(560px, 94vw)", borderRadius: "xl", p: 3 }}>
        <ModalClose aria-label="Close" disabled={create.isPending} />
        <Stack spacing={2.5}>
          <div>
            <Typography level="title-lg">New request</Typography>
            <Typography level="body-md" textColor="text.secondary">For a client who called, emailed you directly or asked in person. Bloom picks it up like any other request.</Typography>
          </div>
          <FormControl>
            <FormLabel>Request for</FormLabel>
            <RadioGroup value={internal ? "internal" : "client"} onChange={e => setInternal(e.target.value === "internal")}>
              <Radio value="client" label="Client request" disabled={create.isPending} />
              <Radio value="internal" label="Internal public-contact bug (no client)" disabled={create.isPending} />
            </RadioGroup>
          </FormControl>
          {internal ? <Alert color="neutral">Files a genuine CRM bug for https://bloomsuite.app/support/contact under your own identity, with no client account or attachment. Staff notifications and normal triage still run. This does not start an engineering repair.</Alert> : <FormControl required>
            <FormLabel>Which client?</FormLabel>
            <ClientPicker value={account} onChange={setAccount} />
          </FormControl>}
          <FormControl required>
            <FormLabel>{internal ? "What is broken, and how did you reproduce it?" : "What do they need?"}</FormLabel>
            <Textarea disabled={create.isPending} minRows={4} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Describe it in their words, e.g. “The spring sale should start April 12, not April 5.”" />
            <FormHelperText>The first line becomes the request's title.</FormHelperText>
          </FormControl>
          {create.error && <Alert color="danger" variant="soft">{(create.error as Error).message}</Alert>}
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button variant="plain" color="neutral" disabled={create.isPending} onClick={onClose}>Cancel</Button>
            <Button size="lg" disabled={(!internal && !account) || body.trim().length < 3} loading={create.isPending} onClick={() => create.mutate()} sx={{ borderRadius: "xl" }}>Create request</Button>
          </Stack>
        </Stack>
      </ModalDialog>
    </Modal>
  );
}
