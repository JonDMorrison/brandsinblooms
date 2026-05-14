import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/useNewsletterIdeas", () => ({
  useNewsletterIdeas: () => ({
    ideas: [],
    templates: [],
    loading: false,
    error: null,
    generateAIIdeas: vi.fn().mockResolvedValue([]),
    refetch: vi.fn(),
    cleanupAndRefresh: vi.fn(),
  }),
}));

vi.mock("@/components/newsletter/IdeaGrid", () => ({
  IdeaGrid: ({
    onSelectIdea,
  }: {
    onSelectIdea: (idea: { id: string }) => void;
  }) => (
    <button
      type="button"
      data-testid="mock-select-idea"
      onClick={() =>
        onSelectIdea({
          id: "idea-1",
          title: "Test idea",
          summary: "",
          category: "general",
        } as never)
      }
    >
      Select idea
    </button>
  ),
}));

vi.mock("@/components/NewsletterLayoutPicker", () => ({
  NewsletterLayoutPicker: () => (
    <div data-testid="mock-layout-picker">Layout picker</div>
  ),
}));

import { NewsletterPicker } from "@/components/newsletter/NewsletterPicker";

const renderPicker = () =>
  render(
    <MemoryRouter>
      <NewsletterPicker isOpen onClose={vi.fn()} />
    </MemoryRouter>,
  );

describe("NewsletterPicker step navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts on the ideas step with the layout step disabled", () => {
    renderPicker();

    const layoutBtn = screen.getByTestId("newsletter-step-layout");
    expect(layoutBtn).toBeDisabled();
    expect(layoutBtn).toHaveAttribute("aria-disabled", "true");

    const ideasBtn = screen.getByTestId("newsletter-step-ideas");
    expect(ideasBtn).toHaveAttribute("aria-current", "step");
  });

  it("enables the layout step after an idea is selected and lets the user navigate back and forward via the breadcrumb", () => {
    renderPicker();

    fireEvent.click(screen.getByTestId("mock-select-idea"));

    const layoutBtn = screen.getByTestId("newsletter-step-layout");
    expect(layoutBtn).not.toBeDisabled();
    expect(layoutBtn).toHaveAttribute("aria-current", "step");

    fireEvent.click(screen.getByTestId("newsletter-step-ideas"));
    expect(screen.getByTestId("newsletter-step-ideas")).toHaveAttribute(
      "aria-current",
      "step",
    );

    const layoutBtnAfterBack = screen.getByTestId("newsletter-step-layout");
    expect(layoutBtnAfterBack).not.toBeDisabled();
    fireEvent.click(layoutBtnAfterBack);
    expect(screen.getByTestId("newsletter-step-layout")).toHaveAttribute(
      "aria-current",
      "step",
    );
  });
});
