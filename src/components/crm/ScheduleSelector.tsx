import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/NativeSelect';
import { Calendar } from '@/components/ui/calendar';
import { Clock, Calendar as CalendarIcon, Send, ChevronDown } from 'lucide-react';
import { format, startOfDay } from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { cn } from '@/lib/utils';
import { CustomDropdown } from '@/components/ui/custom-dropdown';

export interface ScheduleOption {
  type: 'now' | 'scheduled';
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
  /**
   * When true, selecting an option inside the dropdown will immediately invoke `onCommit`.
   * This is used for sticky/mobile layouts where the primary Send/Schedule button may not be visible.
   */
  commitOnSelect?: boolean;
  /** Trigger the parent send/schedule flow (typically opens confirmation). */
  onCommit?: () => void;
}

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern (ET)' },
  { value: 'America/Chicago', label: 'Central (CT)' },
  { value: 'America/Denver', label: 'Mountain (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific (PT)' },
  { value: 'America/Vancouver', label: 'Vancouver (PT)' },
  { value: 'UTC', label: 'UTC' },
  { value: 'Europe/London', label: 'London (GMT)' },
];

/**
 * ScheduleSelector - Compact dropdown for "Send Now" vs "Schedule"
 */
export const ScheduleSelector: React.FC<ScheduleSelectorProps> = ({
  schedule,
  onScheduleChange,
  disabled = false,
  compact = false,
  commitOnSelect = false,
  onCommit,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  
  // Detect user's timezone for default
  const userTimezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  
  const [selectedTimezone, setSelectedTimezone] = useState(schedule.timezone || userTimezone);
  
  // Initialize selectedDate from schedule, converting from UTC if needed
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    if (schedule.date && schedule.type === 'scheduled') {
      return toZonedTime(schedule.date, schedule.timezone || userTimezone);
    }
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    return tomorrow;
  });
  
  const [selectedTime, setSelectedTime] = useState(() => {
    if (schedule.date && schedule.type === 'scheduled') {
      const localDate = toZonedTime(schedule.date, schedule.timezone || userTimezone);
      return `${localDate.getHours().toString().padStart(2, '0')}:${localDate.getMinutes().toString().padStart(2, '0')}`;
    }
    return '10:00';
  });

  const convertToUtc = (localDate: Date, timeStr: string): Date => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const dateWithTime = new Date(localDate);
    dateWithTime.setHours(hours, minutes, 0, 0);
    return fromZonedTime(dateWithTime, selectedTimezone);
  };

  const commitIfNeeded = () => {
    if (commitOnSelect && onCommit) onCommit();
  };

  const handleSendNow = () => {
    onScheduleChange({ type: 'now' });
    setIsOpen(false);
    commitIfNeeded();
  };

  const handleSchedule = () => {
    const utcDate = convertToUtc(selectedDate, selectedTime);
    onScheduleChange({
      type: 'scheduled',
      date: utcDate,
      timezone: selectedTimezone
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
    if (schedule.type === 'now') {
      return 'Send Now';
    }
    if (schedule.date) {
      const displayDate = toZonedTime(schedule.date, schedule.timezone || userTimezone);
      return `Scheduled: ${format(displayDate, 'MMM d, h:mm a')}`;
    }
    return 'Schedule';
  };

  const timezoneName = TIMEZONES.find(tz => tz.value === selectedTimezone)?.label || selectedTimezone;

  return (
    <CustomDropdown
      open={isOpen}
      onOpenChange={setIsOpen}
      align="end"
      contentClassName="z-[1000010] w-80 p-4"
    
      trigger={(triggerProps) => (
        <Button
          ref={triggerProps.ref as unknown as React.Ref<HTMLButtonElement>}
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={triggerProps.onClick}
          onKeyDown={triggerProps.onKeyDown}
          aria-expanded={triggerProps['aria-expanded']}
          aria-haspopup={triggerProps['aria-haspopup']}
          className={cn(
            'flex items-center gap-2',
            schedule.type === 'scheduled' && 'border-primary text-primary'
          )}
        >
          {schedule.type === 'now' ? (
            <Send className="h-4 w-4" />
          ) : (
            <CalendarIcon className="h-4 w-4" />
          )}
          <span className={cn(compact ? 'hidden' : 'hidden sm:inline')}>{getButtonLabel()}</span>
          <ChevronDown className="h-3 w-3" />
        </Button>
      )}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">When to send</Label>

          <Button
            variant={schedule.type === 'now' ? 'default' : 'outline'}
            size="sm"
            className="w-full justify-start"
            onClick={handleSendNow}
          >
            <Send className="h-4 w-4 mr-2" />
            Send immediately
          </Button>
        </div>

        <div className="border-t pt-4 space-y-3">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Schedule for later
          </Label>

          <div className="space-y-2">
            <div className="rounded-md border border-border p-2">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleDateSelect}
                disabled={isDateInPast}
                initialFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarIcon className="h-4 w-4" />
                <span>{format(selectedDate, 'MMM d')}</span>
              </div>

              <input
                type="time"
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                aria-label="Scheduled send time"
              />
            </div>
          </div>

          <NativeSelect
            value={selectedTimezone}
            onChange={(e) => setSelectedTimezone(e.target.value)}
            options={TIMEZONES}
            className="text-sm"
            aria-label="Timezone"
          />

          <p className="text-xs text-muted-foreground">
            Times shown in {timezoneName}.
          </p>

          <Button size="sm" className="w-full" onClick={handleSchedule}>
            <CalendarIcon className="h-4 w-4 mr-2" />
            Schedule Campaign
          </Button>
        </div>
      </div>
    </CustomDropdown>
  );
};
