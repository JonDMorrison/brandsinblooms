import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useCampaignBlockAutosave } from '@/hooks/useCampaignBlockAutosave';
import { EmailBlock } from '@/types/emailBuilder';

interface AutoSaveContextType {
  saveStatus: 'saved' | 'saving' | 'error';
  saveBlock: (block: EmailBlock) => void;
  forceSave: (block: EmailBlock) => void;
  hasUnsavedChanges: boolean;
}

const AutoSaveContext = createContext<AutoSaveContextType | undefined>(undefined);

export const useAutoSave = () => {
  const context = useContext(AutoSaveContext);
  if (!context) {
    throw new Error('useAutoSave must be used within AutoSaveManager');
  }
  return context;
};

interface AutoSaveManagerProps {
  children: React.ReactNode;
  campaignId: string;
}

export const AutoSaveManager: React.FC<AutoSaveManagerProps> = ({ children, campaignId }) => {
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const { debouncedSave, forceSave: forceBlockSave } = useCampaignBlockAutosave({
    onSaveStart: () => {
      setSaveStatus('saving');
    },
    onSaveSuccess: () => {
      setSaveStatus('saved');
      setHasUnsavedChanges(false);
    },
    onSaveError: () => {
      setSaveStatus('error');
    }
  });

  const saveBlock = useCallback((block: EmailBlock) => {
    setHasUnsavedChanges(true);
    debouncedSave(block, campaignId);
  }, [debouncedSave, campaignId]);

  const forceSave = useCallback((block: EmailBlock) => {
    forceBlockSave(block, campaignId);
  }, [forceBlockSave, campaignId]);

  // Warn user before leaving page if there are unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  return (
    <AutoSaveContext.Provider value={{
      saveStatus,
      saveBlock,
      forceSave,
      hasUnsavedChanges
    }}>
      {children}
    </AutoSaveContext.Provider>
  );
};