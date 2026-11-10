import * as React from "react";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Sparkles } from "lucide-react";
import { JoyInput } from "@/components/joy/JoyInput";
import { supabase } from "@/integrations/supabase/client";
import type { StudioBlock } from "@/types/studioBlocks";
import {
  draftInboxSuggestion,
  inboxInsights,
  newsletterInboxText,
} from "@/lib/crm/newsletterInbox";

type Suggestion = { subject: string; preview: string; reason: string };
export function NewsletterInboxReview({
  blocks,
  subject,
  preview,
  onChange,
  disabled = false,
  campaignId,
}: {
  blocks: StudioBlock[];
  subject: string;
  preview: string;
  onChange: (fields: { subjectLine?: string; preheaderText?: string }) => void;
  disabled?: boolean;
  campaignId?: string | null;
}) {
  const lines = React.useMemo(() => newsletterInboxText(blocks), [blocks]);
  const context = lines.join("\n").slice(0, 10000);
  const starter = React.useMemo(() => draftInboxSuggestion(lines), [lines]);
  const seeded = React.useRef(false);
  const fingerprint = (value: string) => {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i++)
      hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
    return (hash >>> 0).toString(36);
  };
  const storageKey = campaignId
    ? `newsletter-inbox-review-v1:${campaignId}`
    : null;
  const [reviewedFingerprint, setReviewedFingerprint] = React.useState(() => {
    try {
      return storageKey ? sessionStorage.getItem(storageKey) : null;
    } catch {
      return null;
    }
  });
  const firstContext = React.useRef(context);
  const contentChanged = reviewedFingerprint
    ? reviewedFingerprint !== fingerprint(context)
    : firstContext.current !== context;
  const revision = React.useRef(context);
  revision.current = context;
  const [busy, setBusy] = React.useState(false);
  const [writeOwn, setWriteOwn] = React.useState(false);
  const autoAIRequested = React.useRef(false);
  const [suggestions, setSuggestions] = React.useState<Suggestion[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [suggestionContext, setSuggestionContext] = React.useState("");
  React.useEffect(() => {
    if (disabled || !context || seeded.current) return;
    seeded.current = true;
    const fields: { subjectLine?: string; preheaderText?: string } = {};
    if (!subject.trim()) fields.subjectLine = starter.subject;
    if (!preview.trim()) fields.preheaderText = starter.preview;
    if (Object.keys(fields).length) onChange(fields);
  }, [context, disabled, onChange, preview, starter, subject]);
  const improve = async () => {
    if (busy || !context) return;
    setBusy(true);
    setError(null);
    const requestedContext = context;
    try {
      const { data, error: requestError } = await supabase.functions.invoke(
        "generate-subject-lines",
        { body: { content: context, subject, previewText: preview } },
      );
      if (requestError || data?.success === false)
        throw requestError ?? new Error("Unavailable");
      if (revision.current !== requestedContext) return;
      const options = Array.isArray(data?.suggestions)
        ? data.suggestions
            .filter(
              (s: Suggestion) =>
                typeof s.subject === "string" &&
                typeof s.preview === "string" &&
                typeof s.reason === "string",
            )
            .slice(0, 3)
        : [];
      if (!options.length) throw new Error("No suggestions");
      const signature = fingerprint(requestedContext);
      setReviewedFingerprint(signature);
      try {
        if (storageKey) sessionStorage.setItem(storageKey, signature);
      } catch {
        /* Suggestions work without browser storage. */
      }
      setSuggestions(options);
      setSuggestionContext(requestedContext);
    } catch {
      setError(
        "Suggestions could not load. Your text is unchanged and you can keep editing. Try again when you’re ready.",
      );
    } finally {
      setBusy(false);
    }
  };
  React.useEffect(() => {
    if (disabled || !context || autoAIRequested.current || contentChanged)
      return;
    autoAIRequested.current = true;
    void improve();
    // One initial content scan; later improvements are explicitly requested.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context, disabled]);
  if (!context && !writeOwn && !subject.trim() && !preview.trim()) {
    return (
      <Stack spacing={1.5}>
        <Typography level="body-md">
          Design your newsletter first. We’ll suggest a subject and preview from
          its content when you return.
        </Typography>
        <Button
          variant="outlined"
          color="neutral"
          disabled={disabled}
          sx={{ alignSelf: "flex-start", minHeight: 44 }}
          onClick={() => setWriteOwn(true)}
        >
          Write my own
        </Button>
      </Stack>
    );
  }
  const tips = inboxInsights(subject, preview);
  const currentSuggestions = suggestionContext === context ? suggestions : [];
  return (
    <Stack spacing={2.5}>
      <Typography level="body-md" textColor="text.secondary">
        Now that your design is ready, choose how it appears in the inbox. We
        draft empty fields from your newsletter. You can edit every word.
      </Typography>
      {!context ? (
        <Typography level="body-sm">
          Add your newsletter content in Design Studio first. Suggestions will
          appear here when there is text to work with.
        </Typography>
      ) : null}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          gap: 2,
        }}
      >
        <JoyInput
          id="campaign-editor-subject"
          label="Subject line"
          value={subject}
          disabled={disabled}
          onValueChange={(value) => onChange({ subjectLine: value })}
          helperText={`${subject.length} characters · Aim for 40–60`}
        />
        <JoyInput
          label="Preview text"
          value={preview}
          disabled={disabled}
          onValueChange={(value) => onChange({ preheaderText: value })}
          helperText={`${preview.length} / 150 · Add a detail that complements the subject`}
        />
      </Box>
      <Box
        sx={{
          p: 2.5,
          border: "1px solid",
          borderColor: "neutral.200",
          borderRadius: "lg",
          bgcolor: "neutral.50",
        }}
      >
        <Typography level="body-xs" sx={{ color: "neutral.600", mb: 1 }}>
          INBOX PREVIEW
        </Typography>
        <Typography sx={{ fontWeight: 700 }}>
          {subject || "Your subject will appear here"}
        </Typography>
        <Typography level="body-sm" textColor="text.secondary">
          {preview || "Your preview text will appear here"}
        </Typography>
      </Box>
      {tips.length ? (
        <Stack spacing={0.75}>
          {tips.map((tip) => (
            <Typography level="body-sm" key={tip}>
              {tip}
            </Typography>
          ))}
        </Stack>
      ) : null}
      <Button
        variant="outlined"
        color="neutral"
        loading={busy}
        disabled={disabled || !context}
        onClick={() => void improve()}
        startDecorator={<Sparkles size={18} />}
        sx={{ alignSelf: "flex-start", minHeight: 44 }}
      >
        {contentChanged && suggestionContext !== context
          ? "Refresh suggestions from updated content"
          : "Help me improve this"}
      </Button>
      {contentChanged && suggestionContext !== context ? (
        <Typography role="status" level="body-sm">
          Your newsletter has changed. Refresh suggestions when you’re ready.
          Your subject and preview text are unchanged.
        </Typography>
      ) : null}
      {error ? (
        <Typography role="status" level="body-sm">
          {error}
        </Typography>
      ) : null}
      {currentSuggestions.length ? (
        <Stack spacing={1.5}>
          <Typography level="title-md">
            Suggested from your newsletter
          </Typography>
          {currentSuggestions.map((s, i) => (
            <Box
              key={i}
              sx={{
                p: 2.5,
                border: "1px solid",
                borderColor: "neutral.200",
                borderRadius: "lg",
                bgcolor: "background.surface",
              }}
            >
              <Stack spacing={1}>
                <Typography sx={{ fontWeight: 700 }}>{s.subject}</Typography>
                <Typography level="body-sm">{s.preview}</Typography>
                <Typography level="body-sm" textColor="text.secondary">
                  {s.reason}
                </Typography>
                <Button
                  variant="outlined"
                  color="neutral"
                  disabled={disabled}
                  sx={{ alignSelf: "flex-start" }}
                  onClick={() =>
                    onChange({
                      subjectLine: s.subject,
                      preheaderText: s.preview,
                    })
                  }
                >
                  Use this pair
                </Button>
              </Stack>
            </Box>
          ))}
        </Stack>
      ) : null}
    </Stack>
  );
}
