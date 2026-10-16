/** Fully invented identities and transactions. No production reads or secrets. */
const customers = [
  { id: "synthetic-001", first_name: "Avery", last_name: "Bloom", email: null },
  { id: "synthetic-002", first_name: "Sam", last_name: "Leaf", email: null },
  { id: "synthetic-003", first_name: "Morgan", last_name: "Grow", email: null },
];
const metrics = [
  {
    customer_id: "synthetic-001",
    lifetime_value: 420,
    purchase_velocity: -14,
    days_since_last_purchase: 155,
    customer_tier: "vip",
    top_product_categories: ["Perennials", "Pottery"],
  },
  {
    customer_id: "synthetic-003",
    lifetime_value: 340,
    purchase_velocity: -18,
    days_since_last_purchase: 33,
    customer_tier: "loyal",
    top_product_categories: ["Pottery", "Outdoor plants"],
  },
];
export const supabase = {
  from(table: string) {
    if (!["crm_customers", "customer_purchase_metrics"].includes(table)) {
      throw new Error("Unexpected synthetic source: " + table);
    }
    const rows = table === "crm_customers" ? customers : metrics;
    const q = {
      select() {
        return q;
      },
      eq() {
        return q;
      },
      order() {
        return q;
      },
      is() {
        return q;
      },
      async range(from: number, to: number) {
        return { data: rows.slice(from, to + 1), error: null };
      },
    };
    return q;
  },
};
