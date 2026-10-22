import {createSourceCertificationGate, type CertificationSummary} from './source-certification.mjs';
type SourceFile = Pick<File,'name'|'size'|'text'|'arrayBuffer'>;
export type PreparedSourceReview = {certification:CertificationSummary;filename:string;sourceSha256:string;reportFamily:string;status:string;periodStart:string|null;periodEnd:string|null;periodVerified:boolean;sourceRows:number;normalizedRows:number;quarantinedRows:number;sheets:Array<{name:string;sourceRows:number;normalizedRows:number}>;notices:string[];failures:string[]};
const object=(value:unknown):Record<string,unknown>=>{if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid prepared report structure.');return value as Record<string,unknown>;};
const integer=(value:unknown)=>{if(!Number.isSafeInteger(value)||Number(value)<0)throw Error('Invalid prepared report count.');return Number(value);};
const hash=async(bytes:ArrayBuffer)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
const hashText=(text:string)=>hash(new TextEncoder().encode(text).buffer as ArrayBuffer);
const digest=(value:unknown)=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
/** Verify bounded, sequential chunks locally. This never grants permission to import facts. */
export async function reviewPreparedIdealSource(files:SourceFile[],tenantId:string):Promise<PreparedSourceReview>{
 if(files.length>10001)throw Error('Too many prepared report files.');
 const byName=new Map<string,SourceFile>();for(const file of files){if(byName.has(file.name))throw Error('Duplicate prepared filename.');byName.set(file.name,file);}
 const manifestFile=byName.get('manifest.json');if(!manifestFile||manifestFile.size>2*1024*1024)throw Error('Choose the preparation manifest and its data files.');
 const parsed:unknown=JSON.parse(await manifestFile.text()),manifest=object(parsed);const {manifestSha256,...unsigned}=manifest;
 if(!digest(manifestSha256)||await hashText(JSON.stringify(unsigned))!==manifestSha256)throw Error('Prepared manifest integrity check failed.');
 if(manifest.version!==1||manifest.tenantId!==tenantId||manifest.committable!==false)throw Error('Prepared source does not match the current company or review contract.');
 const source=object(manifest.source);if(!digest(source.sha256)||source.originalUnchanged!==true||typeof source.filename!=='string')throw Error('Original source preservation was not verified.');integer(source.bytes);
 if(!['review_required','quarantined'].includes(String(manifest.status))||typeof manifest.reportFamily!=='string')throw Error('Invalid preparation status.');
 if(!Array.isArray(manifest.sheets)||manifest.sheets.length>256||!Array.isArray(manifest.chunks)||manifest.chunks.length>10000)throw Error('Invalid prepared report inventory.');
 const sheets=manifest.sheets.map(value=>{const sheet=object(value);if(typeof sheet.name!=='string')throw Error('Invalid worksheet name.');return {name:sheet.name,sourceRows:integer(sheet.sourceRows),normalizedRows:integer(sheet.normalizedRows)};});
 const sheetMap=new Map(sheets.map(sheet=>[sheet.name,sheet]));if(sheetMap.size!==sheets.length)throw Error('Duplicate worksheet name.');
 const counts=object(manifest.counts),sourceRows=integer(counts.sourceRows),normalizedRows=integer(counts.normalizedRows),quarantinedRows=integer(counts.quarantinedRows);
 if(sourceRows>2000000||normalizedRows>4000000||quarantinedRows>normalizedRows||sheets.reduce((n,s)=>n+s.sourceRows,0)!==sourceRows||sheets.reduce((n,s)=>n+s.normalizedRows,0)!==normalizedRows)throw Error('Prepared worksheet totals do not reconcile.');
 const certificationGate=createSourceCertificationGate({tenantId,sourceSha256:source.sha256 as string,reportFamily:manifest.reportFamily as string});
 let observed=0,quarantine=0;const perSheet=new Map<string,number>();
 for(const[index,value]of manifest.chunks.entries()){
  const chunk=object(value);if(chunk.index!==index||chunk.path!==`chunk-${String(index).padStart(5,'0')}.jsonl`||!digest(chunk.sha256))throw Error('Invalid prepared file sequence.');
  const file=byName.get(String(chunk.path));if(!file||file.size!==integer(chunk.bytes)||file.size>4*1024*1024)throw Error('A prepared data file is missing or exceeds its size limit.');
  const buffer=await file.arrayBuffer();if(await hash(buffer)!==chunk.sha256)throw Error('Prepared data file integrity check failed.');
  const text=new TextDecoder('utf-8',{fatal:true}).decode(buffer);if(!text.endsWith('\n'))throw Error('Prepared data file is incomplete.');const lines=text.slice(0,-1).split('\n');
  if(lines.length!==integer(chunk.rows))throw Error('Prepared file row count differs.');
  for(const line of lines){const row=object(JSON.parse(line)),where=object(row.source);const sheet=sheetMap.get(String(where.sheet));
   if(row.committable!==false||where.sha256!==source.sha256||!sheet||integer(where.row)<1||Number(where.row)>sheet.sourceRows||typeof row.kind!=='string'||!digest(row.payloadHash))throw Error('Prepared row provenance is invalid.');
   if(row.customerCode!==null&&typeof row.customerCode!=='string')throw Error('Customer identifiers must remain strings.');
   const payload={kind:row.kind,customerCode:row.customerCode,fields:object(row.fields)};if(await hashText(JSON.stringify(payload))!==row.payloadHash)throw Error('Prepared row payload differs.');
   certificationGate.observe(row);
   observed++;if(row.kind==='quarantine')quarantine++;perSheet.set(sheet.name,(perSheet.get(sheet.name)||0)+1);
  }
 }
 if(byName.size!==manifest.chunks.length+1||observed!==normalizedRows||quarantine!==quarantinedRows||sheets.some(s=>(perSheet.get(s.name)||0)!==s.normalizedRows))throw Error('Prepared report totals or file inventory differ.');
 const reconciliation=object(manifest.reconciliation);
 const date=(value:unknown):string|null=>{if(value===null||value===undefined)return null;if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)throw Error("Invalid prepared report period.");return value;};
 const periodStart=date(manifest.periodStart),periodEnd=date(manifest.periodEnd);
 if((periodStart===null)!==(periodEnd===null)||(periodStart&&periodEnd&&periodStart>periodEnd))throw Error("Invalid prepared report period.");
 const printed=reconciliation.sourcePeriod?object(reconciliation.sourcePeriod):null;
 const periodVerified=Boolean(periodStart&&periodEnd&&reconciliation.periodProvenance==='printed_original'&&printed?.start===periodStart&&printed?.end===periodEnd);

 const strings=(value:unknown)=>{if(!Array.isArray(value)||value.some(v=>typeof v!=='string'))throw Error('Invalid prepared diagnostics.');return value as string[];};
 const certification=certificationGate.finish();
 if(manifest.certification!==undefined&&JSON.stringify(manifest.certification)!==JSON.stringify(certification))throw Error('Source certification claims differ from prepared evidence.');
 const certificationNotices=certification.status==='incomplete'?certification.reasons.map(r=>`Source certification incomplete: ${r.code.replaceAll('_',' ')} (${r.count}).`):[];
 return {certification,filename:source.filename,sourceSha256:source.sha256 as string,reportFamily:manifest.reportFamily,status:String(manifest.status),periodStart,periodEnd,periodVerified,sourceRows,normalizedRows,quarantinedRows,sheets,notices:[...strings(manifest.notices),...certificationNotices],failures:strings(reconciliation.failures)};
}
