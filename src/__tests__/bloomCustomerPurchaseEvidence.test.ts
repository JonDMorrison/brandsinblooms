import { describe, expect, it } from "vitest";
import { readCustomerPurchaseEvidence } from "../../supabase/functions/_shared/customer-intelligence/customer-purchase-evidence";
import { prefetchEntitySummary } from "../../supabase/functions/bloom-assist/entity-prefetch";
import { getCustomerDetail } from "../../supabase/functions/bloom-assist/tools/implementations/get-customer-detail";
import { queryCustomers } from "../../supabase/functions/bloom-assist/tools/implementations/query-customers";
import type { PersistenceClient } from "../../supabase/functions/bloom-assist/types";
import type { ToolExecutionContext } from "../../supabase/functions/bloom-assist/tools/types";

const TENANT = "11111111-1111-4111-8111-111111111111";
const CUSTOMER = "22222222-2222-4222-8222-222222222222";
const report = {
  start: "2026-01-01",
  end: "2026-10-14",
  spend: 2013.85,
  transactions: 29,
  source: "Customer Spending YTD.xls",
};
// The receipt columns are database defaults; the positive purchase evidence is
// the original IdealPOS period report. The old server paths said 0.00/0 orders.
const reportCustomer = {
  id: CUSTOMER,
  tenant_id: TENANT,
  first_name: "Reported",
  last_name: "Customer",
  email: null,
  phone: null,
  created_at: "2026-10-16T19:04:19Z",
  updated_at: "2026-10-16T19:04:19Z",
  total_spent: 0,
  lifetime_value: 0,
  pos_total_spent: 0,
  pos_order_count: 0,
  first_purchase_date: null,
  last_purchase_date: null,
  order_history: [],
  persona: null,
  persona_id: null,
  custom_fields: {
    ideal_customer_code: "00042",
    ideal_reported_ytd: report,
  },
};

type Call = { table: string; method: string; args: unknown[] };
type QueryError = { message: string; code?: string };

function fakeClient(customer: Record<string, unknown> = reportCustomer, error: QueryError | null = null) {
  const calls: Call[] = [];
  const client = {
    from(table: string) {
      const rows = table === "crm_customers" ? [customer] : [];
      const queryError = table === "crm_customers" ? error : null;
      const result = { data: queryError ? null : rows, error: queryError, count: rows.length };
      const builder: Record<string, unknown> = {};
      for (const method of ["select", "eq", "is", "in", "or", "order", "limit", "range", "ilike"]) {
        builder[method] = (...args: unknown[]) => {
          calls.push({ table, method, args });
          return builder;
        };
      }
      builder.maybeSingle = async () => ({ data: queryError ? null : rows[0] ?? null, error: queryError });
      builder.then = (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve);
      return builder;
    },
  };
  return { client: client as unknown as PersistenceClient, calls };
}

function context(client: PersistenceClient): ToolExecutionContext {
  return {
    tenantId: TENANT,
    authenticatedTenantId: TENANT,
    userId: "user",
    conversationId: "conversation",
    messageId: "message",
    timezone: "America/Vancouver",
    dataClient: client,
    serviceClient: client,
  } as ToolExecutionContext;
}

function expectCompanyScope(calls: Call[]) {
  expect(calls).toContainEqual({ table: "crm_customers", method: "eq", args: ["tenant_id", TENANT] });
  const select = calls.find(call => call.table === "crm_customers" && call.method === "select");
  expect(String(select?.args[0])).toContain("custom_fields");
}

describe("West Coast reported spending stays consistent across Bloom reads", () => {
  it("name search returns the reported period separately from unknown receipt spending", async () => {
    const { client, calls } = fakeClient();
    const result = await queryCustomers({ search: "Reported" }, context(client));
    expect(result.success).toBe(true);
    expect(result.data).toEqual([expect.objectContaining({
      id: CUSTOMER,
      total_spent: "Unknown",
      reported_period_spending: { ...report, currency: "CAD", evidence_basis: "reported_period" },
      purchase_data_note: expect.stringContaining("not lifetime value, dated receipts or order counts"),
    })]);
    expectCompanyScope(calls);
  });

  it("customer detail never turns the reported 29 transactions into orders or lifetime value", async () => {
    const { client, calls } = fakeClient();
    const result = await getCustomerDetail({ customer_id: CUSTOMER }, context(client));
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      id: CUSTOMER,
      reported_period_spending: { ...report, currency: "CAD", evidence_basis: "reported_period" },
      purchase_metrics: {
        total_spent: null,
        lifetime_value: null,
        pos_total_spent: null,
        order_count: null,
        average_order_value: null,
      },
    });
    expectCompanyScope(calls);
    expect(calls).toContainEqual({ table: "crm_customers", method: "eq", args: ["id", CUSTOMER] });
  });

  it("prefetched context includes the exact amount, currency and source period without zero spending", async () => {
    const { client, calls } = fakeClient();
    const result = await prefetchEntitySummary(client, "customer", CUSTOMER, TENANT);
    expect(result?.name).toBe("Reported Customer");
    expect(result?.summaryText).toContain("$2,013.85 CAD reported spending from 2026-01-01 to 2026-10-14");
    expect(result?.summaryText).toContain("29 reported transactions");
    expect(result?.summaryText).toContain("Recorded spending unknown");
    expect(result?.summaryText).not.toMatch(/(?:0\.00|0) (?:total spent|orders)/);
    expectCompanyScope(calls);
  });

  it.each([0, -25.5])("preserves an explicit report total of %s without manufacturing receipt metrics", async spend => {
    const { client } = fakeClient({ ...reportCustomer, custom_fields: { ideal_reported_ytd: { ...report, spend } } });
    const result = await getCustomerDetail({ customer_id: CUSTOMER }, context(client));
    expect(result.data).toMatchObject({
      reported_period_spending: { spend, transactions: 29 },
      purchase_metrics: { total_spent: null, lifetime_value: null, order_count: null },
    });
  });

  it("keeps a zero-transaction report explicit without claiming zero recorded orders", () => {
    const evidence = readCustomerPurchaseEvidence({ ...reportCustomer, custom_fields: { ideal_reported_ytd: { ...report, spend: 0, transactions: 0 } } });
    expect(evidence.reported_period_spending).toMatchObject({ spend: 0, transactions: 0 });
    expect(evidence.order_count).toBeNull();
  });

  it("does not replace positive receipt totals with an overlapping imported report", async () => {
    const { client } = fakeClient({ ...reportCustomer, total_spent: "410.50", pos_order_count: 2, last_purchase_date: "2026-09-03T12:00:00Z" });
    const result = await getCustomerDetail({ customer_id: CUSTOMER }, context(client));
    expect(result.data).toMatchObject({
      reported_period_spending: { spend: 2013.85 },
      purchase_metrics: { total_spent: 410.5, lifetime_value: null, order_count: 2, average_order_value: 205.25 },
    });
    const list = await queryCustomers({}, context(client));
    expect(list.data).toEqual([expect.objectContaining({ total_spent: "410.50", reported_period_spending: expect.objectContaining({ spend: 2013.85 }) })]);
  });

  it("preserves a recorded net-zero balance when independent orders exist", async () => {
    const { client } = fakeClient({ ...reportCustomer, pos_order_count: 2, custom_fields: {} });
    const result = await getCustomerDetail({ customer_id: CUSTOMER }, context(client));
    expect(result.data).toMatchObject({
      reported_period_spending: null,
      purchase_metrics: { total_spent: 0, lifetime_value: 0, order_count: 2, average_order_value: 0 },
    });
  });

  it("preserves recorded negative returns and derives count from nonempty order history", () => {
    const evidence = readCustomerPurchaseEvidence({ ...reportCustomer, total_spent: -18.5, lifetime_value: null, order_history: [{ id: "receipt" }], custom_fields: {} });
    expect(evidence).toMatchObject({ total_spent: -18.5, lifetime_value: null, order_count: 1, reported_period_spending: null });
  });

  it.each([{}, { ideal_reported_ytd: { ...report, spend: "2013.85" } }])("keeps absent or malformed evidence unknown", async custom_fields => {
    const { client } = fakeClient({ ...reportCustomer, custom_fields });
    const result = await queryCustomers({}, context(client));
    expect(result.data).toEqual([expect.objectContaining({ total_spent: "Unknown", reported_period_spending: null })]);
    const detail = await getCustomerDetail({ customer_id: CUSTOMER }, context(client));
    expect(detail.data).toMatchObject({ purchase_metrics: { total_spent: null, lifetime_value: null, order_count: null } });
  });

  it("keeps empty strings and invalid counts unknown instead of coercing them to zero", () => {
    expect(readCustomerPurchaseEvidence({ total_spent: " ", lifetime_value: "", pos_order_count: -1, order_history: [] }))
      .toMatchObject({ total_spent: null, lifetime_value: null, order_count: null });
  });

  it("propagates a failed lookup rather than returning a customer with invented zero metrics", async () => {
    const error = { message: "canceling statement due to statement timeout", code: "57014" };
    const { client } = fakeClient(reportCustomer, error);
    await expect(queryCustomers({}, context(client))).rejects.toEqual(error);
    await expect(getCustomerDetail({ customer_id: CUSTOMER }, context(client))).rejects.toEqual(error);
  });
});

describe('durable saved-group references survive history compaction',()=>{
 const user='user',conversation='conversation',setId='33333333-3333-4333-8333-333333333333';
 const scope={tenantId:TENANT,userId:user,conversationId:conversation,userRole:'admin',userName:null};
 const step={set_id:setId,rule:{mode:'purchased',product:'wreath',start_date:'2025-01-01',end_date:'2025-12-31'},input:20,included:8,excluded:10,unknown:2};
 const snapshot={id:setId,tenant_id:TENANT,user_id:user,conversation_id:conversation,created_at:'2026-11-11T00:00:00Z',snapshot_id:setId,snapshot_tenant:TENANT,snapshot_user:user,snapshot_conversation:conversation,version:1,trail:[step],included_ids:[CUSTOMER],email:'must-not-appear@example.com'};
 function referenceClient(overrides:Record<string,unknown>={},conversationOverrides:Record<string,unknown>={},allowed=true){
  const calls:Call[]=[];
  const client={rpc:async()=>({data:allowed,error:null}),from:(table:string)=>{
   const q:Record<string,unknown>={};
   for(const method of ['select','eq','neq','order','limit'])q[method]=(...args:unknown[])=>{calls.push({table,method,args});return q;};
   q.maybeSingle=async()=>({data:table==='bloom_conversations'?{id:conversation,tenant_id:TENANT,user_id:user,...conversationOverrides}:{...snapshot,...overrides},error:null});return q;
  }} as unknown as PersistenceClient;return {client,calls};
 }
 it('selects bounded metadata and exact ownership, exposing rules/counts but no members',async()=>{
  const {loadSavedCustomerResultContext}=await import('../../supabase/functions/bloom-assist/context-builder');
  const {client,calls}=referenceClient();const result=await loadSavedCustomerResultContext(client,scope);
  expect(result).toContain(setId);expect(result).toContain('wreath');expect(result).toContain('2025-12-31');
  expect(result).not.toContain(CUSTOMER);expect(result).not.toContain('must-not-appear');
  for(const table of ['bloom_conversations','bloom_customer_sets'])for(const [column,value] of [['tenant_id',TENANT],['user_id',user]])expect(calls).toContainEqual({table,method:'eq',args:[column,value]});
  expect(calls).toContainEqual({table:'bloom_customer_sets',method:'eq',args:['conversation_id',conversation]});
  expect(calls).toContainEqual({table:'bloom_conversations',method:'neq',args:['status','deleted']});
  expect(String(calls.find(c=>c.table==='bloom_customer_sets'&&c.method==='select')?.args[0])).not.toMatch(/included_ids|evidence_ids|^.*(?:^|,)payload(?:,|$)/);
 });
 it.each(['tenant_id','user_id','conversation_id','snapshot_tenant','snapshot_user','snapshot_conversation'])('rejects mismatched %s',async key=>{
  const {loadSavedCustomerResultContext}=await import('../../supabase/functions/bloom-assist/context-builder');
  expect(await loadSavedCustomerResultContext(referenceClient({[key]:'other'}).client,scope)).toBeNull();
 });
 it('does not load references without analysis permission or an owned conversation',async()=>{
  const {loadSavedCustomerResultContext}=await import('../../supabase/functions/bloom-assist/context-builder');
  const denied=referenceClient({}, {},false);expect(await loadSavedCustomerResultContext(denied.client,scope)).toBeNull();expect(denied.calls).toEqual([]);
  expect(await loadSavedCustomerResultContext(referenceClient({}, {user_id:'other'}).client,scope)).toBeNull();
  expect(await loadSavedCustomerResultContext(referenceClient({}, {status:'deleted'}).client,scope)).toBeNull();
 });
 it('retains only validated spending source periods and thresholds, not extra customer data',async()=>{
  const {loadSavedCustomerResultContext}=await import('../../supabase/functions/bloom-assist/context-builder');
  const source={report_id:CUSTOMER,period_start:'2025-01-01',period_end:'2025-12-31',minimum_spend:100,minimum_transactions:2};
  const result=await loadSavedCustomerResultContext(referenceClient({trail:[{...step,rule:{mode:'purchased'},reported_spending:{...source,email:'never-include@example.com'}}]}).client,scope);
  expect(result).toContain(JSON.stringify(source));expect(result).not.toContain('never-include');
  expect(result).toContain('explicit purchased criteria with its report dates');
  for(const invalid of [{period_start:'2025-02-30'},{period_end:'2024-12-31'},{minimum_spend:-1},{minimum_transactions:1.5},{report_id:'invented'}]){
   expect(await loadSavedCustomerResultContext(referenceClient({trail:[{...step,reported_spending:{...source,...invalid}}]}).client,scope)).toBeNull();
  }
 });
 it('fails softly for invalid rules, missing client, failed lookup and timeout',async()=>{
  const {loadSavedCustomerResultContext}=await import('../../supabase/functions/bloom-assist/context-builder');
  expect(await loadSavedCustomerResultContext(referenceClient({trail:[{...step,rule:{mode:'invented'}}]}).client,scope)).toBeNull();
  expect(await loadSavedCustomerResultContext(undefined,scope)).toBeNull();
  const failed={rpc:async()=>{throw Error('offline');}} as unknown as PersistenceClient;
  expect(await loadSavedCustomerResultContext(failed,scope)).toBeNull();
  const slow={rpc:()=>new Promise(()=>{})} as unknown as PersistenceClient;
  expect(await loadSavedCustomerResultContext(slow,scope,1)).toBeNull();
 });
});

describe('saved-group email inspection and file export', () => {
  const setId = '33333333-3333-4333-8333-333333333333';
  function savedClient(options: {count?: number; missing?: boolean; allowed?: boolean; wrongOwner?: boolean; uploadError?: boolean; signError?: boolean; contactName?: string; contactOverrides?: Record<string, {email: string | null; first_name?: string | null; last_name?: string | null; custom_fields?: Record<string, unknown>}>} = {}) {
    const calls: Call[] = [], uploaded: string[] = [];
    const ids = Array.from({length: options.count ?? 53}, (_, i) => `member-${i}`);
    const payload = {version:1,id:setId,tenant_id:options.wrongOwner?'other':TENANT,user_id:'user',conversation_id:'conversation',included_ids:ids,excluded_ids:[],unknown_ids:[],trail:[],reasons:Object.fromEntries(ids.map(id=>[id,'matching_purchase'])),evidence_ids:{}};
    const client = {
      rpc: async () => ({data: options.allowed !== false, error:null}),
      from(table:string) {
        let selected: string[] | undefined, range: number[] | undefined, exactId: unknown;
        const q: Record<string,unknown> = {};
        for (const method of ['select','eq','neq','order','limit','is','lte','in','range']) q[method] = (...args: unknown[]) => {
          calls.push({table,method,args});
          if(method==='in'&&args[0]==='id')selected=args[1] as string[];
          if(method==='range')range=args as number[];
          if(method==='eq'&&args[0]==='id')exactId=args[1];
          return q;
        };
        q.maybeSingle=async()=>({data:table==='bloom_conversations'?{id:'conversation'}:exactId&&exactId!==setId?null:{id:setId,payload},error:null});
        q.single=async()=>({data:{id:'audience',mode:'fixed',snapshot:{member_ids:ids,excluded_ids:[],unknown_ids:[],result:{captured_at:'2026-11-12T00:00:00Z'}}},error:null});
        q.then=(resolve:(value:unknown)=>unknown)=> {
          let rows=(selected??ids).filter(id=>!options.missing||id!=='member-0').map(id=>({id,first_name:options.contactName??'Synthetic',last_name:id,email:id==='member-1'?null:`${id}@example.com`,...options.contactOverrides?.[id]}));
          if(range)rows=rows.slice(range[0],range[1]+1);
          return Promise.resolve({data:rows,error:null}).then(resolve);
        };
        return q;
      },
      storage: {from: () => ({upload: async (_path:string, bytes:Uint8Array) => {uploaded.push(new TextDecoder().decode(bytes));return {error:options.uploadError?{message:'upload unavailable'}:null};},createSignedUrl: async(...args:unknown[])=>{calls.push({table:'storage',method:'createSignedUrl',args});return {data:options.signError?null:{signedUrl:'https://example.com/synthetic.csv'},error:options.signError?{message:'sign unavailable'}:null};}})},
    } as unknown as PersistenceClient;
    return {client,calls,uploaded,ids};
  }
  it('registers saved-group export scope without dropping approval or staff restrictions', async () => {
    const {getRegisteredTool}=await import('../../supabase/functions/bloom-assist/tools/registry');
    const tool=getRegisteredTool('export_data');
    expect(tool).toMatchObject({requires_confirmation:true,allowed_roles:['admin','staff'],function:{parameters:{properties:{scope:{enum:['all_customers','previous_result','saved_result']},set_id:{format:'uuid'}}}}});
  });
  it('rejects an approved but unpinned latest-result export without accessing data', async () => {
    const {exportDataImplementation}=await import('../../supabase/functions/bloom-assist/tools/implementations/export-data');
    const {client,calls,uploaded}=savedClient();
    const result=await exportDataImplementation('export_data')!({entity:'customers',format:'csv',scope:'previous_result'},{...context(client),approved:true});
    expect(result).toMatchObject({success:false,error:'export_confirmation_required'});expect(calls).toEqual([]);expect(uploaded).toEqual([]);
  });
  it('shows recorded emails and missing emails on page two without changing membership', async () => {
    const {inspectCustomerSet}=await import('../../supabase/functions/bloom-assist/tools/implementations/customer-exploration');
    const {client,calls}=savedClient();const result=await inspectCustomerSet({set_id:setId,page:2},context(client));
    expect(result.data).toMatchObject({set_id:setId,total_count:53,page:2,rows:[{customer_id:'member-50',email:'member-50@example.com'},{customer_id:'member-51',email:'member-51@example.com'},{customer_id:'member-52',email:'member-52@example.com'}]});
    expect(calls.filter(c=>c.method==='insert')).toEqual([]);
    const first=await inspectCustomerSet({set_id:setId},context(client));
    expect(first.data).toMatchObject({rows:expect.arrayContaining([expect.objectContaining({customer_id:'member-1',email:null})])});
  });
  it.each(['ideal-0123456789abcdef01234567@noemail.local',' CLOVER-synthetic@NOEMAIL.LOCAL ',null,'   '])('keeps missing-email members through inspection and CSV/JSON export: %j', async email => {
    const {inspectCustomerSet}=await import('../../supabase/functions/bloom-assist/tools/implementations/customer-exploration');
    const {exportDataImplementation}=await import('../../supabase/functions/bloom-assist/tools/implementations/export-data');
    const contactOverrides={'member-50':{email,first_name:null,last_name:null}};
    const {client,uploaded,ids,calls}=savedClient({contactOverrides});
    const inspected=await inspectCustomerSet({set_id:setId,page:2},context(client));
    expect(inspected).toMatchObject({count:53,data:{set_id:setId,total_count:53,rows:[{customer_id:'member-50',name:'Customer',email:null},{customer_id:'member-51',email:'member-51@example.com'},{customer_id:'member-52',email:'member-52@example.com'}]}});
    const audience=await inspectCustomerSet({audience_id:'audience',page:2},context(client));
    expect(audience).toMatchObject({count:53,data:{total_count:53,rows:expect.arrayContaining([expect.objectContaining({customer_id:'member-50',name:'Customer',email:null})])}});
    for(const format of ['csv','json']) {
      const result=await exportDataImplementation('export_data')!({entity:'customers',format,scope:'saved_result',set_id:setId},context(client));
      expect(result).toMatchObject({success:true,count:53,data:{row_count:53,total_matching_count:53,truncated:false}});
    }
    expect(uploaded[0].split('\n')).toHaveLength(54);
    expect(uploaded[0].split('\n')[51]).toBe('member-50,,,');
    const json=JSON.parse(uploaded[1]) as {customer_id:string;email:string|null}[];
    expect(json.map(row=>row.customer_id)).toEqual(ids);
    expect(json[50].email).toBeNull();
    expect(uploaded.join('')).not.toMatch(/@noemail\.local/i);
    expect(contactOverrides['member-50'].email).toBe(email);
    expect(calls.some(call=>['update','insert','upsert','delete'].includes(call.method))).toBe(false);
  });
  it.each(['Corrected@Example.com','ideal-customer@example.com','contact@noemail.local.example.com'])('preserves real current addresses despite a stale placeholder flag: %s', async email => {
    const {inspectCustomerSet}=await import('../../supabase/functions/bloom-assist/tools/implementations/customer-exploration');
    const {exportDataImplementation}=await import('../../supabase/functions/bloom-assist/tools/implementations/export-data');
    const {client,uploaded}=savedClient({count:1,contactOverrides:{'member-0':{email,custom_fields:{email_is_placeholder:true}}}});
    const inspected=await inspectCustomerSet({set_id:setId},context(client));
    expect(inspected).toMatchObject({count:1,data:{rows:[{customer_id:'member-0',email}]}});
    await exportDataImplementation('export_data')!({entity:'customers',format:'csv',scope:'saved_result',set_id:setId},context(client));
    expect(uploaded[0].split('\n')[1]).toBe(`member-0,Synthetic,member-0,${email}`);
  });
  it.each(['=SUM(1,2)', '+cmd', '-1+2', '@SUM(1)', '\tformula', '  =SUM(1)'])('neutralizes spreadsheet formulas in CSV contact text but not JSON: %j', async contactName => {
    const {exportDataImplementation}=await import('../../supabase/functions/bloom-assist/tools/implementations/export-data');
    const csv=savedClient({count:1,contactName}), json=savedClient({count:1,contactName});
    await exportDataImplementation('export_data')!({entity:'customers',format:'csv',scope:'saved_result',set_id:setId},context(csv.client));
    expect(csv.uploaded[0]).toContain("'"+contactName);
    await exportDataImplementation('export_data')!({entity:'customers',format:'json',scope:'saved_result',set_id:setId},context(json.client));
    expect(JSON.parse(json.uploaded[0])[0].first_name).toBe(contactName);
  });
  it.each(['csv','json'])('exports all 53 saved members, not the displayed page, as %s',async format=>{
    const {exportDataImplementation}=await import('../../supabase/functions/bloom-assist/tools/implementations/export-data');
    const {client,calls,uploaded}=savedClient();
    const result=await exportDataImplementation('export_data')!({entity:'customers',format,scope:'saved_result',set_id:setId},context(client));
    expect(result).toMatchObject({success:true,count:53,data:{set_id:setId,row_count:53,total_matching_count:53,truncated:false,download_url:'https://example.com/synthetic.csv'}});
    const metadata = result.data as {storage_path:string;file_name:string};
    expect(calls).toContainEqual({table:'storage',method:'createSignedUrl',args:[metadata.storage_path,3600,{download:metadata.file_name}]});
    expect(metadata.file_name).toMatch(new RegExp(`^customers-export-[a-zA-Z0-9._-]+\\.${format}$`));
    expect(metadata.storage_path).toMatch(new RegExp(`/exports/[0-9a-f-]{36}_`));
    expect(uploaded).toHaveLength(1);expect(uploaded[0]).toContain('member-52@example.com');expect(uploaded[0]).not.toContain('Unknown');
    expect(calls).toContainEqual({table:'crm_customers',method:'eq',args:['tenant_id',TENANT]});
    expect(calls).toContainEqual({table:'crm_customers',method:'is',args:['deleted_at',null]});
    expect(calls).toContainEqual({table:'crm_customers',method:'is',args:['merged_into_customer_id',null]});
    expect(calls.filter(c=>c.table==='crm_customers'&&c.method==='in')).toHaveLength(1);
  });
  it.each([{allowed:false},{wrongOwner:true},{missing:true}])('fails closed for inaccessible groups or members: %j',async options=>{
    const {exportDataImplementation}=await import('../../supabase/functions/bloom-assist/tools/implementations/export-data');
    const {client,uploaded}=savedClient(options);
    await expect(exportDataImplementation('export_data')!({entity:'customers',format:'csv',scope:'saved_result',set_id:setId},context(client))).rejects.toThrow();expect(uploaded).toEqual([]);
  });
  it('never substitutes latest or all customers for an unknown exact saved ID',async()=>{
    const {exportDataImplementation}=await import('../../supabase/functions/bloom-assist/tools/implementations/export-data');
    const {client,calls,uploaded}=savedClient();
    await expect(exportDataImplementation('export_data')!({entity:'customers',format:'csv',scope:'saved_result',set_id:CUSTOMER},context(client))).rejects.toThrow('exact saved customer result');
    expect(calls.filter(c=>c.table==='crm_customers')).toEqual([]);expect(uploaded).toEqual([]);
  });
  it.each([{scope:'previous_result',filters:[{field:'email',operator:'is_not_null',entity:'customer'}]},{scope:'all_customers',set_id:setId},{scope:'saved_result',set_id:'previous_result'},{scope:'saved_result',set_id:setId,entity:'products'}])('rejects ambiguous or narrowed saved exports: %j',async invalid=>{
    const {prepareExportDataParams}=await import('../../supabase/functions/bloom-assist/tools/implementations/export-data');
    const {client,uploaded}=savedClient();await expect(prepareExportDataParams({entity:'customers',format:'csv',...invalid},context(client))).rejects.toThrow();expect(uploaded).toEqual([]);
  });
  it.each([0,5001])('does not claim success or create a partial file for %s members',async count=>{
    const {exportDataImplementation}=await import('../../supabase/functions/bloom-assist/tools/implementations/export-data');
    const {client,uploaded}=savedClient({count});const result=await exportDataImplementation('export_data')!({entity:'customers',format:'csv',scope:'previous_result'},context(client));
    expect(result.success).toBe(false);expect(result.data).toBeNull();expect(uploaded).toEqual([]);
  });
  it.each([{uploadError:true},{signError:true}])('does not report a ready download on storage failure: %j',async options=>{
    const {exportDataImplementation}=await import('../../supabase/functions/bloom-assist/tools/implementations/export-data');
    const {client}=savedClient(options);await expect(exportDataImplementation('export_data')!({entity:'customers',format:'csv',scope:'previous_result'},context(client))).rejects.toThrow();
  });
});
