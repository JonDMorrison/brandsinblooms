import type { JsonObject, JsonValue } from "../../types.ts";
import type { ToolExecutionContext, ToolImplementation, ToolResult } from "../types.ts";
import { getQueryClient } from "./shared.ts";

type Row = {
  customer_id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  lifetime_value: number | null;
  purchase_frequency: number | null;
  days_since_last_purchase: number | null;
  purchase_velocity: number | null;
  total_quantity: number | null;
  departments_shopped: number | null;
  categories_shopped: number | null;
  category_spend: Record<string, number> | null;
  department_spend: Record<string, number> | null;
};

const n=(v:unknown)=>typeof v==="number"&&Number.isFinite(v)?v:Number(v)||0;
const obj=(v:unknown):Record<string,number>=>{
  if(!v||typeof v!=="object"||Array.isArray(v)) return {};
  return Object.fromEntries(Object.entries(v as Record<string,unknown>).map(([k,x])=>[k,n(x)]));
};
const pct=(v:number,min:number,max:number)=>max<=min?100:Math.max(0,Math.min(100,((v-min)/(max-min))*100));
const inversePct=(v:number,min:number,max:number)=>100-pct(v,min,max);

export const rankCustomersByIntelligence: ToolImplementation = async (params, context): Promise<ToolResult> => {
  const client=getQueryClient(context);
  const limit=Math.min(500,Math.max(1,n(params.limit)||100));
  const dimension=typeof params.dimension==="string"?params.dimension:"overall";
  const dimensionValue=typeof params.dimension_value==="string"?params.dimension_value:null;
  const weights=(params.weights&&typeof params.weights==="object"&&!Array.isArray(params.weights)
    ? params.weights : {}) as Record<string,unknown>;

  const {data,error}=await client.from("customer_purchase_intelligence")
    .select("customer_id,email,first_name,last_name,lifetime_value,purchase_frequency,days_since_last_purchase,purchase_velocity,total_quantity,departments_shopped,categories_shopped,category_spend,department_spend")
    .eq("tenant_id",context.tenantId).limit(5000);
  if(error) return {success:false,data:null,count:null,message:"Customer intelligence ranking failed.",error:error.message,block_type:"text",confirmation_required:false,confirmation_details:null};

  const rows=(data??[]) as Row[];
  const dimensionSpend=(r:Row)=>{
    if(dimension==="category"&&dimensionValue) return n(obj(r.category_spend)[dimensionValue]);
    if(dimension==="department"&&dimensionValue) return n(obj(r.department_spend)[dimensionValue]);
    return n(r.lifetime_value);
  };
  const metrics={
    value:rows.map(dimensionSpend),frequency:rows.map(r=>n(r.purchase_frequency)),
    quantity:rows.map(r=>n(r.total_quantity)),breadth:rows.map(r=>n(r.departments_shopped)),
    recency:rows.map(r=>n(r.days_since_last_purchase)),trend:rows.map(r=>n(r.purchase_velocity)),
    overall:rows.map(r=>n(r.lifetime_value)),
  };
  const range=(xs:number[])=>[Math.min(...xs,0),Math.max(...xs,0)] as const;
  const ranges=Object.fromEntries(Object.entries(metrics).map(([k,x])=>[k,range(x)]));
  const defaultWeights={value:40,quantity:20,breadth:15,frequency:15,overall:10,recency:0,trend:0};
  const w={...defaultWeights,...Object.fromEntries(Object.entries(weights).map(([k,v])=>[k,n(v)]))};
  const weightTotal=Object.values(w).reduce((a,b)=>a+n(b),0)||1;

  const ranked=rows.map(r=>{
    const raw={value:dimensionSpend(r),quantity:n(r.total_quantity),breadth:n(r.departments_shopped),
      frequency:n(r.purchase_frequency),overall:n(r.lifetime_value),recency:n(r.days_since_last_purchase),trend:n(r.purchase_velocity)};
    const components:Record<string,number>={};
    for(const [key,val] of Object.entries(raw)){
      const [min,max]=ranges[key] as [number,number];
      components[key]=Math.round((key==="recency"?inversePct(val,min,max):pct(val,min,max))*10)/10;
    }
    const score=Object.entries(w).reduce((sum,[key,weight])=>sum+(components[key]??0)*n(weight),0)/weightTotal;
    return {customer_id:r.customer_id,name:[r.first_name,r.last_name].filter(Boolean).join(" ")||r.email||"Customer",
      email:r.email,score:Math.round(score*10)/10,components,source_values:raw,weights:w};
  }).sort((a,b)=>b.score-a.score).slice(0,limit);

  return {success:true,data:ranked as unknown as JsonValue,count:ranked.length,
    message:`Ranked ${ranked.length} customers with visible source values, normalized components, and weights.`,
    error:null,block_type:"data_table",confirmation_required:false,confirmation_details:null};
};

export const findCustomerOpportunities: ToolImplementation = async (params, context): Promise<ToolResult> => {
  const client=getQueryClient(context);
  const minDecline=Math.abs(n(params.minimum_decline_percent)||25);
  const limit=Math.min(500,Math.max(1,n(params.limit)||100));
  const {data,error}=await client.from("customer_purchase_intelligence")
    .select("customer_id,email,first_name,last_name,lifetime_value,purchase_velocity,days_since_last_purchase,top_product_categories")
    .eq("tenant_id",context.tenantId).lte("purchase_velocity",-minDecline)
    .order("lifetime_value",{ascending:false}).limit(limit);
  if(error) return {success:false,data:null,count:null,message:"Opportunity query failed.",error:error.message,block_type:"text",confirmation_required:false,confirmation_details:null};
  return {success:true,data:(data??[]) as unknown as JsonValue,count:(data??[]).length,
    message:`Found ${(data??[]).length} customers whose recent purchase velocity declined by at least ${minDecline}%.`,
    error:null,block_type:"data_table",confirmation_required:false,confirmation_details:null};
};
