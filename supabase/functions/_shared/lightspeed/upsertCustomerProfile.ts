type LightspeedCustomerProfileRow = {
  tenant_id: string;
  lightspeed_customer_id: string;
  [key: string]: unknown;
};

type LightspeedCustomerProfileWriteResult = {
  mode: "inserted" | "updated";
  id: string | null;
  totalSpend: number | null;
  purchaseCount: number | null;
  firstPurchaseDate: string | null;
  lastPurchaseDate: string | null;
};

const PROTECTED_CALCULATED_FIELDS = new Set([
  "total_spend",
  "purchase_count",
  "first_purchase_date",
  "last_purchase_date",
]);

function toNullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function toNullableInteger(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeDate(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function sanitizeCustomerProfileRow(profileRow: LightspeedCustomerProfileRow) {
  const sanitizedRow = Object.fromEntries(
    Object.entries(profileRow).filter(
      ([key, value]) =>
        !PROTECTED_CALCULATED_FIELDS.has(key) && value !== undefined,
    ),
  ) as Record<string, unknown>;

  if (sanitizedRow.contact_id === null) {
    delete sanitizedRow.contact_id;
  }

  return sanitizedRow;
}

function buildWriteResult(
  mode: "inserted" | "updated",
  customer: Record<string, unknown> | null,
): LightspeedCustomerProfileWriteResult {
  return {
    mode,
    id: typeof customer?.id === "string" ? customer.id : null,
    totalSpend: toNullableNumber(customer?.total_spend),
    purchaseCount: toNullableInteger(customer?.purchase_count),
    firstPurchaseDate: normalizeDate(customer?.first_purchase_date),
    lastPurchaseDate: normalizeDate(customer?.last_purchase_date),
  };
}

export async function upsertLightspeedCustomerProfile(
  supabase: any,
  profileRow: LightspeedCustomerProfileRow,
): Promise<LightspeedCustomerProfileWriteResult> {
  const now = new Date().toISOString();
  const sanitizedProfileRow = {
    ...sanitizeCustomerProfileRow(profileRow),
    updated_at: now,
  };

  const { data: existingCustomer, error: lookupError } = await supabase
    .from("lightspeed_customers")
    .select(
      "id,total_spend,purchase_count,first_purchase_date,last_purchase_date",
    )
    .eq("tenant_id", profileRow.tenant_id)
    .eq("lightspeed_customer_id", profileRow.lightspeed_customer_id)
    .maybeSingle();

  if (lookupError) {
    throw lookupError;
  }

  if (existingCustomer) {
    const { error: updateError } = await supabase
      .from("lightspeed_customers")
      .update(sanitizedProfileRow)
      .eq("tenant_id", profileRow.tenant_id)
      .eq("lightspeed_customer_id", profileRow.lightspeed_customer_id);

    if (updateError) {
      throw updateError;
    }

    const { data: verifiedCustomer, error: verifyError } = await supabase
      .from("lightspeed_customers")
      .select(
        "id,total_spend,purchase_count,first_purchase_date,last_purchase_date",
      )
      .eq("tenant_id", profileRow.tenant_id)
      .eq("lightspeed_customer_id", profileRow.lightspeed_customer_id)
      .maybeSingle();

    if (verifyError) {
      throw verifyError;
    }

    return buildWriteResult("updated", verifiedCustomer ?? existingCustomer);
  }

  const insertRow = {
    ...sanitizedProfileRow,
    total_spend: 0,
    purchase_count: 0,
    first_purchase_date: null,
    last_purchase_date: null,
    created_at: now,
  };

  const { data: insertedCustomer, error: insertError } = await supabase
    .from("lightspeed_customers")
    .insert(insertRow)
    .select(
      "id,total_spend,purchase_count,first_purchase_date,last_purchase_date",
    )
    .single();

  if (insertError) {
    throw insertError;
  }

  return buildWriteResult("inserted", insertedCustomer);
}
