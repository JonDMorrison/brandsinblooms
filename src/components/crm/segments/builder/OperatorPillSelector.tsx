import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { ConditionOperator } from '@/types/segmentation';

interface OperatorPillSelectorProps {
  operators: ConditionOperator[];
  value: ConditionOperator;
  onChange: (operator: ConditionOperator) => void;
  metricType?: 'string' | 'number' | 'boolean' | 'date' | 'array';
  disabled?: boolean;
  className?: string;
}

// Operator display configuration
const OPERATOR_CONFIG: Record<ConditionOperator, { 
  label: string; 
  shortLabel: string;
  description: string;
  icon?: string;
}> = {
  'equals': { label: 'equals', shortLabel: '=', description: 'Exactly matches the value' },
  'eq': { label: 'equals', shortLabel: '=', description: 'Exactly matches the value' },
  '=': { label: 'equals', shortLabel: '=', description: 'Exactly matches the value' },
  'not_equals': { label: 'not equals', shortLabel: '≠', description: 'Does not match the value' },
  'neq': { label: 'not equals', shortLabel: '≠', description: 'Does not match the value' },
  '!=': { label: 'not equals', shortLabel: '≠', description: 'Does not match the value' },
  'greater_than': { label: 'greater than', shortLabel: '>', description: 'Value is larger than' },
  'gt': { label: 'greater than', shortLabel: '>', description: 'Value is larger than' },
  '>': { label: 'greater than', shortLabel: '>', description: 'Value is larger than' },
  'greater_than_or_equal': { label: 'at least', shortLabel: '≥', description: 'Value is at least' },
  'gte': { label: 'at least', shortLabel: '≥', description: 'Value is at least' },
  '>=': { label: 'at least', shortLabel: '≥', description: 'Value is at least' },
  'less_than': { label: 'less than', shortLabel: '<', description: 'Value is smaller than' },
  'lt': { label: 'less than', shortLabel: '<', description: 'Value is smaller than' },
  '<': { label: 'less than', shortLabel: '<', description: 'Value is smaller than' },
  'less_than_or_equal': { label: 'at most', shortLabel: '≤', description: 'Value is at most' },
  'lte': { label: 'at most', shortLabel: '≤', description: 'Value is at most' },
  '<=': { label: 'at most', shortLabel: '≤', description: 'Value is at most' },
  'contains': { label: 'contains', shortLabel: '∋', description: 'Text includes this value' },
  'not_contains': { label: 'not contains', shortLabel: '∌', description: 'Text does not include this value' },
  'starts_with': { label: 'starts with', shortLabel: 'A…', description: 'Text begins with this value' },
  'ends_with': { label: 'ends with', shortLabel: '…Z', description: 'Text ends with this value' },
  'is_empty': { label: 'is empty', shortLabel: '∅', description: 'Field has no value' },
  'is_not_empty': { label: 'has value', shortLabel: '✓', description: 'Field has a value' },
  'in': { label: 'is one of', shortLabel: '∈', description: 'Matches any of the values' },
  'not_in': { label: 'not one of', shortLabel: '∉', description: 'Does not match any of the values' },
  'is_true': { label: 'is true', shortLabel: '✓', description: 'Value is true/yes' },
  'is_false': { label: 'is false', shortLabel: '✗', description: 'Value is false/no' },
  'between': { label: 'between', shortLabel: '↔', description: 'Value is between two numbers' },
  'days_ago_less_than': { label: 'within last', shortLabel: '≤ days', description: 'Date is within the last N days' },
  'days_ago_greater_than': { label: 'more than', shortLabel: '> days', description: 'Date is more than N days ago' },
};

// Group operators by type for better UX
const getOperatorGroups = (operators: ConditionOperator[], metricType?: string) => {
  const groups: { label: string; operators: ConditionOperator[] }[] = [];
  
  // Comparison operators
  const comparison = operators.filter(op => 
    ['equals', 'eq', '=', 'not_equals', 'neq', '!='].includes(op)
  );
  if (comparison.length) groups.push({ label: 'Comparison', operators: comparison });
  
  // Range operators
  const range = operators.filter(op => 
    ['greater_than', 'gt', '>', 'greater_than_or_equal', 'gte', '>=', 
     'less_than', 'lt', '<', 'less_than_or_equal', 'lte', '<=', 'between'].includes(op)
  );
  if (range.length) groups.push({ label: 'Range', operators: range });
  
  // Text operators
  const text = operators.filter(op => 
    ['contains', 'not_contains', 'starts_with', 'ends_with'].includes(op)
  );
  if (text.length) groups.push({ label: 'Text', operators: text });
  
  // Existence operators
  const existence = operators.filter(op => 
    ['is_empty', 'is_not_empty'].includes(op)
  );
  if (existence.length) groups.push({ label: 'Existence', operators: existence });
  
  // Boolean operators
  const boolean = operators.filter(op => 
    ['is_true', 'is_false'].includes(op)
  );
  if (boolean.length) groups.push({ label: 'Boolean', operators: boolean });
  
  // Date operators
  const date = operators.filter(op => 
    ['days_ago_less_than', 'days_ago_greater_than'].includes(op)
  );
  if (date.length) groups.push({ label: 'Time', operators: date });
  
  // Fallback for any remaining operators
  const remaining = operators.filter(op => 
    !groups.some(g => g.operators.includes(op))
  );
  if (remaining.length) groups.push({ label: 'Other', operators: remaining });
  
  return groups.filter(g => g.operators.length > 0);
};

export const OperatorPillSelector: React.FC<OperatorPillSelectorProps> = ({
  operators,
  value,
  onChange,
  metricType,
  disabled = false,
  className,
}) => {
  const groups = React.useMemo(() => 
    getOperatorGroups(operators, metricType), 
    [operators, metricType]
  );

  // For simple cases (few operators), show all in one row
  const isSimple = operators.length <= 6;

  if (isSimple) {
    return (
      <TooltipProvider delayDuration={300}>
        <div className={cn(
          "flex flex-wrap gap-1.5 p-1 rounded-lg bg-muted/50",
          className
        )}>
          {operators.map((operator) => {
            const config = OPERATOR_CONFIG[operator] || { 
              label: operator, 
              shortLabel: operator,
              description: operator 
            };
            const isSelected = value === operator;

            return (
              <Tooltip key={operator}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange(operator)}
                    className={cn(
                      "px-3 py-1.5 text-sm font-medium rounded-md",
                      "transition-all duration-200 ease-out",
                      "focus:outline-none focus:ring-2 focus:ring-primary/50",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                      isSelected
                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/25 scale-105"
                        : "bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    {config.label}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[200px]">
                  <p className="text-xs">{config.description}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </TooltipProvider>
    );
  }

  // For complex cases, show grouped operators
  return (
    <TooltipProvider delayDuration={300}>
      <div className={cn("space-y-2", className)}>
        {groups.map((group) => (
          <div key={group.label} className="space-y-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              {group.label}
            </span>
            <div className="flex flex-wrap gap-1.5 p-1 rounded-lg bg-muted/50">
              {group.operators.map((operator) => {
                const config = OPERATOR_CONFIG[operator] || { 
                  label: operator, 
                  shortLabel: operator,
                  description: operator 
                };
                const isSelected = value === operator;

                return (
                  <Tooltip key={operator}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => onChange(operator)}
                        className={cn(
                          "px-2.5 py-1 text-xs font-medium rounded-md",
                          "transition-all duration-200 ease-out",
                          "focus:outline-none focus:ring-2 focus:ring-primary/50",
                          "disabled:opacity-50 disabled:cursor-not-allowed",
                          isSelected
                            ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                            : "bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
                        )}
                      >
                        {config.label}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[200px]">
                      <p className="text-xs">{config.description}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </TooltipProvider>
  );
};
