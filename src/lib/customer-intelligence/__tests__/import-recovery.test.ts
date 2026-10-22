import {describe,it,expect} from 'vitest';
import type {PersistenceClient} from '../../../../supabase/functions/bloom-assist/types';
import {requireUsableIdealDuplicateOwner} from '../../../../supabase/functions/_shared/customer-intelligence/duplicate-import-owner';
import {finishIdealImportPostprocessing} from '../../../../supabase/functions/_shared/customer-intelligence/import-postprocessing';

function ownerClient(row:Record<string,unknown>|null,error:unknown=null){
 const filters:unknown[][]=[];
 const query={select:()=>query,eq:(...args:unknown[])=>{filters.push(args);return query;},maybeSingle:async()=>({data:row,error})};
 return {client:{from:()=>query} as unknown as Pick<PersistenceClient,'from'>,filters};
}
describe('Ideal duplicate ownership recovery boundary',()=>{
 it.each(['processing','completed_with_errors','failed'])('rejects corrected-file duplicates owned by a different %s import',async status=>{
  const {client}=ownerClient({id:'old',tenant_id:'tenant',source:'ideal',status});
  await expect(requireUsableIdealDuplicateOwner(client,'tenant','old','new')).rejects.toThrow('recovery review required');
 });
 it('allows completed owners and exact same-file processing repeats',async()=>{
  for(const [id,status] of [['old','completed'],['new','processing']]){
   const {client,filters}=ownerClient({id,tenant_id:'tenant',source:'ideal',status});
   await expect(requireUsableIdealDuplicateOwner(client,'tenant',id,'new')).resolves.toBeUndefined();
   expect(filters).toEqual([['id',id],['tenant_id','tenant'],['source','ideal']]);
  }
 });
 it('fails closed for missing, foreign, erroneous, or rejected same-file owners',async()=>{
  for(const row of [null,{id:'old',tenant_id:'other',source:'ideal',status:'completed'},{id:'old',tenant_id:'tenant',source:'other',status:'completed'},{id:'new',tenant_id:'tenant',source:'ideal',status:'completed_with_errors'}]){
   await expect(requireUsableIdealDuplicateOwner(ownerClient(row).client,'tenant',row?.id??'old','new')).rejects.toThrow();
  }
  await expect(requireUsableIdealDuplicateOwner(ownerClient(null,{message:'offline'}).client,'tenant','old','new')).rejects.toThrow();
 });
});
describe('Ideal postprocessing outcomes',()=>{
 const scope={tenantId:'tenant',importId:'import',reportType:'coupons_redeemed',accepted:2,duplicates:1,rejected:0,completedAt:'2026-10-22T12:00:00Z'};
 it('surfaces returned errors and permits replay of derived writes without inserting facts',async()=>{
  const writes:unknown[][]=[];let failing=true;
  const client={from:(table:string)=>{const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:null,error:null}),insert:async(...args:unknown[])=>{writes.push([table,...args]);return {error:failing?{}:null};}};return q;},rpc:async(...args:unknown[])=>{writes.push(args);return {error:failing?{}:null};}} as unknown as Pick<PersistenceClient,'from'|'rpc'>;
  expect(await finishIdealImportPostprocessing(client,scope)).toMatchObject({postprocessing_pending:true,warnings:expect.arrayContaining([expect.stringContaining('health')])});
  failing=false;
  expect(await finishIdealImportPostprocessing(client,scope)).toEqual({postprocessing_pending:false,warnings:[]});
  expect(writes[0]).toEqual(writes[1]);expect(writes).toHaveLength(2);
 });
 it('handles thrown failures and skips recalculation for zero accepted rows',async()=>{
  let calls=0;
  const client={from:()=>{throw new Error('private detail');},rpc:async()=>{calls++;return {error:null};}} as unknown as Pick<PersistenceClient,'from'|'rpc'>;
  const result=await finishIdealImportPostprocessing(client,{...scope,accepted:0});
  expect(result.postprocessing_pending).toBe(true);expect(calls).toBe(0);expect(JSON.stringify(result)).not.toContain('private detail');
 });
 it('preserves newer health during older replay and fails closed on concurrent health changes',async()=>{
  for(const newer of [true,false]){
   const mutations:unknown[]=[];const predicates:unknown[][]=[];
   const prior={id:'health',last_validated_at:newer?'2026-10-23T12:00:00Z':'2026-10-21T12:00:00Z'};
   let writing=false;
   const q={select:()=>writing?Promise.resolve({data:[],error:null}):q,eq:(...args:unknown[])=>{predicates.push(args);return q;},maybeSingle:async()=>({data:prior,error:null}),update:(payload:unknown)=>{writing=true;mutations.push(payload);return q;}};
   const client={from:()=>q,rpc:async()=>({error:null})} as unknown as Pick<PersistenceClient,'from'|'rpc'>;
   const result=await finishIdealImportPostprocessing(client,scope);
   expect(result.postprocessing_pending).toBe(!newer);
   expect(mutations).toHaveLength(newer?0:1);
   if(!newer)expect(predicates).toContainEqual(['last_validated_at',prior.last_validated_at]);
  }
 });

 it('preserves metrics instead of invoking the POS-only projection for Ideal sales',async()=>{
  let calls=0;const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:null,error:null}),insert:async()=>({error:null})};
  const client={from:()=>q,rpc:async()=>{calls++;return {error:null};}} as unknown as Pick<PersistenceClient,'from'|'rpc'>;
  for(const reportType of ['customer_sales','customer_sales_by_category']){
   const result=await finishIdealImportPostprocessing(client,{...scope,reportType});
   expect(result.postprocessing_pending).toBe(true);expect(result.warnings[0]).toContain('verified Ideal-specific projection');
  }
  expect(calls).toBe(0);
 });

 it.each([0,2])('marks sales health as attention required for %i new rows, including duplicate-only renamed/replay reports',async accepted=>{
  const writes:unknown[]=[];
  const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:null,error:null}),insert:async(payload:unknown)=>{writes.push(payload);return {error:null};}};
  const client={from:()=>q} as unknown as Pick<PersistenceClient,'from'>;
  for(const reportType of ['customer_sales','customer_sales_by_category']){
   const result=await finishIdealImportPostprocessing(client,{...scope,accepted,duplicates:2,reportType});
   expect(result.postprocessing_pending).toBe(true);
   expect(result.warnings).toEqual([expect.stringContaining('verified Ideal-specific projection')]);
  }
  for(const payload of writes)expect(payload).toMatchObject({status:'attention_required',validation_summary:{projection_status:'unsupported',projection_limitation:expect.stringContaining('retrying this file will not resolve')}});
 });

});
