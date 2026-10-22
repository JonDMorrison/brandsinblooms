import '@testing-library/jest-dom/vitest';
import {afterEach,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {CustomerIdealEvidenceCard} from './CustomerIdealEvidenceCard';
const mocks=vi.hoisted(()=>({sources:vi.fn(),projection:vi.fn(),tenant:{id:'tenant'},loading:false,admin:{isMasterAdmin:false,activeTenantId:'tenant',hasHydratedTenantContext:true,isLoading:false}}));
vi.mock('@/hooks/useCustomerIdealEvidence',()=>({useCustomerIdealSources:mocks.sources,useCustomerIdealProjection:mocks.projection}));
vi.mock('@/hooks/useTenant',()=>({useTenant:()=>({tenant:mocks.tenant,loading:mocks.loading})}));
vi.mock('@/contexts/AdminContext',()=>({useAdmin:()=>mocks.admin}));
const report={id:'source',tenant_id:'tenant',source_sha256:'a'.repeat(64),source_filename:'annual.xls',source_period_start:'2025-01-01',source_period_end:'2025-12-31'};
const result={tenant_id:'tenant',customer_id:'customer',source_import_id:'source',records:1,duplicate_records:0,observed_net_amount:12,observed_net_cents:1200,observed_quantity:2,currency:'CAD',department_net_cents:{Nursery:1200},category_net_cents:{},cutoff:'2026-10-22T00:00:00Z'};
afterEach(()=>{cleanup();vi.resetAllMocks();mocks.tenant={id:'tenant'};mocks.loading=false;mocks.admin={isMasterAdmin:false,activeTenantId:'tenant',hasHydratedTenantContext:true,isLoading:false};});
function setup(overrides:Record<string,unknown>={}){
 mocks.sources.mockReturnValue({data:[report],isError:false,isLoading:false,refetch:vi.fn()});
 mocks.projection.mockImplementation((_tenant,_customer,source)=>({data:source?{...result,...overrides}:undefined,isError:false,isLoading:false,refetch:vi.fn()}));
 return render(<CustomerIdealEvidenceCard tenantId="tenant" customerId="customer"/>);
}
function choose(){fireEvent.click(screen.getByRole('combobox'));fireEvent.click(screen.getByRole('option',{name:/2025-01-01 to 2025-12-31/}));}
it('automatically shows the first linked source, including a 2025-only customer, without calling it lifetime value',()=>{
 setup();expect(mocks.sources).toHaveBeenLastCalledWith('tenant','customer');
 expect(screen.getByText('Observed report amount: $12.00')).toBeVisible();expect(screen.getByText(/Selected period: 2025-01-01 through 2025-12-31/)).toBeVisible();
 expect(screen.getByText(/Lifetime value, visits, frequency and receipt average remain unknown/)).toBeVisible();
 expect(mocks.projection).toHaveBeenLastCalledWith('tenant','customer',report);
});
it('keeps missing evidence unknown instead of showing zero',()=>{
 setup({records:0,observed_net_amount:null,observed_quantity:null});choose();
 expect(screen.getByText(/Spending and quantities are unknown/)).toBeVisible();expect(screen.queryByText(/Observed report amount/)).not.toBeInTheDocument();
});
it('shows actionable read error without previous totals',()=>{
 const view=setup();mocks.projection.mockReturnValue({isError:true,isLoading:false,refetch:vi.fn()});view.rerender(<CustomerIdealEvidenceCard tenantId="tenant" customerId="customer"/>);
 expect(screen.getByRole('button',{name:'Retry evidence'})).toBeVisible();expect(screen.queryByText(/Observed report amount/)).not.toBeInTheDocument();
});
it('remounts selection and removes previous evidence on customer/company change',()=>{
 const view=setup();choose();expect(screen.getByText('Observed report amount: $12.00')).toBeVisible();
 mocks.tenant={id:'other'};view.rerender(<CustomerIdealEvidenceCard tenantId="other" customerId="other-customer"/>);
 expect(screen.queryByText(/Observed report amount/)).not.toBeInTheDocument();expect(screen.queryByText(/Selected period/)).not.toBeInTheDocument();
 expect(mocks.projection).toHaveBeenLastCalledWith('other','other-customer',undefined);
});

it('renders exact cents near the numeric limit without losing the last cent',()=>{
 setup({observed_net_cents:9007199254740991,department_net_cents:{Nursery:9007199254740991}});choose();
 expect(screen.getByText('Observed report amount: $90,071,992,547,409.91')).toBeVisible();
 expect(screen.getByText('Department Nursery: $90,071,992,547,409.91')).toBeVisible();
});

it('blocks stale admin tenant before hooks mount and hides prior evidence immediately',()=>{
 mocks.admin.isMasterAdmin=true;const view=setup();choose();expect(screen.getByText('Observed report amount: $12.00')).toBeVisible();
 mocks.sources.mockClear();mocks.projection.mockClear();mocks.admin.activeTenantId='other';
 view.rerender(<CustomerIdealEvidenceCard tenantId="tenant" customerId="customer"/>);
 expect(screen.queryByText(/Observed report amount/)).not.toBeInTheDocument();
 expect(screen.getByText(/Loading company for source evidence/)).toBeVisible();expect(mocks.sources).not.toHaveBeenCalled();expect(mocks.projection).not.toHaveBeenCalled();
});
it('blocks mismatched props and company loading before evidence queries',()=>{
 mocks.tenant={id:'other'};setup();expect(screen.getByText(/Select a customer in the current company/)).toBeVisible();
 expect(mocks.sources).not.toHaveBeenCalled();expect(mocks.projection).not.toHaveBeenCalled();
});
