import type { GeneratedInsight, ServiceClient } from "../types.ts";
import {
  buildExpiresAt,
  DEFAULT_INSIGHT_EXPIRY_DAYS,
  pluralize,
  summarizePreviewItems,
} from "../utils.ts";

interface LowStockProductRow {
  id: string;
  name: string;
  inventory_count: number | null;
}

function inventoryLabel(product: LowStockProductRow) {
  const count = product.inventory_count ?? 0;
  return `${product.name} (${count})`;
}

export async function generateInsights(
  serviceClient: ServiceClient,
  tenantId: string,
  now = new Date(),
): Promise<GeneratedInsight[]> {
  const { data, error } = await serviceClient
    .from("products")
    .select("id, name, inventory_count")
    .eq("tenant_id", tenantId)
    .eq("track_inventory", true)
    .not("inventory_count", "is", null)
    .lte("inventory_count", 5)
    .order("inventory_count", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    throw error;
  }

  const products = (data ?? []) as LowStockProductRow[];
  if (products.length === 0) {
    return [];
  }

  const preview = summarizePreviewItems(
    products.map(inventoryLabel),
    "product",
  );
  const hasOutOfStockProduct = products.some(
    (product) => (product.inventory_count ?? 0) <= 0,
  );
  const count = products.length;

  return [
    {
      insightType: "low_stock_detection",
      title: `${count} ${pluralize(count, "product")} running low on stock`,
      description: preview
        ? `Lowest inventory right now: ${preview}.`
        : "Products are approaching or at their inventory floor.",
      actionPrompt:
        "Show me all low-stock products and suggest reorder quantities",
      entityType: "product",
      entityId: products[0]?.id ?? null,
      severity: hasOutOfStockProduct ? "warning" : "info",
      expiresAt: buildExpiresAt(DEFAULT_INSIGHT_EXPIRY_DAYS, now),
    },
  ];
}
