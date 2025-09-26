import React, { createContext, useContext, useEffect, useState } from 'react';
import { SequentialImageLoader } from '@/services/SequentialImageLoader';

interface LoadingStatus {
  isLoading: boolean;
  current: string | null;
  total: number;
  completed: number;
  queue: string[];
}

interface ImageLoadingContextType {
  loadingStatus: LoadingStatus;
  loadImage: (prompt: string, priority?: 'high' | 'normal') => Promise<any>;
}

const ImageLoadingContext = createContext<ImageLoadingContextType | null>(null);

export const useImageLoading = () => {
  const context = useContext(ImageLoadingContext);
  if (!context) {
    throw new Error('useImageLoading must be used within ImageLoadingProvider');
  }
  return context;
};

export const ImageLoadingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loadingStatus, setLoadingStatus] = useState<LoadingStatus>({
    isLoading: false,
    current: null,
    total: 0,
    completed: 0,
    queue: []
  });

  useEffect(() => {
    const unsubscribe = SequentialImageLoader.subscribe(setLoadingStatus);
    return unsubscribe;
  }, []);

  const loadImage = async (prompt: string, priority: 'high' | 'normal' = 'normal') => {
    return SequentialImageLoader.addToQueue(prompt, priority);
  };

  return (
    <ImageLoadingContext.Provider value={{ loadingStatus, loadImage }}>
      {children}
    </ImageLoadingContext.Provider>
  );
};