import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { Calendar } from "@/components/ui/calendar";
import { Clock, Calendar as CalendarIcon, ChevronDown, X } from "lucide-react";
import { addMinutes, format, startOfDay } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { cn } from "@/lib/utils";
import { CustomDropdown } from "@/components/ui/custom-dropdown";

export interface ScheduleOption {
  type: "now" | "scheduled";
  /** The scheduled date/time in UTC */
  date?: Date;
  /** The timezone used for display/scheduling */
  timezone?: string;
}

interface ScheduleSelectorProps {
  schedule: ScheduleOption;
  onScheduleChange: (schedule: ScheduleOption) => void;
  disabled?: boolean;
  compact?: boolean;
  /** When true, shows a button that clears the schedule and returns to Send Now. */
  allowClearSchedule?: boolean;
  /**
   * When true, selecting an option inside the dropdown will immediately invoke `onCommit`.
   * This is used for sticky/mobile layouts where the primary Send/Schedule button may not be visible.
   */
  commitOnSelect?: boolean;
  /** Trigger the parent send/schedule flow (typically opens confirmation). */
  onCommit?: () => void;
}

const TIMEZONES = [
  { value: "America/New_York", label: "Eastern (ET)" },
  { value: "America/Chicago", label: "Central (CT)" },
  { value: "America/Denver", label: "Mountain (MT)" },
  { value: "America/Los_Angeles", label: "Pacific (PT)" },
  { value: "America/Vancouver", label: "Vancouver (PT)" },
  { value: "UTC", label: "UTC" },
  { value: "Europe/London", label: "London (GMT)" },
];

const QUICK_SCHEDULE_MINUTES = [2, 5, 10, 15, 20, 30, 45, 60] as const;

/**
 * ScheduleSelector - Compact dropdown for "Send Now" vs "Schedule"
 */
export const ScheduleSelector: React.FC<ScheduleSelectorProps> = ({
  schedule,
  onScheduleChange,
  disabled = false,
  compact = false,
  allowClearSchedule = true,
  commitOnSelect = false,
  onCommit,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Detect user's timezone for default
  const userTimezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    [],
  );

  const [selectedTimezone, setSelectedTimezone] = useState(
    schedule.timezone || userTimezone,
  );

  // Initialize selectedDate from schedule, converting from UTC if needed
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    if (schedule.date && schedule.type === "scheduled") {
      return toZonedTime(schedule.date, schedule.timezone || userTimezone);
    }
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    return tomorrow;
  });

  const [selectedTime, setSelectedTime] = useState(() => {
    if (schedule.date && schedule.type === "scheduled") {
      const localDate = toZonedTime(
        schedule.date,
        schedule.timezone || userTimezone,
      );
      return `${localDate.getHours().toString().padStart(2, "0")}:${localDate.getMinutes().toString().padStart(2, "0")}`;
    }
    return "10:00";
  });

  const formatTime = (date: Date) => {
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  const convertToUtc = (localDate: Date, timeStr: string): Date => {
    const [hours, minutes] = timeStr.split(":").map(Number);
    const dateWithTime = new Date(localDate);
    dateWithTime.setHours(hours, minutes, 0, 0);
    return fromZonedTime(dateWithTime, selectedTimezone);
  };

  const commitIfNeeded = () => {
    if (commitOnSelect && onCommit) onCommit();
  };

  const handleSendNow = () => {
    onScheduleChange({ type: "now" });
    setIsOpen(false);
    commitIfNeeded();
  };

  const handleSchedule = () => {
    const utcDate = convertToUtc(selectedDate, selectedTime);
    onScheduleChange({
      type: "scheduled",
      date: utcDate,
      timezone: selectedTimezone,
    });
    setIsOpen(false);
    commitIfNeeded();
  };

  const handleQuickSchedule = (minutesFromNow: number) => {
    const zonedNow = toZonedTime(new Date(), selectedTimezone);
    const targetZoned = addMinutes(zonedNow, minutesFromNow);

    const timeStr = formatTime(targetZoned);
    const normalizedDate = new Date(targetZoned);
    normalizedDate.setHours(12, 0, 0, 0);

    setSelectedDate(normalizedDate);
    setSelectedTime(timeStr);

    const utcDate = fromZonedTime(targetZoned, selectedTimezone);
    onScheduleChange({
      type: "scheduled",
      date: utcDate,
      timezone: selectedTimezone,
    });
    setIsOpen(false);
    commitIfNeeded();
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    const normalizedDate = new Date(date);
    normalizedDate.setHours(12, 0, 0, 0);
    setSelectedDate(normalizedDate);
  };

  const isDateInPast = (date: Date): boolean => {
    const today = startOfDay(new Date());
    const checkDate = startOfDay(date);
    return checkDate < today;
  };

  const getButtonLabel = () => {
    if (schedule.type === "scheduled" && schedule.date) {
      const displayDate = toZonedTime(
        schedule.date,
        schedule.timezone || userTimezone,
      );
      return `Scheduled: ${format(displayDate, "MMM d, h:mm a")}`;
    }
    return "Schedule";
  };

  const timezoneName =
    TIMEZONES.find((tz) => tz.value === selectedTimezone)?.label ||
    selectedTimezone;

  return (
    <CustomDropdown
      open={isOpen}
      onOpenChange={setIsOpen}
      align="end"
      contentClassName="z-[1000010] w-96 p-5"
      trigger={(triggerProps) => (
        <Button
          ref={triggerProps.ref as unknown as React.Ref<HTMLButtonElement>}
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={triggerProps.onClick}
          onKeyDown={triggerProps.onKeyDown}
          aria-expanded={triggerProps["aria-expanded"]}
          aria-haspopup={triggerProps["aria-haspopup"]}
          className={cn(
            "flex items-center gap-2",
            schedule.type === "scheduled" && "border-primary text-primary",
          )}
        >
          <CalendarIcon className="h-4 w-4" />
          <span className={cn(compact ? "hidden" : "hidden sm:inline")}>
            {getButtonLabel()}
          </span>
          <ChevronDown className="h-3 w-3" />
        </Button>
      )}
    >
      <div className="space-y-5">
        {/* Instructional header */}
        <div className="space-y-1.5">
          <h3 className="font-semibold text-base flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-primary" />
            Schedule Campaign
          </h3>
          <p className="text-sm text-muted-foreground">
            Pick a date and time to send your campaign automatically.
          </p>
        </div>

        {/* Calendar */}
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleDateSelect}
          disabled={isDateInPast}
          captionLayout="label"
          hideNavigation={false}
          initialFocus
          className="pointer-events-auto"
        />

        {/* Quick Schedule */}
        <div className="rounded-lg border border-border bg-background p-4 space-y-3">
          <Label className="text-sm font-medium">Schedule in</Label>
          <div className="flex flex-wrap gap-2">
            {QUICK_SCHEDULE_MINUTES.map((minutes) => (
              <Button
                key={minutes}
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={() => handleQuickSchedule(minutes)}
                className="h-8 px-3"
              >
                +{minutes}m
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Uses {timezoneName}.</p>
        </div>

        {/* Date & Time Row */}
        <div className="rounded-lg border border-border bg-background p-4 space-y-4">
          <div className="flex items-center justify-between gap-4">
            {/* Selected Date */}
            <div className="flex items-center gap-3 flex-1">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <CalendarIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">
                  Date
                </p>
                <p className="text-sm font-semibold">
                  {format(selectedDate, "EEEE, MMM d")}
                </p>
              </div>
            </div>

            {/* Time Picker */}
            <div className="flex items-center gap-3 flex-1">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground font-medium">
                  Time
                </p>
                <input
                  type="time"
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                  className="h-7 w-full bg-transparent text-sm font-semibold focus:outline-none"
                  aria-label="Scheduled send time"
                />
              </div>
            </div>
          </div>

          {/* Timezone */}
          <div className="pt-3 border-t border-border">
            <NativeSelect
              value={selectedTimezone}
              onChange={(e) => setSelectedTimezone(e.target.value)}
              options={TIMEZONES}
              className="text-sm"
              aria-label="Timezone"
            />
            <p className="text-xs text-muted-foreground mt-2">
              All times shown in {timezoneName}.
            </p>
          </div>
        </div>

        {/* Submit Button */}
        <div className="space-y-2">
          {allowClearSchedule && schedule.type === "scheduled" && (
            <Button
              type="button"
              variant="outline"
              size="default"
              className="w-full text-destructive"
              onClick={handleSendNow}
              disabled={disabled}
            >
              <X className="h-4 w-4 mr-2" />
              Remove Schedule
            </Button>
          )}

          <Button size="default" className="w-full" onClick={handleSchedule}>
            <CalendarIcon className="h-4 w-4 mr-2" />
            Schedule Campaign
          </Button>
        </div>
      </div>
    </CustomDropdown>
  );
};
