/**
 * DMARC for Entri auto-setup.
 *
 * Campaign sending requires DMARC (see domainAuthentication.ts). Entri can set
 * it in the same one-click flow, but only when the domain has no DMARC record
 * of its own. An existing record is never touched: a second record at _dmarc
 * breaks DMARC for the whole domain, and replacing a stricter policy would
 * weaken the store's email security.
 *
 * If the lookup cannot prove the record is absent, nothing is added.
 */

export const DEFAULT_DMARC_VALUE = "v=DMARC1; p=none;";

export type DmarcLookupState = "missing" | "present" | "unknown";

export interface DmarcLookup {
  state: DmarcLookupState;
  values: string[];
}

interface DohAnswer {
  type?: number;
  data?: string;
}

interface DohResponse {
  Status?: number;
  Answer?: DohAnswer[];
}

const DOH_RESOLVERS = [
  "https://cloudflare-dns.com/dns-query",
  "https://dns.google/resolve",
];

const NXDOMAIN = 3;
const NOERROR = 0;

function cleanTxt(value: string): string {
  return value.replace(/^"|"$/g, "").replace(/"\s+"/g, "").trim();
}

/** Reads one DoH JSON reply. Any answer at _dmarc, even a CNAME, counts as present. */
export function interpretDmarcResponse(reply: DohResponse): DmarcLookup {
  const answers = Array.isArray(reply.Answer) ? reply.Answer : [];
  const values = answers
    .map((answer) => cleanTxt(String(answer.data ?? "")))
    .filter(Boolean);
  if (answers.length > 0) return { state: "present", values };
  if (reply.Status === NXDOMAIN || reply.Status === NOERROR) {
    return { state: "missing", values: [] };
  }
  return { state: "unknown", values: [] };
}

export async function lookupDmarc(
  domain: string,
  fetchImpl: typeof fetch = fetch,
): Promise<DmarcLookup> {
  const name = `_dmarc.${domain.trim().toLowerCase().replace(/\.$/, "")}`;
  for (const resolver of DOH_RESOLVERS) {
    try {
      const response = await fetchImpl(
        `${resolver}?name=${encodeURIComponent(name)}&type=TXT`,
        { headers: { Accept: "application/dns-json" } },
      );
      if (!response.ok) continue;
      const result = interpretDmarcResponse((await response.json()) as DohResponse);
      if (result.state !== "unknown") return result;
    } catch {
      // Try the next resolver.
    }
  }
  return { state: "unknown", values: [] };
}

export interface DmarcAutoSetupResult<T> {
  records: T[];
  added: boolean;
  lookup: DmarcLookup;
}

/**
 * Adds the default DMARC record to an Entri record list when, and only when,
 * the domain has none. Runs after record validation, which still rejects
 * DMARC coming from the provider's own record list.
 */
export async function withDmarcIfMissing<
  T extends { type: string; host: string; value: string; ttl?: number },
>(
  domain: string,
  records: T[],
  fetchImpl: typeof fetch = fetch,
): Promise<DmarcAutoSetupResult<T>> {
  const alreadyIncluded = records.some((record) => record.host.toLowerCase() === "_dmarc");
  if (alreadyIncluded) {
    return { records, added: false, lookup: { state: "present", values: [] } };
  }
  const lookup = await lookupDmarc(domain, fetchImpl);
  if (lookup.state !== "missing") {
    return { records, added: false, lookup };
  }
  const dmarcRecord = {
    type: "TXT",
    host: "_dmarc",
    value: DEFAULT_DMARC_VALUE,
    ttl: 3600,
  } as T;
  return { records: [...records, dmarcRecord], added: true, lookup };
}
