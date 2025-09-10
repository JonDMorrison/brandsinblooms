import { POSAdapter, NormalizedCustomer, NormalizedOrder, TestConnectionResult, SyncOptions, PaginatedResult } from './POSAdapter';

export class ShopifyAdapter extends POSAdapter {
  private baseUrl: string;
  private accessToken: string;

  constructor(shopDomain: string, accessToken: string) {
    super();
    this.baseUrl = `https://${shopDomain}/admin/api/2024-01`;
    this.accessToken = accessToken;
  }

  async testConnection(credentials: any): Promise<TestConnectionResult> {
    try {
      const response = await fetch(`${this.baseUrl}/shop.json`, {
        headers: {
          'X-Shopify-Access-Token': this.accessToken,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return {
          success: false,
          message: `Shopify API error: ${response.status} ${response.statusText}`
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
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown connection error'
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

    const response = await fetch(url, {
      headers: {
        'X-Shopify-Access-Token': this.accessToken,
        'Content-Type': 'application/json',
      },
    });

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

    const response = await fetch(url, {
      headers: {
        'X-Shopify-Access-Token': this.accessToken,
        'Content-Type': 'application/json',
      },
    });

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

    const response = await fetch(url, {
      headers: {
        'X-Shopify-Access-Token': this.accessToken,
        'Content-Type': 'application/json',
      },
    });

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