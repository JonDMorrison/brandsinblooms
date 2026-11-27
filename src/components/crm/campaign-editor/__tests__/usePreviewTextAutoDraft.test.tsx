import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { usePreviewTextAutoDraft } from "../usePreviewTextAutoDraft";
import type { StudioBlock } from "@/types/studioBlocks";

const text = (body: string): StudioBlock[] => [
  { id: "t", type: "plain-text", label: "Text", order: 0, visible: true, body },
  { id: "f", type: "footer", label: "Footer", order: 1, visible: true },
];
const footerOnly: StudioBlock[] = [{ id: "f", type: "footer", label: "Footer", order: 1, visible: true }];

function setup(initial: { blocks: StudioBlock[]; previewText: string; enabled?: boolean }) {
  const onDraft = vi.fn();
  const hook = renderHook(
    (props: { blocks: StudioBlock[]; previewText: string; enabled?: boolean }) =>
      usePreviewTextAutoDraft({ ...props, enabled: props.enabled ?? true, onDraft }),
    { initialProps: initial },
  );
  return { onDraft, ...hook };
}

describe("usePreviewTextAutoDraft", () => {
  it("drafts empty preview text once a design exists, greeting removed", () => {
    const { onDraft, rerender } = setup({ blocks: footerOnly, previewText: "" });
    expect(onDraft).not.toHaveBeenCalled();
    rerender({ blocks: text("Hi {{first_name}}, roses are in. Come by."), previewText: "" });
    expect(onDraft).toHaveBeenCalledWith("Roses are in.");
  });

  it("waits while the campaign loads", () => {
    const { onDraft, rerender } = setup({ blocks: text("Roses are in."), previewText: "", enabled: false });
    expect(onDraft).not.toHaveBeenCalled();
    rerender({ blocks: text("Roses are in."), previewText: "", enabled: true });
    expect(onDraft).toHaveBeenCalledWith("Roses are in.");
  });

  it("re-drafts when the design changes while the text is still the draft", () => {
    const { onDraft, rerender } = setup({ blocks: text("Roses are in."), previewText: "" });
    rerender({ blocks: text("Roses are in."), previewText: "Roses are in." });
    rerender({ blocks: text("Tulips arrive Friday."), previewText: "Roses are in." });
    expect(onDraft).toHaveBeenLastCalledWith("Tulips arrive Friday.");
  });

  it("treats saved text that matches the design's draft as a draft", () => {
    const { onDraft, rerender } = setup({ blocks: text("Roses are in."), previewText: "Roses are in." });
    expect(onDraft).not.toHaveBeenCalled();
    rerender({ blocks: text("Tulips arrive Friday."), previewText: "Roses are in." });
    expect(onDraft).toHaveBeenCalledWith("Tulips arrive Friday.");
  });

  it("never replaces preview text the person typed", () => {
    const { onDraft, rerender } = setup({ blocks: text("Roses are in."), previewText: "" });
    rerender({ blocks: text("Roses are in."), previewText: "My own words" });
    rerender({ blocks: text("Tulips arrive Friday."), previewText: "My own words" });
    expect(onDraft).toHaveBeenCalledTimes(1);

    const loaded = setup({ blocks: text("Roses are in."), previewText: "Written last week" });
    loaded.rerender({ blocks: text("Tulips arrive Friday."), previewText: "Written last week" });
    expect(loaded.onDraft).not.toHaveBeenCalled();
  });

  it("leaves it empty when only a greeting is left", () => {
    const { onDraft } = setup({ blocks: text("Dear friends,"), previewText: "" });
    expect(onDraft).not.toHaveBeenCalled();
  });
});
