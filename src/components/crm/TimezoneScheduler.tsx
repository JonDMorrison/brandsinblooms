
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Clock, Calendar as CalendarIcon, Globe, Zap } from 'lucide-react';
import { format, addDays, setHours, setMinutes } from 'date-fns';
import { cn } from '@/lib/utils';

interface ScheduleOption {
  type: 'now' | 'optimal' | 'custom';
  date?: Date;
  timezone?: string;
  sendInRecipientTimezone?: boolean;
}

interface TimezoneSchedulerProps {
  onScheduleChange: (schedule: ScheduleOption) => void;
  defaultSchedule?: ScheduleOption;
}

const TIMEZONES = [
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

export const TimezoneScheduler = ({ onScheduleChange, defaultSchedule }: TimezoneSchedulerProps) => {
  const [scheduleType, setScheduleType] = useState<ScheduleOption['type']>(defaultSchedule?.type || 'optimal');
  const [selectedDate, setSelectedDate] = useState<Date>(defaultSchedule?.date || new Date());
  const [selectedTime, setSelectedTime] = useState('14:00'); // 2 PM default
  const [selectedTimezone, setSelectedTimezone] = useState(
    defaultSchedule?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
  );
  const [sendInRecipientTimezone, setSendInRecipientTimezone] = useState(
    defaultSchedule?.sendInRecipientTimezone || false
  );
  const [optimalTime, setOptimalTime] = useState('14:00');

  // Detect user's timezone
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const userTimezoneLabel = TIMEZONES.find(tz => tz.value === userTimezone)?.label || userTimezone;

  useEffect(() => {
    const schedule: ScheduleOption = {
      type: scheduleType,
      timezone: selectedTimezone,
      sendInRecipientTimezone
    };

    if (scheduleType === 'custom') {
      const [hours, minutes] = selectedTime.split(':').map(Number);
      const scheduledDate = setMinutes(setHours(selectedDate, hours), minutes);
      schedule.date = scheduledDate;
    } else if (scheduleType === 'optimal') {
      const [hours, minutes] = optimalTime.split(':').map(Number);
      const scheduledDate = setMinutes(setHours(new Date(), hours), minutes);
      schedule.date = scheduledDate;
    } else {
      schedule.date = new Date();
    }

    onScheduleChange(schedule);
  }, [scheduleType, selectedDate, selectedTime, selectedTimezone, sendInRecipientTimezone, optimalTime]);

  const getSchedulePreview = () => {
    if (scheduleType === 'now') {
      return 'Sending immediately';
    }

    const date = scheduleType === 'custom' ? selectedDate : new Date();
    const timeStr = scheduleType === 'custom' ? selectedTime : optimalTime;
    const [hours, minutes] = timeStr.split(':').map(Number);
    const scheduledDate = setMinutes(setHours(date, hours), minutes);

    const timezoneName = TIMEZONES.find(tz => tz.value === selectedTimezone)?.label || selectedTimezone;
    
    return (
      <div className="space-y-1">
        <div className="font-medium">
          {format(scheduledDate, 'EEEE, MMMM d, yyyy')} at {format(scheduledDate, 'h:mm a')}
        </div>
        <div className="text-sm text-muted-foreground">
          {timezoneName}
          {sendInRecipientTimezone && ' (or recipient\'s timezone)'}
        </div>
      </div>
    );
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
            <Select value={optimalTime} onValueChange={setOptimalTime}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPTIMAL_TIMES.map((time) => (
                  <SelectItem 
                    key={`${time.hours}:${time.minutes.toString().padStart(2, '0')}`}
                    value={`${time.hours}:${time.minutes.toString().padStart(2, '0')}`}
                  >
                    {time.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                      onSelect={(date) => date && setSelectedDate(date)}
                      disabled={(date) => date < new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Time</Label>
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
            <Select value={selectedTimezone} onValueChange={setSelectedTimezone}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={userTimezone}>
                  <span className="font-medium">Your timezone: {userTimezoneLabel}</span>
                </SelectItem>
                {TIMEZONES.filter(tz => tz.value !== userTimezone).map((timezone) => (
                  <SelectItem key={timezone.value} value={timezone.value}>
                    {timezone.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
