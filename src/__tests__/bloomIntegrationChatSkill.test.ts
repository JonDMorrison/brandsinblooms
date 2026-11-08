import {beforeEach, describe, expect, it, vi} from "vitest";
import {verifyBloomsitesIntegrations, type SuiteDeps} from "../../supabase/functions/bloom-assist/tools/implementations/suite-tools";
import {getRegisteredTool, isToolVisibleForRoleAndMode} from "../../supabase/functions/bloom-assist/tools/registry";
import type {ToolExecutionContext} from "../../supabase/functions/bloom-assist/tools/types";

const context = {tenantId:"tenant-lacoste",userId:"staff-1",userName:"Jeff",serviceClient:{}} as unknown as ToolExecutionContext;
const outcome = {assessment:"needs_attention",counterpoint:{connection_health:"healthy",catalogue_sync_status:"failed"},opd:{imported_links:3793,approved_links:3341}};

function deps(staff = true, read = vi.fn(async () => outcome)): SuiteDeps {
  return {
    rpcFor: () => (async () => null) as never,
    identity: async () => ({principalId:"operator-principal",role:staff?"platform_operator":"client",staff,
      ownTenantId:"tenant-jon",inAdminWorkspace:true,account:{id:"lacoste-account",name:"Lacoste Garden Centre"}}),
    runRead: read,
  };
}

describe("Bloom in-dashboard staff integration diagnosis", () => {
  it("is visible only to staff and admin roles, never clients", () => {
    const tool = getRegisteredTool("verify_bloomsites_integrations");
    expect(tool).not.toBeNull();
    expect(tool?.risk_level).toBe("safe");
    expect(tool?.requires_confirmation).toBe(false);
    expect(tool?.allowed_roles).toEqual(["admin","staff"]);
    expect(isToolVisibleForRoleAndMode(tool!, "standard", "viewer")).toBe(false);
    expect(isToolVisibleForRoleAndMode(tool!, "standard", "staff")).toBe(true);
  });

  it("uses the same account and principal as the support dashboard, dropping model-selected accounts", async () => {
    const read = vi.fn(async () => outcome);
    const response = await verifyBloomsitesIntegrations(
      { account_id:"forged-other-account",site_id:"linked-site",secret:"do-not-forward" },
      context, deps(true, read),
    );
    expect(response.success).toBe(true);
    expect(read).toHaveBeenCalledWith(
      {principalId:"operator-principal",role:"platform_operator",via:"crm_session",name:"Jeff",scopes:[]},
      {kind:"site.integration_health",account_id:"lacoste-account",inputs:{site_id:"linked-site"}},
    );
    expect(response.data).toMatchObject({kind:"site.integration_health",result:outcome});
    expect(response.message).toContain("read-only");
  });

  it("refuses non-staff identities before reaching the product bridge", async () => {
    const read = vi.fn(async () => outcome);
    const result = await verifyBloomsitesIntegrations({},context,deps(false,read));
    expect(result.success).toBe(false);
    expect(result.error).toBe("forbidden");
    expect(read).not.toHaveBeenCalled();
  });

  it("fails closed when the account or site is not accessible", async () => {
    const read = vi.fn(async () => {throw Object.assign(new Error("private provider error key"),{status:403,code:"forbidden"});});
    const result = await verifyBloomsitesIntegrations({},context,deps(true,read));
    expect(result.success).toBe(false);
    expect(result.message).toContain("don't have access");
    expect(result.message).not.toContain("private provider");
  });
});


describe("Naming a client from anywhere in the Bloom dashboard", () => {
  const site = "f599e50e-4245-43d2-954c-e5b05777ec22";
  const accounts = [
    {id:"lacoste-crm", name:"Lacoste Garden Centre", links:[{product:"crm", external_id:"11111111-1111-4111-8111-111111111111"}]},
    {id:"lacoste-site", name:"Lacoste Garden Centre", links:[{product:"cms", external_id:site}]},
    {id:"horsford-site", name:"Horsford Gardens", links:[{product:"cms", external_id:"22222222-2222-4222-8222-222222222222"}]},
  ];
  const remote = vi.fn(async () => accounts);
  const read = vi.fn(async () => outcome);
  beforeEach(() => { remote.mockClear(); read.mockClear(); remote.mockResolvedValue(accounts); read.mockResolvedValue(outcome); });
  function d() {
    remote.mockClear(); read.mockClear();
    const d = deps(true, read);
    return {...d, rpcFor: () => remote as never};
  }

  it("finds Lacoste by name without switching the CRM workspace or trusting model account IDs", async () => {
    const result = await verifyBloomsitesIntegrations(
      {client_name:"Lacoste", account_id:"forged", site_id:site, key:"never forward"},
      {...context, tenantId:"brands-in-blooms"}, d());
    expect(result.success).toBe(true);
    expect(remote).toHaveBeenCalledWith("list_accounts", { actor:"operator-principal", q:"Lacoste", limit:50 });
    expect(read).toHaveBeenCalledWith(
      {principalId:"operator-principal",role:"platform_operator",via:"crm_session",name:"Jeff",scopes:[]},
      {kind:"site.integration_health",account_id:"lacoste-site",inputs:{site_id:site}},
    );
    expect(result.message).toContain("Lacoste Garden Centre");
  });

  it("refuses an ambiguous name with two CMS sites", async () => {
    const ambiguous = [...accounts, {id:"other-lacoste",name:"Lacoste Nursery",links:[{product:"cms",external_id:"33333333-3333-4333-8333-333333333333"}]}];
    const call = vi.fn(async () => ambiguous);
    const result = await verifyBloomsitesIntegrations({client_name:"Lacoste"},context,
      {...deps(true,read), rpcFor:()=>call as never});
    expect(result).toMatchObject({success:false,error:"client_ambiguous"});
    expect(read).not.toHaveBeenCalled();
  });

  it("refuses an unlinked or unknown customer rather than choosing another", async () => {
    const result = await verifyBloomsitesIntegrations({client_name:"Unknown Nursery"},context,d());
    expect(result).toMatchObject({success:false,error:"client_ambiguous"});
    expect(read).not.toHaveBeenCalled();
  });

  it("rejects wildcard names and mismatched site IDs before a client read", async () => {
    const invalid = await verifyBloomsitesIntegrations({client_name:"%_"},context,d());
    expect(invalid).toMatchObject({success:false,error:"invalid_client"});
    expect(remote).not.toHaveBeenCalled();
    const mismatch = await verifyBloomsitesIntegrations(
      {client_name:"Lacoste",site_id:"99999999-9999-4999-8999-999999999999"},context,d());
    expect(mismatch).toMatchObject({success:false,error:"site_mismatch"});
    expect(read).not.toHaveBeenCalled();
  });

  it("never resolves a named client for a nonstaff caller", async () => {
    const denied = await verifyBloomsitesIntegrations({client_name:"Lacoste"},context,
      {...deps(false, read),rpcFor:()=>remote as never});
    expect(denied).toMatchObject({success:false,error:"forbidden"});
    expect(remote).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
  });
});
