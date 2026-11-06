// The product idempotency key in a relayed fallback email.
//
// When BloomSites (or another product) cannot reach Bloom intake, it relays the
// report by email from a dedicated, DKIM-verified relay address. The relay
// writes the key it already used with Bloom as the email's LAST line:
//
//   …the reporter's own words…
//   --
//   Context: {…}
//   Bloom-Idempotency-Key: cms:<user>:<key>
//
// The reporter's words come first and are untrusted: they can contain a line
// that looks like a key. Honouring the first match would let a reporter choose
// the key, so their report is filed as a "duplicate" of another request and
// dropped. Only the last key line is the relay's own, and only a verified relay
// may name a key at all.
const KEY_LINE = /^Bloom-Idempotency-Key:[ \t]*([A-Za-z0-9:_-]{8,200})[ \t]*$/gm;

export function relayIdempotencyKey(text: string, trustedRelay: boolean): string | null {
  if (!trustedRelay) return null;
  let key: string | null = null;
  for (const match of text.matchAll(KEY_LINE)) key = match[1];
  return key;
}
