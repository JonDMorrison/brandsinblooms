import * as React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import BlockPropertiesPanel from "./BlockPropertiesPanel";
import SharedEmailBlockPreview from "./newsletter/SharedEmailBlockPreview";
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

  it("keeps Product Card's Show card border with the other border controls", () => {
    openPanel(createStudioBlock("product-card"));
    const borderSection = screen.getByText("Border & label").closest("details")!;
    expect(borderSection).toContainElement(screen.getByText("Show card border"));
    expect(borderSection).toContainElement(screen.getByText("Card corner roundness"));
    expect(borderSection).toContainElement(screen.getByText("Border style"));
    expect(screen.queryByText("Show Card Border")).toBeNull();
  });

  it("offers portrait fit, one column split and one optional image link", () => {
    openPanel({ ...createStudioBlock("image-text"), imageLinkEnabled: true });
    expect(screen.getByText("9:16")).toBeInTheDocument();
    expect(screen.getAllByText("Column Split")).toHaveLength(1);
    expect(screen.getByText("Image link URL")).toBeInTheDocument();
    expect(screen.getByLabelText("Text vertical alignment")).toBeInTheDocument();
  });
});


describe("Image + Text side switching", () => {
  it("updates the actual preview table left/right/left without losing saved content", () => {
    const initial = {
      ...createStudioBlock("image-text"),
      headline: "Winter favourites",
      body: "Plants for the winter garden.",
      imageUrl: "https://example.com/winter.jpg",
      imageAlt: "Winter garden",
      buttonText: "Explore plants",
      buttonUrl: "https://example.com/plants",
    };
    let saved = initial;
    function Editor() {
      const [block, setBlock] = React.useState(initial);
      return <>
        <BlockPropertiesPanel
          campaignImageGallery={[]} campaignName="Winter" campaignType="newsletter"
          selectedBlockId={block.id} blocks={[block]} open onClose={() => {}}
          onUpdateBlockField={() => {}}
          onUpdateBlockFields={(_id, fields) => {
            // Exercise the JSON save/reload representation as well as selection.
            saved = JSON.parse(JSON.stringify({ ...block, ...fields }));
            setBlock(saved);
          }}
        />
        <SharedEmailBlockPreview block={block} />
      </>;
    }
    const { container } = render(<Editor />);
    for (const [name, direction] of [["Image Right", "rtl"], ["Image Left", "ltr"], ["Image Right", "rtl"]]) {
      fireEvent.click(screen.getByRole("button", { name, exact: true }));
      const table = container.querySelector<HTMLTableElement>(".image-text-row")!;
      expect(table.dir).toBe(direction);
      expect(table.style.direction).toBe(direction);
      expect(table.rows[0].cells[0]).toHaveClass("image-text-image");
      expect(table.rows[0].cells[1]).toHaveClass("image-text-content");
      expect(Array.from(table.rows[0].cells).map((cell) => cell.dir)).toEqual(["ltr", "ltr"]);
      expect(saved.headline).toBe(initial.headline);
      expect(saved.body).toBe(initial.body);
      expect(saved.imageUrl).toBe(initial.imageUrl);
      expect(saved.buttonUrl).toBe(initial.buttonUrl);
      expect(container.querySelector(".nl-preview")).toHaveTextContent(initial.headline);
    }
  });
});

describe("Product Gallery layout switching", () => {
  it("switches between grids and side-by-side features without losing products", () => {
    const initial = { ...createStudioBlock("product-gallery"), galleryProducts: [
      { id: "maple", name: "Japanese maple", imageUrl: "https://example.com/maple.jpg", buttonText: "Shop maple", buttonUrl: "https://example.com/maple" },
      { id: "fern", name: "Garden fern", imageUrl: "https://example.com/fern.jpg", buttonText: "Shop fern", buttonUrl: "https://example.com/fern" },
    ] };
    function Editor() {
      const [block, setBlock] = React.useState(initial);
      return <>
        <BlockPropertiesPanel
          campaignImageGallery={[]} campaignName="Winter" campaignType="newsletter"
          selectedBlockId={block.id} blocks={[block]} open onClose={() => {}}
          onUpdateBlockField={(_id, field, value) => setBlock((current) => JSON.parse(JSON.stringify({ ...current, [field]: value })))}
          onUpdateBlockFields={(_id, fields) => setBlock(JSON.parse(JSON.stringify({ ...block, ...fields })))}
        />
        <SharedEmailBlockPreview block={block} />
      </>;
    }
    const { container } = render(<Editor />);
    for (const name of ["Image beside details", "▯▯▯ 3 across", "▯▯ 2 across", "Image beside details"]) {
      fireEvent.click(screen.getByRole("button", { name, exact: true }));
      const preview = container.querySelector(".nl-preview")!;
      for (const product of initial.galleryProducts) {
        const image = preview.querySelector(`img[src="${product.imageUrl}"]`)!;
        const imageCell = image.closest("td")!;
        const detailsCell = preview.querySelector(`a[href="${product.buttonUrl}"][data-newsletter-role="button"]`)!.closest("td")!;
        expect(preview).toHaveTextContent(product.name);
        expect(image).toHaveAttribute("data-newsletter-image", "galleryProducts");
        if (name === "Image beside details") {
          expect(imageCell.parentElement).toBe(detailsCell.parentElement);
          expect(imageCell.nextElementSibling).toBe(detailsCell);
        } else {
          expect(imageCell.parentElement).not.toBe(detailsCell.parentElement);
        }
      }
    }
  });
});
