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
    isOwn: false,
    ...overrides,
  };
}

describe("IntentPicker", () => {
  const choose = async (user: ReturnType<typeof userEvent.setup>, mode: string) =>
    user.click(screen.getByTestId(`start-mode-${mode}`));

  it("offers four ways to start, with scratch chosen for a new email", () => {
    render(<IntentPicker savedTemplates={[]} {...noopHandlers()} />);
    const options = screen.getAllByRole("radio");
    expect(options.map((option) => option.textContent)).toEqual([
      expect.stringContaining("Start from scratch"),
      expect.stringContaining("Pick a preset"),
      expect.stringContaining("Choose a template"),
      expect.stringContaining("Choose a theme"),
    ]);
    expect(screen.getByTestId("start-mode-scratch")).toHaveAttribute("aria-checked", "true");
    // Nothing else is shown until another option is chosen.
    expect(screen.queryByTestId("campaign-design-gallery")).not.toBeInTheDocument();
    expect(screen.queryByTestId("intent-picker-my-templates")).not.toBeInTheDocument();
    expect(screen.queryByTestId("intent-start-weekly-theme")).not.toBeInTheDocument();
  });

  it("says what each option is", () => {
    render(<IntentPicker savedTemplates={[]} {...noopHandlers()} />);
    expect(screen.getByText("A clean newsletter you fill in yourself.")).toBeVisible();
    expect(screen.getByText("A ready-made layout designed by BloomSuite.")).toBeVisible();
    expect(screen.getByText("A design your own business has saved.")).toBeVisible();
    expect(screen.getByText("Seasonal garden centre content, written for you.")).toBeVisible();
  });

  it("choosing an option only reveals its choices and changes nothing in the email", async () => {
    const user = userEvent.setup();
    const handlers = noopHandlers();
    const onApplyBuiltInTemplate = vi.fn();
    const onStartFromTheme = vi.fn();
    render(
      <IntentPicker
        savedTemplates={[makeSavedTemplate()]}
        {...handlers}
        onApplyBuiltInTemplate={onApplyBuiltInTemplate}
        onStartFromTheme={onStartFromTheme}
        weeklyTheme={{ title: "Year-End Garden Review", weekLabel: "Week 48" }}
        hasContent
      />,
    );
    for (const mode of ["preset", "template", "theme", "scratch"]) await choose(user, mode);
    expect(handlers.onSelectIntent).not.toHaveBeenCalled();
    expect(handlers.onApplySavedTemplate).not.toHaveBeenCalled();
    expect(onApplyBuiltInTemplate).not.toHaveBeenCalled();
    expect(onStartFromTheme).not.toHaveBeenCalled();
  });

  it("opens on the option the email already uses", () => {
    const { unmount } = render(<IntentPicker savedTemplates={[]} selectedIntent="sale" {...noopHandlers()} />);
    expect(screen.getByTestId("start-mode-preset")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByTestId("campaign-design-gallery")).toBeVisible();
    unmount();
    const template = makeSavedTemplate();
    render(<IntentPicker savedTemplates={[template]} selectedSavedTemplateId={template.id} {...noopHandlers()} />);
    expect(screen.getByTestId("start-mode-template")).toHaveAttribute("aria-checked", "true");
  });

  it("scratch offers to start over only when the email already has a design", async () => {
    const user = userEvent.setup();
    const handlers = noopHandlers();
    const { unmount } = render(<IntentPicker savedTemplates={[]} {...handlers} />);
    expect(screen.queryByTestId("intent-card-blank")).not.toBeInTheDocument();
    unmount();
    render(<IntentPicker savedTemplates={[]} hasContent {...handlers} />);
    await user.click(screen.getByTestId("intent-card-blank"));
    expect(handlers.onSelectIntent).toHaveBeenCalledWith("blank");
  });

  it("theme shows this week's theme and starts it on click", async () => {
    const user = userEvent.setup();
    const onStartFromTheme = vi.fn();
    render(
      <IntentPicker
        savedTemplates={[]}
        {...noopHandlers()}
        onStartFromTheme={onStartFromTheme}
        weeklyTheme={{ title: "Year-End Garden Review", weekLabel: "Week 48" }}
      />,
    );
    await choose(user, "theme");
    await user.click(screen.getByTestId("intent-start-weekly-theme"));
    expect(onStartFromTheme).toHaveBeenCalledOnce();
  });

  it("theme and template explain themselves when there is nothing to pick", async () => {
    const user = userEvent.setup();
    render(<IntentPicker savedTemplates={[]} {...noopHandlers()} />);
    await choose(user, "theme");
    expect(screen.getByText(/no theme for this week yet/i)).toBeVisible();
    await choose(user, "template");
    expect(screen.getByTestId("start-panel-template-empty")).toBeVisible();
  });

  it("preset shows every BloomSuite layout in one gallery", async () => {
    const user = userEvent.setup();
    const onApplyBuiltInTemplate = vi.fn();
    const handlers = noopHandlers();
    render(
      <IntentPicker savedTemplates={[]} {...handlers} onApplyBuiltInTemplate={onApplyBuiltInTemplate} />,
    );
    await choose(user, "preset");
    const gallery = screen.getByTestId("campaign-design-gallery");
    expect(screen.getByText("Choose a design")).toBeVisible();
    expect(gallery.querySelectorAll('[data-testid^="intent-card-"]')).toHaveLength(6);
    expect(gallery.querySelectorAll('[data-testid^="botanical-template-"]')).toHaveLength(4);
    for (const id of ["botanical-editorial", "botanical-seasonal", "botanical-product", "botanical-events"]) {
      expect(screen.getByTestId(`botanical-template-${id}`)).toBeVisible();
    }
    await user.click(screen.getByRole("button", { name: "Use Event Roundup" }));
    expect(onApplyBuiltInTemplate).toHaveBeenCalledWith(expect.objectContaining({ id: "botanical-events" }));
    await user.click(screen.getByTestId("intent-card-sale"));
    expect(handlers.onSelectIntent).toHaveBeenCalledWith("sale");
  });

  it("shows the seasonal showcase within the preset gallery", async () => {
    const user = userEvent.setup();
    render(<IntentPicker savedTemplates={[]} {...noopHandlers()} />);
    await choose(user, "preset");
    expect(screen.getByTestId("intent-card-showcase")).toBeVisible();
    expect(screen.getByText("Seasonal Showcase")).toBeVisible();
  });

  it("keeps all choices keyboard accessible", async () => {
    const user = userEvent.setup();
    const onApplyBuiltInTemplate = vi.fn();
    render(<IntentPicker savedTemplates={[]} {...noopHandlers()} onApplyBuiltInTemplate={onApplyBuiltInTemplate} />);
    screen.getByTestId("start-mode-preset").focus();
    await user.keyboard("{Enter}");
    const card = screen.getByTestId("botanical-template-botanical-product");
    card.focus();
    await user.keyboard("{Enter}");
    expect(onApplyBuiltInTemplate).toHaveBeenCalledWith(expect.objectContaining({ id: "botanical-product" }));
  });

  it("template lists the business's saved designs", async () => {
    const user = userEvent.setup();
    const handlers = noopHandlers();
    const template = makeSavedTemplate();
    render(<IntentPicker savedTemplates={[template]} {...handlers} />);
    await choose(user, "template");
    expect(screen.getByTestId("intent-picker-my-templates")).toBeInTheDocument();
    expect(screen.getByText("Your saved designs")).toBeInTheDocument();
    expect(screen.getByText("2 blocks")).toBeInTheDocument();
    await user.click(screen.getByTestId(`saved-template-card-${template.id}`));
    expect(handlers.onApplySavedTemplate).toHaveBeenCalledWith(template);
    await user.click(screen.getByTestId("intent-picker-manage-link"));
    expect(handlers.onOpenManage).toHaveBeenCalledOnce();
  });

  it("disables presets listed in unavailableIntents and shows the coming-soon tooltip", async () => {
    const user = userEvent.setup();
    render(
      <IntentPicker
        savedTemplates={[]}
        unavailableIntents={new Set(["thank-you"])}
        {...noopHandlers()}
      />,
    );
    await choose(user, "preset");
    const card = screen.getByTestId("intent-card-thank-you");
    expect(card).toHaveAttribute("aria-disabled", "true");
    expect(card).toHaveAttribute("title", "Coming soon");
  });

  it("reflects the selected preset via aria-pressed", () => {
    render(
      <IntentPicker
        savedTemplates={[]}
        selectedIntent="newsletter"
        {...noopHandlers()}
      />,
    );
    expect(screen.getByTestId("intent-card-newsletter")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("intent-card-sale")).toHaveAttribute("aria-pressed", "false");
  });
});
