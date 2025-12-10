/**
 * Enhanced Supabase wrapper with comprehensive error logging
 */
import { supabase } from '@/integrations/supabase/client';
import { logSupabaseError, logNetworkError } from './devErrorLogger';

type InvokeOptions = {
  body?: Record<string, any>;
  headers?: Record<string, string>;
};

/**
 * Enhanced wrapper for supabase.functions.invoke with detailed error logging
 */
export const invokeEdgeFunction = async <T = any>(
  functionName: string,
  options?: InvokeOptions
): Promise<{ data: T | null; error: any }> => {
  const startTime = Date.now();
  
  try {
    console.log(`%c[Edge Function] Invoking: ${functionName}`, 'color: #74c0fc; font-weight: bold;');
    
    const { data, error } = await supabase.functions.invoke<T>(functionName, options);
    
    const duration = Date.now() - startTime;
    
    if (error) {
      // Log the full error with context
      logSupabaseError(error, `Edge Function: ${functionName}`, options?.body);
      
      // Also log structured error info
      console.error(`%c[Edge Function Error] ${functionName} (${duration}ms)`, 'color: #ff4444; font-weight: bold;');
      console.error('Error details:', {
        message: error.message,
        name: error.name,
        context: error.context,
        status: (error as any).status,
      });
      
      return { data: null, error };
    }
    
    console.log(`%c[Edge Function] ${functionName} completed (${duration}ms)`, 'color: #69db7c; font-weight: bold;');
    return { data, error: null };
    
  } catch (err: any) {
    const duration = Date.now() - startTime;
    
    // Catch network-level errors
    logNetworkError(
      `functions/${functionName}`,
      'POST',
      err,
      undefined,
      { message: err.message }
    );
    
    console.error(`%c[Edge Function Exception] ${functionName} (${duration}ms)`, 'color: #ff4444; font-weight: bold;');
    console.error('Exception:', err);
    
    return { 
      data: null, 
      error: { 
        message: err.message || 'Unknown error', 
        originalError: err 
      } 
    };
  }
};

/**
 * Enhanced wrapper for Supabase queries with error logging
 */
export const queryWithLogging = async <T>(
  queryFn: () => Promise<{ data: T | null; error: any }>,
  queryName: string,
  context?: Record<string, any>
): Promise<{ data: T | null; error: any }> => {
  const startTime = Date.now();
  
  try {
    const { data, error } = await queryFn();
    const duration = Date.now() - startTime;
    
    if (error) {
      logSupabaseError(error, `Query: ${queryName}`, context);
      
      console.error(`%c[Supabase Query Error] ${queryName} (${duration}ms)`, 'color: #ff4444; font-weight: bold;');
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      
      return { data: null, error };
    }
    
    return { data, error: null };
    
  } catch (err: any) {
    const duration = Date.now() - startTime;
    
    logSupabaseError(err, `Query Exception: ${queryName}`, context);
    
    console.error(`%c[Supabase Query Exception] ${queryName} (${duration}ms)`, 'color: #ff4444; font-weight: bold;');
    console.error('Exception:', err);
    
    return { 
      data: null, 
      error: { 
        message: err.message || 'Unknown error', 
        originalError: err 
      } 
    };
  }
};

/**
 * Enhanced fetch wrapper with comprehensive error logging
 */
export const fetchWithLogging = async (
  url: string,
  options?: RequestInit,
  context?: { functionName?: string }
): Promise<Response> => {
  const startTime = Date.now();
  const method = options?.method || 'GET';
  
  try {
    console.log(`%c[Fetch] ${method} ${url}`, 'color: #74c0fc;');
    
    const response = await fetch(url, options);
    const duration = Date.now() - startTime;
    
    if (!response.ok) {
      // Try to get the response body for error details
      let errorBody: any = null;
      try {
        const clonedResponse = response.clone();
        errorBody = await clonedResponse.json();
      } catch {
        try {
          const clonedResponse = response.clone();
          errorBody = await clonedResponse.text();
        } catch {
          // Ignore
        }
      }
      
      logNetworkError(url, method, new Error(`HTTP ${response.status}`), response, errorBody);
      
      console.error(`%c[Fetch Error] ${method} ${url} - ${response.status} (${duration}ms)`, 'color: #ff4444; font-weight: bold;');
      console.error('Response:', {
        status: response.status,
        statusText: response.statusText,
        body: errorBody,
      });
    } else {
      console.log(`%c[Fetch] ${method} ${url} - ${response.status} (${duration}ms)`, 'color: #69db7c;');
    }
    
    return response;
    
  } catch (err: any) {
    const duration = Date.now() - startTime;
    
    logNetworkError(url, method, err);
    
    console.error(`%c[Fetch Exception] ${method} ${url} (${duration}ms)`, 'color: #ff4444; font-weight: bold;');
    console.error('Exception:', err);
    
    throw err;
  }
};
