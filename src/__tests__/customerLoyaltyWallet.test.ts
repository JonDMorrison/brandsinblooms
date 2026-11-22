import { describe, expect, it } from "vitest";
import { buildCustomerLoyaltyWallet } from "../../supabase/functions/validate-preference-token/customerLoyaltyWallet";

const base = {
  status: "active",
  balance: 125,
  balance_unit: "points",
  currency: null,
  last_synced_at: "2026-09-03T12:00:00Z",
};

describe("customer loyalty wallet", () => {
  it("prefers live provider accounts over imported baselines", () => {
    const wallet = buildCustomerLoyaltyWallet([
      {
        ...base,
        provider: "legacy_metrics",
        program_name: "Imported loyalty metrics",
        balance: 90,
      },
      {
        ...base,
        provider: "crm_import",
        program_name: "Imported POS loyalty balance",
        balance_unit: "unknown",
        balance: 25,
      },
      {
        ...base,
        provider: "square",
        program_name: "Square Loyalty",
      },
    ]);

    expect(wallet).toEqual([
      {
        provider: "square",
        programName: "Square Loyalty",
        balance: 125,
        balanceUnit: "points",
        currency: null,
        lastSyncedAt: "2026-09-03T12:00:00Z",
      },
    ]);
  });

  it("uses the typed legacy balance before an unknown imported balance", () => {
    const wallet = buildCustomerLoyaltyWallet([
      { ...base, provider: "crm_import", balance_unit: "unknown" },
      { ...base, provider: "legacy_metrics", balance: "75" },
    ]);

    expect(wallet).toHaveLength(1);
    expect(wallet[0]).toMatchObject({
      provider: "legacy_metrics",
      balance: 75,
      balanceUnit: "points",
    });
  });

  it("rejects inactive, negative, or malformed balances", () => {
    expect(
      buildCustomerLoyaltyWallet([
        { ...base, provider: "square", status: "archived" },
        { ...base, provider: "square", balance: -1 },
        { ...base, provider: "square", balance_unit: "currency" },
      ]),
    ).toEqual([]);
  });

  it("returns sanitized fields without provider identifiers", () => {
    const [entry] = buildCustomerLoyaltyWallet([
      {
        ...base,
        provider: "square",
        external_account_id: "secret-provider-id",
      },
    ]);

    expect(entry).not.toHaveProperty("external_account_id");
    expect(Object.keys(entry).sort()).toEqual(
      [
        "balance",
        "balanceUnit",
        "currency",
        "lastSyncedAt",
        "programName",
        "provider",
      ].sort(),
    );
  });
});

import {vi} from 'vitest';
import {readNativeRewardBalances,NATIVE_BALANCE_URL,nativeRewardSignature} from '../../supabase/functions/_shared/nativeRewardBalances';
describe('native POS balance read contract',()=>{
 const context={mappingId:'mapping',programmeId:'programme',programmeVersionId:'version',programName:'Garden rewards',currency:'CAD',keyId:'read-key',secret:'synthetic-read-secret-at-least-32-bytes',posTenantId:'pos-business',crmTenantId:'crm-business',customerId:'customer',activationId:'activation',eligible:true};
 const database=(changes:Record<string,unknown>={})=>({rpc:vi.fn(async()=>({data:[{...context,...changes}],error:null}))});
 const available=(changes:Record<string,unknown>={})=>Response.json({status:'available',authority:'bloom_pos',unit:'currency',currency:'CAD',activationId:'activation',availableMinor:0,balanceMinor:0,observedAt:new Date().toISOString(),...changes});
 it('signs only the fixed POS endpoint and keeps a real zero distinct from unavailable',async()=>{
  const db=database(),fetcher=vi.fn<typeof fetch>().mockResolvedValue(available());
  const [entry]=await readNativeRewardBalances(db,'crm-business','customer',fetcher);
  expect(entry).toMatchObject({status:'available',availableMinor:0,balanceMinor:0,currency:'CAD',authority:'bloom_pos'});
  const [url,options]=fetcher.mock.calls[0];expect(url).toBe(NATIVE_BALANCE_URL);expect(options?.redirect).toBe('error');
  const headers=options?.headers as Record<string,string>;
  expect(headers['x-bloom-signature']).toBe(await nativeRewardSignature(context.secret,headers['x-bloom-timestamp'],String(options?.body)));
  expect(JSON.stringify(entry)).not.toContain(context.secret);expect(entry).not.toHaveProperty('keyId');
 });
 it('does not infer a balance for unconfirmed membership or changed programme versions',async()=>{
  const fetcher=vi.fn();const [entry]=await readNativeRewardBalances(database({eligible:false}),'crm-business','customer',fetcher);
  expect(entry).toMatchObject({status:'unavailable',availableMinor:null,reason:'membership_or_programme_requires_review'});expect(fetcher).not.toHaveBeenCalled();
 });
 it('rejects foreign currency, activation, stale timestamps and impossible spendable amounts',async()=>{
  for(const value of [{currency:'USD'},{activationId:'foreign'},{availableMinor:100,balanceMinor:0},{availableMinor:0.5},{observedAt:'2000-01-01T00:00:00Z'}]){
   const [entry]=await readNativeRewardBalances(database(),'crm-business','customer',vi.fn().mockResolvedValue(available(value)));
   expect(entry.status).toBe('unavailable');expect(entry.availableMinor).toBeNull();
  }
 });
 it('keeps missing links and outages unavailable without granting rewards or inventing zero',async()=>{
  for(const response of [Response.json({status:'unavailable',reason:'customer_not_linked'}),new Response('offline',{status:503})]){
   const [entry]=await readNativeRewardBalances(database(),'crm-business','customer',vi.fn().mockResolvedValue(response));
   expect(entry.status).toBe('unavailable');expect(entry.availableMinor).toBeNull();
  }
  const fetcher=vi.fn();await expect(readNativeRewardBalances(database({crmTenantId:'foreign'}),'crm-business','customer',fetcher)).rejects.toThrow('scope');expect(fetcher).not.toHaveBeenCalled();
 });
});

import {readFileSync} from 'node:fs';
import React from 'react';
import {cleanup,render,screen} from '@testing-library/react';
import {NativeRewardBalanceList} from '@/components/crm/customer-dashboard/NativeRewardBalanceList';
it('labels native authority and unavailable separately from an actual currency zero',()=>{
 const base={mappingId:'one',programmeId:'p',programmeVersionId:'v',programName:'Native rewards',authority:'bloom_pos' as const,unit:'currency' as const,currency:'CAD',observedAt:'2026-11-21T00:00:00Z',reason:null};
 render(React.createElement(NativeRewardBalanceList,{balances:[{...base,status:'available',availableMinor:0,balanceMinor:0},{...base,mappingId:'two',status:'unavailable',availableMinor:null,balanceMinor:null,reason:'customer_not_linked'}]}));
 expect(screen.getByText(/\$0.00/)).toBeInTheDocument();expect(screen.getByText('Unavailable')).toBeInTheDocument();expect(screen.getAllByText('Authority: BloomPOS · CAD')).toHaveLength(2);expect(screen.getByText(/no verified POS identity link/)).toBeInTheDocument();cleanup();
});
it('staff balance handler rejects foreign scope, oversized input and unknown customers before service reads',async()=>{
 const ts=await import('typescript');
 const text=readFileSync('supabase/functions/native-reward-balances/index.ts','utf8').replace(/^import .*;$/gm,'');
 let handler:(request:Request)=>Promise<Response>=async()=>new Response(null,{status:500});
 const tenant='00000000-0000-4000-8000-000000000001',customer='00000000-0000-4000-8000-000000000002';
 let known=true;const scopes:unknown[][]=[];
 const client={auth:{getUser:async()=>({data:{user:{id:'owner'}},error:null})},rpc:async()=>({data:{tenantId:tenant,permissions:['customers.read']},error:null}),from:()=>{
  const query={select:()=>query,eq:(...args:unknown[])=>{scopes.push(args);return query;},is:()=>query,maybeSingle:async()=>({data:known?{id:customer}:null,error:null})};return query;
 }};
 const read=vi.fn(async()=>[]);
 new Function('Deno','createClient','readNativeRewardBalances',ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText)({serve:(fn:typeof handler)=>{handler=fn;},env:{get:(name:string)=>name==='SUPABASE_SERVICE_ROLE_KEY'?'service':'configured'}},()=>client,read);
 const request=(body:unknown)=>new Request('https://crm.example/balances',{method:'POST',headers:{Authorization:'Bearer user'},body:JSON.stringify(body)});
 expect((await handler(request({tenantId:tenant,customerId:customer}))).status).toBe(200);expect(read).toHaveBeenCalledTimes(1);expect(scopes).toContainEqual(['tenant_id',tenant]);expect(scopes).toContainEqual(['id',customer]);
 expect((await handler(request({tenantId:customer,customerId:customer}))).status).toBe(403);
 expect((await handler(request({tenantId:tenant,customerId:customer,padding:'🌷'.repeat(1500)}))).status).toBe(413);
 known=false;expect((await handler(request({tenantId:tenant,customerId:customer}))).status).toBe(404);expect(read).toHaveBeenCalledTimes(1);
});
