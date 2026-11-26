import * as React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
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
  useOptionalDesignSystem: () => null,
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
  it("edits navigation copy, destination and link padding in the same panel", () => {
    const update = vi.fn();
    const block = createStudioBlock("navigation");
    render(<ExtendedBlockProperties block={block} update={update} />);
    fireEvent.change(screen.getByLabelText("Label"), { target: { value: "Garden centre" } });
    expect(update).toHaveBeenCalledWith("links", [{ ...block.links![0], label: "Garden centre" }]);
    fireEvent.change(screen.getByLabelText("Link (web address)"), { target: { value: "https://example.com" } });
    expect(update).toHaveBeenCalledWith("links", [{ ...block.links![0], url: "https://example.com" }]);
    fireEvent.change(screen.getByLabelText("Button vertical padding"), { target: { value: "8" } });
    expect(update).toHaveBeenCalledWith("appearance", { ...block.appearance, buttonPaddingY: 8 });
  });

  it("exposes existing button-group copy without adding copy controls to new groups", () => {
    const block = createStudioBlock("button-group");
    const update = vi.fn();
    const { rerender } = render(<ExtendedBlockProperties block={block} update={update} />);
    expect(screen.queryByLabelText("Heading")).toBeNull();
    expect(screen.getByLabelText("Link (web address)")).toBeInTheDocument();
    rerender(<ExtendedBlockProperties block={{ ...block, headline: "Visit us" }} update={update} />);
    expect(screen.getByLabelText("Heading")).toHaveValue("Visit us");
    expect(screen.getByLabelText("Subheading")).toBeInTheDocument();
  });

  it("offers all coupon presets in a labelled dropdown", () => {
    const update = vi.fn();
    render(
      <ExtendedBlockProperties
        block={createStudioBlock("coupon")}
        update={update}
      />,
    );
    const select = screen.getByRole("combobox", { name: "What is the offer?" });
    expect(select.querySelectorAll("option")).toHaveLength(9);
    fireEvent.change(select, { target: { value: "tiered" } });
    expect(update).toHaveBeenCalledWith("couponOffer", "tiered");
    expect(screen.getByLabelText("Introduction")).toBeTruthy();
    expect(screen.getByLabelText("Second line (like the botanical name)")).toBeTruthy();
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
describe("Arts Nursery November 15 editor controls", () => {
  it("lets a user enter literal tab separators in data table headings", () => {
    const update = vi.fn();
    render(<ExtendedBlockProperties block={{ ...createStudioBlock("data-table"), tableHeaders: ["Product"] }} update={update} />);
    const headings = screen.getByLabelText("Column titles (press Tab to start the next column)") as HTMLTextAreaElement;
    headings.focus();
    headings.setSelectionRange(7, 7);
    fireEvent.keyDown(headings, { key: "Tab" });
    expect(update).toHaveBeenCalledWith("tableHeaders", ["Product", ""]);
  });

  it("shows a single image spacing section alongside each image, with a clear link label", () => {
    const update = vi.fn();
    const image = { id: "img-1", url: "https://example.com/maple.png", alt: "Maple" };
    render(<ExtendedBlockProperties block={{ ...createStudioBlock("image-gallery"), galleryImages: [image] }} update={update} />);
    expect(screen.getAllByLabelText("Image link URL").length).toBeGreaterThan(0);
    expect(screen.queryByText("Image spacing")).toBeNull();
    fireEvent.change(screen.getAllByLabelText("Image padding top")[0], { target: { value: "8" } });
    expect(update).toHaveBeenCalledWith("galleryImages", expect.arrayContaining([
      expect.objectContaining({ ...image, imagePadding: { top: 8 } }),
    ]));
    expect(screen.queryByLabelText("Button horizontal padding")).toBeNull();
  });

  it("gives product galleries badge colours, button alignment and full width in one section", () => {
    const update = vi.fn();
    const product = { id: "p", name: "Maple", price: "$19", imageUrl: "" };
    render(<ExtendedBlockProperties block={{ ...createStudioBlock("product-gallery"), galleryProducts: [product], gridColumns: 1 }} update={update} />);
    expect(screen.getAllByText("Badge colour").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Badge text colour").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("Image link URL").length).toBeGreaterThan(0);
    const alignment = within(screen.getByRole("group", { name: "Button alignment" }));
    fireEvent.click(alignment.getByRole("button", { name: "Centre" }));
    expect(update).toHaveBeenCalledWith("buttonAlign", "center");
    fireEvent.click(alignment.getByRole("button", { name: "Full width" }));
    expect(update).toHaveBeenCalledWith("fullWidthButton", true);
  });

  it("shows native event date/time and admission fee fields", () => {
    const update = vi.fn();
    render(<ExtendedBlockProperties block={createStudioBlock("event")} update={update} />);
    const date = screen.getByLabelText("Event date") as HTMLInputElement;
    const time = screen.getByLabelText("Start time") as HTMLInputElement;
    expect(date.type).toBe("date");
    expect(time.type).toBe("time");
    fireEvent.change(date, { target: { value: "2026-12-07" } });
    expect(update).toHaveBeenCalledWith("eventStartDate", "2026-12-07");
    fireEvent.change(screen.getByLabelText("Fee / admission"), { target: { value: "free" } });
    expect(update).toHaveBeenCalledWith("eventFeeType", "free");
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
    fireEvent.click(screen.getByRole("tab", { name: "Saved blocks" }));
    expect(screen.getByText("Import blocks from this browser")).toBeTruthy();
    expect(fixture.create).not.toHaveBeenCalled();
  });
  it("asks for a name and saves complete configured content", async () => {
    const { source } = setup();
    fireEvent.click(screen.getByRole("tab", { name: "Saved blocks" }));
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
      screen.getByRole("button", { name: "Save block Spring lawn offer" }),
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
    fireEvent.click(screen.getByRole("tab", { name: "Saved blocks" }));
    fireEvent.click(screen.getByRole("button", { name: /^Seasonal coupon/ }));
    expect(onInsertSavedBlock).toHaveBeenCalledWith(
      expect.objectContaining({ couponPrice: "$5" }),
    );
  });
});

describe("Website Links: look and alignment are separate", () => {
  const nav = (fields: Partial<StudioBlock> = {}) => ({
    ...createStudioBlock("navigation"),
    links: [{ id: "a", label: "Shop", url: "https://example.com" }],
    ...fields,
  }) as StudioBlock;

  it("turns pills off again", () => {
    const update = vi.fn();
    render(<ExtendedBlockProperties block={nav({ buttonStyle: "outlined", layoutPreset: "nav-pills" })} update={update} />);
    const look = screen.getByLabelText("How the links look") as HTMLSelectElement;
    expect(look.value).toBe("pills");
    fireEvent.change(look, { target: { value: "links" } });
    expect(update).toHaveBeenCalledWith("buttonStyle", "link");
    expect(update).not.toHaveBeenCalledWith("textAlign", expect.anything());
  });

  it("moves the links without changing how they look", () => {
    const update = vi.fn();
    render(<ExtendedBlockProperties block={nav({ buttonStyle: "outlined", layoutPreset: "nav-pills", textAlign: "center" })} update={update} />);
    fireEvent.click(within(screen.getByRole("group", { name: "Link alignment" })).getByRole("button", { name: "Right" }));
    expect(update).toHaveBeenCalledWith("textAlign", "right");
    expect(update).toHaveBeenCalledWith("layoutPreset", "nav-right");
    expect(update).not.toHaveBeenCalledWith("buttonStyle", expect.anything());
  });

  it("has no Full width choice for links", () => {
    render(<ExtendedBlockProperties block={nav()} update={vi.fn()} />);
    expect(within(screen.getByRole("group", { name: "Link alignment" })).queryByRole("button", { name: "Full width" })).toBeNull();
  });
});

describe("coupon barcode type", () => {
  it("offers the five formats and explains a six-digit code", () => {
    const update = vi.fn();
    render(<ExtendedBlockProperties block={{ ...createStudioBlock("coupon"), couponBarcode: "123456" }} update={update} />);
    const type = screen.getByLabelText("Barcode type") as HTMLSelectElement;
    expect([...type.options].map((option) => option.value)).toEqual(["upc-a", "upc-e", "ean-13", "ean-8", "code-128"]);
    expect(screen.getByText(/UPC-A needs 12 digits/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create printable barcode" })).toBeDisabled();
    fireEvent.change(type, { target: { value: "code-128" } });
    expect(update).toHaveBeenCalledWith("couponBarcodeFormat", "code-128");
  });

  it("allows a six-digit code as Code 128", () => {
    render(<ExtendedBlockProperties block={{ ...createStudioBlock("coupon"), couponBarcode: "123456", couponBarcodeFormat: "code-128" }} update={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Create printable barcode" })).toBeEnabled();
  });
});
