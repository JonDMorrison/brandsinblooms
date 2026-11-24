import {describe,it,expect,vi} from 'vitest';
import {careFollowupAllowed} from '../../supabase/functions/_shared/care-followup-guard';
describe('care follow-up delivery guard',()=>{
 it('returns ordinary campaign null and refuses errors instead of bypassing consent',async()=>{
 const recipients=[{customerId:'a',email:'a@sample.invalid'}];
 const rpc=vi.fn().mockResolvedValueOnce({data:null,error:null}).mockResolvedValueOnce({data:['a'],error:null}).mockResolvedValueOnce({data:[],error:null}).mockResolvedValueOnce({data:null,error:{message:'unavailable'}});
 expect(await careFollowupAllowed({rpc},'campaign',recipients)).toBeNull();
 expect(await careFollowupAllowed({rpc},'campaign',recipients)).toEqual(new Set(['a']));
 expect(await careFollowupAllowed({rpc},'campaign',recipients)).toEqual(new Set());
 await expect(careFollowupAllowed({rpc},'campaign',recipients)).rejects.toThrow();
 expect(rpc).toHaveBeenCalledWith('care_followup_delivery_guard',{p_campaign:'campaign',p_recipients:recipients});
 });
});
