import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui-legacy/dialog';
import { Button } from '@/components/ui-legacy/button';
import { Textarea } from '@/components/ui-legacy/textarea';
import { Label } from '@/components/ui-legacy/label';
import { Badge } from '@/components/ui-legacy/badge';
import { Alert, AlertDescription } from '@/components/ui-legacy/alert';
import { Users, MessageSquare, Loader2, AlertTriangle, Image as ImageIcon, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { logActivity } from '@/lib/activityLogger';
import { fetchSmsSegmentSendEstimate } from '@/lib/sms/smsAudienceEstimate';

interface SegmentSMSDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  segmentId: string;
  segmentName: string;
  isSystemSegment?: boolean;
}

export const SegmentSMSDialog: React.FC<SegmentSMSDialogProps> = ({
  open,
  onOpenChange,
  segmentId,
  segmentName,
  isSystemSegment = false,
}) => {
  const [message, setMessage] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { tenant } = useTenant();
  const tenantId = tenant?.id;

  // Recipients under the one SMS eligibility rule (sms_eligible_customers),
  // the same count send-sms-campaign and the enqueue worker use.
  const estimateQuery = useQuery({
    queryKey: ['sms-segment-send-estimate', tenantId, segmentId, isSystemSegment],
    enabled: open && Boolean(tenantId && segmentId),
    queryFn: () =>
      fetchSmsSegmentSendEstimate({
        tenantId: tenantId!,
        segmentId,
        isSystemSegment,
      }),
  });
  const smsEnabledCount = estimateQuery.data?.eligible ?? null;
  const audienceCount = estimateQuery.data?.audience ?? null;
  const loadingCount = estimateQuery.isFetching;

  const characterCount = message.length;
  const segmentCount = Math.ceil(characterCount / 160);
  const isOverLimit = characterCount > 1600; // 10 segments max
  const canSend =
    message.trim().length > 0 &&
    !isOverLimit &&
    !loadingCount &&
    smsEnabledCount !== null &&
    smsEnabledCount > 0;

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setMessage('');
      setMediaUrl('');
    }
  }, [open]);

  const handleSend = async () => {
    if (!canSend || !tenantId || !user) return;

    setIsSending(true);
    try {
      // Format current date/time for campaign name
      const now = new Date();
      const dateTimeStr = now.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });

      // 1. Create SMS campaign record (marked as segment_send so it's hidden from main dashboard)
      const { data: campaign, error: campaignError } = await supabase
        .from('crm_sms_campaigns')
        .insert({
          tenant_id: tenantId,
          user_id: user.id,
          name: `SMS to ${segmentName} - ${dateTimeStr}`,
          message: message,
          image_url: mediaUrl || null,
          status: 'sending',
          segment_id: isSystemSegment ? null : segmentId,
          source: 'segment_send', // Mark as segment send to exclude from dashboard
        })
        .select()
        .single();

      if (campaignError) throw campaignError;

      // 2. Link campaign to segment (for custom segments)
      if (!isSystemSegment && campaign) {
        await supabase
          .from('campaign_segments')
          .insert({
            campaign_id: campaign.id,
            segment_id: segmentId,
          });
      }

      // 3. Trigger the send-sms-campaign edge function
      const { data: sendResult, error: sendError } = await supabase.functions.invoke('send-sms-campaign', {
        body: {
          campaignId: campaign.id,
          segmentId: isSystemSegment ? null : segmentId,
          systemSegmentType: isSystemSegment ? segmentId : null,
        }
      });

      if (sendError) {
        throw sendError;
      }

      // 4. Log activity event
      await logActivity({
        tenantId,
        customerId: null,
        actorType: 'user',
        actorId: user.id,
        source: 'ui',
        activityType: 'sms_segment_send',
        status: 'success',
        title: 'SMS sent to segment',
        description: {
          parts: [
            { type: 'text', text: 'Sent SMS to ' },
            { type: 'mention', label: segmentName },
            { type: 'text', text: ` targeting ${smsEnabledCount} recipients` }
          ]
        },
        metadata: {
          segment_id: segmentId,
          segment_name: segmentName,
          recipient_count: smsEnabledCount,
          message_preview: message.substring(0, 50),
          campaign_id: campaign.id,
          has_media: !!mediaUrl,
          is_system_segment: isSystemSegment,
        },
        relatedEntities: {
          segment_id: segmentId,
          campaign_id: campaign.id,
        },
        links: [
          { type: 'segment', href: `/crm/segments?highlight=${segmentId}`, label: 'View Segment' },
          { type: 'campaign', href: `/sms/${campaign.id}`, label: 'View Campaign' }
        ]
      });

      toast({
        title: 'SMS Campaign Started',
        description: `Sending SMS to ${smsEnabledCount} customers in "${segmentName}"`,
      });

      onOpenChange(false);
    } catch (caught: unknown) {
      console.error('Error sending SMS to segment:', caught);
      const error = {
        message:
          caught instanceof Error
            ? caught.message
            : 'An error occurred while sending the SMS campaign.',
      };

      // Log failure event
      if (tenantId && user) {
        await logActivity({
          tenantId,
          customerId: null,
          actorType: 'user',
          actorId: user.id,
          source: 'ui',
          activityType: 'sms_segment_send',
          status: 'failed',
          title: 'SMS to segment failed',
          description: {
            parts: [
              { type: 'text', text: 'Failed to send SMS to ' },
              { type: 'mention', label: segmentName }
            ]
          },
          metadata: {
            segment_id: segmentId,
            segment_name: segmentName,
            error: error.message,
          },
          errorMessage: error.message,
        });
      }

      toast({
        title: 'Failed to send SMS',
        description: error.message || 'An error occurred while sending the SMS campaign.',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Send SMS to Segment
          </DialogTitle>
          <DialogDescription>
            Compose and send an SMS message to all customers in "{segmentName}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Recipient Count */}
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <Users className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium">SMS-Enabled Recipients</p>
              {loadingCount ? (
                <p className="text-xs text-muted-foreground">Calculating...</p>
              ) : estimateQuery.isError ? (
                <p className="text-xs text-destructive">
                  {estimateQuery.error instanceof Error
                    ? estimateQuery.error.message
                    : 'Unable to calculate recipients.'}
                </p>
              ) : smsEnabledCount !== null && audienceCount !== null ? (
                <p className="text-xs text-muted-foreground">
                  {smsEnabledCount.toLocaleString()} of {audienceCount.toLocaleString()} customers can receive SMS
                </p>
              ) : null}
            </div>
            {smsEnabledCount !== null && (
              <Badge variant={smsEnabledCount > 0 ? 'default' : 'secondary'}>
                {smsEnabledCount.toLocaleString()} recipients
              </Badge>
            )}
          </div>

          {/* Warning if no recipients */}
          {smsEnabledCount === 0 && !loadingCount && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                No customers in this segment have SMS enabled. Please ensure customers have opted in to SMS.
              </AlertDescription>
            </Alert>
          )}

          {/* Message Input */}
          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              placeholder="Type your message here..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[120px] resize-none"
              maxLength={1600}
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className={characterCount > 160 ? 'text-amber-600' : ''}>
                {characterCount}/160 characters
                {segmentCount > 1 && ` (${segmentCount} segments)`}
              </span>
              {isOverLimit && (
                <span className="text-destructive">Message too long</span>
              )}
            </div>
          </div>

          {/* Media URL (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="mediaUrl" className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4" />
              Image URL (Optional - MMS)
            </Label>
            <div className="relative">
              <input
                id="mediaUrl"
                type="url"
                placeholder="https://example.com/image.jpg"
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
              {mediaUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setMediaUrl('')}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Adding an image will convert this to an MMS message
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={!canSend || isSending}>
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <MessageSquare className="h-4 w-4 mr-2" />
                Send SMS
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
