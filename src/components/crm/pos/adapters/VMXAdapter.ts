import { POSAdapter, NormalizedCustomer, NormalizedOrder } from './POSAdapter';

export class VMXAdapter extends POSAdapter {
  // VMX doesn't have an API, so we work with CSV data directly
  
  async fetchCustomers(csvData: any[]): Promise<any> {
    return csvData;
  }

  async fetchOrders(csvData: any[]): Promise<any> {
    return csvData;
  }

  adaptCustomers(csvData: any[]): NormalizedCustomer[] {
    return csvData.map(row => ({
      name: row.name || `${row.first_name || ''} ${row.last_name || ''}`.trim(),
      email: row.email,
      phone: row.phone || row.phone_number,
      pos_source: 'vmx',
      tags: row.tags ? row.tags.split(',').map((tag: string) => tag.trim()) : [],
      external_id: row.customer_id || row.id,
    }));
  }

  adaptOrders(csvData: any[]): NormalizedOrder[] {
    return csvData
      .filter(row => row.product && row.date && row.amount)
      .map((row, index) => ({
        order_id: row.order_id || `vmx_${Date.now()}_${index}`,
        customer_email: row.email,
        date: row.date,
        total: parseFloat(row.amount) || 0,
        currency: row.currency || 'USD',
        external_customer_id: row.customer_id || row.id,
        items: [
          {
            name: row.product || row.product_name,
            category: row.category || row.product_category || 'General',
            quantity: parseInt(row.quantity) || 1,
            price: parseFloat(row.amount) || 0,
          }
        ],
      }));
  }

  // Override syncData for VMX since it's CSV-based
  async syncData(csvData: any[]): Promise<{ customers: NormalizedCustomer[]; orders: NormalizedOrder[] }> {
    return {
      customers: this.adaptCustomers(csvData),
      orders: this.adaptOrders(csvData)
    };
  }
}