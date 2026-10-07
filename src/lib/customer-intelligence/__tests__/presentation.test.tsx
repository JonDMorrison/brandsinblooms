import {describe,expect,it,vi} from 'vitest';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {afterEach} from 'vitest';
import {CustomerAnalysisBlock} from '@/components/bloom/blocks/CustomerAnalysisBlock';
import {customerAnalysisPayload} from '../presentation';
afterEach(cleanup);
const sample={kind:'customer_exploration',set_id:'result-a',included_count:1,excluded_count:2,unknown_count:3,bucket:'included',total_count:1,page:1,
 rows:[{customer_id:'alice',name:'Alice',reason:'Recorded purchase',evidence_count:1}],
 trail:[{set_id:'result-a',label:'Hydrangea buyers',rule:{mode:'purchased',product:'Hydrangea'},input:6,included:1,excluded:2,unknown:3}]};
describe('customer analysis presentation',()=>{
 it('shows all decision buckets and the rule trail',()=>{render(<MemoryRouter><CustomerAnalysisBlock data={sample}/></MemoryRouter>);expect(screen.getByText('Included: 1')).toBeTruthy();expect(screen.getByText('Excluded: 2')).toBeTruthy();expect(screen.getByText('Unknown: 3')).toBeTruthy();expect(screen.getByText('How this group was selected')).toBeTruthy();});
 it('uses the exact result ID when inspecting exclusions',()=>{const action=vi.fn();render(<MemoryRouter><CustomerAnalysisBlock data={sample} onAction={action}/></MemoryRouter>);fireEvent.click(screen.getByRole('button',{name:'Excluded: 2'}));expect(action).toHaveBeenCalledWith(expect.stringContaining('result-a'));expect(action).toHaveBeenCalledWith(expect.stringContaining('excluded'));});
 it('requests confirmation and does not send when saving a segment',()=>{const action=vi.fn();render(<MemoryRouter><CustomerAnalysisBlock data={sample} onAction={action}/></MemoryRouter>);fireEvent.click(screen.getByRole('button',{name:'Save as segment'}));expect(action).toHaveBeenCalledWith(expect.stringContaining('before confirmation'));expect(action).toHaveBeenCalledWith(expect.stringContaining('Do not send'));});
 it('does not let an empty result become a fake successful segment',()=>{render(<MemoryRouter><CustomerAnalysisBlock data={{...sample,included_count:0,rows:[]}} onAction={vi.fn()}/></MemoryRouter>);expect(screen.queryByRole('button',{name:'Save as segment'})).toBeNull();});
 it('renders imported text without interpreting it as HTML',()=>{render(<MemoryRouter><CustomerAnalysisBlock data={{...sample,rows:[{name:'<script>bad()</script>'}]}}/></MemoryRouter>);expect(screen.getAllByText('<script>bad()</script>').length).toBeGreaterThan(0);expect(document.querySelector('script')).toBeNull();});
 it('recognizes nested tool results without affecting ordinary tables',()=>{expect(customerAnalysisPayload({data:{result:sample}})).toBe(sample);expect(customerAnalysisPayload({rows:[{id:'abc'}]})).toBeNull();});
 it('shows null growth values as unknown, not zero',()=>{render(<MemoryRouter><CustomerAnalysisBlock data={{kind:'customer_growth',rows:[{name:'Alice',growth_index:null,state:'incomplete_data'}]}}/></MemoryRouter>);expect(screen.getByText('Unknown')).toBeTruthy();});
});
