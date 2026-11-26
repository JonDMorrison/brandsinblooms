import * as React from "react";
import IconButton from "@mui/joy/IconButton";
import Input from "@mui/joy/Input";
import Stack from "@mui/joy/Stack";
import Textarea from "@mui/joy/Textarea";
import Typography from "@mui/joy/Typography";
import Button from "@mui/joy/Button";
import { Sparkles, X } from "lucide-react";

const SAMPLE_TEXT =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.";

type StudioTextFieldProps = {
  label: string;
  placeholder?: string;
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  multiline?: boolean;
  minRows?: number;
  aiDecorator?: boolean;
  startDecorator?: React.ReactNode;
  type?: React.InputHTMLAttributes<HTMLInputElement>["type"];
};

export default function StudioTextField({
  label,
  placeholder,
  defaultValue,
  value,
  onChange,
  multiline = false,
  minRows = 3,
  aiDecorator = false,
  startDecorator,
  type = "text",
}: StudioTextFieldProps) {
  // Clear and sample text only for controlled boxes: they need the current value.
  const canEdit = Boolean(onChange) && value !== undefined;
  const clearable = type === "text" || type === "url" || type === "email" || type === undefined;
  return (
    <Stack spacing={0.5} sx={{ width: "100%", maxWidth: "100%", minWidth: 0 }}>
      <Typography
        level="body-xs"
        sx={{
          maxWidth: "100%",
          fontSize: "12px",
          fontWeight: 650,
          letterSpacing: "0.01em",
          color: "neutral.700",
        }}
      >
        {label}
      </Typography>
      {multiline ? (
        <>
        <Textarea
          size="sm"
          variant="outlined"
          minRows={Math.max(2, minRows)}
          placeholder={placeholder}
          defaultValue={defaultValue}
          value={value}
          onChange={(event) => onChange?.(event.target.value)}
          sx={{
            width: "100%",
            maxWidth: "100%",
            minWidth: 0,
            boxSizing: "border-box",
            borderRadius: "10px",
            "--Textarea-focusedThickness": "0px",
            "--Textarea-focusedHighlight": "transparent",
            border: "1.5px solid",
            bgcolor: "#ffffff",
            borderColor: "neutral.200",
            fontSize: "13px",
            lineHeight: 1.6,
            transition:
              "border-color 140ms ease, box-shadow 140ms ease, background-color 140ms ease",
            "&:hover:not(:focus-within)": {
              borderColor: "neutral.300",
            },
            "&:focus-within": {
              borderColor: "primary.400",
              boxShadow: "0 0 0 3px var(--joy-palette-primary-100)",
              outline: "none",
            },
            "& textarea": {
              minWidth: 0,
              width: "100%",
              overflowWrap: "anywhere",
              wordBreak: "break-word",
            },
            "& textarea:focus": {
              outline: "none",
            },
          }}
        />
        {canEdit && (
          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
            {!value && (
              <Button type="button" size="sm" variant="plain" color="neutral"
                onClick={() => onChange?.(SAMPLE_TEXT)}
                sx={{ minHeight: 26, fontSize: "12px", px: 0.75 }}>
                Insert lorem ipsum
              </Button>
            )}
            {Boolean(value) && (
              <Button type="button" size="sm" variant="plain" color="neutral"
                aria-label={`Clear ${label}`}
                onClick={() => onChange?.("")}
                sx={{ minHeight: 26, fontSize: "12px", px: 0.75 }}>
                Clear text
              </Button>
            )}
          </Stack>
        )}
        </>
      ) : (
        <Input
          size="sm"
          variant="outlined"
          type={type}
          placeholder={placeholder}
          defaultValue={defaultValue}
          value={value}
          onChange={(event) => onChange?.(event.target.value)}
          startDecorator={startDecorator}
          endDecorator={
            canEdit && clearable && value && !aiDecorator ? (
              <IconButton
                variant="plain"
                color="neutral"
                size="sm"
                aria-label={`Clear ${label}`}
                title="Clear"
                onClick={() => onChange?.("")}
                sx={{ minWidth: 24, minHeight: 24, borderRadius: "6px", color: "neutral.500" }}
              >
                <X size={14} />
              </IconButton>
            ) : aiDecorator ? (
              <IconButton
                variant="plain"
                color="neutral"
                size="sm"
                aria-label={`Generate ${label}`}
                onClick={() => {}}
                sx={{
                  minWidth: 28,
                  minHeight: 28,
                  borderRadius: "8px",
                  color: "neutral.400",
                  transition:
                    "color 140ms ease, background-color 140ms ease, box-shadow 140ms ease, transform 140ms ease",
                  "&:hover": {
                    color: "primary.600",
                    bgcolor: "primary.50",
                    boxShadow: "0 0 0 1px var(--joy-palette-primary-100)",
                    transform: "translateY(-1px) scale(1.04)",
                  },
                  "&:hover svg": {
                    animation: "studioSparklePulse 1.2s ease-in-out infinite",
                  },
                  "&:active": {
                    color: "primary.700",
                    bgcolor: "primary.100",
                    transform: "translateY(0) scale(0.98)",
                  },
                  "&:focus-visible": {
                    outline: "2px solid",
                    outlineColor: "primary.400",
                    outlineOffset: 2,
                  },
                  "@keyframes studioSparklePulse": {
                    "0%, 100%": {
                      transform: "scale(1)",
                      opacity: 0.9,
                    },
                    "50%": {
                      transform: "scale(1.18)",
                      opacity: 1,
                    },
                  },
                }}
              >
                <Sparkles size={14} />
              </IconButton>
            ) : undefined
          }
          sx={{
            width: "100%",
            maxWidth: "100%",
            minWidth: 0,
            boxSizing: "border-box",
            borderRadius: "10px",
            "--Input-focusedThickness": "0px",
            "--Input-focusedHighlight": "transparent",
            border: "1.5px solid",
            bgcolor: "#ffffff",
            borderColor: "neutral.200",
            fontSize: "13px",
            "--Input-minHeight": "36px",
            transition:
              "border-color 140ms ease, box-shadow 140ms ease, background-color 140ms ease",
            "&:hover:not(:focus-within)": {
              borderColor: "neutral.300",
            },
            "&:focus-within": {
              borderColor: "primary.400",
              boxShadow: "0 0 0 3px var(--joy-palette-primary-100)",
              outline: "none",
            },
            "& input": {
              minWidth: 0,
              width: "100%",
            },
            "& input:focus": {
              outline: "none",
            },
          }}
        />
      )}
    </Stack>
  );
}
