import { useRef, useState } from "react";
import Modal from "@mui/joy/Modal";
import ModalDialog from "@mui/joy/ModalDialog";
import ModalClose from "@mui/joy/ModalClose";
import Typography from "@mui/joy/Typography";
import Textarea from "@mui/joy/Textarea";
import Input from "@mui/joy/Input";
import FormControl from "@mui/joy/FormControl";
import FormLabel from "@mui/joy/FormLabel";
import FormHelperText from "@mui/joy/FormHelperText";
import Stack from "@mui/joy/Stack";
import Button from "@mui/joy/Button";
import IconButton from "@mui/joy/IconButton";
import Alert from "@mui/joy/Alert";
import Chip from "@mui/joy/Chip";
import Link from "@mui/joy/Link";
import { CheckCircle2, ImagePlus, X } from "lucide-react";
import { bloomSupport, captureClientContext, fileToUpload } from "@/lib/bloomSupport/api";
import {
  ATTACHMENT_ACCEPT,
  MAX_ATTACHMENTS,
  MAX_SUPPORT_BODY_LENGTH,
  MAX_SUPPORT_SUBJECT_LENGTH,
  SUPPORT_EMAIL,
  checkAttachments,
  safeSupportTrackingUrl,
} from "@/lib/bloomSupport/constants";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Optional record references (e.g. campaign id) from the screen the user is on. */
  recordRefs?: Record<string, string>;
}

type ReportPayload = Parameters<typeof bloomSupport.report>[0];

/**
 * One box for bugs, questions and requests: Bloom classifies it, so the user
 * never has to pick a category. Page, browser and version are attached
 * automatically; no credentials or payment details are captured.
 */
export function ReportProblemDialog({ open, onClose, recordRefs }: Props) {
  const [body, setBody] = useState("");
  const [subject, setSubject] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [result, setResult] = useState<{ number: number; tracking_url?: string; notAttached: string[] } | null>(null);
  const [pickWarnings, setPickWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const key = useRef<string>(crypto.randomUUID());
  const pendingPayload = useRef<ReportPayload | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const messageInput = useRef<HTMLTextAreaElement>(null);
  const trackingUrl = safeSupportTrackingUrl(result?.tracking_url);
  const retryLocked = state === "error" && pendingPayload.current !== null;
  const payloadLocked = state === "sending" || retryLocked;

  const reset = () => {
    setBody("");
    setSubject("");
    setFiles([]);
    setState("idle");
    setResult(null);
    setError(null);
    setPickWarnings([]);
    key.current = crypto.randomUUID();
    pendingPayload.current = null;
  };

  const startNewRequest = () => {
    key.current = crypto.randomUUID();
    pendingPayload.current = null;
    setError(null);
    setState("idle");
    requestAnimationFrame(() => messageInput.current?.focus());
  };

  const submit = async () => {
    setState("sending");
    setError(null);
    try {
      let payload = pendingPayload.current;
      if (!payload) {
        const attachments = await Promise.all(files.slice(0, MAX_ATTACHMENTS).map(fileToUpload));
        payload = {
          body,
          subject: subject || undefined,
          product: "crm",
          context: captureClientContext(recordRefs ? { record_refs: recordRefs } : {}),
          attachments,
          idempotency_key: key.current,
        };
        // A retry must be byte-for-byte the first request. Volatile browser
        // context (online status, viewport, app version) is intentionally
        // captured once per idempotency key.
        pendingPayload.current = payload;
      }
      const r = await bloomSupport.report(payload);
      if (r.attachments.stored + r.attachments.failed.length !== files.length) {
        throw new Error("Bloom Support could not confirm every selected attachment.");
      }
      // Files the server could not store are named, so the person can send them another way.
      setResult({ number: r.number, tracking_url: r.tracking_url, notAttached: r.attachments.failed });
      setState("sent");
    } catch (e) {
      // The text and its idempotency key are kept, so retrying can never create a duplicate.
      setError(`${e instanceof Error ? e.message : "Something went wrong."} Your message is still here — try again, or email ${SUPPORT_EMAIL}.`);
      setState("error");
    }
  };

  return (
    <Modal open={open} onClose={() => { if (payloadLocked) return; onClose(); if (state === "sent") reset(); }}>
      <ModalDialog sx={{ width: "min(560px, 96vw)", maxHeight: "calc(100dvh - 2rem)", overflowY: "auto" }} aria-labelledby="bloom-report-title">
        <ModalClose aria-label="Close support request" disabled={payloadLocked} />
        {state === "sent" && result ? (
          <Stack spacing={2} alignItems="flex-start" role="status" aria-live="polite">
            <CheckCircle2 size={28} color="var(--joy-palette-success-500)" aria-hidden />
            <Typography id="bloom-report-title" level="title-lg">Received by Bloom — request #{result.number}</Typography>
            <Typography level="body-sm">
              We'll reply by email and you can follow progress any time from Help &amp; Support{trackingUrl ? " or this link." : "."}
            </Typography>
            {trackingUrl && (
              <Link href={trackingUrl} level="body-sm">
                View request status
              </Link>
            )}
            {result.notAttached.length > 0 && (
              <Alert color="warning" variant="soft" role="alert">
                <div>
                  <Typography level="body-sm" fontWeight="md">These files were not attached:</Typography>
                  {result.notAttached.map((line) => <Typography key={line} level="body-xs" sx={{ overflowWrap: "anywhere" }}>{line}</Typography>)}
                  <Typography level="body-xs">Reply to Bloom's email with them attached, or email {SUPPORT_EMAIL}.</Typography>
                </div>
              </Alert>
            )}
            <Button onClick={() => { reset(); onClose(); }}>Done</Button>
          </Stack>
        ) : (
          <Stack spacing={2}>
            <div>
              <Typography id="bloom-report-title" level="title-lg">Get help</Typography>
              <Typography level="body-sm" textColor="text.secondary">
                Report a problem, ask a question or request a change. No need to pick a category.
              </Typography>
            </div>
            <FormControl required>
              <FormLabel>What's happening?</FormLabel>
              <Textarea minRows={5} maxRows={12} value={body} onChange={(e) => setBody(e.target.value)} disabled={payloadLocked}
                slotProps={{ textarea: { maxLength: MAX_SUPPORT_BODY_LENGTH, ref: messageInput, disabled: payloadLocked } }}
                placeholder="What were you doing, what happened, and what did you expect?" autoFocus />
              <FormHelperText sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>
                <span>Please don't include passwords, card numbers or customer personal details.</span>
                <span>{body.length.toLocaleString()}/{MAX_SUPPORT_BODY_LENGTH.toLocaleString()}</span>
              </FormHelperText>
            </FormControl>
            <FormControl>
              <FormLabel>Short title (optional)</FormLabel>
              <Input value={subject} slotProps={{ input: { maxLength: MAX_SUPPORT_SUBJECT_LENGTH } }} onChange={(e) => setSubject(e.target.value)} disabled={payloadLocked} />
              <FormHelperText>{subject.length}/{MAX_SUPPORT_SUBJECT_LENGTH}</FormHelperText>
            </FormControl>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
              <Button variant="outlined" color="neutral" size="sm" startDecorator={<ImagePlus size={16} />}
                disabled={payloadLocked || files.length >= MAX_ATTACHMENTS} onClick={() => fileInput.current?.click()}>
                Add attachment
              </Button>
              <Typography level="body-xs" textColor="text.tertiary">
                Up to 5 files, 8 MB each and 12 MB total.
              </Typography>
              <input ref={fileInput} type="file" hidden multiple disabled={payloadLocked} accept={ATTACHMENT_ACCEPT}
                onChange={(e) => {
                  const { accepted, rejected } = checkAttachments([...files, ...Array.from(e.target.files ?? [])]);
                  setFiles(accepted);
                  setPickWarnings(rejected);
                  e.target.value = "";
                }} />
              {files.map((f, i) => (
                <Chip key={`${f.name}-${i}`} size="sm" variant="soft" title={f.name} sx={{ maxWidth: "100%" }} endDecorator={
                  <IconButton
                    type="button"
                    size="sm"
                    variant="plain"
                    color="neutral"
                    aria-label={`Remove ${f.name}`}
                    disabled={payloadLocked}
                    onClick={() => setFiles((all) => all.filter((_, j) => j !== i))}
                    sx={{ minWidth: 24, minHeight: 24, p: 0 }}
                  >
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
            <Typography level="body-xs" textColor="text.tertiary">
              We'll include this page's address, your browser and the app version to help us investigate.
            </Typography>
            {error && <Alert color="danger" variant="soft" role="alert" sx={{ overflowWrap: "anywhere" }}>{error}</Alert>}
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="flex-end" sx={{ "& > button": { width: { xs: "100%", sm: "auto" } } }}>
              <Button variant="plain" color="neutral" disabled={payloadLocked} onClick={onClose}>Cancel</Button>
              {retryLocked && <Button variant="outlined" color="neutral" onClick={startNewRequest}>Edit and send as new request</Button>}
              <Button loading={state === "sending"} disabled={state === "sending" || body.trim().length < 10} onClick={submit}>{retryLocked ? "Retry same request" : "Send to Bloom"}</Button>
            </Stack>
          </Stack>
        )}
      </ModalDialog>
    </Modal>
  );
}

export default ReportProblemDialog;
