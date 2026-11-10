import '@testing-library/jest-dom/vitest';
import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,cleanup} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {ImportedReportsPanel} from './ImportedReportsPanel';
const mocks=vi.hoisted(()=>({from:vi.fn(),eq:vi.fn()}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{from:mocks.from}}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
function mount(data: unknown[],error: unknown=null){const q={select:()=>q,eq:mocks.eq,in:()=>q,order:()=>q,limit:()=>Promise.resolve({data,error})};mocks.eq.mockReturnValue(q);mocks.from.mockReturnValue(q);render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><MemoryRouter><ImportedReportsPanel tenantId="tenant-a"/></MemoryRouter></QueryClientProvider>);}
it('labels period summaries and keeps the two report totals distinct',async()=>{mount([
{id:'a',report_type:'customer_master',reconciliation:{customers:3},status:'completed'},
{id:'b',report_type:'customer_sales_summary',source_filename:'products.csv',source_period_start:'2026-01-01',source_period_end:'2026-10-14',reconciliation:{amount:123},status:'completed'},
{id:'c',report_type:'customer_spending',source_filename:'spend.xls',reconciliation:{amount:120,transactions:5,warnings:['Prior-year report needs review.']},status:'completed'}]);
expect(await screen.findByText('Your imported purchase reports')).toBeVisible();expect(screen.getByText('$123.00')).toBeVisible();expect(screen.getByText('$120.00')).toBeVisible();expect(screen.getByText(/not lifetime spending/)).toBeVisible();expect(screen.getByText('Prior-year report needs review.')).toBeVisible();expect(mocks.eq).toHaveBeenCalledWith('tenant_id','tenant-a');});
it('offers retry on a real source failure',async()=>{mount([],new Error('offline'));expect(await screen.findByRole('button',{name:'Retry reports'})).toBeVisible();});
it('keeps the current period when an older year is uploaded later, and shows current caveats',async()=>{
  const reports=[
    {id:'old',report_type:'customer_sales_summary',source_filename:'Sales 2025.xls',source_period_start:'2025-01-01',source_period_end:'2025-12-31',reconciliation:{},status:'completed'},
    {id:'ytd',report_type:'customer_sales_summary',source_filename:'Sales YTD.csv',source_period_start:'2026-01-01',source_period_end:'2026-10-14',reconciliation:{amount:500,warnings:['Prior-year workbook is damaged.']},status:'completed'}];
  const table=(rows: unknown[])=>{const q={select:()=>q,eq:()=>q,in:()=>q,order:()=>q,limit:()=>Promise.resolve({data:rows,error:null})};return q;};
  mocks.from.mockImplementation((name: string)=>name==='customer_intelligence_sources'?table([{validation_summary:{warnings:['Recovered 2025 annual history is imported.']}}]):table(reports));
  render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><MemoryRouter><ImportedReportsPanel tenantId="tenant-a"/></MemoryRouter></QueryClientProvider>);
  expect(await screen.findByText(/2026-01-01 through 2026-10-14/)).toBeVisible();
  expect(screen.getByText('$500.00')).toBeVisible();
  expect(await screen.findByText('Recovered 2025 annual history is imported.')).toBeVisible();
  expect(screen.queryByText('Prior-year workbook is damaged.')).toBeNull();
});
