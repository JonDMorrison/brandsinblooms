import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SaveAsTemplateModal } from "@/components/crm/campaign-editor/SaveAsTemplateModal";

describe("SaveAsTemplateModal", () => {
  it("renders title, body, and inputs when open", () => {
    render(
      <SaveAsTemplateModal open onClose={() => {}} onSave={() => {}} />,
    );
    expect(
      screen.getByText("Save this design as a template"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("save-as-template-modal-name"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("save-as-template-modal-description"),
    ).toBeInTheDocument();
  });

  it("Save button is disabled when the name is empty", () => {
    render(
      <SaveAsTemplateModal open onClose={() => {}} onSave={() => {}} />,
    );
    expect(screen.getByTestId("save-as-template-modal-save")).toBeDisabled();
  });

  it("calls onSave with trimmed values and closes via onSave callback resolution", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <SaveAsTemplateModal open onClose={() => {}} onSave={onSave} />,
    );

    const nameInput = screen
      .getByTestId("save-as-template-modal-name")
      .querySelector("input") as HTMLInputElement;
    await user.type(nameInput, "  Spring layout  ");

    const descTextarea = screen
      .getByTestId("save-as-template-modal-description")
      .querySelector("textarea") as HTMLTextAreaElement;
    await user.type(descTextarea, "  My reference  ");

    await user.click(screen.getByTestId("save-as-template-modal-save"));

    expect(onSave).toHaveBeenCalledWith({
      name: "Spring layout",
      description: "My reference",
    });
  });

  it("Cancel fires onClose without invoking onSave", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(
      <SaveAsTemplateModal open onClose={onClose} onSave={onSave} />,
    );
    await user.click(screen.getByTestId("save-as-template-modal-cancel"));
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("displays an error from onSave instead of crashing", async () => {
    const user = userEvent.setup();
    const onSave = vi
      .fn()
      .mockRejectedValue(new Error("Network unreachable"));
    render(
      <SaveAsTemplateModal open onClose={() => {}} onSave={onSave} />,
    );

    const nameInput = screen
      .getByTestId("save-as-template-modal-name")
      .querySelector("input") as HTMLInputElement;
    await user.type(nameInput, "Layout A");
    await user.click(screen.getByTestId("save-as-template-modal-save"));

    expect(
      await screen.findByTestId("save-as-template-modal-error"),
    ).toHaveTextContent("Network unreachable");
  });
});
