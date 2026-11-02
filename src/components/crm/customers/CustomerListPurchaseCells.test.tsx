import '@testing-library/jest-dom/vitest';
import {describe,it,expect,afterEach} from 'vitest';
import {render,screen,cleanup} from '@testing-library/react';
import {CustomerListLastPurchaseCell,CustomerListSpendCell} from './CustomerListPurchaseCells';
import {buildCustomerFocus,describeCustomerOrders} from '@/utils/askBloomContextBuilders';
import {readReportedPeriodSpending,formatReportedPeriod} from '@/lib/crm/reportedPeriodSpending';
afterEach(cleanup);

// John Pasca as stored for West Coast Gardens: no dated receipts, IdealPOS YTD report evidence.
const westCoastJohn={id:'0a98530f-931b-4ce5-865f-377f6c6f4d4e',first_name:'John',last_name:'Pasca',email:null,created_at:'2026-10-16T19:04:19Z',
  total_spent:0,lifetime_value:null,pos_order_count:0,last_purchase_date:null,
  custom_fields:{ideal_customer_code:'18712',ideal_customer_type:'3',ideal_import_source:'CustomerExport.txt Oct14 2026.txt',
    ideal_reported_ytd:{start:'2026-01-01',end:'2026-10-14',spend:2013.85,transactions:29,source:'Customer Spending YTD.xls',basis:'reported period totals, not lifetime or dated receipts'}}};

describe('customer list: imported spending (Bryan, Nov 2: “pasca” showed $0 / No purchases)',()=>{
  it('shows the reported total with its period instead of $0',()=>{
    render(<CustomerListSpendCell customer={westCoastJohn}/>);
    expect(screen.getByText('$2,013.85')).toBeVisible();
    expect(screen.getByText('Reported Jan 1 – Oct 14, 2026')).toBeVisible();
    expect(screen.queryByText('0.00')).toBeNull();
  });
  it('never says “No purchases” for unknown or report-only history',()=>{
    render(<CustomerListLastPurchaseCell customer={westCoastJohn}/>);
    expect(screen.getByText('No dated receipts')).toBeVisible();
    expect(screen.getByText('29 reported transactions')).toBeVisible();
    cleanup();
    render(<CustomerListLastPurchaseCell customer={{total_spent:null,last_purchase_date:null,custom_fields:{}}}/>);
    expect(screen.getByText('No recorded purchases')).toBeVisible();
    expect(screen.queryByText('No purchases')).toBeNull();
  });
  it('keeps dated receipt spending and dates when they exist',()=>{
    render(<><CustomerListSpendCell customer={{...westCoastJohn,total_spent:410.5}}/><CustomerListLastPurchaseCell customer={{...westCoastJohn,last_purchase_date:'2026-09-03T12:00:00Z'}}/></>);
    expect(screen.getByText('410.50')).toBeVisible();
    expect(screen.queryByText(/Reported/)).toBeNull();
    expect(screen.getByText('Sep 3, 2026')).toBeVisible();
  });
  it('rejects malformed report fields rather than inventing a total',()=>{
    for(const bad of [{start:'2026-10-14',end:'2026-01-01',spend:1,transactions:1},{start:'2026-01-01',end:'2026-10-14',spend:'2013.85',transactions:29},{start:'2026-01-01',end:'2026-10-14',spend:1,transactions:1.5}])
      expect(readReportedPeriodSpending({ideal_reported_ytd:bad})).toBeNull();
    expect(formatReportedPeriod({start:'2025-12-01',end:'2026-01-31'})).toBe('Dec 1, 2025 – Jan 31, 2026');
  });
});

describe('Ask Bloom customer context (header said “0 orders”)',()=>{
  const summary=buildCustomerFocus(westCoastJohn,undefined,undefined,[{name:'New Customers'}]).resourceSummary;
  it('sends reported evidence and no fabricated zeros',()=>{
    expect(summary).not.toMatch(/Total Orders: 0\b/);
    expect(summary).not.toMatch(/Lifetime Value: \$0/);
    expect(summary).not.toMatch(/Last Order: Never/);
    expect(summary).toMatch(/Total Orders: Unknown \(no dated receipts on file/);
    expect(summary).toMatch(/Reported Period Spending: \$2,013\.85 CAD from 2026-01-01 to 2026-10-14 \(source report: Customer Spending YTD\.xls\)\. .*not lifetime value, not dated receipts and not an order count/);
    expect(summary).toMatch(/Reported Transactions: 29 \(2026-01-01 to 2026-10-14\)/);
    expect(summary).toMatch(/POS Customer Code: 18712/);
    expect(summary).toMatch(/get_customer_product_history/);
    expect(summary).toMatch(/Last Order: Not available/);
  });
  it('header shows reported transactions instead of “0 orders”',()=>{
    expect(describeCustomerOrders(summary)).toBe('29 reported transactions');
  });
  it('header keeps real order counts and only says 0 when 0 is recorded',()=>{
    expect(describeCustomerOrders(buildCustomerFocus({id:'a',pos_order_count:3,lifetime_value:120}).resourceSummary)).toBe('3 orders');
    expect(describeCustomerOrders(buildCustomerFocus({id:'a',pos_order_count:0,total_spent:0}).resourceSummary)).toBe('0 recorded orders');
    expect(describeCustomerOrders(buildCustomerFocus({id:'a'}).resourceSummary)).toBe('order history not on file');
  });
});
