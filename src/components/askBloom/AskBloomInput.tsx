import * as React from "react";
import Box from "@mui/joy/Box";
import IconButton from "@mui/joy/IconButton";
import Textarea from "@mui/joy/Textarea";
import { Send, Square } from "lucide-react";
import { useAskBloom } from "@/providers/AskBloomProvider";

export function AskBloomInput() {
  const askBloom = useAskBloom();
  const [value, setValue] = React.useState("");
  const trimmedValue = value.trim();
  const resourceLabel = askBloom.state.resourceFocus?.resourceLabel;
  const placeholder = resourceLabel
    ? `Ask about ${resourceLabel}...`
    : "Ask Bloom anything...";

  const handleSubmit = React.useCallback(() => {
    if (!trimmedValue || askBloom.state.isStreaming) {
      return;
    }

    askBloom.sendMessage(trimmedValue);
    setValue("");
  }, [askBloom, trimmedValue]);

  return (
    <Box
      data-ask-bloom-panel-input
      sx={{
        p: 1.5,
        borderTop: "1px solid",
        borderColor: "divider",
        bgcolor: "background.surface",
        flexShrink: 0,
      }}
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) auto",
          gap: 1,
          alignItems: "end",
        }}
      >
        <Textarea
          minRows={1}
          maxRows={4}
          value={value}
          variant="outlined"
          placeholder={placeholder}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              handleSubmit();
            }
          }}
          slotProps={{
            textarea: {
              "data-ask-bloom-panel-input": "true",
            },
          }}
          sx={{
            bgcolor: "background.surface",
            "& .MuiTextarea-textarea": {
              fontSize: "var(--joy-fontSize-sm)",
              lineHeight: "var(--joy-lineHeight-sm)",
            },
          }}
        />
        <IconButton
          aria-label={askBloom.state.isStreaming ? "Stop response" : "Send message"}
          color="primary"
          size="sm"
          variant="solid"
          disabled={!askBloom.state.isStreaming && trimmedValue.length === 0}
          onClick={
            askBloom.state.isStreaming ? askBloom.cancelStream : handleSubmit
          }
          sx={{
            width: 32,
            height: 32,
            minWidth: 32,
            minHeight: 32,
            borderRadius: "999px",
            flexShrink: 0,
          }}
        >
          {askBloom.state.isStreaming ? (
            <Square size={16} strokeWidth={1.75} fill="currentColor" />
          ) : (
            <Send size={16} strokeWidth={1.75} />
          )}
        </IconButton>
      </Box>
    </Box>
  );
}
