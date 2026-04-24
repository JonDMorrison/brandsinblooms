import React, { useMemo, useState } from "react";
import Box from "@mui/joy/Box";
import Chip from "@mui/joy/Chip";
import Divider from "@mui/joy/Divider";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { MessageSquare } from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyTextarea } from "@/components/joy/JoyTextarea";

interface SMSNodeEditorProps {
  data: Record<string, any>;
  onSave: (data: Record<string, any>) => void;
  onCancel: () => void;
}

const MERGE_TAGS = [
  "{{first_name}}",
  "{{last_name}}",
  "{{email}}",
  "{{phone}}",
];

export const SMSNodeEditor: React.FC<SMSNodeEditorProps> = ({
  data,
  onSave,
  onCancel,
}) => {
  const [message, setMessage] = useState(data.message || data.content || "");
  const characterCount = message.length;
  const segmentCount = Math.max(
    1,
    Math.ceil(Math.max(characterCount, 1) / 160),
  );
  const helperText = useMemo(() => {
    if (characterCount <= 160) {
      return `${characterCount}/160 characters`;
    }

    return `${characterCount} characters across ${segmentCount} SMS segments`;
  }, [characterCount, segmentCount]);

  const insertMergeTag = (tag: string) => {
    setMessage((current) => `${current}${current ? " " : ""}${tag}`);
  };

  const handleSave = () => {
    onSave({
      ...data,
      message,
      content: message,
      characterCount,
    });
  };

  return (
    <Stack spacing={2} sx={{ p: 2 }}>
      <Sheet variant="soft" color="neutral" sx={{ p: 1.5, borderRadius: "lg" }}>
        <Stack direction="row" spacing={1.25} alignItems="flex-start">
          <MessageSquare size={16} />
          <Box>
            <Typography level="title-sm">SMS content</Typography>
            <Typography level="body-sm" sx={{ color: "neutral.600", mt: 0.25 }}>
              Keep the copy tight and actionable. The builder now saves both
              legacy and current SMS fields from one editor.
            </Typography>
          </Box>
        </Stack>
      </Sheet>

      <JoyTextarea
        label="Message"
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        minRows={6}
        placeholder="Hi {{first_name}}, your order is ready for pickup."
        helperText={helperText}
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

      <Divider />

      <Stack direction="row" spacing={1} justifyContent="flex-end">
        <JoyButton variant="outlined" color="neutral" onClick={onCancel}>
          Cancel
        </JoyButton>
        <JoyButton onClick={handleSave}>Save changes</JoyButton>
      </Stack>
    </Stack>
  );
};
