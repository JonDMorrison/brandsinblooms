import { describe, expect, it } from "vitest";
import { createStudioBlock } from "@/lib/studio/blockFactory";
import { couponImagePercent, renderCoupon } from "@/lib/studio/newsletter/renderExtensions";
import type { StudioBlock } from "@/types/studioBlocks";

const coupon = (fields: Partial<StudioBlock>) =>
  ({
    ...createStudioBlock("coupon"),
    headline: "Perennials",
    imageUrl: "https://example.com/coupon.jpg",
    couponImageSide: "left",
    ...fields,
  }) as StudioBlock;

const widths = (html: string) =>
  [...html.matchAll(/<td dir="ltr" class="responsive-column" width="(\d+)%"/g)].map((m) => Number(m[1]));

describe("Coupon column widths", () => {
  it.each([
    ["25/75", [25, 75]],
    ["33/67", [33, 67]],
    ["50/50", [50, 50]],
  ] as const)("%s sets the photo and offer columns", (couponColumnSplit, expected) => {
    expect(widths(renderCoupon(coupon({ couponColumnSplit }), 640))).toEqual(expected);
  });

  it("applies the same widths with the photo on the right", () => {
    const html = renderCoupon(coupon({ couponColumnSplit: "25/75", couponImageSide: "right" }), 640);
    // Offer column first, then the 25% photo column.
    expect(widths(html)).toEqual([75, 25]);
  });

  it("an unset split keeps the original 38 / 62 layout", () => {
    expect(widths(renderCoupon(coupon({}), 640))).toEqual([38, 62]);
    expect(couponImagePercent(undefined)).toBe(38);
  });

  it("the photo is sized to its column", () => {
    const html = renderCoupon(coupon({ couponColumnSplit: "50/50" }), 640);
    expect(html).toMatch(/<img[^>]*coupon\.jpg[^>]*width="298"/);
  });
});
