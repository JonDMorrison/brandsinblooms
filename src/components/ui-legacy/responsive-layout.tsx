import React from 'react';
import { cn } from '@/lib/utils';

interface ResponsiveLayoutProps {
  children: React.ReactNode;
  variant?: 'default' | 'hero' | 'content' | 'sidebar';
  className?: string;
}

export const ResponsiveLayout = ({
  children,
  variant = 'default',
  className = ''
}: ResponsiveLayoutProps) => {
  const variants = {
    default: 'w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8',
    hero: 'w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8',
    content: 'w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8',
    sidebar: 'w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8'
  };

  return (
    <div className={cn(variants[variant], className)}>
      {children}
    </div>
  );
};

interface ResponsiveGridProps {
  children: React.ReactNode;
  columns?: 1 | 2 | 3 | 4;
  gap?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const ResponsiveGrid = ({
  children,
  columns = 3,
  gap = 'md',
  className = ''
}: ResponsiveGridProps) => {
  const columnClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
  };

  const gapClasses = {
    sm: 'gap-3',
    md: 'gap-4',
    lg: 'gap-6'
  };

  return (
    <div className={cn(
      'grid',
      columnClasses[columns],
      gapClasses[gap],
      className
    )}>
      {children}
    </div>
  );
};