import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SharedEmailBlockPreview from "./SharedEmailBlockPreview";
import { createStudioBlock } from "@/lib/studio/blockFactory";
import { inlineEditableValues, markInlineEditableText } from "@/lib/studio/newsletter/inlineTextEditing";
import type { StudioBlock } from "@/types/studioBlocks";

vi.mock("@/contexts/DesignSystemContext", () => ({ useDesignSystem: () => ({ designSystem: null }) }));

const announcement = (fields: Partial<StudioBlock> = {}) =>
  ({
    ...createStudioBlock("announcement"),
    id: "a1",
    order: 0,
    visible: true,
    tagLabel: "This week",
    headline: "Spring sale",
    subheading: "Saturday only",
    body: "<p>Everything in the <strong>greenhouse</strong>.</p>",
    buttonText: "Shop now",
    buttonUrl: "https://example.com/shop",
    ...fields,
  }) as StudioBlock;

const edit = (element: HTMLElement, words: string) => {
  fireEvent.click(element);
  element.textContent = words;
  fireEvent.blur(element);
};

describe("inline text editing on the canvas", () => {
  it("marks the plain text fields and leaves rich text alone", () => {
    render(<SharedEmailBlockPreview block={announcement()} onUpdateBlockField={vi.fn()} />);
    expect(screen.getByRole("textbox", { name: "Edit headline" })).toHaveTextContent("Spring sale");
    expect(screen.getByRole("textbox", { name: "Edit subheading" })).toHaveTextContent("Saturday only");
    expect(screen.getByRole("textbox", { name: "Edit small label" })).toHaveTextContent("This week");
    expect(screen.getByRole("textbox", { name: "Edit button words" })).toHaveTextContent("Shop now");
    expect(screen.getByText("greenhouse").closest("[data-nl-edit]")).toBeNull();
  });

  it("saves the new words to the same block field the panel edits", () => {
    const update = vi.fn();
    render(<SharedEmailBlockPreview block={announcement()} onUpdateBlockField={update} />);
    edit(screen.getByRole("textbox", { name: "Edit headline" }), "Summer sale");
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith("a1", "headline", "Summer sale");
  });

  it("clicking button words edits them and does not follow the link", () => {
    const update = vi.fn();
    render(<SharedEmailBlockPreview block={announcement()} onUpdateBlockField={update} />);
    const button = screen.getByRole("textbox", { name: "Edit button words" });
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    button.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    button.textContent = "Visit us";
    fireEvent.blur(button);
    expect(update).toHaveBeenCalledWith("a1", "buttonText", "Visit us");
  });

  it("stores plain words only, never markup", () => {
    const update = vi.fn();
    render(<SharedEmailBlockPreview block={announcement()} onUpdateBlockField={update} />);
    const headline = screen.getByRole("textbox", { name: "Edit headline" });
    fireEvent.click(headline);
    headline.innerHTML = 'Hello <img src=x onerror="alert(1)"><script>alert(2)</script><b>there</b>';
    fireEvent.blur(headline);
    const saved = update.mock.calls[0][2] as string;
    expect(saved).not.toMatch(/[<>]/);
    expect(saved).toContain("Hello");
    expect(saved).toContain("there");
  });

  it("Escape puts the old words back and saves nothing", () => {
    const update = vi.fn();
    render(<SharedEmailBlockPreview block={announcement()} onUpdateBlockField={update} />);
    const headline = screen.getByRole("textbox", { name: "Edit headline" });
    fireEvent.click(headline);
    headline.textContent = "Oops";
    fireEvent.keyDown(headline, { key: "Escape" });
    expect(headline).toHaveTextContent("Spring sale");
    expect(update).not.toHaveBeenCalled();
  });

  it("saves nothing when the words did not change", () => {
    const update = vi.fn();
    render(<SharedEmailBlockPreview block={announcement()} onUpdateBlockField={update} />);
    const headline = screen.getByRole("textbox", { name: "Edit headline" });
    fireEvent.click(headline);
    fireEvent.blur(headline);
    expect(update).not.toHaveBeenCalled();
  });

  it("typing does not reach the page shortcuts", () => {
    const pageKey = vi.fn();
    render(
      <div onKeyDown={pageKey}>
        <SharedEmailBlockPreview block={announcement()} onUpdateBlockField={vi.fn()} />
      </div>,
    );
    const headline = screen.getByRole("textbox", { name: "Edit headline" });
    fireEvent.click(headline);
    fireEvent.keyDown(headline, { key: "Backspace" });
    expect(pageKey).not.toHaveBeenCalled();
  });

  it("nothing is editable without an update handler (Preview) or in the footer", () => {
    const { container } = render(<SharedEmailBlockPreview block={announcement()} />);
    expect(container.querySelector("[data-nl-edit]")).toBeNull();
    expect(inlineEditableValues({ ...createStudioBlock("footer"), businessName: "Northfield", headline: "x" } as StudioBlock).size).toBe(0);
  });

  it("text with personalisation is left to the panel so the tag cannot be broken", () => {
    const block = announcement({ headline: "Hi {{ first_name }}" });
    expect([...inlineEditableValues(block).values()].map((entry) => entry.field)).not.toContain("headline");
    render(<SharedEmailBlockPreview block={block} onUpdateBlockField={vi.fn()} />);
    expect(screen.queryByRole("textbox", { name: "Edit headline" })).toBeNull();
  });

  it("marking is repeatable and maps each field once", () => {
    const root = document.createElement("div");
    root.innerHTML = "<h2>Same</h2><div>Same</div><p>Other</p>";
    const block = { ...createStudioBlock("announcement"), headline: "Same", subheading: "Same" } as StudioBlock;
    expect(markInlineEditableText(root, block)).toBe(1);
    expect(markInlineEditableText(root, block)).toBe(1);
    expect(root.querySelectorAll("[data-nl-edit]")).toHaveLength(1);
    expect(root.querySelector("h2")?.getAttribute("data-nl-edit")).toBe("headline");
  });
});
