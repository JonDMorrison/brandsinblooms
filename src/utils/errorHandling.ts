
// Removed sonner import - using global toast replacement
import { Sentry } from '@/lib/sentry';

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

  // Send critical errors to Sentry
  if (appError.code === 'UNAUTHORIZED' || 
      appError.code === 'PAYMENT_REQUIRED' ||
      appError.message.includes('OpenAI API key not configured') ||
      (appError.message.includes('Content generation failed') && context.includes('critical'))) {
    Sentry.captureException(error, {
      tags: {
        context,
        errorCode: appError.code,
        isNetworkError: appError.isNetworkError
      },
      extra: {
        errorMessage: appError.message,
        originalError: error
      }
    });
  }

  // Only show toasts for critical errors that require user action
  if (appError.message.includes('OpenAI API key not configured')) {
    toast.error('AI service unavailable. Please contact support.');
  } else if (appError.code === 'UNAUTHORIZED' || appError.message.includes('Authentication')) {
    toast.error('Please sign in again to continue.');
  } else if (appError.code === 'PAYMENT_REQUIRED' || appError.message.includes('subscription')) {
    toast.error('Subscription required. Please check your billing.');
  } else if (appError.message.includes('Content generation failed') && context.includes('critical')) {
    toast.error('Content generation failed. Please try again.');
  }
  // Silently handle: network errors, API configuration issues, validation errors, non-critical failures

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
