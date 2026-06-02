import * as React from "react";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyTextarea } from "@/components/joy/JoyTextarea";
import type { BloomMessage } from "@/hooks/bloom/types";

interface BloomUserMessageEditProps {
  message: BloomMessage;
  onSave: (newText: string) => void | Promise<void>;
  onCancel: () => void;
}

export function BloomUserMessageEdit({
  message,
  onCancel,
  onSave,
}: BloomUserMessageEditProps) {
  const [value, setValue] = React.useState(message.text);
  const [saving, setSaving] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const trimmedValue = value.trim();
  const saveDisabled = saving || !trimmedValue;

  React.useEffect(() => {
    textareaRef.current?.focus();
    textareaRef.current?.select();
  }, []);

  const save = async () => {
    if (saveDisabled) {
      return;
    }

    setSaving(true);
    try {
      await onSave(trimmedValue);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      variant="plain"
      sx={{
        width: "100%",
        p: 1.25,
        borderRadius: "16px 16px 4px 16px",
        backgroundColor: "neutral.900",
        color: "common.white",
        boxShadow: "var(--joy-shadow-md)",
      }}
    >
      <Stack spacing={1}>
        <JoyTextarea
          ref={textareaRef}
          aria-label="Edit message"
          minRows={2}
          maxRows={8}
          value={value}
          disabled={saving}
          onValueChange={setValue}
          onKeyDown={(event: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (event.key === "Escape") {
              event.preventDefault();
              onCancel();
              return;
            }

            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void save();
            }
          }}
          sx={{
            minHeight: 160,
            borderRadius: "16px 16px 4px 16px",
            "--Textarea-paddingBlock": "0.875rem",
            "--Textarea-paddingInline": "0.875rem",
            backgroundColor: "neutral.900",
            borderColor: "primary.500",
            color: "common.white",
            boxShadow:
              "0 0 0 1px var(--joy-palette-primary-500), 0 0 0 4px rgba(var(--joy-palette-primary-mainChannel) / 0.16)",
            "&:hover:not([data-disabled='true'])": {
              backgroundColor: "neutral.900",
              borderColor: "primary.500",
            },
            "& .MuiTextarea-textarea": {
              minHeight: 128,
              resize: "vertical",
              backgroundColor: "transparent",
              color: "common.white",
              fontSize: "16px",
              lineHeight: 1.55,
              "&::placeholder": {
                color: "neutral.500",
              },
            },
            "&:focus-within": {
              backgroundColor: "neutral.900",
              borderColor: "primary.500",
            },
          }}
        />

        <Stack direction="row" spacing={1} justifyContent="flex-end">
          <JoyButton
            color="neutral"
            disabled={saving}
            size="md"
            variant="outlined"
            onClick={onCancel}
            sx={{
              minWidth: 88,
              color: "common.white",
              borderColor: "neutral.500",
              backgroundColor:
                "rgba(var(--joy-palette-common-whiteChannel) / 0.04)",
              "&:hover:not(:disabled)": {
                color: "common.white",
                borderColor: "neutral.300",
                backgroundColor:
                  "rgba(var(--joy-palette-common-whiteChannel) / 0.08)",
              },
              "&.Mui-focusVisible, &:focus-visible": {
                color: "common.white",
                borderColor: "primary.400",
                backgroundColor:
                  "rgba(var(--joy-palette-common-whiteChannel) / 0.08)",
                boxShadow:
                  "0 0 0 2px rgba(var(--joy-palette-primary-mainChannel) / 0.22)",
              },
            }}
          >
            Cancel
          </JoyButton>
          <JoyButton
            color="neutral"
            disabled={saveDisabled}
            loading={saving}
            size="md"
            variant="solid"
            onClick={() => {
              void save();
            }}
            sx={{ minWidth: 88 }}
          >
            Save
          </JoyButton>
        </Stack>
      </Stack>
    </Sheet>
  );
}
