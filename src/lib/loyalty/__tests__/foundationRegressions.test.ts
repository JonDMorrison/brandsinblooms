import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { gardenImagesFromProducts } from '../../crm/gardenImages';
import { requireImportTenant } from '../../../../supabase/functions/_shared/customer-intelligence/import-access';
import { requireAnalysisAccess } from '../../../../supabase/functions/bloom-assist/tools/implementations/customer-exploration';
import type { ToolExecutionContext } from '../../../../supabase/functions/bloom-assist/tools/types';
const tenant = '11111111-1111-4111-8111-111111111111';
describe('verified integration authorization', () => {
  it('uses the authenticated current CRM company and permission contract', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { tenantId: tenant, permissions: ['integrations.manage'] }, error: null });
    expect(await requireImportTenant({ rpc })).toBe(tenant);
    expect(rpc).toHaveBeenCalledExactlyOnceWith('get_current_crm_access');
  });
  it.each([null, {}, [], { tenantId: tenant, permissions: [] }, { tenantId: 'bad', permissions: ['integrations.manage'] }, { tenantId: tenant, permissions: 'integrations.manage' }])('rejects a missing or invalid access result %#', async data => {
    await expect(requireImportTenant({ rpc: vi.fn().mockResolvedValue({ data, error: null }) })).rejects.toThrow('permission');
  });
  it('does not authorize from a failed RPC with stale data', async () => {
    await expect(requireImportTenant({ rpc: vi.fn().mockResolvedValue({ data: { tenantId: tenant, permissions: ['integrations.manage'] }, error: { message: 'failed' } }) })).rejects.toThrow();
  });
  it('does not use a service client or caller-supplied tenant for the import permission check', () => {
    const code = readFileSync('supabase/functions/ideal-intelligence-import/index.ts', 'utf8');
    expect(code).toContain('tenantId=await requireImportTenant(userClient)');
    expect(code).not.toContain('p_resource_id');
    expect(code).not.toContain('service.rpc("has_tenant_permission"');
    expect(code.indexOf('requireImportTenant(userClient)')).toBeLessThan(code.indexOf('const service=createClient'));
  });
  it('uses only known legacy analysis permission names with a company-wide location check', async () => {
    const rpc = vi.fn().mockImplementation((name: string, args: { p_permission: string; p_location_id: null; p_tenant_id: string }) => Promise.resolve({ data: name === 'has_tenant_permission' && ['customer.read', 'reporting.read'].includes(args.p_permission) && args.p_location_id === null && args.p_tenant_id === tenant, error: null }));
    const dataClient = { rpc };
    expect(await requireAnalysisAccess({ tenantId: tenant, userId: 'user', dataClient } as unknown as ToolExecutionContext)).toBe(dataClient);
    expect(rpc.mock.calls.map(call => call[1].p_permission)).toEqual(['customer.read', 'reporting.read']);
  });
  it('does not replace a denied location boundary with a privileged fallback', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: false, error: null }), serviceRpc = vi.fn();
    await expect(requireAnalysisAccess({ tenantId: tenant, userId: 'staff', dataClient: { rpc }, serviceClient: { rpc: serviceRpc } } as unknown as ToolExecutionContext)).rejects.toThrow();
    expect(serviceRpc).not.toHaveBeenCalled();
  });
});
describe('actual product image relation', () => {
  it('prefers the primary image and preserves the input rows', () => {
    const rows = [{ name: 'Rose', product_images: [{ image_url: 'https://example.invalid/second.jpg', sort_order: 0 }, { image_url: 'https://example.invalid/primary.jpg', is_primary: true, sort_order: 10 }] }];
    const before = JSON.stringify(rows);
    expect(gardenImagesFromProducts(rows)).toEqual([{ url: 'https://example.invalid/primary.jpg', alt: 'Rose' }]);
    expect(JSON.stringify(rows)).toBe(before);
  });
  it('uses a thumbnail when the full image is absent', () => expect(gardenImagesFromProducts([{ name: 'Soil', product_images: [{ thumbnail_url: 'https://example.invalid/thumb.jpg' }] }])[0].url).toContain('thumb.jpg'));
  it('ignores old imaginary product image columns', () => expect(gardenImagesFromProducts([{ name: 'Rose', image_url: 'https://example.invalid/not-a-product-column.jpg' }])).toEqual([]));
  it('deduplicates and limits imagery to three products', () => {
    const rows = [0, 0, 1, 2, 3].map(n => ({ name: String(n), product_images: [{ image_url: `https://example.invalid/${n}.jpg` }] }));
    expect(gardenImagesFromProducts(rows)).toHaveLength(3);
  });
  it('rejects malformed and unsafe image URLs without guessing a fallback image', () => {
    expect(gardenImagesFromProducts([{ product_images: [null, { image_url: 'javascript:alert(1)' }, { image_url: 'not a URL' }] }])).toEqual([]);
    expect(gardenImagesFromProducts(null)).toEqual([]);
  });
  it('queries the relation on tenant-scoped products', () => {
    const code = readFileSync('src/components/dashboard/BloomWeeklySuggestionsCard.tsx', 'utf8');
    expect(code).toContain('.select("name, product_images(image_url, thumbnail_url, is_primary, sort_order)")');
    expect(code).not.toContain('.select("name, image_url, thumbnail_url")');
    expect(code).toContain('.eq("tenant_id", tenantId)');
  });
});
