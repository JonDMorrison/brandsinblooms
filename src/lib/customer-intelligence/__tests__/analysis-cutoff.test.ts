import {it,expect} from 'vitest';
import {loadCompanyAnalysisFacts} from '../../../../supabase/functions/_shared/customer-intelligence/load-analysis-facts';
import type {PersistenceClient} from '../../../../supabase/functions/bloom-assist/types';
it('does not select an import completed after the source cutoff, even when it started earlier',async()=>{
 type Row=Record<string,unknown>;
 const imports:Row[]=[{id:'new',source:'ideal',status:'completed',created_at:'2026-10-14T08:00:00Z',completed_at:'2026-10-14T12:01:00Z',source_period_start:'2026-01-01',source_period_end:'2026-10-14'}, {id:'old',source:'ideal',status:'completed',created_at:'2026-10-07T08:00:00Z',completed_at:'2026-10-07T12:00:00Z',source_period_start:'2026-01-01',source_period_end:'2026-10-07'}];
 const events=imports.map(r=>({id:r.id,tenant_id:'tenant',customer_id:'buyer',import_id:r.id,source:'ideal',created_at:r.created_at,raw_data:{kind:'purchase_summary',currency:'CAD',period_start:r.source_period_start,period_end:r.source_period_end,items:[['P','Pottery','Pots',1,100,1]]}}));
 const client={from:(table:string)=>{const predicates:Array<(r:Row)=>boolean>=[];const q={select:()=>q,eq:()=>q,order:()=>q,lte:(key:string,v:string)=>{predicates.push(r=>typeof r[key]==='string'&&r[key]<=v);return q;},in:(key:string,v:unknown[])=>{predicates.push(r=>v.includes(r[key]));return q;},range:async()=>({error:null,data:(table==='customer_intelligence_imports'?imports:table==='customer_intelligence_source_events'?events:[]).filter(r=>predicates.every(p=>p(r)))})};return q;}} as unknown as PersistenceClient;
 const facts=await loadCompanyAnalysisFacts(client,'tenant','2026-10-14T12:00:00Z');
 expect(facts).toHaveLength(1);expect(facts[0].import_id).toBe('old');expect(facts[0].source_period_end).toBe('2026-10-07');
});
it('uses bounded UUID ranges and filters gaps to the exact customer batch',async()=>{
 const calls:unknown[][]=[];
 const client={from:(table:string)=>{const q={select:()=>q,eq:()=>q,order:()=>q,gte:(key:string,value:string)=>{calls.push(['gte',key,value]);return q;},lte:(key:string,value:string)=>{calls.push(['lte',key,value]);return q;},range:async()=>({error:null,data:table==='customer_purchase_line_items'?['a','b','c'].map(customer_id=>({id:customer_id,customer_id,tenant_id:'tenant'})):[]})};return q;}} as unknown as PersistenceClient;
 const result=await loadCompanyAnalysisFacts(client,'tenant','2026-10-14T12:00:00Z',['c','a']);
 expect(result.map(r=>r.customer_id)).toEqual(['a','c']);expect(calls).toContainEqual(['gte','customer_id','a']);expect(calls).toContainEqual(['lte','customer_id','c']);
});
