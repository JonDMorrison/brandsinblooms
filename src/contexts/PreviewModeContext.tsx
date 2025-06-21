
import React, { createContext, useContext, useState, useEffect } from 'react';

interface PreviewModeContextType {
  isPreviewMode: boolean;
  togglePreviewMode: () => void;
}

const PreviewModeContext = createContext<PreviewModeContextType | undefined>(undefined);

export const PreviewModeProvider = ({ children }: { children: React.ReactNode }) => {
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  // Load preview mode state from localStorage
  useEffect(() => {
    const savedPreviewMode = localStorage.getItem('preview-mode');
    if (savedPreviewMode === 'true') {
      setIsPreviewMode(true);
    }
  }, []);

  const togglePreviewMode = () => {
    const newMode = !isPreviewMode;
    setIsPreviewMode(newMode);
    localStorage.setItem('preview-mode', newMode.toString());
  };

  return (
    <PreviewModeContext.Provider value={{ isPreviewMode, togglePreviewMode }}>
      {children}
    </PreviewModeContext.Provider>
  );
};

export const usePreviewMode = () => {
  const context = useContext(PreviewModeContext);
  if (context === undefined) {
    throw new Error('usePreviewMode must be used within a PreviewModeProvider');
  }
  return context;
};
