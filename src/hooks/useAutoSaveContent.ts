import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UseAutoSaveContentOptions {
  contentTaskId?: string;
  onSaveStart?: () => void;
  onSaveSuccess?: () => void;
  onSaveError?: (error: any) => void;
  debounceMs?: number;
}

interface ContentData {
  ai_output?: string;
  image_url?: string;
  attachments?: any;
  notes?: string;
  [key: string]: any;
}

export const useAutoSaveContent = (options: UseAutoSaveContentOptions = {}) => {
  const {
    contentTaskId,
    onSaveStart,
    onSaveSuccess,
    onSaveError,
    debounceMs = 2000
  } = options;

  const { toast } = useToast();
  const timeoutRef = useRef<NodeJS.Timeout>();
  const isAutoSavingRef = useRef(false);

  const saveContent = useCallback(async (contentData: ContentData) => {
    if (!contentTaskId || isAutoSavingRef.current) return;

    try {
      isAutoSavingRef.current = true;
      onSaveStart?.();

      const { error } = await supabase
        .from('content_tasks')
        .update({
          ...contentData,
          updated_at: new Date().toISOString()
        })
        .eq('id', contentTaskId);

      if (error) throw error;

      onSaveSuccess?.();
    } catch (error) {
      console.error('Auto-save failed:', error);
      onSaveError?.(error);
      toast({
        title: "Auto-save failed",
        description: "Your changes may not be saved. Please try again.",
        variant: "destructive"
      });
    } finally {
      isAutoSavingRef.current = false;
    }
  }, [contentTaskId, onSaveStart, onSaveSuccess, onSaveError, toast]);

  const debouncedSave = useCallback((contentData: ContentData) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      saveContent(contentData);
    }, debounceMs);
  }, [saveContent, debounceMs]);

  const forceSave = useCallback((contentData: ContentData) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    saveContent(contentData);
  }, [saveContent]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    debouncedSave,
    forceSave,
    isAutoSaving: isAutoSavingRef.current
  };
};