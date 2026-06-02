import * as React from "react";
import { toast } from "sonner";
import { copyBloomMessageText } from "@/components/bloom/BloomMessageActions";
import { useBloom } from "@/components/bloom/BloomContext";
import { useBloomMessageMutations } from "@/hooks/bloom/useBloomMessageMutations";
import type { BloomMessage, BloomMode } from "@/hooks/bloom/types";

const modeShortcuts: Record<string, { label: string; mode: BloomMode }> = {
  "1": { label: "Standard", mode: "standard" },
  "2": { label: "Reasoning", mode: "reasoning" },
  "3": { label: "Deep Research", mode: "research" },
  "4": { label: "Image", mode: "image" },
};

const isTextEntryTarget = (target: EventTarget | null) => {
  if (!(target instanceof Element)) {
    return false;
  }

  if (target instanceof HTMLElement && target.isContentEditable) {
    return true;
  }

  return Boolean(
    target.closest(
      "input, textarea, select, [contenteditable='true'], [role='textbox']",
    ),
  );
};

const isCompletedAssistantMessage = (message: BloomMessage) =>
  message.role === "assistant" && !message.id.startsWith("streaming-");

const isCompletedUserMessage = (message: BloomMessage) =>
  message.role === "user" && message.text.trim().length > 0;

interface UseBloomShortcutsOptions {
  containerRef: React.RefObject<HTMLElement | null>;
  isMobileSidebarOpen: boolean;
  onCloseMobileSidebar: () => void;
}

export function useBloomShortcuts({
  containerRef,
  isMobileSidebarOpen,
  onCloseMobileSidebar,
}: UseBloomShortcutsOptions) {
  const {
    getComposerValue,
    isComposerFocused,
    isSlashMenuOpen,
    isStreaming,
    messages,
    setActiveMode,
    setComposerValue,
    setSlashMenuOpen,
    startEditingMessage,
  } = useBloom();
  const { regenerateResponse } = useBloomMessageMutations();

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const modifierPressed = (event.metaKey || event.ctrlKey) && !event.altKey;
      const key = event.key;
      const normalizedKey = key.toLowerCase();
      const composerFocused = isComposerFocused();
      const targetIsTextEntry = isTextEntryTarget(event.target);

      if (modifierPressed && !event.shiftKey) {
        const shortcut = modeShortcuts[key];

        if (shortcut && (!targetIsTextEntry || composerFocused)) {
          event.preventDefault();
          setActiveMode(shortcut.mode);
          toast(`Switched to ${shortcut.label} mode`, {
            duration: 2000,
            id: `bloom-mode-shortcut-${shortcut.mode}`,
          });
          return;
        }
      }

      if (modifierPressed && event.shiftKey && normalizedKey === "r") {
        event.preventDefault();
        if (isStreaming) {
          return;
        }

        const lastAssistantMessage = [...messages]
          .reverse()
          .find(isCompletedAssistantMessage);
        if (!lastAssistantMessage) {
          return;
        }

        void regenerateResponse(lastAssistantMessage.id).catch(() => undefined);
        return;
      }

      if (modifierPressed && event.shiftKey && normalizedKey === "e") {
        event.preventDefault();
        if (isStreaming) {
          return;
        }

        const lastUserMessage = [...messages]
          .reverse()
          .find(isCompletedUserMessage);
        if (!lastUserMessage) {
          return;
        }

        startEditingMessage(lastUserMessage.id);
        return;
      }

      if (modifierPressed && event.shiftKey && normalizedKey === "c") {
        event.preventDefault();
        if (isStreaming) {
          return;
        }

        const lastAssistantMessage = [...messages]
          .reverse()
          .find(isCompletedAssistantMessage);
        if (!lastAssistantMessage) {
          return;
        }

        void copyBloomMessageText(lastAssistantMessage.text);
        return;
      }

      if (
        key === "ArrowUp" &&
        !modifierPressed &&
        !event.shiftKey &&
        isComposerFocused() &&
        getComposerValue().trim().length === 0
      ) {
        const lastUserMessage = [...messages]
          .reverse()
          .find(isCompletedUserMessage);
        if (!lastUserMessage) {
          return;
        }

        event.preventDefault();
        setComposerValue(lastUserMessage.text, {
          focus: true,
          selection: "end",
        });
        return;
      }

      if (
        key === "/" &&
        !modifierPressed &&
        !event.shiftKey &&
        isComposerFocused() &&
        getComposerValue().trim().length === 0 &&
        !isSlashMenuOpen()
      ) {
        setSlashMenuOpen(true);
        return;
      }

      if (key === "Escape") {
        if (isSlashMenuOpen()) {
          event.preventDefault();
          setSlashMenuOpen(false);
          return;
        }

        if (isMobileSidebarOpen) {
          event.preventDefault();
          onCloseMobileSidebar();
          return;
        }
      }
    };

    container.addEventListener("keydown", handleKeyDown);

    return () => {
      container.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    containerRef,
    getComposerValue,
    isComposerFocused,
    isMobileSidebarOpen,
    isSlashMenuOpen,
    isStreaming,
    messages,
    onCloseMobileSidebar,
    regenerateResponse,
    setActiveMode,
    setComposerValue,
    setSlashMenuOpen,
    startEditingMessage,
  ]);
}
