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

export abstract class POSAdapter {
  abstract adaptCustomers(rawData: any): NormalizedCustomer[];
  abstract adaptOrders(rawData: any): NormalizedOrder[];
  
  abstract fetchCustomers(credentials: any): Promise<any>;
  abstract fetchOrders(credentials: any): Promise<any>;
  
  async syncData(credentials: any): Promise<NormalizedData> {
    const [rawCustomers, rawOrders] = await Promise.all([
      this.fetchCustomers(credentials),
      this.fetchOrders(credentials)
    ]);

    return {
      customers: this.adaptCustomers(rawCustomers),
      orders: this.adaptOrders(rawOrders)
    };
  }
}