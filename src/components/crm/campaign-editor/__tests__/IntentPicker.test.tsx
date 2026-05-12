import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { IntentPicker } from "@/components/crm/campaign-editor/IntentPicker";
import type { SavedTemplate } from "@/hooks/useSavedTemplates";

function noopHandlers() {
  return {
    onSelectIntent: vi.fn(),
    onApplySavedTemplate: vi.fn(),
    onRenameSavedTemplate: vi.fn(),
    onArchiveSavedTemplate: vi.fn(),
    onOpenManage: vi.fn(),
  };
}

function makeSavedTemplate(overrides: Partial<SavedTemplate> = {}): SavedTemplate {
  return {
    id: "tpl-1",
    user_id: "user-1",
    tenant_id: "tenant-1",
    name: "Spring promo",
    description: "Saved layout",
    layout_json: [
      { id: "b1", type: "newsletter-header", label: "Header", order: 0, visible: true } as never,
      { id: "b2", type: "plain-text", label: "Body", order: 1, visible: true } as never,
    ],
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    ...overrides,
  };
}

describe("IntentPicker", () => {
  it("renders all six intent cards", () => {
    const handlers = noopHandlers();
    render(<IntentPicker savedTemplates={[]} {...handlers} />);

    expect(screen.getByTestId("intent-card-newsletter")).toBeInTheDocument();
    expect(screen.getByTestId("intent-card-sale")).toBeInTheDocument();
    expect(screen.getByTestId("intent-card-new-arrivals")).toBeInTheDocument();
    expect(screen.getByTestId("intent-card-event")).toBeInTheDocument();
    expect(screen.getByTestId("intent-card-thank-you")).toBeInTheDocument();
    expect(screen.getByTestId("intent-card-blank")).toBeInTheDocument();
  });

  it("hides My templates section when there are no saved templates", () => {
    const handlers = noopHandlers();
    render(<IntentPicker savedTemplates={[]} {...handlers} />);
    expect(
      screen.queryByTestId("intent-picker-my-templates"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("My templates")).not.toBeInTheDocument();
  });

  it("renders My templates section when at least one is saved", () => {
    const handlers = noopHandlers();
    const template = makeSavedTemplate();
    render(
      <IntentPicker savedTemplates={[template]} {...handlers} />,
    );
    expect(
      screen.getByTestId("intent-picker-my-templates"),
    ).toBeInTheDocument();
    expect(screen.getByText("My templates")).toBeInTheDocument();
    expect(
      screen.getByTestId(`saved-template-card-${template.id}`),
    ).toBeInTheDocument();
    expect(screen.getByText("2 blocks")).toBeInTheDocument();
  });

  it("clicking a saved-template card fires onApplySavedTemplate", async () => {
    const user = userEvent.setup();
    const handlers = noopHandlers();
    const template = makeSavedTemplate();
    render(
      <IntentPicker savedTemplates={[template]} {...handlers} />,
    );
    await user.click(
      screen.getByTestId(`saved-template-card-${template.id}`),
    );
    expect(handlers.onApplySavedTemplate).toHaveBeenCalledWith(template);
  });

  it("clicking an intent card fires onSelectIntent with the key", async () => {
    const user = userEvent.setup();
    const handlers = noopHandlers();
    render(<IntentPicker savedTemplates={[]} {...handlers} />);
    await user.click(screen.getByTestId("intent-card-sale"));
    expect(handlers.onSelectIntent).toHaveBeenCalledWith("sale");
  });

  it("disables intents listed in unavailableIntents and shows the coming-soon tooltip", () => {
    const handlers = noopHandlers();
    render(
      <IntentPicker
        savedTemplates={[]}
        unavailableIntents={new Set(["thank-you"])}
        {...handlers}
      />,
    );
    const card = screen.getByTestId("intent-card-thank-you");
    expect(card).toHaveAttribute("aria-disabled", "true");
    expect(card).toHaveAttribute("title", "Coming soon");
  });

  it("Manage link triggers onOpenManage", async () => {
    const user = userEvent.setup();
    const handlers = noopHandlers();
    const template = makeSavedTemplate();
    render(
      <IntentPicker savedTemplates={[template]} {...handlers} />,
    );
    await user.click(screen.getByTestId("intent-picker-manage-link"));
    expect(handlers.onOpenManage).toHaveBeenCalledOnce();
  });

  it("reflects the selected intent via aria-pressed", () => {
    const handlers = noopHandlers();
    render(
      <IntentPicker
        savedTemplates={[]}
        selectedIntent="newsletter"
        {...handlers}
      />,
    );
    expect(screen.getByTestId("intent-card-newsletter")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByTestId("intent-card-sale")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});
