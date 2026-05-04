import Box from "@mui/joy/Box";
import Chip from "@mui/joy/Chip";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Sparkles } from "lucide-react";

const suggestions = [
  "A lush garden at golden hour",
  "Modern floral arrangement on marble",
  "Watercolor botanical illustration",
];

interface AIImageStudioWelcomeProps {
  onSuggestionSelect: (suggestion: string) => void;
}

export function AIImageStudioWelcome({
  onSuggestionSelect,
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
            What would you like to create?
          </Typography>
          <Typography level="body-sm" textColor="text.tertiary">
            Start with a BloomSuite-ready direction for florals, botanicals, or
            in-store display imagery.
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
