import React from 'react';
import { Button } from '@/components/ui/button';
import { LucideIcon } from 'lucide-react';

interface ActionProps {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  variant?: 'default' | 'outline' | 'secondary';
}

interface PageHeaderProps {
  title: string;
  description?: string;
  primaryAction?: ActionProps;
  secondaryAction?: ActionProps;
  rightSlot?: React.ReactNode;
}

export const PageHeader = ({
  title,
  description,
  primaryAction,
  secondaryAction,
  rightSlot
}: PageHeaderProps) => {
  return (
    <div className="w-full bg-white border-b border-border">
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              {title}
            </h1>
            {description && (
              <p className="text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            {rightSlot}
          </div>
        </div>
      </div>
    </div>
  );
};