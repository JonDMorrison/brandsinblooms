
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Mail, Calendar, Gift, Sparkles } from 'lucide-react';

interface ContentImportBadgeProps {
  themeSource: 'weekly' | 'holiday' | 'event' | 'custom';
  className?: string;
}

const getSourceIcon = (source: string) => {
  switch (source) {
    case 'weekly':
      return Calendar;
    case 'holiday':
      return Gift;
    case 'event':
      return Sparkles;
    default:
      return Mail;
  }
};

const getSourceLabel = (source: string) => {
  switch (source) {
    case 'weekly':
      return 'Weekly Theme';
    case 'holiday':
      return 'Holiday Content';
    case 'event':
      return 'Custom Event';
    default:
      return 'Newsletter';
  }
};

const getSourceColor = (source: string) => {
  switch (source) {
    case 'weekly':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'holiday':
      return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'event':
      return 'bg-orange-50 text-orange-700 border-orange-200';
    default:
      return 'bg-green-50 text-green-700 border-green-200';
  }
};

export const ContentImportBadge = ({ themeSource, className = '' }: ContentImportBadgeProps) => {
  const Icon = getSourceIcon(themeSource);
  const label = getSourceLabel(themeSource);
  const colorClass = getSourceColor(themeSource);

  return (
    <Badge 
      variant="outline" 
      className={`${colorClass} ${className} flex items-center gap-1 font-medium`}
    >
      <Icon className="w-3 h-3" />
      📩 Imported from {label}
    </Badge>
  );
};
