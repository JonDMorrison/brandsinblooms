import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import StudioRichTextField from "./StudioRichTextField";

describe("newsletter body personalization", () => {
  const originalRects = Object.getOwnPropertyDescriptor(Range.prototype, "getClientRects");
  const originalBounds = Object.getOwnPropertyDescriptor(Range.prototype, "getBoundingClientRect");
  beforeAll(() => {
    // ProseMirror scrolls the selection after focus. jsdom has no layout or
    // Range geometry, so provide it just for this real-editor test.
    Object.defineProperties(Range.prototype, {
      getClientRects: { configurable: true, value: () => [] },
      getBoundingClientRect: { configurable: true, value: () => new DOMRect() },
    });
  });
  afterAll(() => {
    for (const [key, original] of [["getClientRects", originalRects], ["getBoundingClientRect", originalBounds]] as const) {
      if (original) Object.defineProperty(Range.prototype, key, original);
      else delete (Range.prototype as unknown as Record<string, unknown>)[key];
    }
  });
  it("keeps personalization outside the scrolling toolbar and inserts FNAME into body HTML", async () => {
    const onChange = vi.fn();
    const { container } = render(
      <div style={{ width: 280 }}>
        <StudioRichTextField label="Body Text" value="<p>Hello </p>" onChange={onChange} />
      </div>,
    );
    const personalize = await screen.findByRole("button", { name: "Personalize" });
    // The formatting toolbar scrolls in narrow property panels. Personalize
    // must stay in the field header, where it remains directly discoverable.
    expect(personalize.parentElement?.textContent).toContain("Body Text");
    expect(personalize.parentElement?.querySelector('[aria-label="Bold"]')).toBeNull();
    fireEvent.click(personalize);
    expect(personalize).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(screen.getByRole("button", { name: /First name \(FNAME\)/ }));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(onChange.mock.calls.at(-1)?.[0]).toContain("{{first_name}}");
    expect(container.querySelector(".tiptap")?.textContent).toContain("{{first_name}}");
    expect(personalize).toHaveAttribute("aria-expanded", "false");
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  });
});
