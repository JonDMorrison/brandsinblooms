import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CssVarsProvider } from "@mui/joy/styles";
import { joyTheme } from "@/config/joy-theme";
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
      // Mobile and Desktop are a segmented control; Dark is a separate switch.
      fireEvent.click(
        name === "Dark" ? screen.getByRole("switch", { name }) : screen.getByRole("button", { name }),
      );
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

describe("CampaignLivePreview controls", () => {
  const props = { subjectLine: "Winter", previewText: "Join us", designSystem };

  it("pairs a Mobile/Desktop segmented control with a separate Dark switch", () => {
    render(<CampaignLivePreview {...props} blocks={design("Wreaths")} />);
    const header = screen.getByTestId("campaign-live-preview-header");
    expect(within(header).getByRole("heading", { name: "Live preview" })).toBeInTheDocument();
    const device = screen.getByTestId("campaign-live-preview-device");
    expect(within(device).getAllByRole("button").map((button) => button.textContent)).toEqual(["Mobile", "Desktop"]);
    expect(within(device).getByRole("button", { name: "Desktop" })).toHaveAttribute("aria-pressed", "true");
    // Dark is not one of the device choices.
    expect(within(device).queryByRole("switch")).toBeNull();
    const dark = screen.getByRole("switch", { name: "Dark" });
    expect(dark).not.toBeChecked();

    // Dark is a modifier: it stays on when the device changes.
    fireEvent.click(dark);
    fireEvent.click(within(device).getByRole("button", { name: "Mobile" }));
    expect(screen.getByRole("switch", { name: "Dark" })).toBeChecked();
    expect(within(device).getByRole("button", { name: "Mobile" })).toHaveAttribute("aria-pressed", "true");
  });

  it("shows Mobile inside a device frame and Desktop without one", () => {
    render(
      <CssVarsProvider theme={joyTheme}>
        <CampaignLivePreview {...props} blocks={design("Wreaths")} />
      </CssVarsProvider>,
    );
    expect(screen.getByTestId("campaign-live-preview-frame")).toHaveAttribute("data-device", "desktop");
    fireEvent.click(screen.getByRole("button", { name: "Mobile" }));
    const frame = screen.getByTestId("campaign-live-preview-frame");
    expect(frame).toHaveAttribute("data-device", "mobile");
    expect(getComputedStyle(frame).borderRadius).toBe("var(--joy-radius-2xl)");
  });
});
