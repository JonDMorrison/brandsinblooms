
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

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
  const [allSegments, setAllSegments] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen) {
      fetchAllSegments();
    }
  }, [isOpen]);

  const fetchAllSegments = async () => {
    try {
      // Fetch both predefined and custom segments
      const [predefinedResponse, customResponse] = await Promise.all([
        supabase.from("crm_segments").select("*"),
        supabase.from("custom_segments").select("*")
      ]);

      const combined = [
        ...(predefinedResponse.data || []),
        ...(customResponse.data || [])
      ];
      
      setAllSegments(combined);
    } catch (error) {
      console.error("Error fetching segments:", error);
    }
  };

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
    allSegments,
    openModal,
    closeModal,
    handleSegmentsSelected,
    clearSegments,
    hasSegments: selectedSegments.length > 0,
    refreshSegments: fetchAllSegments
  };
};
