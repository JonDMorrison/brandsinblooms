import React, { useMemo, useState } from "react";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Card from "@mui/joy/Card";
import Chip from "@mui/joy/Chip";
import Modal from "@mui/joy/Modal";
import ModalDialog from "@mui/joy/ModalDialog";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { ArrowRight, PenTool, Sparkles, type LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { NewsletterLayoutPicker } from "@/components/NewsletterLayoutPicker";
import { PageContainer } from "@/components/joy/PageContainer";
import { NewsletterPicker } from "@/components/newsletter/NewsletterPicker";
import { useNewsletterIdeas } from "@/hooks/useNewsletterIdeas";
import {
  buildNewsletterIdeaEditorSearchParams,
  type NewsletterIdeaNavigationState,
} from "@/lib/studio/newsletterIdeaSeed";
import { NewsletterIdea } from "@/types/newsletter";
import { getCurrentWeekNumber } from "@/utils/dateUtils";

type LayoutKey = "block-builder" | "simple-email";

type CreationPathCardProps = {
  title: string;
  description: string;
  buttonLabel: string;
  buttonVariant: "solid" | "outlined";
  buttonColor: "neutral" | "primary";
  cardVariant: "outlined" | "soft";
  cardColor?: "neutral" | "primary";
  chipLabel?: string;
  icon: LucideIcon;
  onClick: () => void;
};

function CreationPathCard({
  title,
  description,
  buttonLabel,
  buttonVariant,
  buttonColor,
  cardVariant,
  cardColor,
  chipLabel,
  icon: Icon,
  onClick,
}: CreationPathCardProps) {
  return (
    <Card
      variant={cardVariant}
      color={cardColor}
      sx={{
        p: 3,
        height: "100%",
        borderRadius: "lg",
        bgcolor: cardVariant === "outlined" ? "background.surface" : undefined,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Stack spacing={2} sx={{ flex: 1 }}>
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: "md",
            display: "grid",
            placeItems: "center",
            bgcolor: "background.level1",
          }}
        >
          <Icon size={24} />
        </Box>

        <Stack spacing={1.25} sx={{ flex: 1 }}>
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            useFlexGap
            flexWrap="wrap"
          >
            <Typography level="title-md" sx={{ fontWeight: 600 }}>
              {title}
            </Typography>
            {chipLabel ? (
              <Chip size="sm" variant="soft" color="primary">
                {chipLabel}
              </Chip>
            ) : null}
          </Stack>

          <Typography level="body-sm" sx={{ color: "text.secondary" }}>
            {description}
          </Typography>
        </Stack>
      </Stack>

      <Box sx={{ mt: "auto", pt: 2 }}>
        <Button
          size="md"
          variant={buttonVariant}
          color={buttonColor}
          endDecorator={<ArrowRight size={16} />}
          onClick={onClick}
          sx={{ width: "100%" }}
        >
          {buttonLabel}
        </Button>
      </Box>
    </Card>
  );
}

function IdeaQuickAccessCardSkeleton() {
  return (
    <Card
      variant="outlined"
      sx={{
        p: 3,
        minHeight: 236,
        borderRadius: "lg",
        bgcolor: "background.surface",
      }}
    >
      <Stack spacing={2} sx={{ height: "100%" }}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Skeleton
            variant="rectangular"
            sx={{ width: 120, height: 10, borderRadius: "sm" }}
          />
          <Skeleton
            variant="rectangular"
            sx={{ width: 80, height: 24, borderRadius: 999 }}
          />
        </Stack>

        <Stack spacing={1}>
          <Skeleton
            variant="rectangular"
            sx={{ width: "58%", height: 20, borderRadius: "sm" }}
          />
          <Skeleton
            variant="rectangular"
            sx={{ width: "100%", height: 12, borderRadius: "sm" }}
          />
          <Skeleton
            variant="rectangular"
            sx={{ width: "92%", height: 12, borderRadius: "sm" }}
          />
          <Skeleton
            variant="rectangular"
            sx={{ width: "76%", height: 12, borderRadius: "sm" }}
          />
        </Stack>

        <Skeleton
          variant="rectangular"
          sx={{ width: 132, height: 28, borderRadius: "sm", mt: "auto" }}
        />
      </Stack>
    </Card>
  );
}

function IdeaQuickAccessCard({
  chipColor,
  chipLabel,
  idea,
  onUseIdea,
}: {
  chipColor: "neutral" | "success";
  chipLabel: string;
  idea: NewsletterIdea;
  onUseIdea: (idea: NewsletterIdea) => void;
}) {
  const weekLabel =
    idea.badge ?? (idea.weekNumber ? `Week ${idea.weekNumber}` : "Weekly");

  return (
    <Card
      variant="outlined"
      sx={{
        p: 3,
        height: "100%",
        borderRadius: "lg",
        bgcolor: "background.surface",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Stack spacing={1.5} sx={{ height: "100%" }}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="flex-start"
          spacing={1.5}
        >
          <Typography
            level="body-xs"
            sx={{
              color: "text.tertiary",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              fontWeight: 600,
            }}
          >
            {`Weekly · ${weekLabel}`}
          </Typography>

          <Chip size="sm" variant="soft" color={chipColor}>
            {chipLabel}
          </Chip>
        </Stack>

        <Stack spacing={1} sx={{ flex: 1 }}>
          <Typography level="title-md" sx={{ fontWeight: 600, mt: 0.5 }}>
            {idea.title}
          </Typography>

          <Typography
            level="body-sm"
            sx={{
              color: "text.secondary",
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              lineHeight: 1.55,
            }}
          >
            {idea.description}
          </Typography>
        </Stack>

        <Box sx={{ pt: 1 }}>
          <Button
            size="sm"
            variant="plain"
            color="primary"
            endDecorator={<ArrowRight size={14} />}
            onClick={() => onUseIdea(idea)}
            sx={{ px: 0 }}
          >
            Use this idea
          </Button>
        </Box>
      </Stack>
    </Card>
  );
}

export const NewsletterNewPage = () => {
  const [showPicker, setShowPicker] = useState(false);
  const [quickAccessIdea, setQuickAccessIdea] = useState<NewsletterIdea | null>(
    null,
  );
  const [selectedLayout, setSelectedLayout] = useState<LayoutKey | null>(null);
  const navigate = useNavigate();
  const { ideas, templates, loading } = useNewsletterIdeas();

  const currentWeekNumber = useMemo(() => getCurrentWeekNumber(), []);

  const orderedWeeklyIdeas = useMemo(() => {
    return ideas
      .filter((idea) => idea.category === "weekly")
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

  const currentWeekIdea = useMemo(
    () =>
      orderedWeeklyIdeas.find(
        (idea) => idea.weekNumber === currentWeekNumber,
      ) ??
      orderedWeeklyIdeas[0] ??
      null,
    [currentWeekNumber, orderedWeeklyIdeas],
  );

  const nextWeekIdea = useMemo(() => {
    if (orderedWeeklyIdeas.length === 0) {
      return null;
    }

    if (!currentWeekIdea) {
      return orderedWeeklyIdeas[1] ?? orderedWeeklyIdeas[0] ?? null;
    }

    const currentIndex = orderedWeeklyIdeas.findIndex(
      (idea) => idea.id === currentWeekIdea.id,
    );

    if (currentIndex === -1) {
      return orderedWeeklyIdeas[1] ?? orderedWeeklyIdeas[0] ?? null;
    }

    return (
      orderedWeeklyIdeas[(currentIndex + 1) % orderedWeeklyIdeas.length] ?? null
    );
  }, [currentWeekIdea, orderedWeeklyIdeas]);

  const showIdeaSkeletons = loading && orderedWeeklyIdeas.length === 0;

  const handleOpenQuickAccessLayout = (idea: NewsletterIdea) => {
    setQuickAccessIdea(idea);
    setSelectedLayout(null);
  };

  const handleCloseQuickAccessLayout = () => {
    setQuickAccessIdea(null);
    setSelectedLayout(null);
  };

  const handleContinueQuickAccess = () => {
    if (!quickAccessIdea || !selectedLayout) {
      return;
    }

    const params = buildNewsletterIdeaEditorSearchParams(
      quickAccessIdea,
      selectedLayout,
    );
    const navigationState = {
      newsletterIdea: quickAccessIdea,
      newsletterLayout: selectedLayout,
    } satisfies NewsletterIdeaNavigationState;

    navigate(`/crm/campaigns/new?${params.toString()}`, {
      state: navigationState,
    });
    handleCloseQuickAccessLayout();
  };

  return (
    <>
      <PageContainer sx={{ px: { xs: 2, md: 3 }, py: { xs: 3, md: 4 } }}>
        <Stack spacing={{ xs: 4, md: 5 }}>
          <Stack spacing={1} sx={{ mb: 0.5 }}>
            <Typography level="h3" sx={{ fontWeight: 700 }}>
              Create a Newsletter
            </Typography>
            <Typography level="body-md" sx={{ color: "text.secondary" }}>
              Start from scratch, explore weekly ideas, or let AI craft
              something new.
            </Typography>
          </Stack>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
              gap: 2,
              mb: 0.5,
            }}
          >
            <CreationPathCard
              title="Start from Scratch"
              description="Open a blank editor and build your newsletter block by block."
              buttonLabel="Open blank editor"
              buttonVariant="outlined"
              buttonColor="neutral"
              cardVariant="outlined"
              icon={PenTool}
              onClick={() => navigate("/crm/campaigns/new?type=newsletter")}
            />

            <CreationPathCard
              title="Pick an Idea"
              description="Get AI-generated newsletter concepts tailored to your business."
              buttonLabel="Explore AI ideas"
              buttonVariant="solid"
              buttonColor="primary"
              cardVariant="soft"
              cardColor="primary"
              chipLabel="AI-Powered"
              icon={Sparkles}
              onClick={() => setShowPicker(true)}
            />
          </Box>

          <Stack spacing={3}>
            <Stack spacing={0.75}>
              <Typography level="title-lg" sx={{ fontWeight: 600 }}>
                Ideas for You
              </Typography>
              <Typography level="body-sm" sx={{ color: "text.secondary" }}>
                Timely newsletter ideas based on the gardening calendar.
              </Typography>
            </Stack>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                gap: 2,
              }}
            >
              {showIdeaSkeletons ? (
                <>
                  <IdeaQuickAccessCardSkeleton />
                  <IdeaQuickAccessCardSkeleton />
                </>
              ) : (
                <>
                  {currentWeekIdea ? (
                    <IdeaQuickAccessCard
                      chipColor="success"
                      chipLabel="This Week"
                      idea={currentWeekIdea}
                      onUseIdea={handleOpenQuickAccessLayout}
                    />
                  ) : null}

                  {nextWeekIdea ? (
                    <IdeaQuickAccessCard
                      chipColor="neutral"
                      chipLabel="Next Week"
                      idea={nextWeekIdea}
                      onUseIdea={handleOpenQuickAccessLayout}
                    />
                  ) : null}
                </>
              )}
            </Box>

            <Box sx={{ display: "flex", justifyContent: "center", mb: 0.5 }}>
              <Button
                size="md"
                variant="outlined"
                color="neutral"
                endDecorator={<ArrowRight size={16} />}
                onClick={() => setShowPicker(true)}
              >
                Browse all 52 weekly ideas
              </Button>
            </Box>
          </Stack>
        </Stack>

        <NewsletterPicker
          isOpen={showPicker}
          onClose={() => setShowPicker(false)}
        />
      </PageContainer>

      <Modal
        open={Boolean(quickAccessIdea)}
        onClose={handleCloseQuickAccessLayout}
      >
        <ModalDialog
          layout="center"
          sx={{
            width: { xs: "100vw", sm: "95vw", md: "90vw" },
            maxWidth: 900,
            height: { xs: "100dvh", md: "88vh" },
            maxHeight: { xs: "100dvh", md: "88vh" },
            borderRadius: { xs: 0, md: "xl" },
            borderColor: "neutral.200",
            backgroundColor: "background.surface",
            backgroundImage: "none",
            p: 0,
            overflow: "hidden",
          }}
        >
          {quickAccessIdea ? (
            <Box sx={{ flex: 1, minHeight: 0, display: "flex" }}>
              <NewsletterLayoutPicker
                idea={quickAccessIdea}
                onBack={handleCloseQuickAccessLayout}
                onChange={setSelectedLayout}
                onContinue={handleContinueQuickAccess}
                templates={templates}
                value={selectedLayout}
              />
            </Box>
          ) : null}
        </ModalDialog>
      </Modal>
    </>
  );
};
