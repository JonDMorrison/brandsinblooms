import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import Modal from "@mui/joy/Modal";
import ModalDialog from "@mui/joy/ModalDialog";
import ModalClose from "@mui/joy/ModalClose";
import Typography from "@mui/joy/Typography";
import Stack from "@mui/joy/Stack";
import FormControl from "@mui/joy/FormControl";
import FormLabel from "@mui/joy/FormLabel";
import FormHelperText from "@mui/joy/FormHelperText";
import Autocomplete from "@mui/joy/Autocomplete";
import Textarea from "@mui/joy/Textarea";
import Button from "@mui/joy/Button";
import Alert from "@mui/joy/Alert";
import { bloomSupport } from "@/lib/bloomSupport/api";

type Account = { id: string; name: string };

/**
 * Files a request on a client's behalf (phone call, in person). It is triaged like
 * any other request. Replaces the old chain of browser prompts.
 */
export function NewTicketDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (ticketId: string) => void }) {
  const [search, setSearch] = useState("");
  const [account, setAccount] = useState<Account | null>(null);
  const [body, setBody] = useState("");

  const accounts = useQuery({
    queryKey: ["bloom-support", "accounts", "search", search],
    queryFn: () => bloomSupport.listAccounts(search),
    enabled: open && search.trim().length >= 2,
    staleTime: 30_000,
  });

  const create = useMutation({
    mutationFn: () => bloomSupport.createTicket({ account_id: account!.id, body: body.trim(), channel: "staff", subject: body.trim().split("\n")[0].slice(0, 120) }),
    onSuccess: (created) => {
      setAccount(null);
      setBody("");
      setSearch("");
      onCreated(created.ticket_id);
    },
  });

  return (
    <Modal open={open} onClose={onClose}>
      <ModalDialog sx={{ width: "min(560px, 94vw)", borderRadius: "xl", p: 3 }}>
        <ModalClose />
        <Stack spacing={2.5}>
          <div>
            <Typography level="title-lg">New request</Typography>
            <Typography level="body-md" textColor="text.secondary">For a client who called, emailed you directly or asked in person. Bloom picks it up like any other request.</Typography>
          </div>
          <FormControl required>
            <FormLabel>Which client?</FormLabel>
            <Autocomplete
              placeholder="Start typing the client's name"
              options={(accounts.data ?? []).map((a): Account => ({ id: a.id, name: a.name }))}
              multiple={false}
              freeSolo={false}
              getOptionLabel={(o: Account) => o.name}
              isOptionEqualToValue={(a: Account, b: Account) => a.id === b.id}
              value={account}
              onChange={(_, v: Account | null) => setAccount(v)}
              inputValue={search}
              onInputChange={(_, v) => setSearch(v)}
              loading={accounts.isFetching}
              noOptionsText={search.trim().length < 2 ? "Type at least 2 letters" : "No client with that name"}
              filterOptions={(o: Account[]) => o}
            />
          </FormControl>
          <FormControl required>
            <FormLabel>What do they need?</FormLabel>
            <Textarea minRows={4} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Describe it in their words, e.g. “The spring sale should start April 12, not April 5.”" />
            <FormHelperText>The first line becomes the request's title.</FormHelperText>
          </FormControl>
          {create.error && <Alert color="danger" variant="soft">{(create.error as Error).message}</Alert>}
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button variant="plain" color="neutral" onClick={onClose}>Cancel</Button>
            <Button size="lg" disabled={!account || !body.trim()} loading={create.isPending} onClick={() => create.mutate()} sx={{ borderRadius: "xl" }}>Create request</Button>
          </Stack>
        </Stack>
      </ModalDialog>
    </Modal>
  );
}
