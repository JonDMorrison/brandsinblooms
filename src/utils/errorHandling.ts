
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
  // Better error logging for debugging
  console.error(`[${context}] Raw error object:`, error);
  console.error(`[${context}] Error type:`, typeof error);
  console.error(`[${context}] Error constructor:`, error?.constructor?.name);
  
  const appError: AppError = {
    message: error?.message || error?.toString() || 'An unexpected error occurred',
    code: error?.code || error?.status || 'UNKNOWN',
    isNetworkError: isNetworkError(error)
  };

  // Provide more specific error messages for common issues
  if (appError.message.includes('OpenAI API key not configured')) {
    toast.error('OpenAI API key is not configured. Please contact support.');
  } else if (appError.message.includes('Unsplash API key not configured')) {
    // Removed toast, this should be silent per the new requirements
    console.warn('Unsplash API key not configured - image generation unavailable');
  } else if (appError.isNetworkError) {
    // Removed toast for network errors
    console.warn(`Network connection issue in ${context}`);
  } else if (appError.message.includes('Content generation failed')) {
    toast.error('Content generation failed. Please try again or contact support.');
  } else {
    // Only show generic error for truly unexpected issues
    toast.error('An unexpected error occurred');
  }

  return appError;
};

export const logError = (error: any, context: string) => {
  console.error(`[${context}] Error:`, error);
  
  // Additional detailed logging
  if (error && typeof error === 'object') {
    console.error(`[${context}] Error details:`, {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      stack: error.stack
    });
  }
};
