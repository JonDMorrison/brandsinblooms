import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as XLSX from "npm:xlsx@0.18.5";
import { detectIdealReportType, normalizeIdealRow, stableIdealFingerprint } from "../_shared/customer-intelligence/ideal-pos.ts";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
async function sha256(value:string|Uint8Array){const bytes=typeof value==="string"?new TextEncoder().encode(value):value;return [...new Uint8Array(await crypto.subtle.digest("SHA-256",bytes))].map(b=>b.toString(16).padStart(2,"0")).join("");}
function parseDate(v:string|null){if(!v)return null;const d=new Date(v);return Number.isNaN(d.getTime())?null:d.toISOString();}
function profile(name:string|null){const p=String(name??"").trim().split(/\s+/).filter(Boolean);return {first_name:p[0]??null,last_name:p.length>1?p.slice(1).join(" "):null};}
function parseRows(bytes:Uint8Array,name:string){
 if(/\.xlsx?$/i.test(name)){const wb=XLSX.read(bytes,{type:"array",cellDates:true});return XLSX.utils.sheet_to_json<Record<string,unknown>>(wb.Sheets[wb.SheetNames[0]],{defval:"",raw:false});}
 const text=new TextDecoder().decode(bytes);const wb=XLSX.read(text,{type:"string",FS:text.includes("\t")?"\t":","});return XLSX.utils.sheet_to_json<Record<string,unknown>>(wb.Sheets[wb.SheetNames[0]],{defval:"",raw:false});
}

Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response(null,{headers:cors});
 if(req.method!=="POST")return reply({error:"Method not allowed"},405);
 try{
  const auth=req.headers.get("Authorization");if(!auth?.startsWith("Bearer "))return reply({error:"Authorization required"},401);
  const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}}});const service=createClient(url,serviceKey,{auth:{persistSession:false}});
  const {data:{user},error:authError}=await userClient.auth.getUser();if(authError||!user)return reply({error:"Unauthorized"},401);
  const {data:userRow}=await service.from("users").select("tenant_id").eq("id",user.id).single();if(!userRow?.tenant_id)return reply({error:"Tenant context required"},403);
  const tenantId=userRow.tenant_id;
  const {data:allowed}=await service.rpc("has_tenant_permission",{p_tenant_id:tenantId,p_permission:"integrations.manage",p_resource_id:null});if(!allowed)return reply({error:"Integration management permission required"},403);

  const form=await req.formData();const file=form.get("file");if(!(file instanceof File))return reply({error:"Ideal report file is required"},400);
  if(file.size>25*1024*1024)return reply({error:"File exceeds 25 MB limit"},413);
  if(!/\.(xlsx|xls|csv|txt)$/i.test(file.name))return reply({error:"Use XLSX, XLS, CSV, or TXT Ideal exports"},400);
  const bytes=new Uint8Array(await file.arrayBuffer()),sourceSha=await sha256(bytes),rows=parseRows(bytes,file.name);
  if(!rows.length)return reply({error:"No data rows found"},400);
  const reportType=detectIdealReportType(Object.keys(rows[0]??{}));if(!reportType)return reply({error:"BloomSuite could not identify this Ideal report type"},422);
  const {data:existing}=await service.from("customer_intelligence_imports").select("*").eq("tenant_id",tenantId).eq("source","ideal").eq("report_type",reportType).eq("source_sha256",sourceSha).maybeSingle();
  if(existing)return reply({success:true,duplicate_file:true,import:existing,message:"This exact report was already processed. No customer totals changed."});

  const {data:imp,error:impErr}=await service.from("customer_intelligence_imports").insert({tenant_id:tenantId,source:"ideal",report_type:reportType,source_filename:file.name,source_sha256:sourceSha,status:"processing",source_row_count:rows.length,created_by:user.id}).select("*").single();if(impErr)throw impErr;
  let accepted=0,duplicates=0,rejected=0;const errors:string[]=[];const touched=new Set<string>();
  for(let i=0;i<rows.length;i++){
   try{
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