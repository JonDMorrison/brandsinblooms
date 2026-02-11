import React, { useEffect, useRef } from 'react';
import { useSegmentResolution } from '@/hooks/useSegmentResolution';
import { SYSTEM_SEGMENTS } from '@/config/segmentDefinitions';
import { SystemSegmentCard } from './SystemSegmentCard';
import { ResolvedSegment } from '@/utils/segmentResolution';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';

interface SystemSegmentsGridProps {
  onAdd: (segment: ResolvedSegment, definition: typeof SYSTEM_SEGMENTS[number]) => void;
  onViewDetails: (segment: ResolvedSegment) => void;
  onCreateCampaign: (segment: ResolvedSegment) => void;
  onUpgrade?: (segment: ResolvedSegment) => void;
  refreshKey?: number;
  activatingId?: string | null;
}

export const SystemSegmentsGrid: React.FC<SystemSegmentsGridProps> = ({
  onAdd,
  onViewDetails,
  onCreateCampaign,
  onUpgrade,
  refreshKey,
  activatingId,
}) => {
  const { resolved, duplicateWarnings, loading } = useSegmentResolution(refreshKey);
  const { toast } = useToast();
  const duplicateToastShown = useRef(false);

  // Show duplicate warning toast once per session
  useEffect(() => {
    if (!loading && duplicateWarnings.length > 0 && !duplicateToastShown.current) {
      duplicateToastShown.current = true;
      const names = duplicateWarnings.map((w) => `"${w.name}"`).join(', ');
      toast({
        title: 'Duplicate Segments Detected',
        description: `Multiple segments share the same name: ${names}. Consider consolidating them.`,
      });
    }
  }, [loading, duplicateWarnings, toast]);

  // Build duplicate lookup
  const duplicateNameSet = new Set(duplicateWarnings.map((w) => w.name.toLowerCase()));

  // Map each system definition to its resolved segment, sorted active-first
  const systemCards = SYSTEM_SEGMENTS.map((def) => {
    const match = resolved.find((r) => r.definition_id === def.id);
    return { definition: def, resolved: match };
  })
    .filter((c) => c.resolved)
    .sort((a, b) => {
      if (a.resolved!.state === 'system_pending' && b.resolved!.state !== 'system_pending') return 1;
      if (a.resolved!.state !== 'system_pending' && b.resolved!.state === 'system_pending') return -1;
      return 0;
    });

  if (loading) {
    return (
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">System Segments</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (systemCards.length === 0) return null;

  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center gap-1.5">
          <h2 className="text-lg font-semibold text-foreground">System Segments</h2>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="text-sm leading-relaxed">
                System segments are predefined customer groups maintained automatically. Their names cannot be changed. Click + to activate one.
              </p>
            </TooltipContent>
          </Tooltip>
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">
          Predefined segments that are automatically maintained. Click + to activate.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {systemCards.map(({ definition, resolved: seg }) => (
          <SystemSegmentCard
            key={definition.id}
            segment={seg!}
            icon={definition.icon}
            isActivating={activatingId === definition.id}
            hasDuplicate={duplicateNameSet.has(seg!.name.toLowerCase())}
            onAdd={() => onAdd(seg!, definition)}
            onUpgrade={seg!.state === 'user' && onUpgrade ? () => onUpgrade(seg!) : undefined}
            onViewDetails={() => onViewDetails(seg!)}
            onCreateCampaign={() => onCreateCampaign(seg!)}
          />
        ))}
      </div>
    </div>
  );
};
