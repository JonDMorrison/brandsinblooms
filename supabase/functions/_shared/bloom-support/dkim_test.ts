import { assert, assertEquals } from "@std/assert";
import { alignedWith, type KeyResolver, verifiedDkimDomains } from "./dkim.ts";

// Real message: the website contact form relaying an internal verification
// request to Bloom (our own test content), as delivered by the receiving
// provider, with the DNS key brandsinblooms.com publishes for Resend.
const RELAY_RAW = atob((await Deno.readTextFile(new URL("./testdata/contact-relay.eml.b64", import.meta.url))).replace(/\s+/g, ""));
const BRANDSINBLOOMS_KEY = "p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDZlY2O4Mpce2nhosCZpdNTB/cO+6KT6/h+GiUqeCnp6kWUgAp1kVHzl+2uvpAmooR0/xkSMcbvPHpXeMLeP8e8FKTugKTIrtzZmi/M6FfYMSiv6eJT17oyG9lsXUJBakc1A4aplB3/TQ1WuLiK7ppQ0P2Im1DzojoJVyg/ntJxdwIDAQAB";
const realKeys: KeyResolver = (selector, domain) => Promise.resolve(selector === "resend" && domain === "brandsinblooms.com" ? BRANDSINBLOOMS_KEY : null);

Deno.test("verifies the real contact-form relay signature", async () => {
  const domains = await verifiedDkimDomains(RELAY_RAW, realKeys);
  assertEquals(domains, ["brandsinblooms.com"]);
  assert(alignedWith("brandsinblooms.com", domains));
});

Deno.test("a changed body or From line breaks the signature", async () => {
  const body = RELAY_RAW.replace("From: support-check@support.=", "From: victim@example.org=");
  assertEquals(await verifiedDkimDomains(body, realKeys), [], "edited forwarded sender");
  const from = RELAY_RAW.replace("From: BloomSuite Contact <support@brandsinblooms.com>", "From: BloomSuite Contact <support@brandsinbIooms.com>");
  assertEquals(await verifiedDkimDomains(from, realKeys), [], "edited From header");
});

Deno.test("a sender-written Authentication-Results header proves nothing", async () => {
  const forged = "Authentication-Results: mx.resend.com; dkim=pass header.d=brandsinblooms.com; spf=pass smtp.mailfrom=brandsinblooms.com\r\n" +
    "From: BloomSuite Contact <support@brandsinblooms.com>\r\nTo: bloom@support.bloomsuite.app\r\nSubject: hi\r\n\r\n---------- Forwarded message ---------\r\nFrom: victim@example.org\r\n\r\nhello\r\n";
  assertEquals(await verifiedDkimDomains(forged, realKeys), []);
});

// Synthetic signer so tampering and policy cases are exercised with a key we hold.
async function signed(from: string, body: string, opts: { d?: string; h?: string; l?: boolean } = {}) {
  const pair = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 1024, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const spki = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.exportKey("spki", pair.publicKey))));
  const d = opts.d ?? "example.test";
  const canonBody = body.replace(/(\r\n)*$/, "") + "\r\n";
  const bh = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonBody)))));
  const h = opts.h ?? "from:subject";
  const sigNoB = `v=1; a=rsa-sha256; c=relaxed/simple; d=${d}; s=sel; h=${h};${opts.l ? " l=5;" : ""} bh=${bh}; b=`;
  const headers: Record<string, string> = { from: `From: ${from}`, subject: "Subject: Test" };
  const data = h.split(":").map((n) => `${n}:${headers[n].slice(headers[n].indexOf(":") + 1).trim()}\r\n`).join("") + `dkim-signature:${sigNoB}`;
  const b = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", pair.privateKey, new TextEncoder().encode(data)))));
  const raw = `DKIM-Signature: ${sigNoB}${b}\r\n${headers.from}\r\n${headers.subject}\r\n\r\n${body}`;
  const resolve: KeyResolver = (s, dom) => Promise.resolve(s === "sel" && dom === d ? `v=DKIM1; k=rsa; p=${spki}` : null);
  return { raw, resolve };
}

async function signedBinary(body: string) {
  const pair = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 1024, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const spki = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.exportKey("spki", pair.publicKey))));
  const bin = (t: string) => Uint8Array.from(t, (c) => c.charCodeAt(0) & 0xff);
  const bh = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest("SHA-256", bin(body + "\r\n")))));
  const sigNoB = `v=1; a=rsa-sha256; c=relaxed/simple; d=example.test; s=sel; h=from; bh=${bh}; b=`;
  const b = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", pair.privateKey, bin(`from:a@example.test\r\ndkim-signature:${sigNoB}`)))));
  const raw = `DKIM-Signature: ${sigNoB}${b}\r\nFrom: a@example.test\r\n\r\n${body}\r\n`;
  const resolve: KeyResolver = (s, d) => Promise.resolve(s === "sel" && d === "example.test" ? `p=${spki}` : null);
  return { raw, resolve };
}

Deno.test("synthetic signatures: valid, appended body, missing From, l= tag", async () => {
  const ok = await signed("Staff <jeff@example.test>", "Forwarding this\r\n");
  assertEquals(await verifiedDkimDomains(ok.raw, ok.resolve), ["example.test"]);
  assertEquals(await verifiedDkimDomains(ok.raw + "extra line\r\n", ok.resolve), [], "content appended after signing");
  const noFrom = await signed("Staff <jeff@example.test>", "x\r\n", { h: "subject" });
  assertEquals(await verifiedDkimDomains(noFrom.raw, noFrom.resolve), [], "From must be signed");
  const withL = await signed("Staff <jeff@example.test>", "x\r\n", { l: true });
  assertEquals(await verifiedDkimDomains(withL.raw, withL.resolve), [], "l= refused");
});

Deno.test("8-bit body bytes are hashed exactly as received", async () => {
  // "café" in UTF-8 is 63 61 66 C3 A9; as a latin1 binary string that is 5 chars.
  const utf8 = String.fromCharCode(0x63, 0x61, 0x66, 0xc3, 0xa9);
  const ok = await signedBinary(utf8);
  assertEquals(await verifiedDkimDomains(ok.raw, ok.resolve), ["example.test"]);
});

Deno.test("alignment: same domain or parent/child only", () => {
  assert(alignedWith("brandsinblooms.com", ["brandsinblooms.com"]));
  assert(alignedWith("mail.brandsinblooms.com", ["brandsinblooms.com"]));
  assert(!alignedWith("brandsinblooms.com", ["amazonses.com"]));
  assert(!alignedWith("brandsinblooms.com", ["evilbrandsinblooms.com"]));
});
