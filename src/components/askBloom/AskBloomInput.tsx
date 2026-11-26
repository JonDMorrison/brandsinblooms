import * as React from "react";
import { useNavigate } from "react-router-dom";
import { BloomComposer } from "@/components/bloom/BloomComposer";
import type { BloomActionContext } from "@/components/bloom/utils/slashCommandRegistry";
import type {
  BloomJsonArray,
  BloomMode,
  BloomModelPreference,
} from "@/hooks/bloom/types";
import { useAskBloom } from "@/providers/AskBloomProvider";

/**
 * The Ask Bloom drawer's composer: the shared BloomComposer driven by the
 * drawer's provider. The draft, mode and model live here, per drawer.
 */
function AskBloomInput() {
  const askBloom = useAskBloom();
  const { state } = askBloom;
  const navigate = useNavigate();
  const [draft, setDraft] = React.useState("");
  const [activeMode, setActiveMode] = React.useState<BloomMode>("standard");
  const [modelPreference, setModelPreference] =
    React.useState<BloomModelPreference>("auto");
  const isWelcome =
    state.messages.length === 0 &&
    !state.isSendingMessage &&
    !state.isStreaming &&
    !state.isLoadingConversation;

  const { ensureConversationId, newConversation, sendMessage } = askBloom;

  const slashActionContext = React.useMemo<BloomActionContext>(
    () => ({
      activeConversationId: state.conversationId,
      // The drawer has no archive action; /clear starts a fresh conversation.
      archiveConversation: () => {
        newConversation();
        return Promise.resolve();
      },
      createConversation: () => {
        newConversation();
        return Promise.resolve(state.conversationId ?? "");
      },
      navigate: (path) => navigate(path),
      // The composer replaces this with its own "shortcuts are in full
      // Bloom" notice, since the drawer has no shortcuts panel.
      openShortcutsPanel: () => undefined,
      sendMessage: (text) => {
        sendMessage(text, { mode: activeMode, modelPreference });
        return Promise.resolve();
      },
      setActiveMode,
    }),
    [
      activeMode,
      modelPreference,
      navigate,
      newConversation,
      sendMessage,
      state.conversationId,
    ],
  );

  const handleSend = React.useCallback(
    (message: string, attachments: BloomJsonArray) => {
      sendMessage(message, { mode: activeMode, modelPreference, attachments });
    },
    [activeMode, modelPreference, sendMessage],
  );

  const handleTogglePin = React.useCallback(() => {
    if (state.isPinned) {
      askBloom.unpinConversation();
      return;
    }

    askBloom.pinConversation();
  }, [askBloom, state.isPinned]);

  return (
    <BloomComposer
      layout="panel"
      value={draft}
      onValueChange={setDraft}
      conversationId={state.conversationId}
      ensureConversationId={ensureConversationId}
      isStreaming={state.isStreaming}
      isSending={state.isTransitioning || state.isSendingMessage}
      isWelcome={isWelcome}
      onSend={handleSend}
      onStop={askBloom.cancelStream}
      activeMode={activeMode}
      onModeChange={setActiveMode}
      modelPreference={modelPreference}
      onModelPreferenceChange={setModelPreference}
      slashActionContext={slashActionContext}
      fallbackWidth={state.panelWidth}
      conversationOptions={{
        isPinned: state.isPinned,
        resourceLabel: state.resourceFocus?.resourceLabel ?? null,
        resourceType: state.resourceFocus?.resourceType ?? null,
        onClearFocus: askBloom.clearResourceFocus,
        onNewConversation: askBloom.newConversation,
        onTogglePin: handleTogglePin,
      }}
    />
  );
}

export default AskBloomInput;
