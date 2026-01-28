import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  Mail, 
  MessageSquare,
  Shield,
  Bot,
  Ban
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, formatDistanceToNow } from 'date-fns';
import { FormSubmission, FormSubmissionMetadata } from '@/types/formBuilder';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface FormSubmissionsTabProps {
  formId: string;
}

type SubmissionResult = 'accepted' | 'rejected_invalid' | 'rejected_rate_limited' | 'rejected_spam';

const resultConfig: Record<SubmissionResult, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
  accepted: { 
    label: 'Accepted', 
    variant: 'default', 
    icon: <CheckCircle className="h-3.5 w-3.5" /> 
  },
  rejected_invalid: { 
    label: 'Invalid', 
    variant: 'destructive', 
    icon: <XCircle className="h-3.5 w-3.5" /> 
  },
  rejected_rate_limited: { 
    label: 'Rate Limited', 
    variant: 'secondary', 
    icon: <Clock className="h-3.5 w-3.5" /> 
  },
  rejected_spam: { 
    label: 'Spam', 
    variant: 'destructive', 
    icon: <Bot className="h-3.5 w-3.5" /> 
  },
};

export function FormSubmissionsTab({ formId }: FormSubmissionsTabProps) {
  const { data: submissions, isLoading, error } = useQuery({
    queryKey: ['form-submissions', formId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('form_submissions')
        .select('*')
        .eq('form_id', formId)
        .order('submitted_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      
      // Cast to our type
      return (data || []).map(row => ({
        ...row,
        metadata: row.metadata as unknown as FormSubmissionMetadata,
        data: row.data as Record<string, any>,
        result: row.result as SubmissionResult,
      })) as FormSubmission[];
    },
  });

  // Calculate stats
  const stats = React.useMemo(() => {
    if (!submissions) return { total: 0, accepted: 0, rejected: 0, rate: 0 };
    
    const accepted = submissions.filter(s => s.result === 'accepted').length;
    const rejected = submissions.length - accepted;
    
    return {
      total: submissions.length,
      accepted,
      rejected,
      rate: submissions.length > 0 ? Math.round((accepted / submissions.length) * 100) : 0,
    };
  }, [submissions]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-destructive" />
          <p className="text-muted-foreground">Failed to load submissions</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-sm text-muted-foreground">Total Submissions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{stats.accepted}</div>
            <p className="text-sm text-muted-foreground">Accepted</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-destructive">{stats.rejected}</div>
            <p className="text-sm text-muted-foreground">Rejected</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.rate}%</div>
            <p className="text-sm text-muted-foreground">Success Rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Submissions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Submissions</CardTitle>
          <CardDescription>
            Last 100 submissions to this form
          </CardDescription>
        </CardHeader>
        <CardContent>
          {submissions && submissions.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Consent</TableHead>
                    <TableHead>Page URL</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {submissions.map((submission) => (
                    <SubmissionRow key={submission.id} submission={submission} />
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12">
              <Mail className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No submissions yet</h3>
              <p className="text-muted-foreground">
                When users submit this form, their entries will appear here.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SubmissionRow({ submission }: { submission: FormSubmission }) {
  const resultInfo = resultConfig[submission.result] || resultConfig.rejected_invalid;
  const metadata = submission.metadata || {};
  
  // Extract email from submission data
  const email = submission.data?.email || submission.data?.Email || '—';
  
  // Format page URL for display
  const pageUrl = metadata.page_url 
    ? new URL(metadata.page_url).pathname 
    : '—';

  return (
    <TableRow>
      <TableCell className="whitespace-nowrap">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger className="text-left">
              <span className="text-sm">
                {formatDistanceToNow(new Date(submission.submitted_at), { addSuffix: true })}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {format(new Date(submission.submitted_at), 'PPpp')}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </TableCell>
      
      <TableCell>
        <span className="font-mono text-sm">{email}</span>
      </TableCell>
      
      <TableCell>
        <Badge variant={resultInfo.variant} className="flex items-center gap-1 w-fit">
          {resultInfo.icon}
          {resultInfo.label}
        </Badge>
      </TableCell>
      
      <TableCell>
        <ConsentBadges metadata={metadata} />
      </TableCell>
      
      <TableCell>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger className="text-left">
              <span className="text-sm text-muted-foreground max-w-[150px] truncate block">
                {pageUrl}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {metadata.page_url || 'No page URL recorded'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </TableCell>
      
      <TableCell>
        {submission.reason ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Badge variant="outline" className="text-xs">
                  {submission.reason.length > 30 
                    ? `${submission.reason.slice(0, 30)}...` 
                    : submission.reason}
                </Badge>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                {submission.reason}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
    </TableRow>
  );
}

function ConsentBadges({ metadata }: { metadata: FormSubmissionMetadata }) {
  const hasEmailConsent = metadata.email_consent === true;
  const hasSmsConsent = metadata.sms_consent === true;
  const noConsent = !hasEmailConsent && !hasSmsConsent;

  if (noConsent) {
    return <span className="text-muted-foreground text-sm">—</span>;
  }

  return (
    <div className="flex gap-1">
      {hasEmailConsent && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Badge variant="outline" className="flex items-center gap-1">
                <Mail className="h-3 w-3" />
                Email
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-xs">
                <p className="font-medium">Email consent given</p>
                {metadata.email_consent_text && (
                  <p className="text-muted-foreground mt-1">
                    "{metadata.email_consent_text}"
                  </p>
                )}
                {metadata.email_consent_at && (
                  <p className="text-muted-foreground mt-1">
                    at {format(new Date(metadata.email_consent_at), 'PPpp')}
                  </p>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      
      {hasSmsConsent && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Badge variant="outline" className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                SMS
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-xs">
                <p className="font-medium">SMS consent given</p>
                {metadata.sms_consent_text && (
                  <p className="text-muted-foreground mt-1">
                    "{metadata.sms_consent_text}"
                  </p>
                )}
                {metadata.sms_consent_at && (
                  <p className="text-muted-foreground mt-1">
                    at {format(new Date(metadata.sms_consent_at), 'PPpp')}
                  </p>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
