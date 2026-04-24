import React, { useMemo, useState } from "react";
import Box from "@mui/joy/Box";
import Card from "@mui/joy/Card";
import Chip from "@mui/joy/Chip";
import Divider from "@mui/joy/Divider";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Eye, Mail, Sparkles } from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyInput } from "@/components/joy/JoyInput";
import { JoySelect } from "@/components/joy/JoySelect";
import { JoyTextarea } from "@/components/joy/JoyTextarea";

interface EmailNodeData {
  subject: string;
  content: string;
  body?: string;
  template?: string;
  delay?: string;
  imageUrl?: string;
}

interface EmailNodeEditorProps {
  data: EmailNodeData;
  nodeId?: string;
  automationId?: string;
  onSave: (data: EmailNodeData) => void;
  onCancel: () => void;
}

const templates = [
  {
    value: "welcome",
    label: "Welcome",
    subject: "Welcome to Brands in Blooms, {{first_name}}",
    content:
      "We are glad you are here. Here are three quick ways to get more from your next visit...",
  },
  {
    value: "promotion",
    label: "Promotion",
    subject: "A fresh offer for your next visit",
    content:
      "This week we picked a few customer favorites and bundled them into an easy seasonal offer...",
  },
  {
    value: "followup",
    label: "Follow-up",
    subject: "How did everything go?",
    content:
      "Thanks again for shopping with us. If you need help with care, setup, or your next pick, reply to this email...",
  },
];

const MERGE_TAGS = [
  "{{first_name}}",
  "{{last_name}}",
  "{{email}}",
  "{{phone}}",
];
const DELAY_OPTIONS = [
  { value: "Immediate", label: "Immediate" },
  { value: "30 minutes", label: "30 minutes" },
  { value: "2 hours", label: "2 hours" },
  { value: "1 day", label: "1 day" },
  { value: "3 days", label: "3 days" },
];

export const EmailNodeEditor: React.FC<EmailNodeEditorProps> = ({
  data,
  onSave,
  onCancel,
}) => {
  const [subject, setSubject] = useState(data.subject || "");
  const [content, setContent] = useState(data.content || data.body || "");
  const [template, setTemplate] = useState(data.template || "");
  const [delay, setDelay] = useState(data.delay || "Immediate");
  const [imageUrl, setImageUrl] = useState(data.imageUrl || "");
  const previewText = useMemo(
    () =>
      content
        .replaceAll("{{first_name}}", "Avery")
        .replaceAll("{{last_name}}", "Green")
        .replaceAll("{{email}}", "avery@example.com")
        .replaceAll("{{phone}}", "+1 555 0100"),
    [content],
  );

  const applyTemplate = (templateValue: string) => {
    const selectedTemplate = templates.find(
      (entry) => entry.value === templateValue,
    );
    setTemplate(templateValue);

    if (selectedTemplate) {
      setSubject(selectedTemplate.subject);
      setContent(selectedTemplate.content);
    }
  };

  const insertMergeTag = (tag: string) => {
    setContent((current) => `${current}${current ? " " : ""}${tag}`);
  };

  const suggestSubject = () => {
    const firstSentence = content
      .split(/[.!?]/)
      .find((value) => value.trim().length > 0)
      ?.trim();
    if (firstSentence) {
      setSubject(firstSentence.slice(0, 68));
      return;
    }

    setSubject("A quick update from Brands in Blooms");
  };

  const handleSave = () => {
    onSave({
      ...data,
      subject,
      content,
      body: content,
      template,
      delay,
      imageUrl,
    });
  };

  return (
    <Stack spacing={2} sx={{ p: 2 }}>
      <Sheet variant="soft" color="neutral" sx={{ p: 1.5, borderRadius: "lg" }}>
        <Stack direction="row" spacing={1.25} alignItems="flex-start">
          <Mail size={16} />
          <Stack spacing={0.5}>
            <Typography level="title-sm">Email content</Typography>
            <Typography level="body-sm" sx={{ color: "neutral.600" }}>
              Configure the subject, body, template preset, and delay from one
              properties rail.
            </Typography>
          </Stack>
        </Stack>
      </Sheet>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
        <JoyInput
          label="Subject"
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          placeholder="Welcome to Brands in Blooms"
          error={!subject.trim()}
          errorMessage={!subject.trim() ? "Subject is required" : undefined}
        />
        <JoyButton
          variant="outlined"
          color="neutral"
          onClick={suggestSubject}
          sx={{ alignSelf: "flex-end", minWidth: 148 }}
        >
          Suggest subject
        </JoyButton>
      </Stack>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
        <JoySelect
          label="Template"
          value={template}
          options={[
            { value: "", label: "Custom" },
            ...templates.map((entry) => ({
              value: entry.value,
              label: entry.label,
            })),
          ]}
          onChange={(_event, value) => applyTemplate(value ?? "")}
        />
        <JoySelect
          label="Send delay"
          value={delay}
          options={DELAY_OPTIONS}
          onChange={(_event, value) => setDelay(value ?? "Immediate")}
        />
      </Stack>

      <JoyInput
        label="Optional hero image URL"
        value={imageUrl}
        onChange={(event) => setImageUrl(event.target.value)}
        placeholder="https://..."
      />

      <JoyTextarea
        label="Body"
        value={content}
        onChange={(event) => setContent(event.target.value)}
        minRows={10}
        placeholder="Write the email body here..."
        error={!content.trim()}
        errorMessage={!content.trim() ? "Email content is required" : undefined}
      />

      <Stack spacing={0.75}>
        <Typography
          level="body-xs"
          sx={{
            color: "neutral.500",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          Merge tags
        </Typography>
        <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
          {MERGE_TAGS.map((tag) => (
            <Chip
              key={tag}
              variant="outlined"
              color="neutral"
              onClick={() => insertMergeTag(tag)}
              sx={{ cursor: "pointer" }}
            >
              {tag}
            </Chip>
          ))}
        </Stack>
      </Stack>

      <Sheet variant="outlined" sx={{ p: 1.5, borderRadius: "lg" }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Eye size={15} />
          <Typography level="title-sm">Live preview</Typography>
        </Stack>
        <Card variant="soft" sx={{ mt: 1, p: 1.5, gap: 1 }}>
          <Typography level="title-sm">
            {subject || "Subject preview"}
          </Typography>
          <Typography
            level="body-sm"
            sx={{ color: "neutral.700", whiteSpace: "pre-wrap" }}
          >
            {previewText || "Preview updates as you type."}
          </Typography>
          {imageUrl ? (
            <Typography level="body-xs" sx={{ color: "neutral.500" }}>
              Hero image attached
            </Typography>
          ) : null}
        </Card>
      </Sheet>

      <Divider />

      <Stack
        direction="row"
        spacing={1}
        justifyContent="space-between"
        alignItems="center"
      >
        <Chip
          variant="soft"
          color="neutral"
          startDecorator={<Sparkles size={14} />}
        >
          Template presets and merge tags are saved with this node
        </Chip>
        <Stack direction="row" spacing={1}>
          <JoyButton variant="outlined" color="neutral" onClick={onCancel}>
            Cancel
          </JoyButton>
          <JoyButton
            onClick={handleSave}
            disabled={!subject.trim() || !content.trim()}
          >
            Save changes
          </JoyButton>
        </Stack>
      </Stack>
    </Stack>
  );
};
