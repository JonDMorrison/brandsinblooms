import Stack from "@mui/joy/Stack";
import Sheet from "@mui/joy/Sheet";
import Typography from "@mui/joy/Typography";
import CircularProgress from "@mui/joy/CircularProgress";
import Divider from "@mui/joy/Divider";
import { CalendarDays, RefreshCcw } from "lucide-react";
import { getDateForWeek } from "@/utils/dateUtils";
import { useWeeklyThemes, type WeeklyTheme } from "@/hooks/useWeeklyThemes";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyChip } from "@/components/joy/JoyChip";
import {
  JoyDialog,
  JoyDialogActions,
  JoyDialogContent,
} from "@/components/joy/JoyDialog";

interface CalendarWeeklyThemesDialogProps {
  open: boolean;
  onClose: () => void;
  onScheduleTheme?: (theme: WeeklyTheme, date: Date) => void;
  onRefresh?: () => void;
}

export function CalendarWeeklyThemesDialog({
  open,
  onClose,
  onScheduleTheme,
  onRefresh,
}: CalendarWeeklyThemesDialogProps) {
  const { themes, loading, refreshThemes } = useWeeklyThemes();

  return (
    <JoyDialog
      open={open}
      onClose={() => onClose()}
      title="Weekly Themes"
      description="Reference and schedule the current weekly merchandising themes"
      size="xl"
      startDecorator={<CalendarDays size={18} />}
    >
      <JoyDialogContent>
        {loading ? (
          <Stack
            alignItems="center"
            justifyContent="center"
            sx={{ minHeight: 240 }}
          >
            <CircularProgress size="lg" />
          </Stack>
        ) : (
          <Stack spacing={1.25}>
            {themes.map((theme) => (
              <Sheet
                key={theme.id}
                variant="outlined"
                sx={{ borderRadius: "lg", p: 1.5 }}
              >
                <Stack spacing={1}>
                  <Stack
                    direction={{ xs: "column", md: "row" }}
                    spacing={1}
                    justifyContent="space-between"
                  >
                    <Stack spacing={0.5}>
                      <Stack
                        direction="row"
                        spacing={0.75}
                        useFlexGap
                        flexWrap="wrap"
                      >
                        <Typography level="title-sm">{theme.title}</Typography>
                        {theme.label ? (
                          <JoyChip
                            color={
                              theme.label === "Current" ? "primary" : "neutral"
                            }
                            variant="soft"
                          >
                            {theme.label}
                          </JoyChip>
                        ) : null}
                        {theme.campaignId ? (
                          <JoyChip color="success" variant="soft">
                            Scheduled
                          </JoyChip>
                        ) : null}
                      </Stack>
                      <Typography level="body-sm" color="neutral">
                        Week {theme.weekNumber}
                      </Typography>
                    </Stack>
                    {onScheduleTheme ? (
                      <JoyButton
                        color="primary"
                        bloomVariant="outline"
                        onClick={() =>
                          onScheduleTheme(
                            theme,
                            getDateForWeek(theme.weekNumber),
                          )
                        }
                      >
                        Schedule Theme
                      </JoyButton>
                    ) : null}
                  </Stack>
                  <Divider />
                  <Typography level="body-sm">{theme.description}</Typography>
                  <Typography level="body-xs" color="neutral">
                    {theme.teaser}
                  </Typography>
                  <Stack
                    direction="row"
                    spacing={0.75}
                    useFlexGap
                    flexWrap="wrap"
                  >
                    {theme.tags.map((tag) => (
                      <JoyChip key={tag} color="neutral" variant="soft">
                        {tag}
                      </JoyChip>
                    ))}
                  </Stack>
                </Stack>
              </Sheet>
            ))}
          </Stack>
        )}
      </JoyDialogContent>
      <JoyDialogActions>
        <JoyButton
          color="neutral"
          bloomVariant="ghost"
          onClick={() => onClose()}
        >
          Close
        </JoyButton>
        <JoyButton
          color="neutral"
          bloomVariant="outline"
          startDecorator={<RefreshCcw size={14} />}
          onClick={() => {
            void refreshThemes();
            onRefresh?.();
          }}
        >
          Refresh
        </JoyButton>
      </JoyDialogActions>
    </JoyDialog>
  );
}
