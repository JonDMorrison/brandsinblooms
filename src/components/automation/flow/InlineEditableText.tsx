import * as React from "react";
import type { SxProps } from "@mui/joy/styles/types";
import Typography from "@mui/joy/Typography";
import { JoyInput } from "@/components/joy/JoyInput";

type TypographyLevel = React.ComponentProps<typeof Typography>["level"];

interface InlineEditableTextProps {
  value: string;
  onCommit: (value: string) => void;
  level?: TypographyLevel;
  fallbackValue?: string;
  placeholder?: string;
  typographySx?: SxProps;
  inputSx?: SxProps;
}

export function InlineEditableText({
  value,
  onCommit,
  level = "title-md",
  fallbackValue = "Untitled",
  placeholder,
  typographySx,
  inputSx,
}: InlineEditableTextProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [draftValue, setDraftValue] = React.useState(value);

  React.useEffect(() => {
    if (!isEditing) {
      setDraftValue(value);
    }
  }, [isEditing, value]);

  const commitValue = React.useCallback(() => {
    const nextValue = draftValue.trim() || fallbackValue;
    onCommit(nextValue);
    setIsEditing(false);
  }, [draftValue, fallbackValue, onCommit]);

  const cancelEditing = React.useCallback(() => {
    setDraftValue(value);
    setIsEditing(false);
  }, [value]);

  if (isEditing) {
    return (
      <JoyInput
        autoFocus
        value={draftValue}
        size="sm"
        onChange={(event) => setDraftValue(event.target.value)}
        onBlur={commitValue}
        onFocus={(event) => event.target.select()}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commitValue();
          }

          if (event.key === "Escape") {
            event.preventDefault();
            cancelEditing();
          }
        }}
        sx={inputSx}
      />
    );
  }

  return (
    <Typography
      level={level}
      onClick={() => setIsEditing(true)}
      sx={{
        cursor: "text",
        borderRadius: "sm",
        transition: "background-color 0.16s ease, color 0.16s ease",
        "&:hover": {
          backgroundColor:
            "rgba(var(--joy-palette-neutral-mainChannel) / 0.06)",
        },
        ...typographySx,
      }}
    >
      {value || placeholder || fallbackValue}
    </Typography>
  );
}
