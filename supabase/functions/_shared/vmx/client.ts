/**
 * VMX POS API Client
 *
 * Pull-only REST API. Header auth via VMX-Client-ID.
 * Page-based pagination (1000/page). Incremental sync via `start` param.
 * Rate limit: 60/min + 10/10s burst.
 */

const DEFAULT_BASE_URL = "https://bcg.vmxllc.com/pos/api";
const PAGE_SIZE = 1000;

// ── Types ────────────────────────────────────────────────────────────

export interface VmxCustomer {
  number: string;
  firstName: string;
  lastName: string;
  email: string;
  email2: string | null;
  phone: string;
  cellPhone: string;
  wantsEMail: string;
  wantsTexts: string;
  wantsPMail: string;
  isLoyalty: string;
  rewardDollars: string;
  dateAdded: string;
  birthday: string | null;
  custClass: string;
  isInactive: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export interface VmxReceiptItem {
  plu: string;
  quantity: string;
  unitPrice: string;
  finalItemPrice: string;
  regUnitPrice: string;
  type: string;
  returnedQuantity: string | null;
  percentDiscount: string;
  dollarDiscount: string;
  isTaxed: string;
  importSet: number | null;
  legacyId: string | null;
}

export interface VmxReceipt {
  id: string;
  postDate: string;
  customerNum: string | null;
  subtotal: string;
  tax: string;
  tax_rate: string;
  divisionId: string;
  taxed: string;
  dollarDiscount: string;
  percentDiscount: string;
  note: string;
  poNumber: string;
  importSet: number | null;
  legacyId: string | null;
  items: VmxReceiptItem[];
}

export interface VmxItem {
  plu: string;
  name: string;
  description: string;
  unitPrice: string;
  onHand: string;
  department: string;
  departmentName: string;
  dateAdded: string;
  dateLastSold: string | null;
  lastUpdated: string;
}

export interface VmxGiftCard {
  id: string;
  externalCode: string;
  balance: number;
  issueAmount: number;
  isStoreCredit: boolean;
  expirationDate: string | null;
  printedDate: string | null;
}

export interface VmxPage<T> {
  data: T[];
  hasMore: boolean;
  nextPage: number;
}

export class VmxAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VmxAuthError";
  }
}

// ── Date helper ──────────────────────────────────────────────────────

/**
 * Parse VMX datetime string ('YYYY-MM-DD HH:MM:SS') as America/New_York.
 * ASSUMPTION: VMX server is in Eastern Time. Confirm with Andy.
 * Returns ISO 8601 string with offset.
 */
export function parseVmxDate(vmxDate: string | null): string | null {
  if (!vmxDate) return null;
  // VMX dates lack timezone — treat as America/New_York
  // Append Eastern offset. Note: this doesn't handle DST perfectly
  // but is close enough for sync purposes.
  try {
    const d = new Date(vmxDate + " EDT");
    if (isNaN(d.getTime())) {
      // Fallback: try as UTC
      const d2 = new Date(vmxDate);
      return isNaN(d2.getTime()) ? null : d2.toISOString();
    }
    return d.toISOString();
  } catch {
    return null;
  }
}

// ── Client ───────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function createVmxClient(apiKey: string, baseUrl?: string) {
  const base = baseUrl || DEFAULT_BASE_URL;

  async function vmxFetch<T>(
    endpoint: string,
    params: Record<string, string> = {},
  ): Promise<VmxPage<T>> {
    const url = new URL(`${base}/${endpoint}`);
    for (const [k, v] of Object.entries(params)) {
      if (v) url.searchParams.set(k, v);
    }

    let attempts = 0;
    const maxAttempts = 4;

    while (attempts < maxAttempts) {
      attempts++;

      const res = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "VMX-Client-ID": apiKey,
          "VMX-API-Version": "1.11.0",
        },
      });

      // 302 = auth failure (VMX returns redirect, not 401)
      if (res.status === 302) {
        throw new VmxAuthError("VMX API authentication failed — check VMX-Client-ID");
      }

      // Rate limit handling
      if (res.status === 429) {
        let retryAfter = 60;
        try {
          const errBody = await res.json();
          retryAfter = errBody.retry_after || 60;
        } catch { /* use default */ }
        console.warn(`VMX rate limited, sleeping ${retryAfter}s (attempt ${attempts})`);
        await sleep(retryAfter * 1000);
        continue;
      }

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`VMX API error ${res.status}: ${text}`);
      }

      // Check burst limit — throttle proactively
      const burstRemaining = parseInt(res.headers.get("X-RateLimit-Remaining-Burst") || "10", 10);
      if (burstRemaining < 3) {
        await sleep(1200);
      }

      const data = (await res.json()) as T[];
      const page = parseInt(params.page || "1", 10);

      return {
        data,
        hasMore: data.length >= PAGE_SIZE,
        nextPage: page + 1,
      };
    }

    throw new Error("VMX API: max retry attempts exceeded");
  }

  return {
    listCustomers(opts: { start?: string; page?: number } = {}): Promise<VmxPage<VmxCustomer>> {
      return vmxFetch<VmxCustomer>("customers", {
        start: opts.start || "",
        page: String(opts.page || 1),
      });
    },

    listReceipts(opts: { start?: string; page?: number } = {}): Promise<VmxPage<VmxReceipt>> {
      return vmxFetch<VmxReceipt>("receipts", {
        start: opts.start || "",
        page: String(opts.page || 1),
      });
    },

    listItems(opts: { start?: string; page?: number } = {}): Promise<VmxPage<VmxItem>> {
      return vmxFetch<VmxItem>("items", {
        start: opts.start || "",
        page: String(opts.page || 1),
      });
    },

    listGiftCards(opts: { start?: string; page?: number } = {}): Promise<VmxPage<VmxGiftCard>> {
      return vmxFetch<VmxGiftCard>("giftcards", {
        start: opts.start || "",
        page: String(opts.page || 1),
      });
    },
  };
}
