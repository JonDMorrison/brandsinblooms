import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { CompactBlockRenderer } from "./CompactBlockRenderer";

const report = {
  start: "2026-01-01", end: "2026-10-14", spend: 2013.85, transactions: 29,
  source: "Customer Spending YTD.xls", currency: "CAD", evidence_basis: "reported_period",
};

function mount(overrides: Record<string, unknown> = {}) {
  render(
    <MemoryRouter>
      <CompactBlockRenderer
        blockType="data_card"
        payload={{ entity_type: "customer", entity: {
          id: "customer", name: "Reported Customer", total_spent: "Unknown",
          reported_period_spending: report, ...overrides,
        } }}
        onContinueInBloom={() => true}
      />
    </MemoryRouter>,
  );
}

describe("compact customer purchase evidence", () => {
  it("shows the report amount, period and transaction count", () => {
    mount();
    expect(screen.getByText(/\$2,013\.85 CAD reported \(Jan 1 – Oct 14, 2026\), 29 reported transactions/)).toBeVisible();
    expect(screen.queryByText(/Unknown spent|0 orders|\$0\.00 spent/)).toBeNull();
  });

  it("does not let a legacy default zero contradict the report", () => {
    mount({ total_spent: 0 });
    expect(screen.getByText(/\$2,013\.85 CAD reported/)).toBeVisible();
    expect(screen.queryByText(/0\.00 recorded spending/)).toBeNull();
  });

  it.each([0, -42.5])("preserves an explicit report total of %s", (spend) => {
    mount({ reported_period_spending: { ...report, spend } });
    expect(screen.getByText(spend === 0 ? /\$0\.00 CAD reported/ : /-\$42\.50 CAD reported/)).toBeVisible();
  });

  it("keeps missing history unknown", () => {
    mount({ total_spent: 0, reported_period_spending: null });
    expect(screen.getByText(/Recorded spending unknown/)).toBeVisible();
    expect(screen.queryByText(/\$0\.00/)).toBeNull();
  });

  it("keeps actual receipt totals separate from report-period spending", () => {
    mount({ total_spent: 410.5 });
    expect(screen.getByText(/29 reported transactions · 410\.50 recorded spending/)).toBeVisible();
  });
});

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
  it('uses the same download navigation in the compact block renderer', () => {
    render(<MemoryRouter><CompactBlockRenderer blockType="data_card" payload={payload} onContinueInBloom={()=>true} /></MemoryRouter>);
    const download=screen.getByRole('link',{name:'Download'});
    expect(download).toHaveAttribute('href',payload.download_url);
    expect(download).toHaveAttribute('download','synthetic.csv');
    expect(download).not.toHaveAttribute('target');
  });
});
