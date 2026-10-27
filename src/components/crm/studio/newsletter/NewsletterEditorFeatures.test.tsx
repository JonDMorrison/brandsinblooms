import * as React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DndContext } from "@dnd-kit/core";
import BlockLibrary from "../BlockLibrary";
import ExtendedBlockProperties from "./ExtendedBlockProperties";
import { createStudioBlock } from "@/lib/studio/blockFactory";
import type { StudioBlock } from "@/types/studioBlocks";
const fixture = vi.hoisted(() => ({
  create: vi.fn(),
  rename: vi.fn(),
  remove: vi.fn(),
  reload: vi.fn(),
  blocks: [] as Array<{
    id: string;
    name: string;
    block: StudioBlock;
    updatedAt: string;
  }>,
}));
vi.mock("@/hooks/useSavedNewsletterBlocks", () => ({
  useSavedNewsletterBlocks: () => ({
    ...fixture,
    loading: false,
    error: "",
    busy: false,
    ready: true,
    accountName: "Test Garden Centre",
  }),
}));
vi.mock("../fields/StudioImageUpload", () => ({
  default: ({ label }: { label: string }) => (
    <button type="button">{label}</button>
  ),
  uploadStudioImageFile: vi.fn(),
}));
vi.mock("../fields/StudioRichTextField", () => ({
  default: ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
  }) => (
    <label>
      {label}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  ),
}));
vi.mock("@/contexts/DesignSystemContext", () => ({
  useDesignSystem: () => ({ designSystem: null }),
}));
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  fixture.blocks = [];
  fixture.create.mockResolvedValue({ id: "saved" });
  fixture.rename.mockResolvedValue({});
  fixture.remove.mockResolvedValue({});
});
describe("newsletter editing controls", () => {
  it("offers all coupon presets in a labelled dropdown", () => {
    const update = vi.fn();
    render(
      <ExtendedBlockProperties
        block={createStudioBlock("coupon")}
        update={update}
      />,
    );
    const select = screen.getByRole("combobox", { name: "Offer preset" });
    expect(select.querySelectorAll("option")).toHaveLength(9);
    fireEvent.change(select, { target: { value: "tiered" } });
    expect(update).toHaveBeenCalledWith("couponOffer", "tiered");
    expect(screen.getByLabelText("Introduction")).toBeTruthy();
    expect(screen.getByLabelText("Subtitle / botanical name")).toBeTruthy();
    expect(screen.getByLabelText("Expiry")).toBeTruthy();
  });
  it("makes each feature-grid image slot separately editable", () => {
    render(
      <ExtendedBlockProperties
        block={{
          ...createStudioBlock("image-gallery"),
          layout: "feature-grid",
          galleryImages: [],
        }}
        update={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Image 1 photo" })).toBeTruthy();
    const summaries = screen.getAllByText(/Image [23] · Side image/);
    summaries.forEach((summary) => fireEvent.click(summary));
    expect(screen.getByText("Image 2 photo")).toBeTruthy();
    expect(screen.getByText("Image 3 photo")).toBeTruthy();
  });
  it("keeps gallery layout choice singular and preserves existing entries", () => {
    const update = vi.fn();
    const images = Array.from({ length: 4 }, (_, i) => ({
      id: String(i),
      url: `https://example.com/${i}.jpg`,
      alt: "",
    }));
    render(
      <ExtendedBlockProperties
        block={{ ...createStudioBlock("image-gallery"), galleryImages: images }}
        update={update}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /2 across/ }));
    expect(update).toHaveBeenCalledWith("gridColumns", 2);
    expect(update).not.toHaveBeenCalledWith("galleryImages", expect.anything());
  });
});
describe("named account library and outline", () => {
  const setup = (extra: Record<string, unknown> = {}) => {
    const source = {
      ...createStudioBlock("coupon"),
      label: "Spring lawn offer",
      headline: "Lawn care",
      couponPrice: "$19.99",
      imageUrl: "https://example.com/lawn.jpg",
    };
    const callbacks = {
      onAddBlock: vi.fn(),
      onSelectBlock: vi.fn(),
      onInsertSavedBlock: vi.fn(),
      onDuplicateBlock: vi.fn(),
      onDeleteBlock: vi.fn(),
      onMoveBlock: vi.fn(),
    };
    render(
      <DndContext>
        <BlockLibrary
          blocks={[source, createStudioBlock("footer")]}
          selectedBlockId={source.id}
          {...callbacks}
          {...extra}
        />
      </DndContext>,
    );
    return { source, ...callbacks };
  };
  it("does not automatically import unlabelled browser blocks into an account", () => {
    localStorage.setItem(
      "bloomsuite-saved-block-templates",
      JSON.stringify([
        { name: "Old design", block: createStudioBlock("coupon") },
      ]),
    );
    setup();
    expect(fixture.create).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("tab", { name: "Saved" }));
    expect(screen.getByText("Import blocks from this browser")).toBeTruthy();
    expect(fixture.create).not.toHaveBeenCalled();
  });
  it("asks for a name and saves complete configured content", async () => {
    const { source } = setup();
    fireEvent.click(screen.getByRole("tab", { name: "Saved" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Save selected block" }),
    );
    fireEvent.change(screen.getByLabelText("Block name"), {
      target: { value: "Spring lawn coupon" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save to account" }));
    await waitFor(() =>
      expect(fixture.create).toHaveBeenCalledWith({
        name: "Spring lawn coupon",
        block: source,
      }),
    );
    expect(await screen.findByText("Saved to your account.")).toBeTruthy();
  });
  it("selects, duplicates and saves from the block outline", () => {
    const { source, onSelectBlock, onDuplicateBlock } = setup();
    fireEvent.click(screen.getByRole("tab", { name: "Outline" }));
    fireEvent.click(
      screen.getByRole("button", { name: "1. Spring lawn offer" }),
    );
    expect(onSelectBlock).toHaveBeenCalledWith(source.id);
    fireEvent.click(
      screen.getByRole("button", { name: "Duplicate Spring lawn offer" }),
    );
    expect(onDuplicateBlock).toHaveBeenCalledWith(source.id);
    fireEvent.click(
      screen.getByRole("button", { name: "Save Spring lawn offer" }),
    );
    expect(screen.getByLabelText("Block name")).toBeTruthy();
  });
  it("inserts the saved content rather than a generic block type", () => {
    const saved = createStudioBlock("coupon");
    fixture.blocks = [
      {
        id: "1",
        name: "Seasonal coupon",
        block: { ...saved, couponPrice: "$5" },
        updatedAt: "2026-10-27T00:00:00Z",
      },
    ];
    const { onInsertSavedBlock } = setup();
    fireEvent.click(screen.getByRole("tab", { name: "Saved" }));
    fireEvent.click(screen.getByRole("button", { name: /^Seasonal coupon/ }));
    expect(onInsertSavedBlock).toHaveBeenCalledWith(
      expect.objectContaining({ couponPrice: "$5" }),
    );
  });
});
