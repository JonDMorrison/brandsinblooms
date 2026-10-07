import {describe,it,expect,vi} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
import {fetchListHealth,summarizeListHealth,LIST_HEALTH_EVENTS} from '../listHealthData';
function fixture(total=1501,fail=false){
 const events=Array.from({length:total},(_,i)=>({event_type:'sent',customer_email:`person-${i}@example.invalid`}));
 const eventQuery:any={};for(const name of ['select','eq','in','gte','lte','order'])eventQuery[name]=vi.fn(()=>eventQuery);
 eventQuery.range=vi.fn(async(a:number,b:number)=>({data:events.slice(a,b+1),error:fail?{message:'Query unavailable'}:null}));
 const suppression={select:vi.fn(()=>suppression),eq:vi.fn(async()=>({count:7,error:null}))};
 const client={from:vi.fn((table:string)=>table==='email_tracking_events'?eventQuery:suppression)} as unknown as SupabaseClient;
 return {client,eventQuery,suppression};
}
describe('complete, tenant-scoped email list health',()=>{
 it('reads all pages with explicit tenant, event type and date boundaries',async()=>{const f=fixture();const r=await fetchListHealth(f.client,'tenant-a',new Date('2026-10-07T20:00:00Z'));expect(r.totalSent30d).toBe(1501);expect(f.eventQuery.eq).toHaveBeenCalledWith('tenant_id','tenant-a');expect(f.eventQuery.in).toHaveBeenCalledWith('event_type',LIST_HEALTH_EVENTS);expect(f.eventQuery.range).toHaveBeenCalledTimes(2);expect(f.eventQuery.lte).toHaveBeenCalledWith('created_at','2026-10-07T20:00:00.000Z');});
 it('keeps suppressions scoped to the same company',async()=>{const f=fixture(0);expect((await fetchListHealth(f.client,'tenant-b')).suppressedCount).toBe(7);expect(f.suppression.eq).toHaveBeenCalledWith('tenant_id','tenant-b');});
 it('fails rather than returning a healthy result on API errors',async()=>await expect(fetchListHealth(fixture(0,true).client,'t')).rejects.toThrow('Query unavailable'));
 it('refuses unscoped reads',async()=>{const f=fixture();await expect(fetchListHealth(f.client,'')).rejects.toThrow('Choose a company');expect(f.client.from).not.toHaveBeenCalled();});
 it('counts a recipient once per event category',()=>{const r=summarizeListHealth([{event_type:'sent',customer_email:'a'},{event_type:'sent',customer_email:'a'},{event_type:'bounce',customer_email:'a'},{event_type:'bounced',customer_email:'a'}],0);expect(r.totalSent30d).toBe(1);expect(r.bounceCount30d).toBe(1);expect(r.healthStatus).toBe('critical');});
 it('ignores open/click events and missing recipient identities',()=>{const r=summarizeListHealth([{event_type:'sent',customer_email:null},{event_type:'opened',customer_email:'a'}],0);expect(r.totalSent30d).toBe(0);});
});
