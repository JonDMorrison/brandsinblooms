import { useRef, useState } from "react";
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
import { bloomSupport, safeClientPageUrl } from "@/lib/bloomSupport/api";
import { MAX_PUBLIC_SUPPORT_BODY_LENGTH, MAX_SUPPORT_SUBJECT_LENGTH, SUPPORT_EMAIL } from "@/lib/bloomSupport/constants";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ minHeight: "100dvh", bgcolor: "background.level1", py: { xs: 3, md: 6 }, px: 2 }}>
      <Sheet variant="outlined" sx={{ maxWidth: 640, mx: "auto", p: { xs: 2, md: 3 }, borderRadius: "lg", overflowWrap: "anywhere" }}>
        <Typography level="title-sm" textColor="text.tertiary" sx={{ mb: 1 }}>Brands in Blooms · Bloom Support</Typography>
        {children}
      </Sheet>
    </Box>
  );
}

/** Support for people who cannot sign in (locked out, invite problems, no account yet). */
export function PublicSupportContact() {
  const [form, setForm] = useState({ name: "", email: "", product: "unknown", subject: "", body: "", website: "" });
  const [sent, setSent] = useState<{ number: number; email_delivery: "pending"; email: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const key = useRef(crypto.randomUUID());
  const pendingPayload = useRef<Record<string, unknown> | null>(null);
  const emailInput = useRef<HTMLInputElement>(null);
  const retryLocked = error !== null && pendingPayload.current !== null;
  const payloadLocked = busy || retryLocked;
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const payload = pendingPayload.current ?? {
        ...form,
        idempotency_key: key.current,
        page_url: safeClientPageUrl(),
      };
      pendingPayload.current = payload;
      const result = await bloomSupport.publicRequest(payload);
      setSent({ ...result, email: String(payload.email ?? "") });
    } catch (e) {
      setError(`${e instanceof Error ? e.message : "Could not send."} Your message is still here — try again, or email ${SUPPORT_EMAIL}.`);
    } finally {
      setBusy(false);
    }
  };

  const startNewRequest = () => {
    key.current = crypto.randomUUID();
    pendingPayload.current = null;
    setError(null);
    requestAnimationFrame(() => emailInput.current?.focus());
  };

  if (sent) {
    return (
      <Shell>
        <Stack role="status" aria-live="polite">
          <Typography level="h3">Thanks — we've got it (#{sent.number})</Typography>
          <Typography level="body-md" sx={{ mt: 1 }}>
            We'll try to email a tracking link to {sent.email}. We'll reply to that address, and you can follow progress from the link in that email.
          </Typography>
          <Typography level="body-sm" textColor="text.secondary" sx={{ mt: 1 }}>
            No email after a few minutes? Check your spam folder, or write to {SUPPORT_EMAIL}.
          </Typography>
        </Stack>
      </Shell>
    );
  }
  return (
    <Shell>
      <Typography level="h3">Can't sign in? Contact support</Typography>
      <Typography level="body-sm" textColor="text.secondary" sx={{ mb: 2 }}>For BloomSites, BloomSuite CRM and BloomSuite POS. Shoppers: please contact the garden centre directly.</Typography>
      <Stack component="form" spacing={1.5} onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        <FormControl required><FormLabel>Your email</FormLabel><Input type="email" value={form.email} onChange={set("email")} autoComplete="email" disabled={payloadLocked} slotProps={{ input: { maxLength: 320, ref: emailInput } }} /></FormControl>
        <FormControl><FormLabel>Your name</FormLabel><Input value={form.name} onChange={set("name")} autoComplete="name" disabled={payloadLocked} slotProps={{ input: { maxLength: 200 } }} /></FormControl>
        <FormControl><FormLabel>Product</FormLabel>
          <Select value={form.product} disabled={payloadLocked} onChange={(_, v) => v && setForm((f) => ({ ...f, product: v }))}>
            <Option value="unknown">Not sure</Option><Option value="cms">BloomSites (website)</Option><Option value="crm">BloomSuite CRM</Option><Option value="pos">BloomSuite POS</Option>
          </Select>
        </FormControl>
        <FormControl><FormLabel>Subject</FormLabel><Input value={form.subject} disabled={payloadLocked} slotProps={{ input: { maxLength: MAX_SUPPORT_SUBJECT_LENGTH } }} onChange={set("subject")} /><Typography level="body-xs" textColor="text.tertiary">{form.subject.length}/{MAX_SUPPORT_SUBJECT_LENGTH}</Typography></FormControl>
        <FormControl required><FormLabel>How can we help?</FormLabel><Textarea minRows={5} value={form.body} disabled={payloadLocked} slotProps={{ textarea: { maxLength: MAX_PUBLIC_SUPPORT_BODY_LENGTH, disabled: payloadLocked } }} onChange={set("body")} /><Typography level="body-xs" textColor="text.tertiary">{form.body.length.toLocaleString()}/{MAX_PUBLIC_SUPPORT_BODY_LENGTH.toLocaleString()}</Typography></FormControl>
        {/* Honeypot: hidden from people, filled by bots. */}
        <Box sx={{ position: "absolute", left: -10000, width: 1, height: 1, overflow: "hidden" }} aria-hidden>
          <label>Website<input tabIndex={-1} autoComplete="off" value={form.website} disabled={payloadLocked} onChange={set("website")} /></label>
        </Box>
        <Typography level="body-xs" textColor="text.tertiary">Never include passwords, card numbers or customer personal details.</Typography>
        {error && <Alert color="danger" role="alert">{error}</Alert>}
        {retryLocked && <Button type="button" variant="outlined" color="neutral" onClick={startNewRequest}>Edit and send as a new request</Button>}
        <Button type="submit" loading={busy} disabled={busy || !form.email || form.body.trim().length < 10}>{retryLocked ? "Retry same request" : "Send"}</Button>
      </Stack>
    </Shell>
  );
}

export default PublicSupportContact;
