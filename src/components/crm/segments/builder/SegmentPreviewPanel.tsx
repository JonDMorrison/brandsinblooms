import * as React from 'react';
import { cn } from '@/lib/utils';
import { Users, TrendingUp, TrendingDown, AlertTriangle, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface SegmentPreviewPanelProps {
  matchCount: number | null;
  totalCount?: number;
  isLoading: boolean;
  sampleCustomers?: Array<{ id: string; name: string; email: string; value?: number }>;
  warnings?: string[];
  className?: string;
}

export const SegmentPreviewPanel: React.FC<SegmentPreviewPanelProps> = ({
  matchCount,
  totalCount = 0,
  isLoading,
  sampleCustomers = [],
  warnings = [],
  className,
}) => {
  const percentage = totalCount > 0 && matchCount !== null 
    ? Math.round((matchCount / totalCount) * 100) 
    : 0;

  return (
    <div className={cn(
      "rounded-xl border-2 bg-gradient-to-br from-muted/30 to-muted/10 p-5 space-y-5",
      className
    )}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="p-2 rounded-lg bg-primary/10">
          <Users className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold">Live Preview</h3>
          <p className="text-xs text-muted-foreground">Real-time segment estimate</p>
        </div>
      </div>

      {/* Main Count */}
      <div className="text-center py-4">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-muted-foreground">Calculating...</span>
          </div>
        ) : matchCount !== null ? (
          <>
            <div className="text-4xl font-bold text-foreground">
              {matchCount.toLocaleString()}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              customers match
            </p>
          </>
        ) : (
          <p className="text-muted-foreground">Click "Preview" to see results</p>
        )}
      </div>

      {/* Progress Bar */}
      {matchCount !== null && totalCount > 0 && (
        <div className="space-y-2">
          <Progress value={percentage} className="h-3" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{percentage}% of customer base</span>
            <span>{totalCount.toLocaleString()} total</span>
          </div>
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="space-y-2">
          {warnings.map((warning, i) => (
            <div key={i} className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <span className="text-xs text-amber-700 dark:text-amber-400">{warning}</span>
            </div>
          ))}
        </div>
      )}

      {/* Sample Customers */}
      {sampleCustomers.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Sample Matches
          </h4>
          <div className="space-y-2">
            {sampleCustomers.slice(0, 3).map((customer) => (
              <div key={customer.id} className="flex items-center gap-3 p-2 rounded-lg bg-background/50">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                  {customer.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{customer.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{customer.email}</p>
                </div>
                {customer.value !== undefined && (
                  <Badge variant="outline" className="text-xs">
                    ${customer.value}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
