import React from 'react';
import { GlobalDataProvider } from '@/contexts/GlobalDataContext';

interface DataProviderWrapperProps {
  children: React.ReactNode;
}

/**
 * Wrapper component that provides GlobalDataProvider for components that need content data
 * This prevents global initialization issues while still providing data context where needed
 */
export const DataProviderWrapper = ({ children }: DataProviderWrapperProps) => {
  return (
    <GlobalDataProvider>
      {children}
    </GlobalDataProvider>
  );
};