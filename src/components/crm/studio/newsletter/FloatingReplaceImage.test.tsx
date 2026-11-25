import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createStudioBlock } from "@/lib/studio/blockFactory";
import type { StudioBlock } from "@/types/studioBlocks";
import SharedEmailBlockPreview from "./SharedEmailBlockPreview";

vi.mock("@/contexts/DesignSystemContext", () => ({
  useDesignSystem: () => ({ designSystem: null }),
}));
vi.mock("./NewsletterDesignContext", () => ({
  useNewsletterDesign: () => ({ settings: undefined }),
}));
vi.mock("../fields/StudioImageUpload", () => ({
  uploadStudioImageFile: vi.fn(),
}));

// jsdom has no layout; give photos a real-looking box so they can be measured.
const box = { x: 0, y: 0, top: 0, left: 0, right: 300, bottom: 200, width: 300, height: 200, toJSON: () => ({}) };
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    return (this.tagName === "IMG" ? box : { ...box, right: 640, bottom: 400, width: 640, height: 400 }) as DOMRect;
  });
});
afterEach(() => vi.restoreAllMocks());

const imageText = {
  ...createStudioBlock("image-text"),
  headline: "Staff pick",
  imageUrl: "https://example.com/plant.jpg",
  imageAlt: "Prayer plant",
} as StudioBlock;

describe("floating Replace image button", () => {
  it("shows one button per photo and opens the picker for that photo", () => {
    render(<SharedEmailBlockPreview block={imageText} onUpdateBlockField={vi.fn()} />);
    const button = screen.getByRole("button", { name: "Replace Prayer plant" });
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    const click = vi.spyOn(input, "click").mockImplementation(() => undefined);
    fireEvent.click(button);
    expect(click).toHaveBeenCalledTimes(1);
  });

  it("does not show in read-only previews or on the Photo Banner, which has its own", () => {
    const { unmount } = render(<SharedEmailBlockPreview block={imageText} />);
    expect(screen.queryByRole("button", { name: /^Replace / })).toBeNull();
    unmount();
    render(
      <SharedEmailBlockPreview
        block={{ ...createStudioBlock("graphic-hero"), imageUrl: "https://example.com/b.jpg", imageFit: "contain" } as StudioBlock}
        onUpdateBlockField={vi.fn()}
      />,
    );
    expect(screen.queryAllByText("Replace image")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Replace Graphic Hero image" })).toBeInTheDocument();
  });
});
