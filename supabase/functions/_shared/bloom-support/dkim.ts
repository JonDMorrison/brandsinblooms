// DKIM verification (RFC 6376) for inbound support email.
//
// The receiving provider adds no Authentication-Results header, so any such
// header on a received message was written by the sender and proves nothing.
// Bloom therefore verifies DKIM itself, over the raw message, with the public
// key the signing domain publishes in DNS. Only rsa-sha256 is accepted, the
// signature must cover From, and a body-length limit (l=) is refused because
// it lets content be appended after signing.

// Messages are handled as binary strings (one char per byte, as decoded with latin1), so the
// hashes below cover exactly the bytes that were signed, including 8-bit content.
function bytes(text: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(text.length));
  for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i) & 0xff;
  return out;
}

export type KeyResolver = (selector: string, domain: string) => Promise<string | null>;

/** DNS TXT lookup over HTTPS (works in the Edge runtime without raw DNS). */
export const dnsKeyResolver: KeyResolver = async (selector, domain) => {
  const name = `${selector}._domainkey.${domain}`;
  const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=TXT`, {
    headers: { accept: "application/dns-json" }, signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) return null;
  const body = await res.json() as { Status?: number; Answer?: Array<{ type: number; data: string }> };
  if (body.Status !== 0) return null;
  const txt = (body.Answer ?? []).filter((a) => a.type === 16)
    .map((a) => a.data.replace(/^"|"$/g, "").replace(/"\s*"/g, "")).find((t) => /(^|;)\s*p=/.test(t));
  return txt ?? null;
};

interface Header { name: string; raw: string }

function splitMessage(raw: string): { headers: Header[]; body: string } {
  const msg = raw.replace(/\r?\n/g, "\r\n");
  const at = msg.indexOf("\r\n\r\n");
  const head = at < 0 ? msg : msg.slice(0, at + 2);
  const body = at < 0 ? "" : msg.slice(at + 4);
  const headers: Header[] = [];
  for (const line of head.split(/\r\n(?![ \t])/)) {
    if (!line) continue;
    const colon = line.indexOf(":");
    if (colon <= 0) continue;
    headers.push({ name: line.slice(0, colon).trim().toLowerCase(), raw: line.replace(/\r\n$/, "") });
  }
  return { headers, body };
}

function tags(value: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of value.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = part.slice(i + 1).replace(/\s+/g, " ").trim();
  }
  return out;
}

function canonBody(body: string, relaxed: boolean): string {
  let b = body;
  if (relaxed) b = b.split("\r\n").map((l) => l.replace(/[ \t]+/g, " ").replace(/ +$/, "")).join("\r\n");
  b = b.replace(/(\r\n)*$/, "");
  return b.length || !relaxed ? b + "\r\n" : "";
}

function canonHeader(h: Header, relaxed: boolean): string {
  if (!relaxed) return h.raw;
  const colon = h.raw.indexOf(":");
  const value = h.raw.slice(colon + 1).replace(/\r\n/g, "").replace(/[ \t]+/g, " ").trim();
  return `${h.name}:${value}`;
}

async function sha256b64(text: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes(text)));
  return btoa(String.fromCharCode(...digest));
}

function b64bytes(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64.replace(/\s+/g, ""));
  const out = new Uint8Array(new ArrayBuffer(s.length));
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/**
 * Returns the domains (d=) whose DKIM signatures verify over this exact raw
 * message. A message with no valid signature returns an empty list.
 */
export async function verifiedDkimDomains(raw: string, /* binary string: one char per byte */ resolve: KeyResolver = dnsKeyResolver): Promise<string[]> {
  const { headers, body } = splitMessage(raw);
  const out: string[] = [];
  // RFC 5322 allows exactly one From. With two, a reader could use the unsigned one while the
  // signature covers the other, so such a message is never treated as authenticated.
  if (headers.filter((h) => h.name === "from").length !== 1) return out;
  const sigs = headers.filter((h) => h.name === "dkim-signature").slice(0, 5);
  for (const sig of sigs) {
    try {
      const t = tags(sig.raw.slice(sig.raw.indexOf(":") + 1));
      if (t.v !== "1" || t.a !== "rsa-sha256" || !t.d || !t.s || !t.h || !t.bh || !t.b || t.l !== undefined) continue;
      const signed = t.h.split(":").map((x) => x.trim().toLowerCase());
      if (!signed.includes("from")) continue;
      if (t.x && Number(t.x) < Date.now() / 1000) continue;
      const [hc, bc] = (t.c ?? "simple/simple").split("/");
      const bodyHash = await sha256b64(canonBody(body, (bc ?? "simple") === "relaxed"));
      if (bodyHash !== t.bh.replace(/\s+/g, "")) continue;
      const relaxedHeaders = hc === "relaxed";
      // Each listed header name consumes the next occurrence from the bottom.
      const used = new Map<string, number>();
      const lines: string[] = [];
      for (const name of signed) {
        const all = headers.filter((h) => h.name === name && h !== sig);
        const n = used.get(name) ?? 0;
        used.set(name, n + 1);
        const h = all[all.length - 1 - n];
        if (h) lines.push(canonHeader(h, relaxedHeaders) + "\r\n");
      }
      const unsignedSig = { name: sig.name, raw: sig.raw.replace(/(\bb=)[^;]*/, "$1") };
      const data = lines.join("") + canonHeader(unsignedSig, relaxedHeaders);
      const record = await resolve(t.s, t.d.toLowerCase());
      if (!record) continue;
      const k = tags(record);
      if (!k.p || (k.k && k.k !== "rsa")) continue;
      const key = await crypto.subtle.importKey("spki", b64bytes(k.p), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
      if (await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64bytes(t.b), bytes(data))) out.push(t.d.toLowerCase());
    } catch {
      // A malformed signature is simply not a valid one.
    }
  }
  return out;
}

/** Bytes to a binary string (one char per byte). Unlike TextDecoder("latin1"), which is really
 * windows-1252, this never remaps 0x80-0x9F, so signed bytes hash exactly as received. */
export function binaryString(buf: ArrayBuffer): string {
  const view = new Uint8Array(buf);
  let out = "";
  for (let i = 0; i < view.length; i += 8192) out += String.fromCharCode(...view.subarray(i, i + 8192));
  return out;
}

/** The address in the message's single From header, or null when there is not exactly one. */
export function rawFromAddress(raw: string): string | null {
  const froms = splitMessage(raw).headers.filter((h) => h.name === "from");
  if (froms.length !== 1) return null;
  const value = froms[0].raw.slice(froms[0].raw.indexOf(":") + 1).replace(/\r\n/g, "");
  const m = value.match(/<\s*([^<>\s]+@[^<>\s]+)\s*>/) ?? value.match(/([^\s<>"(),;:]+@[^\s<>"(),;:]+)/);
  return m ? m[1].toLowerCase() : null;
}

/** True when a verified DKIM domain is aligned with the From domain (same domain or parent/child). */
export function alignedWith(fromDomain: string, dkimDomains: string[]): boolean {
  const f = fromDomain.toLowerCase();
  return !!f && dkimDomains.some((d) => d === f || f.endsWith("." + d) || d.endsWith("." + f));
}
