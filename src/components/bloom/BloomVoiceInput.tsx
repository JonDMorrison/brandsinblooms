import Box from "@mui/joy/Box";
import IconButton from "@mui/joy/IconButton";
import { Mic } from "lucide-react";
import { JoyTooltip } from "@/components/joy/JoyTooltip";

interface BloomVoiceInputProps {
  disabled?: boolean;
  isSupported: boolean;
  onStartListening: () => void | Promise<void>;
}

export function BloomVoiceInput({
  disabled = false,
  isSupported,
  onStartListening,
}: BloomVoiceInputProps) {
  const buttonDisabled = disabled;

  if (!isSupported) {
    return null;
  }

  const handleClick = () => {
    if (buttonDisabled) {
      return;
    }

    void onStartListening();
  };

  const tooltipTitle = disabled
    ? "Voice input unavailable while Bloom is responding"
    : "Voice input (click to speak)";

  return (
    <JoyTooltip title={tooltipTitle} placement="top">
      <Box
        component="span"
        sx={{
          display: "inline-flex",
          flexShrink: 0,
          "@media (max-width: 359.95px)": {
            display: "none",
          },
        }}
      >
        <IconButton
          aria-label="Start voice input"
          color="neutral"
          disabled={buttonDisabled}
          size="sm"
          variant="plain"
          onClick={handleClick}
          sx={{
            transformOrigin: "center",
            transition:
              "color 150ms cubic-bezier(0.4, 0, 0.2, 1), transform 150ms cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          <Mic size={18} strokeWidth={1.9} />
        </IconButton>
      </Box>
    </JoyTooltip>
  );
}
