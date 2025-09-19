import React, { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  ExternalLink, 
  Copy, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  Users, 
  Bug,
  Lightbulb,
  Code,
  Zap
} from 'lucide-react';

interface SentryError {
  id: string;
  title: string;
  description: string;
  errorType: string;
  count: number;
  userCount: number;
  firstSeen: string;
  lastSeen: string;
  level: string;
  status: string;
  shortId: string;
  permalink: string;
  location: string;
  suggestedFix?: string;
}
import { formatDistanceToNow } from 'date-fns';

interface ErrorInvestigationDrawerProps {
  error: SentryError | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const QuickFix: React.FC<{ 
  title: string; 
  description: string; 
  code?: string;
  type: 'warning' | 'info' | 'success';
}> = ({ title, description, code, type }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (code) {
      navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const icons = {
    warning: AlertTriangle,
    info: Lightbulb,
    success: CheckCircle
  };

  const colors = {
    warning: 'border-orange-200 bg-orange-50',
    info: 'border-blue-200 bg-blue-50',
    success: 'border-green-200 bg-green-50'
  };

  const Icon = icons[type];

  return (
    <Card className={`${colors[type]} border`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Icon className="h-4 w-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <p className="text-sm text-muted-foreground">{description}</p>
        {code && (
          <div className="relative">
            <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto">
              <code>{code}</code>
            </pre>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="absolute top-1 right-1 h-6 px-2"
            >
              {copied ? (
                <CheckCircle className="h-3 w-3 text-green-500" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export const ErrorInvestigationDrawer: React.FC<ErrorInvestigationDrawerProps> = ({
  error,
  open,
  onOpenChange
}) => {
  if (!error) return null;

  const getQuickFixes = (error: SentryError) => {
    const fixes = [];

    if (error.errorType.includes('TypeError')) {
      fixes.push({
        title: 'Add Null Checks',
        description: 'Add proper null/undefined checks to prevent TypeErrors',
        code: `// Before\nobj.property.method();\n\n// After\nobj?.property?.method?.();`,
        type: 'info' as const
      });
    }

    if (error.errorType.includes('ReferenceError')) {
      fixes.push({
        title: 'Check Imports',
        description: 'Verify all variables and functions are properly imported',
        code: `import { requiredFunction } from './module';\n\n// Or check if variable exists\nif (typeof variable !== 'undefined') {\n  // use variable\n}`,
        type: 'warning' as const
      });
    }

    if (error.description.includes('fetch') || error.description.includes('Network')) {
      fixes.push({
        title: 'Add Error Handling',
        description: 'Implement proper error handling for network requests',
        code: `try {\n  const response = await fetch('/api/endpoint');\n  if (!response.ok) {\n    throw new Error('Network response was not ok');\n  }\n  const data = await response.json();\n} catch (error) {\n  console.error('Fetch error:', error);\n  // Handle error appropriately\n}`,
        type: 'info' as const
      });
    }

    // Always add a general suggestion
    fixes.push({
      title: 'Enable Debug Mode',
      description: 'Add additional logging to help debug this issue',
      code: `console.log('Debug info:', {\n  timestamp: new Date().toISOString(),\n  userAgent: navigator.userAgent,\n  url: window.location.href\n});`,
      type: 'success' as const
    });

    return fixes;
  };

  const quickFixes = getQuickFixes(error);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="space-y-3">
          <SheetTitle className="text-left pr-6">
            Error Investigation
          </SheetTitle>
          
          <div className="space-y-3">
            <div>
              <h3 className="font-medium text-sm mb-1">{error.title}</h3>
              <p className="text-sm text-muted-foreground">{error.description}</p>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={error.level === 'error' || error.level === 'fatal' ? 'destructive' : 'secondary'}>
                {error.level.toUpperCase()}
              </Badge>
              <Badge variant="outline">{error.errorType}</Badge>
              <Badge variant="outline">{error.status}</Badge>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2 text-sm">
              <Bug className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{error.count}</span>
              <span className="text-muted-foreground">events</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{error.userCount}</span>
              <span className="text-muted-foreground">users</span>
            </div>
            <div className="col-span-2 flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                Last occurred {formatDistanceToNow(new Date(error.lastSeen), { addSuffix: true })}
              </span>
            </div>
          </div>

          <Separator />

          {/* Location */}
          <div>
            <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
              <Code className="h-4 w-4" />
              Location
            </h4>
            <div className="text-sm bg-muted p-3 rounded-md">
              <code>{error.location}</code>
            </div>
          </div>

          {/* AI Suggested Fix */}
          {error.suggestedFix && (
            <>
              <Separator />
              <div>
                <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  AI Analysis
                </h4>
                <Alert>
                  <AlertDescription className="text-sm">
                    {error.suggestedFix}
                  </AlertDescription>
                </Alert>
              </div>
            </>
          )}

          {/* Quick Fixes */}
          <Separator />
          <div>
            <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Quick Fixes
            </h4>
            <div className="space-y-3">
              {quickFixes.map((fix, index) => (
                <QuickFix key={index} {...fix} />
              ))}
            </div>
          </div>

          {/* Actions */}
          <Separator />
          <div className="space-y-3">
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={() => window.open(error.permalink, '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              View in Sentry
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};