import React from 'react';
import { Clock } from 'lucide-react';
import { getDelayLabel, getEquivalentTime } from '@/lib/delayUtils';
import type { Step } from '@/lib/campaignTemplates';

interface DelayDisplayProps {
  step: Step;
  showEquivalent?: boolean;
}

export const DelayDisplay: React.FC<DelayDisplayProps> = ({ step, showEquivalent = false }) => {
  const delayLabel = getDelayLabel(step.delayValue, step.delayUnit);
  const equivalent = showEquivalent ? getEquivalentTime(step.delayValue, step.delayUnit) : null;
  
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Clock className="w-4 h-4" />
      <span>{delayLabel}</span>
      {equivalent && equivalent !== delayLabel && (
        <span className="text-xs">({equivalent})</span>
      )}
    </div>
  );
};