import {describe,it,expect,vi,afterEach} from 'vitest';
import {createHash,webcrypto} from 'node:crypto';
import {reviewPreparedIdealSource} from '../prepared-source-review';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const file=(name:string,text:string)=>({name,size:Buffer.byteLength(text),text:async()=>text,arrayBuffer:async()=>new TextEncoder().encode(text).buffer as ArrayBuffer});
const tenant='11111111-1111-4111-8111-111111111111',sourceSha='a'.repeat(64);
function fixture(change?:(manifest:Record<string,unknown>)=>void){
 const payload={kind:'purchase_summary_item',customerCode:'000001',fields:{quantity:2,amountCents:1000}};
 const line=JSON.stringify({...payload,source:{sha256:sourceSha,sheet:'Sheet1',row:3},payloadHash:hash(JSON.stringify(payload)),committable:false})+'\n';
 const manifest:Record<string,unknown>={version:1,tenantId:tenant,source:{sha256:sourceSha,bytes:50000000,filename:'original.xls',originalUnchanged:true},reportFamily:'annual_sales',status:'review_required',committable:false,sheets:[{name:'Sheet1',sourceRows:4,normalizedRows:1}],chunks:[{index:0,path:'chunk-00000.jsonl',sha256:hash(line),rows:1,bytes:Buffer.byteLength(line)}],counts:{sourceRows:4,normalizedRows:1,quarantinedRows:0},reconciliation:{failures:[]},notices:[]};
 change?.(manifest);return [file('manifest.json',JSON.stringify({...manifest,manifestSha256:hash(JSON.stringify(manifest))})),file('chunk-00000.jsonl',line)];
}
afterEach(()=>vi.unstubAllGlobals());
describe('prepared source review boundary',()=>{
 it('validates source provenance and complete bounded file inventory without importing',async()=>{vi.stubGlobal('crypto',webcrypto);expect(await reviewPreparedIdealSource(fixture(),tenant)).toMatchObject({sourceSha256:sourceSha,sourceRows:4,normalizedRows:1,filename:'original.xls'});});
 it('rejects another tenant even when the bundle hash is valid',async()=>{vi.stubGlobal('crypto',webcrypto);await expect(reviewPreparedIdealSource(fixture(),'other')).rejects.toThrow('current company');});
 it('rejects missing, duplicate and unexpected files',async()=>{vi.stubGlobal('crypto',webcrypto);const files=fixture();await expect(reviewPreparedIdealSource(files.slice(0,1),tenant)).rejects.toThrow('missing');await expect(reviewPreparedIdealSource([...files,files[1]],tenant)).rejects.toThrow('Duplicate');await expect(reviewPreparedIdealSource([...files,file('extra.jsonl','')],tenant)).rejects.toThrow('inventory');});
 it('rejects altered chunks and tampered manifests',async()=>{vi.stubGlobal('crypto',webcrypto);const files=fixture();files[1]=file(files[1].name,(await files[1].text()).replace('000001','000002'));await expect(reviewPreparedIdealSource(files,tenant)).rejects.toThrow('integrity');const other=fixture();other[0]=file('manifest.json',(await other[0].text()).replace('original.xls','modified.xls'));await expect(reviewPreparedIdealSource(other,tenant)).rejects.toThrow('integrity');});
 it('rejects unpreserved originals and partial worksheet totals',async()=>{vi.stubGlobal('crypto',webcrypto);await expect(reviewPreparedIdealSource(fixture(m=>{(m.source as Record<string,unknown>).originalUnchanged=false;}),tenant)).rejects.toThrow('preservation');await expect(reviewPreparedIdealSource(fixture(m=>{(m.counts as Record<string,unknown>).sourceRows=5;}),tenant)).rejects.toThrow('reconcile');});
 it('shows printed period provenance and rejects impossible dates',async()=>{vi.stubGlobal('crypto',webcrypto);const valid=fixture(m=>{m.periodStart='2025-01-01';m.periodEnd='2025-12-31';m.reconciliation={failures:[],sourcePeriod:{start:'2025-01-01',end:'2025-12-31'},periodProvenance:'printed_original'};});expect(await reviewPreparedIdealSource(valid,tenant)).toMatchObject({periodVerified:true,periodStart:'2025-01-01'});await expect(reviewPreparedIdealSource(fixture(m=>{m.periodStart='2025-02-30';m.periodEnd='2025-12-31';}),tenant)).rejects.toThrow('period');});
 it('does not accept a producer claim that rows are authorized for import',async()=>{vi.stubGlobal('crypto',webcrypto);await expect(reviewPreparedIdealSource(fixture(m=>{m.committable=true;}),tenant)).rejects.toThrow('review contract');});
 it('derives incomplete receipt certification and rejects a rehashed complete claim',async()=>{vi.stubGlobal('crypto',webcrypto);const files=fixture(m=>{m.reportFamily='journal';});const reviewed=await reviewPreparedIdealSource(files,tenant);expect(reviewed.certification.status).toBe('incomplete');expect(reviewed.certification.committable).toBe(false);expect(reviewed.notices.some(n=>n.includes('original detail coverage'))).toBe(true);await expect(reviewPreparedIdealSource(fixture(m=>{m.reportFamily='journal';m.certification={status:'complete',committable:true};}),tenant)).rejects.toThrow('certification claims');});

});
