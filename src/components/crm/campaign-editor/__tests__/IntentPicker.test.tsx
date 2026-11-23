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

function makeSavedTemplate(
  overrides: Partial<SavedTemplate> = {},
): SavedTemplate {
  return {
    id: "tpl-1",
    user_id: "user-1",
    tenant_id: "tenant-1",
    name: "Spring promo",
    description: "Saved layout",
    layout_json: [
      {
        id: "b1",
        type: "newsletter-header",
        label: "Header",
        order: 0,
        visible: true,
      } as never,
      {
        id: "b2",
        type: "plain-text",
        label: "Body",
        order: 1,
        visible: true,
      } as never,
    ],
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    ...overrides,
  };
}

describe("IntentPicker", () => {
  it("shows every available starting layout in one unified gallery", async () => {
    const user = userEvent.setup();
    const onApplyBuiltInTemplate = vi.fn();
    const handlers = noopHandlers();
    render(
      <IntentPicker savedTemplates={[]} {...handlers} onApplyBuiltInTemplate={onApplyBuiltInTemplate} />,
    );
    const gallery = screen.getByTestId("campaign-design-gallery");
    expect(screen.getByText("Choose a design")).toBeVisible();
    // Blank canvas is a primary start card above the gallery, beside
    // "This week's theme", so the gallery holds the other six layouts.
    expect(gallery.querySelectorAll('[data-testid^="intent-card-"]')).toHaveLength(6);
    expect(
      screen.getByTestId("intent-picker-start").querySelector('[data-testid="intent-card-blank"]'),
    ).not.toBeNull();
    expect(gallery.querySelectorAll('[data-testid^="botanical-template-"]')).toHaveLength(4);
    expect(screen.queryByText("Ready-made newsletter designs")).not.toBeInTheDocument();
    expect(screen.queryByText("Explore more newsletter designs")).not.toBeInTheDocument();
    for (const id of ["botanical-editorial", "botanical-seasonal", "botanical-product", "botanical-events"]) {
      expect(screen.getByTestId(`botanical-template-${id}`)).toBeVisible();
    }
    await user.click(screen.getByRole("button", { name: "Use Event Roundup" }));
    expect(onApplyBuiltInTemplate).toHaveBeenCalledWith(expect.objectContaining({ id: "botanical-events" }));
    await user.click(screen.getByTestId("intent-card-sale"));
    expect(handlers.onSelectIntent).toHaveBeenCalledWith("sale");
  });

  it("shows the seasonal showcase and its format within the same gallery", () => {
    render(<IntentPicker savedTemplates={[]} {...noopHandlers()} />);
    expect(screen.getByTestId("intent-card-showcase")).toBeVisible();
    expect(screen.getByText("Seasonal Showcase")).toBeVisible();
  });

  it("keeps all template choices keyboard accessible", async () => {
    const user = userEvent.setup();
    const onApplyBuiltInTemplate = vi.fn();
    render(<IntentPicker savedTemplates={[]} {...noopHandlers()} onApplyBuiltInTemplate={onApplyBuiltInTemplate} />);
    const card = screen.getByTestId("botanical-template-botanical-product");
    card.focus();
    await user.keyboard("{Enter}");
    expect(onApplyBuiltInTemplate).toHaveBeenCalledWith(expect.objectContaining({ id: "botanical-product" }));
  });

  it("hides My templates section when there are no saved templates", () => {
    const handlers = noopHandlers();
    render(<IntentPicker savedTemplates={[]} {...handlers} />);
    expect(
      screen.queryByTestId("intent-picker-my-templates"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Your saved designs")).not.toBeInTheDocument();
  });

  it("renders My templates section when at least one is saved", () => {
    const handlers = noopHandlers();
    const template = makeSavedTemplate();
    render(<IntentPicker savedTemplates={[template]} {...handlers} />);
    expect(
      screen.getByTestId("intent-picker-my-templates"),
    ).toBeInTheDocument();
    expect(screen.getByText("Your saved designs")).toBeInTheDocument();
    expect(
      screen.getByTestId(`saved-template-card-${template.id}`),
    ).toBeInTheDocument();
    expect(screen.getByText("2 blocks")).toBeInTheDocument();
  });

  it("clicking a saved-template card fires onApplySavedTemplate", async () => {
    const user = userEvent.setup();
    const handlers = noopHandlers();
    const template = makeSavedTemplate();
    render(<IntentPicker savedTemplates={[template]} {...handlers} />);
    await user.click(screen.getByTestId(`saved-template-card-${template.id}`));
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
    render(<IntentPicker savedTemplates={[template]} {...handlers} />);
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
