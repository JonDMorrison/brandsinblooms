import '@testing-library/jest-dom/vitest';
import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {ReportedCompany,ReportedPurchaseWorkspace} from './ReportedPurchaseWorkspace';
const mocks=vi.hoisted(()=>({ledger:vi.fn(),evidence:vi.fn(),pages:vi.fn(),tenantId:"t",activeTenantId:"t"}));
vi.mock('@/hooks/useTenant',()=>({useTenant:()=>({tenant:{id:mocks.tenantId},loading:false})}));
vi.mock('@/contexts/AdminContext',()=>({useAdmin:()=>({isMasterAdmin:true,isLoading:false,hasHydratedTenantContext:true,activeTenantId:mocks.activeTenantId})}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{}}));
vi.mock('../../../../supabase/functions/_shared/customer-intelligence/load-reported-evidence',()=>({loadReportLedger:mocks.ledger,loadReportedEvidence:mocks.evidence}));
vi.mock('../../../../supabase/functions/_shared/customer-intelligence/query-pages',()=>({readAllPages:mocks.pages}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
const source={id:'current',tenant_id:'t',source:'ideal',source_filename:'Current report',source_period_start:'2026-01-01',source_period_end:'2026-10-14'};
async function select(label:string,text:string){fireEvent.click(screen.getByRole('combobox',{name:label}));fireEvent.click(await screen.findByRole('option',{name:text}));}
it('shows unsupported customer evidence as unknown and labels source coverage rather than lifetime or visits',async()=>{
 mocks.ledger.mockResolvedValue([source]);mocks.evidence.mockResolvedValue({facts:[],activeImportIds:['current']});mocks.pages.mockResolvedValue([{id:'missing',tenant_id:'t'}]);
 render(<ReportedCompany tenantId="t"/>);fireEvent.click(screen.getByText('Load completed report sources'));await screen.findByRole('combobox',{name:'Reported current source'});await select('Reported current source','2026-01-01 through 2026-10-14 · Current report');fireEvent.click(screen.getByText('Show selected-period spending and ranking'));
 await screen.findByText('0 customers with supported selected-period evidence; 1 unknown.');expect(screen.getByText(/do not establish dated visits/)).toBeInTheDocument();expect(screen.getByText(/Missing customer evidence is unknown, never zero/)).toBeInTheDocument();
});
it('rejects annual history versus incomplete YTD in the actual comparison path',async()=>{
 mocks.ledger.mockResolvedValue([source,{...source,id:'baseline',source_filename:'Annual report',source_period_start:'2025-01-01',source_period_end:'2025-12-31'}]);mocks.evidence.mockResolvedValue({facts:[],activeImportIds:[]});mocks.pages.mockResolvedValue([]);
 render(<ReportedCompany tenantId="t"/>);fireEvent.click(screen.getByText('Load completed report sources'));await screen.findByRole('combobox',{name:'Reported current source'});await select('Reported current source','2026-01-01 through 2026-10-14 · Current report');await select('Reported baseline source','2025-01-01 through 2025-12-31 · Annual report');expect(screen.getByText('Compare exact source periods')).toBeDisabled();await screen.findByText(/Annual history cannot be compared with incomplete YTD/);expect(mocks.evidence).not.toHaveBeenCalled();expect(mocks.pages).not.toHaveBeenCalled();
});
it('does not display late results after unmount',async()=>{let finish:(value:unknown)=>void=()=>{};mocks.ledger.mockReturnValue(new Promise(resolve=>{finish=resolve;}));const mounted=render(<ReportedCompany tenantId="t"/>);fireEvent.click(screen.getByText('Load completed report sources'));mounted.unmount();render(<ReportedCompany tenantId="other"/>);finish([source]);await waitFor(()=>expect(screen.queryByRole('combobox',{name:'Reported current source'})).not.toBeInTheDocument());});

it('hides previous company controls immediately while active tenant context differs',()=>{const mounted=render(<ReportedPurchaseWorkspace/>);expect(screen.getByText('Load completed report sources')).toBeInTheDocument();mocks.activeTenantId='other';mounted.rerender(<ReportedPurchaseWorkspace/>);expect(screen.queryByText('Load completed report sources')).not.toBeInTheDocument();expect(screen.getByText('Loading company report scope…')).toBeInTheDocument();mocks.activeTenantId='t';});

it('loads the annual baseline separately when growth comparison is unavailable',async()=>{
 mocks.ledger.mockResolvedValue([source,{...source,id:'baseline',source_filename:'Annual report',source_period_start:'2025-01-01',source_period_end:'2025-12-31'}]);mocks.evidence.mockResolvedValue({facts:[],activeImportIds:['baseline']});mocks.pages.mockResolvedValue([]);
 render(<ReportedCompany tenantId="t"/>);fireEvent.click(screen.getByText('Load completed report sources'));await screen.findByRole('combobox',{name:'Reported current source'});await select('Reported current source','2026-01-01 through 2026-10-14 · Current report');await select('Reported baseline source','2025-01-01 through 2025-12-31 · Annual report');fireEvent.click(screen.getByText('Show baseline-period spending separately'));
 await screen.findByText('Report period 2025-01-01 through 2025-12-31.');expect(mocks.evidence).toHaveBeenCalledWith({},'t',expect.any(String),{historicalImportIds:['baseline']});expect(screen.getByText('Compare exact source periods')).toBeDisabled();
});
