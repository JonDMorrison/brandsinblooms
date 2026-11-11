import { describe, it, expect, vi } from "vitest";
import {
  assertNewsletterPreviewAccess,
  type NewsletterPreviewAccessClient,
} from "../../../../supabase/functions/_shared/newsletterPreviewAccess";
const tenant = "00000000-0000-4000-8000-000000000001",
  campaign = "00000000-0000-4000-8000-000000000002";
function client(
  allowed: unknown = true,
  row: { id?: string } | null = { id: campaign },
) {
  const eq = vi.fn();
  const maybeSingle = vi.fn(async () => ({ data: row, error: null }));
  const query = { eq, maybeSingle };
  eq.mockReturnValue(query);
  const from = vi.fn(() => ({ select: vi.fn(() => query) }));
  const rpc = vi.fn(async () => ({ data: allowed, error: null }));
  return { rpc, from, eq, maybeSingle };
}
describe("newsletter preview authorization", () => {
  it("rejects a foreign tenant before reading any campaign or contact", async () => {
    const db = client(false);
    await expect(
      assertNewsletterPreviewAccess(db, {
        tenantId: tenant,
        campaignId: campaign,
        trustedService: false,
      }),
    ).rejects.toThrow(/access/);
    expect(db.from).not.toHaveBeenCalled();
  });
  it("requires campaign read permission and an accessible tenant-scoped campaign", async () => {
    const db = client();
    await assertNewsletterPreviewAccess(db, {
      tenantId: tenant,
      campaignId: campaign,
      trustedService: false,
    });
    expect(db.rpc).toHaveBeenCalledWith("has_tenant_permission", {
      p_tenant_id: tenant,
      p_permission: "campaign.read",
      p_location_id: null,
    });
    expect(db.eq).toHaveBeenCalledWith("tenant_id", tenant);
  });
  it("rejects an inaccessible campaign even for an otherwise permitted tenant", async () => {
    await expect(
      assertNewsletterPreviewAccess(client(true, null), {
        tenantId: tenant,
        campaignId: campaign,
        trustedService: false,
      }),
    ).rejects.toThrow(/campaign/);
  });
  it("does not turn a missing permission result into approval", async () => {
    await expect(
      assertNewsletterPreviewAccess(client(null), {
        tenantId: tenant,
        trustedService: false,
      }),
    ).rejects.toThrow(/access/);
  });
  it("allows an authenticated generic preview without private identifiers", async () => {
    const db = client(false);
    await assertNewsletterPreviewAccess(db, {
      tenantId: "preview-tenant",
      trustedService: false,
    });
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it("rejects a real contact under the generic preview tenant", async () => {
    await expect(
      assertNewsletterPreviewAccess(client(), {
        tenantId: "preview-tenant",
        customerId: campaign,
        trustedService: false,
      }),
    ).rejects.toThrow(/valid account/);
  });
});
