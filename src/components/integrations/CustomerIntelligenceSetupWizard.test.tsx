import '@testing-library/jest-dom/vitest';
import {describe,it,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,cleanup,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {CustomerIntelligenceSetupWizard} from './CustomerIntelligenceSetupWizard';
const mocks=vi.hoisted(()=>({invoke:vi.fn(),success:vi.fn(),error:vi.fn()}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{functions:{invoke:mocks.invoke}}}));
vi.mock('sonner',()=>({toast:{success:mocks.success,error:mocks.error}}));
vi.mock('./PreparedIdealSourceReview',()=>({PreparedIdealSourceReview:()=>null}));
afterEach(()=>{cleanup();vi.resetAllMocks();});
async function ready(){
 const view=render(<MemoryRouter><CustomerIntelligenceSetupWizard/></MemoryRouter>);
 fireEvent.click(screen.getByText('Ideal report import'));fireEvent.click(screen.getByRole('button',{name:'Continue'}));
 const input=view.container.querySelector('input[type="file"]')!;
 fireEvent.change(input,{target:{files:[new File(['a'],'first.csv'),new File(['b'],'second.csv')]}});
 mocks.invoke.mockResolvedValueOnce({data:{preview:true,ready_to_import:true,approved_digest:'first',accepted:1}}).mockResolvedValueOnce({data:{preview:true,ready_to_import:true,approved_digest:'second',accepted:1}});
 fireEvent.click(screen.getByRole('button',{name:'Review reports — no import'}));
 await screen.findByText('Source review — no data changed');
 fireEvent.click(screen.getByRole('checkbox'));
 return screen.getByRole('button',{name:'Confirm reviewed import'});
}
describe('reviewed import outcomes',()=>{
 it('keeps a confirmed earlier file visible and blocks blind replay after an interrupted later response',async()=>{
  const commit=await ready();
  mocks.invoke.mockResolvedValueOnce({data:{success:true,import_id:'known-import',accepted:1,duplicates:0,rejected:0}}).mockResolvedValueOnce({error:new Error('Connection interrupted')});
  fireEvent.click(commit);
  expect(await screen.findByRole('alert')).toHaveTextContent('Earlier confirmed imports remain recorded');
  expect(screen.queryByText('Source review — no data changed')).not.toBeInTheDocument();expect(screen.getByText('Import attempt — review recorded outcomes')).toBeVisible();
  expect(screen.getByText('first.csv')).toBeVisible();expect(screen.getByText('Import reference: known-import')).toBeVisible();
  expect(screen.getByRole('button',{name:'Confirm reviewed import'})).toBeDisabled();
  expect(mocks.success).not.toHaveBeenCalledWith(expect.stringContaining('Import responses'));
  expect(mocks.invoke).toHaveBeenCalledTimes(4);
 });
 it('stops after a completed-with-rejections response and retains its ledger reference',async()=>{
  const commit=await ready();mocks.invoke.mockResolvedValueOnce({data:{success:true,import_id:'partial',accepted:2,rejected:1,duplicates:0}});
  fireEvent.click(commit);expect(await screen.findByRole('alert')).toHaveTextContent('finished with rejected records');
  expect(screen.getByText('Import reference: partial')).toBeVisible();expect(mocks.invoke).toHaveBeenCalledTimes(3);
  expect(screen.getByRole('button',{name:'Confirm reviewed import'})).toBeDisabled();
 });
 it('retains imported facts but stops and displays a pending derived refresh',async()=>{
  const commit=await ready();mocks.invoke.mockResolvedValueOnce({data:{success:true,import_id:'recorded',accepted:1,rejected:0,postprocessing_pending:true,warnings:['Source health refresh is pending.']}});
  fireEvent.click(commit);expect(await screen.findByRole('alert')).toHaveTextContent('metric refresh is pending');
  expect(screen.getByText('Source health refresh is pending.')).toBeVisible();expect(screen.getByText('Import reference: recorded')).toBeVisible();
  expect(mocks.invoke).toHaveBeenCalledTimes(3);expect(screen.getByRole('button',{name:'Confirm reviewed import'})).toBeDisabled();
 });
 it('shows structured recovery status instead of only a generic HTTP failure',async()=>{
  const commit=await ready();const error=Object.assign(new Error('Edge Function returned non-2xx'),{context:new Response(JSON.stringify({error:'Existing import requires recovery review',import_id:'prior-ledger',status:'processing'}),{status:409})});
  mocks.invoke.mockResolvedValueOnce({error});fireEvent.click(commit);
  const alert=await screen.findByRole('alert');expect(alert).toHaveTextContent('Existing import requires recovery review');expect(alert).toHaveTextContent('Import reference: prior-ledger');expect(alert).toHaveTextContent('Recorded status: processing');expect(mocks.invoke).toHaveBeenCalledTimes(3);
 });
 it.each([undefined,false,'false'])('stops on an unconfirmed success field %s',async(success)=>{
  const commit=await ready();mocks.invoke.mockResolvedValueOnce({data:{success}});
  fireEvent.click(commit);expect(await screen.findByRole('alert')).toHaveTextContent('did not confirm');
  expect(screen.queryByText('Recorded import responses')).not.toBeInTheDocument();expect(mocks.invoke).toHaveBeenCalledTimes(3);
  expect(screen.getByRole('button',{name:'Confirm reviewed import'})).toBeDisabled();
 });
 it('shows both successful and duplicate outcomes without claiming duplicate data was added',async()=>{
  const commit=await ready();mocks.invoke.mockResolvedValueOnce({data:{success:true,import_id:'new',accepted:1,rejected:0}}).mockResolvedValueOnce({data:{success:true,duplicate_file:true}});
  fireEvent.click(commit);await waitFor(()=>expect(screen.getByText('Already imported; no new totals added.')).toBeVisible());
  expect(screen.getByText('Import recorded — review the reconciliation')).toBeVisible();expect(screen.queryByRole('alert')).not.toBeInTheDocument();
 });
});
