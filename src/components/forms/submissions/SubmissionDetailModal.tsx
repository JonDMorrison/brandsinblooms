import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Bot, 
  Mail, 
  MessageSquare,
  Globe,
  Link2,
  User,
  MapPin,
  Calendar
} from 'lucide-react';
import { format } from 'date-fns';
import { FormSubmission, FormSubmissionMetadata } from '@/types/formBuilder';

interface SubmissionDetailModalProps {
  submission: FormSubmission | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

import { SubmissionResult } from '@/types/formBuilder';

const resultConfig: Record<SubmissionResult, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode; color: string }> = {
  accepted: { 
    label: 'Accepted', 
    variant: 'default', 
    icon: <CheckCircle className="h-4 w-4" />,
    color: 'text-green-600'
  },
  rejected: { 
    label: 'Rejected', 
    variant: 'destructive', 
    icon: <XCircle className="h-4 w-4" />,
    color: 'text-destructive'
  },
};

export function SubmissionDetailModal({ submission, open, onOpenChange }: SubmissionDetailModalProps) {
  if (!submission) return null;

  const resultInfo = resultConfig[submission.result] || resultConfig.rejected;
  const metadata = submission.metadata || {} as Partial<FormSubmissionMetadata>;
  const data = submission.data || {};

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-3">
            <span>Submission Details</span>
            <Badge variant={resultInfo.variant} className="flex items-center gap-1">
              {resultInfo.icon}
              {resultInfo.label}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Submitted {format(new Date(submission.submitted_at), 'PPpp')}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(85vh-120px)]">
          <div className="p-6 pt-4 space-y-6">
            {/* Rejection Reason */}
            {submission.reason && (
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-sm font-medium text-destructive">Rejection Reason</p>
                <p className="text-sm text-muted-foreground mt-1">{submission.reason}</p>
              </div>
            )}

            {/* Submitted Data */}
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <User className="h-4 w-4" />
                Submitted Data
              </h3>
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                {Object.entries(data).map(([key, value]) => {
                  if (key.startsWith('_')) return null; // Skip internal fields like _honeypot
                  const displayValue = typeof value === 'boolean' 
                    ? (value ? 'Yes' : 'No') 
                    : String(value || '—');
                  
                  return (
                    <div key={key} className="flex justify-between items-start">
                      <span className="text-sm text-muted-foreground capitalize">
                        {key.replace(/_/g, ' ')}
                      </span>
                      <span className="text-sm font-medium text-right max-w-[60%] break-words">
                        {displayValue}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <Separator />

            {/* Consent Information */}
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Consent Status
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <ConsentCard
                  type="email"
                  consented={metadata.email_consent === true}
                  text={metadata.email_consent_text}
                  timestamp={metadata.email_consent_at}
                />
                <ConsentCard
                  type="sms"
                  consented={metadata.sms_consent === true}
                  text={metadata.sms_consent_text}
                  timestamp={metadata.sms_consent_at}
                />
              </div>
            </div>

            <Separator />

            {/* Source & Attribution */}
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Source & Attribution
              </h3>
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                {metadata.page_url && (
                  <div className="flex justify-between items-start">
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <Link2 className="h-3 w-3" /> Page URL
                    </span>
                    <span className="text-sm font-mono text-right max-w-[60%] break-all">
                      {metadata.page_url}
                    </span>
                  </div>
                )}
                {metadata.referrer && (
                  <div className="flex justify-between items-start">
                    <span className="text-sm text-muted-foreground">Referrer</span>
                    <span className="text-sm font-mono text-right max-w-[60%] break-all">
                      {metadata.referrer}
                    </span>
                  </div>
                )}
                {(metadata.utm_source || metadata.utm_medium || metadata.utm_campaign) && (
                  <>
                    <Separator className="my-2" />
                    <div className="flex flex-wrap gap-2">
                      {metadata.utm_source && (
                        <Badge variant="outline" className="text-xs">
                          utm_source: {metadata.utm_source}
                        </Badge>
                      )}
                      {metadata.utm_medium && (
                        <Badge variant="outline" className="text-xs">
                          utm_medium: {metadata.utm_medium}
                        </Badge>
                      )}
                      {metadata.utm_campaign && (
                        <Badge variant="outline" className="text-xs">
                          utm_campaign: {metadata.utm_campaign}
                        </Badge>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Technical Details */}
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Technical Details
              </h3>
              <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Submission ID</span>
                  <span>{submission.id}</span>
                </div>
                {submission.customer_id && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Customer ID</span>
                    <span>{submission.customer_id}</span>
                  </div>
                )}
                {submission.ip_hash && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">IP Hash</span>
                    <span>{submission.ip_hash.slice(0, 16)}...</span>
                  </div>
                )}
                {metadata.user_agent && (
                  <div className="flex justify-between items-start">
                    <span className="text-muted-foreground">User Agent</span>
                    <span className="text-right max-w-[60%] break-words">
                      {metadata.user_agent.slice(0, 80)}...
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

interface ConsentCardProps {
  type: 'email' | 'sms';
  consented: boolean;
  text?: string;
  timestamp?: string;
}

function ConsentCard({ type, consented, text, timestamp }: ConsentCardProps) {
  const Icon = type === 'email' ? Mail : MessageSquare;
  const label = type === 'email' ? 'Email Marketing' : 'SMS Messages';

  return (
    <div className={`p-3 rounded-lg border ${consented ? 'bg-green-50 border-green-200' : 'bg-muted/30 border-muted'}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`h-4 w-4 ${consented ? 'text-green-600' : 'text-muted-foreground'}`} />
        <span className="text-sm font-medium">{label}</span>
        {consented ? (
          <Badge variant="outline" className="ml-auto text-xs bg-green-100 text-green-800 border-green-200">
            Consented
          </Badge>
        ) : (
          <Badge variant="outline" className="ml-auto text-xs">
            Not given
          </Badge>
        )}
      </div>
      {consented && text && (
        <p className="text-xs text-muted-foreground italic mb-1">"{text}"</p>
      )}
      {consented && timestamp && (
        <p className="text-xs text-muted-foreground">
          <Calendar className="h-3 w-3 inline mr-1" />
          {format(new Date(timestamp), 'PPpp')}
        </p>
      )}
    </div>
  );
}
