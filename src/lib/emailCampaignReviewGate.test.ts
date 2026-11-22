import {describe, expect, it, vi} from 'vitest';
import {assertEmailCampaignReviewAllowsDelivery, emailCampaignReviewReason} from '../../supabase/functions/_shared/emailCampaignReviewGate';
function client(data: unknown, error: unknown = null) {
 const maybeSingle=vi.fn().mockResolvedValue({data,error});
 const second=vi.fn(()=>({maybeSingle}));
 const first=vi.fn(()=>({eq:second}));
 const select=vi.fn(()=>({eq:first}));
 return {db:{from:vi.fn(()=>({select}))},first,second};
}
describe('authoritative email review guard',()=>{
 it.each([{}, {metadata:{}}, {metadata:[]}, null])('allows an unheld row %j',row=>expect(emailCampaignReviewReason(row)).toBeNull());
 it.each([{send_blocked_reason:'connected_content_review'}, {metadata:{contentReviewReplacementId:'replacement'}}])('blocks held or replaced campaigns',async row=>{
  const {db,first,second}=client(row);
  await expect(assertEmailCampaignReviewAllowsDelivery(db,'tenant','campaign')).rejects.toMatchObject({decision:'review_required'});
  expect(first).toHaveBeenCalledWith('id','campaign'); expect(second).toHaveBeenCalledWith('tenant_id','tenant');
 });
 it.each([[null,null],[null,{message:'unavailable'}]])('fails closed for missing/inaccessible campaigns',async (data,error)=>{
  await expect(assertEmailCampaignReviewAllowsDelivery(client(data,error).db,'tenant','campaign')).rejects.toMatchObject({decision:'retry'});
 });
 it('rechecks the campaign between provider attempts',async()=>{
  const {db}=client({metadata:{}});
  await assertEmailCampaignReviewAllowsDelivery(db,'tenant','campaign');
  db.from.mockImplementation(()=>({select:()=>({eq:()=>({eq:()=>({maybeSingle:async()=>({data:{send_blocked_reason:'connected_content_review'},error:null})})})})}));
  await expect(assertEmailCampaignReviewAllowsDelivery(db,'tenant','campaign')).rejects.toMatchObject({decision:'review_required'});
 });
 it('allows messages without a campaign',async()=>{
  const {db}=client(null); await assertEmailCampaignReviewAllowsDelivery(db,'tenant',''); expect(db.from).not.toHaveBeenCalled();
 });
});
