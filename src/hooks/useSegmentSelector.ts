
import { useState } from 'react';

interface Segment {
  id: string;
  name: string;
  customer_count: number;
  description?: string;
}

export const useSegmentSelector = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedSegments, setSelectedSegments] = useState<Segment[]>([]);

  const openModal = () => setIsOpen(true);
  const closeModal = () => setIsOpen(false);

  const handleSegmentsSelected = (segments: Segment[]) => {
    setSelectedSegments(segments);
  };

  const clearSegments = () => {
    setSelectedSegments([]);
  };

  const hasSegments = selectedSegments.length > 0;

  return {
    isOpen,
    selectedSegments,
    openModal,
    closeModal,
    handleSegmentsSelected,
    clearSegments,
    hasSegments
  };
};
