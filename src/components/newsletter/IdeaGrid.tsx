import React from "react";
import Box from "@mui/joy/Box";
import Card from "@mui/joy/Card";
import Divider from "@mui/joy/Divider";
import LinearProgress from "@mui/joy/LinearProgress";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { NewsletterIdea } from "@/types/newsletter";
import { IdeaCard } from "./IdeaCard";
import { NewsletterEmptyState } from "./NewsletterEmptyState";

interface IdeaGridProps {
  ideas: NewsletterIdea[];
  currentWeekIdeaId?: string | null;
  onSelectIdea: (idea: NewsletterIdea) => void;
  onGenerateIdeas?: (prompt: string) => void | Promise<unknown>;
  onRetryGenerate?: () => void | Promise<unknown>;
  loading?: boolean;
  generating?: boolean;
  generatedError?: string | null;
  className?: string;
  selectedIdeaId?: string | null;
}

const GENERATED_IDEA_LOADING_PHRASES = [
  "Thinking about your idea...",
  "Crafting something meaningful...",
  "Sprinkling in seasonal inspiration...",
  "Browsing through garden wisdom...",
  "Picking the freshest content ideas...",
  "Mixing in expert growing tips...",
  "Arranging your newsletter bouquet...",
  "Checking what's in bloom this season...",
  "Gathering the best gardening insights...",
  "Planting the seeds of a great newsletter...",
  "Adding a touch of green thumb magic...",
  "Composing your perfect garden story...",
  "Digging into the details...",
  "Pruning the ideas down to the best ones...",
  "Watering the creative process...",
  "Letting the ideas take root...",
  "Harvesting fresh content for you...",
  "Cultivating something special...",
  "Potting up the perfect newsletter plan...",
  "Almost ready to bloom...",
] as const;

const phraseFadeDurationMs = 300;
const phraseRotationIntervalMs = 3000;

const sectionLabelSx = {
  color: "text.secondary",
  fontWeight: 600,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
} as const;

const ideaGridSx = {
  display: "grid",
  gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
  gap: 2,
} as const;

const generatedSectionSurfaceSx = {
  gridColumn: "1 / -1",
  minHeight: 236,
  borderRadius: "lg",
  borderColor: "neutral.200",
  boxShadow: "0 1px 2px rgba(0, 0, 0, 0.03)",
  bgcolor: "background.surface",
  px: 4,
  py: 3.5,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
} as const;

function GeneratedIdeasLoadingState() {
  const [currentPhraseIndex, setCurrentPhraseIndex] = React.useState(0);
  const [isPhraseVisible, setIsPhraseVisible] = React.useState(true);

  React.useEffect(() => {
    if (currentPhraseIndex >= GENERATED_IDEA_LOADING_PHRASES.length - 1) {
      return;
    }

    let fadeTimeoutId: number | undefined;

    const intervalId = window.setInterval(() => {
      setIsPhraseVisible(false);

      fadeTimeoutId = window.setTimeout(() => {
        setCurrentPhraseIndex((previousIndex) =>
          Math.min(
            previousIndex + 1,
            GENERATED_IDEA_LOADING_PHRASES.length - 1,
          ),
        );
        setIsPhraseVisible(true);
      }, phraseFadeDurationMs);
    }, phraseRotationIntervalMs);

    return () => {
      window.clearInterval(intervalId);

      if (fadeTimeoutId !== undefined) {
        window.clearTimeout(fadeTimeoutId);
      }
    };
  }, [currentPhraseIndex]);

  return (
    <Card variant="outlined" sx={generatedSectionSurfaceSx}>
      <Stack spacing={1.5} sx={{ width: "100%", alignItems: "center" }}>
        <Typography
          level="body-md"
          sx={{
            color: "text.secondary",
            maxWidth: 420,
            opacity: isPhraseVisible ? 1 : 0,
            transform: isPhraseVisible ? "translateY(0)" : "translateY(6px)",
            transition:
              "opacity 0.3s ease, transform 0.3s ease, filter 0.3s ease",
            filter: isPhraseVisible ? "blur(0px)" : "blur(2px)",
          }}
        >
          {GENERATED_IDEA_LOADING_PHRASES[currentPhraseIndex]}
        </Typography>

        <LinearProgress
          color="neutral"
          size="sm"
          variant="soft"
          sx={{
            width: { xs: "70%", md: "55%" },
            mx: "auto",
            bgcolor: "background.surface",
            "--LinearProgress-radius": "999px",
          }}
        />
      </Stack>
    </Card>
  );
}

function GeneratedIdeasErrorState({
  error,
  onRetry,
}: {
  error: string;
  onRetry?: () => void | Promise<unknown>;
}) {
  return (
    <Card variant="outlined" sx={generatedSectionSurfaceSx}>
      <Stack spacing={1.5} sx={{ width: "100%", alignItems: "center" }}>
        <Typography
          level="body-md"
          sx={{ color: "text.secondary", maxWidth: 360 }}
        >
          {error}
        </Typography>

        {onRetry ? (
          <Typography
            level="body-sm"
            onClick={() => {
              void onRetry();
            }}
            sx={{
              color: "primary.plainColor",
              fontWeight: 500,
              cursor: "pointer",
              "&:hover": {
                textDecoration: "underline",
              },
            }}
          >
            Try again
          </Typography>
        ) : null}
      </Stack>
    </Card>
  );
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
  onRetryGenerate,
  loading = false,
  generating = false,
  generatedError,
  className,
  selectedIdeaId,
}) => {
  const generatedIdeas = React.useMemo(
    () => ideas.filter((idea) => idea.category === "ai-generated"),
    [ideas],
  );

  const weeklyIdeas = React.useMemo(
    () => ideas.filter((idea) => idea.category !== "ai-generated"),
    [ideas],
  );

  const orderedWeeklyIdeas = React.useMemo(() => {
    return weeklyIdeas
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
  }, [weeklyIdeas]);

  const displayWeeklyIdeas = React.useMemo(() => {
    if (orderedWeeklyIdeas.length === 0) {
      return [];
    }

    // Rotate the chronologically-sorted weeks so the current week
    // appears first, followed by current+1, current+2, ... wrapping
    // around at the end of the calendar. Without this, the second
    // card after the current-week feature jumped back to week 1
    // because we were rendering the raw Jan→Dec array.
    const startIndex = currentWeekIdeaId
      ? orderedWeeklyIdeas.findIndex((idea) => idea.id === currentWeekIdeaId)
      : -1;

    const rotated =
      startIndex > 0
        ? [
            ...orderedWeeklyIdeas.slice(startIndex),
            ...orderedWeeklyIdeas.slice(0, startIndex),
          ]
        : orderedWeeklyIdeas;

    return rotated.map((idea) => ({
      displayKey: idea.id,
      displayVariant:
        idea.id === currentWeekIdeaId
          ? ("promoted-current" as const)
          : ("standard" as const),
      idea,
    }));
  }, [currentWeekIdeaId, orderedWeeklyIdeas]);

  const showGeneratedSection =
    generating || generatedIdeas.length > 0 || Boolean(generatedError);
  const showWeeklyIdeasSection = displayWeeklyIdeas.length > 0;

  if (loading) {
    return (
      <Box className={className}>
        <Box sx={ideaGridSx}>
          {Array.from({ length: 4 }).map((_, index) => (
            <IdeaCardSkeleton key={index} />
          ))}
        </Box>
      </Box>
    );
  }

  if (!showGeneratedSection && !showWeeklyIdeasSection) {
    return (
      <Box className={className}>
        <NewsletterEmptyState onPromptClick={onGenerateIdeas} />
      </Box>
    );
  }

  return (
    <Box className={className}>
      <Stack spacing={2.5}>
        {showGeneratedSection ? (
          <Stack spacing={1.5}>
            <Typography level="title-sm" sx={sectionLabelSx}>
              Generated
            </Typography>

            <Box sx={ideaGridSx}>
              {generating ? <GeneratedIdeasLoadingState /> : null}

              {!generating && generatedError ? (
                <GeneratedIdeasErrorState
                  error={generatedError}
                  onRetry={onRetryGenerate}
                />
              ) : null}

              {generatedIdeas.map((idea) => (
                <IdeaCard
                  key={idea.id}
                  idea={idea}
                  onSelect={onSelectIdea}
                  isSelected={selectedIdeaId === idea.id}
                />
              ))}
            </Box>
          </Stack>
        ) : null}

        {showGeneratedSection && showWeeklyIdeasSection ? (
          <Divider sx={{ borderColor: "neutral.100" }} />
        ) : null}

        {showWeeklyIdeasSection ? (
          <Stack spacing={1.5}>
            <Typography level="title-sm" sx={sectionLabelSx}>
              Weekly Ideas
            </Typography>

            <Box sx={ideaGridSx}>
              {displayWeeklyIdeas.map((entry) => (
                <IdeaCard
                  key={entry.displayKey}
                  displayVariant={entry.displayVariant}
                  idea={entry.idea}
                  onSelect={onSelectIdea}
                  isSelected={selectedIdeaId === entry.idea.id}
                />
              ))}
            </Box>
          </Stack>
        ) : null}
      </Stack>
    </Box>
  );
};
