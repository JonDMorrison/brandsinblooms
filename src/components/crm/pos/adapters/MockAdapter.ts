import { POSAdapter, NormalizedCustomer, NormalizedOrder, TestConnectionResult, SyncOptions, PaginatedResult } from './POSAdapter';

// Mock data for testing
const MOCK_CUSTOMERS = [
  {
    id: '1', email: 'john@example.com', first_name: 'John', last_name: 'Doe',
    phone: '+1234567890', tags: ['vip'], created_at: '2024-01-01T00:00:00Z'
  },
  {
    id: '2', email: 'jane@example.com', first_name: 'Jane', last_name: 'Smith',
    phone: '+1234567891', tags: ['regular'], created_at: '2024-01-02T00:00:00Z'
  },
  // Add 48 more customers to make 50 total
  ...Array.from({ length: 48 }, (_, i) => ({
    id: (i + 3).toString(),
    email: `customer${i + 3}@example.com`,
    first_name: `Customer`,
    last_name: `${i + 3}`,
    phone: `+123456${String(i + 3).padStart(4, '0')}`,
    tags: i % 3 === 0 ? ['vip'] : ['regular'],
    created_at: new Date(2024, 0, i + 3).toISOString()
  }))
];

const MOCK_ORDERS = Array.from({ length: 100 }, (_, i) => ({
  id: (i + 1).toString(),
  customer_id: Math.floor(Math.random() * 50) + 1,
  customer_email: MOCK_CUSTOMERS[Math.floor(Math.random() * 50)].email,
  order_number: `ORD-${String(i + 1).padStart(4, '0')}`,
  total: (Math.random() * 500 + 10).toFixed(2),
  currency: 'USD',
  status: ['completed', 'pending', 'cancelled'][Math.floor(Math.random() * 3)],
  created_at: new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1).toISOString(),
  line_items: [
    {
      product_id: Math.floor(Math.random() * 20) + 1,
      name: `Product ${Math.floor(Math.random() * 20) + 1}`,
      quantity: Math.floor(Math.random() * 3) + 1,
      price: (Math.random() * 100 + 5).toFixed(2)
    }
  ]
}));

export class MockAdapter extends POSAdapter {
  protected rateLimit = 500; // Simulate API rate limiting
  
  async testConnection(credentials: any): Promise<TestConnectionResult> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (!credentials || !credentials.apiKey) {
      return {
        success: false,
        message: 'API key is required for mock connection'
      };
    }
    
    if (credentials.apiKey === 'invalid') {
      return {
        success: false,
        message: 'Invalid API key provided'
      };
    }
    
    return {
      success: true,
      message: 'Successfully connected to Mock POS system',
      details: { 
        customerCount: MOCK_CUSTOMERS.length, 
        orderCount: MOCK_ORDERS.length,
        features: ['customers', 'orders', 'products']
      }
    };
  }
  
  async fetchCustomers(credentials: any, options?: SyncOptions): Promise<PaginatedResult<any>> {
    await this.waitForRateLimit();
    
    const pageLimit = options?.pageLimit || 20;
    const startIndex = options?.cursor ? parseInt(options.cursor) : 0;
    const endIndex = Math.min(startIndex + pageLimit, MOCK_CUSTOMERS.length);
    
    return {
      data: MOCK_CUSTOMERS.slice(startIndex, endIndex),
      nextCursor: endIndex < MOCK_CUSTOMERS.length ? endIndex.toString() : undefined,
      hasMore: endIndex < MOCK_CUSTOMERS.length
    };
  }

  async fetchOrders(credentials: any, options?: SyncOptions): Promise<PaginatedResult<any>> {
    await this.waitForRateLimit();
    
    const pageLimit = options?.pageLimit || 20;
    const startIndex = options?.cursor ? parseInt(options.cursor) : 0;
    const endIndex = Math.min(startIndex + pageLimit, MOCK_ORDERS.length);
    
    return {
      data: MOCK_ORDERS.slice(startIndex, endIndex),
      nextCursor: endIndex < MOCK_ORDERS.length ? endIndex.toString() : undefined,
      hasMore: endIndex < MOCK_ORDERS.length
    };
  }

  async fetchProducts(credentials: any, options?: SyncOptions): Promise<PaginatedResult<any>> {
    await this.waitForRateLimit();
    
    // Mock products data
    const MOCK_PRODUCTS = Array.from({ length: 50 }, (_, i) => ({
      id: (i + 1).toString(),
      name: `Product ${i + 1}`,
      description: `Description for product ${i + 1}`,
      price: (Math.random() * 200 + 10).toFixed(2),
      category: ['Electronics', 'Clothing', 'Home', 'Garden'][Math.floor(Math.random() * 4)],
      sku: `SKU${String(i + 1).padStart(3, '0')}`,
      created_at: new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1).toISOString()
    }));
    
    const pageLimit = options?.pageLimit || 20;
    const startIndex = options?.cursor ? parseInt(options.cursor) : 0;
    const endIndex = Math.min(startIndex + pageLimit, MOCK_PRODUCTS.length);
    
    return {
      data: MOCK_PRODUCTS.slice(startIndex, endIndex),
      nextCursor: endIndex < MOCK_PRODUCTS.length ? endIndex.toString() : undefined,
      hasMore: endIndex < MOCK_PRODUCTS.length
    };
  }

  adaptCustomers(rawCustomers: any[]): NormalizedCustomer[] {
    return rawCustomers.map(customer => ({
      name: `${customer.first_name} ${customer.last_name}`,
      email: customer.email,
      phone: customer.phone,
      pos_source: 'mock',
      tags: customer.tags || [],
      external_id: customer.id,
    }));
  }

  adaptOrders(rawOrders: any[]): NormalizedOrder[] {
    return rawOrders.map(order => ({
      order_id: order.id,
      customer_email: order.customer_email,
      date: order.created_at,
      total: parseFloat(order.total),
      currency: order.currency || 'USD',
      items: order.line_items.map((item: any) => ({
        name: item.name,
        quantity: item.quantity,
        price: parseFloat(item.price)
      })),
      external_customer_id: order.customer_id
    }));
  }
}