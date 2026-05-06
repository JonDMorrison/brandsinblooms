import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import {
  AI_CAPABILITIES_HEADER,
  AI_CAPABILITY_CARDS_LABEL,
  AI_CAPABILITY_CARDS,
  AI_CHAT_DEMO,
  type AiChatLineConfig,
  type AiChatSpeaker,
  type AiChatTurnConfig,
} from "./content/aiCapabilitiesContent";
import "./homepageAi.css";

interface HomepageAiCapabilitiesSectionProps {
  isActive: boolean;
  motionEnabled: boolean;
}

interface RenderedChatMessage {
  id: string;
  speaker: AiChatSpeaker;
  lines: AiChatLineConfig[];
  isTyping?: boolean;
}

interface ChatDemoState {
  messages: RenderedChatMessage[];
  typingIndicator: boolean;
  resetting: boolean;
  staticMode: boolean;
}

const emptyChatState: ChatDemoState = {
  messages: [],
  typingIndicator: false,
  resetting: false,
  staticMode: false,
};

const AI_CAPABILITIES_KEYFRAMES = `
@keyframes pulse-dot {
  0%, 100% { box-shadow: 0 0 0 0 rgba(104, 190, 185, 0.40); }
  50% { box-shadow: 0 0 0 6px rgba(104, 190, 185, 0); }
}

@keyframes typing-bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}

@keyframes online-fade-pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}
`;

const getFinalChatMessages = (): RenderedChatMessage[] =>
  AI_CHAT_DEMO.turns.map((turn) => ({
    id: turn.id,
    speaker: turn.speaker,
    lines: turn.lines ?? [{ text: turn.text ?? "" }],
  }));

const upsertChatMessage = (
  messages: RenderedChatMessage[],
  nextMessage: RenderedChatMessage,
) => {
  const existingIndex = messages.findIndex(
    (message) => message.id === nextMessage.id,
  );

  if (existingIndex === -1) {
    return [...messages, nextMessage];
  }

  return messages.map((message, index) =>
    index === existingIndex ? nextMessage : message,
  );
};

const useScriptedAiChatDemo = ({
  isActive,
  motionEnabled,
}: HomepageAiCapabilitiesSectionProps) => {
  const [state, setState] = useState<ChatDemoState>(() => ({
    ...emptyChatState,
    messages: getFinalChatMessages(),
    staticMode: true,
  }));

  useEffect(() => {
    if (!isActive || !motionEnabled) {
      setState({
        messages: getFinalChatMessages(),
        typingIndicator: false,
        resetting: false,
        staticMode: true,
      });
      return undefined;
    }

    let cancelled = false;
    const timers: Array<ReturnType<typeof window.setTimeout>> = [];

    const schedule = (callback: () => void, delayMs: number) => {
      const timer = window.setTimeout(() => {
        if (!cancelled) {
          callback();
        }
      }, delayMs);

      timers.push(timer);
      return timer;
    };

    const revealTurn = (turnIndex: number): void => {
      const turn = AI_CHAT_DEMO.turns[turnIndex];

      if (!turn) {
        schedule(() => {
          setState((current) => ({ ...current, resetting: true }));
          schedule(runLoop, AI_CHAT_DEMO.resetFadeMs);
        }, AI_CHAT_DEMO.finalPauseMs);
        return;
      }

      if (turn.speaker === "user") {
        revealTypedUserTurn(turn, () => revealTurn(turnIndex + 1));
        return;
      }

      revealAiTurn(turn, () => revealTurn(turnIndex + 1));
    };

    const revealTypedUserTurn = (
      turn: AiChatTurnConfig,
      onComplete: () => void,
    ) => {
      const fullText = turn.text ?? "";
      let characterIndex = 0;

      setState((current) => ({
        ...current,
        messages: upsertChatMessage(current.messages, {
          id: turn.id,
          speaker: turn.speaker,
          lines: [{ text: "" }],
          isTyping: true,
        }),
      }));

      const typeNextCharacter = () => {
        characterIndex += 1;
        const nextText = fullText.slice(0, characterIndex);

        setState((current) => ({
          ...current,
          messages: upsertChatMessage(current.messages, {
            id: turn.id,
            speaker: turn.speaker,
            lines: [{ text: nextText }],
            isTyping: characterIndex < fullText.length,
          }),
        }));

        if (characterIndex < fullText.length) {
          schedule(typeNextCharacter, AI_CHAT_DEMO.typingSpeedMs);
          return;
        }

        schedule(
          onComplete,
          turn.afterCompleteDelayMs ?? AI_CHAT_DEMO.betweenTurnsMs,
        );
      };

      schedule(typeNextCharacter, AI_CHAT_DEMO.typingSpeedMs);
    };

    const revealAiTurn = (turn: AiChatTurnConfig, onComplete: () => void) => {
      const lines = turn.lines ?? [];
      let lineIndex = 0;

      setState((current) => ({ ...current, typingIndicator: true }));

      const revealNextLine = () => {
        lineIndex += 1;

        setState((current) => ({
          ...current,
          typingIndicator: false,
          messages: upsertChatMessage(current.messages, {
            id: turn.id,
            speaker: turn.speaker,
            lines: lines.slice(0, lineIndex),
          }),
        }));

        if (lineIndex < lines.length) {
          schedule(revealNextLine, AI_CHAT_DEMO.aiLineRevealMs);
          return;
        }

        schedule(
          onComplete,
          turn.afterCompleteDelayMs ?? AI_CHAT_DEMO.betweenTurnsMs,
        );
      };

      schedule(
        revealNextLine,
        turn.typingDelayMs ?? AI_CHAT_DEMO.aiTypingDelayMs,
      );
    };

    const runLoop = () => {
      setState({ ...emptyChatState, staticMode: false });
      schedule(() => revealTurn(0), AI_CHAT_DEMO.initialDelayMs);
    };

    runLoop();

    return () => {
      cancelled = true;
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
    };
  }, [isActive, motionEnabled]);

  return state;
};

const AiTypingIndicator = () => (
  <div
    className="hp-ai-chat__bubble hp-ai-chat__bubble--ai hp-ai-chat__typing"
    aria-label={AI_CHAT_DEMO.typingLabel}
  >
    <span />
    <span />
    <span />
  </div>
);

const renderChatLine = (line: AiChatLineConfig) => {
  if (line.kind === "customer") {
    const [name, value] = line.text.split(" — ");

    return (
      <>
        <span className="hp-ai-chat__customer-name">{name}</span>
        {value ? (
          <>
            <span className="hp-ai-chat__customer-separator">—</span>
            <strong className="hp-ai-chat__customer-value">{value}</strong>
          </>
        ) : null}
      </>
    );
  }

  if (line.kind === "success") {
    return <span className="hp-ai-chat__success-line">{line.text}</span>;
  }

  return line.text;
};

const AiChatMessage = ({ message }: { message: RenderedChatMessage }) => (
  <div
    className={`hp-ai-chat__message hp-ai-chat__message--${message.speaker}`}
    data-speaker={message.speaker}
  >
    <div
      className={`hp-ai-chat__bubble hp-ai-chat__bubble--${message.speaker}`}
    >
      {message.lines.map((line, index) => (
        <p
          key={`${message.id}-${index}`}
          className="hp-ai-chat__line"
          data-kind={line.kind ?? "text"}
          data-testid={
            message.isTyping && index === 0
              ? "ai-chat-current-message"
              : undefined
          }
        >
          {renderChatLine(line)}
          {message.isTyping && index === 0 ? (
            <span className="hp-ai-chat__cursor" aria-hidden="true" />
          ) : null}
        </p>
      ))}
    </div>
  </div>
);

export const HomepageAiCapabilitiesSection = ({
  isActive,
  motionEnabled,
}: HomepageAiCapabilitiesSectionProps) => {
  const chatState = useScriptedAiChatDemo({ isActive, motionEnabled });

  return (
    <div
      className="hp-ai-showcase"
      data-active={isActive}
      data-motion-enabled={motionEnabled}
      data-homepage-gesture-lock="true"
      data-testid="homepage-ai-capabilities"
    >
      <style>{AI_CAPABILITIES_KEYFRAMES}</style>
      <div className="hp-ai-showcase__inner">
        <header className="hp-ai-showcase__header">
          <div
            className="hp-ai-showcase__chip"
            aria-label={AI_CAPABILITIES_HEADER.chip}
          >
            <span className="hp-ai-showcase__chip-dot" aria-hidden="true" />
            <span>{AI_CAPABILITIES_HEADER.chip}</span>
          </div>
          <h2 className="hp-ai-showcase__headline">
            {AI_CAPABILITIES_HEADER.headline}
          </h2>
          <p className="hp-ai-showcase__subtext">
            {AI_CAPABILITIES_HEADER.subtext}
          </p>
        </header>

        <div
          className="hp-ai-chat"
          data-resetting={chatState.resetting}
          data-static={chatState.staticMode}
          data-testid="ai-chat-demo"
          data-typing-speed-ms={AI_CHAT_DEMO.typingSpeedMs}
          aria-label={AI_CHAT_DEMO.chatDemoLabel}
        >
          <div className="hp-ai-chat__header">
            <div className="hp-ai-chat__assistant">
              <span className="hp-ai-chat__status" aria-hidden="true" />
              <span className="hp-ai-chat__title">
                {AI_CHAT_DEMO.assistantLabel}
              </span>
            </div>
            <span className="hp-ai-chat__online">
              {AI_CHAT_DEMO.statusLabel}
            </span>
          </div>
          <div className="hp-ai-chat__body" aria-live="off">
            {chatState.messages.map((message) => (
              <AiChatMessage key={message.id} message={message} />
            ))}
            {chatState.typingIndicator ? <AiTypingIndicator /> : null}
          </div>
        </div>

        <div className="hp-ai-card-grid" aria-label={AI_CAPABILITY_CARDS_LABEL}>
          {AI_CAPABILITY_CARDS.map((capability) => {
            const Icon = capability.icon;

            return (
              <article
                key={capability.title}
                className="hp-ai-card"
                style={
                  {
                    "--hp-ai-card-delay": `${capability.delayMs}ms`,
                  } as CSSProperties
                }
              >
                <span className="hp-ai-card__icon" aria-hidden="true">
                  <Icon />
                </span>
                <div className="hp-ai-card__body">
                  <h3 className="hp-ai-card__title">{capability.title}</h3>
                  <p className="hp-ai-card__description">
                    {capability.description}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default HomepageAiCapabilitiesSection;
