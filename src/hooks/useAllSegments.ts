import { useSegmentResolution } from './useSegmentResolution';

export const useAllSegments = () => {
  const {
    resolved,
    systemSegments,
    userSegments,
    pendingSystemSegments,
    duplicateWarnings,
    loading,
    refresh,
  } = useSegmentResolution();

  // Flatten to the simple shape consumers expect
  const segments = resolved.map((r) => ({
    id: r.id ?? r.definition_id,
    name: r.name,
    description: r.description,
    customer_count: r.customer_count,
    state: r.state,
    is_system_segment: r.is_system_segment,
  }));

  return {
    segments,
    loading,
    refresh,
    resolved,
    systemSegments,
    userSegments,
    pendingSystemSegments,
    duplicateWarnings,
  };
};
