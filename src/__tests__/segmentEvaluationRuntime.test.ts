import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import * as evaluator from '../../supabase/functions/_shared/segmentEvaluator';
import { readAllPages } from '../../supabase/functions/_shared/customer-intelligence/query-pages';

type Row = Record<string, unknown>;
type Result = { data: Row[] | null; error: { message: string } | null };
type Chain = PromiseLike<Result> & {
  select: (...args: unknown[]) => Chain; eq: (key: string, value: unknown) => Chain;
  is: (key: string, value: unknown) => Chain; in: (key: string, values: unknown[]) => Chain;
  order: (...args: unknown[]) => Chain; range: (from: number, to: number) => Chain;
  upsert: (rows: Row[], options: unknown) => Chain; delete: () => Chain; update: (row: Row) => Chain;
};
function harness(options: { count?: number; membershipCount?: number; allowed?: boolean; failPage?: boolean } = {}) {
  const tenant = '11111111-1111-4111-8111-111111111111';
  const segments: Row[] = [{ id: 'segment', tenant_id: tenant, auto_update: true, status: 'active', deleted_at: null,
    conditions: { kind: 'group', operator: 'AND', children: [{ kind: 'rule', fieldId: 'custom:garden', operatorId: 'equals', value: true }] } }];
  const customers: Row[] = Array.from({ length: options.count ?? 1 }, (_, i) => ({ id: `c${String(i).padStart(6, '0')}`, tenant_id: tenant, deleted_at: null, merged_into_customer_id: null, custom_fields: { garden: true } }));
  const members: Row[] = Array.from({length: options.membershipCount ?? Math.min(1001, customers.length)}, (_, i) => ({customer_id: customers[i % customers.length].id, segment_id: 'segment'}));
  const state = { reads: 0, writes: 0, rpcCalls: 0, count: 0, batches: [] as number[] };
  let handler: (req: Request) => Promise<Response> = async () => new Response('', {status: 599});
  function from(table: string): Chain {
    state.reads++;
    const predicates: Array<(row: Row) => boolean> = []; let start = 0, end = 999;
    let mutation: 'upsert' | 'delete' | 'update' | null = null, payload: Row[] = [];
    const chain: Chain = {
      select: () => chain, order: () => chain,
      eq: (key, value) => { predicates.push(row => row[key] === value); return chain; },
      is: (key, value) => { predicates.push(row => (row[key] ?? null) === value); return chain; },
      in: (key, values) => { predicates.push(row => values.includes(row[key])); return chain; },
      range: (first, last) => {start = first; end = last; return chain;},
      upsert: rows => {mutation = 'upsert'; payload = rows; return chain;},
      delete: () => {mutation = 'delete'; return chain;},
      update: row => {mutation = 'update'; payload = [row]; return chain;},
      then: (resolve, reject) => {
        const result = async (): Promise<Result> => {
          if(mutation){state.writes++;if(mutation==='upsert'){state.batches.push(payload.length);members.push(...payload);}if(mutation==='update')state.count=Number(payload[0].customer_count);return {data:[],error:null};}
          if(table==='crm_customers' && start>=1000 && options.failPage)return {data:null,error:{message:'source page unavailable'}};
          const rows = table==='crm_segments'?segments:table==='crm_customers'?customers:members;
          return {data:rows.filter(row=>predicates.every(p=>p(row))).slice(start,end+1),error:null};
        };
        return result().then(resolve,reject);
      },
    };
    return chain;
  }
  const service = { from, auth: { getUser: async () => ({data:{user:{id:'user'}},error:null}) } };
  const caller = { rpc: async () => {state.rpcCalls++;return {data:options.allowed!==false,error:null};} };
  const source=readFileSync('supabase/functions/evaluate-segments/index.ts','utf8');
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  runInNewContext(compiled, {
    exports: {}, Request, Response, console, Date, Map, Set,
    Deno: { env: { get: (key: string) => ({SUPABASE_URL:'https://example.test',SUPABASE_SERVICE_ROLE_KEY:'service',SUPABASE_ANON_KEY:'anon'}[key]) }, serve: (fn: typeof handler) => {handler=fn;} },
    require: (name: string) => {
      if(name==='npm:@supabase/supabase-js@2')return {createClient: (_url: string, key: string) => key==='service'?service:caller};
      if(name.endsWith('query-pages.ts'))return {readAllPages};
      if(name.endsWith('segmentEvaluator.ts'))return evaluator;
      if(name.endsWith('eligibleEmailAudience.ts'))return {resolveEligibleEmailCustomerIds:async()=>new Set<string>()};
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  return {state,tenant,run:(body: Row, token='user')=>handler(new Request('https://example.test',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body)}))};
}

describe('segment evaluation runtime boundaries',()=>{
  it('rejects a user request without a tenant before any service data read',async()=>{
    const h=harness();expect((await h.run({})).status).toBe(403);expect(h.state.reads).toBe(0);expect(h.state.writes).toBe(0);
  });
  it('rejects a denied tenant or company-wide permission before service data access',async()=>{
    const h=harness({allowed:false});expect((await h.run({tenant_id:h.tenant})).status).toBe(403);expect(h.state.rpcCalls).toBe(2);expect(h.state.reads).toBe(0);
  });
  it('evaluates more than 10,000 customers and more than one membership page without truncated counts',async()=>{
    const h=harness({count:10500});const response=await h.run({tenant_id:h.tenant});expect(response.status).toBe(200);
    const body=await response.json();expect(body.results[0]).toMatchObject({previous_count:1001,new_count:10500,entered:9499,exited:0});expect(h.state.count).toBe(10500);expect(Math.max(...h.state.batches)).toBeLessThanOrEqual(500);
  });
  it('reads 150,000 memberships without exceeding runtime argument limits',async()=>{
    const h=harness({count:47934,membershipCount:150000});expect((await h.run({tenant_id:h.tenant})).status).toBe(200);expect(h.state.count).toBe(47934);
  });
  it('fails before mutation if a later customer page cannot be read',async()=>{
    const h=harness({count:1500,failPage:true});expect((await h.run({tenant_id:h.tenant})).status).toBe(500);expect(h.state.writes).toBe(0);
  });
  it('preserves internal service-only cross-company evaluation',async()=>{
    const h=harness();expect((await h.run({},'service')).status).toBe(200);expect(h.state.rpcCalls).toBe(0);
  });
});
