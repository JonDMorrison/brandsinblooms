import {describe,it,expect,vi} from 'vitest';
import {readLiveCustomerIds,readProductSearchPages} from '../../../../supabase/functions/_shared/customer-intelligence/bounded-search';
import type {PersistenceClient} from '../../../../supabase/functions/bloom-assist/types';

describe('bounded search reads',()=>{
 it('reads all 47,934 customers with fixed tenant/cutoff and bounded keyset requests',async()=>{
  const rows=Array.from({length:47934},(_,i)=>({id:String(i).padStart(6,'0')}));
  const calls:unknown[][]=[];
  const client={from:(table:string)=>{
   let after='';const q={select:()=>q,eq:(key:string,value:string)=>{calls.push([table,key,value]);return q;},
    is:()=>q,lte:(key:string,value:string)=>{calls.push([key,value]);return q;},gt:(_key:string,value:string)=>{after=value;return q;},order:()=>q,
    range:async(from:number,to:number)=>{expect(from).toBe(0);expect(to).toBe(249);return {data:rows.filter(r=>r.id>after).slice(0,to+1),error:null};}};return q;
  }} as unknown as PersistenceClient;
  expect(await readLiveCustomerIds(client,'tenant','cutoff')).toEqual(rows.map(r=>r.id));
  expect(calls.filter(c=>c[0]==='crm_customers')).toHaveLength(192);
  expect(calls).toContainEqual(['crm_customers','tenant_id','tenant']);
  expect(calls).toContainEqual(['created_at','cutoff']);
 });
 it('continues through full pages with zero matches and resets cursor between imports',async()=>{
  const rpc=vi.fn().mockResolvedValueOnce({data:{scanned:250,provenance:Array.from({length:250},()=>({})),last_id:'a',customer_ids:['nonbuyer'],candidates:[]},error:null})
   .mockResolvedValueOnce({data:{scanned:1,provenance:[{}],last_id:'b',customer_ids:['buyer'],candidates:[{id:'hit'}]},error:null})
   .mockResolvedValueOnce({data:{scanned:0,provenance:[],last_id:null,customer_ids:[],candidates:[]},error:null});
  const result=await readProductSearchPages({rpc} as unknown as PersistenceClient,'t','time',['2025','2026'],['eucalyptus'],()=>undefined);
  expect(result).toEqual({candidates:[{id:'hit'}],customer_ids:['nonbuyer','buyer']});
  expect(rpc.mock.calls.map(c=>[c[1].p_import_id,c[1].p_after])).toEqual([['2025',null],['2025','a'],['2026',null]]);
 });
 it('fails without returning partial data on a later-page timeout',async()=>{
  const rpc=vi.fn().mockResolvedValueOnce({data:{scanned:250,provenance:Array.from({length:250},()=>({})),last_id:'a',customer_ids:['buyer'],candidates:[]},error:null})
   .mockResolvedValueOnce({data:null,error:{message:'statement timeout'}});
  await expect(readProductSearchPages({rpc} as unknown as PersistenceClient,'t','time',['2025'],['sea soil'],()=>undefined)).rejects.toThrow('statement timeout');
  expect(rpc).toHaveBeenCalledTimes(2);
 });
 it('rejects a repeated cursor instead of duplicating an audience',async()=>{
  const rpc=vi.fn().mockResolvedValue({data:{scanned:250,provenance:Array.from({length:250},()=>({})),last_id:'a',customer_ids:[],candidates:[]},error:null});
  await expect(readProductSearchPages({rpc} as unknown as PersistenceClient,'t','time',['2025'],['wreath'],()=>undefined)).rejects.toThrow('cursor');
 });
});
