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
import Alert from "@mui/joy/Alert";
import Chip from "@mui/joy/Chip";
import { CheckCircle2, ImagePlus, X } from "lucide-react";
import { bloomSupport, captureClientContext, fileToUpload } from "@/lib/bloomSupport/api";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Optional record references (e.g. campaign id) from the screen the user is on. */
  recordRefs?: Record<string, string>;
}

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
  const [result, setResult] = useState<{ number: number; tracking_url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const key = useRef<string>(crypto.randomUUID());
  const fileInput = useRef<HTMLInputElement>(null);

  const reset = () => {
    setBody("");
    setSubject("");
    setFiles([]);
    setState("idle");
    setResult(null);
    setError(null);
    key.current = crypto.randomUUID();
  };

  const submit = async () => {
    setState("sending");
    setError(null);
    try {
      const attachments = await Promise.all(files.slice(0, 5).map(fileToUpload));
      const r = await bloomSupport.report({
        body,
        subject: subject || undefined,
        product: "crm",
        context: captureClientContext(recordRefs ? { record_refs: recordRefs } : {}),
        attachments,
        idempotency_key: key.current,
      });
      setResult({ number: r.number, tracking_url: r.tracking_url });
      setState("sent");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      setState("error");
    }
  };

  return (
    <Modal open={open} onClose={() => { onClose(); if (state === "sent") reset(); }}>
      <ModalDialog sx={{ width: "min(560px, 96vw)" }} aria-labelledby="bloom-report-title">
        <ModalClose />
        {state === "sent" && result ? (
          <Stack spacing={2} alignItems="flex-start">
            <CheckCircle2 size={28} color="var(--joy-palette-success-500)" aria-hidden />
            <Typography id="bloom-report-title" level="title-lg">Received by Bloom — request #{result.number}</Typography>
            <Typography level="body-sm">
              We'll reply by email and you can follow progress any time from Help &amp; Support or this link.
            </Typography>
            <Typography level="body-xs" sx={{ wordBreak: "break-all" }}>{result.tracking_url}</Typography>
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
              <Textarea minRows={5} maxRows={12} value={body} onChange={(e) => setBody(e.target.value)}
                placeholder="What were you doing, what happened, and what did you expect?" autoFocus />
              <FormHelperText>Please don't include passwords or card numbers.</FormHelperText>
            </FormControl>
            <FormControl>
              <FormLabel>Short title (optional)</FormLabel>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </FormControl>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
              <Button variant="outlined" color="neutral" size="sm" startDecorator={<ImagePlus size={16} />} onClick={() => fileInput.current?.click()}>
                Add screenshot
              </Button>
              <input ref={fileInput} type="file" hidden multiple accept="image/*,application/pdf,video/mp4,video/webm,text/plain"
                onChange={(e) => setFiles((f) => [...f, ...Array.from(e.target.files ?? [])].slice(0, 5))} />
              {files.map((f, i) => (
                <Chip key={`${f.name}-${i}`} size="sm" variant="soft" endDecorator={
                  <X size={12} role="button" aria-label={`Remove ${f.name}`} style={{ cursor: "pointer" }} onClick={() => setFiles((all) => all.filter((_, j) => j !== i))} />
                }>{f.name}</Chip>
              ))}
            </Stack>
            <Typography level="body-xs" textColor="text.tertiary">
              We'll include this page's address, your browser and the app version to help us investigate.
            </Typography>
            {error && <Alert color="danger" variant="soft">{error}</Alert>}
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button variant="plain" color="neutral" onClick={onClose}>Cancel</Button>
              <Button loading={state === "sending"} disabled={body.trim().length < 10} onClick={submit}>Send to Bloom</Button>
            </Stack>
          </Stack>
        )}
      </ModalDialog>
    </Modal>
  );
}

export default ReportProblemDialog;
