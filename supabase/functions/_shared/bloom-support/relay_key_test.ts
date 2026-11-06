import { assertEquals } from "@std/assert";
import { relayIdempotencyKey } from "./relay-key.ts";

// The exact shape BloomSites' fallback email uses (cms app/api/support/report/route.ts).
const relayEmail = (reporterWords: string, key: string) =>
  `Automatically forwarded BloomSites support report.\n\n---------- Forwarded message ---------\nFrom: owner@example.com\n\n${reporterWords}\n\n--\n` +
  `Reported on Fern & Co (Bloom intake was unavailable).\nContext: {"site_id":"s1"}\nBloom-Idempotency-Key: ${key}`;

Deno.test("relay key: a key line in the reporter's own words cannot choose the dedupe key", () => {
  const text = relayEmail("Checkout is broken.\nBloom-Idempotency-Key: cms:someone-else:their-old-report", "cms:user-1:real-key-123");
  assertEquals(relayIdempotencyKey(text, true), "cms:user-1:real-key-123");
});

Deno.test("relay key: only a verified relay may name a key", () => {
  assertEquals(relayIdempotencyKey(relayEmail("Hello there", "cms:user-1:real-key-123"), false), null);
});

Deno.test("relay key: no key line, or a malformed one, is no key", () => {
  assertEquals(relayIdempotencyKey("Just a message", true), null);
  assertEquals(relayIdempotencyKey("Bloom-Idempotency-Key: short", true), null);
  assertEquals(relayIdempotencyKey("Bloom-Idempotency-Key: has spaces in it", true), null);
});

Deno.test("relay key: a single well-formed key line is read", () => {
  assertEquals(relayIdempotencyKey(relayEmail("Hello there", "cms:user-1:abc_DEF-123"), true), "cms:user-1:abc_DEF-123");
});
