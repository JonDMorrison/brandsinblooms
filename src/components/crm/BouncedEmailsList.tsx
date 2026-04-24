import React from 'react';
import { useCampaignBounces } from '@/hooks/useCampaignBounces';
import { Badge } from '@/components/ui-legacy/badge';
import { ScrollArea } from '@/components/ui-legacy/scroll-area';
import { AlertTriangle, CheckCircle, Mail, Loader2 } from 'lucide-react';

interface BouncedEmailsListProps {
  campaignId: string;
}

export const BouncedEmailsList: React.FC<BouncedEmailsListProps> = ({ campaignId }) => {
  const { bouncedEmails, isLoading, unsuppressedCount } = useCampaignBounces(campaignId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (bouncedEmails.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No bounced emails found for this campaign.</p>
      </div>
    );
  }

  const suppressedCount = bouncedEmails.length - unsuppressedCount;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <span>{unsuppressedCount} need suppression</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <span>{suppressedCount} already suppressed</span>
        </div>
      </div>

      {/* Email List */}
      <ScrollArea className="h-[300px] rounded-md border">
        <div className="p-4 space-y-2">
          {bouncedEmails.map((bounce) => (
            <div
              key={bounce.id}
              className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{bounce.email}</p>
                {bounce.bounceType && (
                  <p className="text-xs text-muted-foreground">
                    {bounce.bounceType}: {bounce.bounceMessage || 'No details'}
                  </p>
                )}
              </div>
              <Badge
                variant={bounce.isSuppressed ? 'secondary' : 'destructive'}
                className="ml-2 shrink-0"
              >
                {bounce.isSuppressed ? 'Suppressed' : 'Active'}
              </Badge>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};
