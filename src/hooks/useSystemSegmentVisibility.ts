import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'hidden-system-segments';

export const useSystemSegmentVisibility = () => {
  const [hiddenSegments, setHiddenSegments] = useState<Set<string>>(new Set());

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setHiddenSegments(new Set(parsed));
        }
      }
    } catch (error) {
      console.error('Failed to load hidden segments from localStorage:', error);
    }
  }, []);

  // Save to localStorage whenever hiddenSegments changes
  const saveToStorage = useCallback((segments: Set<string>) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(segments)));
    } catch (error) {
      console.error('Failed to save hidden segments to localStorage:', error);
    }
  }, []);

  const hideSegment = useCallback((segmentId: string) => {
    setHiddenSegments(prev => {
      const newSet = new Set(prev);
      newSet.add(segmentId);
      saveToStorage(newSet);
      return newSet;
    });
  }, [saveToStorage]);

  const showSegment = useCallback((segmentId: string) => {
    setHiddenSegments(prev => {
      const newSet = new Set(prev);
      newSet.delete(segmentId);
      saveToStorage(newSet);
      return newSet;
    });
  }, [saveToStorage]);

  const isHidden = useCallback((segmentId: string) => {
    return hiddenSegments.has(segmentId);
  }, [hiddenSegments]);

  const hiddenCount = hiddenSegments.size;

  return {
    hiddenSegments,
    hideSegment,
    showSegment,
    isHidden,
    hiddenCount,
  };
};
