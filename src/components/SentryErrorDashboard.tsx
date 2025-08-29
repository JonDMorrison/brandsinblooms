import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { ExternalLink, RefreshCw, AlertTriangle, Bug, Clock, Users } from 'lucide-react';
import { useSentryErrors, SentryError } from '@/hooks/useSentryErrors';
import { formatDistanceToNow } from 'date-fns';

const ErrorLevelBadge: React.FC<{ level: string }> = ({ level }) => {
  const variants = {
    'fatal': 'destructive',
    'error': 'destructive', 
    'warning': 'secondary',
    'info': 'outline',
    'debug': 'outline'
  } as const;

  return (
    <Badge variant={variants[level as keyof typeof variants] || 'outline'}>
      {level.toUpperCase()}
    </Badge>
  );
};

const ErrorCard: React.FC<{ error: SentryError }> = ({ error }) => {
  const [showFix, setShowFix] = useState(false);

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base font-medium truncate">
              {error.title}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1 truncate">
              {error.description}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <ErrorLevelBadge level={error.level} />
            <Badge variant="outline">{error.errorType}</Badge>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
          <div className="flex items-center gap-2">
            <Bug className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{error.count}</span>
            <span className="text-muted-foreground">events</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{error.userCount}</span>
            <span className="text-muted-foreground">users</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              Last: {formatDistanceToNow(new Date(error.lastSeen), { addSuffix: true })}
            </span>
          </div>
          <div className="flex justify-end">
            <a 
              href={error.permalink} 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              View in Sentry <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">
            <strong>Location:</strong> {error.location}
          </div>
          
          {error.suggestedFix && (
            <div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFix(!showFix)}
                className="h-auto p-1 text-xs font-medium"
              >
                {showFix ? 'Hide' : 'Show'} AI Suggested Fix
              </Button>
              
              {showFix && (
                <Alert className="mt-2">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    {error.suggestedFix}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export const SentryErrorDashboard: React.FC = () => {
  const { errors, summary, loading, error, fetchErrors } = useSentryErrors();
  const [orgSlug, setOrgSlug] = useState('brands-in-blooms');
  const [projectSlug, setProjectSlug] = useState('javascript-react');

  const handleFetchErrors = () => {
    fetchErrors({ orgSlug, projectSlug, limit: 25 });
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sentry Error Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor and debug your application errors with AI-powered suggestions
          </p>
        </div>
        <Button onClick={handleFetchErrors} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Loading...' : 'Refresh Errors'}
        </Button>
      </div>

      {/* Configuration Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Organization Slug</label>
              <input
                type="text"
                value={orgSlug}
                onChange={(e) => setOrgSlug(e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-md text-sm"
                placeholder="e.g., brands-in-blooms"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Project Slug</label>
              <input
                type="text"
                value={projectSlug}
                onChange={(e) => setProjectSlug(e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-md text-sm"
                placeholder="e.g., javascript-react"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Section */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold">{summary.total}</div>
              <p className="text-xs text-muted-foreground">Total Issues</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold text-destructive">{summary.unresolved}</div>
              <p className="text-xs text-muted-foreground">Unresolved</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold text-orange-600">{summary.highPriority}</div>
              <p className="text-xs text-muted-foreground">High Priority</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Errors List */}
      {errors.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent Errors</h2>
            <Badge variant="outline">{errors.length} issues found</Badge>
          </div>
          <Separator />
          <div className="space-y-4">
            {errors.map((error) => (
              <ErrorCard key={error.id} error={error} />
            ))}
          </div>
        </div>
      )}

      {!loading && !error && errors.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Bug className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No errors found</h3>
            <p className="text-muted-foreground mb-4">
              Click "Refresh Errors" to fetch the latest issues from Sentry
            </p>
            <Button onClick={handleFetchErrors}>
              Fetch Errors
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};