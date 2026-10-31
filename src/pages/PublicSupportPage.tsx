import { useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Box from "@mui/joy/Box";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import Input from "@mui/joy/Input";
import Textarea from "@mui/joy/Textarea";
import Select from "@mui/joy/Select";
import Option from "@mui/joy/Option";
import Button from "@mui/joy/Button";
import FormControl from "@mui/joy/FormControl";
import FormLabel from "@mui/joy/FormLabel";
import Alert from "@mui/joy/Alert";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import { formatDistanceToNow } from "date-fns";
import { bloomSupport, STATUS_LABEL } from "@/lib/bloomSupport/api";
import { StatusChip } from "@/components/bloomSupport/chips";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ minHeight: "100dvh", bgcolor: "background.level1", py: { xs: 3, md: 6 }, px: 2 }}>
      <Sheet variant="outlined" sx={{ maxWidth: 640, mx: "auto", p: { xs: 2, md: 3 }, borderRadius: "lg" }}>
        <Typography level="title-sm" textColor="text.tertiary" sx={{ mb: 1 }}>Brands in Blooms · Bloom Support</Typography>
        {children}
      </Sheet>
    </Box>
  );
}

/** Support for people who cannot sign in (locked out, invite problems, no account yet). */
export function PublicSupportContact() {
  const [form, setForm] = useState({ name: "", email: "", product: "unknown", subject: "", body: "", website: "" });
  const [sent, setSent] = useState<{ number?: number; tracking_url?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const key = useRef(crypto.randomUUID());
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      setSent(await bloomSupport.publicRequest({ ...form, idempotency_key: key.current, page_url: typeof window !== "undefined" ? window.location.href : undefined }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send");
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <Shell>
        <Typography level="h3">Thanks — we've got it{sent.number ? ` (#${sent.number})` : ""}</Typography>
        <Typography level="body-md" sx={{ mt: 1 }}>We'll reply to {form.email}. You can check progress any time:</Typography>
        {sent.tracking_url && <Typography level="body-sm" sx={{ mt: 1, wordBreak: "break-all" }}><a href={sent.tracking_url}>{sent.tracking_url}</a></Typography>}
      </Shell>
    );
  }
  return (
    <Shell>
      <Typography level="h3">Can't sign in? Contact support</Typography>
      <Typography level="body-sm" textColor="text.secondary" sx={{ mb: 2 }}>For BloomSites, BloomSuite CRM and BloomSuite POS. Shoppers: please contact the garden centre directly.</Typography>
      <Stack spacing={1.5}>
        <FormControl required><FormLabel>Your email</FormLabel><Input type="email" value={form.email} onChange={set("email")} autoComplete="email" /></FormControl>
        <FormControl><FormLabel>Your name</FormLabel><Input value={form.name} onChange={set("name")} autoComplete="name" /></FormControl>
        <FormControl><FormLabel>Product</FormLabel>
          <Select value={form.product} onChange={(_, v) => v && setForm((f) => ({ ...f, product: v }))}>
            <Option value="unknown">Not sure</Option><Option value="cms">BloomSites (website)</Option><Option value="crm">BloomSuite CRM</Option><Option value="pos">BloomSuite POS</Option>
          </Select>
        </FormControl>
        <FormControl><FormLabel>Subject</FormLabel><Input value={form.subject} onChange={set("subject")} /></FormControl>
        <FormControl required><FormLabel>How can we help?</FormLabel><Textarea minRows={5} value={form.body} onChange={set("body")} /></FormControl>
        {/* Honeypot: hidden from people, filled by bots. */}
        <Box sx={{ position: "absolute", left: -10000, width: 1, height: 1, overflow: "hidden" }} aria-hidden>
          <label>Website<input tabIndex={-1} autoComplete="off" value={form.website} onChange={set("website")} /></label>
        </Box>
        <Typography level="body-xs" textColor="text.tertiary">Never include passwords or card numbers.</Typography>
        {error && <Alert color="danger">{error}</Alert>}
        <Button loading={busy} disabled={!form.email || form.body.trim().length < 10} onClick={submit}>Send</Button>
      </Stack>
    </Shell>
  );
}

/** Read-only tracking page from the link in Bloom's emails (one ticket per link). */
export function PublicSupportTrack() {
  const { token = "" } = useParams();
  const q = useQuery({ queryKey: ["bloom-support", "track", token], queryFn: () => bloomSupport.track(token), retry: false });
  return (
    <Shell>
      {q.isLoading && <Skeleton variant="rectangular" height={200} />}
      {q.error && <Alert color="warning">{(q.error as Error).message}</Alert>}
      {q.data && (
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1} alignItems="center"><Typography level="body-sm">Request #{q.data.number}</Typography><StatusChip status={q.data.status} /></Stack>
          <Typography level="h3">{q.data.subject}</Typography>
          <Typography level="body-sm" textColor="text.secondary">Status: {STATUS_LABEL[q.data.status]} · updated {formatDistanceToNow(new Date(q.data.updated_at), { addSuffix: true })}</Typography>
          {q.data.resolution_summary && q.data.status === "resolved" && <Alert color="success" variant="soft">{q.data.resolution_summary}</Alert>}
          {q.data.messages.map((m, i) => (
            <Sheet key={i} variant={m.from === "you" ? "soft" : "outlined"} sx={{ p: 1.5, borderRadius: "md" }}>
              <Typography level="body-xs" fontWeight="lg">{m.from === "you" ? "You" : m.from} · {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}</Typography>
              <Typography level="body-sm" sx={{ whiteSpace: "pre-wrap" }}>{m.body}</Typography>
            </Sheet>
          ))}
          <Typography level="body-xs" textColor="text.tertiary">To add something, reply to any email about this request.</Typography>
        </Stack>
      )}
    </Shell>
  );
}

export default PublicSupportContact;
