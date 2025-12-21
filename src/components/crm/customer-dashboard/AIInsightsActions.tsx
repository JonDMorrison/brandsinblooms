import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { DashboardSection } from './DashboardSection';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Sparkles, 
  RefreshCw, 
  MessageSquare, 
  Calendar, 
  Clock,
  ChevronRight,
  Lightbulb,
  Target,
  TrendingUp,
  Mail,
  EyeOff,
  AlertCircle
} from 'lucide-react';
import type { AIInsightsData, AIAction } from '@/hooks/useCustomerAIInsights';
import { formatDistanceToNow } from 'date-fns';

interface AIInsightsActionsProps {
  insights: AIInsightsData | null;
  loading?: boolean;
  regenerating?: boolean;
  onRegenerate?: () => void;
  className?: string;
}

const actionTypeIcons: Record<string, React.ReactNode> = {
  sms: <MessageSquare className="h-4 w-4" />,
  email: <Mail className="h-4 w-4" />,
  schedule: <Calendar className="h-4 w-4" />,
  monitor: <Clock className="h-4 w-4" />,
  suppress: <EyeOff className="h-4 w-4" />,
};

const priorityColors: Record<string, string> = {
  high: 'bg-destructive/10 text-destructive border-destructive/20',
  medium: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  low: 'bg-muted text-muted-foreground border-border',
};

export const AIInsightsActions: React.FC<AIInsightsActionsProps> = ({
  insights,
  loading = false,
  regenerating = false,
  onRegenerate,
  className,
}) => {
  const [expandedAction, setExpandedAction] = useState<number | null>(null);

  const isLoading = loading && !insights;

  // Loading state
  if (isLoading) {
    return (
      <DashboardSection
        title="AI Insights & Next Best Actions"
        icon={<Sparkles className="h-4 w-4" />}
        tooltip="AI-powered analysis and personalized recommendations"
        variant="highlight"
        className={className}
      >
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
      </DashboardSection>
    );
  }

  // No insights available
  if (!insights) {
    return (
      <DashboardSection
        title="AI Insights & Next Best Actions"
        icon={<Sparkles className="h-4 w-4" />}
        tooltip="AI-powered analysis and personalized recommendations"
        variant="highlight"
        badge={
          <Button
            variant="ghost"
            size="sm"
            onClick={onRegenerate}
            disabled={regenerating}
            className="ml-2 h-6 px-2 text-xs gap-1"
          >
            <RefreshCw className={cn('h-3 w-3', regenerating && 'animate-spin')} />
            {regenerating ? 'Analyzing...' : 'Generate'}
          </Button>
        }
        className={className}
      >
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-3" />
          <h4 className="text-sm font-medium text-foreground mb-1">No AI insights available</h4>
          <p className="text-xs text-muted-foreground max-w-xs">
            Click "Generate" to analyze this customer and receive personalized insights and recommendations.
          </p>
        </div>
      </DashboardSection>
    );
  }

  const { keyInsight, patterns, actions, hasSufficientData, generatedAt } = insights;

  const generatedAgo = generatedAt 
    ? formatDistanceToNow(new Date(generatedAt), { addSuffix: true })
    : null;

  return (
    <DashboardSection
      title="AI Insights & Next Best Actions"
      icon={<Sparkles className="h-4 w-4" />}
      tooltip="AI-powered analysis and personalized recommendations"
      variant="highlight"
      badge={
        <div className="flex items-center gap-2">
          {generatedAgo && (
            <span className="text-[10px] text-muted-foreground">
              Generated {generatedAgo}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onRegenerate}
            disabled={regenerating}
            className="h-6 px-2 text-xs gap-1"
          >
            <RefreshCw className={cn('h-3 w-3', regenerating && 'animate-spin')} />
            {regenerating ? 'Analyzing...' : 'Regenerate'}
          </Button>
        </div>
      }
      className={className}
    >
      {/* Data sufficiency notice */}
      {!hasSufficientData && (
        <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <p className="text-xs text-amber-600 flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5" />
            Limited data available. Insights are based on initial customer profile.
          </p>
        </div>
      )}

      {/* Key Insight */}
      <div className="p-4 rounded-lg bg-gradient-to-r from-primary/5 to-secondary/5 border border-primary/10 mb-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Lightbulb className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-1">Key Insight</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {keyInsight}
            </p>
          </div>
        </div>
      </div>

      {/* Behavioral Patterns */}
      {patterns && patterns.length > 0 && (
        <div className="p-4 rounded-lg border border-border bg-card mb-4">
          <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
            <Target className="h-4 w-4 text-muted-foreground" />
            Behavioral Patterns
          </h4>
          <ul className="space-y-2">
            {patterns.map((pattern, index) => (
              <li key={index} className="flex items-start gap-2 text-sm">
                <span className="text-primary mt-1">•</span>
                <span className="text-muted-foreground">{pattern}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommended Actions */}
      {actions && actions.length > 0 && (
        <div className="p-4 rounded-lg border border-border bg-card">
          <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            Recommended Actions
          </h4>
          
          <div className="space-y-3">
            {actions.map((action, index) => (
              <div 
                key={index}
                className={cn(
                  'p-3 rounded-lg border border-border bg-muted/30 transition-all cursor-pointer',
                  expandedAction === index && 'bg-muted/50 border-primary/30'
                )}
                onClick={() => setExpandedAction(expandedAction === index ? null : index)}
              >
                <div className="flex items-start gap-3">
                  <div className="p-1.5 rounded-lg bg-primary/10 text-primary mt-0.5">
                    {actionTypeIcons[action.actionType] || <TrendingUp className="h-4 w-4" />}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-sm font-medium text-foreground">
                        {index + 1}. {action.title}
                      </span>
                      <Badge variant="secondary" className="text-[10px] px-1.5">
                        {action.confidence}% confidence
                      </Badge>
                      <Badge 
                        variant="outline" 
                        className={cn('text-[10px] px-1.5', priorityColors[action.priority])}
                      >
                        {action.priority}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      "{action.description}"
                    </p>
                    
                    {expandedAction === index && (
                      <div className="mt-2 flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            // TODO: Wire up action execution
                          }}
                        >
                          Queue Action
                          <ChevronRight className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                  
                  <ChevronRight className={cn(
                    'h-4 w-4 text-muted-foreground transition-transform',
                    expandedAction === index && 'rotate-90'
                  )} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Disclaimer */}
      <p className="text-[10px] text-muted-foreground text-center mt-4">
        Insights generated by AI ({insights.modelUsed}) based on customer behavior data. Review before taking action.
      </p>
    </DashboardSection>
  );
};

export default AIInsightsActions;
