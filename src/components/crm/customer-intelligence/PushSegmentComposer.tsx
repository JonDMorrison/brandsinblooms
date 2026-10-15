import * as React from "react";
import {
  Button, Checkbox, FormControl, FormLabel, Input,
  Option, Select, Sheet, Stack, Textarea, Typography,
} from "@mui/joy";
import { BellRing } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";

type Segment = { id: string; name: string; customer_count: number | null };
type Preview = {
  segmentMembers: number;
  eligibleCustomers: number;
  eligibleDevices: number;
  excludedCustomers: number;
};

const DEFAULT_OPEN_PATH = "/account/offers";

/** Same CRM customer segments and consent authority used by email and SMS. */
export function PushSegmentComposer() {
  const { tenant } = useTenant();
  const [segments, setSegments] = React.useState<Segment[]>([]);
  const [segmentId, setSegmentId] = React.useState<string | null>(null);
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [preview, setPreview] = React.useState<Preview | null>(null);
  const [approved, setApproved] = React.useState(false);
  const [busy, setBusy] = React.useState<""|"list"|"preview"|"queue">("");
  const [feedback, setFeedback] = React.useState("");
  const requestKey = React.useRef(crypto.randomUUID());

  React.useEffect(() => {
    if (!tenant?.id) return;
    let live = true;
    setPreview(null); setApproved(false); setSegmentId(null);
    setSegments([]); setFeedback(""); setBusy("list");
    void supabase.functions.invoke("queue-push-segment", {
      body: { action: "list" },
    }).then(({ data, error }) => {
      if (!live) return;
      if (error) throw error;
      setSegments(Array.isArray(data?.segments) ? data.segments : []);
    }).catch(() => {
      if (live) setFeedback("Saved audiences are not available. Please check the CRM connection.");
    }).finally(() => { if (live) setBusy(""); });
    return () => { live = false; };
  }, [tenant?.id]);

  const resetPreview = () => {
    setPreview(null);
    setApproved(false);
    setFeedback("");
    requestKey.current = crypto.randomUUID();
  };

  async function previewAudience() {
    if (!segmentId || busy) return;
    setBusy("preview"); setFeedback(""); setApproved(false); setPreview(null);
    try {
      const { data, error } = await supabase.functions.invoke("queue-push-segment", {
        body: { action: "preview", segmentId },
      });
      if (error || !data?.audience) throw Error("Unable to preview audience");
      setPreview(data.audience as Preview);
    } catch {
      setFeedback("Audience preview failed. No push has been queued.");
    } finally { setBusy(""); }
  }

  async function queue() {
    if (!segmentId || !preview || !approved || preview.eligibleDevices < 1 ||
        preview.eligibleDevices > 250 || title.trim().length < 3 || busy) return;
    setBusy("queue"); setFeedback("");
    try {
      const { data, error } = await supabase.functions.invoke("queue-push-segment", {
        body: {
          action: "queue", segmentId, requestKey: requestKey.current,
          title: title.trim(), body, openPath: DEFAULT_OPEN_PATH,
          confirmed: true, audienceReviewed: true,
        },
      });
      if (error || data?.status !== "queued") throw Error("Queue disabled or unavailable");
      setFeedback(`Queued ${Number(data.queued || 0)} device notification(s). Delivery is tracked separately.`);
      requestKey.current = crypto.randomUUID();
      setApproved(false);
      setPreview(null);
    } catch {
      setFeedback("Push campaign was not queued. This feature may still be locked for the pilot. No automatic retries will send a message.");
    } finally { setBusy(""); }
  }

  return (
    <Sheet variant="outlined" sx={{ borderRadius: "lg", p: { xs: 2, md: 3 } }}>
      <Stack spacing={2}>
        <Stack direction="row" alignItems="center" gap={1}>
          <BellRing size={19} aria-hidden="true" />
          <Typography level="title-lg">Reach a saved audience with push</Typography>
        </Stack>
        <Typography level="body-sm">
          Preview a CRM segment, then send a store-branded notification to customers
          who installed your store app and explicitly opted in. Customers without
          valid consent or verified identity are excluded.
        </Typography>
        <FormControl>
          <FormLabel>Audience</FormLabel>
          <Select value={segmentId} placeholder="Choose a saved customer segment"
            disabled={Boolean(busy)}
            onChange={(_event, value) => { setSegmentId(value); resetPreview(); }}>
            {segments.map((segment) => (
              <Option key={segment.id} value={segment.id}>{segment.name}</Option>
            ))}
          </Select>
        </FormControl>
        <FormControl>
          <FormLabel>Notification title</FormLabel>
          <Input value={title} maxLength={120}
            onChange={(event) => { setTitle(event.target.value); resetPreview(); }}
            placeholder="Something special from your garden centre" />
        </FormControl>
        <FormControl>
          <FormLabel>Notification message</FormLabel>
          <Textarea minRows={2} maxRows={4} value={body}
            onChange={(event) => { setBody(event.target.value.slice(0,240)); resetPreview(); }}
            placeholder="Your exclusive offer is ready. Tap to view it." />
          <Typography level="body-xs">{body.length}/240 characters</Typography>
        </FormControl>
        <Typography level="body-xs" color="neutral">
          Link destination: My Offers on the customer's own garden centre website.
          No automatic email or SMS fallback is sent from this pilot.
        </Typography>
        <Button variant="outlined" color="neutral"
          disabled={!segmentId || Boolean(busy)}
          loading={busy === "preview"} onClick={() => void previewAudience()}>
          Preview eligible recipients
        </Button>
        {preview && (
          <Sheet variant="soft" sx={{ p: 2, borderRadius: "lg" }}>
            <Stack spacing={1}>
              <Typography level="title-md">Audience preview</Typography>
              <Typography level="body-md">
                {preview.eligibleCustomers} eligible customers, {preview.eligibleDevices} devices
              </Typography>
              <Typography level="body-sm" color="neutral">
                From {preview.segmentMembers} recorded segment members.
                {preview.excludedCustomers} excluded due to subscription, consent,
                or unverified account mapping.
              </Typography>
              {preview.eligibleDevices > 250 && (
                <Typography role="alert" color="danger">
                  The pilot has a 250-device cap. Narrow this audience first.
                </Typography>
              )}
              {preview.eligibleDevices === 0 && (
                <Typography role="status" color="neutral">
                  No customers can receive this notification yet. Enroll a test device first.
                </Typography>
              )}
            </Stack>
          </Sheet>
        )}
        {preview && preview.eligibleDevices > 0 && preview.eligibleDevices <= 250 && (
          <Checkbox checked={approved} onChange={(event) => setApproved(event.target.checked)}
            label="I reviewed this audience and confirm that this promotional push should be queued." />
        )}
        <Button disabled={!preview || !approved || preview.eligibleDevices < 1 ||
            preview.eligibleDevices > 250 || title.trim().length < 3 || Boolean(busy)}
          loading={busy === "queue"} onClick={() => void queue()}>
          Queue push campaign
        </Button>
        {feedback && <Typography role="status" level="body-sm">{feedback}</Typography>}
      </Stack>
    </Sheet>
  );
}
