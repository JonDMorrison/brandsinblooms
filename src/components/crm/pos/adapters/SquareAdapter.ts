import { POSAdapter, NormalizedCustomer, NormalizedOrder, TestConnectionResult, SyncOptions, PaginatedResult } from './POSAdapter';

export class SquareAdapter extends POSAdapter {
  private baseUrl: string;
  private accessToken: string;
  private environment: string;

  constructor(accessToken: string, environment: string = 'sandbox') {
    super();
    this.accessToken = accessToken;
    this.environment = environment;
    this.baseUrl = environment === 'production' 
      ? 'https://connect.squareup.com'
      : 'https://connect.squareupsandbox.com';
  }

  async testConnection(credentials: any): Promise<TestConnectionResult> {
    try {
      const response = await fetch(`${this.baseUrl}/v2/locations`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
          'Square-Version': '2023-10-18'
        },
      });

      if (!response.ok) {
        return {
          success: false,
          message: `Square API error: ${response.status} ${response.statusText}`
        };
      }

      const data = await response.json();
      return {
        success: true,
        message: 'Successfully connected to Square',
        details: { 
          locations: data.locations?.length || 0,
          features: ['customers', 'payments', 'catalog']
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
    
    const response = await fetch(`${this.baseUrl}/v2/customers/search`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        'Square-Version': '2023-10-18'
      },
      body: JSON.stringify({
        limit: options?.pageLimit || 100,
        cursor: options?.cursor
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return {
      data: data.customers || [],
      nextCursor: data.cursor,
      hasMore: !!data.cursor
    };
  }

  async fetchOrders(credentials: any, options?: SyncOptions): Promise<PaginatedResult<any>> {
    await this.waitForRateLimit();
    
    const response = await fetch(`${this.baseUrl}/v2/payments`, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        'Square-Version': '2023-10-18'
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return {
      data: data.payments?.filter((payment: any) => payment.status === 'COMPLETED') || [],
      nextCursor: data.cursor,
      hasMore: !!data.cursor
    };
  }

  async fetchProducts(credentials: any, options?: SyncOptions): Promise<PaginatedResult<any>> {
    await this.waitForRateLimit();
    
    const response = await fetch(`${this.baseUrl}/v2/catalog/search`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        'Square-Version': '2023-10-18'
      },
      body: JSON.stringify({
        object_types: ['ITEM'],
        limit: options?.pageLimit || 100,
        cursor: options?.cursor
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return {
      data: data.objects || [],
      nextCursor: data.cursor,
      hasMore: !!data.cursor
    };
  }

  adaptCustomers(rawCustomers: any[]): NormalizedCustomer[] {
    return rawCustomers.map(customer => {
      const name = customer.given_name && customer.family_name
        ? `${customer.given_name} ${customer.family_name}`
        : customer.company_name || 'Unknown Customer';

      return {
        name,
        email: customer.email_address,
        phone: customer.phone_number,
        pos_source: 'square',
        tags: customer.segment_ids || [],
        external_id: customer.id,
        address: customer.address ? {
          street: `${customer.address.address_line_1 || ''} ${customer.address.address_line_2 || ''}`.trim(),
          city: customer.address.locality,
          state: customer.address.administrative_district_level_1,
          zip: customer.address.postal_code,
          country: customer.address.country,
        } : undefined,
      };
    });
  }

  adaptOrders(rawPayments: any[]): NormalizedOrder[] {
    return rawPayments
      .filter(payment => payment.status === 'COMPLETED')
      .map(payment => ({
        order_id: payment.id,
        customer_email: payment.buyer_email_address || '',
        date: payment.created_at,
        total: payment.amount_money ? payment.amount_money.amount / 100 : 0, // Square uses cents
        currency: payment.amount_money?.currency || 'USD',
        external_customer_id: payment.customer_id,
        items: [
          {
            name: payment.note || 'Square Transaction',
            category: 'Payment',
            quantity: 1,
            price: payment.amount_money ? payment.amount_money.amount / 100 : 0,
          }
        ],
      }));
  }
}