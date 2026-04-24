import React from "react";
import Box from "@mui/joy/Box";
import Chip from "@mui/joy/Chip";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Lightbulb } from "lucide-react";
import { POPULAR_NEWSLETTER_PROMPTS } from "./newsletterPromptSuggestions";

interface NewsletterEmptyStateProps {
  onPromptClick?: (prompt: string) => void | Promise<unknown>;
}

export const NewsletterEmptyState: React.FC<NewsletterEmptyStateProps> = ({
  onPromptClick,
}) => {
  return (
    <Box
      sx={{
        minHeight: 320,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        px: { xs: 2, md: 3 },
        py: 6,
      }}
    >
      <Stack
        spacing={1.5}
        alignItems="center"
        sx={{ textAlign: "center", maxWidth: 520 }}
      >
        <Box sx={{ color: "text.tertiary", lineHeight: 0 }}>
          <Lightbulb size={40} />
        </Box>

        <Stack spacing={0.5}>
          <Typography
            level="title-sm"
            sx={{ fontWeight: 500, color: "text.secondary" }}
          >
            No ideas generated
          </Typography>
          <Typography level="body-sm" sx={{ color: "text.tertiary" }}>
            Try a different prompt, or start with a popular theme:
          </Typography>
        </Stack>

        <Stack
          direction="row"
          spacing={1}
          useFlexGap
          flexWrap="wrap"
          justifyContent="center"
        >
          {POPULAR_NEWSLETTER_PROMPTS.map((prompt) => (
            <Chip
              key={prompt}
              size="sm"
              variant="outlined"
              color="neutral"
              disabled={!onPromptClick}
              onClick={() => onPromptClick?.(prompt)}
              sx={{
                cursor: onPromptClick ? "pointer" : "default",
                color: "text.secondary",
                borderColor: "neutral.200",
                backgroundColor: "transparent",
                transition:
                  "background-color 0.15s ease, border-color 0.15s ease",
                "&:hover": onPromptClick
                  ? {
                      backgroundColor: "neutral.50",
                      borderColor: "neutral.300",
                    }
                  : undefined,
              }}
            >
              {prompt}
            </Chip>
          ))}
        </Stack>
      </Stack>
    </Box>
  );
};
