import { useDomainStats, DomainStats } from '@/hooks/useDomainStats';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DomainReputationDashboardProps {
  tenantId?: string;
}

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'active':
      return <Badge variant="default" className="bg-green-600">Active</Badge>;
    case 'warming_up':
      return <Badge variant="secondary" className="bg-amber-500 text-white">Warming Up</Badge>;
    case 'verifying':
      return <Badge variant="secondary" className="bg-blue-500 text-white">Verifying</Badge>;
    case 'pending_dns':
      return <Badge variant="outline" className="border-amber-500 text-amber-600">Pending DNS</Badge>;
    case 'paused':
      return <Badge variant="destructive">Paused</Badge>;
    case 'blocked':
      return <Badge variant="destructive">Blocked</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

const getRateDisplay = (rate: number, type: 'good' | 'warning' | 'danger') => {
  const colorClass = {
    good: 'text-green-600',
    warning: 'text-amber-600',
    danger: 'text-red-600',
  }[type];

  return <span className={cn('font-medium', colorClass)}>{rate.toFixed(2)}%</span>;
};

const getOpenClickRateStatus = (rate: number): 'good' | 'warning' | 'danger' => {
  if (rate >= 20) return 'good';
  if (rate >= 10) return 'warning';
  return 'danger';
};

const getBounceRateStatus = (rate: number): 'good' | 'warning' | 'danger' => {
  if (rate <= 2) return 'good';
  if (rate <= 5) return 'warning';
  return 'danger';
};

const getComplaintRateStatus = (rate: number): 'good' | 'warning' | 'danger' => {
  if (rate <= 0.1) return 'good';
  if (rate <= 0.2) return 'warning';
  return 'danger';
};

const DomainRow = ({ domain }: { domain: DomainStats }) => {
  const bounceStatus = getBounceRateStatus(domain.bounce_rate_30d);
  const complaintStatus = getComplaintRateStatus(domain.complaint_rate_30d);
  const hasWarning = bounceStatus !== 'good' || complaintStatus !== 'good';

  return (
    <TableRow className={cn(hasWarning && 'bg-amber-50/50')}>
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          {hasWarning && <AlertTriangle className="h-4 w-4 text-amber-500" />}
          {domain.domain_name}
        </div>
      </TableCell>
      <TableCell>{getStatusBadge(domain.verification_status)}</TableCell>
      <TableCell className="text-center">
        <Badge variant="outline">Stage {domain.warmup_stage || 1}</Badge>
      </TableCell>
      <TableCell className="text-right">{domain.emails_sent_30d.toLocaleString()}</TableCell>
      <TableCell className="text-right">{domain.emails_delivered_30d.toLocaleString()}</TableCell>
      <TableCell className="text-right">
        {getRateDisplay(domain.open_rate_30d, getOpenClickRateStatus(domain.open_rate_30d))}
      </TableCell>
      <TableCell className="text-right">
        {getRateDisplay(domain.click_rate_30d, getOpenClickRateStatus(domain.click_rate_30d))}
      </TableCell>
      <TableCell className="text-right">
        {getRateDisplay(domain.bounce_rate_30d, bounceStatus)}
      </TableCell>
      <TableCell className="text-right">
        {getRateDisplay(domain.complaint_rate_30d, complaintStatus)}
      </TableCell>
    </TableRow>
  );
};

export const DomainReputationDashboard = ({ tenantId }: DomainReputationDashboardProps) => {
  const { data: domains, isLoading, error } = useDomainStats(tenantId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Domain Reputation (30-Day)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Domain Reputation (30-Day)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-destructive">
            <XCircle className="h-5 w-5" />
            <span>Failed to load domain stats</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!domains || domains.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Domain Reputation (30-Day)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-5 w-5" />
            <span>No sending domains configured</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const domainsWithIssues = domains.filter(
    d => getBounceRateStatus(d.bounce_rate_30d) !== 'good' || 
         getComplaintRateStatus(d.complaint_rate_30d) !== 'good'
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            Domain Reputation (30-Day)
            {domainsWithIssues.length > 0 && (
              <Badge variant="destructive">{domainsWithIssues.length} Issue(s)</Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              Good
            </div>
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              Warning
            </div>
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              Danger
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Domain</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Warmup</TableHead>
                <TableHead className="text-right">Sent</TableHead>
                <TableHead className="text-right">Delivered</TableHead>
                <TableHead className="text-right">Open Rate</TableHead>
                <TableHead className="text-right">Click Rate</TableHead>
                <TableHead className="text-right">Bounce Rate</TableHead>
                <TableHead className="text-right">Complaint Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {domains.map((domain) => (
                <DomainRow key={domain.domain_id} domain={domain} />
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="mt-4 text-xs text-muted-foreground">
          <p><strong>Thresholds:</strong> Bounce rate &gt;2% = warning, &gt;5% = danger. Complaint rate &gt;0.1% = warning, &gt;0.2% = danger.</p>
        </div>
      </CardContent>
    </Card>
  );
};
