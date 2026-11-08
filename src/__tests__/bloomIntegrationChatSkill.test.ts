import {describe, expect, it, vi} from "vitest";
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
    expect(isToolVisibleForRoleAndMode(tool!, "query", "viewer")).toBe(false);
    expect(isToolVisibleForRoleAndMode(tool!, "query", "staff")).toBe(true);
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
