
import { useState, useCallback } from 'react';
import { toast } from 'sonner';

interface UndoToastOptions {
  message: string;
  duration?: number;
  onUndo?: () => void;
  onComplete?: () => void;
}

export const useUndoToast = () => {
  const [activeToastId, setActiveToastId] = useState<string | null>(null);

  const showUndoToast = useCallback(({
    message,
    duration = 8000,
    onUndo,
    onComplete
  }: UndoToastOptions) => {
    if (activeToastId) {
      toast.dismiss(activeToastId);
    }

    const toastId = toast.success(message, {
      duration,
      action: {
        label: 'Undo',
        onClick: () => {
          toast.dismiss(String(toastId));
          setActiveToastId(null);
          onUndo?.();
        }
      },
      onDismiss: () => {
        setActiveToastId(null);
      }
    });

    setActiveToastId(String(toastId));

    // Execute the action after the toast duration
    setTimeout(() => {
      if (activeToastId === String(toastId)) {
        onComplete?.();
        setActiveToastId(null);
      }
    }, duration + 100);

    return String(toastId);
  }, [activeToastId]);

  const dismissUndoToast = useCallback(() => {
    if (activeToastId) {
      toast.dismiss(activeToastId);
      setActiveToastId(null);
    }
  }, [activeToastId]);

  return {
    showUndoToast,
    dismissUndoToast,
    hasActiveToast: !!activeToastId
  };
};
