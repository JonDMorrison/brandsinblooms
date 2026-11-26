import * as React from "react";
import Box from "@mui/joy/Box";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useBloom } from "@/components/bloom/BloomContext";
import { BloomComposer } from "@/components/bloom/BloomComposer";
import type { BloomActionContext } from "@/components/bloom/utils/slashCommandRegistry";
import type { BloomJsonArray } from "@/hooks/bloom/types";

/**
 * /bloom's composer: the same BloomComposer the Ask Bloom drawer uses, laid
 * out for the wider canvas and driven by BloomContext. The draft stays in
 * BloomContext's `composerDraft` so /bloom's keyboard shortcuts and prompt
 * links keep reaching it.
 */
export function BloomPageComposer() {
  const navigate = useNavigate();
  const {
    activeConversationId,
    activeMode,
    archiveConversation,
    cancelStream,
    composerDraft,
    createConversation,
    isStreaming,
    messages,
    messagesLoading,
    modelPreference,
    openShortcutsPanel,
    registerComposerController,
    sendMessage,
    setActiveMode,
    setComposerDraft,
    setModelPreference,
  } = useBloom();
  const [isSending, setIsSending] = React.useState(false);
  const isWelcome =
    messages.length === 0 && !isStreaming && !isSending && !messagesLoading;

  const ensureConversationId = React.useCallback(
    () =>
      activeConversationId
        ? Promise.resolve(activeConversationId)
        : createConversation(),
    [activeConversationId, createConversation],
  );

  const slashActionContext = React.useMemo<BloomActionContext>(
    () => ({
      activeConversationId,
      archiveConversation,
      createConversation,
      navigate,
      openShortcutsPanel,
      sendMessage: (text: string) => sendMessage(text),
      setActiveMode,
    }),
    [
      activeConversationId,
      archiveConversation,
      createConversation,
      navigate,
      openShortcutsPanel,
      sendMessage,
      setActiveMode,
    ],
  );

  const handleSend = React.useCallback(
    async (message: string, attachments: BloomJsonArray) => {
      setIsSending(true);
      try {
        await sendMessage(message, attachments);
      } finally {
        setIsSending(false);
      }
    },
    [sendMessage],
  );

  const notify = React.useCallback((message: string) => {
    toast.error(message);
  }, []);

  return (
    // The wrapper floats over the conversation and stays click-through; only
    // the composer card takes pointer events.
    <Box
      sx={{
        flexShrink: 0,
        px: { xs: 1.25, sm: 2.5 },
        pt: { xs: 1, sm: 1.25 },
        pb: { xs: 1.25, sm: 3 },
        pointerEvents: "none",
      }}
    >
      <BloomComposer
        layout="page"
        value={composerDraft}
        onValueChange={setComposerDraft}
        conversationId={activeConversationId}
        ensureConversationId={ensureConversationId}
        isStreaming={isStreaming}
        isSending={isSending}
        isWelcome={isWelcome}
        onSend={handleSend}
        onStop={cancelStream}
        activeMode={activeMode}
        onModeChange={setActiveMode}
        modelPreference={modelPreference}
        onModelPreferenceChange={setModelPreference}
        slashActionContext={slashActionContext}
        onOpenShortcuts={openShortcutsPanel}
        fallbackWidth={832}
        registerController={registerComposerController}
        onNotify={notify}
      />
    </Box>
  );
}
