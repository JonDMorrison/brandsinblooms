import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CampaignLivePreview } from "../CampaignLivePreview";
import { buildStudioDesignSystem } from "@/lib/studio/designSystem";
import type { StudioBlock } from "@/types/studioBlocks";

const designSystem = buildStudioDesignSystem({ name: "Fernhill Gardens" });
const design = (headline: string): StudioBlock[] => [
  { id: "hero", type: "email-safe-hero", label: "Hero", order: 0, visible: true, headline, body: "Join us." },
];

function scrolledDown() {
  const box = screen.getByTestId("campaign-live-preview-scroll");
  box.scrollTop = 300;
  expect(box.scrollTop).toBe(300);
  return box;
}

describe("CampaignLivePreview scroll position", () => {
  const props = { subjectLine: "Winter", previewText: "Join us", designSystem };

  it("starts at the top on Mobile, Desktop and Dark", () => {
    render(<CampaignLivePreview {...props} blocks={design("Wreaths")} />);
    for (const name of ["Mobile", "Desktop", "Dark", "Dark"]) {
      const box = scrolledDown();
      fireEvent.click(screen.getByRole("button", { name }));
      expect(box.scrollTop).toBe(0);
    }
  });

  it("starts at the top when the design loads or changes, not on subject edits", () => {
    const { rerender } = render(<CampaignLivePreview {...props} blocks={design("Wreaths")} loading />);
    rerender(<CampaignLivePreview {...props} blocks={design("Wreaths")} />);
    expect(screen.getByTestId("campaign-live-preview-scroll").scrollTop).toBe(0);

    let box = scrolledDown();
    rerender(<CampaignLivePreview {...props} blocks={design("Christmas trees")} />);
    expect(box.scrollTop).toBe(0);

    box = scrolledDown();
    rerender(<CampaignLivePreview {...props} subjectLine="Winter wreaths" blocks={design("Christmas trees")} />);
    expect(box.scrollTop).toBe(300);
  });
});
