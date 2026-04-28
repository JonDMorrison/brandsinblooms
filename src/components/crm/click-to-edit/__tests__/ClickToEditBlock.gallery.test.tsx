import React from "react";
import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ClickToEditBlock } from "../ClickToEditBlock";
import { ImageGalleryBlock } from "../blocks/ImageGalleryBlock";
import { ProductGalleryBlock } from "../blocks/ProductGalleryBlock";
import type { ContentBlock, GalleryItem } from "@/types/emailBuilder";

vi.mock("@dnd-kit/sortable", () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
}));

vi.mock("@dnd-kit/utilities", () => ({
  CSS: {
    Transform: {
      toString: () => undefined,
    },
  },
}));

vi.mock("@/hooks/useAIImageGeneration", () => ({
  useAIImageGeneration: () => ({
    generateSingleImage: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock("@/components/crm/MediaSelectorSidebar", () => ({
  MediaSelectorSidebar: () => null,
}));

vi.mock("../ImageOverlayDialog", () => ({
  ImageOverlayDialog: () => null,
}));

vi.mock("../ToolsDropdownMenu", () => ({
  ToolsDropdownMenu: () => null,
}));

vi.mock("../blocks/ImageGalleryBlock/GalleryGridConfigDialog", () => ({
  GalleryGridConfigDialog: () => null,
}));

const noop = () => {};

interface HarnessProps {
  initialBlock: ContentBlock;
}

function GalleryHarness({ initialBlock }: HarnessProps) {
  const [block, setBlock] = React.useState(initialBlock);

  const applyUpdates = React.useCallback((updates: Partial<ContentBlock>) => {
    setBlock((currentBlock) => ({
      ...currentBlock,
      ...updates,
    }));
  }, []);

  return (
    <div>
      <ClickToEditBlock
        block={block}
        index={0}
        onUpdate={(_id, updates) => applyUpdates(updates)}
        onRemove={noop}
        onDuplicate={noop}
        onMove={noop}
        canMoveUp={false}
        canMoveDown={false}
        children={{
          preview:
            block.type === "product-gallery" ? (
              <ProductGalleryBlock
                block={block}
                onUpdate={applyUpdates}
                isPreview={true}
              />
            ) : (
              <ImageGalleryBlock
                block={block}
                onUpdate={applyUpdates}
                isPreview={true}
              />
            ),
          editor:
            block.type === "product-gallery" ? (
              <ProductGalleryBlock
                block={block}
                onUpdate={applyUpdates}
                isPreview={false}
              />
            ) : (
              <ImageGalleryBlock
                block={block}
                onUpdate={applyUpdates}
                isPreview={false}
              />
            ),
        }}
      />
      <button type="button">Outside target</button>
    </div>
  );
}

function createImageGalleryBlock(): ContentBlock {
  return {
    id: "gallery-block",
    type: "image-gallery",
    source: "manual",
    headline: "Spring Gallery",
    body: "Fresh arrivals for the season.",
    galleryImages: [
      { id: "img-1", url: "https://example.com/1.jpg", alt: "One" },
      { id: "img-2", url: "https://example.com/2.jpg", alt: "Two" },
      { id: "img-3", url: "https://example.com/3.jpg", alt: "Three" },
    ],
    galleryLayout: "3-across",
    visible: true,
    collapsed: false,
  } as ContentBlock;
}

function createProductGalleryBlock(): ContentBlock {
  const galleryItems: GalleryItem[] = [
    {
      id: "product-1",
      title: "Holiday Wreath",
      imageUrl: "https://example.com/wreath.jpg",
      badgeText: "25% OFF",
      url: "https://example.com/wreath",
    },
  ];

  return {
    id: "product-gallery-block",
    type: "product-gallery",
    source: "manual",
    headline: "Holiday Products",
    body: "Transform your space with festive favorites.",
    galleryItems,
    ctaText: "Shop Holiday",
    ctaUrl: "https://example.com/shop",
    visible: true,
    collapsed: false,
  } as ContentBlock;
}

describe("ClickToEditBlock gallery editing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens the image gallery editor on canvas click and saves changes", async () => {
    render(<GalleryHarness initialBlock={createImageGalleryBlock()} />);

    fireEvent.click(screen.getByText("Spring Gallery"));

    const headlineInput = await screen.findByLabelText("Headline");
    fireEvent.change(headlineInput, {
      target: { value: "Summer Gallery" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Save & Close" }));

    await waitFor(() => {
      expect(screen.queryByLabelText("Headline")).not.toBeInTheDocument();
    });

    expect(screen.getByText("Summer Gallery")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Summer Gallery"));

    expect(
      await screen.findByDisplayValue("Summer Gallery"),
    ).toBeInTheDocument();
  });

  it("opens the product gallery editor on canvas click and cancels back to the original data", async () => {
    render(<GalleryHarness initialBlock={createProductGalleryBlock()} />);

    fireEvent.click(screen.getByText("Holiday Products"));

    const headlineInput = await screen.findByLabelText("Headline");
    fireEvent.change(headlineInput, {
      target: { value: "Changed Product Gallery" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(screen.queryByLabelText("Headline")).not.toBeInTheDocument();
    });

    expect(screen.getByText("Holiday Products")).toBeInTheDocument();
    expect(
      screen.queryByText("Changed Product Gallery"),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Holiday Products"));

    expect(
      await screen.findByDisplayValue("Holiday Products"),
    ).toBeInTheDocument();
  });

  it("saves product gallery edits through Save & Close", async () => {
    render(<GalleryHarness initialBlock={createProductGalleryBlock()} />);

    fireEvent.click(screen.getByText("Holiday Products"));

    const badgeInput = await screen.findByDisplayValue("25% OFF");
    fireEvent.change(badgeInput, {
      target: { value: "30% OFF" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Save & Close" }));

    await waitFor(() => {
      expect(screen.queryByDisplayValue("30% OFF")).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Holiday Products"));

    expect(await screen.findByDisplayValue("30% OFF")).toBeInTheDocument();
  });

  it("exits gallery edit mode when clicking outside the block", async () => {
    render(<GalleryHarness initialBlock={createImageGalleryBlock()} />);

    fireEvent.click(screen.getByText("Spring Gallery"));
    await screen.findByLabelText("Headline");

    fireEvent.mouseDown(screen.getByRole("button", { name: "Outside target" }));

    await waitFor(() => {
      expect(screen.queryByLabelText("Headline")).not.toBeInTheDocument();
    });
  });
});
