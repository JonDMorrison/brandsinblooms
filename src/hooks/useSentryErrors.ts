import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SentryError {
  id: string;
  title: string;
  description: string;
  errorType: string;
  count: number;
  userCount: number;
  firstSeen: string;
  lastSeen: string;
  level: string;
  status: string;
  shortId: string;
  permalink: string;
  location: string;
  suggestedFix?: string;
}

export interface SentrySummary {
  total: number;
  unresolved: number;
  highPriority: number;
}

export interface SentryResponse {
  success: boolean;
  errors: SentryError[];
  summary: SentrySummary;
}

export const useSentryErrors = () => {
  const [errors, setErrors] = useState<SentryError[]>([]);
  const [summary, setSummary] = useState<SentrySummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchErrors = useCallback(async (options?: {
    orgSlug?: string;
    projectSlug?: string;
    limit?: number;
  }) => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: functionError } = await supabase.functions.invoke('sentry-integration', {
        body: options || {}
      });

      if (functionError) {
        throw new Error(functionError.message);
      }

      if (data.success) {
        setErrors(data.errors);
        setSummary(data.summary);
      } else {
        throw new Error(data.error || 'Failed to fetch Sentry errors');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Error fetching Sentry errors:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    errors,
    summary,
    loading,
    error,
    fetchErrors,
  };
};