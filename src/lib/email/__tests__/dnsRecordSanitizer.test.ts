import { describe, expect, it } from "vitest";

import {
  type DnsRecord,
  prepareRecordsForEntri,
  sanitizeDnsRecords,
  validateCanonicalRecords,
} from "../dnsRecordSanitizer";

describe("dnsRecordSanitizer", () => {
  const domain = "example.com";
  const currentResendRecords: DnsRecord[] = [
    {
      type: "TXT",
      host: "resend._domainkey",
      value: "p=MIIB...",
      ttl: 3600,
    },
    {
      type: "MX",
      host: "send",
      value: "feedback-smtp.us-east-1.amazonses.com",
      priority: 10,
      ttl: 3600,
    },
    {
      type: "TXT",
      host: "send",
      value: "v=spf1 include:amazonses.com ~all",
      ttl: 3600,
    },
  ];

  describe("sanitizeDnsRecords", () => {
    it("preserves provider-generated TXT DKIM, MX priority, and SPF", () => {
      const result = sanitizeDnsRecords(currentResendRecords, domain);

      expect(result.records).toEqual(currentResendRecords);
      expect(result.dropped).toEqual([]);
    });

    it("preserves provider-generated CNAME DKIM", () => {
      const records: DnsRecord[] = [
        {
          type: "CNAME",
          host: "selector._domainkey",
          value: "selector.provider.example",
        },
        ...currentResendRecords.slice(1),
      ];

      expect(sanitizeDnsRecords(records, domain).records).toEqual(records);
    });

    it("normalizes FQDN hosts to relative labels", () => {
      const records = currentResendRecords.map((record) => ({
        ...record,
        host: `${record.host}.${domain}.`,
      }));

      expect(sanitizeDnsRecords(records, domain).records).toEqual(
        currentResendRecords,
      );
    });

    it("excludes DMARC and root-domain records from automatic setup", () => {
      const protectedRecords: DnsRecord[] = [
        {
          type: "TXT",
          host: "_dmarc.example.com",
          value: "v=DMARC1; p=quarantine",
        },
        {
          type: "TXT",
          host: "example.com",
          value: "v=spf1 include:legacy.example ~all",
        },
      ];

      const result = sanitizeDnsRecords(
        [...currentResendRecords, ...protectedRecords],
        domain,
      );

      expect(result.records).toEqual(currentResendRecords);
      expect(result.dropped).toHaveLength(2);
      expect(result.warnings).toEqual(
        expect.arrayContaining([
          expect.stringContaining("DMARC records excluded"),
          expect.stringContaining("Root-domain records excluded"),
        ]),
      );
    });

    it("drops only exact duplicate records", () => {
      const duplicate = { ...currentResendRecords[2] };
      const result = sanitizeDnsRecords(
        [...currentResendRecords, duplicate],
        domain,
      );

      expect(result.records).toEqual(currentResendRecords);
      expect(result.dropped).toEqual([duplicate]);
    });
  });

  describe("validateCanonicalRecords", () => {
    it("accepts the provider's current TXT DKIM + aligned SPF/MX model", () => {
      const result = validateCanonicalRecords(currentResendRecords);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.details).toMatchObject({
        hasDkim: true,
        dkimType: "TXT",
        hasSpf: true,
        hasMx: true,
        mxHasPriority: true,
      });
      expect(result.warnings).toContain(
        "No DMARC record found. Configure DMARC manually for email policy enforcement.",
      );
    });

    it.each([
      ["DKIM", currentResendRecords.slice(1), "Missing DKIM record"],
      [
        "SPF",
        currentResendRecords.filter((record) => !record.value.includes("spf1")),
        "Missing SPF record",
      ],
      [
        "MX",
        currentResendRecords.filter((record) => record.type !== "MX"),
        "Missing MX record",
      ],
    ])("rejects a missing %s record", (_label, records, message) => {
      const result = validateCanonicalRecords(records as DnsRecord[]);

      expect(result.valid).toBe(false);
      expect(result.errors.some((error) => error.includes(message))).toBe(true);
    });

    it("rejects an MX record without a priority instead of inventing one", () => {
      const records = currentResendRecords.map((record) =>
        record.type === "MX" ? { ...record, priority: undefined } : record,
      );

      expect(validateCanonicalRecords(records).errors).toContain(
        "MX record missing priority (required for DNS)",
      );
    });

    it("rejects SPF and MX records on different envelope subdomains", () => {
      const records = currentResendRecords.map((record) =>
        record.type === "TXT" && record.value.includes("spf1")
          ? { ...record, host: "mail" }
          : record,
      );

      expect(validateCanonicalRecords(records).errors).toContain(
        "SPF and MX records must use the same envelope subdomain for bounce handling.",
      );
    });

    it("rejects multiple SPF records on one host", () => {
      const records = [
        ...currentResendRecords,
        {
          type: "TXT" as const,
          host: "send",
          value: "v=spf1 include:other.example ~all",
        },
      ];

      expect(
        validateCanonicalRecords(records).errors.some((error) =>
          error.includes("Multiple SPF records"),
        ),
      ).toBe(true);
    });

    it("rejects a CNAME that coexists with another record at one host", () => {
      const records = [
        ...currentResendRecords,
        {
          type: "CNAME" as const,
          host: "send",
          value: "send.provider.example",
        },
      ];

      expect(
        validateCanonicalRecords(records).errors.some((error) =>
          error.includes('Conflicting DNS records at "send"'),
        ),
      ).toBe(true);
    });
  });

  describe("prepareRecordsForEntri", () => {
    it("converts provider records without changing their authentication data", () => {
      const backendRecords = currentResendRecords.map((record) => ({
        name: `${record.host}.${domain}`,
        type: record.type,
        value: record.value,
        priority: record.priority,
      }));

      const result = prepareRecordsForEntri(domain, backendRecords);

      expect(result.records).toEqual(currentResendRecords);
      expect(result.validation.valid).toBe(true);
    });

    it("blocks incomplete backend data", () => {
      const result = prepareRecordsForEntri(domain, [
        {
          name: `send.${domain}`,
          type: "TXT",
          value: "v=spf1 include:amazonses.com ~all",
        },
      ]);

      expect(result.validation.valid).toBe(false);
      expect(result.validation.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining("Missing DKIM"),
          expect.stringContaining("Missing MX"),
        ]),
      );
    });
  });
});
