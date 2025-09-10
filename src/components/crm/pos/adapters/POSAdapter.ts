// POS Adapter Interface for normalizing different POS systems

export interface NormalizedCustomer {
  name: string;
  email: string;
  phone?: string;
  pos_source: string;
  tags?: string[];
  external_id?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
}

export interface NormalizedOrder {
  order_id: string;
  customer_email: string;
  date: string;
  total: number;
  currency?: string;
  items: Array<{
    name: string;
    category?: string;
    quantity: number;
    price?: number;
  }>;
  external_customer_id?: string;
}

export interface NormalizedData {
  customers: NormalizedCustomer[];
  orders: NormalizedOrder[];
}

export interface SyncOptions {
  entity?: 'customers' | 'products' | 'orders';
  mode?: 'full' | 'incremental';
  since?: string;
  pageLimit?: number;
  cursor?: string;
}

export interface TestConnectionResult {
  success: boolean;
  message: string;
  details?: any;
}

export interface SyncResult {
  success: boolean;
  cursor?: string;
  fetched: number;
  upserted: number;
  skipped: number;
  errors: string[];
}

export interface PaginatedResult<T> {
  data: T[];
  nextCursor?: string;
  hasMore: boolean;
}

export abstract class POSAdapter {
  abstract adaptCustomers(rawData: any): NormalizedCustomer[];
  abstract adaptOrders(rawData: any): NormalizedOrder[];
  
  abstract fetchCustomers(credentials: any, options?: SyncOptions): Promise<PaginatedResult<any>>;
  abstract fetchOrders(credentials: any, options?: SyncOptions): Promise<PaginatedResult<any>>;
  abstract fetchProducts?(credentials: any, options?: SyncOptions): Promise<PaginatedResult<any>>;
  
  abstract testConnection(credentials: any): Promise<TestConnectionResult>;
  
  // Rate limiting properties (ms between requests)
  protected rateLimit = 1000;
  protected lastRequest = 0;
  
  protected async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequest;
    if (timeSinceLastRequest < this.rateLimit) {
      await new Promise(resolve => setTimeout(resolve, this.rateLimit - timeSinceLastRequest));
    }
    this.lastRequest = Date.now();
  }
  
  async syncData(credentials: any): Promise<NormalizedData> {
    const [customersResult, ordersResult] = await Promise.all([
      this.fetchCustomers(credentials),
      this.fetchOrders(credentials)
    ]);

    return {
      customers: this.adaptCustomers(customersResult.data),
      orders: this.adaptOrders(ordersResult.data)
    };
  }
}