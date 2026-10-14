import * as React from "react";
import { Button, FormControl, FormLabel, Option, Select, Sheet, Stack, Typography } from "@mui/joy";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";

type Recipient = { id: string; label: string };

/** Explicitly gated Phase 0 pilot. This is not the production campaign composer. */
export function PushPilotPanel() {
  const { tenant } = useTenant();
  const enabled = import.meta.env.VITE_WEB_PUSH_PILOT_ENABLED === "true";
  const [recipients, setRecipients] = React.useState<Recipient[]>([]);
  const [customerId, setCustomerId] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!enabled || !tenant?.id) return;
    let cancelled = false;
    setLoading(true);
    setNotice("");
    setRecipients([]);
    setCustomerId(null);
    void supabase.functions.invoke("send-push-test", {
      body: { action: "list" },
    }).then(({ data, error }) => {
      if (cancelled) return;
      if (error) {
        setNotice("Push pilot recipients are not available.");
      } else {
        setRecipients(Array.isArray(data?.customers) ? data.customers : []);
      }
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [enabled, tenant?.id]);

  if (!enabled || !tenant?.id) return null;

  async function sendTest() {
    if (!customerId) return;
    setBusy(true);
    setNotice("");
    try {
      const { data, error } = await supabase.functions.invoke("send-push-test", {
        body: { action: "send", customerId },
      });
      if (error) throw error;
      const queued = Number(data?.queued || 0);
      setNotice(queued > 0
        ? `Queued ${queued} test notification${queued === 1 ? "" : "s"}. Check the worker status for delivery.`
        : "No eligible subscriptions were found.");
    } catch {
      setNotice("Unable to queue the test push. Check recipient consent and pilot configuration.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet variant="outlined" sx={{ borderRadius: "xl", p: { xs: 2.5, md: 3 } }}>
      <Stack spacing={2}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Bell size={20} aria-hidden="true" />
          <Typography level="h3">Web Push pilot</Typography>
        </Stack>
        <Typography level="body-sm" color="neutral">
          Send one test notification to a verified, opted-in storefront customer.
          This pilot does not send to a full segment.
        </Typography>
        <FormControl>
          <FormLabel>Test recipient</FormLabel>
          <Select
            value={customerId}
            placeholder={loading ? "Loading eligible customers…" : "Select a subscribed customer"}
            onChange={(_event, value) => setCustomerId(value)}
          >
            {recipients.map((customer) => (
              <Option key={customer.id} value={customer.id}>{customer.label}</Option>
            ))}
          </Select>
        </FormControl>
        <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "center" }} gap={2}>
          <Button disabled={!customerId || busy || loading} loading={busy}
            onClick={() => void sendTest()}>
            Queue test push
          </Button>
          <Typography level="body-sm" color="neutral">
            {recipients.length} customers with eligible subscriptions
          </Typography>
        </Stack>
        {notice ? <Typography level="body-sm" role="status">{notice}</Typography> : null}
      </Stack>
    </Sheet>
  );
}
