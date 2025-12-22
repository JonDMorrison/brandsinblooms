import * as React from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface CustomerMatchCardProps {
  customer: {
    id: string;
    name: string;
    email: string;
    value?: number;
    matchReasons?: string[];
  };
  className?: string;
}

export const CustomerMatchCard: React.FC<CustomerMatchCardProps> = ({
  customer,
  className,
}) => {
  return (
    <div className={cn(
      "flex items-center gap-3 p-3 rounded-lg bg-background border hover:border-primary/30 transition-colors",
      className
    )}>
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
        {customer.name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{customer.name}</p>
        <p className="text-xs text-muted-foreground truncate">{customer.email}</p>
        {customer.matchReasons && customer.matchReasons.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {customer.matchReasons.map((reason, i) => (
              <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0">
                {reason}
              </Badge>
            ))}
          </div>
        )}
      </div>
      {customer.value !== undefined && (
        <div className="text-right">
          <p className="font-semibold">${customer.value.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground">lifetime</p>
        </div>
      )}
    </div>
  );
};
