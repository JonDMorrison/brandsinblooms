import type { GeneratedInsight, ServiceClient } from "../types.ts";

type IntelligenceRow = {
  customer_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  lifetime_value: number | null;
  purchase_velocity: number | null;
  days_since_last_purchase: number | null;
  customer_tier: string | null;
  top_product_categories: string[] | null;
};

const money=(v:number)=>new Intl.NumberFormat("en-CA",{style:"currency",currency:"CAD",maximumFractionDigits:0}).format(v);

export async function generateInsights(
  serviceClient: ServiceClient,
  tenantId: string,
  now: Date,
): Promise<GeneratedInsight[]> {
  const { data, error } = await serviceClient
    .from("customer_purchase_intelligence")
    .select("customer_id,first_name,last_name,email,lifetime_value,purchase_velocity,days_since_last_purchase,customer_tier,top_product_categories")
    .eq("tenant_id", tenantId)
    .lte("purchase_velocity", -25)
    .gte("lifetime_value", 250)
    .order("lifetime_value", { ascending: false })
    .limit(500);

  if (error) throw error;
  const rows=(data??[]) as IntelligenceRow[];
  if(rows.length===0) return [];

  const valueAtRisk=rows.reduce((sum,row)=>sum+Number(row.lifetime_value??0),0);
  const vipCount=rows.filter(row=>["vip","loyal"].includes(String(row.customer_tier??"").toLowerCase())).length;
  const categories=new Map<string,number>();
  for(const row of rows) for(const category of row.top_product_categories??[]) categories.set(category,(categories.get(category)??0)+1);
  const topCategory=[...categories.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]??null;
  const expiresAt=new Date(now.getTime()+36*60*60*1000).toISOString();

  return [{
    insightType:"customer_value_at_risk",
    title:`${rows.length} valuable customers are slowing down`,
    description:`${vipCount} are loyal/VIP customers. Together this group represents ${money(valueAtRisk)} in historical customer value${topCategory?`, with ${topCategory} showing up frequently in their purchase history`:""}. Bloom found them from purchase velocity and customer value—not an AI guess.`,
    actionPrompt:`Show me the ${rows.length} high-value customers whose recent purchasing has declined by at least 25%. Explain the strongest patterns, then help me build a win-back audience without sending anything until I approve it.`,
    entityType:null,
    entityId:null,
    severity:valueAtRisk>=100000||vipCount>=50?"critical":"warning",
    expiresAt,
  }];
}
