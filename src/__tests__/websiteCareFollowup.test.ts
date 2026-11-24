import {describe,it,expect} from 'vitest';
import {validateCandidates,audienceDigest,websiteBuyerIds} from '../../supabase/functions/_shared/website-care-followup';
const id=(n:number)=>'a0000000-0000-4000-8000-'+String(n).padStart(12,'0');
describe('website care evidence',()=>{
 it('rejects malformed identity and creates deterministic reviewed audience digests',async()=>{
 expect(()=>validateCandidates([{customerId:'invalid',userId:id(1)}])).toThrow();
 expect(await audienceDigest([id(2),id(1),id(2)])).toEqual(await audienceDigest([id(1),id(2)]));
 expect(await websiteBuyerIds({siteId:id(1),tenantId:id(2),productId:id(3),from:'2026-11-01T00:00:00Z',until:'2026-11-23T00:00:00Z'},[], 'a'.repeat(64))).toEqual([]);
 });
});
