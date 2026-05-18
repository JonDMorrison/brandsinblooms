import React from "react";
import Alert from "@mui/joy/Alert";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Card from "@mui/joy/Card";
import Checkbox from "@mui/joy/Checkbox";
import Chip from "@mui/joy/Chip";
import ChipDelete from "@mui/joy/ChipDelete";
import FormControl from "@mui/joy/FormControl";
import FormLabel from "@mui/joy/FormLabel";
import Input from "@mui/joy/Input";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Bug, Flower, Gift, Leaf, Plus, Sprout } from "lucide-react";
import { format } from "date-fns";
import { useSearchParams } from "react-router-dom";
import { PlanTheme } from "../constants";
import { usePlanWizard } from "../PlanWizardContext";
import { getSeasonalThemesForMonth } from "@/services/seasonalPlanGenerator";

const themeIcons = {
  "fall-planting": Leaf,
  "houseplant-month": Sprout,
  "pollinator-week": Bug,
  "holiday-gifting": Gift,
  "vegetable-starts": Sprout,
  "perennial-spotlight": Flower,
};

interface PlanStepThemeProps {
  onNext: () => void;
}

const themeCardSx = {
  minHeight: 172,
  p: 2.5,
};

const themeSkeletonIds = [
  "theme-skeleton-1",
  "theme-skeleton-2",
  "theme-skeleton-3",
  "theme-skeleton-4",
  "theme-skeleton-5",
  "theme-skeleton-6",
];

const dedupeThemesById = (themes: PlanTheme[]) => {
  const seenThemeIds = new Set<string>();

  return themes.filter((theme) => {
    if (seenThemeIds.has(theme.id)) {
      return false;
    }

    seenThemeIds.add(theme.id);
    return true;
  });
};

const ThemeSkeletonCard = () => (
  <Card variant="outlined" sx={themeCardSx}>
    <Stack spacing={1.5}>
      <Stack direction="row" justifyContent="space-between">
        <Skeleton height={20} variant="rectangular" width={20} />
        <Skeleton height={20} variant="rectangular" width={20} />
      </Stack>
      <Stack spacing={0.75}>
        <Skeleton level="title-sm" variant="text" width="70%" />
        <Skeleton level="body-xs" variant="text" width="100%" />
        <Skeleton level="body-xs" variant="text" width="82%" />
      </Stack>
    </Stack>
  </Card>
);

export const PlanStepTheme: React.FC<PlanStepThemeProps> = ({ onNext }) => {
  const { state, setMonth, setThemes } = usePlanWizard();
  const [searchParams] = useSearchParams();
  const [availableThemes, setAvailableThemes] = React.useState<PlanTheme[]>([]);
  const [loadingThemes, setLoadingThemes] = React.useState(false);
  const [customThemeName, setCustomThemeName] = React.useState("");
  const [hasMoreThemes, setHasMoreThemes] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);

  React.useEffect(() => {
    if (!state.month && !searchParams.get("month")) {
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      nextMonth.setDate(1);
      const monthString = format(nextMonth, "yyyy-MM");
      setMonth(monthString);
    }
  }, [searchParams, setMonth, state.month]);

  React.useEffect(() => {
    if (!state.month) {
      setAvailableThemes([]);
      setHasMoreThemes(false);
      return;
    }

    let isCancelled = false;
    setLoadingThemes(true);

    getSeasonalThemesForMonth(state.month, 0, 6)
      .then((result) => {
        if (isCancelled) return;
        setAvailableThemes(dedupeThemesById(result.themes));
        setHasMoreThemes(result.hasMore);
      })
      .catch((error) => {
        if (isCancelled) return;
        console.error("Error loading seasonal themes:", error);
        setAvailableThemes([]);
        setHasMoreThemes(false);
      })
      .finally(() => {
        if (!isCancelled) {
          setLoadingThemes(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [state.month]);

  const handleLoadMore = async () => {
    if (!state.month || loadingMore || !hasMoreThemes) return;

    setLoadingMore(true);
    try {
      const result = await getSeasonalThemesForMonth(
        state.month,
        availableThemes.length,
        6,
      );
      const nextThemes = dedupeThemesById([
        ...availableThemes,
        ...result.themes,
      ]);
      const didAppendThemes = nextThemes.length > availableThemes.length;

      setAvailableThemes(nextThemes);
      setHasMoreThemes(didAppendThemes && result.hasMore);
    } catch (error) {
      console.error("Error loading more themes:", error);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleMonthChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextMonth = event.target.value;

    if (nextMonth === state.month) {
      return;
    }

    setMonth(nextMonth);
    setThemes([]);
    setAvailableThemes([]);
    setHasMoreThemes(false);
    setLoadingMore(false);
    setLoadingThemes(Boolean(nextMonth));
  };

  const handleThemeToggle = React.useCallback(
    (themeId: string) => {
      const currentThemes = state.themes;
      const isSelected = currentThemes.some((theme) => theme.id === themeId);

      if (isSelected) {
        setThemes(currentThemes.filter((theme) => theme.id !== themeId));
        return;
      }

      const nextTheme = availableThemes.find((theme) => theme.id === themeId);

      if (!nextTheme) {
        return;
      }

      setThemes(dedupeThemesById([...currentThemes, nextTheme]));
    },
    [availableThemes, setThemes, state.themes],
  );

  const handleCustomThemeAdd = () => {
    if (customThemeName.trim()) {
      const customTheme: PlanTheme = {
        id: `custom-${Date.now()}`,
        label: customThemeName.trim(),
        description:
          "Custom theme - content will be generated based on your specifications",
        content_ideas: [],
      };
      setThemes(dedupeThemesById([...state.themes, customTheme]));
      setCustomThemeName("");
    }
  };

  const isThemeSelected = (themeId: string) => {
    return state.themes.some((t) => t.id === themeId);
  };

  const canProceed = Boolean(state.month && state.themes.length > 0);

  return (
    <Stack spacing={{ xs: 3, md: 4 }}>
      <Stack spacing={1} sx={{ textAlign: "center" }}>
        <Typography level="h3">Plan Your Marketing Focus</Typography>
        <Typography
          color="neutral"
          level="body-md"
          sx={{ mx: "auto", maxWidth: 660 }}
        >
          Choose your marketing themes and target month. Select multiple themes
          to combine seasonal content with holidays and special events.
        </Typography>
      </Stack>

      <Card variant="outlined" sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Stack spacing={1.5}>
          <Stack spacing={0.5}>
            <Typography level="title-md">Target Month</Typography>
            <Typography color="neutral" level="body-sm">
              Select the month you want to plan marketing content for.
            </Typography>
          </Stack>
          <FormControl>
            <FormLabel>Campaign Month</FormLabel>
            <Input
              slotProps={{ input: { min: format(new Date(), "yyyy-MM") } }}
              type="month"
              value={state.month || ""}
              onChange={handleMonthChange}
            />
          </FormControl>
          <Typography color="neutral" level="body-xs">
            Choose any upcoming month to start building the planner calendar.
          </Typography>
        </Stack>
      </Card>

      {state.themes.length > 0 && (
        <Stack spacing={1}>
          <Typography level="title-sm">Selected themes</Typography>
          <Stack
            direction="row"
            spacing={1}
            sx={{ flexWrap: "wrap" }}
            useFlexGap
          >
            {state.themes.map((theme) => (
              <Chip
                color="primary"
                endDecorator={
                  <ChipDelete
                    aria-label={`Remove ${theme.label}`}
                    onClick={() => handleThemeToggle(theme.id)}
                  />
                }
                key={theme.id}
                variant="soft"
              >
                {theme.label}
              </Chip>
            ))}
          </Stack>
        </Stack>
      )}

      <Stack spacing={2}>
        <Stack spacing={0.5} sx={{ textAlign: "center" }}>
          <Typography level="title-lg">Choose Your Marketing Themes</Typography>
          <Typography color="neutral" level="body-sm">
            Select multiple themes to create rich, layered content that combines
            seasonal focus with special events
          </Typography>
        </Stack>

        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, minmax(0, 1fr))",
              md: "repeat(3, minmax(0, 1fr))",
            },
          }}
        >
          {loadingThemes ? (
            themeSkeletonIds.map((skeletonId) => (
              <ThemeSkeletonCard key={skeletonId} />
            ))
          ) : availableThemes.length > 0 ? (
            availableThemes.map((theme) => {
              const IconComponent =
                themeIcons[theme.id as keyof typeof themeIcons] || Leaf;
              const isSelected = isThemeSelected(theme.id);

              return (
                <Card
                  key={theme.id}
                  aria-pressed={isSelected}
                  onClick={() => handleThemeToggle(theme.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handleThemeToggle(theme.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  variant="outlined"
                  sx={{
                    ...themeCardSx,
                    bgcolor: isSelected
                      ? "primary.softBg"
                      : "background.surface",
                    borderColor: isSelected
                      ? "primary.500"
                      : "neutral.outlinedBorder",
                    cursor: "pointer",
                    position: "relative",
                    transition:
                      "background-color 160ms ease, border-color 160ms ease",
                    ...(!isSelected
                      ? {
                          "&:hover": {
                            bgcolor: "neutral.softHoverBg",
                            borderColor: "neutral.outlinedHoverBorder",
                          },
                        }
                      : undefined),
                  }}
                >
                  <Checkbox
                    checked={isSelected}
                    readOnly
                    tabIndex={-1}
                    sx={{
                      pointerEvents: "none",
                      position: "absolute",
                      right: 12,
                      top: 12,
                    }}
                  />
                  <Stack spacing={1.25} sx={{ pr: 3 }}>
                    <Box sx={{ color: "neutral.500", display: "inline-flex" }}>
                      <IconComponent aria-hidden="true" size={20} />
                    </Box>
                    <Stack spacing={0.5}>
                      <Typography level="title-sm">{theme.label}</Typography>
                      <Typography color="neutral" level="body-xs">
                        {theme.description}
                      </Typography>
                    </Stack>
                  </Stack>
                </Card>
              );
            })
          ) : (
            <Alert color="neutral" variant="soft" sx={{ gridColumn: "1 / -1" }}>
              No seasonal themes are available for this month yet. Add a custom
              theme below to continue.
            </Alert>
          )}
        </Box>

        <Card variant="outlined" sx={{ p: { xs: 2, sm: 2.5 } }}>
          <Stack spacing={1.5}>
            <Stack spacing={0.5}>
              <Typography level="title-sm">Custom theme</Typography>
              <Typography color="neutral" level="body-xs">
                Add a specific campaign focus when the suggested themes do not
                fit.
              </Typography>
            </Stack>
            <Input
              endDecorator={
                <Button
                  color="primary"
                  disabled={!customThemeName.trim()}
                  onClick={handleCustomThemeAdd}
                  size="sm"
                  startDecorator={<Plus aria-hidden="true" size={16} />}
                  variant="solid"
                >
                  Add
                </Button>
              }
              onChange={(event) => setCustomThemeName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  handleCustomThemeAdd();
                }
              }}
              placeholder="Enter a custom theme..."
              value={customThemeName}
            />
          </Stack>
        </Card>

        {hasMoreThemes && (
          <Box sx={{ display: "flex", justifyContent: "center" }}>
            <Button
              color="neutral"
              disabled={loadingMore}
              loading={loadingMore}
              onClick={handleLoadMore}
              variant="outlined"
            >
              Load More Themes
            </Button>
          </Box>
        )}
      </Stack>

      <Box sx={{ display: "flex", justifyContent: "center", pt: 1 }}>
        <Button
          color="primary"
          disabled={!canProceed}
          onClick={onNext}
          size="lg"
          variant="solid"
        >
          Continue to Content Generation
        </Button>
      </Box>
    </Stack>
  );
};
