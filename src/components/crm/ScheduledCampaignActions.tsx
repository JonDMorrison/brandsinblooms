import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  MoreHorizontal, 
  Calendar, 
  Send, 
  X, 
  Clock,
  AlertTriangle,
  Eye,
  Copy
} from 'lucide-react';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { ScheduleSelector, ScheduleOption } from './ScheduleSelector';
import { 
  updateCampaignSchedule, 
  unscheduleCampaign, 
  sendScheduledCampaignNow 
} from '@/utils/crmCampaignService';

interface ScheduledCampaignActionsProps {
  campaign: {
    id: string;
    name: string;
    status: string;
    scheduled_at: string | null;
    metadata?: { scheduled_timezone?: string };
  };
  onActionComplete: () => void;
  onView: () => void;
  onDuplicate: () => void;
}

export const ScheduledCampaignActions: React.FC<ScheduledCampaignActionsProps> = ({
  campaign,
  onActionComplete,
  onView,
  onDuplicate
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showUnscheduleDialog, setShowUnscheduleDialog] = useState(false);
  const [showSendNowDialog, setShowSendNowDialog] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);

  const isScheduled = campaign.status === 'scheduled';
  const isSending = campaign.status === 'sending';
  const isSent = campaign.status === 'sent';
  const canModify = !isSending && !isSent;

  const timezone = campaign.metadata?.scheduled_timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

  const handleEditSchedule = async (newSchedule: ScheduleOption) => {
    if (newSchedule.type !== 'scheduled' || !newSchedule.date) return;

    setIsProcessing(true);
    try {
      await updateCampaignSchedule(
        campaign.id, 
        newSchedule.date.toISOString(),
        newSchedule.timezone
      );
      setShowScheduleDialog(false);
      onActionComplete();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUnschedule = async () => {
    setIsProcessing(true);
    try {
      await unscheduleCampaign(campaign.id);
      setShowUnscheduleDialog(false);
      onActionComplete();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSendNow = async () => {
    setIsProcessing(true);
    try {
      await sendScheduledCampaignNow(campaign.id);
      setShowSendNowDialog(false);
      onActionComplete();
    } finally {
      setIsProcessing(false);
    }
  };

  const currentSchedule: ScheduleOption = {
    type: 'scheduled',
    date: campaign.scheduled_at ? new Date(campaign.scheduled_at) : undefined,
    timezone
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" disabled={isProcessing}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onView}>
            <Eye className="h-4 w-4 mr-2" />
            View Campaign
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onDuplicate}>
            <Copy className="h-4 w-4 mr-2" />
            Duplicate
          </DropdownMenuItem>
          
          {isScheduled && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowScheduleDialog(true)}>
                <Calendar className="h-4 w-4 mr-2" />
                Edit Schedule
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowSendNowDialog(true)}>
                <Send className="h-4 w-4 mr-2" />
                Send Now
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setShowUnscheduleDialog(true)}
                className="text-destructive focus:text-destructive"
              >
                <X className="h-4 w-4 mr-2" />
                Unschedule
              </DropdownMenuItem>
            </>
          )}

          {isSending && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled>
                <Clock className="h-4 w-4 mr-2 animate-pulse" />
                Sending in progress...
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Edit Schedule Dialog */}
      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Schedule</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Update when "{campaign.name}" will be sent.
            </p>
            <ScheduleSelector
              schedule={currentSchedule}
              onScheduleChange={handleEditSchedule}
              disabled={isProcessing}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Unschedule Confirmation */}
      <AlertDialog open={showUnscheduleDialog} onOpenChange={setShowUnscheduleDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unschedule Campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              "{campaign.name}" will not send automatically. It will be returned to draft status.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnschedule} disabled={isProcessing}>
              {isProcessing ? 'Processing...' : 'Unschedule'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Send Now Confirmation */}
      <AlertDialog open={showSendNowDialog} onOpenChange={setShowSendNowDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send Campaign Now?</AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately send "{campaign.name}" to your audience.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleSendNow} 
              disabled={isProcessing}
              className="bg-primary"
            >
              <Send className="h-4 w-4 mr-1" />
              {isProcessing ? 'Sending...' : 'Send Now'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

/**
 * Badge component for displaying scheduled time in campaign list
 */
export const ScheduledTimeBadge: React.FC<{
  scheduledAt: string | null;
  status: string;
  timezone?: string;
}> = ({ scheduledAt, status, timezone }) => {
  if (status !== 'scheduled' || !scheduledAt) {
    return null;
  }

  const userTimezone = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const isPastDue = new Date(scheduledAt) < new Date();

  const formatTime = () => {
    try {
      const localDate = toZonedTime(new Date(scheduledAt), userTimezone);
      return format(localDate, "MMM d 'at' h:mm a");
    } catch {
      return 'Unknown';
    }
  };

  const getTimezoneName = () => {
    const labels: Record<string, string> = {
      'America/New_York': 'ET',
      'America/Chicago': 'CT',
      'America/Denver': 'MT',
      'America/Los_Angeles': 'PT',
      'UTC': 'UTC'
    };
    return labels[userTimezone] || '';
  };

  return (
    <div className="flex items-center gap-1 text-xs">
      {isPastDue ? (
        <AlertTriangle className="h-3 w-3 text-amber-500" />
      ) : (
        <Clock className="h-3 w-3 text-muted-foreground" />
      )}
      <span className={isPastDue ? 'text-amber-600' : 'text-muted-foreground'}>
        {formatTime()} {getTimezoneName()}
      </span>
    </div>
  );
};
