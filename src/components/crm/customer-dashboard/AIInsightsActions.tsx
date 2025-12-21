import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { DashboardSection } from './DashboardSection';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Sparkles, 
  RefreshCw, 
  MessageSquare, 
  Calendar, 
  Clock,
  ChevronRight,
  Lightbulb,
  Target,
  TrendingUp
} from 'lucide-react';

interface AIInsight {
  type: 'insight' | 'pattern' | 'action';
  title: string;
  description: string;
  confidence?: number;
  actionLabel?: string;
  onAction?: () => void;
}

interface AIInsightsActionsProps {
  insights: AIInsight[];
  keyInsight?: string;
  patterns?: string[];
  loading?: boolean;
  onRegenerate?: () => void;
  className?: string;
}

const insightIcons: Record<string, React.ReactNode> = {
  insight: <Lightbulb className="h-4 w-4" />,
  pattern: <Target className="h-4 w-4" />,
  action: <TrendingUp className="h-4 w-4" />,
};

const actionIcons: Record<string, React.ReactNode> = {
  sms: <MessageSquare className="h-4 w-4" />,
  schedule: <Calendar className="h-4 w-4" />,
  monitor: <Clock className="h-4 w-4" />,
};

export const AIInsightsActions: React.FC<AIInsightsActionsProps> = ({
  insights = [],
  keyInsight,
  patterns = [],
  loading = false,
  onRegenerate,
  className,
}) => {
  const [expandedAction, setExpandedAction] = useState<number | null>(null);

  const actionInsights = insights.filter(i => i.type === 'action');
  const patternInsights = insights.filter(i => i.type === 'pattern');

  // Default insights if none provided
  const defaultKeyInsight = keyInsight || 
    "This customer's engagement dropped 40% after your promotional campaign ended. They appear discount-dependent and only engage when incentives are present.";

  const defaultPatterns = patterns.length > 0 ? patterns : [
    "High intent on product pages (78 intent score)",
    "Responds better to SMS than email (2x click rate)",
    "Opens brand story content but ignores promotional emails",
    "Purchases peak in April-May (seasonal gardener)"
  ];

  const defaultActions: AIInsight[] = actionInsights.length > 0 ? actionInsights : [
    {
      type: 'action',
      title: "Send SMS with brand story content (no discount)",
      description: "Reduce discount dependency while leveraging preferred channel and content type",
      confidence: 85,
      actionLabel: "Queue Action"
    },
    {
      type: 'action',
      title: "Schedule re-engagement for April",
      description: "Align with their peak purchasing season",
      confidence: 78,
      actionLabel: "Add to Calendar"
    },
    {
      type: 'action',
      title: "Monitor for 14 days before suppression",
      description: "Risk score is high but customer has high LTV potential",
      confidence: 72,
      actionLabel: "Set Reminder"
    }
  ];

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
          disabled={loading}
          className="ml-2 h-6 px-2 text-xs gap-1"
        >
          <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
          {loading ? 'Analyzing...' : 'Regenerate'}
        </Button>
      }
      className={className}
    >
      {/* Key Insight */}
      <div className="p-4 rounded-lg bg-gradient-to-r from-primary/5 to-secondary/5 border border-primary/10 mb-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Lightbulb className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-1">Key Insight</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {defaultKeyInsight}
            </p>
          </div>
        </div>
      </div>

      {/* Behavioral Patterns */}
      <div className="p-4 rounded-lg border border-border bg-card mb-4">
        <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
          <Target className="h-4 w-4 text-muted-foreground" />
          Behavioral Pattern
        </h4>
        <ul className="space-y-2">
          {defaultPatterns.map((pattern, index) => (
            <li key={index} className="flex items-start gap-2 text-sm">
              <span className="text-primary mt-1">•</span>
              <span className="text-muted-foreground">{pattern}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Recommended Actions */}
      <div className="p-4 rounded-lg border border-border bg-card">
        <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          Recommended Actions
        </h4>
        
        <div className="space-y-3">
          {defaultActions.map((action, index) => (
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
                  {index === 0 && <MessageSquare className="h-4 w-4" />}
                  {index === 1 && <Calendar className="h-4 w-4" />}
                  {index === 2 && <Clock className="h-4 w-4" />}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-foreground">
                      {index + 1}. {action.title}
                    </span>
                    {action.confidence && (
                      <Badge variant="secondary" className="text-[10px] px-1.5">
                        {action.confidence}% confidence
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    "{action.description}"
                  </p>
                  
                  {expandedAction === index && action.actionLabel && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 h-7 text-xs gap-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        action.onAction?.();
                      }}
                    >
                      {action.actionLabel}
                      <ChevronRight className="h-3 w-3" />
                    </Button>
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

      {/* AI Disclaimer */}
      <p className="text-[10px] text-muted-foreground text-center mt-4">
        Insights generated by AI based on customer behavior data. Review before taking action.
      </p>
    </DashboardSection>
  );
};

export default AIInsightsActions;
