import * as React from "react";
import {
  hydrateThemeNewsletterBlocks,
  requestThemeNewsletter,
  type ThemeNewsletterInvoke,
  type ThemeNewsletterRequest,
} from "@/lib/studio/themeNewsletter";
import type { StudioDesignSystem } from "@/lib/studio/designSystem";
import type { StudioBlock } from "@/types/studioBlocks";

export type ThemeGenerationStatus = "idle" | "generating" | "failed";

export type ThemeGenerationContent = {
  blocks: StudioBlock[];
  subjectLine: string;
  previewText: string;
};

/**
 * Runs generate-theme-newsletter for the open Studio draft. While it runs
 * the canvas shows a generating state; on success `onApply` receives Studio
 * blocks plus subject and preview text. On failure or after 45s the draft
 * keeps what it already has and `status` becomes "failed" (retryable).
 */
export function useThemeNewsletterGeneration(options: {
  tenantId: string | null;
  campaignId: string;
  designSystem: StudioDesignSystem;
  onApply: (content: ThemeGenerationContent) => void;
  invoke?: ThemeNewsletterInvoke;
  timeoutMs?: number;
}) {
  const { tenantId, campaignId, designSystem, onApply, invoke, timeoutMs } = options;
  const [status, setStatus] = React.useState<ThemeGenerationStatus>("idle");
  const lastRequestRef = React.useRef<Omit<ThemeNewsletterRequest, "tenantId" | "campaignId"> | null>(null);
  const runRef = React.useRef(0);
  const onApplyRef = React.useRef(onApply);
  onApplyRef.current = onApply;

  React.useEffect(() => () => {
    // Ignore a response that arrives after leaving the draft.
    runRef.current += 1;
  }, [campaignId]);

  const generate = React.useCallback(
    async (request: Omit<ThemeNewsletterRequest, "tenantId" | "campaignId">) => {
      if (!tenantId || !campaignId) {
        setStatus("failed");
        return false;
      }
      lastRequestRef.current = request;
      const run = ++runRef.current;
      setStatus("generating");
      try {
        const result = await requestThemeNewsletter(
          { ...request, tenantId, campaignId },
          { invoke, timeoutMs },
        );
        if (run !== runRef.current) return false;
        onApplyRef.current({
          blocks: hydrateThemeNewsletterBlocks(result, designSystem),
          subjectLine: result.subjectLine,
          previewText: result.previewText,
        });
        setStatus("idle");
        return true;
      } catch (error) {
        if (run !== runRef.current) return false;
        console.warn("Theme newsletter generation failed", error);
        setStatus("failed");
        return false;
      }
    },
    [campaignId, designSystem, invoke, tenantId, timeoutMs],
  );

  const retry = React.useCallback(() => {
    if (lastRequestRef.current) void generate(lastRequestRef.current);
  }, [generate]);

  const dismiss = React.useCallback(() => setStatus("idle"), []);

  return { status, generate, retry, dismiss };
}
