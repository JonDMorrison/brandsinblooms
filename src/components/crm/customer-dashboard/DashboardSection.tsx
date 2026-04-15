import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui-legacy/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui-legacy/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui-legacy/collapsible';

interface DashboardSectionProps {
  title: string;
  icon?: React.ReactNode;
  tooltip?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  collapsible?: boolean;
  variant?: 'default' | 'highlight' | 'warning' | 'critical';
  className?: string;
}

const variantStyles = {
  default: 'border-border bg-card',
  highlight: 'border-brand-teal/30 bg-gradient-to-br from-brand-teal/5 to-transparent',
  warning: 'border-amber-200 bg-gradient-to-br from-amber-50/50 to-transparent',
  critical: 'border-red-200 bg-gradient-to-br from-red-50/30 to-transparent',
};

export const DashboardSection: React.FC<DashboardSectionProps> = ({
  title,
  icon,
  tooltip,
  badge,
  children,
  defaultOpen = true,
  collapsible = true,
  variant = 'default',
  className,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const headerContent = (
    <div className="flex items-center gap-2">
      {icon && (
        <div className="text-muted-foreground">
          {icon}
        </div>
      )}
      <h3 className="font-semibold text-foreground">{title}</h3>
      {tooltip && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-xs">
              <p className="text-xs">{tooltip}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );

  if (!collapsible) {
    return (
      <section
        className={cn(
          'rounded-xl border p-4 sm:p-5',
          variantStyles[variant],
          className
        )}
      >
        <div className="flex items-center justify-between mb-4">
          {headerContent}
          {badge && <div onClick={(e) => e.stopPropagation()}>{badge}</div>}
        </div>
        {children}
      </section>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <section
        className={cn(
          'rounded-xl border overflow-hidden',
          variantStyles[variant],
          className
        )}
      >
        <div className="flex items-center justify-between p-4 sm:p-5">
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-2 text-left hover:bg-muted/30 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg -m-2 p-2">
              {headerContent}
              <ChevronDown 
                className={cn(
                  'h-4 w-4 text-muted-foreground transition-transform duration-200',
                  isOpen && 'rotate-180'
                )} 
              />
            </button>
          </CollapsibleTrigger>
          {badge && <div onClick={(e) => e.stopPropagation()}>{badge}</div>}
        </div>
        <CollapsibleContent>
          <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-0">
            {children}
          </div>
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
};

export default DashboardSection;
