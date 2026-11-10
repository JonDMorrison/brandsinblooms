import "@testing-library/jest-dom/vitest";
import * as React from "react";
import {
  render,
  screen,
  fireEvent,
  act,
  waitFor,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import SharedEmailBlockPreview from "./SharedEmailBlockPreview";
import DataImportDialog from "./DataImportDialog";
import { createStudioBlock } from "@/lib/studio/blockFactory";
import { buildStudioDesignSystem } from "@/lib/studio/designSystem";
const mocks = vi.hoisted(() => ({ upload: vi.fn() }));
vi.mock("../fields/StudioImageUpload", () => ({
  uploadStudioImageFile: mocks.upload,
}));
vi.mock("@/contexts/DesignSystemContext", () => ({
  useDesignSystem: () => ({
    designSystem: buildStudioDesignSystem({} as never),
  }),
}));
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
beforeEach(() => vi.clearAllMocks());
describe("graphic hero image upload", () => {
  it("opens the file picker for an empty Graphic Hero and applies its image", async () => {
    const update = vi.fn();
    mocks.upload.mockResolvedValue("https://example.com/hero-upload.png");
    const block = createStudioBlock("graphic-hero");
    const view = render(<SharedEmailBlockPreview block={block} onUpdateBlockField={update} />);
    const input = view.container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).toBeTruthy();
    const click = vi.spyOn(input!, "click").mockImplementation(() => undefined);
    fireEvent.click(screen.getByRole("button", { name: "Upload Graphic Hero image" }));
    expect(click).toHaveBeenCalledTimes(1);
    fireEvent.change(input!, {
      target: { files: [new File(["hero"], "hero.png", { type: "image/png" })] },
    });
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(block.id, "imageUrl", "https://example.com/hero-upload.png"),
    );
    click.mockRestore();
    view.unmount();
  });

  it("allows replacing a Graphic Hero that already has a background image", async () => {
    const update = vi.fn();
    mocks.upload.mockResolvedValue("https://example.com/replaced.png");
    const block = {
      ...createStudioBlock("graphic-hero"),
      imageUrl: "https://example.com/existing.png",
    };
    const view = render(<SharedEmailBlockPreview block={block} onUpdateBlockField={update} />);
    const input = view.container.querySelector<HTMLInputElement>('input[type="file"]')!;
    const click = vi.spyOn(input, "click").mockImplementation(() => undefined);
    fireEvent.click(screen.getByRole("button", { name: "Replace Graphic Hero image" }));
    expect(click).toHaveBeenCalledTimes(1);
    fireEvent.change(input, {
      target: { files: [new File(["replacement"], "replacement.png", { type: "image/png" })] },
    });
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(block.id, "imageUrl", "https://example.com/replaced.png"),
    );
    click.mockRestore();
    view.unmount();
  });
});

describe("newsletter asynchronous edit safety", () => {
  it("applies an image upload by stable ID without erasing newer edits or reordering", async () => {
    const pending = deferred<string>();
    mocks.upload.mockReturnValue(pending.promise);
    const update = vi.fn();
    const block = {
      ...createStudioBlock("image-gallery"),
      galleryImages: [
        { id: "a", url: "https://example.com/a.png", alt: "A", caption: "Old" },
        { id: "b", url: "https://example.com/b.png", alt: "B" },
      ],
    };
    const view = render(
      <SharedEmailBlockPreview block={block} onUpdateBlockField={update} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Change A" }));
    fireEvent.change(view.container.querySelector('input[type="file"]')!, {
      target: { files: [new File(["photo"], "a.png", { type: "image/png" })] },
    });
    const latest = {
      ...block,
      galleryImages: [
        block.galleryImages[1],
        {
          ...block.galleryImages[0],
          caption: "New caption",
          linkUrl: "https://example.com/new",
        },
      ],
    };
    view.rerender(
      <SharedEmailBlockPreview block={latest} onUpdateBlockField={update} />,
    );
    await act(async () => pending.resolve("https://example.com/uploaded.png"));
    expect(update).toHaveBeenCalledWith(block.id, "galleryImages", [
      latest.galleryImages[0],
      { ...latest.galleryImages[1], url: "https://example.com/uploaded.png" },
    ]);
  });
  it("does not resurrect a gallery slot removed during an upload", async () => {
    const pending = deferred<string>();
    mocks.upload.mockReturnValue(pending.promise);
    const update = vi.fn();
    const block = {
      ...createStudioBlock("image-gallery"),
      galleryImages: [{ id: "a", url: "https://example.com/a.png", alt: "A" }],
    };
    const view = render(
      <SharedEmailBlockPreview block={block} onUpdateBlockField={update} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Change A" }));
    fireEvent.change(view.container.querySelector("input")!, {
      target: { files: [new File(["photo"], "a.png")] },
    });
    view.rerender(
      <SharedEmailBlockPreview
        block={{ ...block, galleryImages: [] }}
        onUpdateBlockField={update}
      />,
    );
    await act(async () => pending.resolve("https://example.com/new.png"));
    expect(update).not.toHaveBeenCalled();
  });
  it("ignores uploads after the block is unmounted", async () => {
    const pending = deferred<string>();
    mocks.upload.mockReturnValue(pending.promise);
    const update = vi.fn();
    const view = render(
      <SharedEmailBlockPreview
        block={{
          ...createStudioBlock("full-width-image"),
          imageUrl: "https://example.com/a.png",
          imageAlt: "A",
        }}
        onUpdateBlockField={update}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Change A" }));
    fireEvent.change(view.container.querySelector("input")!, {
      target: { files: [new File(["photo"], "a.png")] },
    });
    view.unmount();
    await act(async () => pending.resolve("https://example.com/new.png"));
    expect(update).not.toHaveBeenCalled();
  });
  it("does not treat a generated coupon barcode as the product image upload control", () => {
    const view = render(
      <SharedEmailBlockPreview
        block={{
          ...createStudioBlock("coupon"),
          couponBarcode: "036000291452",
          couponBarcodeImageUrl: "https://example.com/upc.png",
        }}
        onUpdateBlockField={vi.fn()}
      />,
    );
    const image = view.container.querySelector('img[alt^="UPC"]')!;
    expect(image.getAttribute("role")).not.toBe("button");
  });
  it("discards previous import rows after an invalid replacement", () => {
    render(<DataImportDialog open onClose={() => {}} onInsert={vi.fn()} />);
    const input = screen.getByLabelText(
      "Tab-separated rows with column headings",
    );
    fireEvent.change(input, { target: { value: "title,price\nFern,$12" } });
    fireEvent.click(screen.getByRole("button", { name: "Read pasted rows" }));
    expect(
      screen.getByRole("button", { name: "Add to newsletter" }),
    ).not.toBeDisabled();
    fireEvent.change(input, { target: { value: 'title,price\n"unfinished' } });
    fireEvent.click(screen.getByRole("button", { name: "Read pasted rows" }));
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add to newsletter" }),
    ).toBeDisabled();
  });
  it("ignores a file read completed after closing and reopening the import dialog", async () => {
    const pending = deferred<string>();
    const file = new File(["a"], "old.csv", { type: "text/csv" });
    Object.defineProperty(file, "text", { value: () => pending.promise });
    const props = { onClose: () => {}, onInsert: vi.fn() };
    const view = render(<DataImportDialog open {...props} />);
    fireEvent.change(screen.getByLabelText("Upload newsletter data"), {
      target: { files: [file] },
    });
    view.rerender(<DataImportDialog open={false} {...props} />);
    view.rerender(<DataImportDialog open {...props} />);
    await act(async () => pending.resolve("title,price\nOld Fern,$12"));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Add to newsletter" }),
      ).toBeDisabled(),
    );
    expect(screen.queryByText("Old Fern")).not.toBeInTheDocument();
  });
});
