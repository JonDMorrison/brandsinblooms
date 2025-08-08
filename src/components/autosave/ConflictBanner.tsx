
import React from 'react';
import { AlertTriangle, FileDiff, Check, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Conflict = { path: string; base: any; local: any; remote: any };

interface ConflictBannerProps {
  conflicts: Conflict[];
  onAcceptMerged: () => void;
  onDiscardBanner: () => void;
  onViewDiff?: () => void;
}

export const ConflictBanner: React.FC<ConflictBannerProps> = ({
  conflicts,
  onAcceptMerged,
  onDiscardBanner,
  onViewDiff
}) => {
  if (!conflicts?.length) return null;

  return (
    <div className="w-full border border-amber-200 bg-amber-50 text-amber-900 rounded-md p-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5" />
        <div>
          <div className="font-medium">We combined changes from another device.</div>
          <div className="text-sm opacity-90">{conflicts.length} conflicting field(s) detected.</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {onViewDiff && (
          <Button variant="outline" size="sm" onClick={onViewDiff} className="flex items-center gap-1">
            <FileDiff className="h-4 w-4" />
            View diff
          </Button>
        )}
        <Button size="sm" onClick={onAcceptMerged} className="flex items-center gap-1">
          <Check className="h-4 w-4" />
          Keep merged
        </Button>
        <Button variant="ghost" size="sm" onClick={onDiscardBanner} className="flex items-center gap-1">
          <Undo2 className="h-4 w-4" />
          Dismiss
        </Button>
      </div>
    </div>
  );
};
