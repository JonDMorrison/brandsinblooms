import * as React from "react";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Link from "@mui/joy/Link";
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

type Suggestion = { subject: string; preview: string };
// The inbox preview shows what a customer sees, so the first-name code is
// shown as an example name. The subject box keeps the real code.
const FIRST_NAME_TAG = /\{\{\s*first_name\s*\}\}/g;
function showSampleFirstName(text: string) {
  return text.replace(FIRST_NAME_TAG, "Jane");
}
function hasFirstNameTag(text: string) {
  return /\{\{\s*first_name\s*\}\}/.test(text);
}

export function NewsletterInboxReview({
  blocks,
  subject,
  preview,
  onChange,
  disabled = false,
  campaignId,
  senderName,
}: {
  blocks: StudioBlock[];
  subject: string;
  preview: string;
  onChange: (fields: { subjectLine?: string; preheaderText?: string }) => void;
  disabled?: boolean;
  campaignId?: string | null;
  /** Shown in the inbox row, as customers will see it. */
  senderName?: string;
}) {
  const inboxTime = React.useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(
        new Date(),
      ),
    [],
  );
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
                typeof s.preview === "string",
            )
            // Only the pair is shown; any explanation text is dropped.
            .map((s: Suggestion) => ({ subject: s.subject, preview: s.preview }))
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
  const subjectLength = subject.length;
  const subjectInRange = subjectLength >= 40 && subjectLength <= 60;
  const fromLabel = senderName?.trim() || "Your business";
  return (
    <Stack spacing={2.5}>
      <Typography level="body-md" textColor="text.secondary">
        Choose how your email appears in the inbox. We draft empty fields from
        your newsletter. You can edit every word.
      </Typography>
      {!context ? (
        <Typography level="body-sm">
          Add your newsletter content in Design Studio first. Suggestions will
          appear here when there is text to work with.
        </Typography>
      ) : null}
      <Stack spacing={1}>
        <JoyInput
          id="campaign-editor-subject"
          label="Subject line"
          value={subject}
          disabled={disabled}
          onValueChange={(value) => onChange({ subjectLine: value })}
          endDecorator={
            <Typography
              component="span"
              data-testid="subject-character-count"
              aria-hidden
              sx={{
                fontSize: 14,
                fontWeight: 600,
                color: subjectInRange ? "success.700" : "text.secondary",
              }}
            >
              {subjectLength}
            </Typography>
          }
          helperText={
            hasFirstNameTag(subject)
              ? `${subjectLength} characters · Aim for 40–60 · {{ first_name }} becomes each customer's first name`
              : `${subjectLength} characters · Aim for 40–60`
          }
        />
        {currentSuggestions.length ? (
          <Box data-testid="subject-suggestions">
            <Typography level="body-sm" sx={{ fontWeight: 700, mb: 0.5 }}>
              Bloom suggests
            </Typography>
            <Stack component="ul" spacing={0.5} sx={{ m: 0, p: 0, listStyle: "none" }}>
              {currentSuggestions.map((s, i) => (
                <Box component="li" key={i}>
                  <Link
                    component="button"
                    type="button"
                    disabled={disabled}
                    underline="none"
                    aria-label={`Use suggestion: ${s.subject}. Preview: ${s.preview}`}
                    onClick={() =>
                      onChange({
                        subjectLine: s.subject,
                        preheaderText: s.preview,
                      })
                    }
                    sx={{
                      minHeight: 44,
                      textAlign: "left",
                      fontSize: 16,
                      fontWeight: 600,
                      display: "inline-flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      justifyContent: "center",
                    }}
                  >
                    <Box
                      component="span"
                      sx={{ textDecoration: "underline", textUnderlineOffset: "3px" }}
                    >
                      {s.subject}
                    </Box>
                    <Typography
                      component="span"
                      level="body-sm"
                      textColor="text.secondary"
                      sx={{ fontWeight: 400 }}
                    >
                      {s.preview}
                    </Typography>
                  </Link>
                </Box>
              ))}
            </Stack>
          </Box>
        ) : null}
        <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
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
        </Stack>
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
      </Stack>
      <JoyInput
        label="Preview text"
        value={preview}
        disabled={disabled}
        onValueChange={(value) => onChange({ preheaderText: value })}
        helperText={`${preview.length} / 150 · Add a detail that complements the subject`}
      />
      <Box>
        <Typography level="body-sm" sx={{ fontWeight: 700, mb: 0.75 }}>
          Inbox preview
        </Typography>
        <Box
          data-testid="inbox-preview-row"
          sx={{
            display: "flex",
            gap: 1.5,
            alignItems: "flex-start",
            p: 1.75,
            border: "1px solid",
            borderColor: "neutral.200",
            borderRadius: "lg",
            bgcolor: "background.surface",
          }}
        >
          <Box
            aria-hidden
            sx={{
              width: 40,
              height: 40,
              flexShrink: 0,
              borderRadius: "50%",
              bgcolor: "primary.solidBg",
              color: "primary.solidColor",
              fontWeight: "xl",
              fontSize: "lg",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {fromLabel.charAt(0).toUpperCase()}
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="baseline">
              <Typography level="body-md" sx={{ fontWeight: "xl", color: "text.primary" }} noWrap>
                {fromLabel}
              </Typography>
              <Typography level="body-sm" textColor="text.secondary" sx={{ flexShrink: 0 }}>
                {inboxTime}
              </Typography>
            </Stack>
            <Typography level="body-md" sx={{ fontWeight: "xl", color: "text.primary" }} noWrap>
              {showSampleFirstName(subject) || "Your subject will appear here"}
            </Typography>
            <Typography level="body-sm" textColor="text.secondary" noWrap>
              {showSampleFirstName(preview) || "Your preview text will appear here"}
            </Typography>
          </Box>
        </Box>
        {hasFirstNameTag(subject) || hasFirstNameTag(preview) ? (
          <Typography level="body-xs" sx={{ color: "neutral.600", mt: 1 }}>
            "Jane" is an example. Each customer sees their own first name.
          </Typography>
        ) : null}
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
    </Stack>
  );
}
