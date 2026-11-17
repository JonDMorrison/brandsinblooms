import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeVmxApiBaseUrl } from "../../supabase/functions/_shared/vmx/client";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("VMX store-specific API security", () => {
  it("accepts only the VMX-supplied HTTPS store API path", () => {
    expect(normalizeVmxApiBaseUrl("https://bcg.vmxllc.com/pos/api")).toBe(
      "https://bcg.vmxllc.com/pos/api",
    );
    expect(normalizeVmxApiBaseUrl("https://my-store.vmxllc.com/pos/api/")).toBe(
      "https://my-store.vmxllc.com/pos/api",
    );
  });

  it.each([
    "http://bcg.vmxllc.com/pos/api",
    "https://evil.test/pos/api",
    "https://vmxllc.com.evil.test/pos/api",
    "https://127.0.0.1/pos/api",
    "https://bcg.vmxllc.com:8443/pos/api",
    "https://bcg.vmxllc.com/pos/api?redirect=evil.test",
    "https://bcg.vmxllc.com/pos/api#token",
    "https://bcg.vmxllc.com/pos/other",
    "https://user:pass@bcg.vmxllc.com/pos/api",
  ])("rejects unsafe VMX API URL: %s", (value) => {
    expect(() => normalizeVmxApiBaseUrl(value)).toThrow();
  });

  it("scopes every credentialed sync to a tenant or an internal scheduler", () => {
    const authorize = source("supabase/functions/_shared/vmx/authorize.ts");
    expect(authorize).toContain("get_current_crm_access");
    expect(authorize).toContain('integrations.manage');
    expect(authorize).toContain("access.tenantId !== tenantId");
    for (const slug of ["vmx-sync-customers", "vmx-sync-receipts", "vmx-backfill-receipts"]) {
      const handler = source(`supabase/functions/${slug}/index.ts`);
      expect(handler).toContain("authorizeVmxConnectionRequest(req, conn.tenant_id)");
      expect(handler).toContain("conn.settings?.base_url");
    }
    for (const slug of ["vmx-sync-all", "vmx-backfill-runner"]) {
      expect(source(`supabase/functions/${slug}/index.ts`)).toContain("requireVmxServiceRequest(req)");
    }
  });

  it("does not expose example customer credentials or unsafe CSV imports in setup", () => {
    const dialog = source("src/components/integrations/pos/VmxConnectDialog.tsx");
    const hub = source("src/pages/integrations/VMXSetupPage.tsx");
    const app = source("src/App.tsx");
    expect(app).toContain('<Route path="pos/vmx" element={<VMXSetupPage />} />');
    expect(dialog).toContain('type="password"');
    expect(hub).toContain('api_url: apiUrl.trim()');
    expect(dialog).toContain("VMX-issued API Client ID");
    expect(hub).not.toContain("VMXUploader");
  });
});
