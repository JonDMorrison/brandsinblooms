import {beforeAll,afterAll,describe,it,expect,vi} from 'vitest';
import {webcrypto} from 'node:crypto';
import {exploreCustomerReportedSpending,loadReportedSpendingEvents} from '../../../../supabase/functions/bloom-assist/tools/implementations/customer-exploration';
import type {PersistenceClient} from '../../../../supabase/functions/bloom-assist/types';
import type {ToolExecutionContext} from '../../../../supabase/functions/bloom-assist/tools/types';
beforeAll(()=>vi.stubGlobal('crypto',webcrypto));afterAll(()=>vi.unstubAllGlobals());
function fixture(){
 const saved: unknown[]=[];
 const customers=['buyer','lower','unknown'].map(id=>({id,first_name:id,last_name:null,email:null,created_at:'2026-01-01T00:00:00Z'}));
 const events=[{id:'a',customer_id:'buyer',amount:'1000.00',raw_data:{kind:'reported_period_spending',currency:'CAD',transactions:2}},{id:'b',customer_id:'lower',amount:'500.00',raw_data:{kind:'reported_period_spending',currency:'CAD',transactions:1}}];
 const filters:{table:string;field:string;value:unknown}[]=[];
 const client={rpc:vi.fn(async(name:string)=>({data:name==='bloom_live_customer_ids'?customers.map(c=>c.id):true,error:null})),from:(table:string)=>{
  const data=table==='crm_customers'?customers:table==='customer_intelligence_source_events'?events:[];
  const q={select:()=>q,eq:()=>q,is:()=>q,lte:()=>q,
    gte:(field:string,value:unknown)=>{filters.push({table,field,value});return q;},
    neq:()=>q,in:async()=>({data,error:null}),order:()=>q,limit:()=>q,range:async()=>({data,error:null}),
    maybeSingle:async()=>({data:table==='bloom_conversations'?{id:'conversation'}:{id:'report',source_filename:'synthetic.xls',source_period_start:'2026-01-01',source_period_end:'2026-10-14'},error:null})};return q;
 }};
 const context={tenantId:'tenant',authenticatedTenantId:'tenant',userId:'user',conversationId:'conversation',timezone:'America/Vancouver',dataClient:client,serviceClient:{from:()=>({insert:async(v:unknown)=>{saved.push(v);return {error:null};}})}} as unknown as ToolExecutionContext;
 return {context,saved,filters};
}
describe('Reported spending audiences',()=>{
 it('saves exact membership with an inclusive threshold and keeps missing history unknown',async()=>{
  const {context,saved}=fixture();const r=await exploreCustomerReportedSpending({scope:'all_customers',label:'Repeat high spend',minimum_spend:1000,minimum_transactions:2},context);
  const d=r.data as Record<string,unknown>;expect(d.included_count).toBe(1);expect(d.excluded_count).toBe(1);expect(d.unknown_count).toBe(1);expect(d.period_end).toBe('2026-10-14');expect(saved).toHaveLength(1);
  expect((saved[0] as {payload:{included_ids:string[]}}).payload.included_ids).toEqual(['buyer']);expect(d.rows).toMatchObject([{customer_id:'buyer',reported_period_spend:1000,reported_transactions:2}]);
 });
 it('saves exactly the top N as the group so "these" means the customers shown',async()=>{
  const {context,saved}=fixture();const r=await exploreCustomerReportedSpending({scope:'all_customers',label:'Top customers',top_n:1},context);
  const payload=(saved[0] as {payload:{included_ids:string[];excluded_ids:string[];reasons:Record<string,string>;trail:{top_n?:number;qualifying_customers?:number}[]}}).payload;
  expect(payload.included_ids).toEqual(['buyer']);
  expect(payload.excluded_ids).toContain('lower');expect(payload.reasons.lower).toBe('outside_top_n');
  expect(payload.trail.at(-1)).toMatchObject({top_n:1,qualifying_customers:2});
  expect((r.data as Record<string,unknown>).included_count).toBe(1);
 });
 it('requires explicit scope and rejects invalid monetary and transaction thresholds',async()=>{
  const {context}=fixture();await expect(exploreCustomerReportedSpending({label:'test'},context)).rejects.toThrow('starting population');
  await expect(exploreCustomerReportedSpending({scope:'all_customers',minimum_spend:-1},context)).rejects.toThrow('threshold');
  await expect(exploreCustomerReportedSpending({scope:'all_customers',minimum_transactions:1.5},context)).rejects.toThrow('whole transaction');
 });
});

describe('reported spending for an existing customer group',()=>{
  it('queries only the saved members in bounded batches and preserves every result',async()=>{
    const ids=Array.from({length:413},(_,i)=>'customer-'+i);
    const chunks:string[][]=[];
    const from=(table:string)=>{
      expect(table).toBe('customer_intelligence_source_events');
      let requested:string[]|null=null;
      const q={select:()=>q,eq:()=>q,lte:()=>q,
        in:(_column:string,selected:string[])=>{requested=selected;chunks.push(selected);return q;},
        order:()=>q,range:async()=>({data:(requested??[]).map(id=>({id,customer_id:id,amount:1,raw_data:{}})),error:null})};
      return q;
    };
    const result=await loadReportedSpendingEvents({from} as unknown as PersistenceClient,
      'tenant','report','2026-11-07T00:00:00Z',ids);
    expect(result).toHaveLength(413);
    expect(chunks.map(chunk=>chunk.length)).toEqual([100,100,100,100,13]);
    expect(new Set(result.map(row=>row.customer_id)).size).toBe(413);
  });
  it('does not query all records when a saved group is empty',async()=>{
    const from=vi.fn();
    expect(await loadReportedSpendingEvents({from} as unknown as PersistenceClient,
      'tenant','report','2026-11-07T00:00:00Z',[])).toEqual([]);
    expect(from).not.toHaveBeenCalled();
  });
});

describe('explicit calendar year in reported spending',()=>{
  it('chooses the requested historical report year rather than silently using the latest period',async()=>{
    const {context,filters}=fixture();
    await exploreCustomerReportedSpending({scope:'all_customers',label:'2025 customers',calendar_year:2025},context);
    expect(filters).toContainEqual({table:'customer_intelligence_imports',field:'source_period_start',value:'2025-01-01'});
  });
  it('rejects invalid years before consulting the database',async()=>{
    const {context}=fixture();
    await expect(exploreCustomerReportedSpending({scope:'all_customers',label:'Invalid',calendar_year:2025.5},context))
      .rejects.toThrow('calendar year');
  });
});
