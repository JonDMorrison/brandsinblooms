import { validUpcA } from "./renderExtensions.ts";
const LEFT = [
  "0001101",
  "0011001",
  "0010011",
  "0111101",
  "0100011",
  "0110001",
  "0101111",
  "0111011",
  "0110111",
  "0001011",
];
export function upcABits(code: string): string {
  if (!validUpcA(code))
    throw new Error("Enter a valid 12-digit UPC-A including its check digit.");
  const right = (digit: string) =>
    LEFT[Number(digit)]
      .split("")
      .map((bit) => (bit === "0" ? "1" : "0"))
      .join("");
  return (
    "101" +
    code
      .slice(0, 6)
      .split("")
      .map((digit) => LEFT[Number(digit)])
      .join("") +
    "01010" +
    code.slice(6).split("").map(right).join("") +
    "101"
  );
}
/** Raster output for email clients; no externally hosted barcode service receives the code. */
export async function upcAImage(code: string): Promise<File> {
  const bits = upcABits(code);
  const canvas = document.createElement("canvas");
  const scale = 4;
  const quiet = 10;
  canvas.width = (95 + quiet * 2) * scale;
  canvas.height = 160 * 2;
  const ctx = canvas.getContext("2d");
  if (!ctx)
    throw new Error("Barcode rendering is not available in this browser.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#000000";
  for (let i = 0; i < bits.length; i++)
    if (bits[i] === "1") ctx.fillRect((i + quiet) * scale, 20, scale, 245);
  ctx.font = "24px monospace";
  ctx.textAlign = "center";
  ctx.fillText(code, canvas.width / 2, 297);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (result) =>
        result
          ? resolve(result)
          : reject(new Error("Could not create barcode image.")),
      "image/png",
    ),
  );
  return new File([blob], `coupon-${code}.png`, { type: "image/png" });
}
