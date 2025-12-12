/**
 * Hook for rendering email merge tags via the server
 * 
 * Provides a consistent way to render merge tags in email previews
 * using the same logic as the sending pipeline.
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { normalizeMergeTags } from '@/utils/mergeTagSanitizer';

export interface RenderDiagnostics {
  usedTags: string[];
  missingTags: string[];
  emptyResolvedTags: string[];
  legacyTagsConverted: number;
}

export interface RenderMergeTagsResult {
  success: boolean;
  renderedHtml: string;
  diagnostics: RenderDiagnostics;
  error?: string;
}

export interface SampleCustomer {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  custom?: Record<string, unknown>;
}

export interface UseRenderMergeTagsOptions {
  tenantId?: string;
}

export function useRenderMergeTags(options: UseRenderMergeTagsOptions = {}) {
  const [isRendering, setIsRendering] = useState(false);
  const [lastResult, setLastResult] = useState<RenderMergeTagsResult | null>(null);

  const renderWithMergeTags = useCallback(async (
    html: string,
    params: {
      customerId?: string;
      sampleCustomer?: SampleCustomer;
      mode?: 'preview' | 'send';
    } = {}
  ): Promise<RenderMergeTagsResult> => {
    setIsRendering(true);

    try {
      // First normalize any escaped tags client-side
      const normalizedHtml = normalizeMergeTags(html);

      const { data, error } = await supabase.functions.invoke('render-email-merge-tags', {
        body: {
          tenantId: options.tenantId,
          customerId: params.customerId,
          sampleCustomer: params.sampleCustomer,
          html: normalizedHtml,
          mode: params.mode || 'preview',
        },
      });

      if (error) {
        const result: RenderMergeTagsResult = {
          success: false,
          renderedHtml: html,
          diagnostics: { usedTags: [], missingTags: [], emptyResolvedTags: [], legacyTagsConverted: 0 },
          error: error.message,
        };
        setLastResult(result);
        return result;
      }

      const result: RenderMergeTagsResult = {
        success: data.success,
        renderedHtml: data.renderedHtml || html,
        diagnostics: data.diagnostics || { usedTags: [], missingTags: [], emptyResolvedTags: [], legacyTagsConverted: 0 },
        error: data.error,
      };

      setLastResult(result);
      return result;

    } catch (err: any) {
      const result: RenderMergeTagsResult = {
        success: false,
        renderedHtml: html,
        diagnostics: { usedTags: [], missingTags: [], emptyResolvedTags: [], legacyTagsConverted: 0 },
        error: err.message,
      };
      setLastResult(result);
      return result;
    } finally {
      setIsRendering(false);
    }
  }, [options.tenantId]);

  return {
    renderWithMergeTags,
    isRendering,
    lastResult,
  };
}

export default useRenderMergeTags;
