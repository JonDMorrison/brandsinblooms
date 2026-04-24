import React from "react";
import Box from "@mui/joy/Box";
import Card from "@mui/joy/Card";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import { NewsletterIdea } from "@/types/newsletter";
import { IdeaCard } from "./IdeaCard";
import { NewsletterEmptyState } from "./NewsletterEmptyState";

interface IdeaGridProps {
  ideas: NewsletterIdea[];
  currentWeekIdeaId?: string | null;
  onSelectIdea: (idea: NewsletterIdea) => void;
  onGenerateIdeas?: (prompt: string) => void | Promise<unknown>;
  loading?: boolean;
  className?: string;
  selectedIdeaId?: string | null;
}

function IdeaCardSkeleton() {
  return (
    <Card
      variant="outlined"
      sx={{
        p: 2.5,
        minHeight: 236,
        borderRadius: "lg",
        borderColor: "neutral.200",
        boxShadow: "0 1px 2px rgba(0, 0, 0, 0.03)",
        display: "flex",
        flexDirection: "column",
        gap: 1.25,
      }}
    >
      <Stack
        direction="row"
        spacing={1}
        justifyContent="space-between"
        alignItems="center"
      >
        <Skeleton
          variant="rectangular"
          animation="wave"
          sx={{ width: 74, height: 12, borderRadius: 999 }}
        />
        <Skeleton
          variant="rectangular"
          animation="wave"
          sx={{ width: 54, height: 12, borderRadius: 999 }}
        />
      </Stack>

      <Stack spacing={0.9}>
        <Skeleton
          variant="rectangular"
          animation="wave"
          sx={{ width: "74%", height: 18, borderRadius: "sm" }}
        />
        <Skeleton
          variant="rectangular"
          animation="wave"
          sx={{ width: "100%", height: 12, borderRadius: "sm" }}
        />
        <Skeleton
          variant="rectangular"
          animation="wave"
          sx={{ width: "94%", height: 12, borderRadius: "sm" }}
        />
        <Skeleton
          variant="rectangular"
          animation="wave"
          sx={{ width: "70%", height: 12, borderRadius: "sm" }}
        />
      </Stack>

      <Box
        sx={{ mt: "auto", display: "flex", justifyContent: "flex-end", pt: 1 }}
      >
        <Skeleton
          variant="rectangular"
          animation="wave"
          sx={{ width: 108, height: 14, borderRadius: "sm" }}
        />
      </Box>
    </Card>
  );
}

export const IdeaGrid: React.FC<IdeaGridProps> = ({
  ideas,
  currentWeekIdeaId,
  onSelectIdea,
  onGenerateIdeas,
  loading = false,
  className,
  selectedIdeaId,
}) => {
  const orderedIdeas = React.useMemo(() => {
    return ideas
      .map((idea, index) => ({
        idea,
        index,
        weekNumber:
          typeof idea.weekNumber === "number"
            ? idea.weekNumber
            : Number.POSITIVE_INFINITY,
      }))
      .sort((left, right) => {
        if (left.weekNumber !== right.weekNumber) {
          return left.weekNumber - right.weekNumber;
        }

        return left.index - right.index;
      })
      .map((entry) => entry.idea);
  }, [ideas]);

  const displayIdeas = React.useMemo(() => {
    const baseEntries = orderedIdeas.map((idea) => ({
      displayKey: idea.id,
      displayVariant:
        idea.id === currentWeekIdeaId
          ? ("natural-current" as const)
          : ("standard" as const),
      idea,
    }));

    const currentWeekIdea = currentWeekIdeaId
      ? (orderedIdeas.find((idea) => idea.id === currentWeekIdeaId) ?? null)
      : null;

    if (!currentWeekIdea) {
      return baseEntries;
    }

    // Duplicate the current week at the top as a promoted shortcut while
    // preserving its natural chronological slot further down the grid.
    return [
      {
        displayKey: `promoted-${currentWeekIdea.id}`,
        displayVariant: "promoted-current" as const,
        idea: currentWeekIdea,
      },
      ...baseEntries,
    ];
  }, [currentWeekIdeaId, orderedIdeas]);

  if (loading) {
    return (
      <Box className={className}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
            gap: 2,
          }}
        >
          {Array.from({ length: 4 }).map((_, index) => (
            <IdeaCardSkeleton key={index} />
          ))}
        </Box>
      </Box>
    );
  }

  if (ideas.length === 0) {
    return (
      <Box className={className}>
        <NewsletterEmptyState onPromptClick={onGenerateIdeas} />
      </Box>
    );
  }

  return (
    <Box className={className}>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
          gap: 2,
        }}
      >
        {displayIdeas.map((entry) => (
          <IdeaCard
            key={entry.displayKey}
            displayVariant={entry.displayVariant}
            idea={entry.idea}
            onSelect={onSelectIdea}
            isSelected={selectedIdeaId === entry.idea.id}
          />
        ))}
      </Box>
    </Box>
  );
};
