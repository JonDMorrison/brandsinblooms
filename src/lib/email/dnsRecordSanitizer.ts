/**
 * DNS Record Sanitizer for Resend Email Domains
 * 
 * Enforces Resend's canonical DNS model:
 * - DKIM: CNAME only (resend._domainkey → resend._domainkey.resend.com)
 * - SPF: Single TXT record on root domain (@)
 * - Return-Path: CNAME send → send.resend.com AND MX send → feedback-smtp...
 * - DMARC: TXT _dmarc
 * 
 * Prevents conflicts like duplicate DKIM (CNAME+TXT) or multiple SPF records.
 */

export interface DnsRecord {
  type: 'TXT' | 'CNAME' | 'MX' | 'A' | 'AAAA';
  host: string;
  value: string;
  ttl?: number;
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
    hasReturnPath: boolean;
    hasDmarc: boolean;
  };
}

/**
 * Sanitize DNS records to enforce Resend's canonical model.
 * Removes conflicting records and ensures only valid combinations exist.
 */
export function sanitizeDnsRecords(records: DnsRecord[], domain: string): SanitizationResult {
  const dropped: DnsRecord[] = [];
  const warnings: string[] = [];
  const sanitized: DnsRecord[] = [];
  
  // Normalize hosts - remove domain suffix for comparison
  const normalizeHost = (host: string): string => {
    if (host.endsWith(`.${domain}`)) {
      return host.replace(`.${domain}`, '');
    }
    if (host === domain) {
      return '@';
    }
    return host;
  };

  // Group records by purpose
  const dkimRecords: DnsRecord[] = [];
  const spfRecords: DnsRecord[] = [];
  const returnPathRecords: DnsRecord[] = [];
  const dmarcRecords: DnsRecord[] = [];
  const otherRecords: DnsRecord[] = [];

  for (const record of records) {
    const host = normalizeHost(record.host);
    
    // Categorize records
    if (host.includes('domainkey') || host.includes('dkim')) {
      dkimRecords.push({ ...record, host });
    } else if (record.type === 'TXT' && record.value.includes('spf')) {
      spfRecords.push({ ...record, host });
    } else if (host === '_dmarc' || record.value.includes('DMARC')) {
      dmarcRecords.push({ ...record, host });
    } else if (host === 'send' || host === 'return' || record.value.includes('send.resend')) {
      returnPathRecords.push({ ...record, host });
    } else {
      otherRecords.push({ ...record, host });
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
    // Keep only the first CNAME (should be resend._domainkey)
    sanitized.push(dkimCnames[0]);
    if (dkimCnames.length > 1) {
      warnings.push(`Found ${dkimCnames.length} DKIM CNAME records. Keeping first selector only.`);
      dropped.push(...dkimCnames.slice(1));
    }
  } else if (dkimTxts.length > 0) {
    // No CNAME available, use TXT as fallback (not ideal but better than nothing)
    warnings.push('No DKIM CNAME found. Using TXT record as fallback.');
    sanitized.push(dkimTxts[0]);
    if (dkimTxts.length > 1) {
      dropped.push(...dkimTxts.slice(1));
    }
  }

  // === SPF: Keep only one TXT record on @ ===
  if (spfRecords.length > 0) {
    // Prefer root domain (@) record
    const rootSpf = spfRecords.find(r => r.host === '@' || r.host === domain || r.host === '');
    if (rootSpf) {
      sanitized.push({ ...rootSpf, host: '@' });
      const extras = spfRecords.filter(r => r !== rootSpf);
      if (extras.length > 0) {
        warnings.push(`Found ${spfRecords.length} SPF records. Keeping root domain only.`);
        dropped.push(...extras);
      }
    } else {
      // No root SPF, keep first one
      sanitized.push(spfRecords[0]);
      if (spfRecords.length > 1) {
        warnings.push(`Found ${spfRecords.length} SPF records. Keeping first only.`);
        dropped.push(...spfRecords.slice(1));
      }
    }
  }

  // === Return-Path: Keep CNAME and MX for 'send' subdomain ===
  const returnPathCname = returnPathRecords.find(r => r.type === 'CNAME' && r.host === 'send');
  const returnPathMx = returnPathRecords.find(r => r.type === 'MX' && r.host === 'send');
  
  if (returnPathCname) {
    sanitized.push(returnPathCname);
  }
  if (returnPathMx) {
    sanitized.push(returnPathMx);
  }
  
  // Track other return-path records as dropped
  for (const r of returnPathRecords) {
    if (r !== returnPathCname && r !== returnPathMx) {
      dropped.push(r);
    }
  }

  // === DMARC: Keep single TXT on _dmarc ===
  if (dmarcRecords.length > 0) {
    const dmarcTxt = dmarcRecords.find(r => r.type === 'TXT');
    if (dmarcTxt) {
      sanitized.push(dmarcTxt);
      if (dmarcRecords.length > 1) {
        warnings.push(`Found ${dmarcRecords.length} DMARC records. Keeping first TXT only.`);
        dropped.push(...dmarcRecords.filter(r => r !== dmarcTxt));
      }
    }
  }

  // === Other records pass through ===
  sanitized.push(...otherRecords);

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
  const dkimCnames = records.filter(r => 
    (r.host.includes('domainkey') || r.host.includes('dkim')) && r.type === 'CNAME'
  );
  const dkimTxts = records.filter(r => 
    (r.host.includes('domainkey') || r.host.includes('dkim')) && r.type === 'TXT'
  );
  
  const hasDkim = dkimCnames.length > 0 || dkimTxts.length > 0;
  const dkimType = dkimCnames.length > 0 ? 'CNAME' : (dkimTxts.length > 0 ? 'TXT' : null);
  
  if (!hasDkim) {
    errors.push('Missing DKIM record (required for email signing)');
  } else if (dkimCnames.length > 0 && dkimTxts.length > 0) {
    errors.push('Conflicting DKIM records: both CNAME and TXT present. Use CNAME only.');
  } else if (dkimCnames.length > 1) {
    errors.push(`Multiple DKIM CNAME selectors found (${dkimCnames.length}). Use single selector.`);
  }

  // Find SPF records
  const spfRecords = records.filter(r => r.type === 'TXT' && r.value.includes('spf'));
  const hasSpf = spfRecords.length > 0;
  
  if (!hasSpf) {
    errors.push('Missing SPF record (required for sender verification)');
  } else if (spfRecords.length > 1) {
    errors.push(`Multiple SPF records found (${spfRecords.length}). Only one SPF record allowed per domain.`);
  }

  // Find Return-Path (CNAME for send subdomain)
  const returnPathCname = records.find(r => 
    r.type === 'CNAME' && (r.host === 'send' || r.value.includes('send.resend'))
  );
  const hasReturnPath = !!returnPathCname;
  
  if (!hasReturnPath) {
    errors.push('Missing Return-Path CNAME (send → send.resend.com). Required for bounce handling.');
  }

  // Find DMARC
  const dmarcRecords = records.filter(r => 
    r.host === '_dmarc' || r.value.includes('DMARC')
  );
  const hasDmarc = dmarcRecords.length > 0;
  
  if (!hasDmarc) {
    warnings.push('No DMARC record found. Recommended for email policy enforcement.');
  }

  // Cloudflare proxy warning
  warnings.push('If using Cloudflare: Ensure CNAME records are set to "DNS only" (not proxied).');

  const valid = errors.length === 0;

  console.log(`✅ DNS Validation: ${valid ? 'PASSED' : 'FAILED'}`);
  console.log(`   DKIM: ${hasDkim ? `✓ (${dkimType})` : '✗'}`);
  console.log(`   SPF: ${hasSpf ? `✓ (${spfRecords.length} record${spfRecords.length > 1 ? 's - ERROR' : ''})` : '✗'}`);
  console.log(`   Return-Path: ${hasReturnPath ? '✓' : '✗'}`);
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
      hasReturnPath,
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
  backendRecords: Array<{name: string; type: string; value: string; purpose?: string}>
): { records: DnsRecord[]; validation: ValidationResult } {
  
  console.log(`📋 Preparing ${backendRecords.length} records for Entri (domain: ${domain})`);
  
  // Convert to internal format
  const converted: DnsRecord[] = backendRecords.map(r => ({
    type: r.type as DnsRecord['type'],
    host: r.name,
    value: r.value,
    ttl: 3600,
    purpose: r.purpose
  }));
  
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
