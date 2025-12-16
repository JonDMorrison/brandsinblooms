/**
 * Clover Field Mappings for BloomSuite
 * 
 * These mapping objects document how Clover API fields map to BloomSuite's
 * internal data models. They serve as reference documentation for the
 * sync engine and future integration work.
 * 
 * Note: These are code-only reference mappings, not stored in the database.
 */

export interface FieldMapping {
  clover: string;
  bloomsuite: string;
  type: 'string' | 'number' | 'boolean' | 'timestamp' | 'array' | 'object';
  transform?: string;
  description?: string;
}

export interface EntityMapping {
  source: 'clover';
  entity: string;
  targetTable: string;
  fields: Record<string, FieldMapping>;
}

/**
 * Customer Mapping
 * Clover Customer → crm_customers
 */
export const cloverCustomerMapping: EntityMapping = {
  source: 'clover',
  entity: 'customer',
  targetTable: 'crm_customers',
  fields: {
    id: {
      clover: 'id',
      bloomsuite: 'clover_customer_id',
      type: 'string',
      description: 'Unique Clover customer identifier',
    },
    firstName: {
      clover: 'firstName',
      bloomsuite: 'first_name',
      type: 'string',
    },
    lastName: {
      clover: 'lastName',
      bloomsuite: 'last_name',
      type: 'string',
    },
    email: {
      clover: 'emailAddresses.elements[0].emailAddress',
      bloomsuite: 'email',
      type: 'string',
      description: 'Primary email from emailAddresses array',
    },
    phone: {
      clover: 'phoneNumbers.elements[0].phoneNumber',
      bloomsuite: 'phone',
      type: 'string',
      description: 'Primary phone from phoneNumbers array',
    },
    marketingAllowed: {
      clover: 'marketingAllowed',
      bloomsuite: 'email_opt_in',
      type: 'boolean',
      description: 'Whether customer has opted in to marketing',
    },
    customerSince: {
      clover: 'customerSince',
      bloomsuite: 'first_purchase_date',
      type: 'timestamp',
      transform: 'unix_ms_to_iso',
    },
  },
};

/**
 * Item/Product Mapping
 * Clover Item → pos_products
 */
export const cloverItemMapping: EntityMapping = {
  source: 'clover',
  entity: 'item',
  targetTable: 'pos_products',
  fields: {
    id: {
      clover: 'id',
      bloomsuite: 'external_id',
      type: 'string',
      description: 'Unique Clover item identifier',
    },
    name: {
      clover: 'name',
      bloomsuite: 'name',
      type: 'string',
    },
    sku: {
      clover: 'sku || code',
      bloomsuite: 'sku',
      type: 'string',
      description: 'SKU or item code',
    },
    price: {
      clover: 'price / 100',
      bloomsuite: 'price',
      type: 'number',
      transform: 'cents_to_dollars',
      description: 'Price in dollars (Clover stores in cents)',
    },
    stockCount: {
      clover: 'stockCount',
      bloomsuite: 'stock_quantity',
      type: 'number',
    },
    isRevenue: {
      clover: 'isRevenue',
      bloomsuite: 'is_revenue_item',
      type: 'boolean',
      description: 'Whether item generates revenue',
    },
    hidden: {
      clover: 'hidden',
      bloomsuite: 'is_hidden',
      type: 'boolean',
    },
    categories: {
      clover: 'categories.elements',
      bloomsuite: 'product_tags',
      type: 'array',
      transform: 'extract_category_names',
      description: 'Array of category names',
    },
  },
};

/**
 * Order Mapping
 * Clover Order → pos_orders
 */
export const cloverOrderMapping: EntityMapping = {
  source: 'clover',
  entity: 'order',
  targetTable: 'pos_orders',
  fields: {
    id: {
      clover: 'id',
      bloomsuite: 'external_order_id',
      type: 'string',
      description: 'Unique Clover order identifier',
    },
    total: {
      clover: 'total / 100',
      bloomsuite: 'total_amount',
      type: 'number',
      transform: 'cents_to_dollars',
    },
    createdTime: {
      clover: 'createdTime',
      bloomsuite: 'order_date',
      type: 'timestamp',
      transform: 'unix_ms_to_iso',
    },
    state: {
      clover: 'state',
      bloomsuite: 'status',
      type: 'string',
      description: 'Order state (open, locked, etc.)',
    },
    currency: {
      clover: 'currency',
      bloomsuite: 'currency',
      type: 'string',
    },
    customerId: {
      clover: 'customers.elements[0].id',
      bloomsuite: 'customer_external_id',
      type: 'string',
      description: 'Associated customer ID if present',
    },
    lineItems: {
      clover: 'lineItems.elements',
      bloomsuite: 'line_items',
      type: 'array',
      description: 'Order line items for product analysis',
    },
  },
};

/**
 * Payment Mapping
 * Clover Payment → payment records
 */
export const cloverPaymentMapping: EntityMapping = {
  source: 'clover',
  entity: 'payment',
  targetTable: 'pos_payments',
  fields: {
    id: {
      clover: 'id',
      bloomsuite: 'external_payment_id',
      type: 'string',
    },
    amount: {
      clover: 'amount / 100',
      bloomsuite: 'amount',
      type: 'number',
      transform: 'cents_to_dollars',
    },
    tender: {
      clover: 'tender.label || tender.labelKey',
      bloomsuite: 'payment_method',
      type: 'string',
      description: 'Payment tender type (cash, card, etc.)',
    },
    createdTime: {
      clover: 'createdTime',
      bloomsuite: 'payment_date',
      type: 'timestamp',
      transform: 'unix_ms_to_iso',
    },
    result: {
      clover: 'result',
      bloomsuite: 'status',
      type: 'string',
      description: 'Payment result (SUCCESS, DECLINED, etc.)',
    },
    orderId: {
      clover: 'order.id',
      bloomsuite: 'order_external_id',
      type: 'string',
    },
  },
};

/**
 * Employee Mapping
 * Clover Employee → (reference only, not synced)
 */
export const cloverEmployeeMapping: EntityMapping = {
  source: 'clover',
  entity: 'employee',
  targetTable: 'pos_employees',
  fields: {
    id: {
      clover: 'id',
      bloomsuite: 'external_id',
      type: 'string',
    },
    name: {
      clover: 'name',
      bloomsuite: 'name',
      type: 'string',
    },
    role: {
      clover: 'role',
      bloomsuite: 'role',
      type: 'string',
    },
    email: {
      clover: 'email',
      bloomsuite: 'email',
      type: 'string',
    },
  },
};

/**
 * Transform functions documentation
 */
export const transformFunctions = {
  cents_to_dollars: (cents: number) => cents / 100,
  unix_ms_to_iso: (timestamp: number) => new Date(timestamp).toISOString(),
  extract_category_names: (categories: any[]) => 
    categories?.map((c: any) => c.name).filter(Boolean) || [],
};

/**
 * Get all mappings as a collection
 */
export const allCloverMappings = {
  customer: cloverCustomerMapping,
  item: cloverItemMapping,
  order: cloverOrderMapping,
  payment: cloverPaymentMapping,
  employee: cloverEmployeeMapping,
};
