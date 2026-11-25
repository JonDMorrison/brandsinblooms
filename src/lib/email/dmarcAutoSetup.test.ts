import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_DMARC_VALUE,
  interpretDmarcResponse,
  lookupDmarc,
  withDmarcIfMissing,
} from "./dmarcAutoSetup";
import { validateCanonicalRecords } from "./dnsRecordSanitizer";

const providerRecords = [
  { type: "TXT", host: "resend._domainkey", value: "p=KEY", ttl: 3600 },
  { type: "TXT", host: "send", value: "v=spf1 include:amazonses.com ~all", ttl: 3600 },
  { type: "MX", host: "send", value: "feedback-smtp.us-east-1.amazonses.com", ttl: 3600, priority: 10 },
];

function dohFetch(reply: unknown, ok = true) {
  return vi.fn(async () => new Response(JSON.stringify(reply), { status: ok ? 200 : 500 })) as unknown as typeof fetch;
}

describe("DMARC auto-setup", () => {
  it("reads NXDOMAIN and empty answers as missing", () => {
    expect(interpretDmarcResponse({ Status: 3 }).state).toBe("missing");
    expect(interpretDmarcResponse({ Status: 0, Answer: [] }).state).toBe("missing");
  });

  it("treats any answer at _dmarc as present, including a CNAME", () => {
    expect(interpretDmarcResponse({ Status: 0, Answer: [{ type: 5, data: "dmarc.vendor.example." }] }).state).toBe("present");
    expect(interpretDmarcResponse({ Status: 0, Answer: [{ type: 16, data: '"v=DMARC1; p=reject;"' }] })).toEqual({
      state: "present",
      values: ["v=DMARC1; p=reject;"],
    });
  });

  it("adds the default record when the domain has none", async () => {
    const result = await withDmarcIfMissing("example.com", providerRecords, dohFetch({ Status: 3 }));
    expect(result.added).toBe(true);
    expect(result.records).toHaveLength(4);
    expect(result.records.at(-1)).toMatchObject({ type: "TXT", host: "_dmarc", value: DEFAULT_DMARC_VALUE });
  });

  it("never touches an existing DMARC record", async () => {
    const result = await withDmarcIfMissing(
      "example.com",
      providerRecords,
      dohFetch({ Status: 0, Answer: [{ type: 16, data: '"v=DMARC1; p=quarantine;"' }] }),
    );
    expect(result.added).toBe(false);
    expect(result.records).toBe(providerRecords);
  });

  it("adds nothing when the lookup cannot prove the record is absent", async () => {
    const failing = vi.fn(async () => {
      throw new Error("network");
    }) as unknown as typeof fetch;
    const result = await withDmarcIfMissing("example.com", providerRecords, failing);
    expect(result).toMatchObject({ added: false, lookup: { state: "unknown" } });
    expect((await lookupDmarc("example.com", dohFetch({ Status: 2 }))).state).toBe("unknown");
  });

  it("keeps provider records valid; DMARC is added after validation", async () => {
    expect(validateCanonicalRecords(providerRecords as never).valid).toBe(true);
    const result = await withDmarcIfMissing("example.com", providerRecords, dohFetch({ Status: 3 }));
    expect(result.records.filter((record) => record.host === "_dmarc")).toHaveLength(1);
  });
});
