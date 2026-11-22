import '@testing-library/jest-dom/vitest';
import {afterEach,expect,it} from 'vitest';
import {cleanup,render,screen} from '@testing-library/react';
import {CustomerIntelligenceStory} from './CustomerIntelligenceStory';
import type {CustomerIntelligenceDetail} from '@/hooks/useCustomerIntelligenceDetail';
const evidence:CustomerIntelligenceDetail={customer_id:'fixture',lifetime_value:null,average_order_value:null,purchase_frequency:null,days_since_last_purchase:null,purchase_velocity:null,customer_tier:null,total_quantity:5,category_spend:{Houseplants:66},department_spend:null,departments_shopped:1,categories_shopped:1,last_line_item_purchase_at:'2026-11-01'};
afterEach(cleanup);
it('retains category evidence without inventing lifetime value or frequency',()=>{
 render(<CustomerIntelligenceStory intelligence={evidence} onAskBloom={()=>{}}/>);
 expect(screen.getByText(/Recorded lifetime value is not available/)).toBeVisible();
 expect(screen.getByText('Not available')).toBeVisible();
 expect(screen.getByText(/Their strongest category is Houseplants/)).toBeVisible();
 expect(screen.queryByText(/\$0 in recorded lifetime/)).not.toBeInTheDocument();
});
it('shows genuine zero lifetime value and frequency',()=>{
 render(<CustomerIntelligenceStory intelligence={{...evidence,lifetime_value:0,purchase_frequency:0}} onAskBloom={()=>{}}/>);
 expect(screen.getByText(/\$0 in recorded lifetime value/)).toBeVisible();
 expect(screen.getByText('0.0 / month')).toBeVisible();
});
