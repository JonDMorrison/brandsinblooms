import {describe,it,expect} from 'vitest';
import {loadCustomerProductHistory,matchesProductQuery,ProductHistoryNotFound} from '../../../../supabase/functions/_shared/customer-intelligence/customer-product-history';
import {toolFailureResult,isTimeoutFailure} from '../../../../supabase/functions/bloom-assist/tools/failure';
import {customerExplorationTools} from '../../../../supabase/functions/bloom-assist/tools/customer-exploration-registry';
import type {PersistenceClient} from '../../../../supabase/functions/bloom-assist/types';

// Shapes copied from West Coast Gardens production rows for John Pasca (code 18712), trimmed.
const WEST_COAST='c190325a-5da0-49f6-b374-187464762021', OTHER_TENANT='0a626809-0000-4000-8000-000000000000';
const JOHN='0a98530f-931b-4ce5-865f-377f6c6f4d4e', SOMEONE_ELSE='11111111-1111-4111-8111-111111111111';
const YTD={id:'e9c23c47-18fa-5572-8d51-1daae3fcf0e1',tenant_id:WEST_COAST,status:'completed',source:'ideal',report_type:'customer_sales_summary',
  source_sha256:'2debeacf30102ad170f10a47702f9c64285c174ad758194e3a9f00eef3bca2cb',source_filename:'Customer Sales YTD-20261014141438.csv',
  source_period_start:'2026-01-01',source_period_end:'2026-10-14',created_at:'2026-10-16T18:59:55Z',completed_at:'2026-10-16T19:20:12Z',reconciliation:{}};
const ANNUAL_2025={...YTD,id:'1394ca3c-45b9-4c34-a13a-fa2b72e3627b',source_sha256:'a78228ee4dc959d98411f7170dd034f05d9ef9d53f4bfa96d9fd5988ba332a09',
  source_filename:'Customer Sales Report 2025.xls.xls',source_period_start:'2025-01-01',source_period_end:'2025-12-31',created_at:'2026-10-21T20:03:08Z',completed_at:'2026-10-21T21:32:12Z'};
const ytdEvent={id:'c6b18665-742e-4272-b3e2-92fc4406aece',tenant_id:WEST_COAST,customer_id:JOHN,external_customer_code:'18712',import_id:YTD.id,source:'ideal',event_type:'purchase_summary',created_at:'2026-10-16T19:15:13Z',
  raw_data:{kind:'purchase_summary',currency:'CAD',period_start:'2026-01-01',period_end:'2026-10-14',source_filename:YTD.source_filename,dated_transactions:false,
    columns:['product_code','product_name','department','quantity','net_amount','source_row'],
    items:[['A4-COL','4in Coleus','101    Annuals',7,25.14,22611],['7144992','GP Bone Meal 8kg','502    Outdoor Fertilizer',2,79.99,22662],
      ['754','32L Sea Soil Original','901    Bagged Outdoor Soil',14,111.86,22678],['BS-00002','52L Sea Soil Complete','901    Bagged Outdoor Soil',10,142.7,22686],
      ['BS-00003','32L WCG Prem. Planter Box Soil','901    Bagged Outdoor Soil',1,11.99,22687],['BULK-CMCH-BAG','Composted Mulch 30L Bag','3,501    Bulk Soil / Compost',4,38.37,22697]]}};
const annualEvent={id:'61d0eacf-e0b4-4e49-bd0e-d63af2ae68d6',tenant_id:WEST_COAST,customer_id:JOHN,external_customer_code:'18712',import_id:ANNUAL_2025.id,source:'ideal',event_type:'purchase_summary',created_at:'2026-10-21T20:08:50Z',
  raw_data:{kind:'purchase_summary',currency:'CAD',period_start:'2025-01-01',period_end:'2025-12-31',source_sha256:ANNUAL_2025.source_sha256,
    items:[['754','32L Sea Soil Original','DPT 901    Bagged Outdoor Soil',5,39.95,148383],['SH-HYDR-1699','$16.99 Hydrangea','DPT 202    Shrubs',12,203.88,148243],
      ['PMKN-CARV-Reg','Carver Pumpkin $0.80/lb','DPT 105    Pumpkins',22.88,14.64,148235]]}};
const john={id:JOHN,tenant_id:WEST_COAST,external_id:'18712',first_name:'John',last_name:'Pasca',email:null,deleted_at:null};

type Row=Record<string,unknown>;
interface Tables {[table:string]:Row[]}
/** In-memory PostgREST stand-in that really applies eq/in/is filters, so scoping bugs show up as wrong data. */
function db(tables:Tables,options:{fail?:{table:string;error:{message:string;code?:string}}}={}){
  const calls:{table:string;filters:[string,string,unknown][]}[]=[];
  const client={from(table:string){
    const filters:[string,string,unknown][]=[];calls.push({table,filters});
    const rows=()=>(tables[table]??[]).filter(row=>filters.every(([op,key,value])=>op==='eq'?row[key]===value:op==='in'?(value as unknown[]).includes(row[key]):op==='is'?(row[key]??null)===value:true));
    const result=(data:unknown)=>options.fail?.table===table?{data:null,error:options.fail.error}:{data,error:null};
    const q={select:()=>q,eq:(k:string,v:unknown)=>{filters.push(['eq',k,v]);return q;},in:(k:string,v:unknown[])=>{filters.push(['in',k,v]);return q;},
      is:(k:string,v:unknown)=>{filters.push(['is',k,v]);return q;},lte:()=>q,order:()=>q,
      range:async(from:number,to:number)=>result(rows().slice(from,to+1)),maybeSingle:async()=>result(rows()[0]??null)};
    return q;}};
  return {client:client as unknown as PersistenceClient,calls};
}
const base=():Tables=>({crm_customers:[john],customer_intelligence_imports:[YTD,ANNUAL_2025],customer_intelligence_source_events:[ytdEvent,annualEvent],customer_purchase_line_items:[]});
const load=(tables:Tables,productQuery:string|null='soil',customerId=JOHN,tenantId=WEST_COAST)=>loadCustomerProductHistory(db(tables).client,{tenantId,customerId,cutoff:'2026-11-02T07:00:00Z',productQuery});

describe('Bloom per-customer product history (West Coast / John Pasca)',()=>{
  it('answers “what soil did he buy” from his reported evidence, never with “no purchases”',async()=>{
    const result=await load(base());
    expect(result.status).toBe('matched');
    const ytd=result.groups[0];
    expect(ytd).toMatchObject({evidence_kind:'reported_period_total',period_start:'2026-01-01',period_end:'2026-10-14',source_filename:'Customer Sales YTD-20261014141438.csv',total_products:6,matched_products:4,currency:'CAD'});
    expect(ytd.rows.map(r=>[r.product_name,r.quantity,r.net_amount])).toEqual([
      ['52L Sea Soil Complete',10,142.7],['32L Sea Soil Original',14,111.86],['Composted Mulch 30L Bag',4,38.37],['32L WCG Prem. Planter Box Soil',1,11.99]]);
    expect(ytd.matched_net_amount).toBe(304.92);
    expect(ytd.rows.every(r=>r.purchased_at===null)).toBe(true);
    expect(result.note).toMatch(/no individual purchase dates/);
  });
  it('keeps each source period separate, newest first, and never adds periods together',async()=>{
    const result=await load(base(),null);
    expect(result.groups.map(g=>[g.period_start,g.period_end,g.total_products])).toEqual([['2026-01-01','2026-10-14',6],['2025-01-01','2025-12-31',3]]);
    expect(result.groups[1].matched_quantity).toBe(39.88); // decimal pumpkin pounds preserved
  });
  it('does not revive a retained snapshot that a newer cumulative report superseded',async()=>{
    const tables=base();
    const replacement={...ANNUAL_2025,id:'22222222-2222-4222-8222-222222222222',source_sha256:'b'.repeat(64),created_at:'2026-10-25T00:00:00Z',completed_at:'2026-10-25T00:00:00Z',
      reconciliation:{superseded_sources:[{sourceSha:ANNUAL_2025.source_sha256,periodStart:'2025-01-01',periodEnd:'2025-12-31'}]}};
    tables.customer_intelligence_imports=[replacement,YTD,ANNUAL_2025];
    const result=await load(tables,null);
    expect(result.groups.map(g=>g.import_id)).toEqual([YTD.id]);
  });
  it('reads only this customer through the customer index, scoped to the company',async()=>{
    const {client,calls}=db(base());
    await loadCustomerProductHistory(client,{tenantId:WEST_COAST,customerId:JOHN,cutoff:'2026-11-02T07:00:00Z',productQuery:'soil'});
    for(const call of calls.filter(c=>c.table!=='customer_intelligence_imports'))
      expect(call.filters).toEqual(expect.arrayContaining([['eq','tenant_id',WEST_COAST],[call.table==='crm_customers'?'eq':'eq',call.table==='crm_customers'?'id':'customer_id',JOHN]]));
    expect(calls.filter(c=>c.table==='crm_customers')).toHaveLength(1); // no company-wide customer scan
  });
  it('isolates tenants: another company cannot read John, and foreign rows are rejected',async()=>{
    await expect(load(base(),'soil',JOHN,OTHER_TENANT)).rejects.toBeInstanceOf(ProductHistoryNotFound);
    const leaked=base();leaked.customer_intelligence_source_events=[{...ytdEvent,tenant_id:OTHER_TENANT}];leaked.customer_intelligence_imports=[YTD];
    expect((await load(leaked)).status).toBe('no_purchase_evidence'); // filtered out, never merged in
    const reassigned=base();reassigned.customer_intelligence_source_events=[{...ytdEvent,external_customer_code:'99999'}];
    await expect(load(reassigned)).rejects.toThrow(/customer code/);
  });
  it('reports unknown history, not “no purchases”, when nothing is on file',async()=>{
    const empty=base();empty.crm_customers=[{...john,id:SOMEONE_ELSE}];empty.customer_intelligence_source_events=[];
    const result=await load(empty,'soil',SOMEONE_ELSE);
    expect(result).toMatchObject({status:'no_purchase_evidence',groups:[]});
    expect(result.note).toMatch(/unknown history, not proof that the customer bought nothing/);
  });
  it('distinguishes evidence with no matching product from missing evidence',async()=>{
    const result=await load(base(),'orchid');
    expect(result.status).toBe('no_matching_products');
    expect(result.note).toMatch(/imported records only/);
  });
  it('surfaces a database timeout as a failure, never as an empty history',async()=>{
    const {client}=db(base(),{fail:{table:'customer_intelligence_source_events',error:{message:'canceling statement due to statement timeout',code:'57014'}}});
    const failure=await loadCustomerProductHistory(client,{tenantId:WEST_COAST,customerId:JOHN,cutoff:'2026-11-02T07:00:00Z',productQuery:'soil'}).then(()=>null,(e:unknown)=>e);
    expect(failure).toBeInstanceOf(Error);
    const result=toolFailureResult('get_customer_product_history',failure);
    expect(result).toMatchObject({success:false,error:'timeout_error',data:null});
    expect(result.message).toMatch(/timed out/);
    expect(result.message).toMatch(/not evidence that the customer bought nothing/);
  });
  it('classifies Postgres/PostgREST error objects and keeps other tools’ messages plain',()=>{
    expect(isTimeoutFailure('anything','57014')).toBe(true);
    expect(toolFailureResult('explore_customer_purchases',{message:'canceling statement due to statement timeout',code:'57014'}).error).toBe('timeout_error');
    expect(toolFailureResult('query_campaigns',new Error('boom'))).toMatchObject({error:'execution_error',message:'boom'});
  });
  it('matches literal words only, with simple plurals',()=>{
    const row={product_code:'754',product_name:'32L Sea Soil Original',department:'901 Bagged Outdoor Soil',sales_category:null};
    expect(matchesProductQuery(row,'soils')).toBe(true);
    expect(matchesProductQuery(row,'sea soil')).toBe(true);
    expect(matchesProductQuery(row,'.*')).toBe(false);
  });
  it('registers a read-only, single-customer tool',()=>{
    const tool=customerExplorationTools.find(t=>t.function.name==='get_customer_product_history');
    expect(tool).toMatchObject({category:'query',requires_confirmation:false});
    expect((tool!.function.parameters as {required:string[]}).required).toEqual(['customer_id']);
  });
});
