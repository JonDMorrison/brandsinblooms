import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ExtendedBlockProperties from "./ExtendedBlockProperties";
import { createStudioBlock } from "@/lib/studio/blockFactory";
import type { StudioBlock } from "@/types/studioBlocks";

vi.mock("./NewsletterDesignContext", () => ({
  useNewsletterDesign: () => ({ settings: {} }),
}));
// The photo picker needs the AI image provider; the copy button does not.
vi.mock("../fields/StudioImageUpload", () => ({
  default: ({ label }: { label: string }) => <button type="button">{label}</button>,
  uploadStudioImageFile: vi.fn(),
}));

function Harness({ initial, onBlock }: { initial: StudioBlock; onBlock: (block: StudioBlock) => void }) {
  const [block, setBlock] = React.useState(initial);
  onBlock(block);
  return <ExtendedBlockProperties block={block} update={(field, value) => setBlock((b) => ({ ...b, [field]: value }))} />;
}

describe("gallery: copy details to the next slot", () => {
  it("copies a product's details, not its photo, to the next product", () => {
    let latest = createStudioBlock("product-gallery");
    const initial = {
      ...latest,
      galleryProducts: [
        { id: "a", imageUrl: "https://example.com/maple.jpg", name: "Bloodgood Maple", price: "$89.99", buttonText: "Shop now", buttonUrl: "https://example.com/maples", badgeText: "SALE", badgeColor: "#b91c1c", imagePadding: { top: 8 } },
        { id: "b", imageUrl: "https://example.com/fern.jpg", name: "", price: "" },
        { id: "c", imageUrl: "", name: "", price: "" },
      ],
    } as StudioBlock;
    render(<Harness initial={initial} onBlock={(b) => { latest = b; }} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy details to Product 2" }));
    expect(latest.galleryProducts?.[1]).toEqual({
      id: "b",
      imageUrl: "https://example.com/fern.jpg",
      name: "Bloodgood Maple",
      price: "$89.99",
      buttonText: "Shop now",
      buttonUrl: "https://example.com/maples",
      badgeText: "SALE",
      badgeColor: "#b91c1c",
      imagePadding: { top: 8 },
    });
    expect(latest.galleryProducts?.[0].name).toBe("Bloodgood Maple");
  });

  it("copies an image's alt text, caption, link and spacing to the next image", () => {
    let latest = createStudioBlock("image-gallery");
    const initial = {
      ...latest,
      galleryImages: [
        { id: "a", url: "https://example.com/1.jpg", alt: "Roses", caption: "Fall roses", linkUrl: "https://example.com/roses", imageMargin: { bottom: 4 } },
        { id: "b", url: "https://example.com/2.jpg", alt: "" },
      ],
    } as StudioBlock;
    render(<Harness initial={initial} onBlock={(b) => { latest = b; }} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy details to Image 2" }));
    expect(latest.galleryImages?.[1]).toMatchObject({
      id: "b",
      url: "https://example.com/2.jpg",
      alt: "Roses",
      caption: "Fall roses",
      linkUrl: "https://example.com/roses",
      imageMargin: { bottom: 4 },
    });
  });

  it("the last slot has no copy button", () => {
    const block = { ...createStudioBlock("image-gallery"), gridColumns: 2, galleryImages: [{ id: "a", url: "", alt: "" }, { id: "b", url: "", alt: "" }] } as StudioBlock;
    render(<ExtendedBlockProperties block={block} update={() => undefined} />);
    expect(screen.getByRole("button", { name: "Copy details to Image 2" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy details to Image 3" })).toBeNull();
  });
});
