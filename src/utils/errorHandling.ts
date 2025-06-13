
import { toast } from "sonner";

export interface AppError {
  message: string;
  code?: string;
  isNetworkError?: boolean;
}

export const isNetworkError = (error: any): boolean => {
  return !navigator.onLine || 
         error?.message?.includes('Failed to fetch') ||
         error?.message?.includes('Network Error') ||
         error?.message?.includes('ERR_INTERNET_DISCONNECTED');
};

export const handleError = (error: any, context: string): AppError => {
  const appError: AppError = {
    message: error?.message || 'An unexpected error occurred',
    isNetworkError: isNetworkError(error)
  };

  if (appError.isNetworkError) {
    toast.warning(`Connection issue in ${context}. Using cached data when available.`);
  } else {
    toast.error(`Error in ${context}: ${appError.message}`);
  }

  return appError;
};

export const logError = (error: any, context: string) => {
  console.error(`[${context}] Error:`, error);
};
