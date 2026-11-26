/**
 * Printable barcodes for coupons.
 *
 * Everything here runs in the browser. No barcode service receives the code.
 * A barcode only prints a number the till already knows. It never creates a
 * discount.
 */

export type BarcodeFormat = "upc-a" | "upc-e" | "ean-13" | "ean-8" | "code-128";

export const BARCODE_FORMATS: Array<{ value: BarcodeFormat; label: string; hint: string }> = [
  { value: "upc-a", label: "UPC-A (12 digits)", hint: "12 digits. Type 11 and the last digit is worked out for you." },
  { value: "upc-e", label: "UPC-E (short, 6 to 8 digits)", hint: "6 digits, or 8 with the leading 0 or 1 and the check digit." },
  { value: "ean-13", label: "EAN-13 (13 digits)", hint: "13 digits. Type 12 and the last digit is worked out for you." },
  { value: "ean-8", label: "EAN-8 (8 digits)", hint: "8 digits. Type 7 and the last digit is worked out for you." },
  { value: "code-128", label: "Code 128 (any length)", hint: "Letters and numbers of any length, up to 32 characters. Use this for a store's own coupon code." },
];

/** `code` is the full code when `ok`; `message` says what to fix when not. */
export interface BarcodeCheck {
  ok: boolean;
  format: BarcodeFormat;
  code: string;
  message: string;
  note?: string;
}
const pass = (format: BarcodeFormat, code: string, note?: string): BarcodeCheck =>
  ({ ok: true, format, code, message: "", ...(note ? { note } : {}) });
const fail = (format: BarcodeFormat, message: string): BarcodeCheck =>
  ({ ok: false, format, code: "", message });

/** Check digit used by UPC-A, EAN-13 and EAN-8. `body` excludes the check digit. */
export function gtinCheckDigit(body: string): number {
  let sum = 0;
  // Weights alternate 3, 1 starting from the right-most body digit.
  for (let i = body.length - 1, weight = 3; i >= 0; i--, weight = weight === 3 ? 1 : 3)
    sum += Number(body[i]) * weight;
  return (10 - (sum % 10)) % 10;
}

/** Expands a UPC-E body (number system + 6 digits) to the 11-digit UPC-A body. */
export function expandUpcE(numberSystem: string, six: string): string {
  const [d1, d2, d3, d4, d5, d6] = six.split("");
  if (d6 === "0" || d6 === "1" || d6 === "2") return `${numberSystem}${d1}${d2}${d6}0000${d3}${d4}${d5}`;
  if (d6 === "3") return `${numberSystem}${d1}${d2}${d3}00000${d4}${d5}`;
  if (d6 === "4") return `${numberSystem}${d1}${d2}${d3}${d4}00000${d5}`;
  return `${numberSystem}${d1}${d2}${d3}${d4}${d5}0000${d6}`;
}

function checkFixedLength(format: BarcodeFormat, digits: string, length: number, name: string): BarcodeCheck {
  if (digits.length === length - 1) {
    const check = gtinCheckDigit(digits);
    return pass(format, `${digits}${check}`, `Check digit ${check} was added. The full code is ${digits}${check}.`);
  }
  if (digits.length !== length)
    return fail(format, `${name} needs ${length} digits (or ${length - 1} without the check digit). You typed ${digits.length}.`);
  const expected = gtinCheckDigit(digits.slice(0, -1));
  return Number(digits[length - 1]) === expected
    ? pass(format, digits)
    : fail(format, `The last digit should be ${expected}. Check the number against your till, or type the first ${length - 1} digits only.`);
}

/** Validates what was typed for the chosen format and completes a missing check digit. */
export function checkBarcode(format: BarcodeFormat, raw: string): BarcodeCheck {
  const value = (raw ?? "").trim();
  if (!value) return fail(format, "Type the code from your till.");
  if (format === "code-128") {
    if (value.length > 32) return fail(format, "Code 128 codes here can be up to 32 characters.");
    // Printable ASCII only (space to ~). Anything else cannot be encoded reliably.
    return /^[\x20-\x7e]+$/.test(value)
      ? pass(format, value)
      : fail(format, "Use plain letters, numbers and common symbols only.");
  }
  const digits = value.replace(/[\s-]/g, "");
  if (!/^\d+$/.test(digits)) return fail(format, "This format uses digits only. Choose Code 128 for letters.");
  if (format === "upc-a") return checkFixedLength(format, digits, 12, "UPC-A");
  if (format === "ean-13") return checkFixedLength(format, digits, 13, "EAN-13");
  if (format === "ean-8") return checkFixedLength(format, digits, 8, "EAN-8");
  // UPC-E: 6 digits (number system 0), 7 (number system + 6) or 8 (with check digit).
  if (digits.length < 6 || digits.length > 8)
    return fail(format, `UPC-E needs 6, 7 or 8 digits. You typed ${digits.length}.`);
  const numberSystem = digits.length === 6 ? "0" : digits[0];
  if (numberSystem !== "0" && numberSystem !== "1")
    return fail(format, "A UPC-E code starts with 0 or 1.");
  const six = digits.length === 6 ? digits : digits.slice(1, 7);
  const expected = gtinCheckDigit(expandUpcE(numberSystem, six));
  if (digits.length === 8 && Number(digits[7]) !== expected)
    return fail(format, `The last digit should be ${expected}. Check the number against your till.`);
  const code = `${numberSystem}${six}${expected}`;
  return digits.length === 8 ? pass(format, code) : pass(format, code, `The full code is ${code}.`);
}

const L = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
const invert = (bits: string) => bits.replace(/[01]/g, (bit) => (bit === "0" ? "1" : "0"));
const R = L.map(invert);
const G = R.map((bits) => bits.split("").reverse().join(""));
const EAN13_PARITY = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];
// UPC-E parity for number system 0, by check digit. Number system 1 swaps L and G.
const UPCE_PARITY = ["GGGLLL", "GGLGLL", "GGLLGL", "GGLLLG", "GLGGLL", "GLLGGL", "GLLLGG", "GLGLGL", "GLGLLG", "GLLGLG"];

// Code 128 symbol widths (bar, space, bar, space, bar, space), values 0 to 105.
const CODE128 = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232",
];
const CODE128_STOP = "2331112";
const START_B = 104;
const START_C = 105;

function widthsToBits(widths: string): string {
  let bits = "";
  for (let i = 0; i < widths.length; i++) bits += (i % 2 === 0 ? "1" : "0").repeat(Number(widths[i]));
  return bits;
}

/** Symbol values for a Code 128 barcode, including start and checksum. */
export function code128Values(text: string): number[] {
  // All digits and an even count: set C packs two digits per symbol.
  const useC = /^\d+$/.test(text) && text.length % 2 === 0;
  const values = [useC ? START_C : START_B];
  if (useC) for (let i = 0; i < text.length; i += 2) values.push(Number(text.slice(i, i + 2)));
  else for (const char of text) values.push(char.charCodeAt(0) - 32);
  const checksum = values.reduce((sum, value, index) => sum + value * (index === 0 ? 1 : index), 0) % 103;
  return [...values, checksum];
}

/** Bars as a string of modules: "1" is a bar, "0" is a space. `code` must come from checkBarcode. */
export function barcodeBits(format: BarcodeFormat, code: string): string {
  switch (format) {
    case "upc-a":
      return `101${code.slice(0, 6).split("").map((d) => L[Number(d)]).join("")}01010${code.slice(6).split("").map((d) => R[Number(d)]).join("")}101`;
    case "ean-13": {
      const parity = EAN13_PARITY[Number(code[0])];
      const left = code.slice(1, 7).split("").map((d, i) => (parity[i] === "L" ? L : G)[Number(d)]).join("");
      return `101${left}01010${code.slice(7).split("").map((d) => R[Number(d)]).join("")}101`;
    }
    case "ean-8":
      return `101${code.slice(0, 4).split("").map((d) => L[Number(d)]).join("")}01010${code.slice(4).split("").map((d) => R[Number(d)]).join("")}101`;
    case "upc-e": {
      const base = UPCE_PARITY[Number(code[7])];
      const parity = code[0] === "1" ? base.replace(/[LG]/g, (p) => (p === "L" ? "G" : "L")) : base;
      return `101${code.slice(1, 7).split("").map((d, i) => (parity[i] === "L" ? L : G)[Number(d)]).join("")}010101`;
    }
    case "code-128":
      return code128Values(code).map((value) => widthsToBits(CODE128[value])).join("") + widthsToBits(CODE128_STOP);
  }
}

const FORMAT_NAMES: Record<BarcodeFormat, string> = {
  "upc-a": "UPC-A",
  "upc-e": "UPC-E",
  "ean-13": "EAN-13",
  "ean-8": "EAN-8",
  "code-128": "Code 128",
};
export const barcodeFormatName = (format: BarcodeFormat) => FORMAT_NAMES[format];

/** The format saved on a coupon. Coupons made before formats existed are UPC-A. */
export function couponBarcodeFormat(value: unknown): BarcodeFormat {
  return value === "upc-e" || value === "ean-13" || value === "ean-8" || value === "code-128" ? value : "upc-a";
}

/** Raster output for email clients. */
export async function barcodeImage(format: BarcodeFormat, raw: string): Promise<File> {
  const checked = checkBarcode(format, raw);
  if (!checked.ok) throw new Error(checked.message);
  const bits = barcodeBits(format, checked.code);
  const canvas = document.createElement("canvas");
  // Keep the picture a sensible width: long Code 128 codes use thinner bars.
  const scale = bits.length > 160 ? 3 : 4;
  const quiet = 10;
  canvas.width = (bits.length + quiet * 2) * scale;
  canvas.height = 160 * 2;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Barcode rendering is not available in this browser.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#000000";
  for (let i = 0; i < bits.length; i++)
    if (bits[i] === "1") ctx.fillRect((i + quiet) * scale, 20, scale, 245);
  ctx.font = "24px monospace";
  ctx.textAlign = "center";
  ctx.fillText(checked.code, canvas.width / 2, 297);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error("Could not create barcode image."))),
      "image/png",
    ),
  );
  return new File([blob], `coupon-${checked.code.replace(/[^\w-]+/g, "_")}.png`, { type: "image/png" });
}

/** Kept for existing callers. */
export function upcABits(code: string): string {
  const checked = checkBarcode("upc-a", code);
  if (!checked.ok || code.replace(/[\s-]/g, "").length !== 12)
    throw new Error("Enter a valid 12-digit UPC-A including its check digit.");
  return barcodeBits("upc-a", checked.code);
}
export const upcAImage = (code: string) => barcodeImage("upc-a", code);
