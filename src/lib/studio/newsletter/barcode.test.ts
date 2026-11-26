import { describe, expect, it } from "vitest";
import { createStudioBlock } from "@/lib/studio/blockFactory";
import { renderNewsletterBlock } from "@/lib/studio/emailHtmlGenerator";
import type { StudioBlock } from "@/types/studioBlocks";
import {
  barcodeBits,
  checkBarcode,
  code128Values,
  couponBarcodeFormat,
  expandUpcE,
  gtinCheckDigit,
} from "./barcode";

// Reference bar patterns produced by an independent encoder (python-barcode 0.16.1).
const REFERENCE = {
  upcA: "10100011010111101010111100011010001101000110101010110110011101001100110101110010011101101100101",
  ean13: "10100011010100111010111101111010001001011001101010100001010000101000010111010010000101100110101",
  ean8: "1010001011010111101111010110111010101001110111001010001001011100101",
  code128Digits: "1101001110010110011100100010110001110001011011000010100100011101101100011101011",
  code128Text: "11010010000110111010001110111011011000101110110001000101011100011011010001000100110111001100111001011011100100110001001001100011101011",
};

const ok = (format: Parameters<typeof checkBarcode>[0], raw: string) => {
  const result = checkBarcode(format, raw);
  if (!result.ok) throw new Error(result.message);
  return result;
};

describe("check digits", () => {
  it("works out the UPC-A, EAN-13 and EAN-8 check digit", () => {
    expect(gtinCheckDigit("03600029145")).toBe(2);
    expect(gtinCheckDigit("400638133393")).toBe(1);
    expect(gtinCheckDigit("9638507")).toBe(4);
  });

  it("adds a missing check digit and says so", () => {
    const result = ok("upc-a", "03600029145");
    expect(result.code).toBe("036000291452");
    expect(result.note).toContain("036000291452");
  });

  it("accepts a complete code without a note", () => {
    expect(ok("upc-a", "036000291452")).toEqual({ ok: true, format: "upc-a", code: "036000291452", message: "" });
    expect(ok("ean-13", "4006381333931").code).toBe("4006381333931");
    expect(ok("ean-8", "96385074").code).toBe("96385074");
  });

  it("rejects a wrong check digit and names the right one", () => {
    const result = checkBarcode("upc-a", "036000291453");
    expect(result.ok).toBe(false);
    expect(result.message).toContain("should be 2");
  });

  it("ignores spaces and dashes in numeric codes", () => {
    expect(ok("ean-13", "4 006381 333931").code).toBe("4006381333931");
  });
});

describe("a six-digit code is valid only where the format allows it", () => {
  it.each(["upc-a", "ean-13", "ean-8"] as const)("%s rejects six digits", (format) => {
    expect(checkBarcode(format, "123456").ok).toBe(false);
  });

  it("UPC-E accepts six digits and completes them", () => {
    expect(ok("upc-e", "425261").code).toBe("04252614");
  });

  it("Code 128 accepts six digits as they are", () => {
    expect(ok("code-128", "123456").code).toBe("123456");
  });
});

describe("UPC-E", () => {
  it("expands to the matching UPC-A number", () => {
    // 0 425261 4 is the short form of 0 42100 00526 4.
    expect(expandUpcE("0", "425261")).toBe("04210000526");
    expect(expandUpcE("0", "123453")).toBe("01230000045");
    expect(expandUpcE("0", "123454")).toBe("01234000005");
    expect(expandUpcE("0", "123459")).toBe("01234500009");
  });

  it("verifies a typed check digit", () => {
    expect(ok("upc-e", "04252614").code).toBe("04252614");
    expect(checkBarcode("upc-e", "04252615").ok).toBe(false);
  });

  it("needs a leading 0 or 1", () => {
    expect(checkBarcode("upc-e", "24252614").ok).toBe(false);
  });

  it("draws 51 modules with the start and end guards", () => {
    const bits = barcodeBits("upc-e", "04252614");
    expect(bits).toHaveLength(51);
    expect(bits.startsWith("101")).toBe(true);
    expect(bits.endsWith("010101")).toBe(true);
  });
});

describe("bar patterns match an independent encoder", () => {
  it("UPC-A", () => expect(barcodeBits("upc-a", "036000291452")).toBe(REFERENCE.upcA));
  it("EAN-13", () => expect(barcodeBits("ean-13", "4006381333931")).toBe(REFERENCE.ean13));
  it("EAN-8", () => expect(barcodeBits("ean-8", "96385074")).toBe(REFERENCE.ean8));
  it("Code 128, digits", () => expect(barcodeBits("code-128", "12345678")).toBe(REFERENCE.code128Digits));
  it("Code 128, letters", () => expect(barcodeBits("code-128", "SPRING-25")).toBe(REFERENCE.code128Text));
});

describe("Code 128", () => {
  it("packs an even run of digits two per symbol", () => {
    expect(code128Values("1234")).toEqual([105, 12, 34, (105 + 12 + 34 * 2) % 103]);
  });

  it("uses the text set for letters or an odd number of digits", () => {
    expect(code128Values("123")[0]).toBe(104);
    expect(code128Values("AB")[0]).toBe(104);
  });

  it("rejects characters it cannot print", () => {
    expect(checkBarcode("code-128", "café").ok).toBe(false);
    expect(checkBarcode("code-128", "x".repeat(33)).ok).toBe(false);
  });
});

describe("coupon barcode in the email", () => {
  const image = "https://example.com/barcode.png";
  const coupon = (fields: Partial<StudioBlock>) =>
    renderNewsletterBlock({ ...createStudioBlock("coupon"), id: "c", order: 0, visible: true, headline: "Perennials", couponBarcodeImageUrl: image, ...fields } as StudioBlock);

  it("coupons saved before formats existed are still UPC-A", () => {
    expect(couponBarcodeFormat(undefined)).toBe("upc-a");
    expect(coupon({ couponBarcode: "036000291452" })).toContain(image);
  });

  it("shows the barcode for each format when the saved code is complete", () => {
    expect(coupon({ couponBarcodeFormat: "ean-13", couponBarcode: "4006381333931" })).toContain("EAN-13 barcode 4006381333931");
    expect(coupon({ couponBarcodeFormat: "code-128", couponBarcode: "SPRING-25" })).toContain("Code 128 barcode SPRING-25");
  });

  it("hides the picture when the code no longer matches its format", () => {
    expect(coupon({ couponBarcodeFormat: "ean-13", couponBarcode: "036000291452" })).not.toContain(image);
    expect(coupon({ couponBarcode: "036000291453" })).not.toContain(image);
  });
});
