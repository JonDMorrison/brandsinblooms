import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, AlertTriangle, CheckCircle2, Clock, TrendingUp } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface DomainHealthMonitorProps {
  domainId: string;
  domain: string;
}

interface HealthCheck {
  id: string;
  check_type: string;
  status: string;
  details: any;
  response_time_ms: number;
  checked_at: string;
}

export const DomainHealthMonitor: React.FC<DomainHealthMonitorProps> = ({ 
  domainId, 
  domain 
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch health check history
  const { data: healthChecks = [], isLoading } = useQuery({
    queryKey: ['domain-health-checks', domainId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('domain-health-check', {
        body: { method: 'GET' },
        headers: { 'X-Domain-Id': domainId }
      });

      if (error) throw error;
      return data.checks as HealthCheck[];
    },
    refetchInterval: 60000, // Refresh every minute
  });

  // Trigger new health check
  const runHealthCheckMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('domain-health-check', {
        body: {
          domainId,
          checkTypes: ['dns', 'tls', 'http']
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['domain-health-checks'] });
      toast({
        title: 'Health Check Complete',
        description: 'Domain health status updated.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Health Check Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const getLatestCheckByType = (type: string) => {
    return healthChecks
      .filter(check => check.check_type === type)
      .sort((a, b) => new Date(b.checked_at).getTime() - new Date(a.checked_at).getTime())[0];
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      healthy: { variant: 'default' as const, icon: CheckCircle2, color: 'text-green-600' },
      warning: { variant: 'secondary' as const, icon: AlertTriangle, color: 'text-yellow-600' },
      error: { variant: 'destructive' as const, icon: AlertTriangle, color: 'text-red-600' },
      unknown: { variant: 'outline' as const, icon: Clock, color: 'text-gray-600' }
    };

    const config = variants[status as keyof typeof variants] || variants.unknown;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className={`h-3 w-3 ${config.color}`} />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const dnsCheck = getLatestCheckByType('dns');
  const tlsCheck = getLatestCheckByType('tls');
  const httpCheck = getLatestCheckByType('http');

  const overallStatus = [dnsCheck, tlsCheck, httpCheck].every(check => 
    check?.status === 'healthy'
  ) ? 'healthy' : 'warning';

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <RefreshCw className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Overall Status */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Domain Health</CardTitle>
              <CardDescription>{domain}</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge(overallStatus)}
              <Button
                variant="outline"
                size="sm"
                onClick={() => runHealthCheckMutation.mutate()}
                disabled={runHealthCheckMutation.isPending}
              >
                <RefreshCw className={`h-4 w-4 ${runHealthCheckMutation.isPending ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* DNS Status */}
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-medium text-sm">DNS Resolution</p>
                {dnsCheck && (
                  <p className="text-xs text-muted-foreground">
                    {dnsCheck.response_time_ms}ms
                  </p>
                )}
              </div>
              {dnsCheck ? getStatusBadge(dnsCheck.status) : getStatusBadge('unknown')}
            </div>

            {/* TLS Status */}
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-medium text-sm">SSL/TLS Certificate</p>
                {tlsCheck && (
                  <p className="text-xs text-muted-foreground">
                    {tlsCheck.response_time_ms}ms
                  </p>
                )}
              </div>
              {tlsCheck ? getStatusBadge(tlsCheck.status) : getStatusBadge('unknown')}
            </div>

            {/* HTTP Status */}
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-medium text-sm">HTTP Response</p>
                {httpCheck && (
                  <p className="text-xs text-muted-foreground">
                    {httpCheck.response_time_ms}ms
                  </p>
                )}
              </div>
              {httpCheck ? getStatusBadge(httpCheck.status) : getStatusBadge('unknown')}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Results */}
      {healthChecks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Recent Health Checks
            </CardTitle>
            <CardDescription>
              Last {Math.min(healthChecks.length, 10)} health check results
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {healthChecks.slice(0, 10).map((check) => (
                <div key={check.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="text-sm">
                      <span className="font-medium capitalize">{check.check_type}</span>
                      <p className="text-muted-foreground">
                        {new Date(check.checked_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {check.response_time_ms}ms
                    </span>
                    {getStatusBadge(check.status)}
                  </div>
                </div>
              ))}
            </div>

            {healthChecks.length === 0 && (
              <div className="text-center py-6 text-muted-foreground">
                <Clock className="h-8 w-8 mx-auto mb-2" />
                <p>No health checks performed yet</p>
                <p className="text-sm">Click the refresh button to run your first check</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};