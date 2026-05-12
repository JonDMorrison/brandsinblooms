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
import {
  ArrowRight,
  Check,
  Lightbulb,
  PenTool,
  type LucideIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { NewsletterLayoutPicker } from "@/components/NewsletterLayoutPicker";
import { PageContainer } from "@/components/joy/PageContainer";
import { NewsletterPicker } from "@/components/newsletter/NewsletterPicker";
import { BrandFoliage } from "@/components/brand";
import { useNewsletterIdeas } from "@/hooks/useNewsletterIdeas";
import {
  buildNewsletterIdeaEditorSearchParams,
  type NewsletterIdeaNavigationState,
} from "@/lib/studio/newsletterIdeaSeed";
import { NewsletterIdea } from "@/types/newsletter";
import { getCurrentWeekNumber } from "@/utils/dateUtils";
// Token scope side-effect import — without this, the
// .hp-token-scope wrapper added below has no token definitions to
// resolve. Same pattern as PricingPage.tsx.
import "@/components/homepage-three/homepageTokens.css";

type LayoutKey = "block-builder" | "simple-email";

type CreationPathVariant = "scratch" | "ai";

type CreationPathCardProps = {
  variant: CreationPathVariant;
  title: string;
  description: string;
  buttonLabel: string;
  icon: LucideIcon;
  onClick: () => void;
};

function CreationPathCard({
  variant,
  title,
  description,
  buttonLabel,
  icon: Icon,
  onClick,
}: CreationPathCardProps) {
  const isAi = variant === "ai";

  return (
    <Card
      variant="outlined"
      sx={{
        position: "relative",
        p: { xs: 3, md: 4 },
        height: "100%",
        borderRadius: "lg",
        // Both creation paths now sit on a neutral surface. The
        // ideas card uses a slightly cooler grey so it reads as
        // the recommended path without leaning teal/mint.
        bgcolor: isAi
          ? "var(--joy-palette-neutral-50, #f5f5f4)"
          : "rgba(225, 255, 254, 0.18)",
        borderColor: isAi
          ? "var(--joy-palette-neutral-200, #e7e5e4)"
          : "rgba(48, 80, 110, 0.14)",
        // Slight scale lift kept so the ideas card still reads as
        // primary; teal glow shadow removed to match the neutral
        // background.
        transform: { xs: "none", md: isAi ? "scale(1.02)" : "none" },
        boxShadow: "none",
        display: "flex",
        flexDirection: "column",
        transition: "transform 200ms ease, box-shadow 200ms ease",
      }}
    >
      <Stack spacing={2.5} sx={{ flex: 1 }}>
        {/* 96px tinted icon circle — kept dark green per spec. */}
        <Box
          sx={{
            width: 96,
            height: 96,
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            bgcolor: isAi
              ? "var(--hp-green-700, #1F4341)"
              : "var(--hp-green-50, #E1FFFE)",
            color: isAi
              ? "var(--hp-text-light, #FAFAFA)"
              : "var(--hp-green-700, #1F4341)",
            boxShadow: isAi
              ? "0 6px 22px rgba(31, 67, 65, 0.32)"
              : "inset 0 0 0 1px rgba(62, 124, 119, 0.15)",
          }}
        >
          <Icon size={44} strokeWidth={1.7} />
        </Box>

        <Stack spacing={1.25} sx={{ flex: 1 }}>
          <Typography
            level="title-md"
            sx={{ fontWeight: 700, color: "var(--hp-green-900, #11302E)" }}
          >
            {title}
          </Typography>

          <Typography level="body-sm" sx={{ color: "text.secondary" }}>
            {description}
          </Typography>
        </Stack>
      </Stack>

      <Box sx={{ mt: "auto", pt: 2.5 }}>
        <Button
          size="md"
          variant={isAi ? "solid" : "outlined"}
          color={isAi ? "primary" : "neutral"}
          endDecorator={<ArrowRight size={16} />}
          onClick={onClick}
          sx={{
            width: "100%",
            ...(isAi
              ? {
                  bgcolor: "var(--hp-green-700, #1F4341)",
                  "&:hover": {
                    bgcolor: "var(--hp-green-900, #11302E)",
                  },
                }
              : {}),
          }}
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

// (4) Seasonal accent stripe colors — NOT brand tokens, decorative
// only. Each weekly idea card gets a 4px left-edge stripe colored
// by the season of its weekNumber. Mapping uses ISO weeks 1-52
// with a roughly Northern-hemisphere calendar.
function getSeasonalAccentColor(weekNumber: number): string {
  if (weekNumber >= 10 && weekNumber <= 22) {
    // seasonal accent stripe — not a brand token, decorative only
    return "var(--hp-green-500, #3E7C77)"; // spring → brand teal
  }
  if (weekNumber >= 23 && weekNumber <= 35) {
    // seasonal accent stripe — not a brand token, decorative only
    return "#D4A437"; // summer → warm gold
  }
  if (weekNumber >= 36 && weekNumber <= 48) {
    // seasonal accent stripe — not a brand token, decorative only
    return "#B86B3F"; // fall → copper
  }
  // seasonal accent stripe — not a brand token, decorative only
  return "#5A7A8C"; // winter → cool gray-blue
}

function IdeaQuickAccessCard({
  isCurrentWeek,
  idea,
  onUseIdea,
}: {
  isCurrentWeek: boolean;
  idea: NewsletterIdea;
  onUseIdea: (idea: NewsletterIdea) => void;
}) {
  const weekNumber = idea.weekNumber ?? 0;
  const accentColor = getSeasonalAccentColor(weekNumber);

  return (
    <Card
      variant="outlined"
      sx={{
        position: "relative",
        p: 3,
        pl: 3.5, // extra left padding so content doesn't sit directly on the stripe
        height: "100%",
        borderRadius: "lg",
        bgcolor: "background.surface",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* (4) 4px seasonal accent stripe on the left edge. */}
      <Box
        sx={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          width: 4,
          bgcolor: accentColor,
        }}
        aria-hidden="true"
      />

      <Stack spacing={1.5} sx={{ height: "100%" }}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="flex-start"
          spacing={1.5}
        >
          {/*
            (5) Friendlier eyebrow. Current-week idea gets a bold
            "This week's spotlight" label with a green check pill
            holding the week number; other weeks get a softer
            "Up next: Week N" treatment with a muted gray pill.
          */}
          {isCurrentWeek ? (
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              useFlexGap
              flexWrap="wrap"
              sx={{ minWidth: 0 }}
            >
              <Typography
                level="body-sm"
                sx={{
                  fontWeight: 700,
                  color: "var(--hp-green-700, #1F4341)",
                }}
              >
                This week&apos;s spotlight
              </Typography>
              <Chip
                size="sm"
                variant="solid"
                startDecorator={<Check size={12} strokeWidth={3} />}
                sx={{
                  bgcolor: "var(--hp-green-700, #1F4341)",
                  color: "var(--hp-text-light, #FAFAFA)",
                  fontWeight: 700,
                  fontSize: "11px",
                  letterSpacing: "0.04em",
                  px: 1,
                }}
              >
                Week {weekNumber || "—"}
              </Chip>
            </Stack>
          ) : (
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              useFlexGap
              flexWrap="wrap"
              sx={{ minWidth: 0 }}
            >
              <Typography
                level="body-sm"
                sx={{
                  fontWeight: 600,
                  color: "text.secondary",
                }}
              >
                Up next:
              </Typography>
              <Chip
                size="sm"
                variant="soft"
                color="neutral"
                sx={{
                  fontWeight: 700,
                  fontSize: "11px",
                  letterSpacing: "0.04em",
                  px: 1,
                }}
              >
                Week {weekNumber || "—"}
              </Chip>
            </Stack>
          )}
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
      {/*
        (1) .hp-token-scope wrapper so --hp-* variables resolve, plus
        a soft cream off-white background and a single BrandFoliage
        decoration anchored bottom-right at low opacity.
      */}
      <Box
        className="hp-token-scope"
        sx={{
          position: "relative",
          minHeight: "100%",
          bgcolor: "var(--hp-bg-subtle, #F8F9FB)",
          // The DashboardShell main content area handles its own
          // padding; we only need the page's own surface to read as
          // a continuous warm cream.
        }}
      >
        <BrandFoliage
          aria-hidden="true"
          color="var(--hp-green-400, #68BEB9)"
          style={{
            position: "absolute",
            right: "-3%",
            bottom: "-6%",
            width: "clamp(220px, 26vw, 360px)",
            height: "auto",
            opacity: 0.45,
            pointerEvents: "none",
            zIndex: 0,
          }}
        />

        <PageContainer
          sx={{
            position: "relative",
            zIndex: 1,
            px: { xs: 2, md: 3 },
            py: { xs: 3, md: 4 },
          }}
        >
          {/*
            (6) Bigger gap between the "Create a Newsletter" section
            and "Ideas for You" so they read as distinct chapters
            rather than one flat list. Mobile: 48-64px (xs:6); desktop:
            80-96px (md:11). Joy spacing units are 8px each, so
            md:11 = 88px, xs:6 = 48px.
          */}
          <Stack spacing={{ xs: 6, md: 11 }}>
            <Stack spacing={{ xs: 4, md: 5 }}>
              <Stack spacing={1.25}>
                <Typography
                  level="h3"
                  sx={{
                    fontWeight: 700,
                    color: "var(--hp-green-900, #11302E)",
                  }}
                >
                  Create a Newsletter
                </Typography>
                <Typography level="body-md" sx={{ color: "text.secondary" }}>
                  Start from scratch or explore weekly ideas.
                </Typography>
              </Stack>

              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                  gap: { xs: 2.5, md: 3 },
                  alignItems: "stretch",
                }}
              >
                <CreationPathCard
                  variant="scratch"
                  title="Start from Scratch"
                  description="Open a blank editor and build your newsletter block by block."
                  buttonLabel="Open blank editor"
                  icon={PenTool}
                  onClick={() => navigate("/crm/campaigns/new?type=newsletter")}
                />

                <CreationPathCard
                  variant="ai"
                  title="Pick an Idea"
                  description="Get newsletter concepts tailored to your business."
                  buttonLabel="Explore ideas"
                  icon={Lightbulb}
                  onClick={() => setShowPicker(true)}
                />
              </Box>
            </Stack>

            <Stack spacing={{ xs: 3, md: 4 }}>
              <Stack spacing={1.25}>
                <Typography
                  level="title-lg"
                  sx={{
                    fontWeight: 700,
                    color: "var(--hp-green-900, #11302E)",
                  }}
                >
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
                        isCurrentWeek
                        idea={currentWeekIdea}
                        onUseIdea={handleOpenQuickAccessLayout}
                      />
                    ) : null}

                    {nextWeekIdea ? (
                      <IdeaQuickAccessCard
                        isCurrentWeek={false}
                        idea={nextWeekIdea}
                        onUseIdea={handleOpenQuickAccessLayout}
                      />
                    ) : null}
                  </>
                )}
              </Box>

              <Box sx={{ display: "flex", justifyContent: "center" }}>
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
      </Box>

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
