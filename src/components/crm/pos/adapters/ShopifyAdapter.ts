import { POSAdapter, NormalizedCustomer, NormalizedOrder, TestConnectionResult, SyncOptions, PaginatedResult } from './POSAdapter';

export class ShopifyAdapter extends POSAdapter {
  private baseUrl: string;
  private accessToken: string;

  constructor(shopDomain: string, accessToken: string) {
    super();
    this.baseUrl = `https://${shopDomain}`;
    this.accessToken = accessToken;
  }

  async fetchCustomers(credentials?: any): Promise<any> {
    const response = await fetch(`${this.baseUrl}/admin/api/2024-01/customers.json`, {
      headers: {
        'X-Shopify-Access-Token': this.accessToken,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Shopify API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.customers || [];
  }

  async fetchOrders(credentials?: any): Promise<any> {
    const response = await fetch(`${this.baseUrl}/admin/api/2024-01/orders.json?status=any&limit=250`, {
      headers: {
        'X-Shopify-Access-Token': this.accessToken,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Shopify API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.orders || [];
  }

  adaptCustomers(rawCustomers: any[]): NormalizedCustomer[] {
    return rawCustomers.map(customer => ({
      name: `${customer.first_name || ''} ${customer.last_name || ''}`.trim(),
      email: customer.email,
      phone: customer.phone,
      pos_source: 'shopify',
      tags: customer.tags ? customer.tags.split(',').map((tag: string) => tag.trim()) : [],
      external_id: customer.id.toString(),
      address: customer.default_address ? {
        street: `${customer.default_address.address1 || ''} ${customer.default_address.address2 || ''}`.trim(),
        city: customer.default_address.city,
        state: customer.default_address.province,
        zip: customer.default_address.zip,
        country: customer.default_address.country,
      } : undefined,
    }));
  }

  adaptOrders(rawOrders: any[]): NormalizedOrder[] {
    return rawOrders.map(order => ({
      order_id: order.id.toString(),
      customer_email: order.email || order.customer?.email || '',
      date: order.created_at,
      total: parseFloat(order.total_price),
      currency: order.currency,
      external_customer_id: order.customer?.id?.toString(),
      items: order.line_items.map((item: any) => ({
        name: item.name,
        category: item.product_type || 'Uncategorized',
        quantity: item.quantity,
        price: parseFloat(item.price),
      })),
    }));
  }
}