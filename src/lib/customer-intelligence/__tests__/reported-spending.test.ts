import {beforeAll,afterAll,describe,it,expect,vi} from 'vitest';
import {webcrypto} from 'node:crypto';
import {exploreCustomerReportedSpending} from '../../../../supabase/functions/bloom-assist/tools/implementations/customer-exploration';
import type {ToolExecutionContext} from '../../../../supabase/functions/bloom-assist/tools/types';
beforeAll(()=>vi.stubGlobal('crypto',webcrypto));afterAll(()=>vi.unstubAllGlobals());
function fixture(){
 const saved: unknown[]=[];
 const customers=['buyer','lower','unknown'].map(id=>({id,first_name:id,last_name:null,email:null,created_at:'2026-01-01T00:00:00Z'}));
 const events=[{id:'a',customer_id:'buyer',amount:'1000.00',raw_data:{kind:'reported_period_spending',currency:'CAD',transactions:2}},{id:'b',customer_id:'lower',amount:'500.00',raw_data:{kind:'reported_period_spending',currency:'CAD',transactions:1}}];
 const client={rpc:vi.fn().mockResolvedValue({data:true,error:null}),from:(table:string)=>{
  const data=table==='crm_customers'?customers:table==='customer_intelligence_source_events'?events:[];
  const q={select:()=>q,eq:()=>q,is:()=>q,lte:()=>q,neq:()=>q,order:()=>q,limit:()=>q,range:async()=>({data,error:null}),maybeSingle:async()=>({data:table==='bloom_conversations'?{id:'conversation'}:{id:'report',source_filename:'synthetic.xls',source_period_start:'2026-01-01',source_period_end:'2026-10-14'},error:null})};return q;
 }};
 const context={tenantId:'tenant',authenticatedTenantId:'tenant',userId:'user',conversationId:'conversation',timezone:'America/Vancouver',dataClient:client,serviceClient:{from:()=>({insert:async(v:unknown)=>{saved.push(v);return {error:null};}})}} as unknown as ToolExecutionContext;
 return {context,saved};
}
describe('Reported spending audiences',()=>{
 it('saves exact membership with an inclusive threshold and keeps missing history unknown',async()=>{
  const {context,saved}=fixture();const r=await exploreCustomerReportedSpending({scope:'all_customers',label:'Repeat high spend',minimum_spend:1000,minimum_transactions:2},context);
  const d=r.data as Record<string,unknown>;expect(d.included_count).toBe(1);expect(d.excluded_count).toBe(1);expect(d.unknown_count).toBe(1);expect(d.period_end).toBe('2026-10-14');expect(saved).toHaveLength(1);
  expect((saved[0] as {payload:{included_ids:string[]}}).payload.included_ids).toEqual(['buyer']);expect(d.rows).toMatchObject([{customer_id:'buyer',reported_period_spend:1000,reported_transactions:2}]);
 });
 it('requires explicit scope and rejects invalid monetary and transaction thresholds',async()=>{
  const {context}=fixture();await expect(exploreCustomerReportedSpending({label:'test'},context)).rejects.toThrow('starting population');
  await expect(exploreCustomerReportedSpending({scope:'all_customers',minimum_spend:-1},context)).rejects.toThrow('threshold');
  await expect(exploreCustomerReportedSpending({scope:'all_customers',minimum_transactions:1.5},context)).rejects.toThrow('whole transaction');
 });
});
