/**
 * Enhanced Development Error Logger
 * Provides comprehensive error visibility for debugging
 */

interface ErrorLogEntry {
  id: string;
  timestamp: string;
  type: 'runtime' | 'network' | 'promise' | 'react' | 'supabase';
  message: string;
  stack?: string;
  context?: Record<string, any>;
  functionName?: string;
  requestPayload?: any;
  statusCode?: number;
  errorBody?: any;
}

// In-memory error store for the debug panel
const errorStore: ErrorLogEntry[] = [];
const MAX_ERRORS = 50;

// Event emitter for real-time updates
type ErrorListener = (errors: ErrorLogEntry[]) => void;
const listeners: ErrorListener[] = [];

export const subscribeToErrors = (listener: ErrorListener) => {
  listeners.push(listener);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx > -1) listeners.splice(idx, 1);
  };
};

const notifyListeners = () => {
  listeners.forEach(l => l([...errorStore]));
};

const generateId = () => Math.random().toString(36).substring(2, 10);

const isDev = () => {
  return import.meta.env.DEV || 
         window.location.hostname.includes('lovableproject.com') ||
         window.location.hostname === 'localhost';
};

/**
 * Log an error with full context
 */
export const logDevError = (
  type: ErrorLogEntry['type'],
  error: Error | string,
  context?: {
    functionName?: string;
    requestPayload?: any;
    statusCode?: number;
    errorBody?: any;
    extra?: Record<string, any>;
  }
) => {
  if (!isDev()) return;

  const errorObj = error instanceof Error ? error : new Error(String(error));
  const timestamp = new Date().toISOString();
  
  const entry: ErrorLogEntry = {
    id: generateId(),
    timestamp,
    type,
    message: errorObj.message,
    stack: errorObj.stack,
    functionName: context?.functionName,
    requestPayload: context?.requestPayload,
    statusCode: context?.statusCode,
    errorBody: context?.errorBody,
    context: context?.extra,
  };

  // Add to store
  errorStore.unshift(entry);
  if (errorStore.length > MAX_ERRORS) {
    errorStore.pop();
  }
  notifyListeners();

  // Log to console with rich formatting
  console.group(
    `%c🔴 [${type.toUpperCase()}] ${timestamp}`,
    'color: #ff4444; font-weight: bold; font-size: 12px;'
  );
  
  console.error('%cError Message:', 'color: #ff6b6b; font-weight: bold;', errorObj.message);
  
  if (context?.functionName) {
    console.log('%cFunction/Path:', 'color: #ffa94d; font-weight: bold;', context.functionName);
  }
  
  if (context?.statusCode) {
    console.log('%cStatus Code:', 'color: #ffa94d; font-weight: bold;', context.statusCode);
  }
  
  if (context?.errorBody) {
    console.log('%cError Body:', 'color: #ffa94d; font-weight: bold;');
    console.dir(context.errorBody);
  }
  
  if (context?.requestPayload) {
    console.log('%cRequest Payload:', 'color: #74c0fc; font-weight: bold;');
    console.dir(context.requestPayload);
  }
  
  if (errorObj.stack) {
    console.log('%cStack Trace:', 'color: #ff8787; font-weight: bold;');
    console.log(errorObj.stack);
  }
  
  if (context?.extra) {
    console.log('%cAdditional Context:', 'color: #69db7c; font-weight: bold;');
    console.dir(context.extra);
  }
  
  console.groupEnd();
  
  return entry;
};

/**
 * Log a Supabase error with PostgREST details
 */
export const logSupabaseError = (
  error: any,
  functionName: string,
  requestPayload?: any
) => {
  const supabaseDetails = {
    code: error?.code,
    details: error?.details,
    hint: error?.hint,
    message: error?.message,
    status: error?.status,
    statusText: error?.statusText,
  };

  return logDevError('supabase', error?.message || 'Supabase error', {
    functionName,
    requestPayload,
    statusCode: error?.status,
    errorBody: supabaseDetails,
    extra: {
      postgrestError: error?.code,
      hint: error?.hint,
    },
  });
};

/**
 * Log a network/fetch error
 */
export const logNetworkError = (
  url: string,
  method: string,
  error: any,
  response?: Response,
  responseBody?: any
) => {
  return logDevError('network', error?.message || `Network error: ${url}`, {
    functionName: `${method} ${url}`,
    statusCode: response?.status,
    errorBody: responseBody,
    extra: {
      url,
      method,
      statusText: response?.statusText,
      headers: response?.headers ? Object.fromEntries(response.headers.entries()) : undefined,
    },
  });
};

/**
 * Log an unhandled promise rejection
 */
export const logPromiseRejection = (reason: any) => {
  const error = reason instanceof Error ? reason : new Error(String(reason));
  return logDevError('promise', error, {
    extra: {
      rawReason: reason,
    },
  });
};

/**
 * Log a React component error
 */
export const logReactError = (
  error: Error,
  componentStack?: string,
  componentName?: string
) => {
  return logDevError('react', error, {
    functionName: componentName || 'Unknown Component',
    extra: {
      componentStack,
    },
  });
};

/**
 * Get all stored errors
 */
export const getStoredErrors = (): ErrorLogEntry[] => {
  return [...errorStore];
};

/**
 * Clear all stored errors
 */
export const clearStoredErrors = () => {
  errorStore.length = 0;
  notifyListeners();
};

export type { ErrorLogEntry };
