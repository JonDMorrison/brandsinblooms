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
import Chip from "@mui/joy/Chip";
import IconButton from "@mui/joy/IconButton";
import { ImagePlus, X } from "lucide-react";
import { bloomSupport, fileToUpload, safeClientPageUrl } from "@/lib/bloomSupport/api";
import {
  ATTACHMENT_ACCEPT,
  MAX_ATTACHMENTS,
  MAX_PUBLIC_SUPPORT_BODY_LENGTH,
  MAX_SUPPORT_SUBJECT_LENGTH,
  SUPPORT_EMAIL,
  checkAttachments,
} from "@/lib/bloomSupport/constants";

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
  const [sent, setSent] = useState<{ number: number; email_delivery: "pending"; email: string; notAttached: string[] } | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [pickWarnings, setPickWarnings] = useState<string[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
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
      // A retry resends exactly the first payload, files included, so it can never create a second request.
      const payload = pendingPayload.current ?? {
        ...form,
        idempotency_key: key.current,
        page_url: safeClientPageUrl(),
        ...(files.length ? { attachments: await Promise.all(files.slice(0, MAX_ATTACHMENTS).map(fileToUpload)) } : {}),
      };
      pendingPayload.current = payload;
      const result = await bloomSupport.publicRequest(payload);
      const sentFiles = Array.isArray(payload.attachments) ? payload.attachments.length : 0;
      if (sentFiles > 0 && (!result.attachments || result.attachments.stored + result.attachments.failed.length !== sentFiles)) {
        throw new Error("Bloom Support could not confirm every attached file.");
      }
      setSent({ number: result.number, email_delivery: result.email_delivery, email: String(payload.email ?? ""), notAttached: result.attachments?.failed ?? [] });
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
          {sent.notAttached.length > 0 && (
            <Alert color="warning" variant="soft" sx={{ mt: 2 }}>
              <div>
                <Typography level="body-sm" fontWeight="md">These files were not attached:</Typography>
                {sent.notAttached.map((line) => <Typography key={line} level="body-xs" sx={{ overflowWrap: "anywhere" }}>{line}</Typography>)}
                <Typography level="body-xs">Reply to our email with them attached, or email {SUPPORT_EMAIL}.</Typography>
              </div>
            </Alert>
          )}
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
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
          <Button type="button" variant="outlined" color="neutral" size="sm" startDecorator={<ImagePlus size={16} />}
            disabled={payloadLocked || files.length >= MAX_ATTACHMENTS} onClick={() => fileInput.current?.click()}>
            Attach screenshot
          </Button>
          <Typography level="body-xs" textColor="text.tertiary">Optional. Up to 5 files, 8 MB each and 12 MB total.</Typography>
          <input ref={fileInput} type="file" hidden multiple disabled={payloadLocked} accept={ATTACHMENT_ACCEPT} data-testid="public-support-files"
            onChange={(e) => {
              const { accepted, rejected } = checkAttachments([...files, ...Array.from(e.target.files ?? [])]);
              setFiles(accepted);
              setPickWarnings(rejected);
              e.target.value = "";
            }} />
          {files.map((f, i) => (
            <Chip key={`${f.name}-${i}`} size="sm" variant="soft" title={f.name} sx={{ maxWidth: "100%" }} endDecorator={
              <IconButton type="button" size="sm" variant="plain" color="neutral" aria-label={`Remove ${f.name}`} disabled={payloadLocked}
                onClick={() => setFiles((all) => all.filter((_, j) => j !== i))} sx={{ minWidth: 24, minHeight: 24, p: 0 }}>
                <X size={12} aria-hidden />
              </IconButton>
            }>{f.name}</Chip>
          ))}
        </Stack>
        {pickWarnings.length > 0 && (
          <Alert color="warning" variant="soft" role="alert">
            <div>{pickWarnings.map((line) => <Typography key={line} level="body-xs" sx={{ overflowWrap: "anywhere" }}>{line}</Typography>)}</div>
          </Alert>
        )}
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
