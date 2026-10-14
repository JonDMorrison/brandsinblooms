import * as React from "react";
import {
  Button, Checkbox, FormControl, FormLabel, Input, Option, Select,
  Sheet, Stack, Textarea, Typography,
} from "@mui/joy";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Candidate = { id: string; label: string };
type PendingLink = {
  id: string;
  siteId: string;
  storefrontUserId: string;
  observedEmail: string | null;
  sourceEmailSeenAt: string | null;
  candidateMatches: Candidate[];
};

function PendingCustomerReview({ item, completed }: {
  item: PendingLink;
  completed: (id: string) => void;
}) {
  const [customerId, setCustomerId] = React.useState(item.candidateMatches[0]?.id || "");
  const [reason, setReason] = React.useState("");
  const [acknowledged, setAcknowledged] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState("");

  async function approve() {
    if (saving || !acknowledged || reason.trim().length < 12 ||
        !/^[0-9a-f-]{36}$/i.test(customerId)) return;
    setSaving(true);
    setMessage("");
    try {
      const { data, error } = await supabase.functions.invoke("review-storefront-push-identity", {
        body: {
          action: "verify",
          linkId: item.id,
          crmCustomerId: customerId,
          reason: reason.trim(),
          confirmedManually: true,
        },
      });
      if (error || data?.status !== "verified") throw Error("Review could not be recorded.");
      completed(item.id);
    } catch {
      setMessage("This identity link could not be approved. Check the customer, tenant and existing links.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet variant="outlined" sx={{ borderRadius: "lg", p: 2 }}>
      <Stack spacing={1.5}>
        <Typography level="title-md">Customer awaiting verification</Typography>
        <Typography level="body-sm" sx={{ overflowWrap: "anywhere" }}>
          Storefront account: {item.storefrontUserId}
        </Typography>
        <Typography level="body-xs" sx={{ overflowWrap: "anywhere" }}>
          Store site ID: {item.siteId}
        </Typography>
        <Typography level="body-sm">Confirmed storefront email on file:{" "}
          <strong>{item.observedEmail || "Not provided"}</strong>
        </Typography>
        <Typography level="body-xs" color="warning">
          An email match is only a possible candidate. Check the customer through a separate
          trusted store interaction before approving this link. Never merge customers automatically.
        </Typography>
        {item.candidateMatches.length > 0 ? (
          <FormControl>
            <FormLabel>Possible CRM customer match</FormLabel>
            <Select value={customerId || null}
              onChange={(_event, value) => setCustomerId(value || "")}>
              {item.candidateMatches.map(candidate => (
                <Option key={candidate.id} value={candidate.id}>
                  {candidate.label} ({candidate.id.slice(0, 8)})
                </Option>
              ))}
            </Select>
          </FormControl>
        ) : null}
        <FormControl>
          <FormLabel>CRM customer UUID</FormLabel>
          <Input value={customerId} placeholder="Find the verified customer in CRM"
            onChange={(event) => setCustomerId(event.target.value.trim())} />
        </FormControl>
        <FormControl>
          <FormLabel>Identity verification evidence</FormLabel>
          <Textarea minRows={2} maxRows={4} value={reason}
            placeholder="Describe how this customer personally confirmed the two identities. Do not paste passwords or private codes."
            onChange={(event) => setReason(event.target.value)}
          />
        </FormControl>
        <Checkbox
          checked={acknowledged}
          onChange={(event) => setAcknowledged(event.target.checked)}
          label="I independently verified that these are the same customer. No email-only match."
        />
        <Button onClick={() => void approve()}
          disabled={!acknowledged || saving || reason.trim().length < 12 ||
            !/^[0-9a-f-]{36}$/i.test(customerId)} loading={saving}>
          Approve customer identity
        </Button>
        {message ? <Typography role="alert" level="body-sm">{message}</Typography> : null}
      </Stack>
    </Sheet>
  );
}

export function PushIdentityReview() {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [items, setItems] = React.useState<PendingLink[]>([]);
  const [error, setError] = React.useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const { data, error: failure } = await supabase.functions.invoke("review-storefront-push-identity", {
        body: { action: "list" },
      });
      if (failure) throw failure;
      setItems(Array.isArray(data?.pending) ? data.pending : []);
      setOpen(true);
    } catch {
      setError("Unable to load pending storefront customer links.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet variant="soft" sx={{ borderRadius: "lg", p: 2.5 }}>
      <Stack spacing={2}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
          <Stack direction="row" alignItems="center" gap={1}>
            <ShieldCheck size={20} />
            <Typography level="title-md">Verified customer identity</Typography>
          </Stack>
          <Button variant="outlined" color="neutral" size="sm" loading={loading}
            onClick={() => void load()}>
            {open ? "Refresh" : "Review pending links"}
          </Button>
        </Stack>
        <Typography level="body-sm">
          Connect storefront customers to your CRM only after an identity review.
          Source emails are suggestions, not proof.
        </Typography>
        {error ? <Typography role="alert" level="body-sm">{error}</Typography> : null}
        {open && items.length === 0 ? (
          <Typography level="body-sm">No pending storefront identities found.</Typography>
        ) : null}
        {open && items.map(item => (
          <PendingCustomerReview key={item.id} item={item}
            completed={(id) => setItems(items => items.filter(item => item.id !== id))}
          />
        ))}
      </Stack>
    </Sheet>
  );
}
