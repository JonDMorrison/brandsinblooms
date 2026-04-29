type RecalculateLightspeedCustomerSpendOptions = {
  tenantId: string;
  connectionId?: string | null;
  lightspeedCustomerId?: string;
  lightspeedCustomerIds?: string[];
};

type RecalculateLightspeedCustomerSpendResult = {
  updated: number;
  skipped: number;
  errors: number;
};

function toNullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeSaleStatus(status: unknown) {
  return typeof status === "string" ? status.trim().toLowerCase() : "";
}

function isCompletedLightspeedSaleStatus(status: unknown) {
  return ["completed", "closed", "paid"].includes(normalizeSaleStatus(status));
}

function normalizeDate(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export async function recalculateLightspeedCustomerSpend(
  supabase: any,
  options: RecalculateLightspeedCustomerSpendOptions,
): Promise<RecalculateLightspeedCustomerSpendResult> {
  const {
    tenantId,
    connectionId,
    lightspeedCustomerId,
    lightspeedCustomerIds,
  } = options;
  const stats: RecalculateLightspeedCustomerSpendResult = {
    updated: 0,
    skipped: 0,
    errors: 0,
  };

  const requestedCustomerIds = Array.from(
    new Set(
      [
        ...(Array.isArray(lightspeedCustomerIds) ? lightspeedCustomerIds : []),
        ...(lightspeedCustomerId ? [lightspeedCustomerId] : []),
      ].filter(
        (value): value is string =>
          typeof value === "string" && value.length > 0,
      ),
    ),
  );

  console.log(
    `[LS-SPEND] Starting spend recalculation for tenant=${tenantId}${connectionId ? `, connection=${connectionId}` : ""}${requestedCustomerIds.length > 0 ? `, customers=${requestedCustomerIds.length}` : ", customers=all"}`,
  );

  let customerQuery = supabase
    .from("lightspeed_customers")
    .select(
      "id,lightspeed_customer_id,contact_id,total_spend,purchase_count,first_purchase_date,last_purchase_date",
    )
    .eq("tenant_id", tenantId);

  if (requestedCustomerIds.length === 1) {
    customerQuery = customerQuery.eq(
      "lightspeed_customer_id",
      requestedCustomerIds[0],
    );
  } else if (requestedCustomerIds.length > 1) {
    customerQuery = customerQuery.in(
      "lightspeed_customer_id",
      requestedCustomerIds,
    );
  }

  const { data: customers, error: customerError } = await customerQuery;
  if (customerError) {
    console.error(
      "[LS-SPEND] Failed to fetch Lightspeed customers:",
      customerError.message,
    );
    stats.errors += 1;
    return stats;
  }

  if (!customers || customers.length === 0) {
    console.log("[LS-SPEND] No Lightspeed customers found for recalculation");
    return stats;
  }

  let salesQuery = supabase
    .from("lightspeed_sales")
    .select("lightspeed_customer_id,total_amount,sale_date,status")
    .eq("tenant_id", tenantId)
    .not("lightspeed_customer_id", "is", null);

  if (requestedCustomerIds.length === 1) {
    salesQuery = salesQuery.eq(
      "lightspeed_customer_id",
      requestedCustomerIds[0],
    );
  } else if (requestedCustomerIds.length > 1) {
    salesQuery = salesQuery.in("lightspeed_customer_id", requestedCustomerIds);
  }

  const { data: sales, error: salesError } = await salesQuery;
  if (salesError) {
    console.error(
      "[LS-SPEND] Failed to fetch Lightspeed sales:",
      salesError.message,
    );
    stats.errors += 1;
    return stats;
  }

  console.log(
    `[LS-SPEND] Processing ${customers.length} customers from ${sales?.length ?? 0} linked sales`,
  );

  const spendByCustomer = new Map<
    string,
    {
      totalSpend: number;
      purchaseCount: number;
      firstPurchaseDate: string | null;
      lastPurchaseDate: string | null;
    }
  >();

  for (const sale of sales ?? []) {
    const customerId =
      typeof sale.lightspeed_customer_id === "string"
        ? sale.lightspeed_customer_id
        : null;
    if (!customerId || !isCompletedLightspeedSaleStatus(sale.status)) {
      continue;
    }

    const totalAmount = toNullableNumber(sale.total_amount) ?? 0;
    const saleDate = normalizeDate(sale.sale_date);
    const current = spendByCustomer.get(customerId) ?? {
      totalSpend: 0,
      purchaseCount: 0,
      firstPurchaseDate: null,
      lastPurchaseDate: null,
    };

    current.totalSpend += totalAmount;
    current.purchaseCount += 1;

    if (saleDate) {
      if (!current.firstPurchaseDate || saleDate < current.firstPurchaseDate) {
        current.firstPurchaseDate = saleDate;
      }

      if (!current.lastPurchaseDate || saleDate > current.lastPurchaseDate) {
        current.lastPurchaseDate = saleDate;
      }
    }

    spendByCustomer.set(customerId, current);
  }

  console.log(
    `[LS-SPEND] Spend data aggregated for ${spendByCustomer.size} customers`,
  );

  for (const customer of customers) {
    const customerId = customer.lightspeed_customer_id;
    const aggregate = spendByCustomer.get(customerId) ?? {
      totalSpend: 0,
      purchaseCount: 0,
      firstPurchaseDate: null,
      lastPurchaseDate: null,
    };

    const currentSpend = toNullableNumber(customer.total_spend) ?? 0;
    const currentCount = customer.purchase_count ?? 0;
    const currentFirstPurchaseDate = normalizeDate(
      customer.first_purchase_date,
    );
    const currentLastPurchaseDate = normalizeDate(customer.last_purchase_date);

    if (
      Math.abs(currentSpend - aggregate.totalSpend) < 0.01 &&
      currentCount === aggregate.purchaseCount &&
      currentFirstPurchaseDate === aggregate.firstPurchaseDate &&
      currentLastPurchaseDate === aggregate.lastPurchaseDate
    ) {
      stats.skipped += 1;
      continue;
    }

    const { error: updateError } = await supabase
      .from("lightspeed_customers")
      .update({
        total_spend: aggregate.totalSpend,
        purchase_count: aggregate.purchaseCount,
        first_purchase_date: aggregate.firstPurchaseDate,
        last_purchase_date: aggregate.lastPurchaseDate,
        updated_at: new Date().toISOString(),
      })
      .eq("id", customer.id);

    if (updateError) {
      console.error(
        `[LS-SPEND] Failed to update Lightspeed customer ${customerId}:`,
        updateError.message,
      );
      stats.errors += 1;
      continue;
    }

    stats.updated += 1;

    const crmPayload = {
      total_spent: aggregate.totalSpend,
      pos_total_spent: aggregate.totalSpend,
      lifetime_value: aggregate.totalSpend,
      pos_order_count: aggregate.purchaseCount,
      first_purchase_date: aggregate.firstPurchaseDate,
      last_purchase_date: aggregate.lastPurchaseDate,
      updated_at: new Date().toISOString(),
    };

    let crmUpdated = false;
    if (customer.contact_id) {
      const { error: crmContactUpdateError } = await supabase
        .from("crm_customers")
        .update(crmPayload)
        .eq("id", customer.contact_id);

      if (crmContactUpdateError) {
        console.error(
          `[LS-SPEND] Failed to propagate spend to linked CRM customer ${customer.contact_id}:`,
          crmContactUpdateError.message,
        );
      } else {
        crmUpdated = true;
      }
    }

    if (!crmUpdated) {
      const { data: updatedCrmRows, error: crmExternalUpdateError } =
        await supabase
          .from("crm_customers")
          .update({
            ...crmPayload,
            pos_source: "lightspeed",
            external_id: customerId,
          })
          .eq("tenant_id", tenantId)
          .eq("pos_source", "lightspeed")
          .eq("external_id", customerId)
          .select("id");

      if (crmExternalUpdateError) {
        console.error(
          `[LS-SPEND] Failed to propagate spend to CRM by external_id for ${customerId}:`,
          crmExternalUpdateError.message,
        );
      } else if (!updatedCrmRows || updatedCrmRows.length === 0) {
        console.log(
          `[LS-SPEND] No linked CRM customer found for Lightspeed customer ${customerId}`,
        );
      }
    }
  }

  console.log(
    `[LS-SPEND] Recalculation complete: ${stats.updated} updated, ${stats.skipped} unchanged, ${stats.errors} errors`,
  );
  return stats;
}
