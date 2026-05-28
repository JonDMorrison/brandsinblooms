import type { GeneratedInsight, ServiceClient } from "../types.ts";
import {
  buildExpiresAt,
  customerDisplayName,
  DEFAULT_INSIGHT_EXPIRY_DAYS,
  pluralize,
  summarizePreviewItems,
} from "../utils.ts";

interface DormantCustomerRow {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  total_spent: number | null;
}

export async function generateInsights(
  serviceClient: ServiceClient,
  tenantId: string,
  now = new Date(),
): Promise<GeneratedInsight[]> {
  const cutoff = new Date(now.getTime() - 90 * 86_400_000).toISOString();
  const { data, error } = await serviceClient
    .from("crm_customers")
    .select("id, email, first_name, last_name, total_spent")
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .not("last_purchase_date", "is", null)
    .lt("last_purchase_date", cutoff)
    .gt("total_spent", 200)
    .order("total_spent", { ascending: false });

  if (error) {
    throw error;
  }

  const customers = (data ?? []) as DormantCustomerRow[];
  if (customers.length === 0) {
    return [];
  }

  const preview = summarizePreviewItems(
    customers.map((customer) => customerDisplayName(customer)),
    "customer",
  );
  const count = customers.length;

  return [
    {
      insightType: "dormant_high_value_customers",
      title: `${count} valuable ${pluralize(count, "customer", "customers")} ${count === 1 ? "hasn't" : "haven't"} ordered in 90+ days`,
      description: preview
        ? `Examples: ${preview}.`
        : "High-value customers are slipping into dormancy.",
      actionPrompt:
        "Show me dormant high-value customers and suggest a re-engagement campaign",
      entityType: "customer",
      entityId: customers[0]?.id ?? null,
      severity: "warning",
      expiresAt: buildExpiresAt(DEFAULT_INSIGHT_EXPIRY_DAYS, now),
    },
  ];
}
