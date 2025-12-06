
import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/NativeSelect';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Clock, Calendar as CalendarIcon, Globe, Zap } from 'lucide-react';
import { format, setHours, setMinutes, startOfDay } from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { cn } from '@/lib/utils';

interface ScheduleOption {
  type: 'now' | 'optimal' | 'custom';
  /** The scheduled date/time in UTC */
  date?: Date;
  /** The timezone used for display/scheduling */
  timezone?: string;
  sendInRecipientTimezone?: boolean;
}

interface TimezoneSchedulerProps {
  onScheduleChange: (schedule: ScheduleOption) => void;
  defaultSchedule?: ScheduleOption;
}

const TIMEZONES = [
  { value: 'America/Vancouver', label: 'Vancouver (PT)' },
  { value: 'America/New_York', label: 'Eastern (ET)' },
  { value: 'America/Chicago', label: 'Central (CT)' },
  { value: 'America/Denver', label: 'Mountain (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific (PT)' },
  { value: 'UTC', label: 'UTC' },
  { value: 'Europe/London', label: 'London (GMT)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEDT)' },
];

const OPTIMAL_TIMES = [
  { label: 'Morning (9:00 AM)', hours: 9, minutes: 0 },
  { label: 'Lunch (12:00 PM)', hours: 12, minutes: 0 },
  { label: 'Afternoon (2:00 PM)', hours: 14, minutes: 0 },
  { label: 'Evening (6:00 PM)', hours: 18, minutes: 0 },
];

/**
 * TimezoneScheduler - Handles timezone-aware scheduling
 * 
 * CRITICAL: All dates are stored in UTC. The UI displays times in selectedTimezone.
 * 
 * Flow:
 * 1. User selects date/time in their timezone (selectedTimezone)
 * 2. We convert to UTC using fromZonedTime() for storage
 * 3. When displaying, we convert from UTC back to selectedTimezone using toZonedTime()
 */
export const TimezoneScheduler = ({ onScheduleChange, defaultSchedule }: TimezoneSchedulerProps) => {
  const [scheduleType, setScheduleType] = useState<ScheduleOption['type']>(defaultSchedule?.type || 'optimal');
  
  // Detect user's timezone for default
  const userTimezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  
  const [selectedTimezone, setSelectedTimezone] = useState(
    defaultSchedule?.timezone || userTimezone
  );
  
  // Initialize selectedDate from defaultSchedule, converting from UTC if needed
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    if (defaultSchedule?.date) {
      // Convert stored UTC date to selected timezone for display
      return toZonedTime(defaultSchedule.date, defaultSchedule.timezone || userTimezone);
    }
    // Default to today at noon in the selected timezone
    const now = new Date();
    now.setHours(12, 0, 0, 0);
    return now;
  });
  
  const [selectedTime, setSelectedTime] = useState(() => {
    if (defaultSchedule?.date && scheduleType === 'custom') {
      // Convert from UTC to selected timezone for initial display
      const localDate = toZonedTime(defaultSchedule.date, defaultSchedule.timezone || userTimezone);
      return `${localDate.getHours().toString().padStart(2, '0')}:${localDate.getMinutes().toString().padStart(2, '0')}`;
    }
    return '14:00'; // 2 PM default
  });
  
  const [sendInRecipientTimezone, setSendInRecipientTimezone] = useState(
    defaultSchedule?.sendInRecipientTimezone || false
  );
  const [optimalTime, setOptimalTime] = useState('14:00');

  const userTimezoneLabel = TIMEZONES.find(tz => tz.value === userTimezone)?.label || userTimezone;

  /**
   * Convert a local date/time in selectedTimezone to UTC
   * This is the value that gets stored in the database
   */
  const convertToUtc = (localDate: Date, timeStr: string): Date => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    
    // Create a date object with the selected date and time
    const dateWithTime = new Date(localDate);
    dateWithTime.setHours(hours, minutes, 0, 0);
    
    // Convert from selectedTimezone to UTC
    // fromZonedTime interprets the input as being in the specified timezone
    // and returns the equivalent UTC time
    const utcDate = fromZonedTime(dateWithTime, selectedTimezone);
    
    console.log(`🕐 Timezone conversion: ${format(dateWithTime, 'PPP p')} in ${selectedTimezone} → UTC: ${utcDate.toISOString()}`);
    
    return utcDate;
  };

  /**
   * Convert a UTC date back to the selected timezone for display
   */
  const convertFromUtc = (utcDate: Date): Date => {
    return toZonedTime(utcDate, selectedTimezone);
  };

  // Update schedule whenever relevant state changes
  useEffect(() => {
    const schedule: ScheduleOption = {
      type: scheduleType,
      timezone: selectedTimezone,
      sendInRecipientTimezone
    };

    // Create local convertToUtc to ensure we use current selectedTimezone
    const getUtcDate = (localDate: Date, timeStr: string): Date => {
      const [hours, minutes] = timeStr.split(':').map(Number);
      const dateWithTime = new Date(localDate);
      dateWithTime.setHours(hours, minutes, 0, 0);
      return fromZonedTime(dateWithTime, selectedTimezone);
    };

    if (scheduleType === 'custom') {
      // Convert the local date/time to UTC for storage
      schedule.date = getUtcDate(selectedDate, selectedTime);
    } else if (scheduleType === 'optimal') {
      // For optimal, use today's date with the optimal time, converted to UTC
      const today = new Date();
      today.setHours(12, 0, 0, 0); // Use noon to avoid DST issues
      schedule.date = getUtcDate(today, optimalTime);
    } else {
      // 'now' - just use current time (already in UTC when stored)
      schedule.date = new Date();
    }

    console.log(`📅 Schedule updated: type=${scheduleType}, UTC=${schedule.date?.toISOString()}, timezone=${selectedTimezone}`);
    onScheduleChange(schedule);
  }, [scheduleType, selectedDate, selectedTime, selectedTimezone, sendInRecipientTimezone, optimalTime, onScheduleChange]);

  /**
   * Handle calendar date selection
   * We normalize to noon to avoid DST edge cases at midnight
   */
  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    
    // Normalize to noon in the picked date to avoid DST edge cases
    const normalizedDate = new Date(date);
    normalizedDate.setHours(12, 0, 0, 0);
    
    console.log(`📆 Date selected: ${format(normalizedDate, 'PPP')} (normalized to noon)`);
    setSelectedDate(normalizedDate);
  };

  /**
   * Generate the schedule preview text
   * Always converts from UTC to selectedTimezone for display
   */
  const getSchedulePreview = () => {
    if (scheduleType === 'now') {
      return 'Sending immediately';
    }

    // Build the scheduled date in UTC first
    let utcDate: Date;
    if (scheduleType === 'custom') {
      utcDate = convertToUtc(selectedDate, selectedTime);
    } else {
      const today = new Date();
      today.setHours(12, 0, 0, 0);
      utcDate = convertToUtc(today, optimalTime);
    }
    
    // Convert UTC back to selected timezone for display
    const displayDate = convertFromUtc(utcDate);
    
    const timezoneName = TIMEZONES.find(tz => tz.value === selectedTimezone)?.label || selectedTimezone;
    
    return (
      <div className="space-y-1">
        <div className="font-medium">
          {format(displayDate, 'EEEE, MMMM d, yyyy')} at {format(displayDate, 'h:mm a')}
        </div>
        <div className="text-sm text-muted-foreground">
          {timezoneName}
          {sendInRecipientTimezone && ' (or recipient\'s timezone)'}
        </div>
        <div className="text-xs text-muted-foreground">
          UTC: {utcDate.toISOString()}
        </div>
      </div>
    );
  };

  /**
   * Check if a date is in the past (relative to user's current timezone)
   */
  const isDateInPast = (date: Date): boolean => {
    const today = startOfDay(new Date());
    const checkDate = startOfDay(date);
    return checkDate < today;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Schedule Email
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Schedule Type Selection */}
        <div className="space-y-3">
          <Label className="text-base font-medium">When to send</Label>
          <RadioGroup 
            value={scheduleType} 
            onValueChange={(value) => setScheduleType(value as ScheduleOption['type'])}
            className="space-y-3"
          >
            <div className="flex items-center space-x-2 p-3 rounded-lg border">
              <RadioGroupItem value="now" id="now" />
              <div className="flex-1">
                <Label htmlFor="now" className="flex items-center gap-2 cursor-pointer">
                  <Zap className="h-4 w-4 text-orange-500" />
                  Send Now
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Send immediately after creating the campaign
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 p-3 rounded-lg border">
              <RadioGroupItem value="optimal" id="optimal" />
              <div className="flex-1">
                <Label htmlFor="optimal" className="flex items-center gap-2 cursor-pointer">
                  <Clock className="h-4 w-4 text-blue-500" />
                  Optimal Time
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Send at the best time for engagement
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 p-3 rounded-lg border">
              <RadioGroupItem value="custom" id="custom" />
              <div className="flex-1">
                <Label htmlFor="custom" className="flex items-center gap-2 cursor-pointer">
                  <CalendarIcon className="h-4 w-4 text-green-500" />
                  Custom Schedule
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Choose your own date and time
                </p>
              </div>
            </div>
          </RadioGroup>
        </div>

        {/* Optimal Time Selection */}
        {scheduleType === 'optimal' && (
          <div className="space-y-3">
            <Label>Preferred time</Label>
            <NativeSelect
              value={optimalTime}
              onChange={(e) => setOptimalTime(e.target.value)}
              options={OPTIMAL_TIMES.map(time => ({
                value: `${time.hours}:${time.minutes.toString().padStart(2, '0')}`,
                label: time.label
              }))}
            />
          </div>
        )}

        {/* Custom Date/Time Selection */}
        {scheduleType === 'custom' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'justify-start text-left font-normal',
                        !selectedDate && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDate ? format(selectedDate, 'PPP') : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={handleDateSelect}
                      disabled={isDateInPast}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Time ({TIMEZONES.find(tz => tz.value === selectedTimezone)?.label || selectedTimezone})</Label>
                <input
                  type="time"
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            </div>
          </div>
        )}

        {/* Timezone Selection */}
        {scheduleType !== 'now' && (
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Timezone
            </Label>
            <NativeSelect
              value={selectedTimezone}
              onChange={(e) => setSelectedTimezone(e.target.value)}
              options={[
                { value: userTimezone, label: `Your timezone: ${userTimezoneLabel}` },
                ...TIMEZONES.filter(tz => tz.value !== userTimezone)
              ]}
            />
          </div>
        )}

        {/* Advanced Options */}
        {scheduleType !== 'now' && (
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="recipient-timezone"
                checked={sendInRecipientTimezone}
                onChange={(e) => setSendInRecipientTimezone(e.target.checked)}
                className="rounded border-gray-300"
              />
              <Label htmlFor="recipient-timezone" className="text-sm">
                Send in each recipient's timezone (when available)
              </Label>
            </div>
            <p className="text-xs text-muted-foreground ml-6">
              This will attempt to send emails at the scheduled time in each recipient's local timezone
            </p>
          </div>
        )}

        {/* Schedule Preview */}
        <div className="p-4 bg-muted rounded-lg">
          <Label className="text-sm font-medium text-muted-foreground">Schedule Preview</Label>
          <div className="mt-1">
            {getSchedulePreview()}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
