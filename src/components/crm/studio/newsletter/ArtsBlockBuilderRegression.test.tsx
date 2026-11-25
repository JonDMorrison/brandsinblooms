import * as React from "react";
import { render, fireEvent, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ImageUrlField from "./ImageUrlField";
import { createStudioBlock } from "@/lib/studio/blockFactory";
import { renderCoupon, renderExtendedBlock } from "@/lib/studio/newsletter/renderExtensions";

vi.mock("./NewsletterDesignContext", () => ({
  useNewsletterDesign: () => ({
    settings: { assetLocations: [{ name: "Store photos", url: "https://example.com/photos/" }] },
  }),
}));

describe("Arts November block-builder regressions", () => {
  it("retains a photo URL after applying it and when the saved value is reopened", () => {
    const onApply = vi.fn();
    const { rerender } = render(<ImageUrlField expanded onApply={onApply} />);
    fireEvent.change(screen.getByLabelText("Photo URL"), { target: { value: "https://placehold.co/640x360" } });
    fireEvent.click(screen.getByRole("button", { name: "Use this image" }));
    expect(onApply).toHaveBeenCalledWith("https://placehold.co/640x360");
    expect(screen.getByLabelText("Photo URL")).toHaveValue("https://placehold.co/640x360");
    rerender(<ImageUrlField expanded onApply={onApply} currentUrl="https://example.com/photo.png" />);
    expect(screen.getByLabelText("Photo URL")).toHaveValue("https://example.com/photo.png");
    fireEvent.click(screen.getByRole("button", { name: "Square placeholder" }));
    expect(screen.getByLabelText("Photo URL")).toHaveValue("https://placehold.co/1200x1200/png");
    expect(onApply).toHaveBeenCalledTimes(1);
  });

  it("resolves a relative filename against the selected asset location", () => {
    const onApply = vi.fn();
    render(<ImageUrlField expanded onApply={onApply} />);
    fireEvent.change(screen.getByLabelText("Image location"), { target: { value: "https://example.com/photos/" } });
    fireEvent.change(screen.getByLabelText("Image filename"), { target: { value: "banner.png" } });
    fireEvent.click(screen.getByRole("button", { name: "Use this image" }));
    expect(onApply).toHaveBeenCalledWith("https://example.com/photos/banner.png");
    expect(screen.getByLabelText("Photo URL")).toHaveValue("https://example.com/photos/banner.png");
  });

  it("hides a coupon CTA without deleting its stored text or destination", () => {
    const block = { ...createStudioBlock("coupon"), buttonText: "See offer", buttonUrl: "https://example.com/offer" };
    expect(renderCoupon({ ...block, showButton: true }, 640)).toContain("See offer");
    expect(renderCoupon({ ...block, showButton: false }, 640)).not.toContain("See offer");
    expect(renderCoupon({ ...block, showButton: false }, 640, true)).not.toContain("See offer");
  });

  it("renders gallery fit, image height and per-image spacing from stored values", () => {
    const block = createStudioBlock("product-gallery");
    const html = renderExtendedBlock({
      // A saved gallery with a fixed height and no ratio keeps that height
      // (a chosen ratio would win over it).
      ...block, imageRatio: undefined, imageFit: "cover", imageHeight: 280,
      galleryProducts: [{ id: "product", name: "Fern", price: "$20", imageUrl: "https://example.com/fern.png" }],
    }, 640);
    expect(html).toContain("object-fit:cover");
    expect(html).toContain("height:280px");
  });
});
