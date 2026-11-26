import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TemplatePreview } from "./TemplatePreview";
import { createStudioBlock } from "@/lib/studio/blockFactory";
import type { StudioBlock } from "@/types/studioBlocks";

const blocks = [
  { ...createStudioBlock("headline"), id: "h", order: 0, visible: true, headline: "Spring is here" },
  { ...createStudioBlock("footer"), id: "f", order: 1, visible: true },
] as StudioBlock[];

describe("TemplatePreview", () => {
  it("draws the design with the email renderer inside a locked-down frame", () => {
    render(<TemplatePreview blocks={blocks} name="Spring promo" />);
    const frame = screen.getByTitle("Preview of Spring promo") as HTMLIFrameElement;
    expect(frame.getAttribute("srcdoc")).toContain("Spring is here");
    // No permissions at all: no scripts, forms or navigation.
    expect(frame.getAttribute("sandbox")).toBe("");
    expect(frame.getAttribute("loading")).toBe("lazy");
    expect(frame.tabIndex).toBe(-1);
  });

  it("says so when a design has nothing in it", () => {
    render(<TemplatePreview blocks={[]} name="Empty" />);
    expect(screen.getByText("This design is empty")).toBeVisible();
  });
});
