import * as React from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, GripVertical, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface ConditionGroupProps {
  logic: 'AND' | 'OR';
  onLogicChange: (logic: 'AND' | 'OR') => void;
  children: React.ReactNode;
  onAddRule: () => void;
  onRemove?: () => void;
  canRemove?: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  ruleCount?: number;
  className?: string;
}

export const ConditionGroup: React.FC<ConditionGroupProps> = ({
  logic,
  onLogicChange,
  children,
  onAddRule,
  onRemove,
  canRemove = false,
  isCollapsed = false,
  onToggleCollapse,
  ruleCount = 0,
  className,
}) => {
  return (
    <div className={cn(
      "relative rounded-xl border-2 border-dashed transition-all duration-300",
      logic === 'AND' 
        ? "border-primary/30 bg-primary/5" 
        : "border-secondary/30 bg-secondary/5",
      className
    )}>
      {/* Group Header */}
      <div className={cn(
        "flex items-center gap-2 px-4 py-3 border-b border-dashed",
        logic === 'AND' ? "border-primary/20" : "border-secondary/20"
      )}>
        <button 
          type="button"
          className="cursor-grab opacity-40 hover:opacity-100 transition-opacity"
          title="Drag to reorder group"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        
        {/* Logic Selector */}
        <div className="flex items-center gap-1 bg-background rounded-lg p-0.5 shadow-sm">
          <button
            type="button"
            onClick={() => onLogicChange('AND')}
            className={cn(
              "px-3 py-1 text-xs font-semibold uppercase tracking-wider rounded-md",
              "transition-all duration-200",
              logic === 'AND'
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            ALL of
          </button>
          <button
            type="button"
            onClick={() => onLogicChange('OR')}
            className={cn(
              "px-3 py-1 text-xs font-semibold uppercase tracking-wider rounded-md",
              "transition-all duration-200",
              logic === 'OR'
                ? "bg-secondary text-secondary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            ANY of
          </button>
        </div>
        
        <span className="text-sm text-muted-foreground">
          the following
        </span>
        
        <Badge variant="outline" className="ml-auto">
          {ruleCount} rule{ruleCount !== 1 ? 's' : ''}
        </Badge>
        
        {onToggleCollapse && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onToggleCollapse}
            className="h-7 w-7 p-0"
          >
            {isCollapsed ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
          </Button>
        )}
        
        {canRemove && onRemove && (
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
      
      {/* Rules Content */}
      <div className={cn(
        "overflow-hidden transition-all duration-300",
        isCollapsed ? "max-h-0" : "max-h-[2000px]"
      )}>
        <div className="p-4 space-y-3">
          {children}
          
          {/* Add Rule Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onAddRule}
            className="w-full border-dashed hover:border-solid hover:bg-accent"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Rule to Group
          </Button>
        </div>
      </div>
      
      {/* Collapsed Summary */}
      {isCollapsed && (
        <div className="px-4 py-3 text-sm text-muted-foreground">
          <span className="italic">
            {ruleCount} rule{ruleCount !== 1 ? 's' : ''} (click to expand)
          </span>
        </div>
      )}
    </div>
  );
};

// Simple wrapper for a single rule group (non-nested)
export const SimpleConditionGroup: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => {
  return (
    <div className={cn("space-y-3", className)}>
      {children}
    </div>
  );
};
