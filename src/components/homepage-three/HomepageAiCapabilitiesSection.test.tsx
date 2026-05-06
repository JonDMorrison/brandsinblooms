import { act, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HomepageAiCapabilitiesSection } from "./HomepageAiCapabilitiesSection";
import {
  AI_CAPABILITIES_HEADER,
  AI_CAPABILITY_CARDS_LABEL,
  AI_CAPABILITY_CARDS,
  AI_CHAT_DEMO,
} from "./content/aiCapabilitiesContent";

describe("HomepageAiCapabilitiesSection", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the centered dark AI header and chat shell", () => {
    render(<HomepageAiCapabilitiesSection isActive motionEnabled={false} />);

    expect(screen.getByLabelText(AI_CAPABILITIES_HEADER.chip)).toHaveClass(
      "hp-ai-showcase__chip",
    );
    expect(
      screen.getByRole("heading", { name: AI_CAPABILITIES_HEADER.headline }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(AI_CAPABILITIES_HEADER.subtext),
    ).toBeInTheDocument();
    expect(screen.getByText(AI_CHAT_DEMO.assistantLabel)).toBeInTheDocument();
    expect(screen.getByText(AI_CHAT_DEMO.statusLabel)).toBeInTheDocument();
  });

  it("types the first user prompt character-by-character and then reveals AI lines", () => {
    vi.useFakeTimers();
    render(<HomepageAiCapabilitiesSection isActive motionEnabled />);

    const firstPrompt = AI_CHAT_DEMO.turns[0].text ?? "";

    expect(screen.getByTestId("ai-chat-demo")).toHaveAttribute(
      "data-static",
      "false",
    );
    expect(screen.getByTestId("ai-chat-demo")).toHaveAttribute(
      "data-typing-speed-ms",
      String(AI_CHAT_DEMO.typingSpeedMs),
    );

    act(() => {
      vi.advanceTimersByTime(
        AI_CHAT_DEMO.initialDelayMs + AI_CHAT_DEMO.typingSpeedMs * 4,
      );
    });

    expect(screen.getByTestId("ai-chat-current-message")).toHaveTextContent(
      firstPrompt.slice(0, 4),
    );

    act(() => {
      vi.advanceTimersByTime(
        AI_CHAT_DEMO.typingSpeedMs * (firstPrompt.length - 4) +
          AI_CHAT_DEMO.betweenTurnsMs +
          AI_CHAT_DEMO.aiTypingDelayMs,
      );
    });

    act(() => {
      vi.advanceTimersByTime(AI_CHAT_DEMO.aiTypingDelayMs);
    });

    expect(
      screen.getByText("Found 12 matching customers. Top 5 by value:"),
    ).toBeInTheDocument();
  });

  it("shows the full static transcript on fallback tier without a typing indicator", () => {
    render(<HomepageAiCapabilitiesSection isActive motionEnabled={false} />);

    expect(screen.getByTestId("ai-chat-demo")).toHaveAttribute(
      "data-static",
      "true",
    );
    expect(screen.queryByLabelText(AI_CHAT_DEMO.typingLabel)).toBeNull();

    for (const turn of AI_CHAT_DEMO.turns) {
      if (turn.text) {
        expect(screen.getByText(turn.text)).toBeInTheDocument();
      }

      for (const line of turn.lines ?? []) {
        if (line.kind === "customer") {
          const [name, value] = line.text.split(" — ");

          expect(screen.getByText(name)).toBeInTheDocument();
          expect(screen.getByText(value)).toBeInTheDocument();
          continue;
        }

        expect(screen.getByText(line.text)).toBeInTheDocument();
      }
    }
  });

  it("renders three dark glass capability cards with stagger metadata", () => {
    render(<HomepageAiCapabilitiesSection isActive motionEnabled={false} />);

    const grid = screen.getByLabelText(AI_CAPABILITY_CARDS_LABEL);
    const cards = within(grid).getAllByRole("article");

    expect(cards).toHaveLength(AI_CAPABILITY_CARDS.length);
    for (const [index, capability] of AI_CAPABILITY_CARDS.entries()) {
      expect(
        screen.getByRole("heading", { name: capability.title }),
      ).toBeInTheDocument();
      expect(screen.getByText(capability.description)).toBeInTheDocument();
      expect(cards[index]).toHaveClass("hp-ai-card");
      expect(cards[index]).toHaveStyle(
        `--hp-ai-card-delay: ${capability.delayMs}ms`,
      );
    }
  });
});
