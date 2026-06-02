import * as React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { resolvePageContext } from "@/components/bloom/utils/resolvePageContext";
import {
  useBloomStreaming,
  type BloomStreamingDoneMetadata,
} from "@/hooks/bloom/useBloomStreaming";
import type {
  BloomJsonArray,
  BloomMode,
  BloomPageContext,
  BloomPageEntityType,
} from "@/hooks/bloom/types";

const COMPACT_CONTINUE_TOKEN_THRESHOLD = 500;

export const BLOOM_COMPACT_ACTIVATION_EVENT =
  "bloom:compact-activation-request";

type BloomCompactMode = Extract<BloomMode, "standard" | "reasoning">;

export interface BloomCompactEntityContext {
  entityType: BloomPageEntityType;
  entityId: string;
}

export interface BloomCompactActivationRequest {
  id: number;
  prompt: string;
  entityContext?: BloomCompactEntityContext;
  autoSend: boolean;
}

let nextCompactActivationRequestId = 0;

export function activateCompact(
  prompt = "",
  entityContext?: BloomCompactEntityContext,
  options: { autoSend?: boolean } = {},
): BloomCompactActivationRequest {
  const request: BloomCompactActivationRequest = {
    id: ++nextCompactActivationRequestId,
    prompt,
    entityContext,
    autoSend: options.autoSend ?? false,
  };

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent<BloomCompactActivationRequest>(
        BLOOM_COMPACT_ACTIVATION_EVENT,
        { detail: request },
      ),
    );
  }

  return request;
}

const getTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};

const applyEntityContextOverride = (
  pageContext: BloomPageContext,
  entityContext?: BloomCompactEntityContext,
): BloomPageContext => {
  if (!entityContext) {
    return pageContext;
  }

  return {
    ...pageContext,
    entityType: entityContext.entityType,
    entityId: entityContext.entityId,
  };
};

export function useBloomCompactMode() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isActive, setIsActive] = React.useState(false);
  const [draftPrompt, setDraftPrompt] = React.useState("");
  const [submittedPrompt, setSubmittedPrompt] = React.useState<string | null>(
    null,
  );
  const [activeMode, setActiveMode] =
    React.useState<BloomCompactMode>("standard");
  const [capturedPageContext, setCapturedPageContext] =
    React.useState<BloomPageContext | null>(null);
  const [resolvedConversationId, setResolvedConversationId] = React.useState<
    string | null
  >(null);
  const [shouldSuggestContinue, setShouldSuggestContinue] =
    React.useState(false);
  const activationPathnameRef = React.useRef<string | null>(null);
  const pendingAutoRedirectRef = React.useRef(false);
  const {
    activeToolCall,
    cancelStream,
    connectionState,
    isStreaming,
    isResearchComplete,
    isResearchSynthesizing,
    lastDoneMetadata,
    pendingTaskPlan,
    researchConversationId,
    researchPlan,
    researchSteps,
    resetStream,
    startStream,
    streamError,
    streamingBlocks,
    streamingContent,
    streamingThinking,
  } = useBloomStreaming({
    onConversationResolved: (conversationId) => {
      setResolvedConversationId(conversationId);
    },
  });

  const continueConversationId =
    resolvedConversationId ?? lastDoneMetadata?.conversationId ?? null;

  const activateCompactState = React.useCallback(
    (prefilledPrompt = "", entityContext?: BloomCompactEntityContext) => {
      if (isStreaming) {
        cancelStream();
      }

      activationPathnameRef.current = location.pathname;
      pendingAutoRedirectRef.current = false;
      setCapturedPageContext(
        applyEntityContextOverride(
          resolvePageContext(location.pathname),
          entityContext,
        ),
      );
      setResolvedConversationId(null);
      setShouldSuggestContinue(false);
      setSubmittedPrompt(null);
      setDraftPrompt(prefilledPrompt);
      setIsActive(true);
      resetStream();
    },
    [cancelStream, isStreaming, location.pathname, resetStream],
  );

  const continueInBloom = React.useCallback(
    (conversationId?: string | null) => {
      const targetConversationId = conversationId ?? continueConversationId;

      if (!targetConversationId) {
        return false;
      }

      navigate(`/bloom?continue=${encodeURIComponent(targetConversationId)}`);
      return true;
    },
    [continueConversationId, navigate],
  );

  const dismissCompact = React.useCallback(() => {
    if (isStreaming) {
      cancelStream();
    }

    pendingAutoRedirectRef.current = false;
    activationPathnameRef.current = null;
    setIsActive(false);
    setDraftPrompt("");
    setSubmittedPrompt(null);
    setCapturedPageContext(null);
    setResolvedConversationId(null);
    setShouldSuggestContinue(false);
    resetStream();
  }, [cancelStream, isStreaming, resetStream]);

  const sendCompactMessage = React.useCallback(
    async (prompt?: string, attachments: BloomJsonArray = []) => {
      const nextPrompt = (prompt ?? draftPrompt).trim();

      if (!nextPrompt || isStreaming) {
        return false;
      }

      const basePathname = activationPathnameRef.current ?? location.pathname;
      const pageContext =
        capturedPageContext ?? resolvePageContext(basePathname);

      pendingAutoRedirectRef.current = false;
      setResolvedConversationId(null);
      setShouldSuggestContinue(false);
      setSubmittedPrompt(nextPrompt);
      setDraftPrompt("");
      setIsActive(true);

      startStream(
        null,
        nextPrompt,
        activeMode,
        "auto",
        pageContext,
        getTimezone(),
        attachments,
      );

      return true;
    },
    [
      activeMode,
      capturedPageContext,
      draftPrompt,
      isStreaming,
      location.pathname,
      startStream,
    ],
  );

  React.useEffect(() => {
    if (!pendingTaskPlan) {
      return;
    }

    pendingAutoRedirectRef.current = true;
  }, [pendingTaskPlan]);

  React.useEffect(() => {
    const outputTokens = lastDoneMetadata?.tokensOutput ?? 0;

    setShouldSuggestContinue(
      Boolean(continueConversationId) &&
        outputTokens > COMPACT_CONTINUE_TOKEN_THRESHOLD,
    );
  }, [continueConversationId, lastDoneMetadata]);

  React.useEffect(() => {
    if (!pendingAutoRedirectRef.current || !continueConversationId) {
      return;
    }

    pendingAutoRedirectRef.current = false;
    void continueInBloom(continueConversationId);
  }, [continueConversationId, continueInBloom]);

  return {
    activateCompact: activateCompactState,
    activeMode,
    activeToolCall,
    cancelStream,
    capturedPageContext,
    connectionState,
    continueConversationId,
    continueInBloom,
    dismissCompact,
    draftPrompt,
    isActive,
    isResearchComplete,
    isResearchSynthesizing,
    isStreaming,
    lastDoneMetadata: lastDoneMetadata as BloomStreamingDoneMetadata | null,
    pendingTaskPlan,
    researchConversationId,
    researchPlan,
    researchSteps,
    resolvedConversationId,
    sendCompactMessage,
    setActiveMode,
    setDraftPrompt,
    shouldSuggestContinue,
    streamError,
    streamingBlocks,
    streamingContent,
    streamingThinking,
    submittedPrompt,
  };
}
