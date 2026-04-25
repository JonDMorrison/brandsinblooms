import { useEffect, useState, type KeyboardEvent } from "react";
import Box from "@mui/joy/Box";
import Chip from "@mui/joy/Chip";
import Input from "@mui/joy/Input";
import LinearProgress from "@mui/joy/LinearProgress";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Search, TerminalSquare } from "lucide-react";

const PLACEHOLDER_ROTATION = [
  "Search customers, campaigns, settings…",
  "Search products, automations, help…",
  "Search forms, integrations, segments…",
] as const;

interface CommandPaletteInputProps {
  activeDescendantId?: string;
  ariaControlsId: string;
  dialogLabelId: string;
  inputRef: React.RefObject<HTMLInputElement>;
  isCommandMode: boolean;
  isLoading: boolean;
  onClose: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onQueryChange: (value: string) => void;
  onSuggestionSelect: (value: string) => void;
  query: string;
  suggestions: string[];
}

export function CommandPaletteInput({
  activeDescendantId,
  ariaControlsId,
  dialogLabelId,
  inputRef,
  isCommandMode,
  isLoading,
  onClose,
  onKeyDown,
  onQueryChange,
  onSuggestionSelect,
  query,
  suggestions,
}: CommandPaletteInputProps) {
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  useEffect(() => {
    if (query.trim()) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setPlaceholderIndex((currentIndex) =>
        (currentIndex + 1) % PLACEHOLDER_ROTATION.length,
      );
    }, 2600);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [query]);

  return (
    <Box
      sx={{
        position: "sticky",
        top: 0,
        zIndex: 2,
        px: 1.5,
        pt: 1.5,
        pb: 1.25,
        backgroundColor: "hsl(var(--card))",
        borderBottom: "1px solid rgba(var(--joy-palette-neutral-mainChannel) / 0.08)",
      }}
    >
      <Input
        size="lg"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        startDecorator={
          isCommandMode ? (
            <Chip
              size="sm"
              startDecorator={<TerminalSquare size={14} strokeWidth={1.9} />}
              variant="soft"
              sx={{ borderRadius: "999px", fontWeight: 700 }}
            >
              Command Mode
            </Chip>
          ) : (
            <Search size={18} strokeWidth={1.9} />
          )
        }
        endDecorator={
          <Chip
            onClick={onClose}
            size="sm"
            variant="outlined"
            sx={{
              borderRadius: "999px",
              fontSize: "11px",
              fontWeight: 600,
              color: "neutral.600",
              cursor: "pointer",
            }}
          >
            Esc
          </Chip>
        }
        slotProps={{
          input: {
            ref: inputRef,
            "aria-activedescendant": activeDescendantId,
            "aria-autocomplete": "list",
            "aria-controls": ariaControlsId,
            "aria-expanded": true,
            "aria-haspopup": "listbox",
            "aria-labelledby": dialogLabelId,
            autoComplete: "off",
            autoFocus: true,
            onKeyDown,
            role: "combobox",
            spellCheck: false,
          },
        }}
        placeholder={
          isCommandMode
            ? "Type a command..."
            : query.trim()
              ? "Search across BloomSuite"
              : PLACEHOLDER_ROTATION[placeholderIndex]
        }
        sx={{
          minHeight: 52,
          borderRadius: "var(--joy-radius-lg)",
          backgroundColor: "rgba(var(--joy-palette-neutral-mainChannel) / 0.035)",
          borderColor: "neutral.200",
          boxShadow: "var(--joy-shadow-sm)",
          "--Input-gap": "0.75rem",
          "--Input-paddingInline": "1rem",
          "--Input-placeholderColor": "var(--joy-palette-neutral-500)",
          transition: "border-color 150ms ease, box-shadow 150ms ease",
          "@media (prefers-reduced-motion: reduce)": {
            transition: "none",
          },
          "&:focus-within": {
            borderColor: "primary.400",
            boxShadow:
              "0 0 0 2px rgba(var(--joy-palette-primary-mainChannel) / 0.16)",
          },
          "& .MuiInput-input": {
            fontSize: "15px",
          },
        }}
      />
      {!isCommandMode && query.trim() && suggestions.length > 0 ? (
        <Stack spacing={0.75} sx={{ mt: 1 }}>
          <Typography level="body-xs" sx={{ color: "neutral.500", px: 0.25 }}>
            Suggestions
          </Typography>
          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
            {suggestions.map((suggestion) => (
              <Chip
                key={suggestion}
                onClick={() => onSuggestionSelect(suggestion)}
                onMouseDown={(event) => event.preventDefault()}
                size="sm"
                variant="soft"
                sx={{ borderRadius: "999px", cursor: "pointer" }}
              >
                {suggestion}
              </Chip>
            ))}
          </Stack>
        </Stack>
      ) : null}
      {isLoading && (
        <LinearProgress
          size="sm"
          sx={{
            mt: 1,
            borderRadius: "999px",
            "--LinearProgress-radius": "999px",
            "--LinearProgress-thickness": "2px",
          }}
        />
      )}
    </Box>
  );
}