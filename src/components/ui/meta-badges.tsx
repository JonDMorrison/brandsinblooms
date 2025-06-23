
import React from 'react';
import { StatusBadge } from './status-badge';
import { cn } from '@/lib/utils';

interface Badge {
  label: string;
  variant: string;
}

interface MetaBadgesProps {
  badges: Badge[];
  wordCount: number;
  timeAgo: string;
  className?: string;
}

export const MetaBadges = ({ badges, wordCount, timeAgo, className }: MetaBadgesProps) => {
  const visibleBadges = badges.slice(0, 2);
  const hasMoreBadges = badges.length > 2;

  return (
    <div className={cn("hidden md:flex items-center gap-2 text-xs", className)}>
      {/* Badges */}
      <div className="flex items-center gap-1">
        {visibleBadges.map((badge, index) => (
          <StatusBadge key={index} variant={badge.variant as any}>
            {badge.label}
          </StatusBadge>
        ))}
        {hasMoreBadges && (
          <span className="text-slate-400 dark:text-slate-500">+{badges.length - 2}</span>
        )}
      </div>
      
      {/* Divider */}
      {badges.length > 0 && (
        <span className="text-slate-300 dark:text-slate-600">•</span>
      )}
      
      {/* Word count */}
      <span className="text-slate-400 dark:text-slate-500">
        {wordCount > 0 ? `${wordCount} words` : '—'}
      </span>
      
      {/* Age */}
      <span className="text-slate-400 dark:text-slate-500">
        {timeAgo}
      </span>
    </div>
  );
};
