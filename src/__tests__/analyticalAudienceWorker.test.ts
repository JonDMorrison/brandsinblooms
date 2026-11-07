import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {webcrypto} from 'node:crypto';
import ts from 'typescript';
import {describe,it,expect} from 'vitest';
import {planAudienceRefresh,appendAudienceRefreshPlan} from '../../supabase/functions/_shared/customer-intelligence/audience-refresh';
import {readAllPages} from '../../supabase/functions/_shared/customer-intelligence/query-pages';
function harness(fail=false,count=2,claimError?:{name:string;code:string;message:string}){
 const calls:Array<{name:string;args:Record<string,unknown>}>=[];const factScopes:string[][]=[];const errors:unknown[][]=[];let handler:(req:Request)=>Promise<Response>;
 const saved={version:1,id:'set',tenant_id:'tenant',user_id:'user',conversation_id:'conversation',captured_at:'2026-01-01T00:00:00Z',timezone:'UTC',included_ids:['c0'],excluded_ids:[],unknown_ids:[],reasons:{},evidence_ids:{},anchors:{},trail:[{set_id:'set',label:'All',rule:{mode:'all'}}]};
 const client={rpc:async(name:string,args:Record<string,unknown>)=>{calls.push({name,args});return {data:name==='claim_bloom_audience_refresh'?[{id:'audience',tenant_id:'tenant',user_id:'user',source_set_id:'set',version:1,excluded_ids:['c1']}]:true,error:name==='claim_bloom_audience_refresh'?claimError??null:null};},from:(_table:string)=>{const q={select:()=>q,eq:()=>q,is:()=>q,lte:()=>q,order:()=>q,single:async()=>({data:{payload:saved},error:null}),range:async(from:number,to:number)=>({data:Array.from({length:count},(_,i)=>({id:`c${i}`})).slice(from,to+1),error:null})};return q;}};
 const compiled=ts.transpileModule(readFileSync('supabase/functions/refresh-analytical-audiences/index.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 runInNewContext(compiled,{exports:{},Response,Date,crypto:webcrypto,console:{error:(...values:unknown[])=>errors.push(values)},Deno:{env:{get:(key:string)=>key==='SUPABASE_SERVICE_ROLE_KEY'?'service':'https://example.test'}},require:(name:string)=>{
  if(name.startsWith('https:'))return {serve:(fn:typeof handler)=>{handler=fn;}};
  if(name.startsWith('npm:'))return {createClient:()=>client};
  if(name.endsWith('load-analysis-facts.ts'))return {loadCompanyAnalysisFacts:async(_client:unknown,_tenant:string,_cutoff:string,ids:string[])=>{factScopes.push(ids);if(fail)throw Error('private diagnostic');return [];}};
  if(name.endsWith('audience-refresh.ts'))return {planAudienceRefresh,appendAudienceRefreshPlan};
  if(name.endsWith('query-pages.ts'))return {readAllPages};
  throw Error(name);
 }});
 return {calls,factScopes,errors,run:(token='service')=>handler(new Request('https://example.test',{headers:{Authorization:`Bearer ${token}`}}))};
}
describe('scheduled analytical audience worker',()=>{
 it('rejects non-service callers before reading jobs',async()=>{const h=harness();expect((await h.run('user')).status).toBe(401);expect(h.calls).toHaveLength(0);});
 it('publishes only the complete result with manual exclusions and the claimed version/token',async()=>{const h=harness(false,47934);expect((await h.run()).status).toBe(200);expect(h.factScopes).toHaveLength(48);expect(h.factScopes.flat()).toHaveLength(47934);expect(h.calls.filter(c=>c.name==='finish_bloom_audience_refresh')).toHaveLength(1);const commit=h.calls.find(c=>c.name==='finish_bloom_audience_refresh')!;expect(commit.args.p_version).toBe(1);expect(commit.args.p_token).toBe(h.calls[0].args.p_token);expect((commit.args.p_snapshot as {member_ids:string[]}).member_ids).toHaveLength(47933);expect((commit.args.p_snapshot as {member_ids:string[]}).member_ids).not.toContain('c1');});
 it('preserves the previous snapshot, records an actionable stage, and does not expose private errors',async()=>{const h=harness(true);const r=await h.run();expect(r.status).toBe(500);expect(await r.text()).not.toContain('private diagnostic');expect(h.calls.at(-1)?.args.p_snapshot).toBeNull();expect(h.calls.at(-1)?.args.p_error).toContain('previous membership preserved');expect(h.errors[0]).toContain('[refresh-analytical-audiences] refresh failed');expect(h.errors[0]?.[1]).toMatchObject({stage:'build_snapshot',job_id:'audience',error:{message:'private diagnostic'}});});
 it('logs a failed service claim with its PostgREST code and no customer identifiers',async()=>{const h=harness(false,2,{name:'PostgrestError',code:'42501',message:'permission denied for table users'});const r=await h.run();expect(r.status).toBe(500);expect(await r.text()).not.toContain('42501');expect(h.errors[0]?.[1]).toMatchObject({stage:'claim',job_id:null,error:{code:'42501',message:'permission denied for table users'}});expect(h.calls).toHaveLength(1);});
});

describe('analytical audience database worker contract',()=>{
 it('uses tightly scoped definer rights instead of exposing auth.users',()=>{
  const migration=readFileSync('supabase/migrations/20261107010156_enterprise_bloom_support_reliability.sql','utf8');
  for(const signature of [
   'public.save_bloom_analytical_audience(uuid,uuid,text,text,uuid[])',
   'public.claim_bloom_audience_refresh(uuid)',
   'public.finish_bloom_audience_refresh(uuid,uuid,integer,jsonb,text)',
  ]){
   expect(migration).toContain(`ALTER FUNCTION ${signature}\n SECURITY DEFINER`);
   expect(migration).toContain(`ALTER FUNCTION ${signature}\n SET search_path = ''`);
   expect(migration).toContain(`REVOKE ALL ON FUNCTION ${signature}\n FROM PUBLIC, anon, authenticated`);
   expect(migration).toContain(`GRANT EXECUTE ON FUNCTION ${signature}\n TO service_role`);
  }
  expect(migration).not.toMatch(/GRANT\s+SELECT\s+ON\s+auth\.users/i);
 });
});
