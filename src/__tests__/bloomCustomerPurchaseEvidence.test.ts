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
