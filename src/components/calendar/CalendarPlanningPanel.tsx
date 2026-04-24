import React from "react";
import Box from "@mui/joy/Box";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Calendar, ExternalLink, Lightbulb, Megaphone } from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyDrawer } from "@/components/joy/JoyDrawer";
import { JoyChip } from "@/components/joy/JoyChip";
import { CalendarHolidaysList } from "./CalendarHolidaysList";
import { MASTER_WEEKLY_THEMES } from "@/data/masterWeeklyThemes";
import { getISOWeekNumber } from "@/utils/dateUtils";

interface CalendarPlanningPanelProps {
  open: boolean;
  inline?: boolean;
  currentDate: Date;
  campaigns: any[];
  holidays: any[];
  holidayContentState: Record<
    string,
    { hasContent: boolean; contentCount: number; lastGenerated?: string }
  >;
  onThemeSchedule: (theme: any, date: Date) => void;
  onHolidayAction: (holiday: any, action: "generate" | "review") => void;
  onOpenThemesReference: () => void;
  onClose: () => void;
}

export const CalendarPlanningPanel = ({
  open,
  inline = false,
  currentDate,
  campaigns,
  holidays,
  holidayContentState,
  onThemeSchedule,
  onHolidayAction,
  onOpenThemesReference,
  onClose,
}: CalendarPlanningPanelProps) => {
  const currentWeek = getISOWeekNumber(currentDate);
  const currentTheme =
    MASTER_WEEKLY_THEMES.find((theme) => theme.week_number === currentWeek) ??
    MASTER_WEEKLY_THEMES[0];
  const upcomingHolidays = holidays.slice(0, 6);
  const activeCampaigns = campaigns
    .filter((campaign) => campaign.start_date)
    .sort(
      (left, right) =>
        new Date(left.start_date).getTime() -
        new Date(right.start_date).getTime(),
    )
    .slice(0, 5);

  if (!open) {
    return null;
  }

  const content = (
    <Stack spacing={1.5}>
      <Sheet variant="soft" color="primary" sx={{ borderRadius: "xl", p: 1.5 }}>
        <Stack spacing={1}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
          >
            <Stack spacing={0.375}>
              <Typography
                level="body-xs"
                textTransform="uppercase"
                fontWeight="lg"
              >
                Current Week Theme
              </Typography>
              <Typography level="title-md">{currentTheme.title}</Typography>
            </Stack>
            <JoyChip color="primary" variant="solid">
              Week {currentTheme.week_number}
            </JoyChip>
          </Stack>
          <Typography level="body-sm">{currentTheme.seasonal_focus}</Typography>
          <Typography level="body-xs" color="neutral">
            {currentTheme.content_ideas}
          </Typography>
          <Stack direction="row" spacing={0.75}>
            <JoyButton
              startDecorator={<Lightbulb size={14} />}
              onClick={() => onThemeSchedule(currentTheme, currentDate)}
            >
              Schedule Theme
            </JoyButton>
            <JoyButton
              bloomVariant="outline"
              color="neutral"
              startDecorator={<ExternalLink size={14} />}
              onClick={onOpenThemesReference}
            >
              Browse Themes
            </JoyButton>
          </Stack>
        </Stack>
      </Sheet>

      <Sheet variant="outlined" sx={{ borderRadius: "xl", p: 1.5 }}>
        <Stack spacing={1.25}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Calendar size={16} />
            <Typography level="title-sm">Upcoming Holidays</Typography>
          </Stack>
          <CalendarHolidaysList
            holidays={upcomingHolidays}
            holidayContentState={holidayContentState}
            onHolidayAction={onHolidayAction}
          />
        </Stack>
      </Sheet>

      <Sheet variant="outlined" sx={{ borderRadius: "xl", p: 1.5 }}>
        <Stack spacing={1.25}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Megaphone size={16} />
            <Typography level="title-sm">Active Campaigns</Typography>
          </Stack>
          {activeCampaigns.length > 0 ? (
            <Stack spacing={1}>
              {activeCampaigns.map((campaign) => (
                <Sheet
                  key={campaign.id}
                  variant="soft"
                  color="success"
                  sx={{ borderRadius: "lg", p: 1.25 }}
                >
                  <Typography level="body-sm" fontWeight="lg">
                    {campaign.title}
                  </Typography>
                  <Typography level="body-xs" color="neutral">
                    {campaign.start_date
                      ? new Date(campaign.start_date).toLocaleDateString()
                      : "No date"}
                  </Typography>
                </Sheet>
              ))}
            </Stack>
          ) : (
            <Typography level="body-sm" color="neutral">
              No active campaigns yet.
            </Typography>
          )}
        </Stack>
      </Sheet>
    </Stack>
  );

  if (inline) {
    return (
      <Box sx={{ width: 340, flexShrink: 0 }}>
        <Sheet variant="plain" sx={{ position: "sticky", top: 88 }}>
          {content}
        </Sheet>
      </Box>
    );
  }

  return (
    <JoyDrawer
      open={open}
      onClose={() => onClose()}
      anchor="right"
      size="md"
      title="Planning Hub"
      description="Themes, holidays, and active campaigns"
      startDecorator={<Calendar size={18} />}
    >
      {content}
    </JoyDrawer>
  );
};
