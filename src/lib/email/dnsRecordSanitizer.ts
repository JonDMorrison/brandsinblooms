/**
 * DNS Record Sanitizer for Resend Email Domains
 *
 * Preserves the exact sending records returned by Resend while enforcing the
 * safety rules required for automatic DNS setup:
 * - DKIM: TXT or CNAME, exactly as returned by the provider
 * - SPF: TXT on the envelope subdomain
 * - MX: on the same envelope subdomain, with an explicit priority
 * - DMARC and root-domain records: never changed automatically
 *
 * CRITICAL: Does NOT add synthetic CNAME for return-path
 * Resend uses MX + SPF TXT on 'send' subdomain, not CNAME
 */

export interface DnsRecord {
  type: "TXT" | "CNAME" | "MX" | "A" | "AAAA";
  host: string;
  value: string;
  ttl?: number;
  priority?: number; // Required for MX records
  purpose?: string;
}

export interface SanitizationResult {
  records: DnsRecord[];
  dropped: DnsRecord[];
  warnings: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  details: {
    hasDkim: boolean;
    dkimType: "CNAME" | "TXT" | null;
    hasSpf: boolean;
    spfCount: number;
    hasMx: boolean;
    mxHasPriority: boolean;
    hasDmarc: boolean;
  };
}

/**
 * Normalize host from FQDN to relative host label.
 * e.g., "send.example.com" -> "send" when domain is "example.com"
 */
function normalizeHost(host: string, domain: string): string {
  const lowerHost = host.toLowerCase();
  const lowerDomain = domain.toLowerCase();

  // Remove trailing dot if present
  const cleanHost = lowerHost.replace(/\.$/, "");
  const cleanDomain = lowerDomain.replace(/\.$/, "");

  // If host equals domain, return @
  if (cleanHost === cleanDomain) {
    return "@";
  }

  // If host ends with .domain, strip it
  const suffix = `.${cleanDomain}`;
  if (cleanHost.endsWith(suffix)) {
    return cleanHost.slice(0, -suffix.length);
  }

  return cleanHost;
}

/**
 * Prepare provider records for automatic setup without inventing or silently
 * changing authentication data. Invalid/conflicting records are preserved so
 * validation can block the operation with an actionable error.
 */
export function sanitizeDnsRecords(
  records: DnsRecord[],
  domain: string,
): SanitizationResult {
  const dropped: DnsRecord[] = [];
  const warnings: string[] = [];
  const sanitized: DnsRecord[] = [];
  const seen = new Set<string>();
  let excludedDmarc = 0;
  let excludedRoot = 0;

  for (const record of records) {
    const normalizedHost = normalizeHost(record.host, domain);
    const normalizedRecord: DnsRecord = {
      ...record,
      host: normalizedHost,
      value: record.value.trim(),
    };
    const isDmarc =
      normalizedHost === "_dmarc" ||
      normalizedRecord.value.toUpperCase().startsWith("V=DMARC1");

    if (isDmarc) {
      dropped.push(normalizedRecord);
      excludedDmarc += 1;
      continue;
    }

    if (normalizedHost === "@" || normalizedHost === "") {
      dropped.push(normalizedRecord);
      excludedRoot += 1;
      continue;
    }

    const identity = [
      normalizedRecord.type,
      normalizedRecord.host,
      normalizedRecord.value,
      normalizedRecord.priority ?? "",
    ].join("|");
    if (seen.has(identity)) {
      dropped.push(normalizedRecord);
      continue;
    }

    seen.add(identity);
    sanitized.push(normalizedRecord);
  }

  if (excludedDmarc > 0) {
    warnings.push(
      `DMARC records excluded from auto-setup (${excludedDmarc} record(s)). Configure them manually.`,
    );
  }
  if (excludedRoot > 0) {
    warnings.push(
      `Root-domain records excluded from auto-setup (${excludedRoot} record(s)). Configure them manually.`,
    );
  }

  return { records: sanitized, dropped, warnings };
}

/**
 * Strictly validate DNS records before sending to Entri.
 * Blocks if required records are missing or conflicting.
 */
export function validateCanonicalRecords(
  records: DnsRecord[],
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Find DKIM records
  const dkimRecords = records.filter(
    (r) =>
      (r.type === "CNAME" || r.type === "TXT") &&
      (r.host.toLowerCase().includes("domainkey") ||
        r.host.toLowerCase().includes("dkim")),
  );
  const dkimCnames = dkimRecords.filter((r) => r.type === "CNAME");
  const dkimTxts = dkimRecords.filter((r) => r.type === "TXT");

  const hasDkim = dkimRecords.length > 0;
  const dkimType =
    dkimCnames.length > 0 ? "CNAME" : dkimTxts.length > 0 ? "TXT" : null;

  if (!hasDkim) {
    errors.push("Missing DKIM record (required for email signing)");
  }

  const recordsByHost = new Map<string, DnsRecord[]>();
  for (const record of records) {
    const host = record.host.toLowerCase();
    recordsByHost.set(host, [...(recordsByHost.get(host) ?? []), record]);
  }
  for (const [host, hostRecords] of recordsByHost) {
    if (
      hostRecords.some((record) => record.type === "CNAME") &&
      hostRecords.some((record) => record.type !== "CNAME")
    ) {
      errors.push(
        `Conflicting DNS records at "${host}": CNAME cannot coexist with other record types.`,
      );
    }
  }

  // Find MX records
  const mxRecords = records.filter((r) => r.type === "MX");
  const hasMx = mxRecords.length > 0;
  const mxHasPriority = mxRecords.every(
    (r) => r.priority !== undefined && r.priority !== null,
  );

  if (!hasMx) {
    errors.push("Missing MX record (required for bounce handling)");
  } else if (!mxHasPriority) {
    errors.push("MX record missing priority (required for DNS)");
  }

  // Find SPF records (TXT with spf in value)
  const spfRecords = records.filter(
    (r) =>
      r.type === "TXT" &&
      r.value.trim().toLowerCase().startsWith("v=spf1"),
  );
  const hasSpf = spfRecords.length > 0;

  if (!hasSpf) {
    errors.push("Missing SPF record (required for sender verification)");
  }

  for (const [host, hostRecords] of recordsByHost) {
    const spfCount = hostRecords.filter(
      (record) =>
        record.type === "TXT" &&
        record.value.trim().toLowerCase().startsWith("v=spf1"),
    ).length;
    if (spfCount > 1) {
      errors.push(
        `Multiple SPF records found at "${host}". Publish one SPF record per host.`,
      );
    }
  }

  if (hasMx && hasSpf) {
    const mxHosts = new Set(mxRecords.map((record) => record.host.toLowerCase()));
    const hasAlignedEnvelopeDomain = spfRecords.some((record) =>
      mxHosts.has(record.host.toLowerCase()),
    );
    if (!hasAlignedEnvelopeDomain) {
      errors.push(
        "SPF and MX records must use the same envelope subdomain for bounce handling.",
      );
    }
  }

  // Find DMARC - but note it should NOT be in auto-setup records
  const dmarcRecords = records.filter(
    (r) =>
      r.host.toLowerCase() === "_dmarc" ||
      r.value.trim().toUpperCase().startsWith("V=DMARC1"),
  );
  const hasDmarc = dmarcRecords.length > 0;

  // SAFETY: DMARC in auto-setup is a violation - it should have been stripped
  if (hasDmarc) {
    errors.push(
      "DMARC record found in auto-setup payload. This is unsafe and should be removed.",
    );
  } else {
    warnings.push(
      "No DMARC record found. Configure DMARC manually for email policy enforcement.",
    );
  }

  // Cloudflare proxy warning
  if (records.some((record) => record.type === "CNAME")) {
    warnings.push(
      'If using Cloudflare: Ensure CNAME records are set to "DNS only" (not proxied).',
    );
  }

  const valid = errors.length === 0;

  return {
    valid,
    errors,
    warnings,
    details: {
      hasDkim,
      dkimType,
      hasSpf,
      spfCount: spfRecords.length,
      hasMx,
      mxHasPriority,
      hasDmarc,
    },
  };
}

/**
 * Convert backend DNS records to Entri format with sanitization.
 * This is the main entry point for preparing records for Entri.
 */
export function prepareRecordsForEntri(
  domain: string,
  backendRecords: Array<{
    name: string;
    type: string;
    value: string;
    priority?: number;
    purpose?: string;
  }>,
): { records: DnsRecord[]; validation: ValidationResult } {
  // Convert to internal format, preserving priority
  const converted: DnsRecord[] = backendRecords.map((r) => {
    const record: DnsRecord = {
      type: r.type as DnsRecord["type"],
      host: r.name,
      value: r.value,
      ttl: 3600,
      purpose: r.purpose,
    };

    // Preserve MX priority
    if (r.priority !== undefined && r.priority !== null) {
      record.priority = r.priority;
    }

    return record;
  });

  // Sanitize to enforce canonical model
  const {
    records: sanitized,
    dropped,
    warnings: sanitizeWarnings,
  } = sanitizeDnsRecords(converted, domain);

  // Validate the sanitized records
  const validation = validateCanonicalRecords(sanitized);

  // Merge sanitization warnings into validation
  validation.warnings = [...sanitizeWarnings, ...validation.warnings];

  return { records: sanitized, validation };
}
