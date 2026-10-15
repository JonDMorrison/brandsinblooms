import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as XLSX from "npm:xlsx@0.18.5";
import { normalizeIdealRow, stableIdealFingerprint } from "../_shared/customer-intelligence/ideal-pos.ts";
import { inspectIdealSource, assessIdealRows } from "../_shared/customer-intelligence/ideal-source-review.ts";
import { requireImportTenant } from "../_shared/customer-intelligence/import-access.ts";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
async function sha256(value:string|Uint8Array){const bytes=typeof value==="string"?new TextEncoder().encode(value):value;const exact=new ArrayBuffer(bytes.length);new Uint8Array(exact).set(bytes);return [...new Uint8Array(await crypto.subtle.digest("SHA-256",exact))].map(b=>b.toString(16).padStart(2,"0")).join("");}
function parseDate(v:string|null){if(!v)return null;const d=new Date(v);return Number.isNaN(d.getTime())?null:d.toISOString();}
function profile(name:string|null){const p=String(name??"").trim().split(/\s+/).filter(Boolean);return {first_name:p[0]??null,last_name:p.length>1?p.slice(1).join(" "):null};}
function parseRows(bytes:Uint8Array,name:string) {
 const wb=/\.xlsx?$/i.test(name)
   ? XLSX.read(bytes,{type:"array",cellDates:false})
   : XLSX.read(new TextDecoder("utf-8",{fatal:true}).decode(bytes),{type:"string",FS:/\.tsv$|\.txt$/i.test(name)?"\t":","});
 const worksheet=wb.Sheets[wb.SheetNames[0]];
 if(!worksheet)throw new Error("No worksheet in the supplied Ideal report.");
 const named=XLSX.utils.sheet_to_json<Record<string,unknown>>(worksheet,{defval:"",raw:false});
 const anonymous=XLSX.utils.sheet_to_json<Record<string,unknown>>(worksheet,{header:"A",defval:"",raw:false});
 // Crystal's grouped exports use B/C/H/J, rather than a conventional header row.
 // Keep every source row until the specific transformation has reviewed it.
 return anonymous.some(row=>/^Customer\s+\S+\s+-\s+/i.test(String(row.B??"").trim()))
   ? anonymous : named;
}

Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response(null,{headers:cors});
 if(req.method!=="POST")return reply({error:"Method not allowed"},405);
 try{
  const auth=req.headers.get("Authorization");if(!auth?.startsWith("Bearer "))return reply({error:"Authorization required"},401);
  const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}}});
  const {data:{user},error:authError}=await userClient.auth.getUser();if(authError||!user)return reply({error:"Unauthorized"},401);
  // Resolve permissions and active company as the authenticated user, never with service-role authority.
  let tenantId:string;
  try { tenantId=await requireImportTenant(userClient); } catch { return reply({error:"Integration management permission required"},403); }
  const service=createClient(url,serviceKey,{auth:{persistSession:false}});

  const form=await req.formData();const file=form.get("file");if(!(file instanceof File))return reply({error:"Ideal report file is required"},400);
  if(file.size>25*1024*1024)return reply({error:"File exceeds 25 MB limit"},413);
  if(!/\.(xlsx|xls|csv|txt)$/i.test(file.name))return reply({error:"Use XLSX, XLS, CSV, or TXT Ideal exports"},400);
  const bytes=new Uint8Array(await file.arrayBuffer()),sourceSha=await sha256(bytes),sourceRows=parseRows(bytes,file.name);
  if(sourceRows.length>120000)return reply({error:"This export exceeds the 120,000-row reviewed import limit; split at a documented report boundary, not by removing rows."},413);
  const inspection=inspectIdealSource(file.name,Object.keys(sourceRows[0]??{}),sourceRows);
  const reportType=inspection.review.sourceType,rows=inspection.normalizedRows;
  const digest=await sha256(sourceSha+"|"+reportType+"|"+JSON.stringify(inspection.review)+"|"+inspection.originalRowCount);
  const review={
    preview:true,source_filename:file.name,source_sha256:sourceSha,approved_digest:digest,
    report_type:reportType,source_rows:inspection.originalRowCount,
    accepted:inspection.review.accepted,rejected:inspection.review.rejected,
    missing_dated_transactions:inspection.review.missingDatedTransactions,
    can_measure_visits:inspection.review.canMeasureVisits,
    report_is_aggregate:inspection.review.reportIsAggregate,
    untransformed_rows:inspection.untransformedRows,
    group_headers:inspection.groupHeaders,
    errors:inspection.review.errors,notices:inspection.notices,
    ready_to_import:inspection.review.accepted>0 && !inspection.review.reportIsAggregate
      && (reportType!=="customer_sales" || inspection.review.canMeasureVisits),
    message:"Review only. No customer, purchase, coupon, points or consent records have changed.",
  };
  const mode=String(form.get("mode")??"preview");
  if(mode==="preview")return reply(review);
  if(mode!=="commit" || String(form.get("confirmed"))!=="true" || String(form.get("approved_digest"))!==digest)
    return reply({error:"Explicit confirmation of this exact source-review digest is required. No data was imported.",review},409);
  if(!review.ready_to_import)return reply({error:"This source is grouped, undated, or missing usable transaction evidence. It cannot be committed as purchase facts. Obtain the dated detail or use a separately reconciled aggregate path.",review},422);
  if(inspection.review.rejected>0 && String(form.get("accept_rejected"))!=="true")
    return reply({error:"Review rejected rows and explicitly acknowledge their exclusion before import.",review},409);
  if(!rows.length)return reply({error:"No valid data rows after source inspection"},422);
  const {data:existing}=await service.from("customer_intelligence_imports").select("*").eq("tenant_id",tenantId).eq("source","ideal").eq("report_type",reportType).eq("source_sha256",sourceSha).maybeSingle();
  if(existing)return reply({success:true,duplicate_file:true,import:existing,message:"This exact report was already processed. No customer totals changed."});

  const {data:imp,error:impErr}=await service.from("customer_intelligence_imports").insert({tenant_id:tenantId,source:"ideal",report_type:reportType,source_filename:file.name,source_sha256:sourceSha,status:"processing",source_row_count:rows.length,created_by:user.id}).select("*").single();if(impErr)throw impErr;
  let accepted=0,duplicates=0,rejected=0;const errors:string[]=[];const touched=new Set<string>();
  for(let i=0;i<rows.length;i++){
   try{
    if(assessIdealRows(reportType,[rows[i]]).rejected>0){rejected++;if(errors.length<50)errors.push("Row "+(i+2)+": required source values missing or invalid");continue;}
    const row=normalizeIdealRow(reportType,rows[i]);if(!row.customerCode){rejected++;errors.push("Row "+(i+2)+": missing customer code");continue;}
    const {data:resolved,error:resolveError}=await service.rpc("resolve_crm_customer_identity",{p_tenant_id:tenantId,p_provider:"ideal",p_external_id:row.customerCode,p_pos_connection_id:null,p_pos_customer_id:null,p_email:null,p_phone:null,p_user_id:user.id,p_profile:{...profile(row.customerName),custom_fields:{ideal_customer_name:row.customerName}}});if(resolveError)throw resolveError;
    const customerId=resolved?.customer_id as string|null;if(!customerId){rejected++;errors.push("Row "+(i+2)+": identity needs review");continue;}touched.add(customerId);
    const fingerprint=await sha256(stableIdealFingerprint(row));
    if(reportType==="customer_sales"||reportType==="customer_sales_by_category"){
     const {error}=await service.from("customer_purchase_line_items").insert({tenant_id:tenantId,customer_id:customerId,import_id:imp.id,source:"ideal",external_transaction_id:row.transactionId,external_line_id:row.lineId,external_customer_code:row.customerCode,product_code:row.productCode,product_name:row.productName,sales_category:row.salesCategory,department:row.department,quantity:row.quantity,gross_amount:row.amount,net_amount:row.amount,currency:"CAD",purchased_at:parseDate(row.purchasedAt),source_fingerprint:fingerprint,raw_data:row.raw});if(error){if(error.code==="23505"){duplicates++;continue;}throw error;}accepted++;
    }else{
     const eventType=reportType==="customer_points"?"points":reportType==="coupons_issued"?"coupon_issued":reportType==="coupons_redeemed"?"coupon_redeemed":"customer_spending";
     const {error}=await service.from("customer_intelligence_source_events").insert({tenant_id:tenantId,customer_id:customerId,import_id:imp.id,source:"ideal",event_type:eventType,external_customer_code:row.customerCode,external_transaction_id:row.transactionId,coupon_code:row.couponCode,points_delta:row.pointsDelta,amount:row.amount,occurred_at:parseDate(row.redeemedAt||row.issuedAt||row.purchasedAt),expires_at:parseDate(row.expiresAt),source_fingerprint:fingerprint,raw_data:row.raw});if(error){if(error.code==="23505"){duplicates++;continue;}throw error;}accepted++;
    }
   }catch(e){rejected++;errors.push("Row "+(i+2)+": "+(e instanceof Error?e.message:"processing failed"));}
  }
  const status=rejected?"completed_with_errors":"completed";
  await service.from("customer_intelligence_imports").update({status,accepted_row_count:accepted,duplicate_row_count:duplicates,rejected_row_count:rejected,error_summary:errors.slice(0,100),reconciliation:{source_rows:rows.length,accepted,duplicates,rejected,customers_touched:touched.size},completed_at:new Date().toISOString()}).eq("id",imp.id).eq("tenant_id",tenantId);
  await service.from("customer_intelligence_sources").upsert({tenant_id:tenantId,source_type:"ideal_import",provider:"ideal",status:accepted?"active":"attention_required",sync_mode:"manual_import",capabilities:{report_type:reportType},validation_summary:{accepted,duplicates,rejected},last_validated_at:new Date().toISOString(),last_data_at:accepted?new Date().toISOString():null,activated_at:accepted?new Date().toISOString():null},{onConflict:"tenant_id,provider"});
  if(accepted)await service.rpc("recalculate_customer_intelligence_after_import",{p_tenant_id:tenantId,p_import_id:imp.id});
  return reply({success:true,duplicate_file:false,import_id:imp.id,report_type:reportType,source_rows:rows.length,accepted,duplicates,rejected,customers_touched:touched.size,errors:errors.slice(0,20)});
 }catch(e){console.error("[ideal-intelligence-import]",e);return reply({error:e instanceof Error?e.message:"Import failed"},500);}
});
