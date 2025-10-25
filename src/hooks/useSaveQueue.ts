import { useRef, useCallback } from 'react';

/**
 * Hook to manage a queue of save operations
 * Ensures only one save runs at a time, preventing race conditions
 */
export const useSaveQueue = () => {
  const saveQueueRef = useRef<Array<() => Promise<void>>>([]);
  const isProcessingRef = useRef(false);
  const activeSaveRef = useRef<Promise<void> | null>(null);

  const processQueue = useCallback(async () => {
    if (isProcessingRef.current || saveQueueRef.current.length === 0) {
      return;
    }

    isProcessingRef.current = true;

    while (saveQueueRef.current.length > 0) {
      const saveOperation = saveQueueRef.current.shift();
      
      if (saveOperation) {
        try {
          await saveOperation();
        } catch (error) {
          console.error('Save operation failed:', error);
          // Continue processing queue even if one operation fails
        }
      }
    }

    isProcessingRef.current = false;
    activeSaveRef.current = null;
  }, []);

  const enqueueSave = useCallback((saveOperation: () => Promise<void>) => {
    // Clear the queue and only keep the latest save operation
    // This prevents multiple stale saves from piling up
    saveQueueRef.current = [saveOperation];

    // Start processing if not already running
    if (!isProcessingRef.current) {
      const processing = processQueue();
      activeSaveRef.current = processing;
    }

    return activeSaveRef.current || Promise.resolve();
  }, [processQueue]);

  const cancelPendingSaves = useCallback(() => {
    saveQueueRef.current = [];
  }, []);

  return {
    enqueueSave,
    cancelPendingSaves,
    isProcessing: () => isProcessingRef.current
  };
};

