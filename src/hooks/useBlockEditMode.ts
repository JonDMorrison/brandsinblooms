import { useState, useCallback, useEffect } from 'react';

export type EditMode = 'text' | 'image' | null;

interface UseBlockEditModeReturn {
  editMode: EditMode;
  setEditMode: (mode: EditMode) => void;
  isTextEditing: boolean;
  isImageEditing: boolean;
  exitEditMode: () => void;
  toggleMode: (mode: EditMode) => void;
}

export const useBlockEditMode = (initialMode: EditMode = null): UseBlockEditModeReturn => {
  const [editMode, setEditMode] = useState<EditMode>(initialMode);

  // Computed booleans for easier component logic
  const isTextEditing = editMode === 'text';
  const isImageEditing = editMode === 'image';

  // Exit edit mode
  const exitEditMode = useCallback(() => {
    setEditMode(null);
  }, []);

  // Toggle mode - if same mode is clicked, exit; otherwise switch
  const toggleMode = useCallback((mode: EditMode) => {
    setEditMode(currentMode => currentMode === mode ? null : mode);
  }, []);

  // ESC key handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && editMode !== null) {
        exitEditMode();
      }
    };

    if (editMode !== null) {
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [editMode, exitEditMode]);

  return {
    editMode,
    setEditMode,
    isTextEditing,
    isImageEditing,
    exitEditMode,
    toggleMode
  };
};