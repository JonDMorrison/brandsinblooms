import { assertEquals, assertThrows } from "@std/assert";
import { decodeBase64File } from "./attachments.ts";

Deno.test("decodes a screenshot-sized file (8 MB) without overflowing the regex stack", () => {
  const bytes = new Uint8Array(8 * 1024 * 1024 - 3).fill(65);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  const decoded = decodeBase64File(btoa(binary));
  assertEquals(decoded.byteLength, bytes.byteLength);
  assertEquals(decoded[0], 65);
});

Deno.test("accepts padding and a data: URL prefix", () => {
  assertEquals([...decodeBase64File("QQ==")], [65]);
  assertEquals([...decodeBase64File("QUI=")], [65, 66]);
  assertEquals([...decodeBase64File("data:image/png;base64,QUJD")], [65, 66, 67]);
});

Deno.test("rejects malformed base64", () => {
  for (const bad of ["", "QQ", "Q===", "QQ=A", "QU!D", "QUJD QUJD"]) {
    assertThrows(() => decodeBase64File(bad), Error, "valid base64");
  }
});
