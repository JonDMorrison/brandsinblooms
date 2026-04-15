import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import IconButton from "@mui/joy/IconButton";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import {
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface DateStripProps {
  value: Date;
  onDateSelect: (date: Date) => void;
}

const createMonthOptions = (value: Date) => {
  const activeMonth = startOfMonth(value);

  return Array.from({ length: 4 }, (_, index) =>
    addMonths(activeMonth, index - 1),
  );
};

const createWeekDays = (value: Date) => {
  const weekStart = startOfWeek(value, { weekStartsOn: 1 });

  return eachDayOfInterval({
    start: weekStart,
    end: endOfWeek(value, { weekStartsOn: 1 }),
  });
};

const moveToMonth = (currentDate: Date, nextMonth: Date) => {
  const nextDate = new Date(currentDate);
  const requestedDay = currentDate.getDate();
  const lastDayOfMonth = new Date(
    nextMonth.getFullYear(),
    nextMonth.getMonth() + 1,
    0,
  ).getDate();

  nextDate.setFullYear(
    nextMonth.getFullYear(),
    nextMonth.getMonth(),
    Math.min(requestedDay, lastDayOfMonth),
  );
  return nextDate;
};

export function DateStrip({ value, onDateSelect }: DateStripProps) {
  const monthOptions = createMonthOptions(value);
  const weekDays = createWeekDays(value);

  return (
    <Sheet
      variant="outlined"
      sx={{
        borderRadius: "var(--joy-radius-xl)",
        borderColor: "neutral.200",
        backgroundColor: "#FFFFFF",
        px: { xs: 2, sm: 3 },
        py: { xs: 2, sm: 2.5 },
      }}
    >
      <Stack spacing={2}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          spacing={2}
        >
          <Box
            sx={{
              display: "flex",
              gap: 0.5,
              minWidth: 0,
              overflowX: "auto",
              scrollbarWidth: "none",
              "&::-webkit-scrollbar": {
                display: "none",
              },
            }}
          >
            {monthOptions.map((monthDate) => {
              const isActiveMonth = isSameMonth(monthDate, value);

              return (
                <Button
                  key={monthDate.toISOString()}
                  color={isActiveMonth ? "primary" : "neutral"}
                  onClick={() => onDateSelect(moveToMonth(value, monthDate))}
                  size="sm"
                  variant="plain"
                  sx={{
                    borderRadius: "999px",
                    px: 1.25,
                    py: 0.5,
                    fontWeight: isActiveMonth
                      ? "var(--joy-fontWeight-semibold)"
                      : "var(--joy-fontWeight-medium)",
                    borderBottom: "2px solid",
                    borderColor: isActiveMonth ? "primary.500" : "transparent",
                    color: isActiveMonth ? "primary.700" : "neutral.600",
                  }}
                >
                  {format(monthDate, "MMMM")}
                </Button>
              );
            })}
          </Box>

          <Stack direction="row" spacing={1}>
            <IconButton
              aria-label="Previous week"
              color="neutral"
              onClick={() => onDateSelect(addWeeks(value, -1))}
              size="sm"
              variant="outlined"
            >
              <ChevronLeft size={18} />
            </IconButton>
            <IconButton
              aria-label="Next week"
              color="neutral"
              onClick={() => onDateSelect(addWeeks(value, 1))}
              size="sm"
              variant="outlined"
            >
              <ChevronRight size={18} />
            </IconButton>
          </Stack>
        </Stack>

        <Stack
          direction="row"
          spacing={1}
          sx={{
            overflowX: "auto",
            pb: 0.5,
            scrollbarWidth: "none",
            "&::-webkit-scrollbar": {
              display: "none",
            },
          }}
        >
          {weekDays.map((day) => {
            const selected = isSameDay(day, value);
            const today = isToday(day);

            return (
              <Button
                key={day.toISOString()}
                color={selected ? "primary" : "neutral"}
                onClick={() => onDateSelect(day)}
                size="sm"
                variant="plain"
                sx={{
                  minWidth: 78,
                  px: 1.25,
                  py: 1,
                  borderRadius: "var(--joy-radius-lg)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 0.75,
                  backgroundColor: selected ? "primary.50" : "transparent",
                  border: "1px solid",
                  borderColor: selected ? "primary.200" : "transparent",
                  color: selected ? "primary.700" : "neutral.700",
                  "&:hover": {
                    backgroundColor: selected ? "primary.100" : "neutral.100",
                  },
                }}
              >
                <Typography level="body-xs" sx={{ color: "inherit" }}>
                  {format(day, "EEE")}
                </Typography>
                <Sheet
                  color="primary"
                  variant={today ? "solid" : "soft"}
                  sx={{
                    width: 34,
                    height: 34,
                    borderRadius: "50%",
                    display: "grid",
                    placeItems: "center",
                    backgroundColor: today
                      ? undefined
                      : selected
                        ? "primary.100"
                        : "neutral.100",
                  }}
                >
                  <Typography
                    level="title-sm"
                    sx={{
                      color: today
                        ? "common.white"
                        : selected
                          ? "primary.700"
                          : "neutral.700",
                    }}
                  >
                    {format(day, "d")}
                  </Typography>
                </Sheet>
              </Button>
            );
          })}
        </Stack>
      </Stack>
    </Sheet>
  );
}
