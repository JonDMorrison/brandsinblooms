import * as React from 'react';
import { cn } from '@/lib/utils';

interface LogicConnectorProps {
  value: 'AND' | 'OR';
  onChange: (value: 'AND' | 'OR') => void;
  disabled?: boolean;
  className?: string;
}

export const LogicConnector: React.FC<LogicConnectorProps> = ({
  value,
  onChange,
  disabled = false,
  className,
}) => {
  return (
    <div className={cn(
      "flex items-center justify-center py-2",
      className
    )}>
      {/* Connector line - top */}
      <div className="absolute left-1/2 -translate-x-1/2 h-4 w-px bg-border -top-2" />
      
      {/* Logic toggle */}
      <div className={cn(
        "relative inline-flex items-center gap-0 p-1 rounded-full",
        "bg-muted/80 backdrop-blur-sm border shadow-sm",
        "transition-all duration-300"
      )}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange('AND')}
          className={cn(
            "px-4 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-full",
            "transition-all duration-200 ease-out",
            "focus:outline-none focus:ring-2 focus:ring-primary/50",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            value === 'AND'
              ? "bg-primary text-primary-foreground shadow-md"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          AND
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange('OR')}
          className={cn(
            "px-4 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-full",
            "transition-all duration-200 ease-out",
            "focus:outline-none focus:ring-2 focus:ring-primary/50",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            value === 'OR'
              ? "bg-secondary text-secondary-foreground shadow-md"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          OR
        </button>
        
        {/* Glow effect on toggle */}
        <div className={cn(
          "absolute inset-0 rounded-full transition-all duration-300 pointer-events-none",
          value === 'AND' 
            ? "shadow-[0_0_15px_rgba(var(--primary),0.3)]" 
            : "shadow-[0_0_15px_rgba(var(--secondary),0.3)]"
        )} />
      </div>
      
      {/* Connector line - bottom */}
      <div className="absolute left-1/2 -translate-x-1/2 h-4 w-px bg-border -bottom-2" />
    </div>
  );
};

// Simplified inline logic connector for compact display
export const InlineLogicConnector: React.FC<LogicConnectorProps> = ({
  value,
  onChange,
  disabled = false,
  className,
}) => {
  return (
    <div className={cn(
      "flex items-center gap-2 py-3",
      className
    )}>
      <div className="flex-1 h-px bg-border" />
      
      <div className="flex items-center gap-1 px-1">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange('AND')}
          className={cn(
            "px-3 py-1 text-xs font-semibold uppercase tracking-wider rounded-md",
            "transition-all duration-200",
            "focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary/50",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            value === 'AND'
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-accent"
          )}
        >
          AND
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange('OR')}
          className={cn(
            "px-3 py-1 text-xs font-semibold uppercase tracking-wider rounded-md",
            "transition-all duration-200",
            "focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary/50",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            value === 'OR'
              ? "bg-secondary text-secondary-foreground"
              : "bg-muted text-muted-foreground hover:bg-accent"
          )}
        >
          OR
        </button>
      </div>
      
      <div className="flex-1 h-px bg-border" />
    </div>
  );
};
