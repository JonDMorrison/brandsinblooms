import type {PersistenceClient} from '../../bloom-assist/types.ts';
import type {PeriodSummaryEvent} from './period-summary.ts';

const PAGE_SIZE = 250;
// ID-only reads use the covering index and fit PostgREST's 1,000-row cap.
const CUSTOMER_PAGE_SIZE = 1000;
const IMPORT_CONCURRENCY = 4;
const MAXIMUM = 250000;
const limitError = () => new Error('The analysis exceeds the 250,000-record safety limit. No partial total was returned.');

/** Keep each RLS-protected read bounded, including when database pages are cold. */
export async function readLiveCustomerIds(client: PersistenceClient, tenantId: string, cutoff: string): Promise<string[]> {
  const ids: string[] = [];
  let after: string | null = null;
  for (;;) {
    let query = client.from('crm_customers').select('id').eq('tenant_id',tenantId)
      .is('deleted_at',null).is('merged_into_customer_id',null).lte('created_at',cutoff);
    if (after) query = query.gt('id',after);
    const {data,error} = await query.order('id').range(0,CUSTOMER_PAGE_SIZE-1);
    if (error) throw new Error(error.message);
    const page = data as {id:string}[] | null;
    if (!Array.isArray(page) || page.some((row,i)=>typeof row.id!=='string' || (i ? row.id<=page[i-1].id : after!==null && row.id<=after))) throw new Error('The customer cursor did not advance safely.');
    if (ids.length+page.length>MAXIMUM) throw limitError();
    ids.push(...page.map(row=>row.id));
    if (page.length<CUSTOMER_PAGE_SIZE) return ids;
    after=page[page.length-1].id;
  }
}

/** Cursor advances over scanned rows, including pages with no matching products. */
export async function readProductSearchPages(client: PersistenceClient, tenantId: string, cutoff: string, imports: string[], terms: string[], validate: (row:PeriodSummaryEvent)=>void) {
  const candidates: PeriodSummaryEvent[]=[];
  const customer_ids=new Set<string>();
  let total=0;
  // Bound independent import streams without multiplying the JSON page size.
  // Keep import order deterministic when combining their completed results.
  for (let offset=0;offset<imports.length;offset+=IMPORT_CONCURRENCY) {
   const results=await Promise.all(imports.slice(offset,offset+IMPORT_CONCURRENCY).map(async importId=>{
    const localCandidates:PeriodSummaryEvent[]=[];
    const localCustomers=new Set<string>();
    let after: string|null=null;
    for (;;) {
      const {data,error}=await client.rpc('bloom_summary_search_page',{
        p_tenant_id:tenantId,p_import_id:importId,p_cutoff:cutoff,p_after:after,p_term:terms[0],
      });
      if(error)throw new Error(error.message);
      const page=data as {scanned:number;last_id:string|null;customer_ids:string[];candidates:PeriodSummaryEvent[];provenance:PeriodSummaryEvent[]}|null;
      if(!page || !Number.isInteger(page.scanned) || page.scanned<0 || page.scanned>PAGE_SIZE
        || !Array.isArray(page.customer_ids) || page.customer_ids.some(id=>typeof id!=='string') || !Array.isArray(page.candidates)
        || !Array.isArray(page.provenance) || page.provenance.length!==page.scanned
        || page.candidates.length>page.scanned || (page.scanned>0 && (typeof page.last_id!=='string' || (after!==null && page.last_id<=after))))
        throw new Error('The report search cursor did not advance safely.');
      total+=page.scanned;
      if(total>MAXIMUM)throw limitError();
      for(const row of page.provenance)validate(row);
      for(const id of page.customer_ids)localCustomers.add(id);
      localCandidates.push(...page.candidates);
      if(page.scanned<PAGE_SIZE)break;
      after=page.last_id;
    }
    return {candidates:localCandidates,customers:localCustomers};
   }));
   for(const result of results){for(const row of result.candidates)candidates.push(row);for(const id of result.customers)customer_ids.add(id);}
  }
  return {candidates,customer_ids:[...customer_ids]};
}
