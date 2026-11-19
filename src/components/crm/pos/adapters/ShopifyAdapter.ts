import { POSAdapter, NormalizedCustomer, NormalizedOrder, TestConnectionResult, SyncOptions, PaginatedResult } from './POSAdapter.ts';

const SHOPIFY_SHOP_DOMAIN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;
const SHOPIFY_TIMEOUT_MS = 10_000;

/** The store's *.myshopify.com host, normalised; null for anything else (central-login 59, crm-r2-F79). */
function normalizeShopifyShopDomain(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const domain = value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
  return SHOPIFY_SHOP_DOMAIN.test(domain) ? domain : null;
}

export class ShopifyAdapter extends POSAdapter {
  private baseUrl: string;
  private accessToken: string;

  constructor(shopDomain: string, accessToken: string) {
    super();
    // Requests carry the caller's token: only a Shopify store host is ever contacted (crm-r2-F79).
    const domain = normalizeShopifyShopDomain(shopDomain);
    if (!domain) throw new Error('Enter a valid Shopify store domain (for example, mystore.myshopify.com).');
    this.baseUrl = `https://${domain}/admin/api/2024-01`;
    this.accessToken = accessToken;
  }

  private shopifyFetch(url: string): Promise<Response> {
    return fetch(url, {
      headers: {
        'X-Shopify-Access-Token': this.accessToken,
        'Content-Type': 'application/json',
      },
      redirect: 'error',
      signal: AbortSignal.timeout(SHOPIFY_TIMEOUT_MS),
    });
  }

  async testConnection(credentials: any): Promise<TestConnectionResult> {
    try {
      const response = await this.shopifyFetch(`${this.baseUrl}/shop.json`);

      if (!response.ok) {
        return {
          success: false,
          message: `Shopify API error: ${response.status}`
        };
      }

      const data = await response.json();
      return {
        success: true,
        message: 'Successfully connected to Shopify',
        details: { 
          shop: data.shop.name,
          domain: data.shop.domain,
          features: ['customers', 'orders', 'products']
        }
      };
    } catch {
      return {
        success: false,
        message: 'Could not reach Shopify. Check the store domain and access token.'
      };
    }
  }

  async fetchCustomers(credentials: any, options?: SyncOptions): Promise<PaginatedResult<any>> {
    await this.waitForRateLimit();
    
    const limit = options?.pageLimit || 50;
    let url = `${this.baseUrl}/customers.json?limit=${limit}`;
    
    if (options?.cursor) {
      url += `&page_info=${options.cursor}`;
    }

    const response = await this.shopifyFetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    // Get pagination info from Link header
    const linkHeader = response.headers.get('Link');
    const hasNextPage = linkHeader?.includes('rel="next"') || false;
    const nextCursor = hasNextPage ? this.extractCursorFromLink(linkHeader, 'next') : undefined;

    return {
      data: data.customers || [],
      nextCursor,
      hasMore: hasNextPage
    };
  }

  async fetchOrders(credentials: any, options?: SyncOptions): Promise<PaginatedResult<any>> {
    await this.waitForRateLimit();
    
    const limit = options?.pageLimit || 50;
    let url = `${this.baseUrl}/orders.json?limit=${limit}&status=any`;
    
    if (options?.cursor) {
      url += `&page_info=${options.cursor}`;
    }

    const response = await this.shopifyFetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    // Get pagination info from Link header
    const linkHeader = response.headers.get('Link');
    const hasNextPage = linkHeader?.includes('rel="next"') || false;
    const nextCursor = hasNextPage ? this.extractCursorFromLink(linkHeader, 'next') : undefined;

    return {
      data: data.orders || [],
      nextCursor,
      hasMore: hasNextPage
    };
  }

  async fetchProducts(credentials: any, options?: SyncOptions): Promise<PaginatedResult<any>> {
    await this.waitForRateLimit();
    
    const limit = options?.pageLimit || 50;
    let url = `${this.baseUrl}/products.json?limit=${limit}`;
    
    if (options?.cursor) {
      url += `&page_info=${options.cursor}`;
    }

    const response = await this.shopifyFetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    // Get pagination info from Link header
    const linkHeader = response.headers.get('Link');
    const hasNextPage = linkHeader?.includes('rel="next"') || false;
    const nextCursor = hasNextPage ? this.extractCursorFromLink(linkHeader, 'next') : undefined;

    return {
      data: data.products || [],
      nextCursor,
      hasMore: hasNextPage
    };
  }

  private extractCursorFromLink(linkHeader: string | null, rel: string): string | undefined {
    if (!linkHeader) return undefined;
    
    const links = linkHeader.split(',');
    for (const link of links) {
      if (link.includes(`rel="${rel}"`)) {
        const match = link.match(/page_info=([^&>]+)/);
        return match ? match[1] : undefined;
      }
    }
    return undefined;
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