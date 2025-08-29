import React, { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Bug, ExternalLink, Settings } from 'lucide-react';
import { useSentryErrors } from '@/hooks/useSentryErrors';
import { useNavigate } from 'react-router-dom';

export const SentryWidget: React.FC = () => {
  const { errors, summary, loading, fetchErrors } = useSentryErrors();
  const navigate = useNavigate();

  useEffect(() => {
    // Auto-fetch errors on mount
    fetchErrors({ limit: 5 });
  }, [fetchErrors]);

  const handleViewAll = () => {
    navigate('/settings?tab=debug');
  };

  const criticalErrors = errors.filter(error => 
    error.level === 'error' || error.level === 'fatal'
  ).slice(0, 3);

  if (loading) {
    return (
      <Card className="w-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bug className="h-4 w-4" />
            Error Monitoring
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Bug className="h-4 w-4" />
            Error Monitoring
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleViewAll}
            className="h-8 px-2"
          >
            <Settings className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {summary && (
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-lg font-bold">{summary.total}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
            <div>
              <div className="text-lg font-bold text-destructive">{summary.unresolved}</div>
              <div className="text-xs text-muted-foreground">Open</div>
            </div>
            <div>
              <div className="text-lg font-bold text-orange-600">{summary.highPriority}</div>
              <div className="text-xs text-muted-foreground">Critical</div>
            </div>
          </div>
        )}

        {criticalErrors.length > 0 ? (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Recent Critical Issues</div>
            {criticalErrors.map((error) => (
              <div key={error.id} className="flex items-center gap-2 p-2 rounded-md border bg-muted/30">
                <AlertTriangle className="h-3 w-3 text-destructive flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{error.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {error.count} events • {error.userCount} users
                  </div>
                </div>
                <Badge variant="destructive" className="text-xs py-0">
                  {error.level}
                </Badge>
              </div>
            ))}
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleViewAll}
              className="w-full h-8 text-xs"
            >
              View All Errors
            </Button>
          </div>
        ) : (
          <div className="text-center py-4">
            <Bug className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <div className="text-sm text-muted-foreground">No critical errors</div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleViewAll}
              className="h-8 text-xs mt-2"
            >
              View Dashboard
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};