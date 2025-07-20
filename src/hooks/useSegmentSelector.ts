
import { useState } from 'react';

interface Segment {
  id: string;
  name: string;
  customer_count: number;
  description?: string;
}

interface UseSegmentSelectorOptions {
  onSegmentsSelected?: (segments: Segment[]) => void;
}

export const useSegmentSelector = (options?: UseSegmentSelectorOptions) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedSegments, setSelectedSegments] = useState<Segment[]>([]);

  const openModal = () => setIsOpen(true);
  const closeModal = () => setIsOpen(false);

  const handleSegmentsSelected = (segments: Segment[]) => {
    setSelectedSegments(segments);
    if (options?.onSegmentsSelected) {
      options.onSegmentsSelected(segments);
    }
  };

  const clearSegments = () => {
    setSelectedSegments([]);
  };

  const hasSegments = selectedSegments.length > 0;
  const selectedSegmentIds = selectedSegments.map(segment => segment.id);

  return {
    isOpen,
    selectedSegments,
    selectedSegmentIds,
    openModal,
    closeModal,
    handleSegmentsSelected,
    clearSegments,
    hasSegments
  };
};
