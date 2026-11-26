import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DataCardBlock } from "./blocks/DataCardBlock";
import { CustomerResultCard } from "./content/cards/CustomerResultCard";
import { InventoryResultCard } from "./content/cards/InventoryResultCard";
import { BloomToolResultCard } from "./content/BloomToolResultCard";
import {
  formatCurrencyValue,
  formatNumberValue,
  readNumber as readBlockNumber,
} from "./blocks/blockUtils";
import {
  formatCurrency,
  readNumber as readCardNumber,
  type NormalizedToolResult,
} from "./content/cards/cardUtils";

vi.mock("@/hooks/bloom/useBloomProfile", () => ({
  useBloomProfile: () => ({ data: null }),
}));
vi.mock("@/hooks/bloom/useBloomProfileMutations", () => ({
  useBloomProfileMutations: () => ({
    isPinningEntity: false,
    isUnpinningEntity: false,
    pinEntity: vi.fn(),
    unpinEntity: vi.fn(),
  }),
}));

afterEach(cleanup);

const report = {
  start: "2026-01-01",
  end: "2026-10-14",
  spend: 2013.85,
  transactions: 29,
  currency: "CAD",
  evidence_basis: "reported_period",
  source: "Customer Spending YTD.xls",
};
const customer = {
  id: "reported-customer",
  name: "Reported Customer",
  total_spent: "Unknown",
  last_purchase_date: null,
  purchase_metrics: { total_spent: null, lifetime_value: null, order_count: null },
  reported_period_spending: report,
};

function resultFor(row: Record<string, unknown>): NormalizedToolResult {
  return {
    toolName: "query_customers",
    blockType: "customer_list",
    status: "success",
    data: [row],
    count: 1,
    message: null,
    error: null,
    raw: null,
  };
}

describe("Bloom purchase evidence rendering", () => {
  it("does not assume a currency when the source did not provide one", () => {
    expect(formatCurrencyValue(410.5)).toBe("410.50");
    expect(formatCurrency(410.5)).toBe("410.50");
    expect(formatCurrencyValue("CA$410.50")).toBe("CA$410.50");
    expect(formatCurrency("CA$410.50")).toBe("CA$410.50");
    expect(formatCurrencyValue(410.5, "CAD")).toBe("CA$410.50");
  });
  it.each([null, undefined, "", " ", "Unknown", "Not available", "$"])(
    "does not convert unavailable text into numeric zero (%s)",
    (value) => {
      expect(readBlockNumber(value)).toBeNull();
      expect(readCardNumber(value)).toBeNull();
      expect(formatCurrency(value)).toBeNull();
      expect(formatCurrencyValue(value)).not.toContain("0.00");
      expect(formatNumberValue(value)).not.toBe("0");
    },
  );

  it.each([[0, 0], ["0.00", 0], ["CA$2,013.85", 2013.85], ["-$42.50", -42.5]])(
    "keeps valid amounts, including zero and returns (%s)",
    (value, expected) => {
      expect(readBlockNumber(value)).toBe(expected);
      expect(readCardNumber(value)).toBe(expected);
    },
  );

  it("shows report amount, period and transactions on customer search results", () => {
    render(<CustomerResultCard result={resultFor(customer)} />);
    expect(screen.getByText(/Reported spending: \$2,013\.85 CAD/)).toBeVisible();
    expect(screen.getByText(/Jan 1 – Oct 14, 2026/)).toBeVisible();
    expect(screen.getByText(/29 reported transactions/)).toBeVisible();
    expect(screen.queryByText(/(?:Total spent|Recorded spending): \$0/)).toBeNull();
  });

  it("shows report evidence on the detailed customer card without inventing orders", () => {
    render(<DataCardBlock entityType="customer" entity={customer} actions={[]} onAction={vi.fn()} />);
    expect(screen.getByText("$2,013.85 CAD reported")).toBeVisible();
    expect(screen.getByText("Jan 1 – Oct 14, 2026")).toBeVisible();
    expect(screen.getByText("29 reported transactions")).toBeVisible();
    expect(screen.queryByText(/0 (?:recorded )?orders/)).toBeNull();
    expect(screen.queryByText(/\$0\.00/)).toBeNull();
  });

  it.each([0, -42.5])("preserves explicit report zero or return (%s)", (spend) => {
    render(<DataCardBlock entityType="customer" entity={{ ...customer, reported_period_spending: { ...report, spend } }} actions={[]} onAction={vi.fn()} />);
    expect(screen.getByText(spend === 0 ? "$0.00 CAD reported" : "-$42.50 CAD reported")).toBeVisible();
    expect(screen.getByText("29 reported transactions")).toBeVisible();
  });

  it("keeps unknown history unknown when neither receipt nor report data exists", () => {
    render(<DataCardBlock entityType="customer" entity={{ ...customer, reported_period_spending: null }} actions={[]} onAction={vi.fn()} />);
    expect(screen.getByText("Unknown recorded spending")).toBeVisible();
    expect(screen.getByText("Order history unknown")).toBeVisible();
    expect(screen.queryByText(/\$0\.00|0 orders/)).toBeNull();
  });

  it("keeps dated amounts separate when report evidence also exists", () => {
    render(<DataCardBlock entityType="customer" entity={{ ...customer, total_spent: 410.5, currency: "CAD", purchase_metrics: { order_count: 3 } }} actions={[]} onAction={vi.fn()} />);
    expect(screen.getByText("CA$410.50 recorded spending")).toBeVisible();
    expect(screen.getByText(/\$2,013\.85 CAD reported · Jan 1/)).toBeVisible();
    expect(screen.getByText("3 recorded orders")).toBeVisible();
  });
});

describe("Bloom inventory card measures stock against each product's threshold", () => {
  const productResult = (rows: Record<string, unknown>[]): NormalizedToolResult => ({
    toolName: "query_products",
    blockType: "data_table",
    status: "success",
    data: rows,
    count: rows.length,
    message: null,
    error: null,
    raw: null,
  });
  const product = (name: string, inventory_count: number, low_stock_threshold: number | null, extra: Record<string, unknown> = {}) => ({
    id: name, name, status: "active", track_inventory: true, inventory_count, low_stock_threshold, price: 10, currency: "CAD", ...extra,
  });

  it("draws the bar and label against the threshold, never against a fixed 50", () => {
    render(<InventoryResultCard result={productResult([
      product("Basil Genovese", 7, 12, { is_low_stock: true }),
      product("ZZ Plant 8-inch", 16, 6, { is_low_stock: false }),
    ])} />);
    expect(screen.getByText("7 / 12 threshold")).toBeVisible();
    expect(screen.getByText("16 / 6 threshold")).toBeVisible();
    expect(screen.queryByText(/\/50/)).toBeNull();
    const [basil, zz] = screen.getAllByRole("meter");
    expect(basil).toHaveAttribute("aria-valuemax", "12");
    expect(basil).toHaveAttribute("aria-valuenow", "7");
    expect(getComputedStyle(basil.firstElementChild as HTMLElement).width).toBe(`${(7 / 12) * 100}%`);
    expect(getComputedStyle(zz.firstElementChild as HTMLElement).width).toBe("100%");
    expect(screen.getAllByText("Low")).toHaveLength(1);
  });

  it("does not mark low or draw a bar without a threshold or tracking", () => {
    render(<InventoryResultCard result={productResult([
      product("No Threshold", 1, null),
      product("Untracked", 1, 5, { track_inventory: false }),
    ])} />);
    expect(screen.queryByRole("meter")).toBeNull();
    expect(screen.queryByText("Low")).toBeNull();
  });
});

describe("Bloom customer cards show money in the tenant currency", () => {
  it("formats recorded spending with the row currency", () => {
    render(<CustomerResultCard result={resultFor({ id: "c", name: "Sarah Tremblay", total_spent: "CA$3,700.91", currency: "CAD", reported_period_spending: null })} />);
    expect(screen.getByText(/Recorded spending: CA\$3,700\.91/)).toBeVisible();
  });

  it("keeps an amount plain when no currency is known", () => {
    render(<CustomerResultCard result={resultFor({ id: "c", name: "Old Result", total_spent: "3,700.91", reported_period_spending: null })} />);
    expect(screen.getByText("Recorded spending: 3,700.91")).toBeVisible();
    expect(screen.queryByText(/US\$|USD/)).toBeNull();
  });

  it("shows each top customer's spend from a reported-spending ranking", () => {
    // Shape of a logged rank_customers_by_intelligence output for Northfield.
    const output = {
      success: true,
      count: 2,
      message: "Selected an exact audience from the reconciled spending report.",
      block_type: "data_table",
      data: {
        kind: "customer_exploration",
        criteria: { currency: "CAD", minimum_spend: 0, minimum_transactions: 1 },
        rows: [
          { name: "Hannah Wilson", customer_id: "45f80704-0c0f-4f3c-8816-4fbae24e32d3", reported_period_spend: 4834.73, reported_transactions: 8, currency: "CAD" },
          { name: "Sarah Tremblay", customer_id: "8f7319f9-1160-4404-81a2-95228fb8b2fd", reported_period_spend: 4834.46, reported_transactions: 15 },
        ],
      },
    };
    render(<BloomToolResultCard toolName="rank_customers_by_intelligence" data={output} status="success" />);
    expect(screen.getByText("Reported spending: CA$4,834.73 · 8 reported transactions")).toBeVisible();
    // A row without its own currency uses the result's stated currency.
    expect(screen.getByText("Reported spending: CA$4,834.46 · 15 reported transactions")).toBeVisible();
  });

  it("shows matched spending for purchase searches", () => {
    render(<CustomerResultCard result={{ ...resultFor({ name: "Ann", customer_id: "a", matched_reported_spend: 120.5, currency: "CAD" }), toolName: "explore_customer_purchases" }} />);
    expect(screen.getByText("Matched spending: CA$120.50")).toBeVisible();
  });
});

// Moved from the retired CompactBlockRenderer suite: these cover the full
// renderers, which the compact panel's removal does not affect.
describe('saved group contact and export presentation', () => {
  it('renders recorded emails visibly, without replacing missing addresses', async () => {
    const {CustomerAnalysisBlock} = await import('./blocks/CustomerAnalysisBlock');
    render(<MemoryRouter><CustomerAnalysisBlock data={{kind:'customer_exploration',set_id:'saved',total_count:2,rows:[{customer_id:'a',name:'Synthetic A',email:'a@example.com'},{customer_id:'b',name:'Synthetic B',email:null}]}} /></MemoryRouter>);
    expect(screen.getByRole('columnheader', {name:'Email'})).toBeVisible();
    expect(screen.getByRole('cell', {name:'a@example.com'})).toBeVisible();
    expect(screen.getByRole('cell', {name:'No email on file'})).toBeVisible();
  });
  it('offers an actionable download only for a generated file and preserves expiry', async () => {
    const {ExportResultCard}=await import('./content/cards/ExportResultCard');
    const {normalizeToolResult}=await import('./content/cards/cardUtils');
    const result=normalizeToolResult({toolName:'export_data',data:{success:true,data:{download_url:'https://example.com/synthetic.csv',file_name:'synthetic.csv',row_count:53,total_matching_count:53,format:'csv',expires_at:'2026-11-11T18:00:00Z',actions:[{label:'Open guide',type:'link',href:'https://example.com/guide'}]},count:53}});
    render(<ExportResultCard result={result}/>);
    expect(screen.getByRole('link',{name:'Download Csv'})).toHaveAttribute('href','https://example.com/synthetic.csv');
    expect(screen.getByRole('link',{name:'Download Csv'})).toHaveAttribute('download','synthetic.csv');
    expect(screen.getByRole('link',{name:'Download Csv'})).not.toHaveAttribute('target');
    expect(screen.getByRole('link',{name:'Open guide'})).toHaveAttribute('target','_blank');
    expect(screen.getByRole('link',{name:'Open guide'})).not.toHaveAttribute('download');
    expect(screen.getByText(/Expires/)).toBeVisible();
    const empty=normalizeToolResult({toolName:'export_data',data:{success:false,data:null,error:'export_empty',message:'No export file was created.'}});
    expect(empty.status).toBe('error');
    const {container}=render(<ExportResultCard result={empty}/>);expect(container).toBeEmptyDOMElement();
  });
});


describe('alternate export download renderers', () => {
  const payload = {entity_type:'segment',entity:{name:'Synthetic export',type:'csv',customer_count:16},download_url:'https://example.com/storage/synthetic.csv?download=synthetic.csv',file_name:'synthetic.csv',format:'csv',actions:[{label:'Open guide',type:'link',url:'https://example.com/guide'}]};
  it('uses download navigation in the full block renderer while ordinary links open separately', async () => {
    const {BlockRenderer}=await import('./blocks/BlockRenderer');
    render(<MemoryRouter><BlockRenderer blockType="data_card" payload={payload} onAction={()=>{}} /></MemoryRouter>);
    const download=screen.getByRole('link',{name:'Download Csv'});
    expect(download).toHaveAttribute('href',payload.download_url);
    expect(download).toHaveAttribute('download','synthetic.csv');
    expect(download).not.toHaveAttribute('target');
    expect(screen.getByRole('link',{name:'Open guide'})).toHaveAttribute('target','_blank');
  });
});
