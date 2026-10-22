import {createCategorySalesNormalizer} from './ideal-category-sales.mjs';
import {createHash} from 'node:crypto';
export const sha256=value=>createHash('sha256').update(value).digest('hex');
export const FAMILIES=['customer_master','annual_sales','customer_sales','customer_sales_by_category','customer_spending','points','coupons_redeemed','coupons_issued','journal'];
const money=v=>{if(typeof v==='number')return Number.isFinite(v)?v:null;if(typeof v!=='string'||!/^-?\$?\d+(?:,\d{3})*(?:\.\d+)?$/.test(v.trim()))return null;const n=Number(v.replace(/[$,]/g,''));return Number.isFinite(n)?n:null;};
const number=v=>{const n=typeof v==='number'?v:typeof v==='string'&&/^-?\d+(?:\.\d+)?$/.test(v.trim())?Number(v):null;return n!==null&&Number.isFinite(n)?n:null;};
/** RFC4180 rows, including multiline quoted cells, with bounded cell/column memory. */
export async function* delimitedRows(stream,{delimiter=',',encoding='utf-8',maxCellBytes=1024*1024,maxColumns=512}={}){
 const decoder=new TextDecoder(encoding,{fatal:true});let row=[],cell='',quoted=false,pendingQuote=false,skipLF=false;
 function add(c){cell+=c;if(cell.length>maxCellBytes)throw Error('Cell exceeds reviewed memory limit');}
 function column(){row.push(cell);cell='';if(row.length>maxColumns)throw Error('Too many columns');}
 for await(const bytes of stream){const text=decoder.decode(bytes,{stream:true});for(let i=0;i<text.length;i++){const c=text[i];if(skipLF){skipLF=false;if(c==='\n')continue;}if(quoted){if(pendingQuote){pendingQuote=false;if(c==='"'){add('"');continue;}quoted=false;if(c!==delimiter&&c!=='\n'&&c!=='\r')throw Error('Unexpected character after closing quote');}else{if(c==='"')pendingQuote=true;else add(c);continue;}}
 if(c==='"'){if(cell)throw Error('Quote inside unquoted cell');quoted=true;}else if(c===delimiter)column();else if(c==='\r'||c==='\n'){column();yield row;row=[];skipLF=c==='\r';}else add(c);}}
 const tail=decoder.decode();if(tail)throw Error('Incomplete decoder tail');if(quoted&&!pendingQuote)throw Error('Unclosed quoted cell');if(cell||row.length||pendingQuote){column();yield row;}
}
export function createNormalizer(family,{periodStart=null,periodEnd=null}={}){
 if(!FAMILIES.includes(family))throw Error('Choose an explicit supported report family');
 let sourcePeriod=null,worksheetHeaderSheet=null,worksheetReportHeader=false;let headers=null,customerCode=null,department=null,couponType=null;let group=null,grand=null;const failures=[];let groups=0;let issuedSheet=null,issuedTitle=false,issuedColumns=false,issuedCount=0,issuedTotal=null;
 const finish=()=>{if(!group)return;if(!group.total||group.cents!==group.total.cents||Math.abs(group.quantity-group.total.quantity)>0.00001)failures.push('Customer subtotal mismatch');groups++;};
 const categorySales=family==='customer_sales_by_category'?createCategorySalesNormalizer():null;
 const map=(r)=>Object.fromEntries(headers.map((k,i)=>[k,String(r[i]??'')]));
 return {row(r,location={}){
 const a=String(r[0]??'').trim();
 // Actual XLS exports print their report range in E6. Crystal CSV repeats it
 // in column 5 alongside the verified report-label columns, not product text.
 if(location.format==='worksheet'&&location.row===1){const expected={annual_sales:'Customer Sales Report',customer_sales:'Customer Sales Report',customer_sales_by_category:'Customer Sales Report',customer_spending:'Customer Spending Report',points:'Customer Points Report',journal:'Customer Journal History'}[family];worksheetReportHeader=Boolean(expected)&&r[5]===expected;worksheetHeaderSheet=location.sheet;}
 const worksheetHeader=location.format==='worksheet'&&location.row===6&&worksheetReportHeader&&location.sheet===worksheetHeaderSheet;
 const crystalHeader=location.format==='delimited'&&family==='customer_sales'&&r.length===33&&r[6]==='Sales'&&r[8]==='Code'&&r[9]==='Description'&&r[10]==='Quantity'&&r[11]==='Amount'&&/^Customer\s+(.+?)\s+-\s+/.test(String(r[13]??''));
 for(const value of worksheetHeader||crystalHeader?[r[4]]:[]){if(typeof value!=='string')continue;const match=/^(\d{2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4}) 00:00:00 to (\d{2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4}) 23:59:59$/.exec(value.trim());if(!match)continue;
 const date=(day,month,year)=>{const m=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(month)+1;const iso=`${year}-${String(m).padStart(2,'0')}-${day}`;if(new Date(iso+'T00:00:00Z').toISOString().slice(0,10)!==iso)throw Error('Invalid printed period');return iso;};const found={start:date(match[1],match[2],match[3]),end:date(match[4],match[5],match[6])};
 if(sourcePeriod&&JSON.stringify(sourcePeriod)!==JSON.stringify(found))failures.push('Printed report periods disagree');sourcePeriod=found;if((periodStart&&periodStart!==found.start)||(periodEnd&&periodEnd!==found.end))failures.push('Operator period differs from printed original period');periodStart??=found.start;periodEnd??=found.end;
 }

 if(categorySales)return categorySales.row(r,location,{periodStart,periodEnd});
 if(family==='customer_spending'&&typeof r[0]==='string'&&a){const offset=number(r[11])!==null&&number(r[13])!==null?0:number(r[12])!==null&&number(r[14])!==null?1:null;if(offset!==null){groups++;return {kind:'reported_spending',customerCode:r[0],fields:{amountCents:Math.round(number(r[11+offset])*100),reportedTransactions:number(r[13+offset]),periodStart,periodEnd},committable:false};}}
 if(family==='customer_spending'&&!a&&number(r[11])!==null&&number(r[13])!==null){grand={cents:Math.round(number(r[11])*100),quantity:number(r[13])};return null;}
 if(family==='customer_sales'&&r.length===33&&/^Customer\s+(.+?)\s+-\s+/.test(String(r[13]??''))&&/^DPT\s/.test(String(r[14]??''))){
 const code=/^Customer\s+(.+?)\s+-\s+/.exec(r[13])[1];if(code!==customerCode){finish();customerCode=code;group={cents:0,quantity:0,total:null};}
 const quantity=money(r[17]),amount=money(r[18]),totalQuantity=money(r[25]),totalAmount=money(r[26]),grandQuantity=money(r[30]),grandAmount=money(r[31]);if([quantity,amount,totalQuantity,totalAmount,grandQuantity,grandAmount].some(v=>v===null))throw Error('Invalid Crystal CSV amount');
 const subtotal={quantity:totalQuantity,cents:Math.round(totalAmount*100)};if(group.total&&JSON.stringify(group.total)!==JSON.stringify(subtotal))failures.push('Repeated customer subtotal differs');group.total=subtotal;group.quantity+=quantity;group.cents+=Math.round(amount*100);
 const declared={quantity:grandQuantity,cents:Math.round(grandAmount*100)};if(grand&&JSON.stringify(grand)!==JSON.stringify(declared))failures.push('Repeated grand total differs');grand=declared;
 return {kind:'purchase_summary_item',customerCode,fields:{productCode:String(r[15]),productName:String(r[16]),department:r[14],quantity,amountCents:Math.round(amount*100),periodStart,periodEnd},committable:false};
 }
 if(family==='customer_sales'&&r.length===15&&/^Customer\s+(.+?)\s+-\s+/.test(String(r[13]??'')))return null;
 if(family==='annual_sales'||family==='customer_sales'){
 const m=/^Customer\s+(.+?)\s+-\s+/.exec(a);if(m){finish();customerCode=m[1];department=null;group={cents:0,quantity:0,total:null};return null;}
 if(/^DPT\s/.test(String(r[1]??''))){department=String(r[1]);return null;}
 if(a&&typeof r[3]==='string'&&(r[8]!==null&&r[8]!==undefined||r[10]!==null&&r[10]!==undefined)&&(number(r[8])===null||number(r[10])===null))throw Error('Invalid product quantity or amount');
 if(a&&typeof r[3]==='string'&&number(r[8])!==null&&number(r[10])!==null){if(!customerCode||!department||!group)throw Error('Unassigned annual sales row');const quantity=number(r[8]),amountCents=Math.round(number(r[10])*100);group.cents+=amountCents;group.quantity+=quantity;return {kind:'purchase_summary_item',customerCode,fields:{productCode:a,productName:r[3],department,quantity,amountCents,periodStart,periodEnd},committable:false};}
 if(number(r[7])!==null&&number(r[9])!==null){const t={quantity:number(r[7]),cents:Math.round(number(r[9])*100)};if(number(r[11])!==null){if(!group)throw Error('Unassigned subtotal');group.total=t;}else grand=t;}return null;
 }
 if(family==='customer_master'){
 if(r.includes('CODE')){headers=r.map(String);return null;}if(!headers)return null;const m=map(r);if(!m.CODE)return null;
 // Exclude passwords, credit limits, balances and unrelated fields at the first output boundary.
 return {kind:'customer_profile',customerCode:m.CODE,fields:Object.fromEntries(['LASTNAME','FIRSTNAME','MOBILE','EMAIL','TYPE','MAILOUT','ACCOUNT','PRICELEVEL'].filter(k=>k in m).map(k=>[k,m[k]])),committable:false};
 }
 if(family==='points'){
 if(typeof r[0]==='string'&&r[3]&&number(r[9])!==null)customerCode=r[0].trim();
 if(number(r[14])!==null&&typeof r[11]==='string'&&(number(r[8])!==null||number(r[9])!==null))return {kind:'unverified_points_movement',customerCode,fields:{localExcelDate:number(r[9])??number(r[8]),movementType:r[11],points:number(r[14])},committable:false};return null;
 }
 if(family==='coupons_issued'){
 // Verified September 27 original: title F2, headings C/G/J/N/O10,
 // serial C, local printed G, valid dates K/N, audit P. No customer ID.
 if(location.format!=='worksheet')throw Error('Issued coupons require the reviewed worksheet layout');
 if(issuedSheet!==location.sheet){issuedSheet=location.sheet;issuedTitle=false;issuedColumns=false;couponType=null;}
 if(location.row===2)issuedTitle=r[5]==='Coupons Report';
 if(location.row===10)issuedColumns=issuedTitle&&r[2]==='Code'&&r[6]==='Date Printed'&&r[9]==='Valid Dates'&&r[13]==='Audit'&&r[14]==='Qty';
 if(typeof r[0]==='number'&&typeof r[1]==='string'&&Number.isInteger(r[0])&&r[0]>0)couponType=r[0];
 if(r[12]==='Total Coupons:'){if(!issuedColumns||issuedTotal!==null||!Number.isInteger(r[15])||r[15]<0)throw Error('Invalid issued coupon total');issuedTotal=r[15];return null;}
 const candidate=r[2]!=null||typeof r[6]==='number'||r[15]!=null;
 if(!candidate||location.row<=10)return null;
 const validDate=v=>typeof v==='number'&&Number.isFinite(v)&&v>=20000&&v<80000;
 if(!issuedColumns||!couponType||issuedTotal!==null||typeof r[2]!=='string'||!/^\d+$/.test(r[2])||!validDate(r[6])||!validDate(r[10])||!validDate(r[13])||r[13]<r[10]||r[12]!=='to'||typeof r[15]!=='string'||!/^\d{1,3}(?:,\d{3})+-\d+$/.test(r[15]))throw Error('Invalid issued coupon row or unreviewed layout');
 issuedCount++;
 return {kind:'unverified_coupon_issuance',customerCode:null,fields:{couponCode:r[2],couponType,printedLocalExcelDate:r[6],validFromLocalExcelDate:r[10],validThroughLocalExcelDate:r[13],auditReference:r[15]},committable:false};
 }
 if(family==='coupons_redeemed'){
 if(number(r[0])!==null&&typeof r[1]==='string')couponType=number(r[0]);
 if(number(r[8])!==null&&number(r[11])!==null&&typeof r[14]==='string')return {kind:'unverified_coupon_redemption',customerCode:null,fields:{couponCode:String(r[1]??'').trim(),couponType,printedLocalExcelDate:number(r[8]),redeemedLocalExcelDate:number(r[11]),transactionReference:r[14].trim()},committable:false};return null;
 }
 if(family==='journal'){
 const m=/^(.+?)\s{5}(\S+)\s*$/.exec(a);if(m)customerCode=m[2];
 // Header evidence only. Mixed detail streams are not certified financial facts.
 const found=[];for(let c=0;c<r.length;c++){const date=number(r[c]);if(date!==null&&date>=20000&&date<80000&&number(r[c+2])!==null&&typeof r[c+3]==='string')found.push({kind:'unverified_receipt_header',customerCode,fields:{localExcelDate:date,terminal:number(r[c+2]),receiptNumber:r[c+3].trim(),column:c},committable:false});}return found;
 }
 if(!headers){const normalized=r.map(v=>String(v??'').trim().toLowerCase());if(!normalized.some(x=>['customer code','code'].includes(x)))return null;headers=normalized;return null;}
 const m=map(r),code=m['customer code']??m.code;if(!code)return null;
 const amount=number(m.amount??m['dollar amount bought']??m.spending),qty=number(m.quantity??m['quantity bought']);
 if(amount===null)return {kind:'quarantine',customerCode:null,fields:{reason:'Missing valid amount'},committable:false};
 return {kind:family==='customer_spending'?'reported_spending':'purchase_summary_item',customerCode:code,fields:{amountCents:Math.round(amount*100),quantity:qty,department:m.department??null,productCode:m['product code']??null,periodStart,periodEnd},committable:false};
 },finish(){finish();if(categorySales){const result=categorySales.finish();groups=result.groupCount;grand=result.grandTotal;failures.push(...result.failures);}if(family==='coupons_issued'&&(issuedTotal===null||issuedCount!==issuedTotal))failures.push('Issued coupon printed total mismatch or unavailable');if(['annual_sales','customer_sales','customer_sales_by_category','customer_spending'].includes(family)&&!sourcePeriod)failures.push('Printed report period is unavailable; source period requires separate verified mapping');return {sourcePeriod,periodProvenance:sourcePeriod?'printed_original':'unavailable',groupCount:groups,grandTotal:grand,failures:[...new Set(failures)],requiresReview:true};}};
}
/** File replay and overlapping aggregate evidence must never be treated as additive sales. */
export function comparePreparedSources(a,b){
 if(a.tenantId!==b.tenantId)return 'different_tenant';
 if(a.source.sha256===b.source.sha256)return 'duplicate_file';
 const aggregate=new Set(['annual_sales','customer_sales','customer_sales_by_category','customer_spending']);
 if(aggregate.has(a.reportFamily)&&aggregate.has(b.reportFamily)){if(!a.periodStart||!a.periodEnd||!b.periodStart||!b.periodEnd)return 'unknown_overlap_requires_reconciliation';if(a.periodEnd>=b.periodStart&&b.periodEnd>=a.periodStart)return 'overlap_requires_reconciliation';}
 return 'distinct_source_requires_record_review';
}
