/**
 * DNS Record Sanitizer for Resend Email Domains
 * 
 * Enforces Resend's canonical DNS model:
 * - DKIM: CNAME only (resend._domainkey → resend._domainkey.resend.com)
 * - SPF: TXT record on send subdomain (Resend's current model)
 * - MX: MX record on send subdomain WITH PRIORITY (required for bounce handling)
 * - DMARC: TXT _dmarc (optional but recommended)
 * 
 * CRITICAL: Does NOT add synthetic CNAME for return-path
 * Resend uses MX + SPF TXT on 'send' subdomain, not CNAME
 */

export interface DnsRecord {
  type: 'TXT' | 'CNAME' | 'MX' | 'A' | 'AAAA';
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
    dkimType: 'CNAME' | 'TXT' | null;
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
  const cleanHost = lowerHost.replace(/\.$/, '');
  const cleanDomain = lowerDomain.replace(/\.$/, '');
  
  // If host equals domain, return @
  if (cleanHost === cleanDomain) {
    return '@';
  }
  
  // If host ends with .domain, strip it
  const suffix = `.${cleanDomain}`;
  if (cleanHost.endsWith(suffix)) {
    return cleanHost.slice(0, -suffix.length);
  }
  
  return cleanHost;
}

/**
 * Sanitize DNS records to enforce Resend's canonical model.
 * - Removes conflicting records (CNAME + MX/TXT on same host)
 * - Ensures only valid combinations exist
 * - Preserves MX priority
 */
export function sanitizeDnsRecords(records: DnsRecord[], domain: string): SanitizationResult {
  const dropped: DnsRecord[] = [];
  const warnings: string[] = [];
  const sanitized: DnsRecord[] = [];
  
  // Group records by normalized host
  const recordsByHost: Map<string, DnsRecord[]> = new Map();
  
  // Group records by purpose
  const dkimRecords: DnsRecord[] = [];
  const spfRecords: DnsRecord[] = [];
  const mxRecords: DnsRecord[] = [];
  const dmarcRecords: DnsRecord[] = [];
  const otherRecords: DnsRecord[] = [];

  for (const record of records) {
    const normalizedHost = normalizeHost(record.host, domain);
    const normalizedRecord = { ...record, host: normalizedHost };
    
    // Track by host for conflict detection
    if (!recordsByHost.has(normalizedHost)) {
      recordsByHost.set(normalizedHost, []);
    }
    recordsByHost.get(normalizedHost)!.push(normalizedRecord);
    
    // Categorize records
    if (normalizedHost.includes('domainkey') || normalizedHost.includes('dkim')) {
      dkimRecords.push(normalizedRecord);
    } else if (record.type === 'MX') {
      mxRecords.push(normalizedRecord);
    } else if (record.type === 'TXT' && record.value.includes('spf')) {
      spfRecords.push(normalizedRecord);
    } else if (normalizedHost === '_dmarc' || record.value.includes('DMARC')) {
      dmarcRecords.push(normalizedRecord);
    } else {
      otherRecords.push(normalizedRecord);
    }
  }

  // === Check for CNAME conflicts ===
  // A CNAME on a host cannot coexist with MX/TXT/A on the same host
  for (const [host, hostRecords] of recordsByHost) {
    const hasCname = hostRecords.some(r => r.type === 'CNAME');
    const hasOther = hostRecords.some(r => r.type !== 'CNAME');
    
    if (hasCname && hasOther && host !== '@') {
      // Conflict! CNAME cannot coexist with other records
      // For Resend, prefer MX/TXT over CNAME (except for DKIM)
      if (!host.includes('domainkey')) {
        warnings.push(`CNAME at "${host}" conflicts with MX/TXT records. Dropping CNAME.`);
        // Remove CNAME from consideration for this host
        const cnameRecords = hostRecords.filter(r => r.type === 'CNAME');
        dropped.push(...cnameRecords);
      }
    }
  }

  // === DKIM: Keep CNAME only, drop TXT ===
  const dkimCnames = dkimRecords.filter(r => r.type === 'CNAME');
  const dkimTxts = dkimRecords.filter(r => r.type === 'TXT');
  
  if (dkimCnames.length > 0 && dkimTxts.length > 0) {
    warnings.push('Found both DKIM CNAME and TXT records. Keeping CNAME only (Resend canonical).');
    dropped.push(...dkimTxts);
  }
  
  if (dkimCnames.length > 0) {
    sanitized.push(dkimCnames[0]);
    if (dkimCnames.length > 1) {
      warnings.push(`Found ${dkimCnames.length} DKIM CNAME records. Keeping first selector only.`);
      dropped.push(...dkimCnames.slice(1));
    }
  } else if (dkimTxts.length > 0) {
    warnings.push('No DKIM CNAME found. Using TXT record as fallback.');
    sanitized.push(dkimTxts[0]);
    if (dkimTxts.length > 1) {
      dropped.push(...dkimTxts.slice(1));
    }
  }

  // === MX: Keep all MX records with priority ===
  for (const mx of mxRecords) {
    if (mx.priority === undefined || mx.priority === null) {
      // MX without priority - add default
      warnings.push(`MX record "${mx.host}" missing priority. Setting to 10.`);
      sanitized.push({ ...mx, priority: 10 });
    } else {
      sanitized.push(mx);
    }
  }

  // === SPF: Keep TXT records (Resend uses SPF on send subdomain) ===
  for (const spf of spfRecords) {
    // Check if this host has a conflicting CNAME
    const host = spf.host;
    const wasDropped = dropped.some(d => d.host === host && d.type === 'CNAME');
    
    // Add SPF record
    sanitized.push(spf);
  }
  
  if (spfRecords.length > 1) {
    // Multiple SPF records - warn but keep all (they may be on different hosts)
    const hosts = new Set(spfRecords.map(r => r.host));
    if (hosts.size === 1) {
      warnings.push(`Found ${spfRecords.length} SPF records on same host. This may cause issues.`);
    }
  }

  // === DMARC: NEVER include in auto-setup ===
  // DMARC is informational only and must be configured manually
  // Auto-applying DMARC can conflict with existing email policies
  if (dmarcRecords.length > 0) {
    warnings.push(`DMARC records excluded from auto-setup (${dmarcRecords.length} record(s)). Configure manually if needed.`);
    dropped.push(...dmarcRecords);
  }

  // === Other records: Only add if not conflicting ===
  for (const other of otherRecords) {
    // Skip CNAMEs that were dropped due to conflict
    if (other.type === 'CNAME') {
      const hasConflict = dropped.some(d => d.host === other.host && d.type === 'CNAME');
      if (hasConflict) continue;
    }
    sanitized.push(other);
  }

  console.log(`🧹 DNS Sanitization complete for ${domain}:`);
  console.log(`   ✓ Kept: ${sanitized.length} records`);
  console.log(`   ✗ Dropped: ${dropped.length} records`);
  if (warnings.length > 0) {
    console.log(`   ⚠️ Warnings:`, warnings);
  }

  return { records: sanitized, dropped, warnings };
}

/**
 * Strictly validate DNS records before sending to Entri.
 * Blocks if required records are missing or conflicting.
 */
export function validateCanonicalRecords(records: DnsRecord[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Find DKIM records
  const dkimRecords = records.filter(r => 
    r.host.includes('domainkey') || r.host.includes('dkim')
  );
  const dkimCnames = dkimRecords.filter(r => r.type === 'CNAME');
  const dkimTxts = dkimRecords.filter(r => r.type === 'TXT');
  
  const hasDkim = dkimRecords.length > 0;
  const dkimType = dkimCnames.length > 0 ? 'CNAME' : (dkimTxts.length > 0 ? 'TXT' : null);
  
  if (!hasDkim) {
    errors.push('Missing DKIM record (required for email signing)');
  } else if (dkimCnames.length > 0 && dkimTxts.length > 0) {
    errors.push('Conflicting DKIM records: both CNAME and TXT present. Use CNAME only.');
  }

  // Find MX records
  const mxRecords = records.filter(r => r.type === 'MX');
  const hasMx = mxRecords.length > 0;
  const mxHasPriority = mxRecords.every(r => r.priority !== undefined && r.priority !== null);
  
  if (!hasMx) {
    errors.push('Missing MX record (required for bounce handling)');
  } else if (!mxHasPriority) {
    errors.push('MX record missing priority (required for DNS)');
  }

  // Find SPF records (TXT with spf in value)
  const spfRecords = records.filter(r => r.type === 'TXT' && r.value.includes('spf'));
  const hasSpf = spfRecords.length > 0;
  
  if (!hasSpf) {
    errors.push('Missing SPF record (required for sender verification)');
  }

  // Find DMARC - but note it should NOT be in auto-setup records
  const dmarcRecords = records.filter(r => 
    r.host === '_dmarc' || r.value.includes('DMARC')
  );
  const hasDmarc = dmarcRecords.length > 0;
  
  // SAFETY: DMARC in auto-setup is a violation - it should have been stripped
  if (hasDmarc) {
    errors.push('DMARC record found in auto-setup payload. This is unsafe and should be removed.');
  }

  // Cloudflare proxy warning
  warnings.push('If using Cloudflare: Ensure CNAME records are set to "DNS only" (not proxied).');

  const valid = errors.length === 0;

  console.log(`✅ DNS Validation: ${valid ? 'PASSED' : 'FAILED'}`);
  console.log(`   DKIM: ${hasDkim ? `✓ (${dkimType})` : '✗'}`);
  console.log(`   MX: ${hasMx ? `✓ (${mxRecords.length} record${mxRecords.length > 1 ? 's' : ''}, priority: ${mxHasPriority ? '✓' : '✗'})` : '✗'}`);
  console.log(`   SPF: ${hasSpf ? `✓` : '✗'}`);
  console.log(`   DMARC: ${hasDmarc ? '✓' : '⚠️ (optional)'}`);
  if (errors.length > 0) {
    console.error(`   Errors:`, errors);
  }

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
      hasDmarc
    }
  };
}

/**
 * Convert backend DNS records to Entri format with sanitization.
 * This is the main entry point for preparing records for Entri.
 */
export function prepareRecordsForEntri(
  domain: string, 
  backendRecords: Array<{name: string; type: string; value: string; priority?: number; purpose?: string}>
): { records: DnsRecord[]; validation: ValidationResult } {
  
  console.log(`📋 Preparing ${backendRecords.length} records for Entri (domain: ${domain})`);
  
  // Convert to internal format, preserving priority
  const converted: DnsRecord[] = backendRecords.map(r => {
    const record: DnsRecord = {
      type: r.type as DnsRecord['type'],
      host: r.name,
      value: r.value,
      ttl: 3600,
      purpose: r.purpose
    };
    
    // Preserve MX priority
    if (r.priority !== undefined && r.priority !== null) {
      record.priority = r.priority;
    }
    
    return record;
  });
  
  // Sanitize to enforce canonical model
  const { records: sanitized, dropped, warnings: sanitizeWarnings } = sanitizeDnsRecords(converted, domain);
  
  // Validate the sanitized records
  const validation = validateCanonicalRecords(sanitized);
  
  // Merge sanitization warnings into validation
  validation.warnings = [...sanitizeWarnings, ...validation.warnings];
  
  // Log dropped records for debugging
  if (dropped.length > 0) {
    console.log(`🗑️ Dropped records:`, dropped);
  }
  
  return { records: sanitized, validation };
}
