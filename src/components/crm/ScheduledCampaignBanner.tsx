import React, { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Send, Lock, AlertTriangle, X } from 'lucide-react';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ScheduleSelector, ScheduleOption } from './ScheduleSelector';

interface ScheduledCampaignBannerProps {
  status: string;
  scheduledAt: string | null;
  timezone?: string;
  onEditSchedule: (newSchedule: ScheduleOption) => void;
  onSendNow: () => void;
  onUnschedule: () => void;
  isProcessing?: boolean;
}

export const ScheduledCampaignBanner: React.FC<ScheduledCampaignBannerProps> = ({
  status,
  scheduledAt,
  timezone,
  onEditSchedule,
  onSendNow,
  onUnschedule,
  isProcessing = false
}) => {
  const [showUnscheduleDialog, setShowUnscheduleDialog] = useState(false);
  const [showSendNowDialog, setShowSendNowDialog] = useState(false);

  // Don't show banner for non-scheduled campaigns
  if (status !== 'scheduled' && status !== 'sending') {
    return null;
  }

  const userTimezone = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const isPastDue = scheduledAt && new Date(scheduledAt) < new Date();
  const isSending = status === 'sending';

  const formatScheduledTime = () => {
    if (!scheduledAt) return 'Unknown time';
    try {
      const localDate = toZonedTime(new Date(scheduledAt), userTimezone);
      return format(localDate, "MMMM d, yyyy 'at' h:mm a");
    } catch {
      return scheduledAt;
    }
  };

  const getTimezoneName = () => {
    const timezoneLabels: Record<string, string> = {
      'America/New_York': 'ET',
      'America/Chicago': 'CT',
      'America/Denver': 'MT',
      'America/Los_Angeles': 'PT',
      'UTC': 'UTC',
      'Europe/London': 'GMT'
    };
    return timezoneLabels[userTimezone] || userTimezone;
  };

  const handleUnscheduleConfirm = () => {
    setShowUnscheduleDialog(false);
    onUnschedule();
  };

  const handleSendNowConfirm = () => {
    setShowSendNowDialog(false);
    onSendNow();
  };

  // Create current schedule for the selector
  const currentSchedule: ScheduleOption = {
    type: 'scheduled',
    date: scheduledAt ? new Date(scheduledAt) : undefined,
    timezone: userTimezone
  };

  if (isSending) {
    return (
      <Alert className="bg-blue-50 border-blue-200 mb-6">
        <Clock className="h-4 w-4 text-blue-600 animate-pulse" />
        <AlertTitle className="text-blue-800 flex items-center gap-2">
          Campaign Sending
          <Badge variant="default" className="bg-blue-600">In Progress</Badge>
        </AlertTitle>
        <AlertDescription className="text-blue-700">
          This campaign is currently being sent. Please wait for the process to complete.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <>
      <Alert className={`mb-6 ${isPastDue ? 'bg-amber-50 border-amber-200' : 'bg-primary/5 border-primary/20'}`}>
        <Calendar className={`h-4 w-4 ${isPastDue ? 'text-amber-600' : 'text-primary'}`} />
        <AlertTitle className={`${isPastDue ? 'text-amber-800' : 'text-primary'} flex items-center gap-2`}>
          {isPastDue ? (
            <>
              <AlertTriangle className="h-4 w-4" />
              Past Due - Will Send Soon
            </>
          ) : (
            'Scheduled to Send'
          )}
          <Badge variant={isPastDue ? 'outline' : 'default'} className={isPastDue ? 'border-amber-600 text-amber-700' : ''}>
            <Lock className="h-3 w-3 mr-1" />
            Locked
          </Badge>
        </AlertTitle>
        <AlertDescription className={`${isPastDue ? 'text-amber-700' : 'text-muted-foreground'} mt-2`}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="font-medium">
                {formatScheduledTime()} {getTimezoneName()}
              </p>
              {isPastDue && (
                <p className="text-sm mt-1">
                  This campaign will be sent on the next processing run.
                </p>
              )}
              <p className="text-sm mt-1 flex items-center gap-1">
                <Lock className="h-3 w-3" />
                Content editing is locked. Unschedule to make changes.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <ScheduleSelector
                schedule={currentSchedule}
                onScheduleChange={onEditSchedule}
                disabled={isProcessing}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSendNowDialog(true)}
                disabled={isProcessing}
              >
                <Send className="h-4 w-4 mr-1" />
                Send Now
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowUnscheduleDialog(true)}
                disabled={isProcessing}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="h-4 w-4 mr-1" />
                Unschedule
              </Button>
            </div>
          </div>
        </AlertDescription>
      </Alert>

      {/* Unschedule Confirmation Dialog */}
      <AlertDialog open={showUnscheduleDialog} onOpenChange={setShowUnscheduleDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unschedule Campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              This campaign will not send automatically. It will be returned to draft status
              and you can edit the content or reschedule it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnscheduleConfirm}>
              Unschedule
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Send Now Confirmation Dialog */}
      <AlertDialog open={showSendNowDialog} onOpenChange={setShowSendNowDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send Campaign Now?</AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately start sending the campaign to your audience.
              The scheduled time will be cleared.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSendNowConfirm} className="bg-primary">
              <Send className="h-4 w-4 mr-1" />
              Send Now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
