
import { useState } from "react";

interface UseSegmentSelectorProps {
  onSegmentsSelected?: (segments: any[]) => void;
  initialSegments?: any[];
}

export const useSegmentSelector = ({ 
  onSegmentsSelected, 
  initialSegments = [] 
}: UseSegmentSelectorProps = {}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedSegments, setSelectedSegments] = useState<any[]>(initialSegments);

  const openModal = () => setIsOpen(true);
  const closeModal = () => setIsOpen(false);

  const handleSegmentsSelected = (segments: any[]) => {
    setSelectedSegments(segments);
    onSegmentsSelected?.(segments);
    closeModal();
  };

  const clearSegments = () => {
    setSelectedSegments([]);
    onSegmentsSelected?.([]);
  };

  return {
    isOpen,
    selectedSegments,
    selectedSegmentIds: selectedSegments.map(s => s.id),
    openModal,
    closeModal,
    handleSegmentsSelected,
    clearSegments,
    hasSegments: selectedSegments.length > 0
  };
};
