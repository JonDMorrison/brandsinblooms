import Box from "@mui/joy/Box";
import Chip from "@mui/joy/Chip";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Sparkles } from "lucide-react";

const DEFAULT_SUGGESTIONS = [
  "Seasonal floral campaign scene with soft morning light",
  "Premium product arrangement with lush botanical texture",
  "Editorial garden lifestyle image with clean negative space",
];

interface AIImageStudioWelcomeProps {
  blockLabel?: string;
  description?: string;
  onSuggestionSelect: (suggestion: string) => void;
  suggestions?: string[];
}

export function AIImageStudioWelcome({
  blockLabel,
  description,
  onSuggestionSelect,
  suggestions = DEFAULT_SUGGESTIONS,
}: AIImageStudioWelcomeProps) {
  return (
    <Box
      sx={{
        minHeight: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        py: 4,
      }}
    >
      <Stack
        spacing={2.5}
        alignItems="center"
        sx={{ maxWidth: 360, textAlign: "center" }}
      >
        <Box
          aria-hidden="true"
          sx={{
            color: "text.tertiary",
            opacity: 0.4,
            display: "inline-flex",
          }}
        >
          <Sparkles size={48} strokeWidth={1.75} />
        </Box>

        <Stack spacing={0.75}>
          <Typography level="title-sm" textColor="text.secondary">
            {blockLabel ? (
              <>
                Create an image for{" "}
                <Box
                  component="span"
                  sx={{ color: "text.primary", fontWeight: 600 }}
                >
                  {blockLabel}
                </Box>
              </>
            ) : (
              "What would you like to create?"
            )}
          </Typography>
          <Typography level="body-sm" textColor="text.tertiary">
            {description ||
              "Start with a BloomSuite-ready direction for florals, botanicals, or in-store display imagery."}
          </Typography>
        </Stack>

        <Stack
          direction="row"
          useFlexGap
          flexWrap="wrap"
          justifyContent="center"
          gap={1}
        >
          {suggestions.map((suggestion) => (
            <Chip
              key={suggestion}
              color="neutral"
              onClick={() => onSuggestionSelect(suggestion)}
              size="md"
              variant="outlined"
              sx={{
                borderRadius: "999px",
                cursor: "pointer",
                maxWidth: "100%",
                whiteSpace: "nowrap",
                "&:hover": {
                  borderColor:
                    "rgba(var(--joy-palette-primary-mainChannel) / 0.24)",
                  backgroundColor:
                    "rgba(var(--joy-palette-primary-mainChannel) / 0.04)",
                },
              }}
            >
              {suggestion}
            </Chip>
          ))}
        </Stack>
      </Stack>
    </Box>
  );
}
