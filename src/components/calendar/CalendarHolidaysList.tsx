import React from "react";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Sparkles } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyChip } from "@/components/joy/JoyChip";

interface CalendarHolidaysListProps {
  holidays: any[];
  holidayContentState: Record<
    string,
    { hasContent: boolean; contentCount: number; lastGenerated?: string }
  >;
  onHolidayAction: (holiday: any, action: "generate" | "review") => void;
}

export const CalendarHolidaysList = ({
  holidays,
  holidayContentState,
  onHolidayAction,
}: CalendarHolidaysListProps) => {
  if (holidays.length === 0) {
    return (
      <Sheet variant="soft" sx={{ borderRadius: "lg", p: 2.5 }}>
        <Typography level="body-sm" color="neutral">
          No upcoming holidays found.
        </Typography>
      </Sheet>
    );
  }

  return (
    <Stack spacing={1.25}>
      {holidays.slice(0, 8).map((holiday) => {
        const contentState = holidayContentState[holiday.id];
        const daysUntil = differenceInDays(
          new Date(holiday.holiday_date),
          new Date(),
        );
        const isUrgent = daysUntil <= 7;

        return (
          <Sheet
            key={holiday.id}
            variant={isUrgent ? "soft" : "outlined"}
            color={isUrgent ? "warning" : "neutral"}
            sx={{ borderRadius: "lg", p: 1.5 }}
          >
            <Stack spacing={1.25}>
              <Stack direction="row" justifyContent="space-between" spacing={1}>
                <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                  <Typography level="title-sm">
                    {holiday.holiday_name}
                  </Typography>
                  <Stack
                    direction="row"
                    spacing={0.75}
                    useFlexGap
                    flexWrap="wrap"
                  >
                    <JoyChip
                      color={isUrgent ? "warning" : "neutral"}
                      variant="soft"
                    >
                      {daysUntil === 0
                        ? "Today"
                        : daysUntil === 1
                          ? "Tomorrow"
                          : daysUntil > 0
                            ? `${daysUntil} days`
                            : "Past"}
                    </JoyChip>
                    <Typography level="body-xs" color="neutral">
                      {format(new Date(holiday.holiday_date), "MMM d")}
                    </Typography>
                  </Stack>
                </Stack>
                <JoyChip
                  color={contentState?.hasContent ? "success" : "neutral"}
                  variant="soft"
                >
                  {contentState?.contentCount || 0}/5 ready
                </JoyChip>
              </Stack>

              {holiday.description && (
                <Typography
                  level="body-xs"
                  color="neutral"
                  sx={{ lineHeight: 1.5 }}
                >
                  {holiday.description.length > 80
                    ? holiday.description.substring(0, 80) + "..."
                    : holiday.description}
                </Typography>
              )}

              <Stack direction="row" spacing={0.75}>
                <JoyButton
                  variant="solid"
                  color="primary"
                  startDecorator={<Sparkles size={14} />}
                  onClick={() => onHolidayAction(holiday, "generate")}
                >
                  Generate
                </JoyButton>
                <JoyButton
                  bloomVariant="outline"
                  color="neutral"
                  onClick={() => onHolidayAction(holiday, "review")}
                >
                  Review
                </JoyButton>
              </Stack>
            </Stack>
          </Sheet>
        );
      })}
    </Stack>
  );
};
