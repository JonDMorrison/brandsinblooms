import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ContentPreviewCard } from "../ContentPreviewCard";
import type { StudioDesignSystem } from "@/lib/studio/designSystem";
import type { StudioBlock } from "@/types/studioBlocks";
vi.mock("@/lib/studio/emailHtmlGenerator", () => ({
  generateEmailHtml: () =>
    "<html><body><p>Workshop invitation</p></body></html>",
}));
const designSystem = {
  company: { name: "Garden Centre" },
} as StudioDesignSystem;
const blocks = [
  { type: "plain-text", body: "Workshop invitation" },
] as StudioBlock[];
describe("ContentPreviewCard", () => {
  it("opens Studio from an explicit action and supports mobile preview", async () => {
    const user = userEvent.setup();
    const onOpenStudio = vi.fn();
    render(
      <ContentPreviewCard
        blocks={blocks}
        subjectLine="Workshop invitation"
        previewText="Join us"
        designSystem={designSystem}
        onOpenStudio={onOpenStudio}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: "Edit in Design Studio" }),
    );
    expect(onOpenStudio).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "Mobile" }));
    expect(screen.getByRole("button", { name: "Mobile" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen.queryByText("Click to edit in Studio"),
    ).not.toBeInTheDocument();
  });
  it("sizes the iframe to the email content so the page handles scrolling", () => {
    render(
      <ContentPreviewCard
        blocks={blocks}
        subjectLine="Workshop"
        previewText=""
        designSystem={designSystem}
        onOpenStudio={() => {}}
      />,
    );
    const frame = screen.getByTitle(
      "Campaign live preview",
    ) as HTMLIFrameElement;
    Object.defineProperty(frame.contentDocument!.body, "scrollHeight", {
      value: 1800,
      configurable: true,
    });
    fireEvent.load(frame);
    expect(frame.style.height).toBe("1824px");
    expect(frame).toHaveAttribute("scrolling", "no");
  });
});
