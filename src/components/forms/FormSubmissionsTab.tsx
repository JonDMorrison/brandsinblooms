import React, { useState, useMemo } from 'react';
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
  Bot,
  TrendingUp,
  TrendingDown,
  Eye
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, formatDistanceToNow, subDays } from 'date-fns';
import { FormSubmission, FormSubmissionMetadata } from '@/types/formBuilder';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { SubmissionFilters, SubmissionResultFilter } from './submissions/SubmissionFilters';
import { SubmissionDetailModal } from './submissions/SubmissionDetailModal';
import { SubmissionExport } from './submissions/SubmissionExport';

interface FormSubmissionsTabProps {
  formId: string;
  formName?: string;
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

export function FormSubmissionsTab({ formId, formName = 'Form' }: FormSubmissionsTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [resultFilter, setResultFilter] = useState<SubmissionResultFilter>('all');
  const [consentFilter, setConsentFilter] = useState<'all' | 'email' | 'sms' | 'both' | 'none'>('all');
  const [selectedSubmission, setSelectedSubmission] = useState<FormSubmission | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  const { data: submissions, isLoading, error } = useQuery({
    queryKey: ['form-submissions', formId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('form_submissions')
        .select('*')
        .eq('form_id', formId)
        .order('submitted_at', { ascending: false })
        .limit(500);

      if (error) throw error;
      
      return (data || []).map(row => ({
        ...row,
        metadata: row.metadata as unknown as FormSubmissionMetadata,
        data: row.data as Record<string, any>,
        result: row.result as SubmissionResult,
      })) as FormSubmission[];
    },
  });

  // Filter submissions
  const filteredSubmissions = useMemo(() => {
    if (!submissions) return [];
    
    return submissions.filter(sub => {
      // Search filter
      if (searchQuery) {
        const email = sub.data?.email || sub.data?.Email || '';
        if (!email.toLowerCase().includes(searchQuery.toLowerCase())) {
          return false;
        }
      }

      // Result filter
      if (resultFilter !== 'all' && sub.result !== resultFilter) {
        return false;
      }

      // Consent filter
      const metadata = sub.metadata || {};
      const hasEmail = metadata.email_consent === true;
      const hasSms = metadata.sms_consent === true;
      
      switch (consentFilter) {
        case 'email':
          if (!hasEmail || hasSms) return false;
          break;
        case 'sms':
          if (!hasSms || hasEmail) return false;
          break;
        case 'both':
          if (!hasEmail || !hasSms) return false;
          break;
        case 'none':
          if (hasEmail || hasSms) return false;
          break;
      }

      return true;
    });
  }, [submissions, searchQuery, resultFilter, consentFilter]);

  // Calculate stats with trend
  const stats = useMemo(() => {
    if (!submissions) return { 
      total: 0, 
      accepted: 0, 
      rejected: 0, 
      rate: 0,
      last7Days: 0,
      previous7Days: 0,
      trend: 0
    };
    
    const accepted = submissions.filter(s => s.result === 'accepted').length;
    const rejected = submissions.length - accepted;
    
    const now = new Date();
    const sevenDaysAgo = subDays(now, 7);
    const fourteenDaysAgo = subDays(now, 14);
    
    const last7Days = submissions.filter(s => 
      new Date(s.submitted_at) >= sevenDaysAgo
    ).length;
    
    const previous7Days = submissions.filter(s => {
      const date = new Date(s.submitted_at);
      return date >= fourteenDaysAgo && date < sevenDaysAgo;
    }).length;
    
    const trend = previous7Days === 0 
      ? (last7Days > 0 ? 100 : 0) 
      : Math.round(((last7Days - previous7Days) / previous7Days) * 100);
    
    return {
      total: submissions.length,
      accepted,
      rejected,
      rate: submissions.length > 0 ? Math.round((accepted / submissions.length) * 100) : 0,
      last7Days,
      previous7Days,
      trend,
    };
  }, [submissions]);

  const activeFiltersCount = [
    searchQuery ? 1 : 0,
    resultFilter !== 'all' ? 1 : 0,
    consentFilter !== 'all' ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  const handleClearFilters = () => {
    setSearchQuery('');
    setResultFilter('all');
    setConsentFilter('all');
  };

  const handleViewDetails = (submission: FormSubmission) => {
    setSelectedSubmission(submission);
    setDetailModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{stats.last7Days}</span>
              {stats.trend !== 0 && (
                <Badge 
                  variant={stats.trend > 0 ? 'default' : 'secondary'} 
                  className={`text-xs ${stats.trend > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
                >
                  {stats.trend > 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                  {Math.abs(stats.trend)}%
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">Last 7 days</p>
          </CardContent>
        </Card>
      </div>

      {/* Submissions Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div>
              <CardTitle>Recent Submissions</CardTitle>
              <CardDescription>
                {filteredSubmissions.length === submissions?.length 
                  ? `Showing ${submissions?.length || 0} submissions`
                  : `Showing ${filteredSubmissions.length} of ${submissions?.length || 0} submissions`
                }
              </CardDescription>
            </div>
            <SubmissionExport submissions={filteredSubmissions} formName={formName} />
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <SubmissionFilters
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            resultFilter={resultFilter}
            onResultFilterChange={setResultFilter}
            consentFilter={consentFilter}
            onConsentFilterChange={setConsentFilter}
            activeFiltersCount={activeFiltersCount}
            onClearFilters={handleClearFilters}
          />

          {filteredSubmissions.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Consent</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubmissions.map((submission) => (
                    <SubmissionRow 
                      key={submission.id} 
                      submission={submission}
                      onViewDetails={() => handleViewDetails(submission)}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : submissions && submissions.length > 0 ? (
            <div className="text-center py-12">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No matching submissions</h3>
              <p className="text-muted-foreground mb-4">
                Try adjusting your filters or search query.
              </p>
              <Button variant="outline" onClick={handleClearFilters}>
                Clear filters
              </Button>
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

      {/* Detail Modal */}
      <SubmissionDetailModal
        submission={selectedSubmission}
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
      />
    </div>
  );
}

interface SubmissionRowProps {
  submission: FormSubmission;
  onViewDetails: () => void;
}

function SubmissionRow({ submission, onViewDetails }: SubmissionRowProps) {
  const resultInfo = resultConfig[submission.result] || resultConfig.rejected_invalid;
  const metadata = submission.metadata || {};
  
  const email = submission.data?.email || submission.data?.Email || '—';
  
  // Get UTM source or page for source column
  const source = metadata.utm_source || (metadata.page_url ? 'Direct' : '—');

  return (
    <TableRow className="cursor-pointer hover:bg-muted/50" onClick={onViewDetails}>
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
        <span className="text-sm text-muted-foreground">{source}</span>
      </TableCell>
      
      <TableCell className="text-right">
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onViewDetails(); }}>
          <Eye className="h-4 w-4" />
        </Button>
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
        <Badge variant="outline" className="flex items-center gap-1 text-xs">
          <Mail className="h-3 w-3" />
        </Badge>
      )}
      {hasSmsConsent && (
        <Badge variant="outline" className="flex items-center gap-1 text-xs">
          <MessageSquare className="h-3 w-3" />
        </Badge>
      )}
    </div>
  );
}
