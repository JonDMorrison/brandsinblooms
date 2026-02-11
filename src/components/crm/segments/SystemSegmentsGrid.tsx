import React from 'react';
import { useSegmentResolution } from '@/hooks/useSegmentResolution';
import { SYSTEM_SEGMENTS } from '@/config/segmentDefinitions';
import { SystemSegmentCard } from './SystemSegmentCard';
import { ResolvedSegment } from '@/utils/segmentResolution';
import { Skeleton } from '@/components/ui/skeleton';

interface SystemSegmentsGridProps {
  onAdd: (segment: ResolvedSegment, definition: typeof SYSTEM_SEGMENTS[number]) => void;
  onViewDetails: (segment: ResolvedSegment) => void;
  onCreateCampaign: (segment: ResolvedSegment) => void;
  refreshKey?: number;
  activatingId?: string | null;
}

export const SystemSegmentsGrid: React.FC<SystemSegmentsGridProps> = ({
  onAdd,
  onViewDetails,
  onCreateCampaign,
  refreshKey,
  activatingId,
}) => {
  const { resolved, loading } = useSegmentResolution(refreshKey);

  // Map each system definition to its resolved segment, sorted active-first
  const systemCards = SYSTEM_SEGMENTS.map((def) => {
    const match = resolved.find((r) => r.definition_id === def.id);
    return { definition: def, resolved: match };
  })
    .filter((c) => c.resolved)
    .sort((a, b) => {
      // active first, pending last
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
      <h2 className="text-lg font-semibold text-foreground">System Segments</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {systemCards.map(({ definition, resolved: seg }) => (
          <SystemSegmentCard
            key={definition.id}
            segment={seg!}
            icon={definition.icon}
            isActivating={activatingId === definition.id}
            onAdd={() => onAdd(seg!, definition)}
            onViewDetails={() => onViewDetails(seg!)}
            onCreateCampaign={() => onCreateCampaign(seg!)}
          />
        ))}
      </div>
    </div>
  );
};
