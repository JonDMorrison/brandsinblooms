import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import BlockPropertiesPanel from "./BlockPropertiesPanel";
import { buildStudioDesignSystem } from "@/lib/studio/designSystem";
import { createStudioBlock } from "@/lib/studio/blockFactory";
import type { StudioBlock } from "@/types/studioBlocks";

vi.mock("@/contexts/DesignSystemContext", () => ({
  useOptionalDesignSystem: () => null,
  useDesignSystem: () => ({
    designSystem: buildStudioDesignSystem({} as never),
  }),
}));
vi.mock("./fields/StudioImageUpload", () => ({
  default: ({ label }: { label: string }) => <button>{label}</button>,
}));
vi.mock("./newsletter/AudienceControls", () => ({ default: () => null }));
vi.mock("./fields/StudioTextField", () => ({
  default: ({ label }: { label: string }) => <label>{label}</label>,
}));

describe("hero photo discoverability", () => {
  it.each([
    undefined,
    "solid",
    "gradient",
    "image-overlay",
    "image-bottom",
  ] as const)("shows photo control before text fields for %s", (heroStyle) => {
    const block = {
      id: "hero",
      type: "email-safe-hero",
      label: "Hero",
      order: 0,
      visible: true,
      heroStyle,
    } as StudioBlock;
    render(
      <BlockPropertiesPanel
        campaignImageGallery={[]}
        campaignName="Winter"
        campaignType="newsletter"
        selectedBlockId="hero"
        blocks={[block]}
        open
        onClose={() => {}}
        onUpdateBlockField={() => {}}
      />,
    );
    const photo = screen.getByRole("button", {
      name: heroStyle === "image-overlay" ? "Background photo" : "Banner photo",
    });
    const headline = screen.getByText("Headline");
    expect(
      photo.compareDocumentPosition(headline) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});

describe("properties panel heading hierarchy", () => {
  it("uses prominent dark section titles above the Graphic Hero controls", () => {
    const block = {
      id: "graphic",
      type: "graphic-hero",
      label: "Graphic Hero",
      order: 0,
      visible: true,
    } as StudioBlock;
    render(
      <BlockPropertiesPanel
        campaignImageGallery={[]}
        campaignName="Winter"
        campaignType="newsletter"
        selectedBlockId={block.id}
        blocks={[block]}
        open
        onClose={() => {}}
        onUpdateBlockField={() => {}}
      />,
    );
    const heading = screen.getByText("Image", { selector: ".MuiTypography-root" });
    expect(heading).toHaveStyle({
      fontSize: "14px",
      fontWeight: "750",
      color: "var(--joy-palette-neutral-800, #171A1C)",
    });
  });
});

describe("block-specific properties", () => {
  function openPanel(block: StudioBlock) {
    return render(
      <BlockPropertiesPanel
        campaignImageGallery={[]} campaignName="Winter" campaignType="newsletter"
        selectedBlockId={block.id} blocks={[block]} open onClose={() => {}} onUpdateBlockField={() => {}}
      />,
    );
  }

  it("keeps old inline buttons editable while giving new text blocks one set of controls", () => {
    const fresh = createStudioBlock("plain-text");
    const clean = openPanel(fresh);
    expect(screen.getByText("Text Alignment")).toBeInTheDocument();
    expect(screen.queryByText("Button Text")).toBeNull();
    expect(screen.queryByText("Content Padding")).toBeNull();
    expect(screen.queryByText("Font Weight")).toBeNull();
    clean.unmount();
    openPanel({ ...fresh, buttonText: "Shop", buttonUrl: "https://example.com" });
    expect(screen.getByText("Existing button")).toBeInTheDocument();
  });

  it("groups a button's width, padding and alignment, without text or image controls", () => {
    openPanel(createStudioBlock("call-to-action"));
    expect(screen.getByLabelText("Full Width")).toBeInTheDocument();
    expect(screen.getByLabelText("Button horizontal padding")).toBeInTheDocument();
    expect(screen.getByText("Button alignment")).toBeInTheDocument();
    expect(screen.queryByText("Headline")).toBeNull();
    expect(screen.queryByText("Image spacing")).toBeNull();
  });

  it("offers portrait fit, one column split and one optional image link", () => {
    openPanel({ ...createStudioBlock("image-text"), imageLinkEnabled: true });
    expect(screen.getByText("9:16")).toBeInTheDocument();
    expect(screen.getAllByText("Column Split")).toHaveLength(1);
    expect(screen.getByText("Image link URL")).toBeInTheDocument();
    expect(screen.getByLabelText("Text vertical alignment")).toBeInTheDocument();
  });
});
