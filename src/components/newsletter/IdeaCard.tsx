import React, { type KeyboardEvent } from "react";
import Box from "@mui/joy/Box";
import Card from "@mui/joy/Card";
import Chip from "@mui/joy/Chip";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { NewsletterIdea } from "@/types/newsletter";

const surfaceTransition =
  "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease, background-color 0.2s ease";

const categoryLabelByCategory: Record<NewsletterIdea["category"], string> = {
  holiday: "Holiday",
  seasonal: "Seasonal",
  product: "Product",
  "ai-generated": "AI Idea",
  general: "General",
  weekly: "Weekly",
};

function getIdeaMeta(idea: NewsletterIdea) {
  if (idea.badge) {
    return idea.badge;
  }

  if (typeof idea.weekNumber === "number") {
    return `Week ${idea.weekNumber}`;
  }

  return idea.estimatedReadTime || "Curated";
}

interface IdeaCardProps {
  displayVariant?: "standard" | "promoted-current" | "natural-current";
  idea: NewsletterIdea;
  onSelect: (idea: NewsletterIdea) => void;
  className?: string;
  isSelected?: boolean;
}

export const IdeaCard: React.FC<IdeaCardProps> = ({
  displayVariant = "standard",
  idea,
  onSelect,
  className,
  isSelected = false,
}) => {
  const isNaturalCurrent = displayVariant === "natural-current";
  const isPromotedCurrent = displayVariant === "promoted-current";
  const showPrimarySelection = isSelected && !isNaturalCurrent;

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(idea);
    }
  };

  return (
    <Card
      className={className}
      role="button"
      tabIndex={0}
      variant="outlined"
      onClick={() => onSelect(idea)}
      onKeyDown={handleKeyDown}
      sx={{
        p: 2.5,
        height: "100%",
        minHeight: 236,
        borderRadius: "lg",
        borderWidth: isNaturalCurrent || showPrimarySelection ? 2 : 1,
        borderColor: isNaturalCurrent
          ? "success.400"
          : showPrimarySelection
            ? "primary.400"
            : "neutral.200",
        boxShadow: showPrimarySelection
          ? "0 4px 12px rgba(0, 0, 0, 0.06)"
          : "0 1px 2px rgba(0, 0, 0, 0.03)",
        backgroundColor: isNaturalCurrent
          ? "rgba(var(--joy-palette-success-mainChannel) / 0.02)"
          : showPrimarySelection
            ? "rgba(var(--joy-palette-primary-mainChannel) / 0.03)"
            : "background.surface",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: 1.25,
        transition: surfaceTransition,
        outline: 0,
        "&:hover": {
          transform: "translateY(-1px)",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.06)",
          borderColor: isNaturalCurrent
            ? "success.400"
            : showPrimarySelection
              ? "primary.400"
              : "neutral.300",
        },
        "&:focus-visible": {
          borderColor: isNaturalCurrent
            ? "success.400"
            : showPrimarySelection
              ? "primary.400"
              : "neutral.300",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.06)",
        },
      }}
    >
      <Stack
        direction="row"
        spacing={1}
        justifyContent="space-between"
        alignItems="center"
      >
        <Stack
          direction="row"
          spacing={0.75}
          alignItems="center"
          sx={{ minWidth: 0 }}
        >
          <Typography
            level="body-xs"
            sx={{
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "text.tertiary",
            }}
          >
            {categoryLabelByCategory[idea.category]}
          </Typography>

          {isPromotedCurrent ? (
            <Typography
              level="body-xs"
              sx={{ fontWeight: 600, color: "primary.plainColor" }}
            >
              This Week
            </Typography>
          ) : null}
        </Stack>

        <Stack direction="row" spacing={0.75} alignItems="center">
          <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
            {getIdeaMeta(idea)}
          </Typography>

          {isNaturalCurrent ? (
            <Chip
              size="sm"
              variant="soft"
              color="success"
              sx={{
                borderRadius: "sm",
                fontWeight: 600,
              }}
            >
              Current
            </Chip>
          ) : null}
        </Stack>
      </Stack>

      <Stack spacing={0.9}>
        <Typography
          level="title-sm"
          sx={{
            fontWeight: 600,
            display: "-webkit-box",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: 2,
            overflow: "hidden",
          }}
        >
          {idea.title}
        </Typography>

        <Typography
          level="body-sm"
          sx={{
            color: "text.secondary",
            lineHeight: 1.55,
            display: "-webkit-box",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: 3,
            overflow: "hidden",
          }}
        >
          {idea.description}
        </Typography>
      </Stack>

      <Box sx={{ mt: "auto", pt: 1 }}>
        <Typography
          level="body-sm"
          onClick={(event) => {
            event.stopPropagation();
            onSelect(idea);
          }}
          sx={{
            display: "inline-flex",
            color: "primary.plainColor",
            fontWeight: 500,
            cursor: "pointer",
            "&:hover": {
              textDecoration: "underline",
            },
          }}
        >
          Use this idea →
        </Typography>
      </Box>
    </Card>
  );
};
