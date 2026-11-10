import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CustomerIntelligenceDetail={
 customer_id:string; lifetime_value:number|null; average_order_value:number|null;
 purchase_frequency:number|null; days_since_last_purchase:number|null; purchase_velocity:number|null;
 customer_tier:string|null; total_quantity:number|null; category_spend:Record<string,number>|null;
 department_spend:Record<string,number>|null; departments_shopped:number|null; categories_shopped:number|null;
 last_line_item_purchase_at:string|null;
};

export function useCustomerIntelligenceDetail(customerId:string|undefined){
 return useQuery({
  queryKey:["customer-intelligence-detail",customerId],
  enabled:Boolean(customerId),
  staleTime:120000,
  queryFn:async()=>{
   const {data,error}=await supabase.from("customer_purchase_intelligence")
    .select("customer_id,lifetime_value,average_order_value,purchase_frequency,days_since_last_purchase,purchase_velocity,customer_tier,total_quantity,category_spend,department_spend,departments_shopped,categories_shopped,last_line_item_purchase_at")
    .eq("customer_id",customerId!).maybeSingle();
   if(error) throw error;
   return data as CustomerIntelligenceDetail|null;
  }
 });
}
