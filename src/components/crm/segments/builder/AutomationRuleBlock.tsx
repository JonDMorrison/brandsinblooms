import * as React from 'react';
import { cn } from '@/lib/utils';
import { GripVertical, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AutomationCombobox, ComboboxGroup } from './AutomationCombobox';
import { OperatorPillSelector } from './OperatorPillSelector';
import { SmartValueInput } from './SmartValueInput';
import type { ConditionOperator, MetricFieldDefinition } from '@/types/segmentation';
import { getOperatorLabel } from '@/lib/segmentation/metricsCatalog';

interface SegmentRule {
  id: string;
  field: string;
  operator: ConditionOperator;
  value: string | number;
  logicalOperator?: 'AND' | 'OR';
}

interface AutomationRuleBlockProps {
  rule: SegmentRule;
  index: number;
  metric: MetricFieldDefinition | undefined;
  groupedMetrics: ComboboxGroup[];
  onUpdate: (updates: Partial<SegmentRule>) => void;
  onRemove: () => void;
  canRemove: boolean;
  isDragging?: boolean;
  className?: string;
}

// Category styling configuration
const CATEGORY_STYLES: Record<string, { 
  gradient: string; 
  border: string; 
  accent: string;
  icon: string;
}> = {
  identity: { 
    gradient: 'from-blue-500/10 via-blue-500/5 to-transparent', 
    border: 'border-blue-500/30 hover:border-blue-500/50',
    accent: 'bg-blue-500',
    icon: '👤'
  },
  email_engagement: { 
    gradient: 'from-purple-500/10 via-purple-500/5 to-transparent', 
    border: 'border-purple-500/30 hover:border-purple-500/50',
    accent: 'bg-purple-500',
    icon: '📧'
  },
  sms_engagement: { 
    gradient: 'from-green-500/10 via-green-500/5 to-transparent', 
    border: 'border-green-500/30 hover:border-green-500/50',
    accent: 'bg-green-500',
    icon: '💬'
  },
  cross_channel: { 
    gradient: 'from-cyan-500/10 via-cyan-500/5 to-transparent', 
    border: 'border-cyan-500/30 hover:border-cyan-500/50',
    accent: 'bg-cyan-500',
    icon: '🔗'
  },
  purchase: { 
    gradient: 'from-amber-500/10 via-amber-500/5 to-transparent', 
    border: 'border-amber-500/30 hover:border-amber-500/50',
    accent: 'bg-amber-500',
    icon: '💰'
  },
  loyalty: { 
    gradient: 'from-pink-500/10 via-pink-500/5 to-transparent', 
    border: 'border-pink-500/30 hover:border-pink-500/50',
    accent: 'bg-pink-500',
    icon: '⭐'
  },
  lifecycle: { 
    gradient: 'from-teal-500/10 via-teal-500/5 to-transparent', 
    border: 'border-teal-500/30 hover:border-teal-500/50',
    accent: 'bg-teal-500',
    icon: '📈'
  },
  risk: { 
    gradient: 'from-red-500/10 via-red-500/5 to-transparent', 
    border: 'border-red-500/30 hover:border-red-500/50',
    accent: 'bg-red-500',
    icon: '⚠️'
  },
};

const DEFAULT_STYLE = {
  gradient: 'from-gray-500/10 via-gray-500/5 to-transparent',
  border: 'border-border hover:border-primary/30',
  accent: 'bg-gray-500',
  icon: '📊'
};

export const AutomationRuleBlock: React.FC<AutomationRuleBlockProps> = ({
  rule,
  index,
  metric,
  groupedMetrics,
  onUpdate,
  onRemove,
  canRemove,
  isDragging = false,
  className,
}) => {
  const [isExpanded, setIsExpanded] = React.useState(true);
  
  const categoryStyle = metric?.category 
    ? CATEGORY_STYLES[metric.category] || DEFAULT_STYLE 
    : DEFAULT_STYLE;

  // Generate natural language summary
  const getSummary = () => {
    if (!metric) return 'Select a metric to define this rule';
    
    const fieldLabel = metric.label;
    const operatorLabel = getOperatorLabel(rule.operator);
    const valueDisplay = rule.value !== '' && rule.value !== undefined
      ? metric.unit === '$' 
        ? `$${rule.value}`
        : metric.unit === '%'
        ? `${rule.value}%`
        : metric.unit === 'days'
        ? `${rule.value} days`
        : String(rule.value)
      : '...';
    
    return `${fieldLabel} ${operatorLabel} ${valueDisplay}`;
  };

  return (
    <div
      className={cn(
        "relative rounded-xl transition-all duration-300",
        "bg-gradient-to-br border-2",
        categoryStyle.gradient,
        categoryStyle.border,
        isDragging && "shadow-2xl scale-[1.02] opacity-90",
        "group",
        className
      )}
    >
      {/* Category accent bar */}
      <div className={cn(
        "absolute top-0 left-0 right-0 h-1 rounded-t-xl",
        categoryStyle.accent
      )} />
      
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        <button 
          type="button"
          className="cursor-grab opacity-40 hover:opacity-100 transition-opacity"
          title="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        
        <span className="text-lg">{categoryStyle.icon}</span>
        
        <div className="flex-1">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {index === 0 ? 'WHEN' : 'AND'} customer's
          </span>
        </div>
        
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="h-7 w-7 p-0"
        >
          {isExpanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>
        
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
      
      {/* Expandable Content */}
      <div className={cn(
        "overflow-hidden transition-all duration-300",
        isExpanded ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
      )}>
        <div className="px-4 pb-4 space-y-4">
          {/* Metric Selector */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Metric
            </label>
            <AutomationCombobox
              value={rule.field}
              onChange={(value) => onUpdate({ field: value })}
              groups={groupedMetrics}
              placeholder="Select a metric..."
              searchPlaceholder="Search metrics..."
              showDescriptions
              showIcons
            />
          </div>
          
          {/* Operator Pills */}
          {metric && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Condition
              </label>
              <OperatorPillSelector
                operators={metric.operators}
                value={rule.operator}
                onChange={(operator) => onUpdate({ operator })}
                metricType={metric.type}
              />
            </div>
          )}
          
          {/* Value Input */}
          {metric && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Value
              </label>
              <SmartValueInput
                value={rule.value}
                onChange={(value) => onUpdate({ value })}
                type={metric.type}
                operator={rule.operator}
                unit={metric.unit}
                placeholder={metric.placeholder}
                valueOptions={metric.valueOptions}
              />
            </div>
          )}
        </div>
      </div>
      
      {/* Natural Language Summary (always visible) */}
      <div className={cn(
        "px-4 py-3 border-t border-dashed flex items-center gap-2",
        "bg-background/50"
      )}>
        <Badge variant="outline" className="text-xs">
          📝 Summary
        </Badge>
        <span className="text-sm text-muted-foreground italic">
          "{getSummary()}"
        </span>
      </div>
    </div>
  );
};
